import type { DrawerParams } from "../types/drawer";
import { computeTokenRadius, shouldZoomOut } from "../data/field-dimensions";
import { computeLegendLayout } from "../services/legend-layout";

// Must match the FIELD rect used throughout this prompt (see FIELD section).
// FIELD_Y moved up from 239.38 -- the diagram no longer draws its own
// title/type/duration header (every page that shows this diagram already
// renders that as real HTML next to it, so the picture was repeating it as
// unselectable pixels for no reason). Removing the header freed the space
// above the field entirely, rather than just deleting text and leaving a
// blank gap -- see the matching canvas height reduction (800x760 -> 800x595)
// below.
const FIELD_Y = 74.38;
const FIELD_H = 313.24;

export const DRAWER_PROMPT_VERSION = "v46-one-token";

export function buildDrawerPrompt(params: DrawerParams): string {
  return DRAWER_PROMPT_TEMPLATE.replace("{{DIAGRAM_DATA}}", serializeDrillData(params));
}

function serializeDrillData(p: DrawerParams): string {
  const attackCount = p.players.filter((player) => player.team === "home" || player.team === "gk").length;
  const defendCount = p.players.filter((player) => player.team === "away").length;
  const neutralCount = p.players.filter((player) => player.team === "neutral").length;
  const format = p.format || `${attackCount}v${defendCount}${neutralCount ? `+${neutralCount}` : ""}`;
  const title = humanizeText(p.title);
  const titleLines = splitTitleLines(title);
  const homeDirection = inferHomeAttackDirection(p);
  const shouldInferGoalkeepers = shouldInferImplicitGoalkeepers(p);
  const hasExplicitKeeper = p.players.some((player) => player.team === "gk");
  const inferMissingKeeper = shouldInferGoalkeepers && !hasExplicitKeeper;
  const homeLabels = buildDirectionAwareLabels(
    p.players.filter((player) => player.team === "home"),
    homeDirection,
    inferMissingKeeper
  );
  const awayLabels = buildDirectionAwareLabels(
    p.players.filter((player) => player.team === "away"),
    oppositeDirection(homeDirection),
    inferMissingKeeper
  );
  // Explicit from generation input when available -- see DrillPromptInput.fieldFormat.
  const zoomOut =
    shouldZoomOut(p.widthYards, p.lengthYards, p.fieldFormat) || Boolean(p.hideMatchPitchMarkings);
  const tokenRadius = computeTokenRadius(p.widthYards, p.lengthYards, p.fieldFormat, p.players.length);
  const lines: string[] = [
    `Title: ${title}`,
    `Title line 1: ${titleLines[0]}`,
    ...(titleLines[1] ? [`Title line 2: ${titleLines[1]}`] : []),
    `Type: ${humanizeText(p.drillType)}`,
    `Format: ${format}`,
    `Attack count: ${attackCount}`,
    `Defend count: ${defendCount}`,
    `Duration: ${p.durationMin}min`,
    `RPE: ${p.rpeMin}-${p.rpeMax}`,
    `Field: ${p.widthYards}x${p.lengthYards}yd`,
    `MatchFormat: ${p.fieldFormat ? p.fieldFormat.toLowerCase() : ""}`,
    `TokenRadius: ${Math.round(tokenRadius * 100) / 100}`,
    `Zoom: ${zoomOut ? "OUT (small practice area relative to a real " + p.fieldFormat + " pitch -- do NOT draw halfway line or center circle)" : "IN (practice area fills most of a real " + p.fieldFormat + " pitch -- draw halfway line and center circle)"}`,
    `Phase: ${p.phase ? humanizeText(p.phase) : ""}`,
    `GameModel: ${p.gameModelId ? humanizeText(p.gameModelId) : ""}`,
    `Zone: ${p.zone ? humanizeText(p.zone) : ""}`,
    `Formations: ${p.formationAttacking || p.formationDefending ? `ATT ${p.formationAttacking || "?"} vs DEF ${p.formationDefending || "?"}` : ""}`,
    "",
    "Players (x/y are 0-100 percentages, convert to SVG coords):",
    ...p.players.map((player) =>
      `  ${player.team} pos=${getDirectionAwarePositionLabel(player, homeLabels, awayLabels)} role="${player.role || ""}" at x=${player.x} y=${player.y}${player.label ? ` label="${player.label}"` : ""}`
    ),
    "",
    p.coach ? `Coach: at x=${p.coach.x} y=${p.coach.y} label="${p.coach.label}". Draw the coach marker per the COACH section below.` : "Coach: none specified -- do not draw a coach marker.",
    "",
    "Goals are intentionally omitted from this prompt. The API overlays exact goal geometry after SVG generation.",
    "",
    "Arrows:",
    ...p.arrows.map((arrow, index) => {
      const fromStr = arrow.from.isCoach ? "COACH (see COACH section for actual position)" : `(${arrow.from.x},${arrow.from.y})`;
      const toStr = arrow.to.isCoach ? "COACH (see COACH section for actual position)" : `(${arrow.to.x},${arrow.to.y})`;
      return `  ${index + 1}. ${arrow.type} from ${fromStr} to ${toStr}${arrow.label ? ` label="${arrow.label}"` : ""}`;
    }),
    "",
    "Zones:",
    ...p.zones.map((zone) =>
      `  ${zone.label ?? "zone"} x=${zone.x} y=${zone.y} w=${zone.width} h=${zone.height}${zone.team ? ` team=${zone.team}` : ""}`
    ),
    "",
    "Field annotations:",
    ...p.annotations.map((annotation, index) =>
      `  ${index + 1}. "${annotation.text}" at x=${annotation.x} y=${annotation.y}${annotation.color ? ` color=${annotation.color}` : ""}`
    ),
    "",
    "Do not render coaching points, coaching picture text, an annotation rail, or black annotation pills. Field annotations are context only.",
    "",
    ...(() => {
      // Full card panel width (56 to 744), not the narrower inset field
      // width -- the legend sits below the field, not inside its margin.
      const legend = computeLegendLayout(p, 56, FIELD_Y, 688, FIELD_H);
      if (legend.items.length === 0) return ["Legend items: none -- do not draw a legend."];
      return [
        "Legend items (draw EXACTLY these, at these exact computed coordinates -- do not invent, omit, reorder, or recompute positions for any of them):",
        ...legend.items.map((item, i) =>
          item.kind === "dot"
            ? `  ${i + 1}. dot cx=${item.cx} cy=${item.cy} r=${item.r} color=${item.color} text="${item.label}" at x=${item.textX} y=${item.textY}`
            : `  ${i + 1}. line x1=${item.x1} y1=${item.y1} x2=${item.x2} y2=${item.y2} color=${item.color}${item.dash ? ` dash=${item.dash}` : ""} text="${item.label}" at x=${item.textX} y=${item.textY}`
        ),
        `Legend divider: line x1=${legend.dividerX1} y1=${legend.dividerY} x2=${legend.dividerX2} y2=${legend.dividerY} stroke="rgba(148,163,184,0.22)"`,
      ];
    })(),
  ];
  return lines.join("\n");
}

