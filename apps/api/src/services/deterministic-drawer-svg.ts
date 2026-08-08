import type { DrawerArrow, DrawerCoach, DrawerParams, DrawerPlayer, DrawerZone } from "../types/drawer";
import { computeTokenRadius, shouldZoomOut } from "../data/field-dimensions";
import { computeLegendLayout } from "./legend-layout";

type Point = { x: number; y: number };
type Geometry = {
  svgWidth: number;
  svgHeight: number;
  fieldX: number;
  fieldY: number;
  fieldW: number;
  fieldH: number;
  rotateVerticalData: boolean;
  /** True when the drill's practice area is a small slice of a real full-size
   * pitch for its format -- center circle/halfway line are full-pitch
   * features that don't correspond to anything real on a small grid, so
   * they're only drawn when this is false. */
  zoomOut: boolean;
  /** Player token radius in px -- see computeTokenRadius() in
   * field-dimensions.ts for the factors that drive this (area vs a real
   * full-size pitch, dampened by player count). Single source of truth
   * shared with the Gemini prompt, the mapper's collision resolution, and
   * field-element scaling (penalty box, goal area, goal posts). */
  tokenRadius: number;
};

/** Inset the field rect within its allotted panel so the practice area has
 * visible breathing room instead of running flush to the card edge. */
/** Widened from 0.12 -- the coach marker needs guaranteed room outside the
 * marked practice area (never inside it), on top of the dimension labels
 * already using this margin. */
const FIELD_MARGIN_RATIO = 0.18;

export function renderDeterministicDiagramSVG(params: DrawerParams): string {
  const geometry = getGeometry(params);
  const titleLines = splitTitleLines(humanizeText(params.title || "Drill"));
  const header = renderHeader(params, titleLines);
  const field = renderField(params, geometry);
  const zoneBackgrounds = params.zones.map((zone) => renderZoneBackground(zone, geometry)).join("");
  const zoneLabels = params.zones.map((zone) => renderZoneLabel(zone, geometry)).join("");
  const arrows = params.arrows.map((arrow) => renderArrow(arrow, geometry)).join("");
  const players = params.players.map((player) => renderPlayer(player, geometry)).join("");
  const coach = renderCoach(params.coach, geometry);
  const legend = renderLegend(params, geometry);

  return [
    `<svg viewBox="0 0 ${geometry.svgWidth} ${geometry.svgHeight}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect x="0" y="0" width="${geometry.svgWidth}" height="${geometry.svgHeight}" fill="#08111f"/>`,
    renderDefs(),
    field,
    zoneBackgrounds,
    arrows,
    players,
    coach,
    zoneLabels,
    header,
    legend,
    `</svg>`,
  ].join("");
}

function getGeometry(params: DrawerParams): Geometry {
  const hasTopBottomGoal = params.goals.some((goal) => goal.y <= 15 || goal.y >= 85);
  const hasLeftRightGoal = params.goals.some((goal) => goal.x <= 15 || goal.x >= 85);

  const panelX = 56;
  const panelY = 205;
  const panelW = 688;
  const panelH = 382;
  const fieldW = panelW * (1 - FIELD_MARGIN_RATIO);
  const fieldH = panelH * (1 - FIELD_MARGIN_RATIO);
  const fieldX = panelX + (panelW - fieldW) / 2;
  const fieldY = panelY + (panelH - fieldH) / 2;

  // Explicit from generation input when available -- see DrillPromptInput.fieldFormat
  // -- rather than guessed from player count on the fly.
  const zoomOut = shouldZoomOut(params.widthYards, params.lengthYards, params.fieldFormat);

  const tokenRadius = computeTokenRadius(params.widthYards, params.lengthYards, params.fieldFormat, params.players.length);

  return {
    svgWidth: 800,
    svgHeight: 760,
    fieldX,
    fieldY,
    fieldW,
    fieldH,
    rotateVerticalData: hasTopBottomGoal && !hasLeftRightGoal,
    zoomOut,
    tokenRadius,
  };
}

