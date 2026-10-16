/**
 * Board operations: the precise way to change a board.
 *
 * Instead of handing back a whole new diagram (which then has to be repaired), a caller sends a short
 * list of small, validated operations against the CURRENT board. The batch is all-or-nothing, every
 * operation is checked strictly (unknown fields, out-of-range coordinates and unknown players are
 * errors with a message precise enough for the sender to correct itself), and a content `revision`
 * rejects an edit made against a stale board. Pure functions, no I/O.
 *
 * Players are addressed by `{ team, number }` (unique on a board) or `{ playerId }`; arrow ends and the
 * ball can point at a player or at a coordinate. Every operation takes an optional `frame` (default: the
 * active frame), so a sequence is edited one frame at a time. A frame can be named by id, or "last" (the final
 * frame, e.g. the one add_frame just made) or "active".
 */
import crypto from 'crypto';
import { BOARD_SEQUENCE_DEFAULT_DURATION_MS, ensureDiagramObjectIds, fromTeamFrame, newObjectId, toTeamFrame } from '@aci/shared';
import { roleBand } from './board-phase-placement';
import { build11v11FormationPlayers, type WebDiagramV1 } from './web-diagram-v1';

type Player = WebDiagramV1['players'][number];
type Arrow = WebDiagramV1['arrows'][number];
type Frame = NonNullable<WebDiagramV1['sequence']>['frames'][number];
type Layers = Pick<WebDiagramV1, 'players' | 'arrows' | 'areas' | 'labels' | 'balls'>;

export const MAX_OPS = 100;
export const MAX_FRAMES = 12;
/** The sequence normaliser clamps frame hold time to this range and titles to this length; ops must agree with it. */
export const FRAME_MS_MIN = 400;
export const FRAME_MS_MAX = 12000;
export const FRAME_TITLE_MAX = 80;
export const DEFAULT_FRAME_MS = BOARD_SEQUENCE_DEFAULT_DURATION_MS;
export const SUPPORTED_FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'] as const;
const ARROW_TYPES = ['pass', 'run', 'press', 'cover', 'transition'] as const;
const ARROW_STYLES = ['solid', 'dashed', 'dotted'] as const;
const ARROW_WEIGHTS = ['normal', 'bold'] as const;
const TEAMS = ['ATT', 'DEF', 'NEUTRAL'] as const;

export type PlayerRef = { playerId: string } | { team: 'ATT' | 'DEF' | 'NEUTRAL'; number: number };
export type PointRef = PlayerRef | { x: number; y: number };

export type BoardOp = { frame?: string } & (
  | { op: 'set_formation'; team: 'ATT' | 'DEF'; formation: string }
  | { op: 'add_player'; team: 'ATT' | 'DEF' | 'NEUTRAL'; number: number; x: number; y: number; role?: string; name?: string }
  | { op: 'move_player'; player: PlayerRef; x: number; y: number }
  | { op: 'nudge_player'; player: PlayerRef; forward_m?: number; right_m?: number }
  | { op: 'place_relative'; player: PlayerRef; to: PlayerRef; forward_m?: number; right_m?: number }
  | { op: 'update_player'; player: PlayerRef; patch: { role?: string; number?: number; name?: string; group?: string } }
  | { op: 'remove_player'; player: PlayerRef }
  | { op: 'clear_team'; team: 'ATT' | 'DEF' | 'NEUTRAL' }
  | { op: 'set_block'; team: 'ATT' | 'DEF'; height: 'high' | 'mid' | 'low' }
  | { op: 'set_ball'; x?: number; y?: number; carrier?: PlayerRef }
  | { op: 'add_arrow'; type: (typeof ARROW_TYPES)[number]; from: PointRef; to: PointRef; style?: string; weight?: string; order?: number }
  | { op: 'update_arrow'; arrowId: string; patch: { type?: string; style?: string; weight?: string; order?: number; from?: PointRef; to?: PointRef } }
  | { op: 'remove_arrow'; arrowId: string }
  | { op: 'add_frame'; after?: string; copyFrom?: string; title?: string; arrows?: 'ghost' | 'keep' | 'clear' }
  | { op: 'update_frame'; title?: string; note?: string; durationMs?: number }
  | { op: 'remove_frame' }
  | { op: 'set_active_frame' }
);

