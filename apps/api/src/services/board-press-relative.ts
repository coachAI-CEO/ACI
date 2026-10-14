/**
 * Relative press placement (opt-in via BOARD_PRESS_RELATIVE=1; see board-phase-placement).
 *
 * Instead of computing absolute target positions per formation, a press is a
 * set of moves applied to wherever each player already stands:
 *   - "forward" toward the opponent's goal, by role band, scaled by block height
 *   - a small lateral squeeze toward the ball's channel
 *
 * Runs in the team-local frame (packages/shared board/team-frame): v = upfield, u = the
 * team's own right is high. In that frame ATT and DEF are the same code path, so there is no
 * per-team direction or flank logic here; the shared-frame flip happens only at the edges.
 *
 * Because it only offsets existing positions, it works for any formation and
 * keeps each player on their own side of the pitch.
 */
// Type-only imports so this module never creates a runtime cycle with
// board-phase-placement (which calls it); the role-band classifier is passed in.
import { fromTeamFrame, toTeamFrame } from '@aci/shared';
import type { DefBlockHeight, PlayOutSubPhase, RoleBand } from './board-phase-placement';
import type { WebDiagramV1 } from './web-diagram-v1';

type Player = WebDiagramV1['players'][number];

const clamp = (n: number) => Math.max(2, Math.min(98, n));

/** Forward distance (y units, full block) and squeeze fraction toward the ball x. */
export const PRESS_PROFILE: Record<RoleBand, { forward: number; squeeze: number }> = {
  GK: { forward: 0, squeeze: 0 },
  BACK: { forward: 28, squeeze: 0.2 },
  MID: { forward: 28, squeeze: 0.2 },
  FRONT: { forward: 22, squeeze: 0.25 },
};

export const PRESS_BLOCK_SCALE: Record<DefBlockHeight, number> = {
  high: 1,
  mid: 0.7,
  low: 0.4,
};

/** Never let a presser end up further forward than this many units short of the ball. */
const OVERRUN_MARGIN = 4;

export type PresetRole = 'defending' | 'inPossession';
type BandProfile = Record<RoleBand, { forward: number; squeeze: number }>;

/**
 * Relative presets: per phase and per role (defending / in possession), how far each line moves
 * upfield (v, negative = drops) from its formation base slot, and how much it leans toward the
 * ball's channel. Fitted to the depth change the authored per-formation shapes make
 * (golden baseline), so the result is the same family of shape for ANY formation, not only the
 * four that are hand-authored. Team-agnostic: only the frame conversion knows which team is which.
 */
export const PHASE_PROFILES: Record<PlayOutSubPhase, Record<PresetRole, BandProfile>> = {
  goal_kick: {
    defending: PRESS_PROFILE,
    inPossession: {
      GK: { forward: -4, squeeze: 0 },
      BACK: { forward: -7, squeeze: 0.15 },
      MID: { forward: -9, squeeze: 0.2 },
      FRONT: { forward: -9, squeeze: 0.25 },
    },
  },
  pocket: {
    defending: {
      GK: { forward: 0, squeeze: 0 },
      BACK: { forward: 6, squeeze: 0.3 },
      MID: { forward: 8, squeeze: 0.3 },
      FRONT: { forward: 3, squeeze: 0.3 },
    },
    inPossession: {
      GK: { forward: -4, squeeze: 0 },
      BACK: { forward: 11, squeeze: 0.2 },
      MID: { forward: 11, squeeze: 0.25 },
      FRONT: { forward: 8, squeeze: 0.25 },
    },
  },
  final_third: {
    defending: {
      GK: { forward: 0, squeeze: 0 },
      BACK: { forward: -11, squeeze: 0.25 },
      MID: { forward: -10, squeeze: 0.25 },
      FRONT: { forward: -17, squeeze: 0.2 },
    },
    inPossession: {
      GK: { forward: -4, squeeze: 0 },
      BACK: { forward: 39, squeeze: 0.15 },
      MID: { forward: 35, squeeze: 0.2 },
      FRONT: { forward: 30, squeeze: 0.25 },
    },
  },
};

/**
 * Place one team relative to its formation's BASE slots (not positions from a previous run;
 * applying offsets to already-moved positions would compound on every re-run).
 */
export function relativePreset(input: {
  players: Player[];
  team: 'ATT' | 'DEF';
  role: PresetRole;
  phase: PlayOutSubPhase;
  ball: { x: number; y: number };
  block: DefBlockHeight;
  /** Role-band classifier (roleBand from board-phase-placement). */
  bandOf: (p: { number?: number; role?: string }) => RoleBand;
}): Player[] {
  const { players, team, role, phase, ball, block, bandOf } = input;
  const profiles = PHASE_PROFILES[phase][role];
  // Block height is the pressing team's choice: it only scales the goal-kick press.
  const scale = role === 'defending' && phase === 'goal_kick' ? PRESS_BLOCK_SCALE[block] : 1;
  const ballLocal = toTeamFrame(team, ball);

  return players.map((p) => {
    if (p.team !== team) return p;
    const band = bandOf(p);
    const profile = profiles[band];
    const at = toTeamFrame(team, p);
    let v = at.v + profile.forward * (profile.forward > 0 ? scale : 1);
    // A presser stops short of the ball instead of running past it. Goal-kick press only: in the
    // later phases the front line legitimately sits ahead of a ball that is deep in the block.
    if (role === 'defending' && phase === 'goal_kick' && band !== 'GK') v = Math.min(v, ballLocal.v - OVERRUN_MARGIN);
    const u = at.u + (ballLocal.u - at.u) * profile.squeeze;
    const out = fromTeamFrame(team, { u: clamp(u), v: clamp(v) });
    return { ...p, x: out.x, y: out.y };
  });
}

/** The goal-kick press (BOARD_PRESS_RELATIVE): defending profile for the goal-kick phase. */
export function pressRelative(input: {
  players: Player[];
  /** The team that is pressing. */
  team: 'ATT' | 'DEF';
  ball: { x: number; y: number };
  block: DefBlockHeight;
  bandOf: (p: { number?: number; role?: string }) => RoleBand;
}): Player[] {
  return relativePreset({ ...input, role: 'defending', phase: 'goal_kick' });
}
