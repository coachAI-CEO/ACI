/**
 * Real-world field dimensions per format, sourced from standard youth field
 * spec charts. Where the source gives a range, the LARGER number is used
 * (per direct instruction) -- this is a deliberate choice to bias toward
 * "does the practice area look small relative to the field" rather than
 * risk under-stating how much bigger the real pitch is.
 *
 * Touch Line = the long boundary (field length). Goal Line = the short
 * boundary where the goal sits (field width). Goal size uses the larger of
 * the two standard options given.
 */
export type FieldFormat = "7V7" | "9V9" | "11V11";

export interface FieldSpec {
  lengthYards: number; // touchline
  widthYards: number; // goal line
  goalHeightFt: number;
  goalWidthFt: number;
}

export const FIELD_SPECS: Record<FieldFormat, FieldSpec> = {
  "7V7": { lengthYards: 65, widthYards: 45, goalHeightFt: 7, goalWidthFt: 21 },
  "9V9": { lengthYards: 80, widthYards: 55, goalHeightFt: 7, goalWidthFt: 21 },
  "11V11": { lengthYards: 120, widthYards: 80, goalHeightFt: 8, goalWidthFt: 24 },
};

/**
 * Maps total on-field player count to the nearest real match format. Uses
 * on-field totals (both teams combined, GK included where present), not
 * per-side counts -- e.g. 7v7 = 14 on the field, 9v9 = 18, 11v11 = 22+.
 */
export function resolveFieldFormat(totalPlayersOnField: number): FieldFormat {
  if (totalPlayersOnField <= 14) return "7V7";
  if (totalPlayersOnField <= 18) return "9V9";
  return "11V11";
}

/**
 * What fraction of the real full-size pitch (for the resolved format) the
 * drill's declared practice area covers. 1.0 = the drill uses the whole
 * pitch; small values mean the practice area is a small slice of a much
 * bigger real field.
 */
export function coverageRatio(drillWidthYards: number, drillLengthYards: number, format: FieldFormat): number {
  const spec = FIELD_SPECS[format];
  const drillArea = Math.max(0, drillWidthYards) * Math.max(0, drillLengthYards);
  const fullArea = spec.widthYards * spec.lengthYards;
  if (fullArea <= 0) return 1;
  return Math.min(1, drillArea / fullArea);
}

/**
 * Below this coverage ratio, the practice area is small enough relative to
 * the real pitch that showing it with no context (zoomed in, filling the
 * whole canvas) would misrepresent how much of the field is actually in
 * play -- exactly the "looks like a full pitch" problem already found.
 */
export const ZOOM_OUT_THRESHOLD = 0.6;

export function shouldZoomOut(drillWidthYards: number, drillLengthYards: number, format: FieldFormat): boolean {
  return coverageRatio(drillWidthYards, drillLengthYards, format) < ZOOM_OUT_THRESHOLD;
}

/**
 * Single source of truth for player token radius (px), used by the
 * deterministic renderer, the Gemini drawer prompt, the mapper's collision
 * resolution, AND field-element scaling (penalty box, goal area, goal
 * posts -- see scaleFactorFromTokenRadius below). Previously duplicated
 * three ways with the same formula; consolidated here so every consumer
 * of "how big should things be for this drill" agrees by construction.
 *
 * Two factors: (1) a small practice area relative to a real full-size
 * pitch scales UP from the baseline (a tight grid should show
 * proportionally bigger elements); (2) a high player count dampens that
 * growth back down, because many players sharing a small-looking area
 * (e.g. a 20-player pressing trap) need SMALLER elements to avoid overlap
 * regardless of how the declared area compares to a full pitch.
 */
export const TOKEN_RADIUS_BASELINE = 13;
export const TOKEN_RADIUS_MAX = 20;
const MIN_COVERAGE_RATIO_FOR_SCALING = 0.03;
const PLAYER_COUNT_DAMPEN_THRESHOLD = 14;

