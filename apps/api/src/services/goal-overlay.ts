import type { DrawerGoal } from "../types/drawer";

type SvgGeometry = {
  fieldX: number;
  fieldY: number;
  fieldW: number;
  fieldH: number;
  rotateVerticalData: boolean;
};

// Must match deterministic-drawer-svg.ts's FIELD_MARGIN_RATIO-inset rect and
// gemini-drawer-prompt.ts's FIELD section exactly -- this overlay is drawn
// on top of both renderers' output, so a mismatch here misaligns goals and
// penalty boxes against the field boundary either renderer actually drew.
function resolveSvgGeometry(goals: DrawerGoal[]): SvgGeometry {
  const hasTopBottomGoal = goals.some((goal) => goal.y <= 15 || goal.y >= 85);
  const hasLeftRightGoal = goals.some((goal) => goal.x <= 15 || goal.x >= 85);
  return {
    fieldX: 117.92,
    fieldY: 74.38,
    fieldW: 564.16,
    fieldH: 313.24,
    rotateVerticalData: hasTopBottomGoal && !hasLeftRightGoal,
  };
}

function svgY(percent: number, geometry: SvgGeometry): number {
  return Math.round((geometry.fieldY + (Math.max(0, Math.min(100, percent)) / 100) * geometry.fieldH) * 100) / 100;
}

function svgX(percent: number, geometry: SvgGeometry): number {
  return Math.round((geometry.fieldX + (Math.max(0, Math.min(100, percent)) / 100) * geometry.fieldW) * 100) / 100;
}

function orientGoal(goal: DrawerGoal, geometry: SvgGeometry): DrawerGoal {
  if (!geometry.rotateVerticalData) return goal;
  return {
    ...goal,
    x: 100 - Math.max(0, Math.min(100, goal.y)),
    y: Math.max(0, Math.min(100, goal.x)),
  };
}

/**
 * Penalty box AND goal area (6-yard box), drawn only next to a real
 * full-size goal. Mini-goal edges and goal-less edges get nothing -- the
 * field chrome must reflect the drill's actual goal setup, not a generic
 * full-match-pitch template. Left/right only: the "always horizontal"
 * direction lock means a real full-size goal sits at a side edge, never
 * top/bottom.
 *
 * Both boxes scale with scaleFactor (see computeTokenRadius /
 * scaleFactorFromTokenRadius in field-dimensions.ts) -- the same "zoom"
 * factor applied to player tokens, so a tight practice grid shows a
 * proportionally bigger box just like it shows bigger players, instead of
 * the box staying a fixed size while everything else around it scales.
 */
function renderPenaltyBoxes(goals: DrawerGoal[], geometry: SvgGeometry, scaleFactor: number): string {
  // Never let the 18-yard overlay eat a short third (22yd 7v7 THIRD).
  const penaltyW = Math.min(92 * scaleFactor, geometry.fieldW * 0.38);
  const penaltyH = 156 * scaleFactor;
  // Real FIFA proportions: goal area (6-yard box) is 6yd deep x 20yd wide,
  // vs a penalty area's 18yd deep x 44yd wide -- scale the goal area off
  // the (already-scaled) penalty box using those same ratios.
  const goalAreaW = penaltyW * (6 / 18);
  const goalAreaH = penaltyH * (20 / 44);

  return goals
    .filter((g) => g.type === "full")
    .map((rawGoal) => {
      const goal = orientGoal(rawGoal, geometry);
      const y = svgY(goal.y, geometry);
      const isLeft = goal.x < 50;
      const penaltyX = isLeft ? geometry.fieldX : geometry.fieldX + geometry.fieldW - penaltyW;
      const goalAreaX = isLeft ? geometry.fieldX : geometry.fieldX + geometry.fieldW - goalAreaW;
      const penaltyBox = `<rect x="${penaltyX}" y="${y - penaltyH / 2}" width="${penaltyW}" height="${penaltyH}" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/>`;
      const goalArea = `<rect x="${goalAreaX}" y="${y - goalAreaH / 2}" width="${goalAreaW}" height="${goalAreaH}" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/>`;
      return penaltyBox + goalArea;
    })
    .join("");
}

