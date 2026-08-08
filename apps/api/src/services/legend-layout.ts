import type { DrawerArrow, DrawerParams, DrawerPlayer } from "../types/drawer";

/**
 * Legend layout, computed once and shared by both renderers (deterministic
 * SVG and the Gemini prompt). Previously each renderer had its own
 * hand-copied legend: fixed to exactly Attack/Defend/Pass/Run/Press
 * regardless of what a drill's diagram actually contains (a GK, neutrals,
 * or counter/delivery/finish arrows had no explanation anywhere on the
 * card), and the Press swatch didn't even match the real press-arrow style
 * (wrong color, no dash). Computing this in one place, from the same
 * data/colors the real rendering uses, makes both problems structurally
 * impossible to reintroduce.
 *
 * The Gemini path gets the fully pre-computed item list (literal
 * coordinates, not a layout algorithm to run itself) for the same reason
 * goal geometry is computed in code and handed to the model as fixed
 * facts: asking an LLM to reliably compute a wrapping-row layout is the
 * exact class of numeric-reasoning task this whole diagram pipeline has
 * been moving OFF the model and into deterministic code.
 */

// Mirrors playerPalette() in deterministic-drawer-svg.ts. Keep in sync --
// there is no compile-time link between them (duplicated to avoid a
// circular import), but a mismatch means the legend lies about the field.
const TEAM_COLORS: Record<DrawerPlayer["team"], string> = {
  home: "#3b82f6",
  away: "#ef4444",
  gk: "#22c55e",
  neutral: "#f59e0b",
};

// Mirrors arrowStyle() in deterministic-drawer-svg.ts (stroke/dash only --
// the legend doesn't need width/marker). Keep in sync for the same reason.
const ARROW_COLORS: Record<DrawerArrow["type"], { color: string; dash?: string }> = {
  pass: { color: "#3b82f6" },
  run: { color: "#3b82f6", dash: "6,4" },
  movement: { color: "#3b82f6", dash: "6,4" },
  press: { color: "#ef4444", dash: "5,3" },
  counter: { color: "#22c55e" },
  delivery: { color: "#ffffff", dash: "4,3" },
  finish: { color: "#fbbf24" },
};

const TEAM_LEGEND_ORDER: Array<{ team: DrawerPlayer["team"]; label: string }> = [
  { team: "home", label: "Attack" },
  { team: "away", label: "Defend" },
  { team: "gk", label: "GK" },
  { team: "neutral", label: "Neutral" },
];

// "run" and "movement" share identical rendering, so they collapse to one
// "Run" chip instead of showing two visually-identical entries.
const ARROW_LEGEND_ORDER: Array<{ types: DrawerArrow["type"][]; label: string }> = [
  { types: ["pass"], label: "Pass" },
  { types: ["run", "movement"], label: "Run" },
  { types: ["press"], label: "Press" },
  { types: ["counter"], label: "Counter" },
  { types: ["delivery"], label: "Delivery" },
  { types: ["finish"], label: "Finish" },
];

type LegendChip =
  | { kind: "dot"; color: string; label: string }
  | { kind: "line"; color: string; dash?: string; label: string };

export type LegendLayoutItem =
  | { kind: "dot"; cx: number; cy: number; r: number; color: string; textX: number; textY: number; label: string }
  | {
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      dash?: string;
      textX: number;
      textY: number;
      label: string;
    };

export interface LegendLayout {
  items: LegendLayoutItem[];
  dividerX1: number;
  dividerX2: number;
  dividerY: number;
  fontSize: number;
}

// Base (unscaled) sizing. If the full chip set doesn't fit in the
// available width at these sizes, everything scales down together (font,
// gaps, swatches) to guarantee a single row -- see MIN_SCALE below for the
// floor where scaling stops and a chip set that large would need a design
// decision, not a fix (in practice: 2-4 team chips + 3-4 arrow chips, the
// realistic range, always fits at or near full size).
const BASE_FONT_SIZE = 15;
const BASE_GAP_AFTER_CHIP = 26;
const BASE_SWATCH_TO_TEXT_GAP = 10;
const BASE_DOT_SWATCH = 14;
const BASE_LINE_SWATCH = 36;
const BASE_CHAR_WIDTH = 8.4; // ~= BASE_FONT_SIZE * 0.56, Arial Bold average
const MIN_SCALE = 0.72; // below this, text stops being comfortably legible

