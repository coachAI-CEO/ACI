/**
 * BOARD_AI_BARE=1: a clean board for judging what the AI does with arrows.
 *
 *  - no build-out box / zone rectangles and no caption notes on any frame
 *  - in play-out requests the placement code still positions the players, but the arrows are the
 *    model's own (normally the placement's preset arrows replace them)
 *
 * Pure functions, no I/O.
 */
import { ensureDiagramObjectIds } from '@aci/shared';
import { anchorBallToFirstPass } from './board-ai-light-repair';
import type { WebDiagramV1 } from './web-diagram-v1';

export const isBareBoard = () => process.env.BOARD_AI_BARE === '1';

/** Remove areas (zone boxes) and labels (caption notes) from the root and every sequence frame. */
export function stripAnnotations(d: WebDiagramV1): WebDiagramV1 {
  const seq = d.sequence;
  return {
    ...d,
    areas: [],
    labels: [],
    ...(seq?.frames?.length
      ? { sequence: { ...seq, frames: seq.frames.map((f) => ({ ...f, areas: [], labels: [] })) } }
      : {}),
  };
}

/**
 * Keep the placement's player positions, take the arrows from the model's diagram. A model frame's
 * arrows go on the matching placed frame; a model that drew one picture (root arrows only) puts them
 * on the active frame.
 */
export function carryModelArrows(placed: WebDiagramV1, model: WebDiagramV1): WebDiagramV1 {
  const frames = placed.sequence?.frames;
  if (!frames?.length) return ensureDiagramObjectIds(anchorBallToFirstPass({ ...placed, arrows: model.arrows || [] }));
  const modelFrames = model.sequence?.frames;
  const activeIdx = Math.max(0, frames.findIndex((f) => f.id === placed.sequence!.activeFrameId));
  // The ball goes with the model's passes, not with the preset arrows it replaces.
  const next = frames.map((f, i) =>
    anchorBallToFirstPass({
      ...f,
      arrows: modelFrames?.[i]?.arrows ?? (i === activeIdx ? model.arrows || [] : []),
    })
  );
  // The model's arrows come without ids; stamp them so the editor can select / delete them.
  return ensureDiagramObjectIds({
    ...placed,
    arrows: next[activeIdx].arrows,
    balls: next[activeIdx].balls,
    sequence: { ...placed.sequence!, frames: next },
  });
}
