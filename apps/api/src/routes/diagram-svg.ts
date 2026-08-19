import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { getEnforcedClubVaultScope } from "../services/club-game-model-scope";
import { drillDiagramVisible } from "../services/diagram-svg-access";
import { generateDrillDiagramSvg, persistDrillDiagramSvg, storedDiagramNeedsRedraw } from "../services/drill-diagram-svg";
import { fitDiagramSvgViewBox } from "../services/fit-diagram-viewbox";
import { enforceDiagramGoalAvailability } from "../services/diagram-goals";
import { isWarmupPicture, svgPictureIsOvercrowded } from "../data/field-dimensions";

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

function warmupSvgStillHasMatchKit(drillType: string | null | undefined, svg: string | null | undefined): boolean {
  if (!isWarmupPicture(drillType) || !svg) return false;
  const gkLabels = (svg.match(/>GK</g) || []).length;
  return gkLabels >= 1 || /id="api-goal-overlay"/.test(svg);
}

/** Numbers on shirts were a bad assign (GK as 2, duplicate 10s). Roles belong there. */
function svgHasShirtNumbers(svg: string | null | undefined): boolean {
  if (!svg) return false;
  return /fill="#ffffff">\d+</.test(svg);
}

function storedSvgIsStale(drillType: string | null | undefined, svg: string | null | undefined): boolean {
  return warmupSvgStillHasMatchKit(drillType, svg) || svgHasShirtNumbers(svg) || svgPictureIsOvercrowded(drillType, svg);
}

function resolveGoalsAvailable(drill: any): number | null {
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
  // Missing equipment flag is not "zero full goals" -- count keepers from
  // whatever full-size goals the stored diagram already drew.
  return null;
}

async function userMayAccessDrillDiagram(
  req: AuthRequest,
  drill: { generatedBy: string | null; savedToVault: boolean; gameModelId: string }
): Promise<boolean> {
  if (!req.user || !req.userId) return false;
  const [scope, userRow] = await Promise.all([
    getEnforcedClubVaultScope(req.userId),
    prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true, adminRole: true },
    }),
  ]);
  return drillDiagramVisible({
    generatedBy: drill.generatedBy,
    savedToVault: drill.savedToVault,
    gameModelId: String(drill.gameModelId),
    userId: req.userId,
    isAdmin: userRow?.role === "ADMIN" || Boolean(userRow?.adminRole),
    vaultScope: scope,
  });
}