export function computeTokenRadius(
  widthYards: number,
  lengthYards: number,
  format: FieldFormat,
  totalPlayers: number
): number {
  const ratio = Math.max(MIN_COVERAGE_RATIO_FOR_SCALING, coverageRatio(widthYards, lengthYards, format));
  const areaScaled = TOKEN_RADIUS_BASELINE / Math.sqrt(ratio);
  // Linear, not sqrt -- sqrt(14/21) only knocks 18% off for a 21-player
  // drill, which wasn't enough: tactical sub-groups (a "compact high
  // press zone") cluster far more densely than the field-wide average, so
  // a weak correction still left real, visible token overlap even after
  // collision resolution ran. Linear dampening keeps the boost for drills
  // near the threshold while pulling harder as player count climbs toward
  // a full 22-player match.
  const dampener = totalPlayers <= PLAYER_COUNT_DAMPEN_THRESHOLD ? 1 : PLAYER_COUNT_DAMPEN_THRESHOLD / totalPlayers;
  return Math.max(TOKEN_RADIUS_BASELINE, Math.min(TOKEN_RADIUS_MAX, areaScaled * dampener));
}

/** How much bigger (or, in principle, smaller) than baseline everything in
 * this drill should render. 1.0 = baseline/normal. Apply this the same way
 * to penalty boxes, goal areas, and goal posts as to player tokens, so the
 * whole diagram scales together instead of just the players. */
export function scaleFactorFromTokenRadius(tokenRadius: number): number {
  return tokenRadius / TOKEN_RADIUS_BASELINE;
}

/**
 * The field rect drawn on every diagram is a fixed size and shape -- it does
 * NOT shrink to match a small drill's real footprint. Previously that meant
 * a 25x25-yard grid still got positioned by its raw 0-100 percent
 * coordinates against that same full-size box: correct decoration
 * (shouldZoomOut hides the halfway line) and correct token scaling
 * (computeTokenRadius), but the actual camera/viewport never reframed, so
 * the drill's real content still rendered crammed into whatever fraction of
 * the box its coordinates happened to fall into -- looking like a huge
 * empty pitch with a tiny cluster of players in one corner.
 *
 * This computes the sub-window (in 0-100 percent space) that the drill's
 * actual content occupies, so callers can remap every coordinate to fill
 * the box instead of sitting inside it at native scale.
 */
export type ContentWindow = { minX: number; maxX: number; minY: number; maxY: number };

const CONTENT_WINDOW_PADDING_PERCENT = 10;
// Never zoom in tighter than this span -- a couple of players standing
// close together shouldn't fill the whole box as if they were the entire
// drill; this keeps some visible margin/context even for a very tight
// cluster.
const CONTENT_WINDOW_MIN_SPAN_PERCENT = 40;

export function computeContentWindow(points: Array<{ x: number; y: number }>): ContentWindow {
  if (points.length === 0) return { minX: 0, maxX: 100, minY: 0, maxY: 100 };

  let minX = Math.min(...points.map((p) => p.x)) - CONTENT_WINDOW_PADDING_PERCENT;
  let maxX = Math.max(...points.map((p) => p.x)) + CONTENT_WINDOW_PADDING_PERCENT;
  let minY = Math.min(...points.map((p) => p.y)) - CONTENT_WINDOW_PADDING_PERCENT;
  let maxY = Math.max(...points.map((p) => p.y)) + CONTENT_WINDOW_PADDING_PERCENT;

  [minX, maxX] = ensureMinSpan(minX, maxX, CONTENT_WINDOW_MIN_SPAN_PERCENT);
  [minY, maxY] = ensureMinSpan(minY, maxY, CONTENT_WINDOW_MIN_SPAN_PERCENT);
  [minX, maxX] = clampWindowToBounds(minX, maxX);
  [minY, maxY] = clampWindowToBounds(minY, maxY);

  return { minX, maxX, minY, maxY };
}

function ensureMinSpan(min: number, max: number, minSpan: number): [number, number] {
  const span = max - min;
  if (span >= minSpan) return [min, max];
  const center = (min + max) / 2;
  return [center - minSpan / 2, center + minSpan / 2];
}

// Clamp into [0,100] by shifting the whole window first (preserving its
// span), only shrinking as a last resort if the span itself is >100.
function clampWindowToBounds(min: number, max: number): [number, number] {
  if (min < 0) {
    max -= min;
    min = 0;
  }
  if (max > 100) {
    min -= max - 100;
    max = 100;
  }
  return [Math.max(0, min), Math.min(100, max)];
}

export function remapToWindow(value: number, min: number, max: number): number {
  const span = Math.max(1e-6, max - min);
  return Math.max(0, Math.min(100, ((value - min) / span) * 100));
}