export type OpResult = { index: number; op: string; ok: true; message: string };
export type OpsOutcome =
  | { ok: true; diagram: WebDiagramV1; revision: string; results: OpResult[] }
  | { ok: false; revision: string; error: { index: number; code: string; message: string } };

class OpError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
const fail = (code: string, message: string): never => {
  throw new OpError(code, message);
};

/** Short content hash of the board: an edit sent with an older revision is rejected. */
export function revisionOf(d: WebDiagramV1): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, stable((v as any)[k])]))
        : v;
  return crypto.createHash('sha1').update(JSON.stringify(stable(d))).digest('hex').slice(0, 10);
}

const KEYS: Record<string, string[]> = {
  set_formation: ['op', 'frame', 'team', 'formation'],
  add_player: ['op', 'frame', 'team', 'number', 'x', 'y', 'role', 'name'],
  move_player: ['op', 'frame', 'player', 'x', 'y'],
  nudge_player: ['op', 'frame', 'player', 'forward_m', 'right_m'],
  place_relative: ['op', 'frame', 'player', 'to', 'forward_m', 'right_m'],
  update_player: ['op', 'frame', 'player', 'patch'],
  remove_player: ['op', 'frame', 'player'],
  clear_team: ['op', 'frame', 'team'],
  set_block: ['op', 'frame', 'team', 'height'],
  set_ball: ['op', 'frame', 'x', 'y', 'carrier'],
  add_arrow: ['op', 'frame', 'type', 'from', 'to', 'style', 'weight', 'order'],
  update_arrow: ['op', 'frame', 'arrowId', 'patch'],
  remove_arrow: ['op', 'frame', 'arrowId'],
  add_frame: ['op', 'after', 'copyFrom', 'title', 'arrows'],
  update_frame: ['op', 'frame', 'title', 'note', 'durationMs'],
  remove_frame: ['op', 'frame'],
  set_active_frame: ['op', 'frame'],
};

const coord = (v: unknown, name: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail('invalid_value', `${name} must be a number.`);
  if ((v as number) < 0 || (v as number) > 100) fail('out_of_range', `${name} must be between 0 and 100 (got ${v}).`);
  return v as number;
};
const oneOf = <T extends readonly string[]>(v: unknown, list: T, name: string): T[number] =>
  (list as readonly string[]).includes(v as string) ? (v as T[number]) : fail('invalid_value', `${name} must be one of ${list.join(', ')} (got ${JSON.stringify(v)}).`);
const arrowOrder = (v: unknown): number =>
  Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 12 ? (v as number) : fail('invalid_value', `order must be a whole number from 1 to 12 (got ${JSON.stringify(v)}).`);
const shirt = (v: unknown): number =>
  Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 99 ? (v as number) : fail('invalid_value', `number must be a whole number from 1 to 99 (got ${JSON.stringify(v)}).`);

function checkKeys(op: any, allowed: string[], where = 'operation') {
  for (const k of Object.keys(op)) if (!allowed.includes(k)) fail('unknown_field', `${where} "${op.op}" does not take "${k}". Allowed: ${allowed.filter((a) => a !== 'op').join(', ') || 'none'}.`);
}