diagramSvgRouter.post("/generate", authenticate, async (req: AuthRequest, res) => {
  if (!req.user || !req.userId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
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

  if (!(await userMayAccessDrillDiagram(req, drill))) {
    return res.status(403).json({ ok: false, error: "This diagram is outside your club vault." });
  }

  // COOLDOWN has no formation/ball work to draw -- don't spend a Gemini
  // call drawing one. The client shows the session summary instead.
  if (String(drill.drillType || "").toUpperCase() === "COOLDOWN") {
    return res.json({ svg: null, cooldown: true });
  }

  const currentSvg = drill.diagramSvg;
  // Prompt-version bumps no longer force a blocking redraw. Reopen must
  // return the stored SVG; coaches regenerate explicitly with force=true.
  const needsRegen =
    storedDiagramNeedsRedraw(force, currentSvg) ||
    storedSvgIsStale(drill.drillType, currentSvg);

  if (!needsRegen) {
    return res.json({ svg: currentSvg, cached: true });
  }

  try {
    let json = drill.json;
    const goalsAvailable = resolveGoalsAvailable({
      ...drill,
      requestGoalsAvailable: Number.isFinite(requestGoalsAvailable) ? requestGoalsAvailable : undefined,
    });
    if (drill.json && typeof drill.json === "object") {
      const normalizedJson = JSON.parse(JSON.stringify(drill.json));
      if (goalsAvailable != null) normalizedJson.goalsAvailable = goalsAvailable;
      if (drill.spaceConstraint) normalizedJson.spaceConstraint = drill.spaceConstraint;
      enforceDiagramGoalAvailability(normalizedJson, {
        goalsAvailable,
        spaceConstraint: drill.spaceConstraint,
        fieldFormat: (drill.json as any)?.fieldFormat,
        drillType: drill.drillType,
      });
      json = normalizedJson;
      if (goalsAvailable === 1) {
        await prisma.drill.update({
          where: { id: drill.id },
          data: {
            json: normalizedJson,
            goalsAvailable,
            goalMode: "LARGE",
          },
        });
      }
    }
    const result = await generateDrillDiagramSvg({
      title: drill.title,
      json,
      drillType: drill.drillType,
      durationMin: drill.durationMin,
      rpeMin: drill.rpeMin,
      rpeMax: drill.rpeMax,
      numbersMin: drill.numbersMin,
      numbersMax: drill.numbersMax,
      spaceConstraint: drill.spaceConstraint,
      formationUsed: drill.formationUsed,
      phase: drill.phase,
      zone: drill.zone,
      coachLevel: drill.coachLevel,
    });
    if (drill.refCode) {
      await persistDrillDiagramSvg(drill.refCode, result);
    } else {
      await prisma.drill.update({
        where: { id: drill.id },
        data: {
          diagramSvg: result.svg,
          diagramSvgGeneratedAt: new Date(),
          diagramSvgModel: result.model,
          diagramSvgPromptVersion: result.promptVersion,
        },
      });
    }
    return res.json({
      svg: result.svg,
      cached: false,
      model: result.model,
      modelFallback: result.modelFallback,
    });
  } catch (err) {
    console.error("drill_to_drawer_params_failed", { drillId, err });
    return res.json({
      svg: currentSvg ?? PLACEHOLDER_SVG,
      generationFailed: true,
      reason: "mapper_error",
    });
  }
});

diagramSvgRouter.post("/lookup", authenticate, async (req: AuthRequest, res) => {
  if (!req.user || !req.userId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.filter((id: unknown) => typeof id === "string" && id.trim()).slice(0, 40)
    : [];
  if (ids.length === 0) return res.json({ svgs: {} });

  const drills = await prisma.drill.findMany({
    where: { OR: [{ id: { in: ids } }, { refCode: { in: ids } }] },
    select: {
      id: true,
      refCode: true,
      diagramSvg: true,
      generatedBy: true,
      savedToVault: true,
      gameModelId: true,
    },
  });

  const svgs: Record<string, string> = {};
  for (const drill of drills) {
    if (!drill.diagramSvg) continue;
    if (!(await userMayAccessDrillDiagram(req, drill))) continue;
    const fitted = fitDiagramSvgViewBox(drill.diagramSvg);
    svgs[drill.id] = fitted;
    if (drill.refCode) svgs[drill.refCode] = fitted;
    if (fitted !== drill.diagramSvg) {
      await prisma.drill.update({ where: { id: drill.id }, data: { diagramSvg: fitted } });
    }
  }
  return res.json({ svgs });
});

diagramSvgRouter.get("/:drillId", authenticate, async (req: AuthRequest, res) => {
  if (!req.user || !req.userId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const { drillId } = req.params;
  const drill = await prisma.drill.findFirst({
    where: {
      OR: [
        { id: drillId },
        { refCode: drillId },
      ],
    },
  });

  if (!drill) return res.status(404).json({ error: "drill not found" });

  if (!(await userMayAccessDrillDiagram(req, drill))) {
    return res.status(403).json({ ok: false, error: "This diagram is outside your club vault." });
  }

  if (String(drill.drillType || "").toUpperCase() === "COOLDOWN") {
    return res.json({ svg: null, cooldown: true, hasStoredSvg: false });
  }

  if (drill.diagramSvg && !storedSvgIsStale(drill.drillType, drill.diagramSvg)) {
    const svg = fitDiagramSvgViewBox(drill.diagramSvg);
    if (svg !== drill.diagramSvg) {
      await prisma.drill.update({ where: { id: drill.id }, data: { diagramSvg: svg } });
    }
    return res.json({ svg, hasStoredSvg: true, cached: true });
  }

  try {
    const result = await generateDrillDiagramSvg({
      title: drill.title,
      json: drill.json,
      drillType: drill.drillType,
      durationMin: drill.durationMin,
      rpeMin: drill.rpeMin,
      rpeMax: drill.rpeMax,
      numbersMin: drill.numbersMin,
      numbersMax: drill.numbersMax,
      spaceConstraint: drill.spaceConstraint,
      formationUsed: drill.formationUsed,
      phase: drill.phase,
      zone: drill.zone,
      coachLevel: drill.coachLevel,
    });
    if (drill.refCode) {
      await persistDrillDiagramSvg(drill.refCode, result);
    } else {
      await prisma.drill.update({
        where: { id: drill.id },
        data: {
          diagramSvg: result.svg,
          diagramSvgGeneratedAt: new Date(),
          diagramSvgModel: result.model,
          diagramSvgPromptVersion: result.promptVersion,
        },
      });
    }
    return res.json({
      svg: result.svg,
      hasStoredSvg: true,
      cached: false,
      model: result.model,
    });
  } catch (err) {
    console.error("diagram_svg_fetch_compile_failed", { drillId, err });
    return res.json({
      svg: PLACEHOLDER_SVG,
      hasStoredSvg: false,
      generationFailed: true,
    });
  }
});
