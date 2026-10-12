/**
 * GENERATED FILE -- do not edit by hand.
 * Source: apps/api/src/services/board-press-relative.ts
 * Regenerate with: pnpm sync:board-chassis
 */

/**
 * PROTOTYPE -- relative press placement (not wired into the board yet).
 *
 * Instead of computing absolute target positions per formation, a press is a
 * set of moves applied to wherever each player already stands:
 *   - "forward" toward the opponent's goal, by role band, scaled by block height
 *   - a small lateral squeeze toward the ball's channel
 *
 * Board axes (see docs/tactical-board-phase-positioning.md):
 *   y = goal-to-goal. ATT attacks toward LOW y, DEF attacks toward HIGH y.
 *   x = width. Direction is handled in exactly one place (`dir` below).
 *
 * Because it only offsets existing positions, it works for any formation and
 * keeps each player on their own side of the pitch.
 */
// Type-only imports so this module never creates a runtime cycle with
// board-phase-placement (which calls it); the role-band classifier is passed in.
import type { DefBlockHeight, RoleBand } from './board-phase-placement';
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

/**
 * Pressing is described relative to a team's formation shape, so callers pass
 * the formation's BASE slots (not positions from a previous press) -- applying
 * the offsets to already-pressed positions would compound on every re-run.
 */
export function pressRelative(input: {
  players: Player[];
  /** The team that is pressing. */
  team: 'ATT' | 'DEF';
  ball: { x: number; y: number };
  block: DefBlockHeight;
  /** Role-band classifier (roleBand from board-phase-placement). */
  bandOf: (p: { number?: number; role?: string }) => RoleBand;
}): Player[] {
  const { players, team, ball, block, bandOf } = input;
  const dir = team === 'DEF' ? 1 : -1; // DEF attacks toward +y, ATT toward -y
  const scale = PRESS_BLOCK_SCALE[block];

  return players.map((p) => {
    if (p.team !== team) return p;
    const profile = PRESS_PROFILE[bandOf(p)];
    let y = p.y + dir * profile.forward * scale;
    // Outfield pressers stop short of the ball instead of running past it.
    if (bandOf(p) !== 'GK') {
      y = dir === 1 ? Math.min(y, ball.y - OVERRUN_MARGIN) : Math.max(y, ball.y + OVERRUN_MARGIN);
    }
    const x = p.x + (ball.x - p.x) * profile.squeeze;
    return { ...p, x: clamp(x), y: clamp(y) };
  });
}