/** Small cone silhouettes at the practice area's corners -- coaches mark the
 * boundary with cones per the setup steps; the diagram should show that. */
function renderCornerCones(geometry: Geometry): string {
  const { fieldX, fieldY, fieldW, fieldH } = geometry;
  const corners: Point[] = [
    { x: fieldX, y: fieldY },
    { x: fieldX + fieldW, y: fieldY },
    { x: fieldX, y: fieldY + fieldH },
    { x: fieldX + fieldW, y: fieldY + fieldH },
  ];
  return corners
    .map(
      ({ x, y }) =>
        `<path d="M ${round(x)} ${round(y - 7)} L ${round(x - 6)} ${round(y + 5)} L ${round(x + 6)} ${round(y + 5)} Z" fill="#f97316" stroke="#7c2d12" stroke-width="1"/>`
    )
    .join("");
}

function renderDefs(): string {
  return `<defs>
<filter id="ps" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="rgba(0,0,0,0.4)"/></filter>
<marker id="mPass" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto"><polygon points="0 0,7 3,0 6" fill="#3b82f6"/></marker>
<marker id="mRun" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto"><polygon points="0 0,7 3,0 6" fill="#3b82f6"/></marker>
<marker id="mPress" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto"><polygon points="0 0,7 3,0 6" fill="#ef4444"/></marker>
<marker id="mCounter" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto"><polygon points="0 0,7 3,0 6" fill="#22c55e"/></marker>
<marker id="mDeliver" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto"><polygon points="0 0,7 3,0 6" fill="#ffffff"/></marker>
<marker id="mFinish" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto"><polygon points="0 0,7 3,0 6" fill="#fbbf24"/></marker>
</defs>`;
}

/**
 * Real-world yard measurements along the top and left edges, in the space
 * the field margin now leaves open. Lets a coach see the actual practice
 * area size at a glance instead of having to read it out of the meta line.
 */
function renderDimensionLabels(params: DrawerParams, geometry: Geometry): string {
  const { fieldX, fieldY, fieldW, fieldH } = geometry;
  const topY = fieldY - 12;
  const leftX = fieldX - 12;
  return `
<line x1="${fieldX}" y1="${topY}" x2="${fieldX + fieldW}" y2="${topY}" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
<text x="${fieldX + fieldW / 2}" y="${topY - 6}" text-anchor="middle" font-family="Arial" font-size="12" font-weight="700" fill="rgba(255,255,255,0.6)">${params.lengthYards} yds</text>
<line x1="${leftX}" y1="${fieldY}" x2="${leftX}" y2="${fieldY + fieldH}" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
<text x="0" y="0" text-anchor="middle" font-family="Arial" font-size="12" font-weight="700" fill="rgba(255,255,255,0.6)" transform="translate(${leftX - 8},${fieldY + fieldH / 2}) rotate(-90)">${params.widthYards} yds</text>`;
}

const THIRDS = [
  { key: "ATTACKING_THIRD", label: "ATT 3rd" },
  { key: "MIDDLE_THIRD", label: "Mid 3rd" },
  { key: "DEFENSIVE_THIRD", label: "DEF 3rd" },
] as const;

/**
 * Compact "which third of the real pitch is this" reference -- three
 * segments left-to-right matching the fixed direction convention
 * (attacking third near ATT's target on the left, defensive third near
 * DEF's goal on the right), with the drill's declared zone highlighted.
 *
 * This does NOT reposition the practice area itself -- it's a small,
 * separate legend answering "is this actually the middle third" without
 * redesigning the main field rendering. Placed in the top margin, to the
 * right of the existing length dimension label (which is centered and
 * narrow), so there's no collision -- reuses existing space instead of
 * needing more margin.
 */