type AttackDirection = "left" | "right";

function inferHomeAttackDirection(p: DrawerParams): AttackDirection {
  const home = p.players.filter((player) => player.team === "home" || player.team === "gk");
  const away = p.players.filter((player) => player.team === "away");
  if (home.length && away.length) {
    const homeAvg = average(home.map((player) => player.x));
    const awayAvg = average(away.map((player) => player.x));
    return awayAvg < homeAvg ? "left" : "right";
  }

  const homeGoal = p.goals.find((goal) => goal.x <= 10 || goal.x >= 90);
  if (homeGoal) return homeGoal.x <= 10 ? "right" : "left";
  return "right";
}

function oppositeDirection(direction: AttackDirection): AttackDirection {
  return direction === "left" ? "right" : "left";
}

function shouldInferImplicitGoalkeepers(p: DrawerParams): boolean {
  const hasMiniGoals = p.goals.some((goal) => goal.type === "mini" || goal.type === "gate");
  const fullGoalCount = p.goals.filter((goal) => goal.type === "full").length;
  if (hasMiniGoals || fullGoalCount < 2) return false;

  const text = `${p.format} ${p.drillType} ${p.title}`.toLowerCase();
  return /\b[5-9]\s*v\s*[5-9]\b/.test(text)
    || text.includes("game")
    || text.includes("phase")
    || text.includes("11v11")
    || text.includes("9v9")
    || text.includes("7v7");
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function buildDirectionAwareLabels(
  players: DrawerParams["players"],
  direction: AttackDirection,
  inferGoalkeeper: boolean
): Map<string, string> {
  const labels = new Map<string, string>();
  const fieldPlayers = players.filter((player) => player.team !== "gk");
  if (fieldPlayers.length === 0) return labels;

  if (inferGoalkeeper && fieldPlayers.length >= 5) {
    const goalkeeper = findDeepestOwnGoalPlayer(fieldPlayers, direction);
    labels.set(goalkeeper.id, "GK");
  }

  const sortedByAttackDepth = [...fieldPlayers].sort((a, b) =>
    direction === "right" ? b.x - a.x : a.x - b.x
  );
  const count = sortedByAttackDepth.length;
  sortedByAttackDepth.forEach((player, index) => {
    if (labels.has(player.id)) return;
    const depthRank = count === 1 ? 0 : index / (count - 1);
    const side = getDirectionRelativeSide(player.y, direction);
    const raw = normalizePositionLabel(player.role, player.team);

    if (depthRank <= 0.22) {
      labels.set(player.id, side === "left" ? "LW" : side === "right" ? "RW" : raw === "CF" ? "CF" : "ST");
      return;
    }
    if (depthRank <= 0.68) {
      labels.set(player.id, side === "left" ? "LM" : side === "right" ? "RM" : raw === "AM" || raw === "DM" ? raw : "CM");
      return;
    }
    labels.set(player.id, side === "left" ? "LB" : side === "right" ? "RB" : "CB");
  });

  return labels;
}

function findDeepestOwnGoalPlayer(
  players: DrawerParams["players"],
  direction: AttackDirection
): DrawerParams["players"][number] {
  const ownGoalDepth = direction === "right"
    ? Math.min(...players.map((player) => player.x))
    : Math.max(...players.map((player) => player.x));
  const deepestBand = players.filter((player) => Math.abs(player.x - ownGoalDepth) <= 8);
  return deepestBand.sort((a, b) => Math.abs(a.y - 50) - Math.abs(b.y - 50))[0] ?? players[0];
}

function getDirectionRelativeSide(y: number, direction: AttackDirection): "left" | "right" | "central" {
  if (y >= 38 && y <= 62) return "central";
  const pageSide = y < 38 ? "top" : "bottom";
  if (direction === "right") return pageSide === "top" ? "left" : "right";
  return pageSide === "top" ? "right" : "left";
}

function getDirectionAwarePositionLabel(
  player: DrawerParams["players"][number],
  homeLabels: Map<string, string>,
  awayLabels: Map<string, string>
): string {
  if (player.team === "gk") return "GK";
  if (player.team === "neutral") return "NT";
  const fromRole = normalizePositionLabel(player.role, player.team);
  if (player.role.trim() && fromRole !== "AT" && fromRole !== "DF") {
    return fromRole;
  }
  return (player.team === "away" ? awayLabels : homeLabels).get(player.id) ?? fromRole;
}

function normalizePositionLabel(role: string, team: DrawerParams["players"][number]["team"]): string {
  const normalized = role.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (team === "neutral") return "NT";
  if (team === "gk" || normalized === "GK" || normalized.includes("GOAL")) return "GK";

  const direct = new Set([
    "CB", "LB", "RB", "DM", "CM", "AM", "LM", "RM", "LW", "RW", "ST", "CF",
    "GK", "FB", "WB", "MF", "FW",
  ]);
  if (direct.has(normalized)) return normalized.slice(0, 2);
  if (normalized.includes("KEEPER")) return "GK";
  if (normalized.includes("CENTERBACK") || normalized.includes("CENTREBACK")) return "CB";
  if (normalized.includes("FULLBACK")) return "FB";
  if (normalized.includes("DEF") || normalized === "D") return "CB";
  if (normalized.includes("MID") || normalized === "M") return "CM";
  if (normalized.includes("WING")) return normalized.startsWith("L") ? "LW" : normalized.startsWith("R") ? "RW" : "FW";
  if (normalized.includes("FORWARD") || normalized.includes("STRIKER") || normalized === "F") return "ST";
  if (normalized === "LF" || normalized === "RF") return "ST"; // "Left/Right Forward" -- nonstandard but seen in the wild
  // Compound codes like "LCB"/"RCB" (left/right center-back) or "LCM"/"RCM"
  // must collapse to their base position ("CB"/"CM"), not truncate to their
  // first two letters ("LC"/"RC" isn't a real position).
  const coreCode = [...direct].find((code) => normalized.includes(code));
  if (coreCode) return coreCode;
  if (normalized.length >= 2) return normalized.slice(0, 2);
  return team === "away" ? "DF" : "AT";
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

function splitTitleLines(title: string): [string, string?] {
  const maxLength = 42;
  if (title.length <= maxLength) return [title];

  const words = title.split(" ");
  const lines: string[] = [""];
  for (const word of words) {
    const active = lines[lines.length - 1];
    const candidate = active ? `${active} ${word}` : word;
    if (candidate.length <= maxLength || lines.length === 2) {
      lines[lines.length - 1] = candidate;
      continue;
    }
    lines.push(word);
  }

  if (lines[1] && lines[1].length > maxLength) {
    lines[1] = `${lines[1].slice(0, maxLength - 3).trim()}...`;
  }
  return [lines[0], lines[1]];
}

const DRAWER_PROMPT_TEMPLATE = `
Output raw SVG code for a football coaching drill diagram.
No explanation. No markdown. No \`\`\`svg fences.
Output ONLY the raw SVG starting with <svg and ending with </svg>.

The diagram must be a flat top-down tactical board. Do not use perspective, broadcast-style
camera angles, 3D depth, team-sheet layouts, or decorative black callout pills.

CRITICAL VALIDITY RULE:
Every SVG attribute value must be quoted XML. Never output unquoted attributes.
Correct:   fill="#ffffff"  stroke="none"  x="0"
Incorrect: fill=#ffffff    stroke=none    x=0

CANVAS AND CARD
Use exactly: <svg viewBox="0 0 800 595" xmlns="http://www.w3.org/2000/svg">
Do NOT draw the background rect yourself -- the API injects it, along with <defs> (see DEFS below). Start your own drawing from the FIELD content.
The whole output is one TacticalEdge-style diagram card. Do not draw an outer rounded card; the web app supplies the container.
Do NOT draw a title, drill type, duration, or any other text header -- the page displaying this diagram already renders that as real HTML next to it. This diagram is the tactical picture only: field, players, arrows, goals, zones, coach, legend.

FIELD - always landscape, same orientation and same size:
Field rect is x="117.92" y="74.38" width="564.16" height="313.24" (this is inset ~18% within the card's field panel, x="56" y="40" width="688" height="382" -- that panel margin stays empty/background-colored so the practice area has visible breathing room instead of running flush to the card edge. This margin must be wide enough for the coach marker to sit fully outside the field rect -- see COACH below).
Do NOT draw the field fill, field border, or corner cones yourself -- the API injects all of them at the exact coordinates above, in the same single flat color (#1c5134) every time. Nothing -- not even the coach -- may be drawn inside the field boundary except players, goals, zones, and arrows that belong on the field.
Halfway line and center circle: draw ONLY if Zoom is IN (see DRILL DATA). If Zoom is OUT, do not draw them -- a small practice grid has no real halfway point. When drawn: Center line: line x1="400" y1="74.38" x2="400" y2="387.62" stroke="rgba(255,255,255,0.42)" stroke-width="1.5". Center circle: circle cx="400" cy="231" r="43.85" fill="none" stroke="rgba(255,255,255,0.38)" stroke-width="1.5". Center spot: circle cx="400" cy="231" r="3" fill="rgba(255,255,255,0.55)".
Do not draw penalty area boxes at all. The API overlays a penalty box after generation, only next to edges that actually have a real full-size goal -- drawing them here would show a penalty box even on mini-goal or goal-less edges. Top/bottom penalty boxes are never used. If full goals are present, draw the goal on the nearest left or right field edge, not above or below the field.
Dimension labels: draw the real practice area size using the Field line from DRILL DATA ("{width}x{length}yd"). Above the field: line x1="117.92" y1="62.38" x2="682.08" y2="62.38" stroke="rgba(255,255,255,0.35)" stroke-width="1", with text (length in yards, e.g. "40 yds") centered at x="400" y="54.38" font-size="12" font-weight="700" fill="rgba(255,255,255,0.6)". Left of the field: line x1="105.92" y1="74.38" x2="105.92" y2="387.62" stroke="rgba(255,255,255,0.35)" stroke-width="1", with text (width in yards, e.g. "30 yds") rotated -90 degrees and centered at the line's midpoint, same font style.

Zone reference bar: only draw if Zone from DRILL DATA is one of "Defensive Third", "Middle Third", or "Attacking Third" (skip entirely otherwise). This is a small "which third of the real pitch is this drill in" legend -- three 44x12 segments starting at x=550.08 y=50.38, left to right: Attacking 3rd (x=550.08), Mid 3rd (x=594.08), DEF 3rd (x=638.08). Each segment is a rect (width=44, height=12) immediately followed by a centered text label inside it (font-size=6.5, font-weight=800, y = segment y + 9.5). The segment matching DRILL DATA's Zone is highlighted: fill="#10f0a0" stroke="#10f0a0" stroke-width="1" text fill="#08111f"; the other two are inactive: fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" stroke-width="1" text fill="rgba(255,255,255,0.45)". This does NOT reposition the practice area or change any player/goal coordinates -- it's a separate small legend, not a change to the field itself.

COORDINATE CONVERSION
Player, goal, zone, and arrow positions are percentages from 0-100.
The rendered field is always horizontal. If the drill data describes goals near y=0 or y=100
instead of x=0 or x=100, rotate all drill coordinates clockwise before drawing:
  rotatedX = 100 - y
  rotatedY = x
Use rotated coordinates for players, goals, arrows, zones, and labels. This maps top goals
to the right edge and bottom goals to the left edge, with the whole drill shape rotated together.
Convert to SVG pixels using:
  svgX = 117.92 + (x / 100) * 564.16
  svgY = 74.38 + (y / 100) * 313.24
Keep everything inside the field. Clamp labels and arrows so they do not enter the legend.
Do not rearrange players into a standard formation.
Do not move players based on role names like ST, GK, or CB.
Use the x/y coordinates exactly as provided. If the data has the attacking team going right-to-left, keep the striker/forward on the data-provided left side.
Never mirror the field unless the x/y data itself is mirrored.
Left/right position labels are relative to the team's attacking direction, not the page.
If a team attacks left, the team's right side is toward the top of the SVG and the team's left side is toward the bottom of the SVG.
If a team attacks right, the team's right side is toward the bottom of the SVG and the team's left side is toward the top of the SVG.
In game formats like 7v7, 9v9, or 11v11 with two full goals, each team should have a goalkeeper. If DRILL DATA already lists pos=GK player lines, those are the only keepers -- draw them green, and never relabel a blue or red outfield player as GK. If a team has no explicit GK role and both goals are full goals, the deepest player nearest that team's own goal is labelled GK.
Mini goals and gates never have a goalkeeper. If every goal is mini or gate, no player is a GK: do not use the green GK token, do not label anyone GK, and do not put GK in the legend. Relabel any leftover GK roles as CB. Only players explicitly listed as pos=GK should be labelled GK in one-full-goal + mini-goal layouts, and only on the full-goal side.

DEFS: Do NOT write a <defs> block yourself -- omit it entirely from your output, right after the opening <svg> tag. The API injects it automatically after generation, with these ids already available for you to reference elsewhere in your output: filter id="ps" (drop shadow, use as filter="url(#ps)" on player tokens), and markers id="mPass"/"mRun"/"mPress"/"mCounter"/"mDeliver"/"mFinish" (arrowheads, colored per arrow type -- use as marker-end="url(#mPass)" etc. per the ARROWS section below). Reference these ids freely; do not redefine them.

PLAYER COLORS - match existing renderer exactly:
home / ATT:   fill="#3b82f6" stroke="#2563eb"
away / DEF:   fill="#ef4444" stroke="#dc2626"
gk:           fill="#22c55e" stroke="#16a34a" opacity="0.6" on glow and circle, no filter
neutral:      fill="#f59e0b" stroke="#d97706"
All text:     fill="#ffffff"

PLAYER TOKEN - draw these 4 elements in order for every player:
Each player must be one <g> group at the converted coordinate. The token text must be inside that same group.
Token size is NOT fixed -- use the TokenRadius value from DRILL DATA (R below), computed from this drill's actual yards-to-pixels scale so a tight practice grid shows proportionally bigger players than a full-size field does, instead of every drill rendering players at the same pixel size regardless of real-world scale. Glow radius = R+2. Font size = clamp(R*0.6, 6, 10).
Required exact structure for every player (R = TokenRadius, G = R+2, F = clamped font size, computed per DRILL DATA -- do not use fixed numbers):
<g transform="translate(X,Y)">
  <circle cx="0" cy="0" r="G" fill="FILL" opacity="0.12"/>
  <circle cx="0" cy="0" r="R" fill="FILL" stroke="#020617" stroke-width="2" filter="url(#ps)"/>
  <text x="0" y="0" font-family="Arial" font-size="F" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="#ffffff">POS</text>
</g>

The POS text is mandatory for every player. Do not omit it.
Use the provided pos= value from the player line. Position labels must be exactly 2 characters. Examples: GK, CB, LB, RB, DM, CM, AM, LW, RW, ST, CF, NT.
Never output 1-character labels like M, F, or D.
Never draw position labels as standalone text at the top, bottom, or outside the player circle.
Never draw position labels outside their token group.
ONE TOKEN PER PLAYER LINE. Count the player lines in DRILL DATA. Draw exactly that many player <g> groups -- no more, no fewer.
Never clone a player at an arrow endpoint. A pass/run/press arrow is a line only; the receiver is already listed as their own player line if they exist.
Never draw ghost, start-frame, end-frame, or animation-duplicate tokens. If two circles would share a label near the same spot, you have over-drawn -- delete the extra.
The number of player <text> labels inside token groups must equal the number of player lines in DRILL DATA.

GK: use opacity="0.38" on glow and circle. Remove filter. Label goalkeeper tokens as "GK".
Do not use player numbers as the main token label unless no role/team fallback exists.
neutral label: use "NT" for neutral players.

COACH
The coach stands on the sideline, OUTSIDE the marked practice area -- never inside the field rect, never on top of the field fill or overlapping the field border. If DRILL DATA says "Coach: none specified", do not draw a coach marker at all. Otherwise, compute its position like this:
1. Take the Coach line's x/y from DRILL DATA and apply the same rotation as COORDINATE CONVERSION if applicable, giving oriented x/y in 0-100.
2. Find which edge it's nearest to. x is the length axis (goal-to-goal) and y is the width axis, so the real sidelines are the TOP/BOTTOM edges, not left/right (left/right are the goal-line edges, and a coach standing behind a goal line is essentially never correct). Compute goalLineDist = min(x, 100-x) and sidelineDist = min(y, 100-y). Only pick left/right if goalLineDist + 12 < sidelineDist (i.e. clearly, meaningfully closer to a goal line); otherwise pick top (if y <= 100-y) or bottom (otherwise). This biases ambiguous/corner coordinates toward a sideline placement, matching real coaching practice.
3. Compute X,Y using the field rect (x="117.92" y="74.38" width="564.16" height="313.24") like this:
   - Nearest = left:   X = 117.92 - 40,            Y = 74.38 + (y/100)*313.24
   - Nearest = right:  X = 117.92 + 564.16 + 40,   Y = 74.38 + (y/100)*313.24
   - Nearest = top:    X = 117.92 + (x/100)*564.16, Y = 74.38 - 26
   - Nearest = bottom: X = 117.92 + (x/100)*564.16, Y = 74.38 + 313.24 + 26
   This deliberately does NOT use the normal player coordinate conversion -- that would place the coach inside the field, which is wrong.
4. Draw at the computed X,Y:
<g transform="translate(X,Y)">
  <circle cx="0" cy="0" r="11" fill="#eab308" opacity="0.14"/>
  <circle cx="0" cy="0" r="9" fill="#eab308" stroke="#78350f" stroke-width="2"/>
  <circle cx="10" cy="6" r="4" fill="#f8fafc" stroke="#78350f" stroke-width="1"/>
  <text x="0" y="1" font-family="Arial" font-size="9" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="#1c1917">C</text>
  <text x="0" y="22" font-family="Arial" font-size="10" font-weight="700" text-anchor="middle" fill="#eab308">LABEL</text>
</g>
Replace LABEL with the Coach line's label text. The small white circle is a ball supply icon.

GOALS
Do not draw goals at all. Goal outlines are added by the API after generation using exact diagram data.
Do not invent full goals, mini goals, gates, goal nets, goal boxes, or triangular goal shapes.

ARROWS - if an arrow's from or to is "COACH" (see the Arrows list above), that endpoint's pixel coordinate is the COACH section's computed X,Y (steps 1-3 there), NOT a normal coordinate-conversion of any x/y number. The coach marker renders outside the field boundary -- using a normal in-field coordinate for a coach-linked arrow would draw it disconnected from the marker.
ARROWS - use <path> fill="none":
pass:      stroke="#3b82f6" stroke-width="2"                         marker-end="url(#mPass)"
run:       stroke="#3b82f6" stroke-width="2" stroke-dasharray="6,4"  marker-end="url(#mRun)"
movement:  stroke="#3b82f6" stroke-width="2" stroke-dasharray="6,4"  marker-end="url(#mRun)"
press:     stroke="#ef4444" stroke-width="2" stroke-dasharray="5,3"  marker-end="url(#mPress)"
counter:   stroke="#22c55e" stroke-width="2.5"                       marker-end="url(#mCounter)"
delivery:  stroke="#ffffff" stroke-width="2" stroke-dasharray="4,3"  marker-end="url(#mDeliver)"
finish:    stroke="#fbbf24" stroke-width="2.5"                       marker-end="url(#mFinish)"
Draw a numbered sequence badge at each arrow midpoint.

ZONES
For each zone convert x/y/width/height from percentages to SVG pixels.
Render the zone as a translucent rectangle with a dashed border: fill="#10f0a0" opacity="0.11" stroke="#10f0a0" stroke-width="1.5" stroke-dasharray="7,5". Draw this rect in the ZONE BACKGROUNDS step of DRAW ORDER (early, with the field), NOT with the label.
If a zone has a label, the label text is mandatory but is drawn SEPARATELY, in the ZONE LABELS step of DRAW ORDER (near the very end, after players and coach). A zoomed-in drill packs bigger players into a small area, and a zone's tactical center is exactly where a player is most likely to be standing -- drawing the label late, on top of everything, is how it stays legible instead of getting buried under a token. Position: horizontally centered in the zone, but near the zone's TOP edge (18px below the zone's top, or the zone's vertical center if the zone is shorter than 36px tall) rather than dead-center -- less overlap to begin with. Structure (X,Y = the computed label position, W = zone width in px, L = the label text):
<g>
<rect x="{X - pillW/2}" y="{Y - 13}" width="{pillW}" height="17" rx="4" fill="rgba(8,17,31,0.85)"/>
<text x="{X}" y="{Y}" text-anchor="middle" font-family="Arial" font-size="11.5" font-weight="800" fill="#d1fae5">{L}</text>
</g>
where pillW = clamp(L.length * 6.4 + 14, 24, W - 4).

FIELD ANNOTATIONS
Do not render field annotations as labels or callouts. They are planning context only.
Do not render a side panel, annotation rail, coaching points list, coaching picture text,
or any extra label pills beyond the zone-label pill specified above. The diagram should
prioritize player positions, arrows, zones, and goals.

LEGEND - always include under the field, unless DRILL DATA says "Legend items: none"
Draw EXACTLY the items listed under "Legend items" in DRILL DATA, at their exact given coordinates -- do not invent your own Attack/Defend/Pass/Run/Press set, do not omit any listed item, do not add items not listed (this list already reflects exactly which teams and arrow types this specific drill uses). For each dot item: circle cx={cx} cy={cy} r={r} fill={color} stroke="#020617" stroke-width="2", then text at x/y font-size="15" font-weight="700" fill="#cbd5e1". For each line item: line x1/y1/x2/y2 stroke={color} stroke-width="2" (add stroke-dasharray={dash} only if dash is given), then text at x/y, same font style. Finally draw the Legend divider line exactly as given.

NEVER DRAW
Do not draw coaching points.
Do not draw a right-side annotation rail.
Do not draw a coaching picture sentence.
Do not put a black sidebar next to the field.
Do not draw a second labeled player to show where a run or pass ends. That is the arrow's job.

DRAW ORDER:
1. background 2. defs 3. field fill 4. field border (all four of these are injected by the API, not drawn by you -- see CANVAS AND CARD / FIELD / DEFS above) 5. field lines
(dimension labels + zone reference bar, both in the margin, never covered by anything)
6. zone backgrounds (rect only, no label) 7. goals 8. arrows 9. players
10. coach 11. zone labels (pill + text, drawn last of the field content so
they're never hidden under a player) 12. legend
Draw player token groups after arrows so token labels remain visible on top of all lines.
Zone labels must be the LAST thing drawn on the field itself -- after players and the
coach, before the legend.

DRILL DATA:
{{DIAGRAM_DATA}}
`.trim();
