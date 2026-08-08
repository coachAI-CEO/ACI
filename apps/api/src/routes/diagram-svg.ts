import { Router } from "express";
import { prisma } from "../prisma";
import { drillToDrawerParams } from "../mappers/drill-to-drawer-params";
import { buildDrawerPrompt, DRAWER_PROMPT_VERSION } from "../prompts/gemini-drawer-prompt";
import { DEFAULT_GEMINI_DRAWER_MODEL, generateDiagramSVG } from "../services/gemini-drawer";
import { renderDeterministicDiagramSVG } from "../services/deterministic-drawer-svg";
import { enforceDiagramGoalAvailability } from "../services/diagram-goals";
import { computeTokenRadius, scaleFactorFromTokenRadius } from "../data/field-dimensions";
import type { DrawerGoal, DrawerParams } from "../types/drawer";

function scaleFactorForParams(params: DrawerParams): number {
  return scaleFactorFromTokenRadius(
    computeTokenRadius(params.widthYards, params.lengthYards, params.fieldFormat, params.players.length)
  );
}

export const diagramSvgRouter = Router();

const PLACEHOLDER_SVG = `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#0a0d10"/>
  <text x="400" y="290" text-anchor="middle" dominant-baseline="middle"
        fill="rgba(255,255,255,0.25)" font-family="Arial" font-size="14">
    Diagram generating...
  </text>
</svg>`;

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function resolveGoalsAvailable(drill: any): number {
  const json = asRecord(drill?.json);
  const candidates = [
    drill?.requestGoalsAvailable,
    drill?.goalsAvailable,
    json.goalsAvailable,
    asRecord(json.input).goalsAvailable,
    asRecord(json.generatorSettings).goalsAvailable,
    asRecord(json.settings).goalsAvailable,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  const goalMode = String(drill?.goalMode || json.goalMode || "").toUpperCase();
  if (goalMode === "LARGE") return 1;
  if (goalMode === "MINI2") return 2;
  return 0;
}

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
    fieldY: 239.38,
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
  const penaltyW = 92 * scaleFactor;
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
    const nearLeft = goal.x <= 15;
    const nearRight = goal.x >= 85;
    const nearTop = goal.y <= 15;
    const nearBottom = goal.y >= 85;
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

    if (nearTop) {
      return `<path d="M ${x - halfWidth} ${geometry.fieldY} L ${x - halfWidth} ${geometry.fieldY - depth} L ${x + halfWidth} ${geometry.fieldY - depth} L ${x + halfWidth} ${geometry.fieldY}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="square" stroke-linejoin="miter"/>`;
    }
    if (nearBottom) {
      const fieldBottom = geometry.fieldY + geometry.fieldH;
      return `<path d="M ${x - halfWidth} ${fieldBottom} L ${x - halfWidth} ${fieldBottom + depth} L ${x + halfWidth} ${fieldBottom + depth} L ${x + halfWidth} ${fieldBottom}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="square" stroke-linejoin="miter"/>`;
    }
    if (nearLeft || isLeft) {
      return `<path d="M ${geometry.fieldX} ${y - halfWidth} L ${geometry.fieldX - depth} ${y - halfWidth} L ${geometry.fieldX - depth} ${y + halfWidth} L ${geometry.fieldX} ${y + halfWidth}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="square" stroke-linejoin="miter"/>`;
    }
    const fieldRight = geometry.fieldX + geometry.fieldW;
    return `<path d="M ${fieldRight} ${y - halfWidth} L ${fieldRight + depth} ${y - halfWidth} L ${fieldRight + depth} ${y + halfWidth} L ${fieldRight} ${y + halfWidth}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="square" stroke-linejoin="miter"/>`;
  });

  return `<g id="api-goal-overlay" pointer-events="none">${penaltyBoxes}${paths.join("")}</g>`;
}

export function applyGoalOverlay(svg: string, goals: DrawerGoal[], scaleFactor: number = 1): string {
  const overlay = renderGoalOverlay(goals, scaleFactor);
  if (!overlay) return svg;
  return svg.replace("</svg>", `${overlay}</svg>`);
}

