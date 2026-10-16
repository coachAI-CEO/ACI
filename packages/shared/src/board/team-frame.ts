/**
 * Team-local frame for tactical-board placement.
 *
 * Stored diagrams use one shared frame in which the meaning of `y` flips by team: ATT attacks
 * toward LOW y (own goal at high y), DEF toward HIGH y (own goal at low y), and each team's
 * right flank sits on the opposite side of `x`. Placement code that has to reason about
 * "forward" and "our right" in that frame needs per-team special cases, which is where the DEF
 * goal-kick flank bug came from.
 *
 * In a team's LOCAL frame every team looks the same:
 *   v = distance upfield (0 = own goal line, 100 = opponent goal line)
 *   u = across the pitch, HIGH u = the team's own right flank
 *
 *   ATT: u = x,        v = 100 - y
 *   DEF: u = 100 - x,  v = y
 *
 * Both maps are involutions (applying one twice is identity), so `fromTeamFrame` is the same
 * arithmetic as `toTeamFrame`. Stored data and renderers keep the shared frame; only placement
 * converts at its boundary.
 */

export type FrameTeam = 'ATT' | 'DEF';
export type LocalPoint = { u: number; v: number };
export type SharedPoint = { x: number; y: number };

export const PITCH_SPAN = 100;

export function toTeamFrame(team: FrameTeam, p: SharedPoint): LocalPoint {
  return team === 'ATT' ? { u: p.x, v: PITCH_SPAN - p.y } : { u: PITCH_SPAN - p.x, v: p.y };
}

export function fromTeamFrame(team: FrameTeam, p: LocalPoint): SharedPoint {
  return team === 'ATT' ? { x: p.u, y: PITCH_SPAN - p.v } : { x: PITCH_SPAN - p.u, y: p.v };
}

/** Re-express a point from one team's frame in the other's (e.g. an ATT ball as seen by DEF). */
export function convertFrame(from: FrameTeam, to: FrameTeam, p: LocalPoint): LocalPoint {
  return from === to ? p : toTeamFrame(to, fromTeamFrame(from, p));
}