function renderZoneReference(params: DrawerParams, geometry: Geometry): string {
  const zone = String(params.zone || "").toUpperCase();
  if (!THIRDS.some((t) => t.key === zone)) return "";

  const { fieldX, fieldY, fieldW } = geometry;
  const barW = 132;
  const barH = 12;
  const barX = fieldX + fieldW - barW;
  const barY = fieldY - 24;
  const segW = barW / 3;

  const segments = THIRDS.map((third, i) => {
    const isActive = third.key === zone;
    const x = round(barX + i * segW);
    const fill = isActive ? "#10f0a0" : "rgba(255,255,255,0.08)";
    const stroke = isActive ? "#10f0a0" : "rgba(255,255,255,0.25)";
    const textFill = isActive ? "#08111f" : "rgba(255,255,255,0.45)";
    return `<rect x="${x}" y="${barY}" width="${round(segW)}" height="${barH}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
<text x="${round(x + segW / 2)}" y="${round(barY + barH - 2.5)}" text-anchor="middle" font-family="Arial" font-size="6.5" font-weight="800" fill="${textFill}">${third.label}</text>`;
  }).join("");

  return `<g id="zone-reference">${segments}</g>`;
}

function renderField(params: DrawerParams, geometry: Geometry): string {
  const { fieldX, fieldY, fieldW, fieldH, zoomOut } = geometry;

  // A single flat pitch color, not decorative "tactical channel" bands.
  // Those bands were fixed chrome unrelated to this drill's actual data,
  // and visually competed with real data-driven zones (diagram.zones /
  // safeZones, e.g. "Target Zone") for the same rectangular-band look --
  // a coach couldn't tell which greenish band was real. Removed for now;
  // if channel guides come back later they should be driven by actual
  // zone data, not drawn unconditionally on every field.
  const pitchFill = `<rect x="${fieldX}" y="${fieldY}" width="${fieldW}" height="${fieldH}" fill="#1c5134"/>`;

  // Halfway line / center circle are real full-size-pitch features. Drawing
  // them on a small practice grid (zoomOut=true) implies a halfway point
  // that doesn't exist in real life -- same class of bug as the penalty
  // boxes that used to appear on mini-goal edges.
  let centerMarkup = "";
  if (!zoomOut) {
    const centerX = fieldX + fieldW / 2;
    const centerY = fieldY + fieldH / 2;
    const centerRadius = Math.min(fieldW, fieldH) * 0.14;
    centerMarkup = `
<line x1="${centerX}" y1="${fieldY}" x2="${centerX}" y2="${fieldY + fieldH}" stroke="rgba(255,255,255,0.42)" stroke-width="1.5"/>
<circle cx="${centerX}" cy="${centerY}" r="${round(centerRadius)}" fill="none" stroke="rgba(255,255,255,0.38)" stroke-width="1.5"/>
<circle cx="${centerX}" cy="${centerY}" r="3" fill="rgba(255,255,255,0.55)"/>`;
  }

  // Penalty boxes are NOT drawn here. They're added by applyGoalOverlay()
  // (routes/diagram-svg.ts) only next to real full-size goals, so the
  // chrome reflects this drill's actual goal setup instead of always
  // looking like a full match pitch regardless of area/goal type.
  return `<g id="field">
${pitchFill}
<rect x="${fieldX}" y="${fieldY}" width="${fieldW}" height="${fieldH}" rx="6" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2"/>${centerMarkup}
${renderCornerCones(geometry)}
${renderDimensionLabels(params, geometry)}
${renderZoneReference(params, geometry)}
</g>`;
}