diagramSvgRouter.post("/generate", async (req, res) => {
  const drillId = typeof req.body?.drillId === "string" ? req.body.drillId : "";
  const force = req.body?.force === true;
  const requestGoalsAvailable = Number(req.body?.goalsAvailable);
  if (!drillId) return res.status(400).json({ error: "drillId required" });

  const drill = await prisma.drill.findFirst({
    where: {
      OR: [
        { id: drillId },
        { refCode: drillId },
      ],
    },
  });
  if (!drill) return res.status(404).json({ error: "drill not found" });

  const currentSvg = drill.diagramSvg;
  const currentPromptVersion = drill.diagramSvgPromptVersion;
  const needsRegen = force || !currentSvg || currentPromptVersion !== DRAWER_PROMPT_VERSION;

  if (!needsRegen) {
    return res.json({ svg: currentSvg, cached: true });
  }

  let prompt: string;
  let drawerParams: DrawerParams | null = null;
  let drawerGoals: DrawerGoal[] = [];
  try {
    let drillForDrawer = drill;
    const goalsAvailable = resolveGoalsAvailable({
      ...drill,
      requestGoalsAvailable: Number.isFinite(requestGoalsAvailable) ? requestGoalsAvailable : undefined,
    });
    if (goalsAvailable === 1 && drill.json && typeof drill.json === "object") {
      const normalizedJson = JSON.parse(JSON.stringify(drill.json));
      enforceDiagramGoalAvailability(normalizedJson, { goalsAvailable });
      drillForDrawer = { ...drill, json: normalizedJson };
      await prisma.drill.update({
        where: { id: drill.id },
        data: {
          json: normalizedJson,
          goalsAvailable,
          goalMode: "LARGE",
        },
      });
    }
    drawerParams = drillToDrawerParams(drillForDrawer);
    drawerGoals = drawerParams.goals;
    prompt = buildDrawerPrompt(drawerParams);
  } catch (err) {
    console.error("drill_to_drawer_params_failed", { drillId, err });
    return res.json({
      svg: currentSvg ?? PLACEHOLDER_SVG,
      generationFailed: true,
      reason: "mapper_error",
    });
  }

  const result = await generateDiagramSVG(prompt);
  if (result.ok) {
    const model = process.env.GEMINI_DRAWER_MODEL ?? DEFAULT_GEMINI_DRAWER_MODEL;
    const svg = applyGoalOverlay(result.svg, drawerGoals, drawerParams ? scaleFactorForParams(drawerParams) : 1);
    await prisma.drill.update({
      where: { id: drill.id },
      data: {
        diagramSvg: svg,
        diagramSvgGeneratedAt: new Date(),
        diagramSvgModel: model,
        diagramSvgPromptVersion: DRAWER_PROMPT_VERSION,
      },
    });
    return res.json({ svg, cached: false });
  }

  console.warn("diagram_svg_generation_failed", {
    drillId,
    reason: result.reason,
    rawLength: result.raw?.length,
    hadExistingSvg: !!currentSvg,
  });

  if (drawerParams) {
    const svg = applyGoalOverlay(renderDeterministicDiagramSVG(drawerParams), drawerGoals, scaleFactorForParams(drawerParams));
    await prisma.drill.update({
      where: { id: drill.id },
      data: {
        diagramSvg: svg,
        diagramSvgGeneratedAt: new Date(),
        diagramSvgModel: "deterministic-fallback",
        diagramSvgPromptVersion: DRAWER_PROMPT_VERSION,
      },
    });
    return res.json({
      svg,
      cached: false,
      modelFallback: true,
      modelFailureReason: result.reason,
    });
  }

  return res.json({
    svg: currentSvg ?? PLACEHOLDER_SVG,
    generationFailed: true,
    reason: result.reason,
  });
});

diagramSvgRouter.get("/:drillId", async (req, res) => {
  const { drillId } = req.params;
  const drill = await prisma.drill.findFirst({
    where: {
      OR: [
        { id: drillId },
        { refCode: drillId },
      ],
    },
    select: { id: true, diagramSvg: true },
  });

  if (!drill) return res.status(404).json({ error: "drill not found" });

  const svg = drill.diagramSvg;
  return res.json({
    svg: svg ?? PLACEHOLDER_SVG,
    hasStoredSvg: !!svg,
  });
});
