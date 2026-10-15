/**
 * One frame per action (BOARD_AI_LIGHT_REPAIR=1).
 *
 * The model decides WHO does WHAT (an ordered list of pass / run arrows). This turns that list into a
 * filmstrip the way frame-based tactics tools do: frame k shows the state just before action k, with
 * the ball where the action starts and only that action's arrow solid; the previous action stays as a
 * faint ghost, and a closing frame shows where everyone ended up. A pass moves the ball to the
 * receiver; a run moves the runner (and the ball too, if the runner has it). Pure functions.
 */
import type { WebDiagramV1 } from './web-diagram-v1';

type Player = WebDiagramV1['players'][number];
type Arrow = WebDiagramV1['arrows'][number];
type Frame = NonNullable<WebDiagramV1['sequence']>['frames'][number];
type Pt = { x: number; y: number };
type Ref = Arrow['from'];

/** About six actions read as a clean filmstrip; the rest are dropped rather than crammed in. */
export const MAX_ACTION_FRAMES = 6;
/** A runner this close to the ball is treated as carrying it. */
const CARRIES_BALL = 6;

const isAction = (a: Arrow) => a.type === 'pass' || a.type === 'run';

function resolve(ref: Ref | undefined, players: Player[]): Pt | null {
  if (!ref) return null;
  const p = ref.playerId ? players.find((q) => q.id === ref.playerId) : undefined;
  if (p) return { x: p.x, y: p.y };
  return typeof ref.x === 'number' && typeof ref.y === 'number' ? { x: ref.x, y: ref.y } : null;
}

function label(ref: Ref | undefined, players: Player[]): string {
  const p = ref?.playerId ? players.find((q) => q.id === ref.playerId) : undefined;
  return p ? `${p.team === 'DEF' ? 'DEF' : 'ATT'} ${p.number ?? ''}`.trim() : 'space';
}

/** The ordered pass / run arrows: by explicit `order`, otherwise as drawn. */
export function orderedActions(arrows: Arrow[]): Arrow[] {
  return arrows
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => isAction(a))
    .sort((x, y) => (x.a.order ?? 99) - (y.a.order ?? 99) || x.i - y.i)
    .map(({ a }) => a);
}

/** Expand when there is more than one action and it reads as steps: asked for, numbered, or a chain of receivers. */
export function shouldExpandToFrames(diagram: WebDiagramV1, asksForSteps: boolean): boolean {
  if (diagram.sequence?.frames?.length) return false;
  const actions = orderedActions(diagram.arrows || []);
  if (actions.length < 2) return false;
  const numbered = new Set(actions.map((a) => a.order).filter((o): o is number => typeof o === 'number')).size >= 2;
  // One action's receiver becoming the next action's player ("8 to 9, who lays it off to 10") is a sequence.
  const chained = actions.slice(1).some((a, i) => !!a.from.playerId && a.from.playerId === actions[i].to.playerId);
  return asksForSteps || numbered || chained;
}

export function expandActionsToFrames(diagram: WebDiagramV1): WebDiagramV1 {
  const all = diagram.arrows || [];
  const actions = orderedActions(all).slice(0, MAX_ACTION_FRAMES);
  if (actions.length < 2) return diagram;
  const context = all.filter((a) => !isAction(a)); // press / cover lines etc. stay on every frame

  let players: Player[] = (diagram.players || []).map((p) => ({ ...p }));
  const ballTemplate = diagram.balls?.[0] || { id: 'b-0', x: 50, y: 50 };
  // The ball belongs to the first passer from the start, even when someone else runs first (an overlap).
  const firstPass = actions.find((a) => a.type === 'pass');
  const firstPasser = firstPass ? resolve(firstPass.from, players) : null;
  let ball: Pt = firstPasser ?? { x: ballTemplate.x, y: ballTemplate.y };

  const layers = (extra: Partial<Frame>): Omit<Frame, 'id'> => ({
    players: players.map((p) => ({ ...p })),
    arrows: [],
    areas: diagram.areas || [],
    labels: diagram.labels || [],
    balls: [{ ...ballTemplate, x: ball.x, y: ball.y }],
    goals: diagram.goals,
    coach: diagram.coach,
    cones: diagram.cones,
    elements: diagram.elements,
    ...extra,
  });
  const ghost = (a: Arrow): Arrow => ({ ...a, id: a.id ? `${a.id}-prev` : undefined, style: 'dotted', weight: 'normal', order: undefined });

  const frames: Frame[] = [];
  actions.forEach((a, i) => {
    const prev = i > 0 ? actions[i - 1] : null;
    frames.push({
      id: `f-${i + 1}`,
      title: `${label(a.from, players)} ${a.type === 'pass' ? 'passes to' : 'runs to'} ${label(a.to, players)}`,
      durationMs: 1600,
      ...layers({ arrows: [...context, ...(prev ? [ghost(prev)] : []), { ...a, order: undefined }] }),
    });
    // advance the world past this action
    const to = resolve(a.to, players);
    if (a.type === 'pass') {
      if (to) ball = to;
    } else if (to) {
      const runnerId = a.from.playerId;
      const runner = runnerId ? players.find((p) => p.id === runnerId) : undefined;
      if (runner) {
        if (Math.hypot(runner.x - ball.x, runner.y - ball.y) <= CARRIES_BALL) ball = to;
        players = players.map((p) => (p.id === runnerId ? { ...p, x: to.x, y: to.y } : p));
      }
    }
  });
  const last = actions[actions.length - 1];
  frames.push({ id: `f-${actions.length + 1}`, title: 'Result', durationMs: 1600, ...layers({ arrows: [...context, ghost(last)] }) });

  const start = frames[0];
  return {
    ...diagram,
    players: start.players,
    arrows: start.arrows,
    balls: start.balls,
    sequence: { frames, activeFrameId: start.id },
  };
}

/**
 * A combo / sequence that arrives as Start + one Play frame carrying every arrow: keep the earlier
 * frames and replace the last one with one frame per action. Ids continue the existing numbering.
 */
export function expandPlayFrameIntoSteps(diagram: WebDiagramV1): WebDiagramV1 {
  const frames = diagram.sequence?.frames;
  if (!frames || frames.length < 2) return diagram;
  const play = frames[frames.length - 1];
  if (orderedActions(play.arrows || []).length < 2) return diagram;
  const asBoard: WebDiagramV1 = {
    ...diagram,
    players: play.players || diagram.players,
    arrows: play.arrows || [],
    areas: play.areas || [],
    labels: play.labels || [],
    balls: play.balls ?? diagram.balls,
    sequence: undefined,
  };
  const steps = expandActionsToFrames(asBoard).sequence!.frames.map((f, i) => ({ ...f, id: `f-${frames.length + i}` }));
  const all = [...frames.slice(0, -1), ...steps];
  const active = steps[0];
  return {
    ...diagram,
    players: active.players,
    arrows: active.arrows,
    balls: active.balls,
    sequence: { frames: all, activeFrameId: active.id },
  };
}
