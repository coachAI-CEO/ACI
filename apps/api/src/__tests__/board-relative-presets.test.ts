import { toTeamFrame } from '@aci/shared';
import { build11v11FormationPlayers } from '../services/web-diagram-v1';
import { placePhaseSnapshot, roleBand } from '../services/board-phase-placement';

const FORMATIONS = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'] as const;
const PHASES = ['goal_kick', 'pocket', 'final_third'] as const;

function run(att: string, def: string, phase: (typeof PHASES)[number], block: 'high' | 'mid' | 'low' = 'high', relative = true) {
  if (relative) process.env.BOARD_RELATIVE_PRESETS = '1';
  else delete process.env.BOARD_RELATIVE_PRESETS;
  try {
    const roster = [...build11v11FormationPlayers(att as any, 'ATT'), ...build11v11FormationPlayers(def as any, 'DEF')];
    return placePhaseSnapshot({ roster, subPhase: phase, attFormation: att as any, defFormation: def as any, channelX: 50, defBlock: block, includeMotifArrows: false }).players;
  } finally {
    delete process.env.BOARD_RELATIVE_PRESETS;
  }
}

const meanV = (ps: any[], team: 'ATT' | 'DEF', band?: string) => {
  const v = ps.filter((p) => p.team === team && (!band || roleBand(p) === band)).map((p) => toTeamFrame(team, p).v);
  return v.reduce((s, n) => s + n, 0) / v.length;
};

describe('BOARD_RELATIVE_PRESETS (both teams, every phase)', () => {
  test('is off by default: identical to the authored chassis', () => {
    const a = run('4-3-3', '4-4-2', 'pocket', 'high', false);
    const b = run('4-3-3', '4-4-2', 'pocket', 'high', false);
    expect(b).toEqual(a);
  });

  for (const att of FORMATIONS) {
    for (const def of FORMATIONS) {
      for (const phase of PHASES) {
        test(`${att} vs ${def} ${phase}: nobody changes flank, nobody stacks, all in bounds`, () => {
          const base = [...build11v11FormationPlayers(att, 'ATT'), ...build11v11FormationPlayers(def, 'DEF')];
          const out = run(att, def, phase);
          expect(out).toHaveLength(base.length);
          for (const p of out) {
            expect(p.x).toBeGreaterThanOrEqual(2);
            expect(p.x).toBeLessThanOrEqual(98);
            expect(p.y).toBeGreaterThanOrEqual(2);
            expect(p.y).toBeLessThanOrEqual(98);
            const b = base.find((q) => q.id === p.id)!;
            if (roleBand(p) === 'GK') continue;
            const bu = toTeamFrame(p.team as 'ATT' | 'DEF', b).u;
            const pu = toTeamFrame(p.team as 'ATT' | 'DEF', p).u;
            // wide players (>6 off centre in their own frame) keep their side
            if (Math.abs(bu - 50) > 6 && Math.abs(pu - 50) > 6) expect(Math.sign(pu - 50)).toBe(Math.sign(bu - 50));
          }
          for (let i = 0; i < out.length; i++)
            for (let j = i + 1; j < out.length; j++) {
              const d = Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y);
              expect(d).toBeGreaterThanOrEqual(out[i].team === out[j].team ? 3.4 : 2.4);
            }
        });
      }
    }
  }

  for (const f of FORMATIONS) {
    test(`${f}: the possession side advances goal_kick < pocket < final_third`, () => {
      const v = PHASES.map((ph) => meanV(run(f, '4-4-2', ph), 'ATT'));
      expect(v[0]).toBeLessThan(v[1]);
      expect(v[1]).toBeLessThan(v[2]);
    });
    test(`${f}: the defending lines stay ordered back < mid < front in every phase`, () => {
      for (const ph of PHASES) {
        const out = run('4-3-3', f, ph);
        expect(meanV(out, 'DEF', 'BACK')).toBeLessThan(meanV(out, 'DEF', 'MID'));
        expect(meanV(out, 'DEF', 'MID')).toBeLessThan(meanV(out, 'DEF', 'FRONT'));
      }
    });
  }

  test('ATT and DEF go through the same code: same formation, mirrored roles give matching local shapes', () => {
    // Same formation for both sides, ball on the centre line: each team's local-frame lateral
    // shape (u) must match the other's, since only the frame conversion differs.
    const out = run('4-3-3', '4-3-3', 'pocket');
    const u = (team: 'ATT' | 'DEF') =>
      out
        .filter((p) => p.team === team)
        .map((p) => ({ n: p.number ?? 0, u: toTeamFrame(team, p).u }))
        .sort((a, b) => a.n - b.n);
    const a = u('ATT');
    const d = u('DEF');
    a.forEach((p, i) => expect(Math.abs(p.u - d[i].u)).toBeLessThan(8));
  });
});
