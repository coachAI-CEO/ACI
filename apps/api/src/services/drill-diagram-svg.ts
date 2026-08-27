import { prisma } from "../prisma";
import { drillToDrawerParams } from "../mappers/drill-to-drawer-params";
import { buildDrawerPrompt, DRAWER_PROMPT_VERSION } from "../prompts/gemini-drawer-prompt";
import { DEFAULT_GEMINI_DRAWER_MODEL, generateDiagramSVG } from "./gemini-drawer";
import { renderDeterministicDiagramSVG } from "./deterministic-drawer-svg";
import { applyGoalOverlay } from "./goal-overlay";
import { fitDiagramSvgViewBox } from "./fit-diagram-viewbox";
import { computeTokenRadius, scaleFactorFromTokenRadius } from "../data/field-dimensions";
import type { DrawerParams } from "../types/drawer";
import { generateSceneDiagram } from "./scene-diagram";
import { SCENE_PROMPT_VERSION, type ModelScene } from "./scene-document";

type DrillLike = Parameters<typeof drillToDrawerParams>[0];

export type DiagramPlacement = "scene" | "compiler" | "gemini-svg";

export type DrillDiagramSvgResult = {
  svg: string;
  model: string;
  modelFallback: boolean;
  promptVersion: string;
  scene?: ModelScene;
  sceneCard?: string;
};

function scaleFactorForParams(params: DrawerParams): number {
  return scaleFactorFromTokenRadius(
    computeTokenRadius(params.widthYards, params.lengthYards, params.fieldFormat, params.players.length)
  );
}

function compileDeterministicSvg(
  drawerParams: DrawerParams,
  asFallback = false
): DrillDiagramSvgResult {
  const scale = scaleFactorForParams(drawerParams);
  return {
    svg: fitDiagramSvgViewBox(applyGoalOverlay(renderDeterministicDiagramSVG(drawerParams), drawerParams.goals, scale)),
    model: asFallback ? "deterministic-fallback" : "deterministic",
    modelFallback: asFallback,
    promptVersion: DRAWER_PROMPT_VERSION,
  };
}

/**
 * New sessions: DIAGRAM_PLACEMENT=scene (default).
 * Rollback: DIAGRAM_PLACEMENT=compiler.
 * Vault backfill must pass { placement: "compiler" } unless explicitly --scene.
 * DIAGRAM_SVG_ENGINE=deterministic no longer selects the compiler — that was
 * Render's old default and would silently undo the flip.
 */
export function resolveDiagramPlacement(override?: DiagramPlacement | string): DiagramPlacement {
  const raw = String(override || process.env.DIAGRAM_PLACEMENT || "").toLowerCase();
  if (raw === "scene" || raw === "xy") return "scene";
  if (raw === "compiler") return "compiler";
  if (raw === "gemini" || raw === "llm-svg") return "gemini-svg";
  const engine = String(process.env.DIAGRAM_SVG_ENGINE || "").toLowerCase();
  if (engine === "scene") return "scene";
  if (engine === "gemini") return "gemini-svg";
  return "scene";
}

export function isSceneDiagramPlacement(override?: DiagramPlacement | string): boolean {
  return resolveDiagramPlacement(override) === "scene";
}

/** Existing stored pictures stay on the compiler unless the coach force-regenerates. */
export function placementForStoredPicture(force: boolean, hasStoredSvg: boolean): DiagramPlacement | undefined {
  if (hasStoredSvg && !force) return "compiler";
  return undefined;
}

export function attachSceneToDrillJson(drill: Record<string, any>, result: DrillDiagramSvgResult): void {
  if (!result.scene) return;
  drill.sceneDocument = result.scene;
  drill.scenePromptVersion = result.promptVersion;
  if (result.sceneCard) drill.sceneCard = result.sceneCard;
}

/**
 * Draw a single drill's SVG diagram. Scene XY is the default painter input.
 * Compiler (drillToDrawerParams) is fallback only.
 */
export async function generateDrillDiagramSvg(
  drillLike: DrillLike,
  opts?: { placement?: DiagramPlacement }
): Promise<DrillDiagramSvgResult> {
  const placement = resolveDiagramPlacement(opts?.placement);

  if (placement === "scene") {
    try {
      const scene = await generateSceneDiagram(drillLike);
      return {
        svg: scene.svg,
        model: scene.model,
        modelFallback: false,
        promptVersion: scene.promptVersion,
        scene: scene.scene,
        sceneCard: scene.card,
      };
    } catch (err) {
      console.error("[diagram] scene XY failed, falling back to compiler:", err instanceof Error ? err.message : err);
      return compileDeterministicSvg(drillToDrawerParams(drillLike), true);
    }
  }

  const drawerParams = drillToDrawerParams(drillLike);
  if (placement === "compiler") {
    return compileDeterministicSvg(drawerParams);
  }

  const prompt = buildDrawerPrompt(drawerParams);
  const scale = scaleFactorForParams(drawerParams);
  const result = await generateDiagramSVG(prompt);

  if (result.ok) {
    const model = process.env.GEMINI_DRAWER_MODEL ?? DEFAULT_GEMINI_DRAWER_MODEL;
    return {
      svg: fitDiagramSvgViewBox(applyGoalOverlay(result.svg, drawerParams.goals, scale)),
      model,
      modelFallback: false,
      promptVersion: DRAWER_PROMPT_VERSION,
    };
  }

  return compileDeterministicSvg(drawerParams, true);
}

export function omitDiagramSvgFromDrill<T extends Record<string, any>>(drill: T): T {
  const { diagramSvg: _diagramSvg, ...rest } = drill;
  return rest as T;
}

/** Reopen/preview must not redraw just because the prompt version changed. */
export function storedDiagramNeedsRedraw(
  force: boolean,
  currentSvg: string | null | undefined
): boolean {
  return force === true || !currentSvg;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

/** Write the SVG column by itself so a huge drill.json update cannot drop it. Merges scene JSON when present. */
export async function persistDrillDiagramSvg(refCode: string, result: DrillDiagramSvgResult): Promise<void> {
  const data: Record<string, unknown> = {
    diagramSvg: fitDiagramSvgViewBox(result.svg),
    diagramSvgGeneratedAt: new Date(),
    diagramSvgModel: result.model,
    diagramSvgPromptVersion: result.promptVersion,
  };
  if (result.scene) {
    const row = await prisma.drill.findUnique({ where: { refCode }, select: { json: true } });
    const json = asRecord(row?.json);
    data.json = {
      ...json,
      sceneDocument: result.scene,
      scenePromptVersion: result.promptVersion || SCENE_PROMPT_VERSION,
      ...(result.sceneCard ? { sceneCard: result.sceneCard } : {}),
    };
  }
  await prisma.drill.update({
    where: { refCode },
    data,
  });
}
