import { Router } from "express";
import { prisma } from "../prisma";
import { drillToDrawerParams } from "../mappers/drill-to-drawer-params";
import { buildDrawerPrompt, DRAWER_PROMPT_VERSION } from "../prompts/gemini-drawer-prompt";
import { DEFAULT_GEMINI_DRAWER_MODEL, generateDiagramSVG } from "../services/gemini-drawer";
import { renderDeterministicDiagramSVG } from "../services/deterministic-drawer-svg";
import { enforceDiagramGoalAvailability } from "../services/diagram-goals";
import { computeTokenRadius, scaleFactorFromTokenRadius } from "../data/field-dimensions";
import { applyGoalOverlay } from "../services/goal-overlay";
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

  // COOLDOWN has no formation/ball work to draw -- don't spend a Gemini
  // call drawing one. The client shows the session summary instead.
  if (String(drill.drillType || "").toUpperCase() === "COOLDOWN") {
    return res.json({ svg: null, cooldown: true });
  }

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
