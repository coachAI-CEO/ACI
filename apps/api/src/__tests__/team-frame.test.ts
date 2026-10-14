import { toTeamFrame, fromTeamFrame, convertFrame } from '@aci/shared';
import { build11v11FormationPlayers } from '../services/web-diagram-v1';

const FORMATIONS = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'] as const;

describe('team-local frame', () => {
  test('round trips and is an involution for both teams', () => {
    for (const team of ['ATT', 'DEF'] as const) {
      for (const p of [{ x: 0, y: 0 }, { x: 13.5, y: 77 }, { x: 100, y: 100 }, { x: 50, y: 50 }]) {
        const l = toTeamFrame(team, p);
        expect(fromTeamFrame(team, l)).toEqual(p);
        expect(toTeamFrame(team, { x: l.u, y: l.v })).toEqual({ u: p.x, v: p.y }); // same arithmetic both ways
      }
    }
  });

  test('forward is +v for both teams (ATT attacks low y, DEF high y)', () => {
    expect(toTeamFrame('ATT', { x: 50, y: 20 }).v).toBeGreaterThan(toTeamFrame('ATT', { x: 50, y: 80 }).v);
    expect(toTeamFrame('DEF', { x: 50, y: 80 }).v).toBeGreaterThan(toTeamFrame('DEF', { x: 50, y: 20 }).v);
  });

  test('own right flank is high u for both teams (ATT right = high x, DEF right = low x)', () => {
    expect(toTeamFrame('ATT', { x: 80, y: 50 }).u).toBe(80);
    expect(toTeamFrame('DEF', { x: 20, y: 50 }).u).toBe(80);
  });

  test('convertFrame re-expresses a point between teams without moving it', () => {
    const ball = { x: 30, y: 40 };
    const asAtt = toTeamFrame('ATT', ball);
    const asDef = convertFrame('ATT', 'DEF', asAtt);
    expect(fromTeamFrame('DEF', asDef)).toEqual(ball);
  });

  test.each(FORMATIONS)('%s: ATT and DEF base formations are the same shape in their own frames', (f) => {
    // The shared frame mirrors the two teams; the local frame must make them identical.
    const local = (team: 'ATT' | 'DEF') =>
      build11v11FormationPlayers(f, team)
        .map((p) => ({ n: p.number ?? 0, ...toTeamFrame(team, p) }))
        .sort((a, b) => a.n - b.n);
    const a = local('ATT');
    const d = local('DEF');
    a.forEach((p, i) => {
      expect(d[i].n).toBe(p.n);
      expect(Math.abs(d[i].u - p.u)).toBeLessThan(1.5);
      expect(Math.abs(d[i].v - p.v)).toBeLessThan(1.5);
    });
  });
});