function renderHeader(params: DrawerParams, titleLines: [string, string?]): string {
  const type = humanizeText(params.drillType || "Drill");
  const format = escapeXml(params.format || deriveFormat(params));
  const meta = `${format}${format ? " · " : ""}${params.widthYards}x${params.lengthYards} yards · ${type}`;
  // Phase/gameModel/zone context, visible on the diagram itself -- not just
  // in surrounding report chrome -- so a screenshot alone is enough to
  // check whether the drawn content (e.g. which team counter-attacks)
  // actually matches the intended phase, without guessing from the title.
  const contextParts = [
    params.fieldFormat && humanizeFieldFormat(params.fieldFormat),
    params.phase && `Phase: ${humanizeText(params.phase)}`,
    params.gameModelId && `Model: ${humanizeText(params.gameModelId)}`,
    params.zone && `Zone: ${humanizeText(params.zone)}`,
    (params.formationAttacking || params.formationDefending) &&
      `ATT ${params.formationAttacking || "?"} vs DEF ${params.formationDefending || "?"}`,
  ].filter(Boolean);
  const context = contextParts.length ? escapeXml(contextParts.join("  ·  ")) : "";
  const contextLine = context
    ? `<text x="56" y="{Y}" font-family="Arial" font-size="12" font-weight="700" fill="#5eead4">${context}</text>`
    : "";

  if (titleLines[1]) {
    return `<g id="header">
<text x="56" y="76" font-family="Arial" font-size="14" font-weight="800" letter-spacing="3" fill="#10f0a0">TACTICAL DIAGRAM</text>
<text x="56" y="112" font-family="Arial" font-size="27" font-weight="800" fill="#f8fafc">${escapeXml(titleLines[0])}</text>
<text x="56" y="144" font-family="Arial" font-size="27" font-weight="800" fill="#f8fafc">${escapeXml(titleLines[1])}</text>
<text x="56" y="172" font-family="Arial" font-size="14" font-weight="700" fill="#94a3b8">${escapeXml(meta)}</text>
${contextLine.replace("{Y}", "191")}
</g>`;
  }

  return `<g id="header">
<text x="56" y="76" font-family="Arial" font-size="14" font-weight="800" letter-spacing="3" fill="#10f0a0">TACTICAL DIAGRAM</text>
<text x="56" y="122" font-family="Arial" font-size="32" font-weight="800" fill="#f8fafc">${escapeXml(titleLines[0])}</text>
<text x="56" y="150" font-family="Arial" font-size="14" font-weight="700" fill="#94a3b8">${escapeXml(meta)}</text>
${contextLine.replace("{Y}", "169")}
</g>`;
}

function renderZoneBackground(zone: DrawerZone, geometry: Geometry): string {
  const oriented = orientRect(zone, geometry);
  const x = svgX(oriented.x, geometry);
  const y = svgY(oriented.y, geometry);
  const width = (clamp(oriented.width) / 100) * geometry.fieldW;
  const height = (clamp(oriented.height) / 100) * geometry.fieldH;
  if (width <= 0 || height <= 0) return "";
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" fill="#10f0a0" opacity="0.11" stroke="#10f0a0" stroke-width="1.5" stroke-dasharray="7,5"/>`;
}

/**
 * Zone LABEL only -- deliberately separate from the zone background above
 * and drawn much later (after players/coach, see renderDeterministicDiagramSVG),
 * so it's never buried under a player token. A zoomed-in drill packs
 * bigger players into the same small area, and a zone's tactical center
 * (where the label used to sit) is exactly where a player is most likely
 * to be standing. Two mitigations, not one: positioned near the zone's
 * top edge instead of dead-center (less overlap to begin with), AND drawn
 * with a background pill on top of everything (stays legible even on the
 * cases where a player is still underneath it).
 */
function renderZoneLabel(zone: DrawerZone, geometry: Geometry): string {
  if (!zone.label) return "";
  const oriented = orientRect(zone, geometry);
  const x = svgX(oriented.x, geometry);
  const y = svgY(oriented.y, geometry);
  const width = (clamp(oriented.width) / 100) * geometry.fieldW;
  const height = (clamp(oriented.height) / 100) * geometry.fieldH;
  if (width <= 0 || height <= 0) return "";

  const textX = round(x + width / 2);
  const textY = round(y + Math.min(18, height / 2));
  const approxTextWidth = zone.label.length * 6.4 + 14;
  const pillW = round(Math.max(24, Math.min(width - 4, approxTextWidth)));
  const pillH = 17;
  return `<g>
<rect x="${round(textX - pillW / 2)}" y="${round(textY - pillH + 4)}" width="${pillW}" height="${pillH}" rx="4" fill="rgba(8,17,31,0.85)"/>
<text x="${textX}" y="${textY}" text-anchor="middle" font-family="Arial" font-size="11.5" font-weight="800" fill="#d1fae5">${escapeXml(zone.label)}</text>
</g>`;
}

