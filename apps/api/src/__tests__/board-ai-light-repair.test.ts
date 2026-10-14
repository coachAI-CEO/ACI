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
