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
 * Practice area for a match-format slice. HALF/THIRD/QUARTER cut length only;
 * width stays the format's goal line. 11v11 THIRD is 40×80, not 40×35.
 */
export function practiceSpaceYards(
  format: FieldFormat,
  spaceConstraint: string
): { lengthYards: number; widthYards: number } {
  const spec = FIELD_SPECS[format];
  const key = String(spaceConstraint || "FULL").toUpperCase();
  if (key === "HALF") return { lengthYards: Math.round(spec.lengthYards / 2), widthYards: spec.widthYards };
  if (key === "THIRD") return { lengthYards: Math.round(spec.lengthYards / 3), widthYards: spec.widthYards };
  if (key === "QUARTER") return { lengthYards: Math.round(spec.lengthYards / 4), widthYards: spec.widthYards };
  return { lengthYards: spec.lengthYards, widthYards: spec.widthYards };
}

export function isWarmupPicture(drillType?: string | null): boolean {
  const type = String(drillType || "").toUpperCase().replace(/[-\s]/g, "");
  return type === "WARMUP" || type.includes("WARMUP");
}

/** Match-format slices (tactical 11v11 third, 7v7 half) keep full pitch width.
 *  Warmup is always the drill's own grid, never the session's two-goal half. */
export function shouldLockPracticeArea(args: { drillType?: string; goalsAvailable?: number | null }): boolean {
  const type = String(args.drillType || "").toUpperCase();
  if (isWarmupPicture(type)) return false;
  if (type === "TECHNICAL") return Number(args.goalsAvailable) >= 1;
  return type.length > 0;
}

/** Outfield tokens per side for a match-format picture (GK counted separately). */
export function formatOutfieldPerSide(format: FieldFormat): number {
  if (format === "7V7") return 6;
  if (format === "9V9") return 8;
  return 10;
}

/**
 * How many outfield shirts a picture can carry. numbersMin–Max is the squad
 * at the session, not the count on every diagram.
 */
export function pictureOutfieldCap(args: {
  drillType?: string | null;
  format: FieldFormat;
  fullGoals?: number;
}): { home: number; away: number; total: number } {
  const type = String(args.drillType || "").toUpperCase();
  if (isWarmupPicture(type)) return { home: 8, away: 2, total: 8 };
  if (type.includes("TECHNICAL")) {
    if ((args.fullGoals || 0) >= 1) return { home: 8, away: 4, total: 10 };
    return { home: 6, away: 2, total: 8 };
  }
  const side = formatOutfieldPerSide(args.format);
  return { home: side, away: side, total: side * 2 + 2 };
}

export function svgOutfieldCount(svg: string | null | undefined): number {
  if (!svg) return 0;
  return (svg.match(/filter="url\(#ps\)"/g) || []).length;
}

/** Stored SVG still has a squad dump (one colour blob, or extras beyond 11v11). */
export function svgPictureIsOvercrowded(
  drillType: string | null | undefined,
  svg: string | null | undefined
): boolean {
  if (!svg) return false;
  const n = svgOutfieldCount(svg);
  const type = String(drillType || "").toUpperCase();
  if (isWarmupPicture(type)) return n > 10;
  if (type.includes("TECHNICAL")) return n > 10;
  const home = (svg.match(/fill="#3b82f6" stroke="#020617"/g) || []).length;
  const away = (svg.match(/fill="#ef4444" stroke="#020617"/g) || []).length;
  if (home === 0 || away === 0) return n > 10;
  return home > 10 || away > 10;
}

export function svgHasShirtNumbers(svg: string | null | undefined): boolean {
  if (!svg) return false;
  return /fill="#ffffff">\d+</.test(svg);
}

/**
 * Warmup may have orange mini-goals. Those still go through api-goal-overlay.
 * Match kit is a GK shirt or a white full-size net, not the mini overlay itself.
 */
export function warmupSvgStillHasMatchKit(
  drillType: string | null | undefined,
  svg: string | null | undefined
): boolean {
  if (!isWarmupPicture(drillType) || !svg) return false;
  if (/>GK</.test(svg)) return true;
  if (!/id="api-goal-overlay"/.test(svg)) return false;
  return /stroke="#f8fafc"/.test(svg);
}

export function storedSvgIsStale(
  drillType: string | null | undefined,
  svg: string | null | undefined
): boolean {
  return warmupSvgStillHasMatchKit(drillType, svg) || svgHasShirtNumbers(svg) || svgPictureIsOvercrowded(drillType, svg);
}

/** Session-setup defaults when a drill JSON omits formations. */
export function defaultFormationsForFormat(format: FieldFormat): { attacking: string; defending: string } {
  if (format === "7V7") return { attacking: "2-3-1", defending: "3-2-1" };
  if (format === "11V11") return { attacking: "4-3-3", defending: "4-2-3-1" };
  return { attacking: "3-2-3", defending: "3-3-2" };
}

/** e.g. "3-2-3" → [3, 2, 3]. Null if the string is not a formation. */
export function parseFormationNums(formation: string): number[] | null {
  const match = String(formation || "").match(/(\d+(?:-\d+)+)/);
  if (!match) return null;
  const nums = match[1].split("-").map(Number).filter((n) => n > 0);
  return nums.length >= 2 ? nums : null;
}

function padRoles(roles: string[], n: number, fill: string): string[] {
  const next = roles.slice(0, n);
  while (next.length < n) next.push(fill);
  return next;
}

