/** Pixel-space routing so a pass/run/shot never paints through a shirt
 * that isn't the passer or the receiver. Straight when the lane is open;
 * a quadratic banana around the blocker when it isn't. */

export type Pt = { x: number; y: number };
export type FieldBounds = { x: number; y: number; w: number; h: number };
export type RoutedArrow = { start: Pt; end: Pt; control: Pt | null };

const END_IGNORE_T = 0.12;

export function distPointToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** True when the token sits on the interior of the chord, not on an endpoint. */
export function tokenBlocksLane(token: Pt, a: Pt, b: Pt, clearance: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return false;
  const t = ((token.x - a.x) * dx + (token.y - a.y) * dy) / len2;
  if (t <= END_IGNORE_T || t >= 1 - END_IGNORE_T) return false;
  return distPointToSegment(token, a, b) < clearance;
}

export function sampleQuad(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

export function pathHitsTokens(a: Pt, b: Pt, control: Pt | null, tokens: Pt[], clearance: number): number {
  const samples = control
    ? [0.18, 0.32, 0.5, 0.68, 0.82].map((t) => sampleQuad(a, control, b, t))
    : [0.25, 0.5, 0.75].map((t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }));
  let hits = 0;
  for (const token of tokens) {
    if (samples.some((s) => Math.hypot(s.x - token.x, s.y - token.y) < clearance)) hits += 1;
  }
  return hits;
}

function perpUnit(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

function signedSide(a: Pt, b: Pt, p: Pt, n: Pt): number {
  return (p.x - a.x) * n.x + (p.y - a.y) * n.y;
}

function clampToField(p: Pt, field?: FieldBounds, pad = 10): Pt {
  if (!field) return p;
  return {
    x: Math.max(field.x + pad, Math.min(field.x + field.w - pad, p.x)),
    y: Math.max(field.y + pad, Math.min(field.y + field.h - pad, p.y)),
  };
}

function projectOnSegment(p: Pt, a: Pt, b: Pt): { point: Pt; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return { point: a, t: 0 };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { point: { x: a.x + t * dx, y: a.y + t * dy }, t };
}

function pathScore(a: Pt, b: Pt, control: Pt | null, tokens: Pt[], clearance: number): { hits: number; minD: number } {
  const samples = control
    ? [0.18, 0.32, 0.5, 0.68, 0.82].map((t) => sampleQuad(a, control, b, t))
    : [0.25, 0.5, 0.75].map((t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }));
  let hits = 0;
  let minD = Number.POSITIVE_INFINITY;
  for (const token of tokens) {
    const d = Math.min(...samples.map((s) => Math.hypot(s.x - token.x, s.y - token.y)));
    minD = Math.min(minD, d);
    if (d < clearance) hits += 1;
  }
  return { hits, minD: Number.isFinite(minD) ? minD : clearance };
}

/**
 * Pick a quadratic control so the shaft misses every token in `blockers`.
 * `blockers` must already exclude the passer and receiver.
 * Control sits beside the closest blocker (not at the chord midpoint) so the
 * banana is local to the shirt in the way instead of sweeping through the rest
 * of the team.
 */
export function routeAroundTokens(
  from: Pt,
  to: Pt,
  blockers: Pt[],
  tokenRadius: number,
  field?: FieldBounds
): RoutedArrow {
  const clearance = tokenRadius + 6;
  const onLane = blockers.filter((p) => tokenBlocksLane(p, from, to, clearance));
  if (onLane.length === 0) return { start: from, end: to, control: null };

  const n = perpUnit(from, to);
  const primary = onLane.reduce((best, p) =>
    distPointToSegment(p, from, to) < distPointToSegment(best, from, to) ? p : best
  );
  const { point: proj } = projectOnSegment(primary, from, to);
  const meanSide = onLane.reduce((s, p) => s + signedSide(from, to, p, n), 0) / onLane.length;
  const fieldMidY = field ? field.y + field.h / 2 : (from.y + to.y) / 2;
  const towardTouchline = (from.y + to.y) / 2 < fieldMidY ? -1 : 1;
  const around = Math.abs(meanSide) > 2 ? (meanSide > 0 ? -1 : 1) : towardTouchline;

  const need = tokenRadius + 10;
  const offsets = [need * 2, need * 2.6, need * 3.2, need * 4];
  const signs = [around, -around];

  let best: { control: Pt; hits: number; minD: number; mag: number } | null = null;
  for (const sign of signs) {
    for (const mag of offsets) {
      const control = clampToField({ x: proj.x + n.x * sign * mag, y: proj.y + n.y * sign * mag }, field);
      const { hits, minD } = pathScore(from, to, control, blockers, clearance);
      const better =
        !best ||
        hits < best.hits ||
        (hits === best.hits && minD > best.minD + 0.5) ||
        (hits === best.hits && Math.abs(minD - best.minD) <= 0.5 && mag < best.mag);
      if (better) best = { control, hits, minD, mag };
      if (hits === 0 && minD >= clearance) return { start: from, end: to, control };
    }
  }
  return { start: from, end: to, control: best?.control ?? null };
}

export function insetPoint(origin: Pt, toward: Pt, pad: number): Pt {
  const dx = toward.x - origin.x;
  const dy = toward.y - origin.y;
  const len = Math.hypot(dx, dy);
  if (len < 4) return origin;
  const d = Math.min(pad, Math.max(0, len - 4));
  return { x: origin.x + (dx / len) * d, y: origin.y + (dy / len) * d };
}

/** Among candidate targets, pick the one whose straight lane from `from` is least blocked. */
export function pickClearestTarget<T extends Pt>(from: Pt, candidates: T[], blockers: Pt[], clearance: number): T {
  let best = candidates[0];
  let bestHits = Number.POSITIVE_INFINITY;
  for (const to of candidates) {
    const hits = blockers.filter((p) => tokenBlocksLane(p, from, to, clearance)).length;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    if (hits < bestHits || (hits === bestHits && dist > Math.hypot(best.x - from.x, best.y - from.y))) {
      best = to;
      bestHits = hits;
    }
  }
  return best;
}