function renderArrow(arrow: DrawerArrow, geometry: Geometry): string {
  // isCoach endpoints must resolve through the SAME projection the coach
  // marker itself uses -- the marker renders outside the field boundary,
  // so using the raw declared coordinate here would draw the arrow ending
  // at a point with no marker, visibly disconnected from the coach.
  const from = arrow.from.isCoach ? resolveCoachPoint(arrow.from, geometry) : toSvgPoint(arrow.from, geometry);
  const to = arrow.to.isCoach ? resolveCoachPoint(arrow.to, geometry) : toSvgPoint(arrow.to, geometry);
  const style = arrowStyle(arrow.type);
  const d = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  return `<path d="${d}" fill="none" stroke="${style.stroke}" stroke-width="${style.width}" stroke-linecap="round"${style.dash ? ` stroke-dasharray="${style.dash}"` : ""} marker-end="url(#${style.marker})"/>`;
}

function renderPlayer(player: DrawerPlayer, geometry: Geometry): string {
  const point = toSvgPoint(player, geometry);
  const palette = playerPalette(player.team);
  const pos = normalizePositionLabel(player);
  const filter = player.team === "gk" ? "" : ` filter="url(#ps)"`;
  const opacity = player.team === "gk" ? "0.38" : "0.12";
  const r = geometry.tokenRadius;
  const glowR = round(r + 2);
  const fontSize = round(Math.max(6, Math.min(10, r * 0.6)));
  return `<g transform="translate(${point.x},${point.y})">
<circle cx="0" cy="0" r="${glowR}" fill="${palette.fill}" opacity="${opacity}"/>
<circle cx="0" cy="0" r="${round(r)}" fill="${palette.fill}" stroke="#020617" stroke-width="2"${filter}/>
<text x="0" y="0" font-family="Arial" font-size="${fontSize}" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="#ffffff">${pos}</text>
</g>`;
}

/** The coach's position on the sideline, with a ball supply icon -- setup
 * steps almost always describe where the coach stands to feed balls, but
 * nothing rendered it before this. */
function renderCoach(coach: DrawerCoach | null, geometry: Geometry): string {
  if (!coach) return "";
  const point = resolveCoachPoint(coach, geometry);
  return `<g transform="translate(${point.x},${point.y})">
<circle cx="0" cy="0" r="11" fill="#eab308" opacity="0.14"/>
<circle cx="0" cy="0" r="9" fill="#eab308" stroke="#78350f" stroke-width="2"/>
<circle cx="10" cy="6" r="4" fill="#f8fafc" stroke="#78350f" stroke-width="1"/>
<text x="0" y="1" font-family="Arial" font-size="9" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="#1c1917">C</text>
<text x="0" y="22" font-family="Arial" font-size="10" font-weight="700" text-anchor="middle" fill="#eab308">${escapeXml(coach.label)}</text>
</g>`;
}

/**
 * Layout is computed in legend-layout.ts (shared with the Gemini prompt --
 * see that file for why both renderers derive from one source instead of
 * each hand-copying their own legend). This just turns the computed items
 * into SVG.
 */
function renderLegend(params: DrawerParams, geometry: Geometry): string {
  // Use the full card panel width (56 to 744), not the narrower inset
  // field width -- the legend sits below the field, not inside its margin,
  // so it has more room available than the field rect itself does.
  const layout = computeLegendLayout(params, 56, geometry.fieldY, 688, geometry.fieldH);
  if (layout.items.length === 0) return "";

  const items = layout.items.map((item) =>
    item.kind === "dot"
      ? `<circle cx="${item.cx}" cy="${item.cy}" r="${item.r}" fill="${item.color}" stroke="#020617" stroke-width="2"/><text x="${item.textX}" y="${item.textY}">${escapeXml(item.label)}</text>`
      : `<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="${item.color}" stroke-width="2"${item.dash ? ` stroke-dasharray="${item.dash}"` : ""}/><text x="${item.textX}" y="${item.textY}">${escapeXml(item.label)}</text>`
  );

  return `<g id="legend" font-family="Arial" font-size="${layout.fontSize}" font-weight="700" fill="#cbd5e1">
${items.join("\n")}
<line x1="${layout.dividerX1}" y1="${layout.dividerY}" x2="${layout.dividerX2}" y2="${layout.dividerY}" stroke="rgba(148,163,184,0.22)"/>
</g>`;
}