export function computeLegendLayout(
  params: DrawerParams,
  fieldX: number,
  fieldY: number,
  fieldW: number,
  fieldH: number
): LegendLayout {
  const teamChips: LegendChip[] = TEAM_LEGEND_ORDER.map(({ team, label }): LegendChip | null => {
    const count = params.players.filter((p) => p.team === team).length;
    if (count === 0) return null;
    return { kind: "dot", color: TEAM_COLORS[team], label: `${label} (${count})` };
  }).filter((c): c is LegendChip => c !== null);

  const usedArrowTypes = new Set(params.arrows.map((a) => a.type));
  const arrowChips: LegendChip[] = ARROW_LEGEND_ORDER.map(({ types, label }): LegendChip | null => {
    const matchedType = types.find((t) => usedArrowTypes.has(t));
    if (!matchedType) return null;
    const style = ARROW_COLORS[matchedType];
    return { kind: "line", color: style.color, dash: style.dash, label };
  }).filter((c): c is LegendChip => c !== null);

  const chips = [...teamChips, ...arrowChips];
  const startX = fieldX;
  const maxX = fieldX + fieldW;

  if (chips.length === 0) {
    return { items: [], dividerX1: startX, dividerX2: maxX, dividerY: round(fieldY + fieldH + 56), fontSize: BASE_FONT_SIZE };
  }

  const naturalChipWidth = (chip: LegendChip) => {
    const swatch = chip.kind === "dot" ? BASE_DOT_SWATCH : BASE_LINE_SWATCH;
    return swatch + BASE_SWATCH_TO_TEXT_GAP + chip.label.length * BASE_CHAR_WIDTH;
  };
  const naturalTotalWidth =
    chips.reduce((sum, chip) => sum + naturalChipWidth(chip), 0) + BASE_GAP_AFTER_CHIP * (chips.length - 1);

  // Single scale factor applied to every size so proportions stay
  // consistent -- never below MIN_SCALE, so it degrades to "slightly
  // tighter" rather than "illegible" for an unusually large chip set.
  const scale = Math.max(MIN_SCALE, Math.min(1, (maxX - startX) / naturalTotalWidth));

  const fontSize = round(BASE_FONT_SIZE * scale);
  const gapAfterChip = BASE_GAP_AFTER_CHIP * scale;
  const swatchToTextGap = BASE_SWATCH_TO_TEXT_GAP * scale;
  const dotSwatch = BASE_DOT_SWATCH * scale;
  const lineSwatch = BASE_LINE_SWATCH * scale;
  const y = round(fieldY + fieldH + 56);

  let x = startX;
  const items: LegendLayoutItem[] = chips.map((chip) => {
    const swatchWidth = chip.kind === "dot" ? dotSwatch : lineSwatch;
    const textWidth = chip.label.length * BASE_CHAR_WIDTH * scale;
    const chipWidth = swatchWidth + swatchToTextGap + textWidth;
    const textX = round(x + swatchWidth + swatchToTextGap);
    const textY = round(y + fontSize / 3);
    let item: LegendLayoutItem;
    if (chip.kind === "dot") {
      item = { kind: "dot", cx: round(x + swatchWidth / 2), cy: y, r: round(dotSwatch / 2), color: chip.color, textX, textY, label: chip.label };
    } else {
      item = {
        kind: "line",
        x1: round(x),
        y1: y,
        x2: round(x + swatchWidth),
        y2: y,
        color: chip.color,
        dash: chip.dash,
        textX,
        textY,
        label: chip.label,
      };
    }
    x += chipWidth + gapAfterChip;
    return item;
  });

  const dividerY = round(y + 28);
  return { items, dividerX1: startX, dividerX2: maxX, dividerY, fontSize };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