/** The layers an operation works on: the named frame, else the active frame, else the board itself. */
function layersFor(d: WebDiagramV1, frame?: string): { layers: Layers; frame: Frame | null } {
  const frames = d.sequence?.frames;
  if (!frames?.length) {
    if (frame) fail('no_such_frame', `This board has no frames, so "${frame}" does not exist. Use add_frame first.`);
    return { layers: d, frame: null };
  }
  const id = frame === 'last' ? frames[frames.length - 1].id : frame === 'active' || frame === undefined ? (d.sequence!.activeFrameId ?? frames[0].id) : frame;
  const f = frames.find((x) => x.id === id);
  if (!f) fail('no_such_frame', `No frame "${id}". Frames: ${frames.map((x) => x.id).join(', ')}.`);
  return { layers: f as Frame, frame: f as Frame };
}

function findPlayer(l: Layers, ref: unknown, what = 'player'): Player {
  const r = ref as any;
  if (!r || typeof r !== 'object') return fail('invalid_value', `${what} must be { team, number } or { playerId }.`);
  if (typeof r.playerId === 'string') {
    const p = l.players.find((q) => q.id === r.playerId);
    return p ?? fail('no_such_player', `No player with id "${r.playerId}".`);
  }
  oneOf(r.team, TEAMS, `${what}.team`);
  shirt(r.number);
  const hits = l.players.filter((q) => q.team === r.team && q.number === r.number);
  if (hits.length === 1) return hits[0];
  const have = l.players.filter((q) => q.team === r.team).map((q) => q.number).filter((n) => n !== undefined).sort((a, b) => (a as number) - (b as number));
  return hits.length
    ? fail('ambiguous_player', `${r.team} ${r.number} matches ${hits.length} players; use { playerId } instead.`)
    : fail('no_such_player', `No ${r.team} ${r.number} on this board. ${r.team} numbers present: ${have.join(', ') || 'none'}.`);
}

function pointRef(l: Layers, ref: unknown, what: string): { playerId?: string; x?: number; y?: number } {
  const r = ref as any;
  if (r && typeof r === 'object' && ('x' in r || 'y' in r)) return { x: coord(r.x, `${what}.x`), y: coord(r.y, `${what}.y`) };
  return { playerId: findPlayer(l, ref, what).id };
}


/**
 * Depth of each line (distance upfield from the team's own goal line, 0-100) for a defensive block. The width of every
 * player is kept; lines keep their internal spread, scaled down so the block reads compact.
 */
