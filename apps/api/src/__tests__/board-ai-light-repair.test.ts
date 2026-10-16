import { build11v11FormationPlayers } from '../services/web-diagram-v1';
import { placePlayOutFrame, roleBand } from '../services/board-phase-placement';
import { keepGoalkeepersAtHome, separateSharedSpace, lightRepairPlayers } from '../services/board-ai-light-repair';
import { repairBoardDiagramWithSequence } from '../services/board-ai-chat';
import { toTeamFrame } from '@aci/shared';

const full = () => [...build11v11FormationPlayers('4-3-3', 'ATT'), ...build11v11FormationPlayers('4-4-2', 'DEF')];
const gk = (ps: any[], team: string) => ps.find((p) => p.team === team && (p.role === 'GK' || p.number === 1))!;

describe('keepGoalkeepersAtHome', () => {
  test('pulls a keeper that wandered far from its goal back within reach', () => {
    const ps = full().map((p) => (p.team === 'ATT' && p.number === 1 ? { ...p, y: 55 } : p.team === 'DEF' && p.number === 1 ? { ...p, y: 44 } : p));
    const out = keepGoalkeepersAtHome({ players: ps }).players;
    expect(gk(out, 'ATT').y).toBe(80);
    expect(gk(out, 'DEF').y).toBe(20);
  });
  test('leaves a keeper that is already close to goal exactly where it is', () => {
    const ps = full().map((p) => (p.team === 'ATT' && p.number === 1 ? { ...p, y: 83 } : p));
    expect(gk(keepGoalkeepersAtHome({ players: ps }).players, 'ATT').y).toBe(83);
  });
  test('does nothing on small-sided boards (goals are not at the ends)', () => {
    const small = full().filter((p) => (p.number ?? 0) <= 5).map((p) => (p.number === 1 ? { ...p, y: 50 } : p));
    expect(keepGoalkeepersAtHome({ players: small }).players).toEqual(small);
  });
});

describe('separateSharedSpace', () => {
  test('pushes shirts that share space apart and moves nobody else', () => {
    const ps = full();
    const a = ps[5], b = ps[15];
    const stacked = ps.map((p) => (p === b ? { ...p, x: a.x + 0.5, y: a.y + 0.5 } : p));
    const out = separateSharedSpace({ players: stacked }).players;
    const dist = (p: any, q: any) => Math.hypot(p.x - q.x, p.y - q.y);
    expect(dist(out[5], out[15])).toBeGreaterThanOrEqual(4.4);
    // a far-away player is untouched
    expect(out[0]).toEqual(stacked[0]);
  });
  test('a layout with no shared space is returned unchanged', () => {
    // 22 players on a grid 9 apart: nobody is anywhere near anybody
    const ps = full().map((p, i) => ({ ...p, x: 10 + (i % 6) * 15, y: 10 + Math.floor(i / 6) * 20 }));
    expect(separateSharedSpace({ players: ps }).players).toEqual(ps);
  });
});

describe('BOARD_AI_LIGHT_REPAIR through the free-form pipeline', () => {
  afterEach(() => { delete process.env.BOARD_AI_LIGHT_REPAIR; });
  const msg = 'show the high press in their final third';
  const good = () => {
    const placed = placePlayOutFrame(full(), 'pocket', 'Goal kick build-out, 4-3-3 vs 4-4-2 high press');
    return { pitch: { orientation: 'HORIZONTAL' }, players: placed.players, arrows: [], areas: [], labels: [], balls: placed.balls } as any;
  };

  test('a layout that is already correct is not rebuilt (the old pipeline moved ~9 units on average)', () => {
    process.env.BOARD_AI_LIGHT_REPAIR = '1';
    const before = good();
    const out: any = repairBoardDiagramWithSequence(before, msg);
    const byId = new Map(before.players.map((p: any) => [p.id, p]));
    const moved = out.players.map((p: any) => Math.hypot(p.x - (byId.get(p.id) as any).x, p.y - (byId.get(p.id) as any).y));
    expect(moved.reduce((s: number, n: number) => s + n, 0) / moved.length).toBeLessThan(1);
    // block shape intact: every defender's flank and the line order survive
    const def = out.players.filter((p: any) => p.team === 'DEF' && roleBand(p) !== 'GK');
    const u = (p: any) => toTeamFrame('DEF', p).u;
    for (const p of def) {
      const b: any = byId.get(p.id);
      if (Math.abs(u(b) - 50) > 6 && Math.abs(u(p) - 50) > 6) expect(Math.sign(u(p) - 50)).toBe(Math.sign(u(b) - 50));
    }
    expect(out.balls[0]).toEqual(before.balls[0]);
  });

  test('frozen players stay exactly where they are', () => {
    process.env.BOARD_AI_LIGHT_REPAIR = '1';
    const before = good();
    const out: any = repairBoardDiagramWithSequence(before, 'show the press without moving anyone');
    expect(out.players.map((p: any) => [p.x, p.y])).toEqual(before.players.map((p: any) => [p.x, p.y]));
  });

  test('is off by default: the old pipeline still runs', () => {
    const before = good();
    const out: any = repairBoardDiagramWithSequence(before, msg);
    const byId = new Map(before.players.map((p: any) => [p.id, p]));
    const moved = out.players.map((p: any) => Math.hypot(p.x - (byId.get(p.id) as any).x, p.y - (byId.get(p.id) as any).y));
    expect(moved.reduce((s: number, n: number) => s + n, 0) / moved.length).toBeGreaterThan(2);
  });

  test('lightRepairPlayers composes both steps', () => {
    const ps = full().map((p) => (p.team === 'DEF' && p.number === 1 ? { ...p, y: 40 } : p));
    expect(gk(lightRepairPlayers({ players: ps }).players, 'DEF').y).toBeLessThanOrEqual(20);
  });
});

