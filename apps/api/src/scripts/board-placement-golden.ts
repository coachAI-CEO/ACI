/**
 * Golden baseline for board placement. Run `npx ts-node --transpile-only src/scripts/board-placement-golden.ts`
 * to (re)write src/__tests__/golden/board-placement.golden.json. The jest test compares against it, so any
 * refactor of the placement code (frames, team-agnostic rewrite) must either match or update it on purpose.
 */
import fs from 'fs';
import path from 'path';
import { build11v11FormationPlayers } from '../services/web-diagram-v1';
import { placePhaseSnapshot } from '../services/board-phase-placement';

export const GOLDEN_PATH = path.resolve(__dirname, '../__tests__/golden/board-placement.golden.json');
const ATT_FORMATIONS = ['4-3-3', '4-4-2'] as const;
const DEF_FORMATIONS = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'] as const;
const PHASES = ['goal_kick', 'pocket', 'final_third'] as const;
const BLOCKS = ['high', 'mid', 'low'] as const;
const CHANNELS = [30, 50, 70];

export function buildGolden(): Record<string, [string, number, number][]> {
  const out: Record<string, [string, number, number][]> = {};
  for (const a of ATT_FORMATIONS)
    for (const d of DEF_FORMATIONS)
      for (const ph of PHASES)
        for (const b of BLOCKS)
          for (const ch of CHANNELS) {
            const roster = [...build11v11FormationPlayers(a, 'ATT'), ...build11v11FormationPlayers(d, 'DEF')];
            const res = placePhaseSnapshot({
              roster, subPhase: ph, attFormation: a, defFormation: d, channelX: ch, defBlock: b, includeMotifArrows: false,
            });
            out[`${a}|${d}|${ph}|${b}|${ch}`] = res.players
              .map((p) => [p.id, +p.x.toFixed(2), +p.y.toFixed(2)] as [string, number, number])
              .sort((x, y) => x[0].localeCompare(y[0]));
          }
  return out;
}

if (require.main === module) {
  delete process.env.BOARD_PRESS_RELATIVE;
  const g = buildGolden();
  fs.mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
  fs.writeFileSync(GOLDEN_PATH, JSON.stringify(g));
  console.log(`wrote ${Object.keys(g).length} scenarios -> ${GOLDEN_PATH}`);
}