export const BLOCK_DEPTH = {
  low: { BACK: 22, MID: 34, FRONT: 46 },
  mid: { BACK: 34, MID: 48, FRONT: 62 },
  high: { BACK: 48, MID: 60, FRONT: 74 },
} as const;
const BLOCK_HEIGHTS = ['high', 'mid', 'low'] as const;
/** How much of a player's spread around his line's mean depth survives set_block (0 = flat line, 1 = unchanged). */
const BLOCK_SPREAD_KEEP = 0.4;
const BLOCK_V_MIN = 2;
const BLOCK_V_MAX = 98;
/** Real-world pitch the 0-100 board stands for: 105 m along y (goal to goal), 68 m along x (width). */
export const PITCH_LENGTH_M = 105;
export const PITCH_WIDTH_M = 68;
const metres = (v: unknown, name: string): number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 120 ? v : fail('invalid_value', `${name} must be a number of metres between -120 and 120 (got ${JSON.stringify(v)}).`);
/** Offset in a team's own terms: forward = towards the opponent's goal, right = the player's own right (NEUTRAL: as ATT). */
/** Metres and the 11-player templates assume a full 11v11 pitch (105 x 68 m); other formats scale differently. */
function requireFullPitch(d: WebDiagramV1, what: string) {
  const f = d.pitch?.format;
  if (f && f !== '11V11') fail('unsupported_pitch', `${what} needs an 11v11 board (this board is ${f}): its metres and formations assume a full 105 x 68 m pitch.`);
}
function shifted(team: string, at: { x: number; y: number }, forward_m: unknown, right_m: unknown, what: string) {
  if (forward_m === undefined && right_m === undefined) fail('invalid_value', `${what} needs forward_m and/or right_m.`);
  const t = team === 'DEF' ? 'DEF' : 'ATT';
  const l = toTeamFrame(t, at);
  const v = l.v + (forward_m === undefined ? 0 : metres(forward_m, 'forward_m')) / (PITCH_LENGTH_M / 100);
  const u = l.u + (right_m === undefined ? 0 : metres(right_m, 'right_m')) / (PITCH_WIDTH_M / 100);
  const p = fromTeamFrame(t, { u, v });
  const x = Math.round(p.x * 10) / 10, y = Math.round(p.y * 10) / 10;
  if (x < 0 || x > 100 || y < 0 || y > 100) {
    const room = (a: number) => Math.max(0, Math.min(a, 100 - a));
    fail('out_of_range', `${what}: that move would take the player off the pitch (resulting x ${x}, y ${y}). From (${Math.round(at.x)}, ${Math.round(at.y)}) there is about ${(room(at.x) * (PITCH_WIDTH_M / 100)).toFixed(1)} m to the nearest touchline and ${(room(at.y) * (PITCH_LENGTH_M / 100)).toFixed(1)} m to the nearest goal line; use a smaller distance.`);
  }
  return { x, y };
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const arrowDefaults = (t: string) => ({ style: (t === 'run' || t === 'cover' ? 'dashed' : t === 'transition' ? 'dotted' : 'solid') as Arrow['style'], weight: 'normal' as Arrow['weight'] });
/** Every layer a frame carries: a frame is a full copy of the picture, so none may be dropped when one is made. */
const REQUIRED_LAYERS = ['players', 'arrows', 'areas', 'labels'] as const;
const OPTIONAL_LAYERS = ['balls', 'goals', 'coach', 'cones', 'elements'] as const;
const layerKeys = [...REQUIRED_LAYERS, ...OPTIONAL_LAYERS] as const;

function apply(d: WebDiagramV1, op: any): string {
  if (!op || typeof op !== 'object' || typeof op.op !== 'string') return fail('invalid_operation', 'Each operation must be an object with an "op" name.');
  const allowed = Object.prototype.hasOwnProperty.call(KEYS, op.op) ? KEYS[op.op] : undefined;
  if (!allowed) return fail('unknown_op', `Unknown op "${op.op}". Valid ops: ${Object.keys(KEYS).join(', ')}.`);
  checkKeys(op, allowed);

  switch (op.op) {
    case 'add_frame': {
      const frames: Frame[] = d.sequence?.frames ? (d.sequence.frames as Frame[]) : [];
      if (!frames.length) {
        const first: Frame = { id: 'f-1', title: 'Frame 1', durationMs: DEFAULT_FRAME_MS, ...clone(Object.fromEntries(layerKeys.filter((k) => (d as any)[k] !== undefined).map((k) => [k, (d as any)[k]]))) } as Frame;
        d.sequence = { frames: [first], activeFrameId: first.id };
        frames.push(first);
      }
      if (frames.length >= MAX_FRAMES) return fail('too_many_frames', `A board holds at most ${MAX_FRAMES} frames.`);
      const src = frames.find((f) => f.id === (op.copyFrom ?? op.after ?? d.sequence!.activeFrameId)) ?? frames[frames.length - 1];
      if (op.copyFrom && src.id !== op.copyFrom) return fail('no_such_frame', `No frame "${op.copyFrom}" to copy. Frames: ${frames.map((f) => f.id).join(', ')}.`);
      let n = frames.length + 1;
      while (frames.some((f) => f.id === `f-${n}`)) n++;
      const mode = op.arrows === undefined ? 'ghost' : oneOf(op.arrows, ['ghost', 'keep', 'clear'] as const, 'arrows');
      const next: Frame = { ...clone(src), id: `f-${n}`, title: String(op.title ?? `Frame ${frames.length + 1}`).slice(0, FRAME_TITLE_MAX), note: undefined };
      // A new step starts clean: the previous step's arrows fade to dotted ghosts (or are kept / cleared on request).
      next.arrows = mode === 'keep' ? next.arrows : mode === 'clear' ? [] : (next.arrows || []).map((a) => ({ ...a, id: a.id ? `${a.id}-prev` : undefined, style: 'dotted' as const, weight: 'normal' as const, order: undefined }));
      const at = op.after ? frames.findIndex((f) => f.id === op.after) : frames.length - 1;
      if (op.after && at < 0) return fail('no_such_frame', `No frame "${op.after}". Frames: ${frames.map((f) => f.id).join(', ')}.`);
      frames.splice(at + 1, 0, next);
      d.sequence!.frames = frames;
      return `Added frame ${next.id} (copy of ${src.id}); ${frames.length} frames.`;
    }
    case 'set_active_frame': {
      const { frame } = layersFor(d, op.frame ?? fail('invalid_value', 'set_active_frame needs a "frame".'));
      d.sequence!.activeFrameId = frame!.id;
      return `Active frame is ${frame!.id}.`;
    }
    case 'update_frame': {
      const { frame } = layersFor(d, op.frame);
      if (!frame) return fail('no_such_frame', 'This board has no frames. Use add_frame first.');
      if (op.title !== undefined) frame.title = String(op.title).slice(0, FRAME_TITLE_MAX);
      if (op.note !== undefined) frame.note = String(op.note).slice(0, 500);
      if (op.durationMs !== undefined) {
        if (typeof op.durationMs !== 'number' || !(op.durationMs >= FRAME_MS_MIN && op.durationMs <= FRAME_MS_MAX)) fail('out_of_range', `durationMs must be ${FRAME_MS_MIN} to ${FRAME_MS_MAX}.`);
        frame.durationMs = op.durationMs;
      }
      return `Updated frame ${frame.id}.`;
    }
    case 'remove_frame': {
      const { frame } = layersFor(d, op.frame);
      if (!frame) return fail('no_such_frame', 'This board has no frames.');
      const frames = d.sequence!.frames as Frame[];
      if (frames.length <= 1) return fail('last_frame', 'The last frame cannot be removed.');
      d.sequence!.frames = frames.filter((f) => f.id !== frame.id);
      if (d.sequence!.activeFrameId === frame.id) d.sequence!.activeFrameId = d.sequence!.frames[0].id;
      return `Removed frame ${frame.id}.`;
    }
  }

  const { layers } = layersFor(d, op.frame);
  switch (op.op) {
    case 'set_formation': {
      const team = oneOf(op.team, ['ATT', 'DEF'] as const, 'team');
      requireFullPitch(d, 'set_formation');
      if (!(SUPPORTED_FORMATIONS as readonly string[]).includes(op.formation)) return fail('unsupported_formation', `Formation "${op.formation}" is not available. Supported: ${SUPPORTED_FORMATIONS.join(', ')}.`);
      const seeded = build11v11FormationPlayers(op.formation, team);
      const had = layers.players.filter((p) => p.team === team).length;
      layers.players = [...layers.players.filter((p) => p.team !== team), ...seeded];
      const ids = new Set(layers.players.map((p) => p.id));
      const keep = layers.arrows.filter((a) => [a.from, a.to].every((r) => !r.playerId || ids.has(r.playerId)));
      const dropped = layers.arrows.length - keep.length;
      layers.arrows = keep;
      return `${team} set to ${op.formation} (${seeded.length} players, was ${had}).${dropped ? ` Removed ${dropped} arrow(s) that pointed at replaced players.` : ''}`;
    }
    case 'set_block': {
      const team = oneOf(op.team, ['ATT', 'DEF'] as const, 'team');
      const height = oneOf(op.height, BLOCK_HEIGHTS, 'height');
      // roleBand is what groups the lines below, so the keeper test must agree with it (it upper-cases the role).
      const outfield = layers.players.filter((p) => p.team === team && roleBand(p) !== 'GK' && p.number !== 1);
      if (outfield.length < 4) return fail('invalid_value', `${team} has only ${outfield.length} outfield players; set_block needs at least 4.`);
      const local = new Map(outfield.map((p) => [p.id, toTeamFrame(team, p)]));
      const band = (p: Player) => roleBand(p) as 'BACK' | 'MID' | 'FRONT';
      const mean = (b: string) => {
        const vs = outfield.filter((p) => band(p) === b).map((p) => local.get(p.id)!.v);
        return vs.length ? vs.reduce((a, c) => a + c, 0) / vs.length : 0;
      };
      const means = { BACK: mean('BACK'), MID: mean('MID'), FRONT: mean('FRONT') };
      for (const p of outfield) {
        const l = local.get(p.id)!;
        const b = band(p);
        const v = Math.max(BLOCK_V_MIN, Math.min(BLOCK_V_MAX, BLOCK_DEPTH[height][b] + (l.v - means[b]) * BLOCK_SPREAD_KEEP));
        const at = fromTeamFrame(team, { u: l.u, v });
        p.x = at.x;
        p.y = at.y;
      }
      return `${team} dropped into a ${height} block: back line ${BLOCK_DEPTH[height].BACK}, midfield ${BLOCK_DEPTH[height].MID}, front ${BLOCK_DEPTH[height].FRONT} upfield from their own goal; widths unchanged.`;
    }
    case 'clear_team': {
      const team = oneOf(op.team, TEAMS, 'team');
      const gone = new Set(layers.players.filter((p) => p.team === team).map((p) => p.id));
      layers.players = layers.players.filter((p) => p.team !== team);
      const before = layers.arrows.length;
      layers.arrows = layers.arrows.filter((a) => !(a.from.playerId && gone.has(a.from.playerId)) && !(a.to.playerId && gone.has(a.to.playerId)));
      return `Removed all ${gone.size} ${team} players${before !== layers.arrows.length ? ` and ${before - layers.arrows.length} arrow(s) attached to them` : ''}.`;
    }
    case 'add_player': {
      const team = oneOf(op.team, TEAMS, 'team');
      const number = shirt(op.number);
      if (layers.players.some((p) => p.team === team && p.number === number)) return fail('duplicate_player', `${team} ${number} is already on the board. Use move_player to move them.`);
      const p: Player = { id: newObjectId('p'), team, number, x: coord(op.x, 'x'), y: coord(op.y, 'y'), ...(op.role ? { role: String(op.role).slice(0, 12) } : {}), ...(op.name ? { name: String(op.name).slice(0, 40) } : {}) };
      layers.players.push(p);
      return `Added ${team} ${number} at (${p.x}, ${p.y}).`;
    }
    case 'move_player': {
      const p = findPlayer(layers, op.player);
      p.x = coord(op.x, 'x');
      p.y = coord(op.y, 'y');
      return `Moved ${p.team} ${p.number} to (${p.x}, ${p.y}).`;
    }
    case 'nudge_player': {
      requireFullPitch(d, 'nudge_player');
      const p = findPlayer(layers, op.player);
      const to = shifted(p.team, p, op.forward_m, op.right_m, 'nudge_player');
      p.x = to.x;
      p.y = to.y;
      return `Moved ${p.team} ${p.number} ${[op.forward_m !== undefined ? `${op.forward_m} m forward` : '', op.right_m !== undefined ? `${op.right_m} m to their right` : ''].filter(Boolean).join(', ')}: now (${p.x}, ${p.y}).`;
    }
    case 'place_relative': {
      requireFullPitch(d, 'place_relative');
      const p = findPlayer(layers, op.player);
      const anchor = findPlayer(layers, op.to, 'to');
      if (anchor === p) return fail('invalid_value', 'place_relative: a player cannot be placed relative to themselves.');
      const at = shifted(p.team, anchor, op.forward_m, op.right_m, 'place_relative');
      p.x = at.x;
      p.y = at.y;
      return `Placed ${p.team} ${p.number} ${[op.forward_m !== undefined ? `${op.forward_m} m forward` : '', op.right_m !== undefined ? `${op.right_m} m to the right` : ''].filter(Boolean).join(', ')} of ${anchor.team} ${anchor.number}: now (${p.x}, ${p.y}).`;
    }
    case 'update_player': {
      const p = findPlayer(layers, op.player);
      const patch = op.patch;
      if (!patch || typeof patch !== 'object' || !Object.keys(patch).length) return fail('invalid_value', 'update_player needs a non-empty "patch".');
      checkKeys({ op: 'patch', ...patch }, ['op', 'role', 'number', 'name', 'group'], 'patch of update_player');
      if (patch.number !== undefined) {
        const n = shirt(patch.number);
        if (layers.players.some((q) => q !== p && q.team === p.team && q.number === n)) return fail('duplicate_player', `${p.team} ${n} is already on the board.`);
        p.number = n;
      }
      if (patch.role !== undefined) p.role = String(patch.role).slice(0, 12);
      if (patch.name !== undefined) p.name = String(patch.name).slice(0, 40);
      if (patch.group !== undefined) p.group = String(patch.group).slice(0, 64);
      return `Updated ${p.team} ${p.number}.`;
    }
    case 'remove_player': {
      const p = findPlayer(layers, op.player);
      layers.players = layers.players.filter((q) => q !== p);
      const before = layers.arrows.length;
      layers.arrows = layers.arrows.filter((a) => a.from.playerId !== p.id && a.to.playerId !== p.id);
      const dropped = before - layers.arrows.length;
      return `Removed ${p.team} ${p.number}.${dropped ? ` Removed ${dropped} arrow(s) attached to them.` : ''}`;
    }
    case 'set_ball': {
      let at: { x: number; y: number };
      if (op.carrier !== undefined) {
        if (op.x !== undefined || op.y !== undefined) return fail('invalid_value', 'set_ball takes either a "carrier" or x and y, not both.');
        const c = findPlayer(layers, op.carrier, 'carrier');
        at = { x: c.x, y: c.y };
      } else at = { x: coord(op.x, 'x'), y: coord(op.y, 'y') };
      layers.balls = [{ ...(layers.balls?.[0] ?? { id: 'b-0' }), ...at }];
      return `Ball at (${at.x}, ${at.y}).`;
    }
    case 'add_arrow': {
      const type = oneOf(op.type, ARROW_TYPES, 'type');
      const def = arrowDefaults(type);
      const a: Arrow = {
        id: newObjectId('a'),
        type,
        from: pointRef(layers, op.from, 'from'),
        to: pointRef(layers, op.to, 'to'),
        style: op.style === undefined ? def.style : oneOf(op.style, ARROW_STYLES, 'style'),
        weight: op.weight === undefined ? def.weight : oneOf(op.weight, ARROW_WEIGHTS, 'weight'),
        ...(op.order !== undefined ? { order: arrowOrder(op.order) } : {}),
      };
      layers.arrows.push(a);
      return `Added ${type} arrow ${a.id}.`;
    }
    case 'update_arrow': {
      const a = layers.arrows.find((x) => x.id === op.arrowId) ?? fail('no_such_arrow', `No arrow "${op.arrowId}". Arrows: ${layers.arrows.map((x) => x.id).join(', ') || 'none'}.`);
      const patch = op.patch;
      if (!patch || typeof patch !== 'object' || !Object.keys(patch).length) return fail('invalid_value', 'update_arrow needs a non-empty "patch".');
      checkKeys({ op: 'patch', ...patch }, ['op', 'type', 'style', 'weight', 'order', 'from', 'to'], 'patch of update_arrow');
      if (patch.type !== undefined) a.type = oneOf(patch.type, ARROW_TYPES, 'type');
      if (patch.style !== undefined) a.style = oneOf(patch.style, ARROW_STYLES, 'style');
      if (patch.weight !== undefined) a.weight = oneOf(patch.weight, ARROW_WEIGHTS, 'weight');
      if (patch.order !== undefined) a.order = arrowOrder(patch.order);
      if (patch.from !== undefined) a.from = pointRef(layers, patch.from, 'from');
      if (patch.to !== undefined) a.to = pointRef(layers, patch.to, 'to');
      return `Updated arrow ${a.id}.`;
    }
    case 'remove_arrow': {
      if (!layers.arrows.some((x) => x.id === op.arrowId)) return fail('no_such_arrow', `No arrow "${op.arrowId}". Arrows: ${layers.arrows.map((x) => x.id).join(', ') || 'none'}.`);
      layers.arrows = layers.arrows.filter((x) => x.id !== op.arrowId);
      return `Removed arrow ${op.arrowId}.`;
    }
  }
  return fail('unknown_op', `Unknown op "${op.op}".`);
}

/**
 * Apply a batch of operations. All-or-nothing: the first failing operation aborts the batch and the board
 * is returned untouched, with the index, a code and a message to correct. When `revision` is given it must
 * match the board's current revision.
 */
export function applyBoardOps(diagram: WebDiagramV1, request: { revision?: string; ops: unknown }): OpsOutcome {
  const current = revisionOf(diagram);
  const ops = request?.ops;
  if (request.revision !== undefined && request.revision !== current) {
    return { ok: false, revision: current, error: { index: -1, code: 'stale_revision', message: `The board changed since revision ${request.revision}; read it again (current revision ${current}).` } };
  }
  if (!Array.isArray(ops) || ops.length < 1 || ops.length > MAX_OPS) {
    return { ok: false, revision: current, error: { index: -1, code: 'invalid_batch', message: `ops must be a list of 1 to ${MAX_OPS} operations.` } };
  }
  const work = clone(diagram);
  const results: OpResult[] = [];
  for (let i = 0; i < ops.length; i++) {
    try {
      const message = apply(work, ops[i]);
      results.push({ index: i, op: String((ops[i] as any).op), ok: true, message });
    } catch (e) {
      if (e instanceof OpError) return { ok: false, revision: current, error: { index: i, code: e.code, message: e.message } };
      // Anything else is a malformed operation that slipped past validation: a controlled error, never an exception.
      return { ok: false, revision: current, error: { index: i, code: 'invalid_operation', message: `Operation ${i} could not be applied (${String((e as Error)?.message ?? e).slice(0, 120)}).` } };
    }
  }
  // The root mirrors the active frame so readers that ignore sequences still see the current picture.
  const seq = work.sequence;
  if (seq?.frames?.length) {
    const active = (seq.frames as Frame[]).find((f) => f.id === seq.activeFrameId) ?? (seq.frames[0] as Frame);
    seq.activeFrameId = active.id;
    for (const k of REQUIRED_LAYERS) (work as any)[k] = clone((active as any)[k] ?? []);
    for (const k of OPTIONAL_LAYERS) {
      if ((active as any)[k] === undefined) delete (work as any)[k];
      else (work as any)[k] = clone((active as any)[k]);
    }
  }
  // Last line of defence: nothing leaves this function with a coordinate that is not a number on the pitch.
  const points = [...(work.players || []), ...(work.balls || []), ...((seq?.frames as Frame[] | undefined) ?? []).flatMap((f) => [...(f.players || []), ...(f.balls || [])])];
  const bad = points.find((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100);
  if (bad) return { ok: false, revision: current, error: { index: -1, code: 'invalid_state', message: 'The result would put a player or the ball at a coordinate that is not on the pitch; nothing was applied.' } };
  const out = ensureDiagramObjectIds(work);
  return { ok: true, diagram: out, revision: revisionOf(out), results };
}
