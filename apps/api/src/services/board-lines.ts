/**
 * Line / arrow helpers for sticky player links, free endpoints, and erase hit-testing.
 * Mirror of apps/web/src/lib/board-lines.ts — keep behaviour in sync.
 */

export type LinePointRef = {
  playerId?: string;
  x?: number;
  y?: number;
};

export type LineArrow = {
  from: LinePointRef;
  to: LinePointRef;
  type: 'pass' | 'run' | 'press' | 'cover' | 'transition';
  style: 'solid' | 'dashed' | 'dotted';
  weight: 'normal' | 'bold';
};

export type LinePlayer = { id: string; x: number; y: number };

export function buildPointRef(
  playerId: string | null | undefined,
  x: number,
  y: number
): LinePointRef {
  if (playerId) return { playerId };
  return { x, y };
}

export function resolveEndpoint(
  ref: LinePointRef,
  players: LinePlayer[]
): { x: number; y: number } | null {
  if (ref.playerId) {
    const p = players.find((pl) => pl.id === ref.playerId);
    if (p) return { x: p.x, y: p.y };
    return null;
  }
  if (typeof ref.x === 'number' && typeof ref.y === 'number') {
    return { x: ref.x, y: ref.y };
  }
  return null;
}

export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

export function findArrowIndexNearPoint(
  arrows: LineArrow[],
  players: LinePlayer[],
  x: number,
  y: number,
  threshold: number
): number {
  let best = -1;
  let bestD = threshold;
  for (let i = 0; i < arrows.length; i++) {
    const from = resolveEndpoint(arrows[i].from, players);
    const to = resolveEndpoint(arrows[i].to, players);
    if (!from || !to) continue;
    const d = distanceToSegment(x, y, from.x, from.y, to.x, to.y);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function eraseArrowAtIndex(arrows: LineArrow[], index: number): LineArrow[] {
  if (index < 0 || index >= arrows.length) return arrows;
  return arrows.filter((_, i) => i !== index);
}

export function arrowFollowsPlayer(arrow: LineArrow, playerId: string): boolean {
  return arrow.from.playerId === playerId || arrow.to.playerId === playerId;
}

export function createLineArrow(input: {
  fromPlayerId?: string | null;
  toPlayerId?: string | null;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  type: LineArrow['type'];
  style: LineArrow['style'];
  weight: LineArrow['weight'];
  minDistance?: number;
}): LineArrow | null {
  const min = input.minDistance ?? 1.2;
  const dx = input.toX - input.fromX;
  const dy = input.toY - input.fromY;
  if (!input.fromPlayerId && !input.toPlayerId && Math.hypot(dx, dy) < min) return null;
  if (
    input.fromPlayerId &&
    input.toPlayerId &&
    input.fromPlayerId === input.toPlayerId &&
    Math.hypot(dx, dy) < min
  ) {
    return null;
  }
  return {
    from: buildPointRef(input.fromPlayerId, input.fromX, input.fromY),
    to: buildPointRef(input.toPlayerId, input.toX, input.toY),
    type: input.type,
    style: input.style,
    weight: input.weight,
  };
}