describe('anchorBallToFirstPass', () => {
  const { anchorBallToFirstPass } = require('../services/board-ai-light-repair');
  const players = [
    { id: 'a3', team: 'ATT', number: 3, x: 10, y: 70 },
    { id: 'a7', team: 'ATT', number: 7, x: 80, y: 44 },
    { id: 'a9', team: 'ATT', number: 9, x: 50, y: 39 },
  ];
  const pass = (from: string, to: string, extra: any = {}) => ({ id: `${from}-${to}`, type: 'pass', from: { playerId: from }, to: { playerId: to }, ...extra });

  test('a ball left on the centre spot moves to the passer when the arrow starts elsewhere', () => {
    const d = { players, arrows: [pass('a3', 'a7')], balls: [{ id: 'b', x: 50, y: 50 }] };
    expect(anchorBallToFirstPass(d).balls[0]).toMatchObject({ x: 10, y: 70 });
  });
  test('uses the first pass by order, not by array position', () => {
    const d = { players, arrows: [pass('a7', 'a9', { order: 2 }), pass('a3', 'a7', { order: 1 })], balls: [{ id: 'b', x: 50, y: 50 }] };
    expect(anchorBallToFirstPass(d).balls[0]).toMatchObject({ x: 10, y: 70 });
  });
  test('leaves a ball that is already at the start or the end of the passing chain', () => {
    const atStart = { players, arrows: [pass('a3', 'a7')], balls: [{ id: 'b', x: 10, y: 70 }] };
    const atEnd = { players, arrows: [pass('a3', 'a7'), pass('a7', 'a9')], balls: [{ id: 'b', x: 50, y: 39 }] };
    expect(anchorBallToFirstPass(atStart)).toBe(atStart);
    expect(anchorBallToFirstPass(atEnd)).toBe(atEnd);
  });
  test('a ball at the middle of a chain stays there (a frame showing the previous pass as a ghost)', () => {
    const d = { players, arrows: [pass('a3', 'a7', { style: 'dotted' }), pass('a7', 'a9')], balls: [{ id: 'b', x: 80, y: 44 }] };
    expect(anchorBallToFirstPass(d)).toBe(d);
  });
  test('does nothing without a ball or without passes', () => {
    const noBall = { players, arrows: [pass('a3', 'a7')], balls: [] };
    const noPass = { players, arrows: [{ id: 'r', type: 'run', from: { playerId: 'a3' }, to: { x: 5, y: 5 } }], balls: [{ id: 'b', x: 50, y: 50 }] };
    expect(anchorBallToFirstPass(noBall)).toBe(noBall);
    expect(anchorBallToFirstPass(noPass)).toBe(noPass);
  });
});

/*
 * Value: protects=light repair runs on EVERY frame of a model sequence (keeper home, shirts apart, active frame mirrored to the root) and spreadApart separates shirts pinned on a touchline or stacked exactly; fails_when=only the root is repaired, activeFrameId is lost, or stacked/pinned shirts stay on top of each other; why_new=existing light-repair tests use one-layer boards and spacing with free room; seam=none; no_claim=model output quality
 */
describe('light repair on a model sequence and degenerate spacing', () => {
  const { spreadApart } = require('../services/board-phase-placement');
  const layer = (gkY: number, extra: any = {}) => ({
    players: full().map((p) => (p.team === 'ATT' && p.number === 1 ? { ...p, y: gkY } : p)),
    arrows: [], areas: [], labels: [], balls: [{ id: 'b', x: 50, y: 50 }], ...extra,
  });
  afterEach(() => { delete process.env.BOARD_AI_LIGHT_REPAIR; });

  test('every frame is repaired, the active frame is kept and the root mirrors it', () => {
    process.env.BOARD_AI_LIGHT_REPAIR = '1';
    const f1 = { id: 'f-1', title: 'A', ...layer(55) };
    const f2 = { id: 'f-2', title: 'B', ...layer(60) };
    const input: any = { pitch: { orientation: 'HORIZONTAL' }, ...layer(55), sequence: { frames: [f1, f2], activeFrameId: 'f-2' } };
    const out: any = repairBoardDiagramWithSequence(input, 'reshape the team');
    expect(out.sequence.frames.map((f: any) => f.id)).toEqual(['f-1', 'f-2']);
    expect(out.sequence.activeFrameId).toBe('f-2');
    for (const f of out.sequence.frames) expect(gk(f.players, 'ATT').y).toBe(80);
    expect(gk(out.players, 'ATT').y).toBe(80);
    expect(out.sequence.frames.map((f: any) => f.title)).toEqual(['A', 'B']);
  });
  test('exactly stacked shirts are separated, including against a touchline', () => {
    const mk = (x: number, y: number, id: string, team = 'ATT') => ({ id, team, x, y });
    const stacked = spreadApart([mk(50, 50, 'a'), mk(50, 50, 'b')]);
    expect(Math.hypot(stacked[0].x - stacked[1].x, stacked[0].y - stacked[1].y)).toBeGreaterThanOrEqual(6.9);
    const edge = spreadApart([mk(1, 50, 'a'), mk(1, 50.5, 'b', 'DEF')]);
    expect(Math.hypot(edge[0].x - edge[1].x, edge[0].y - edge[1].y)).toBeGreaterThanOrEqual(6.4);
    for (const p of edge) { expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(100); }
  });
});
