/**
 * Web view of @aci/shared board-sequence.
 *
 * Canonical source: `packages/shared/src/board/sequence.ts`.
 *
 * In the shared types an object's `id` is optional (the API and mobile app may
 * omit it). The web editor selects/deletes by id and Play matches objects across
 * frames, so here the diagram types require one (see `@/types/diagram`). These
 * functions stamp any missing ids (`ensureDiagramObjectIds`) before returning, so
 * re-exporting them with the stricter web signatures is accurate. Functions that
 * only read a diagram are re-exported unchanged.
 */
import * as shared from "@aci/shared";
import type { DiagramFrameLayers, DiagramSequenceFrame, DiagramV1 } from "@/types/diagram";

export {
  BOARD_SEQUENCE_MAX_FRAMES,
  BOARD_SEQUENCE_DEFAULT_DURATION_MS,
  BOARD_SEQUENCE_TWEEN_MS,
  getActiveFrameIndex,
  getSequenceSummary,
} from "@aci/shared";

type Meta = Partial<Pick<DiagramSequenceFrame, "id" | "title" | "note" | "durationMs">>;
type MetaPatch = Partial<Pick<DiagramSequenceFrame, "title" | "note" | "durationMs">>;

export const extractFrameLayers = shared.extractFrameLayers as unknown as (
  diagram: shared.WebDiagramV1 | shared.WebDiagramFrameLayers
) => DiagramFrameLayers;
export const applyFrameLayers = shared.applyFrameLayers as unknown as (
  diagram: DiagramV1,
  layers: DiagramFrameLayers
) => DiagramV1;
export const layersToFrame = shared.layersToFrame as unknown as (
  layers: DiagramFrameLayers,
  meta?: Meta
) => DiagramSequenceFrame;
export const ensureSequence = shared.ensureSequence as unknown as (diagram: DiagramV1) => DiagramV1;
export const syncActiveFrame = shared.syncActiveFrame as unknown as (diagram: DiagramV1) => DiagramV1;
export const selectFrame = shared.selectFrame as unknown as (diagram: DiagramV1, frameId: string) => DiagramV1;
export const selectFrameByIndex = shared.selectFrameByIndex as unknown as (
  diagram: DiagramV1,
  index: number
) => DiagramV1;
export const duplicateActiveFrame = shared.duplicateActiveFrame as unknown as (diagram: DiagramV1) => DiagramV1;
export const deleteActiveFrame = shared.deleteActiveFrame as unknown as (diagram: DiagramV1) => DiagramV1;
export const updateActiveFrameMeta = shared.updateActiveFrameMeta as unknown as (
  diagram: DiagramV1,
  patch: MetaPatch
) => DiagramV1;
export const renameFramesSequentially = shared.renameFramesSequentially as unknown as (
  diagram: DiagramV1
) => DiagramV1;
export const interpolateLayers = shared.interpolateLayers as unknown as (
  from: DiagramFrameLayers,
  to: DiagramFrameLayers,
  t: number
) => DiagramFrameLayers;