export function renderGoalOverlay(goals: DrawerGoal[], scaleFactor: number = 1): string {
  if (!Array.isArray(goals) || goals.length === 0) return "";
  const geometry = resolveSvgGeometry(goals);
  const penaltyBoxes = renderPenaltyBoxes(goals, geometry, scaleFactor);
  const paths = goals.map((rawGoal) => {
    const goal = orientGoal(rawGoal, geometry);
    const x = svgX(goal.x, geometry);
    const y = svgY(goal.y, geometry);
    const nearTop = goal.y <= 15;
    const nearBottom = goal.y >= 85;
    const onLeftEnd = goal.x <= 22;
    const onRightEnd = goal.x >= 78;
    const isLeft = goal.x < 50;
    const isFull = goal.type === "full";

    // Size AND color both signal full vs mini -- don't rely on size alone.
    // Previously `isFull || nearRight` was an OR, so any mini goal near the
    // right edge fell into the full-size branch and rendered identically
    // to a real goal (exactly the "can't tell what they are" complaint).
    // Both also scale with scaleFactor, same "zoom" factor as player
    // tokens and the penalty/goal-area boxes -- a tight grid should show a
    // proportionally bigger goal, not a fixed-size one.
    const halfWidth = (isFull ? 36 : 12) * scaleFactor;
    const depth = (isFull ? 30 : 12) * scaleFactor;
    const strokeWidth = isFull ? 3 : 2;
    const stroke = isFull ? "#f8fafc" : "#f97316";

    // Endline minis that the crop stretched onto a corner used to hit
    // nearTop/nearBottom first and draw as a top/bottom bracket — two
    // puggs on the right end became L-shapes on the corners. If the
    // token sits on a left/right end, stay on that endline.
    const yMin = geometry.fieldY + halfWidth + 4;
    const yMax = geometry.fieldY + geometry.fieldH - halfWidth - 4;
    const yClamped = Math.max(yMin, Math.min(yMax, y));
    if (onLeftEnd) {
      return `<path d="M ${geometry.fieldX} ${yClamped - halfWidth} L ${geometry.fieldX - depth} ${yClamped - halfWidth} L ${geometry.fieldX - depth} ${yClamped + halfWidth} L ${geometry.fieldX} ${yClamped + halfWidth}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="square" stroke-linejoin="miter"/>`;
    }
    if (onRightEnd) {
      const fieldRight = geometry.fieldX + geometry.fieldW;
      return `<path d="M ${fieldRight} ${yClamped - halfWidth} L ${fieldRight + depth} ${yClamped - halfWidth} L ${fieldRight + depth} ${yClamped + halfWidth} L ${fieldRight} ${yClamped + halfWidth}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="square" stroke-linejoin="miter"/>`;
    }
    if (nearTop) {
      return `<path d="M ${x - halfWidth} ${geometry.fieldY} L ${x - halfWidth} ${geometry.fieldY - depth} L ${x + halfWidth} ${geometry.fieldY - depth} L ${x + halfWidth} ${geometry.fieldY}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="square" stroke-linejoin="miter"/>`;
    }
    if (nearBottom) {
      const fieldBottom = geometry.fieldY + geometry.fieldH;
      return `<path d="M ${x - halfWidth} ${fieldBottom} L ${x - halfWidth} ${fieldBottom + depth} L ${x + halfWidth} ${fieldBottom + depth} L ${x + halfWidth} ${fieldBottom}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="square" stroke-linejoin="miter"/>`;
    }
    const fieldRight = geometry.fieldX + geometry.fieldW;
    return `<path d="M ${fieldRight} ${yClamped - halfWidth} L ${fieldRight + depth} ${yClamped - halfWidth} L ${fieldRight + depth} ${yClamped + halfWidth} L ${fieldRight} ${yClamped + halfWidth}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="square" stroke-linejoin="miter"/>`;
  });

  return `<g id="api-goal-overlay" pointer-events="none">${penaltyBoxes}${paths.join("")}</g>`;
}

export function applyGoalOverlay(svg: string, goals: DrawerGoal[], scaleFactor: number = 1): string {
  const overlay = renderGoalOverlay(goals, scaleFactor);
  if (!overlay) return svg;
  return svg.replace("</svg>", `${overlay}</svg>`);
}
