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
  arrowhead?: boolean;
  control?: { x: number; y: number };
  path?: Array<{ x: number; y: number }>;
  order?: number;
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

function clampPitch(n: number) {
  return Math.max(0, Math.min(100, n));
}

export function defaultCurveControl(
  from: { x: number; y: number },
  to: { x: number; y: number },
  bulge = 0.28
): { x: number; y: number } {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: clampPitch(mx + (-dy / len) * len * bulge),
    y: clampPitch(my + (dx / len) * len * bulge),
  };
}

export function sampleQuadratic(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  n = 24
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    });
  }
  return out;
}

export function arrowHasHead(arrow: LineArrow): boolean {
  if (typeof arrow.arrowhead === 'boolean') return arrow.arrowhead;
  return arrow.type !== 'transition';
}

export function arrowPitchPolyline(
  arrow: LineArrow,
  players: LinePlayer[]
): Array<{ x: number; y: number }> | null {
  const from = resolveEndpoint(arrow.from, players);
  const to = resolveEndpoint(arrow.to, players);
  if (!from || !to) return null;
  if (arrow.path && arrow.path.length >= 2) {
    return [{ x: from.x, y: from.y }, ...arrow.path.slice(1, -1), { x: to.x, y: to.y }];
  }
  if (arrow.control) return sampleQuadratic(from, arrow.control, to, 20);
  return [from, to];
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

function distanceToPolyline(px: number, py: number, pts: Array<{ x: number; y: number }>): number {
  if (pts.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distanceToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    if (d < best) best = d;
  }
  return best;
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
    const poly = arrowPitchPolyline(arrows[i], players);
    if (!poly || poly.length < 2) continue;
    const d = distanceToPolyline(x, y, poly);
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
  arrowhead?: boolean;
  control?: { x: number; y: number };
  path?: Array<{ x: number; y: number }>;
  minDistance?: number;
}): LineArrow | null {
  const min = input.minDistance ?? 1.2;
  const path = input.path?.filter((p) => typeof p.x === 'number' && typeof p.y === 'number');
  if (path && path.length >= 2) {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    if (len < min && !input.fromPlayerId && !input.toPlayerId) return null;
  } else {
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
  }
  const arrow: LineArrow = {
    from: buildPointRef(input.fromPlayerId, input.fromX, input.fromY),
    to: buildPointRef(input.toPlayerId, input.toX, input.toY),
    type: input.type,
    style: input.style,
    weight: input.weight,
  };
  if (typeof input.arrowhead === 'boolean') arrow.arrowhead = input.arrowhead;
  if (input.control) arrow.control = input.control;
  if (path && path.length >= 2) {
    arrow.path = path.map((p) => ({ x: clampPitch(p.x), y: clampPitch(p.y) }));
  }
  return arrow;
}

/** Shorten a screen-space segment so arrowheads stop outside player tokens. */
export function shortenSegmentForTokens(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  fromPad: number,
  toPad: number
): { x1: number; y1: number; x2: number; y2: number } | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  if (fromPad + toPad >= len * 0.92) return null;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: x1 + ux * fromPad,
    y1: y1 + uy * fromPad,
    x2: x2 - ux * toPad,
    y2: y2 - uy * toPad,
  };
}