function arrowStyle(type: DrawerArrow["type"]): { stroke: string; width: string; dash?: string; marker: string } {
  if (type === "press") return { stroke: "#ef4444", width: "2", dash: "5,3", marker: "mPress" };
  if (type === "counter") return { stroke: "#22c55e", width: "2.5", marker: "mCounter" };
  if (type === "delivery") return { stroke: "#ffffff", width: "2", dash: "4,3", marker: "mDeliver" };
  if (type === "finish") return { stroke: "#fbbf24", width: "2.5", marker: "mFinish" };
  if (type === "run" || type === "movement") return { stroke: "#3b82f6", width: "2", dash: "6,4", marker: "mRun" };
  return { stroke: "#3b82f6", width: "2", marker: "mPass" };
}

function playerPalette(team: DrawerPlayer["team"]): { fill: string } {
  if (team === "away") return { fill: "#ef4444" };
  if (team === "neutral") return { fill: "#f59e0b" };
  if (team === "gk") return { fill: "#22c55e" };
  return { fill: "#3b82f6" };
}

// Ordered so a compound code like "LCB"/"RCB" (left/right center-back) or
// "LCM"/"RCM"/"DCM" (center-mid variants) matches its real base position as
// a substring, instead of falling through to a blind 2-character truncation
// that produced meaningless labels like "LC"/"RC".
const CORE_POSITION_CODES = ["GK", "CB", "LB", "RB", "FB", "WB", "DM", "CM", "AM", "MF", "LM", "RM", "LW", "RW", "CF", "ST", "FW"];

function normalizePositionLabel(player: DrawerPlayer): string {
  if (player.team === "gk") return "GK";
  if (player.team === "neutral") return "NT";
  const normalized = (player.role || player.label || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) return player.team === "away" ? "DF" : "AT";
  if (normalized.includes("KEEPER") || normalized === "GK") return "GK";
  if (normalized.includes("CENTERBACK") || normalized.includes("CENTREBACK")) return "CB";
  if (normalized.includes("FULLBACK")) return "FB";
  if (normalized.includes("DEF")) return "CB";
  if (normalized.includes("MID")) return "CM";
  if (normalized.includes("WING")) return normalized.startsWith("L") ? "LW" : normalized.startsWith("R") ? "RW" : "FW";
  if (normalized.includes("FORWARD") || normalized.includes("STRIKER")) return "ST";
  if (normalized === "LF" || normalized === "RF") return "ST"; // "Left/Right Forward" -- nonstandard but seen in the wild
  const coreCode = CORE_POSITION_CODES.find((code) => normalized.includes(code));
  if (coreCode) return coreCode;
  return normalized.slice(0, 2).padEnd(2, player.team === "away" ? "F" : "T");
}

function deriveFormat(params: DrawerParams): string {
  const attackCount = params.players.filter((player) => player.team === "home" || player.team === "gk").length;
  const defendCount = params.players.filter((player) => player.team === "away").length;
  const neutralCount = params.players.filter((player) => player.team === "neutral").length;
  return `${attackCount}v${defendCount}${neutralCount ? `+${neutralCount}` : ""}`;
}

function toSvgPoint(point: Point, geometry: Geometry): Point {
  const oriented = orientPoint(point, geometry);
  return { x: svgX(oriented.x, geometry), y: svgY(oriented.y, geometry) };
}

