import { toTeamFrame } from '@aci/shared';
import { build11v11FormationPlayers } from '../services/web-diagram-v1';
import { placePhaseSnapshot } from '../services/board-phase-placement';

const FORMATIONS = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'] as const;
const PHASES = ['goal_kick', 'pocket', 'final_third'] as const;

/** Where each shirt number stands in its own team's local frame (so ATT and DEF are comparable). */
function localShape(players: any[], team: 'ATT' | 'DEF') {
  return players
    .filter((p) => p.team === team)
    .map((p) => ({ n: p.number as number, ...toTeamFrame(team, p) }))
    .sort((a, b) => a.n - b.n);
}

describe('placement does not depend on which team has the ball', () => {
  for (const poss of FORMATIONS) {
    for (const defd of FORMATIONS) {
      for (const phase of PHASES) {
        test(`${poss} (ball) vs ${defd} ${phase}: DEF in possession is the mirror of ATT in possession`, () => {
          const args = { subPhase: phase, channelX: 50, defBlock: 'high' as const, includeMotifArrows: false };
          const attHasBall = placePhaseSnapshot({
            ...args,
            roster: [...build11v11FormationPlayers(poss, 'ATT'), ...build11v11FormationPlayers(defd, 'DEF')],
            attFormation: poss,
            defFormation: defd,
          });
          const defHasBall = placePhaseSnapshot({
            ...args,
            possession: 'DEF',
            roster: [...build11v11FormationPlayers(defd, 'ATT'), ...build11v11FormationPlayers(poss, 'DEF')],
            attFormation: poss, // formation of the team in possession (here DEF)
            defFormation: defd,
          });
          // The team with the ball has the same shape in its own frame, whichever side it is.
          const a = localShape(attHasBall.players, 'ATT');
          const d = localShape(defHasBall.players, 'DEF');
          a.forEach((p, i) => {
            expect(d[i].n).toBe(p.n);
            expect(Math.hypot(d[i].u - p.u, d[i].v - p.v)).toBeLessThan(3);
          });
          // Likewise the defending team.
          const a2 = localShape(attHasBall.players, 'DEF');
          const d2 = localShape(defHasBall.players, 'ATT');
          a2.forEach((p, i) => {
            expect(d2[i].n).toBe(p.n);
            expect(Math.hypot(d2[i].u - p.u, d2[i].v - p.v)).toBeLessThan(3);
          });
        });
      }
    }
  }

  test('the ball and the build-out area are mirrored with the teams', () => {
    const args = { subPhase: 'goal_kick' as const, channelX: 50, defBlock: 'high' as const, includeMotifArrows: false };
    const att = placePhaseSnapshot({
      ...args,
      roster: [...build11v11FormationPlayers('4-3-3', 'ATT'), ...build11v11FormationPlayers('4-4-2', 'DEF')],
      attFormation: '4-3-3',
      defFormation: '4-4-2',
    });
    const def = placePhaseSnapshot({
      ...args,
      possession: 'DEF',
      roster: [...build11v11FormationPlayers('4-4-2', 'ATT'), ...build11v11FormationPlayers('4-3-3', 'DEF')],
      attFormation: '4-3-3',
      defFormation: '4-4-2',
    });
    expect(def.balls![0].x).toBeCloseTo(100 - att.balls![0].x, 1);
    expect(def.balls![0].y).toBeCloseTo(100 - att.balls![0].y, 1);
    // ATT's build-out box sits at its own goal (high y); DEF's mirrors to low y.
    expect(att.areas![0].y ?? 0).toBeGreaterThan(50);
    expect((def.areas![0].y ?? 100) + (def.areas![0].height ?? 0)).toBeLessThan(50);
  });
});