/** CB / LCB / RCB / CCB, with optional _ATT/_DEF suffix. Not LB/RB. */
export function isCenterBackRole(role: string): boolean {
  const raw = String(role || "")
    .toUpperCase()
    .replace(/[_-]?(ATT|DEF)$/, "");
  return /^(?:[LR]|C)?CB$/.test(raw);
}

export function expectedOutfieldRoles(formation: string): string[] | null {
  const nums = parseFormationNums(formation);
  if (!nums) return null;
  // 3-5-2 is not a 5-across mid line: CBs, three CMs, wing-backs, two STs.
  if (nums.join("-") === "3-5-2") {
    return ["LCB", "CB", "RCB", "LCM", "CDM", "RCM", "LWB", "RWB", "ST", "ST"];
  }
  const back = (n: number) =>
    n <= 1 ? ["CB"] : n === 2 ? ["CB", "CB"] : n === 3 ? ["LB", "CB", "RB"] : padRoles(["LB", "CB", "CB", "RB"], n, "CB");
  const mid = (n: number) =>
    n <= 1 ? ["CM"] : n === 2 ? ["CM", "CM"] : n === 3 ? ["LM", "CM", "RM"] : padRoles(["LM", "CM", "CM", "RM"], n, "CM");
  const front = (n: number) =>
    n <= 1 ? ["ST"] : n === 2 ? ["ST", "ST"] : n === 3 ? ["LW", "ST", "RW"] : padRoles(["LW", "ST", "ST", "RW"], n, "ST");
  return nums.flatMap((n, i) => {
    if (i === 0) return back(n);
    if (i === nums.length - 1) return front(n);
    return mid(n);
  });
}

/** 6 outfield + GK vs 6 outfield + GK is 7v7, not 6v6+2GK. */
export function matchupWithKeepers(attOut: number, defOut: number, gk: number, neutrals = 0): string {
  if (neutrals > 0) {
    const field = `${attOut}v${defOut}+${neutrals}`;
    return gk > 0 ? `${field}+${gk}GK` : field;
  }
  if (gk >= 2) return `${attOut + 1}v${defOut + 1}`;
  if (gk === 1) return `${attOut}v${defOut}+GK`;
  return `${attOut}v${defOut}`;
}

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

/**
 * One full-size goal with all the action packed on that end (attacking /
 * defensive third). The field rect is still a full pitch, so the unused
 * third reads as a "shifted" diagram. Reframe on X only.
 */
export function shouldReframeOneSidedPitch(
  players: Array<{ x: number }>,
  fullGoalCount: number
): boolean {
  if (fullGoalCount !== 1 || players.length < 4) return false;
  const minX = Math.min(...players.map((player) => player.x));
  const maxX = Math.max(...players.map((player) => player.x));
  return minX > 18 || maxX < 82;
}

export function shouldReframeAxis(values: number[]): boolean {
  if (values.length === 0) return false;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min > 18 || max < 82;
}

/**
 * Session JSON sometimes emits touchline coords in yards (0–widthYards)
 * instead of 0–100 percent. A 9v9 55yd-wide pitch with y=8..48 then draws
 * every token in the top half of the grass — the field looks shifted
 * relative to the players. True when the cluster midpoint is the yard
 * midline, not percent-50.
 */
export function looksLikeYardAxis(values: number[], yards: number): boolean {
  if (values.length < 3 || !Number.isFinite(yards) || yards < 20) return false;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min < -2 || max > yards + 2) return false;
  // Percent space reaches ~94–100. 9v9 length is 80yd, so an endline goal
  // at 80 is yards; a 0–100 crop at 94 is not.
  if (yards <= 100 && max >= 92) return false;
  const mid = (min + max) / 2;
  const closerToYardMid = Math.abs(mid - yards / 2) <= Math.abs(mid - 50) + 2;
  if (yards < 75) return max < 72 && closerToYardMid;
  return closerToYardMid;
}

export function yardsToPercent(value: number, yards: number): number {
  const span = Math.max(1e-6, yards);
  return Math.max(0, Math.min(100, (value / span) * 100));
}

/** Outfield cluster should sit on the pitch center, not a sideline band. */
export function playerClusterCentered(
  players: Array<{ x: number; y: number; team?: string }>,
  axis: "x" | "y"
): { ok: boolean; mid: number } {
  const pts = players.filter((player) => player.team !== "gk");
  const use = pts.length >= 4 ? pts : players;
  if (use.length < 2) return { ok: true, mid: 50 };
  const values = use.map((player) => player[axis]);
  const mid = (Math.min(...values) + Math.max(...values)) / 2;
  return { ok: Math.abs(mid - 50) <= 14, mid };
}

/** Tighter than the zoom-out pad -- 10% leftover on the open end is why
 * one-goal thirds still looked shoved after the first X-only remap. */
const ONE_SIDED_PADDING_PERCENT = 4;

export function computeOneSidedAxisWindow(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 100 };
  let min = Math.min(...values) - ONE_SIDED_PADDING_PERCENT;
  let max = Math.max(...values) + ONE_SIDED_PADDING_PERCENT;
  min = Math.max(0, min);
  max = Math.min(100, max);
  [min, max] = ensureMinSpan(min, max, CONTENT_WINDOW_MIN_SPAN_PERCENT);
  min = Math.max(0, min);
  max = Math.min(100, max);
  return { min, max };
}

export function computeHorizontalContentWindow(xs: number[]): { minX: number; maxX: number } {
  const window = computeOneSidedAxisWindow(xs);
  return { minX: window.min, maxX: window.max };
}
