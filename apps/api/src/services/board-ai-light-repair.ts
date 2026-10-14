/**
 * Light repair for the model's own coordinates (BOARD_AI_LIGHT_REPAIR=1).
 *
 * The older free-form pipeline rebuilt the defending block around the ball, relocated the focus and
 * re-shaped sequences, which scrambled flanks, inverted line order and moved the ball away from
 * what the coach asked (measured against live Gemini output). The model is reliable on structure
 * (flanks, goalkeepers, line order) and weak on spacing, so this only does what is clearly wrong:
 *
 *   - goalkeepers stay within reach of their own goal line (11v11-style boards only)
 *   - shirts that share space are pushed apart
 *
 * It never relocates a block, the ball, or the play. Pure functions, no I/O.
 */
import type { WebDiagramV1 } from './web-diagram-v1';
import { spreadApart } from './board-phase-placement';

type Player = WebDiagramV1['players'][number];

const isGk = (p: Player) => /^GK$/i.test(String(p.role || '')) || p.number === 1;

/** ATT's own goal is at high y (right), DEF's at low y (left). Keepers may step out ~20 units. */
const GK_MAX_STEP_OUT = 20;
const GK_X_MIN = 30;
const GK_X_MAX = 70;

/** Only a full-size scene has goals at the ends and one keeper per side; small-sided boards vary. */
function isFullSizeScene(players: Player[]) {
  const att = players.filter((p) => p.team === 'ATT');
  const def = players.filter((p) => p.team === 'DEF');
  return att.length >= 9 && def.length >= 9 && att.some(isGk) && def.some(isGk);
}

export function keepGoalkeepersAtHome<D extends Pick<WebDiagramV1, 'players'>>(diagram: D): D {
  const players = diagram.players || [];
  if (!isFullSizeScene(players)) return diagram;
  const next = players.map((p) => {
    if (!isGk(p)) return p;
    const x = Math.min(GK_X_MAX, Math.max(GK_X_MIN, p.x));
    if (p.team === 'ATT') return { ...p, x, y: Math.max(100 - GK_MAX_STEP_OUT, p.y) };
    if (p.team === 'DEF') return { ...p, x, y: Math.min(GK_MAX_STEP_OUT, p.y) };
    return p;
  });
  return { ...diagram, players: next };
}

/** Teammates 5 apart, opponents 4.5 apart: enough that shirts never overlap, far below placement's spacing. */
export function separateSharedSpace<D extends Pick<WebDiagramV1, 'players'>>(diagram: D): D {
  const players = diagram.players || [];
  if (players.length < 2) return diagram;
  return { ...diagram, players: spreadApart(players, 5, 4.5) };
}

/** The whole light pass for one layer (root or sequence frame), after the standard cleanup. */
export function lightRepairPlayers<D extends Pick<WebDiagramV1, 'players'>>(diagram: D): D {
  return separateSharedSpace(keepGoalkeepersAtHome(diagram));
}
