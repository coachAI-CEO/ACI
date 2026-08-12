import type { DiagramArrow, DiagramPlayer, DiagramPointRef } from "@/types/diagram";

/** Build a sticky player link or a free pitch point. */
export function buildPointRef(
  playerId: string | null | undefined,
  x: number,
  y: number
): DiagramPointRef {
  if (playerId) return { playerId };
  return { x, y };
}

/** Resolve an arrow endpoint to pitch coords (sticky to player when linked). */
export function resolveEndpoint(
  ref: DiagramPointRef,
  players: DiagramPlayer[]
): { x: number; y: number } | null {
  if (ref.playerId) {
    const p = players.find((pl) => pl.id === ref.playerId);
    if (p) return { x: p.x, y: p.y };
    return null;
  }
  if (typeof ref.x === "number" && typeof ref.y === "number") {
    return { x: ref.x, y: ref.y };
  }
  return null;
}

/** Distance from point P to segment AB (screen or pitch space — same units). */
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
  if (len2 < 1e-9) {
    const dx = px - ax;
    const dy = py - ay;
    return Math.hypot(dx, dy);
  }
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return Math.hypot(px - cx, py - cy);
}

export function findArrowIndexAtScreenPoint(
  arrows: DiagramArrow[],
  players: DiagramPlayer[],
  sx: number,
  sy: number,
  toScreen: (p: { x: number; y: number }) => { sx: number; sy: number },
  thresholdPx: number
): number {
  let best = -1;
  let bestD = thresholdPx;
  for (let i = 0; i < arrows.length; i++) {
    const from = resolveEndpoint(arrows[i].from, players);
    const to = resolveEndpoint(arrows[i].to, players);
    if (!from || !to) continue;
    const a = toScreen(from);
    const b = toScreen(to);
    const d = distanceToSegment(sx, sy, a.sx, a.sy, b.sx, b.sy);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function eraseArrowAtIndex(arrows: DiagramArrow[], index: number): DiagramArrow[] {
  if (index < 0 || index >= arrows.length) return arrows;
  return arrows.filter((_, i) => i !== index);
}

/** True when moving a player should move this arrow endpoint (sticky link). */
export function arrowFollowsPlayer(arrow: DiagramArrow, playerId: string): boolean {
  return arrow.from.playerId === playerId || arrow.to.playerId === playerId;
}

export function createLineArrow(input: {
  fromPlayerId?: string | null;
  toPlayerId?: string | null;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  type: DiagramArrow["type"];
  style: DiagramArrow["style"];
  weight: DiagramArrow["weight"];
  minDistance?: number;
}): DiagramArrow | null {
  const min = input.minDistance ?? 1.2;
  const dx = input.toX - input.fromX;
  const dy = input.toY - input.fromY;
  if (!input.fromPlayerId && !input.toPlayerId && Math.hypot(dx, dy) < min) {
    return null;
  }
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
