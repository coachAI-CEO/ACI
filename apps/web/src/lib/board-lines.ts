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

function clampPitch(n: number) {
  return Math.max(0, Math.min(100, n));
}

/** Default quadratic control for a curved arrow (bulge perpendicular to chord). */
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
  const px = -dy / len;
  const py = dx / len;
  return {
    x: clampPitch(mx + px * len * bulge),
    y: clampPitch(my + py * len * bulge),
  };
}

/** +1 / -1 for which side of the chord the control point sits on. */
export function curveBulgeSign(
  from: { x: number; y: number },
  to: { x: number; y: number },
  control: { x: number; y: number }
): 1 | -1 {
  const cross = (to.x - from.x) * (control.y - from.y) - (to.y - from.y) * (control.x - from.x);
  return cross >= 0 ? 1 : -1;
}

/** Reflect a curve control across the chord (flip bend direction). */
export function flipCurveControl(
  from: { x: number; y: number },
  to: { x: number; y: number },
  control: { x: number; y: number }
): { x: number; y: number } {
  const abx = to.x - from.x;
  const aby = to.y - from.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return { ...control };
  const t = ((control.x - from.x) * abx + (control.y - from.y) * aby) / len2;
  const projX = from.x + t * abx;
  const projY = from.y + t * aby;
  return {
    x: clampPitch(2 * projX - control.x),
    y: clampPitch(2 * projY - control.y),
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

/** Whether this arrow should render an arrowhead (legacy types default on except transition). */
export function arrowHasHead(arrow: DiagramArrow): boolean {
  if (typeof arrow.arrowhead === "boolean") return arrow.arrowhead;
  return arrow.type !== "transition";
}

/** Pitch-space polyline for hit-testing / rendering helpers. */
export function arrowPitchPolyline(
  arrow: DiagramArrow,
  players: DiagramPlayer[]
): Array<{ x: number; y: number }> | null {
  const from = resolveEndpoint(arrow.from, players);
  const to = resolveEndpoint(arrow.to, players);
  if (!from || !to) return null;
  if (arrow.path && arrow.path.length >= 2) {
    return [{ x: from.x, y: from.y }, ...arrow.path.slice(1, -1), { x: to.x, y: to.y }];
  }
  if (arrow.control) {
    return sampleQuadratic(from, arrow.control, to, 20);
  }
  return [from, to];
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

function distanceToPolyline(
  px: number,
  py: number,
  pts: Array<{ x: number; y: number }>
): number {
  if (pts.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distanceToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    if (d < best) best = d;
  }
  return best;
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
    const poly = arrowPitchPolyline(arrows[i], players);
    if (!poly || poly.length < 2) continue;
    const screenPts = poly.map((p) => {
      const s = toScreen(p);
      return { x: s.sx, y: s.sy };
    });
    const d = distanceToPolyline(sx, sy, screenPts);
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
  arrowhead?: boolean;
  control?: { x: number; y: number };
  path?: Array<{ x: number; y: number }>;
  minDistance?: number;
}): DiagramArrow | null {
  const min = input.minDistance ?? 1.2;
  const path = input.path?.filter(
    (p) => typeof p.x === "number" && typeof p.y === "number"
  );
  if (path && path.length >= 2) {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    if (len < min && !input.fromPlayerId && !input.toPlayerId) return null;
  } else {
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
  }
  const arrow: DiagramArrow = {
    from: buildPointRef(input.fromPlayerId, input.fromX, input.fromY),
    to: buildPointRef(input.toPlayerId, input.toX, input.toY),
    type: input.type,
    style: input.style,
    weight: input.weight,
  };
  if (typeof input.arrowhead === "boolean") arrow.arrowhead = input.arrowhead;
  if (input.control) arrow.control = input.control;
  if (path && path.length >= 2) arrow.path = path.map((p) => ({ x: clampPitch(p.x), y: clampPitch(p.y) }));
  return arrow;
}

/**
 * Shorten a screen-space segment so the stroke/arrowhead stops outside player tokens.
 * fromPad/toPad are radii in px (token radius + gap so the arrow tip stays visible).
 */
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

/** Trim start/end of a screen polyline away from token pads. */
export function shortenPolylineForTokens(
  pts: Array<{ x: number; y: number }>,
  fromPad: number,
  toPad: number
): Array<{ x: number; y: number }> | null {
  if (pts.length < 2) return null;
  const out = pts.map((p) => ({ ...p }));
  if (fromPad > 0) {
    let remaining = fromPad;
    while (out.length >= 2 && remaining > 0) {
      const dx = out[1].x - out[0].x;
      const dy = out[1].y - out[0].y;
      const seg = Math.hypot(dx, dy);
      if (seg <= remaining) {
        remaining -= seg;
        out.shift();
      } else {
        const t = remaining / seg;
        out[0] = { x: out[0].x + dx * t, y: out[0].y + dy * t };
        remaining = 0;
      }
    }
  }
  if (toPad > 0) {
    let remaining = toPad;
    while (out.length >= 2 && remaining > 0) {
      const n = out.length;
      const dx = out[n - 2].x - out[n - 1].x;
      const dy = out[n - 2].y - out[n - 1].y;
      const seg = Math.hypot(dx, dy);
      if (seg <= remaining) {
        remaining -= seg;
        out.pop();
      } else {
        const t = remaining / seg;
        out[n - 1] = { x: out[n - 1].x + dx * t, y: out[n - 1].y + dy * t };
        remaining = 0;
      }
    }
  }
  return out.length >= 2 ? out : null;
}

export function polylineToPathD(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}