function orientPoint(point: Point, geometry: Geometry): Point {
  if (!geometry.rotateVerticalData) return point;
  return {
    x: 100 - clamp(point.y),
    y: clamp(point.x),
  };
}

function orientRect(
  rect: { x: number; y: number; width: number; height: number },
  geometry: Geometry
): { x: number; y: number; width: number; height: number } {
  if (!geometry.rotateVerticalData) return rect;
  return {
    x: 100 - clamp(rect.y + rect.height),
    y: clamp(rect.x),
    width: clamp(rect.height),
    height: clamp(rect.width),
  };
}

function svgX(percent: number, geometry: Geometry): number {
  return round(geometry.fieldX + (clamp(percent) / 100) * geometry.fieldW);
}

function svgY(percent: number, geometry: Geometry): number {
  return round(geometry.fieldY + (clamp(percent) / 100) * geometry.fieldH);
}

const COACH_OFFSET_X = 40;
const COACH_OFFSET_Y = 26;

/**
 * The coach must never sit inside the marked practice area -- coaches
 * stand on the sideline, outside the cones. toSvgPoint() (used for
 * players) maps 0-100 straight into the field interior, so the coach
 * needs its own projection: find which edge the raw coordinate is
 * closest to, keep its position along that edge, and push it out into
 * the field margin instead of onto the field itself.
 *
 * x is the length axis (0=deep start, 100=DEF's goal) and y is the width
 * axis, so the real sidelines are the TOP/BOTTOM edges (lines of constant
 * y running the full length) -- left/right are the goal-line edges. A
 * coach positioned behind a goal line is essentially never correct in
 * real coaching practice, so top/bottom is preferred unless the raw
 * coordinate is clearly, meaningfully closer to a goal-line edge than to
 * either sideline (plain nearest-edge treated all 4 edges as equally
 * likely, which mis-projected sideline-intended coordinates to a
 * goal-line edge whenever x happened to be marginally smaller than y).
 */
function resolveCoachPoint(coach: Point, geometry: Geometry): Point {
  const oriented = orientPoint(coach, geometry);
  const x = clamp(oriented.x);
  const y = clamp(oriented.y);
  const goalLineDist = Math.min(x, 100 - x);
  const sidelineDist = Math.min(y, 100 - y);
  const GOAL_LINE_MARGIN = 12;
  const nearest: "left" | "right" | "top" | "bottom" =
    goalLineDist + GOAL_LINE_MARGIN < sidelineDist ? (x <= 100 - x ? "left" : "right") : (y <= 100 - y ? "top" : "bottom");

  if (nearest === "left") return { x: geometry.fieldX - COACH_OFFSET_X, y: svgY(y, geometry) };
  if (nearest === "right") return { x: geometry.fieldX + geometry.fieldW + COACH_OFFSET_X, y: svgY(y, geometry) };
  if (nearest === "top") return { x: svgX(x, geometry), y: geometry.fieldY - COACH_OFFSET_Y };
  return { x: svgX(x, geometry), y: geometry.fieldY + geometry.fieldH + COACH_OFFSET_Y };
}

function splitTitleLines(title: string): [string, string?] {
  const maxLength = 42;
  if (title.length <= maxLength) return [title];
  const words = title.split(/\s+/);
  const lines = [""];
  for (const word of words) {
    const active = lines[lines.length - 1];
    const candidate = active ? `${active} ${word}` : word;
    if (candidate.length <= maxLength || lines.length === 2) {
      lines[lines.length - 1] = candidate;
    } else {
      lines.push(word);
    }
  }
  if (lines[1] && lines[1].length > maxLength) lines[1] = `${lines[1].slice(0, maxLength - 3).trim()}...`;
  return [lines[0], lines[1]];
}

function humanizeFieldFormat(value: string): string {
  return value.toLowerCase(); // "7V7" -> "7v7"
}

function humanizeText(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\b(Fc|Gk|Cb|Lb|Rb|Dm|Cm|Lm|Rm|Lw|Rw|St|Rpe)\b/g, (match) => match.toUpperCase());
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
