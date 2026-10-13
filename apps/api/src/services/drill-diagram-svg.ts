import { prisma } from "../prisma";
import { drillToDrawerParams } from "../mappers/drill-to-drawer-params";
import { buildDrawerPrompt, DRAWER_PROMPT_VERSION } from "../prompts/gemini-drawer-prompt";
import { DEFAULT_GEMINI_DRAWER_MODEL, generateDiagramSVG } from "./gemini-drawer";
import { renderDeterministicDiagramSVG } from "./deterministic-drawer-svg";
import { applyGoalOverlay } from "./goal-overlay";
import { fitDiagramSvgViewBox } from "./fit-diagram-viewbox";
import { computeTokenRadius, scaleFactorFromTokenRadius } from "../data/field-dimensions";
import type { DrawerParams } from "../types/drawer";
import { generateSceneDiagram, type SceneSvgFrame } from "./scene-diagram";
import { SCENE_PROMPT_VERSION, type SceneDiagram } from "./scene-document";

type DrillLike = Parameters<typeof drillToDrawerParams>[0];

export type DiagramPlacement = "scene" | "compiler" | "gemini-svg";

export type DrillDiagramSvgResult = {
  svg: string;
  model: string;
  modelFallback: boolean;
  promptVersion: string;
  sceneDiagram?: SceneDiagram;
  /** Ordered painted frames when the scene is a mechanism sequence (>= 2). */
  sceneFrames?: SceneSvgFrame[];
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

/** Always draw with scene XY. The compiler lives only as a forced rollback
 * (force=true in redraw-vault-diagrams, eval-live-drill). Stored pictures
 * are not redrawn implicitly — they keep the scene that was saved. */
export function placementForStoredPicture(force: boolean): DiagramPlacement | undefined {
  return force ? "compiler" : undefined;
}

export function attachSceneToDrillJson(drill: Record<string, any>, result: DrillDiagramSvgResult): void {
  if (!result.sceneDiagram) return;
  drill.sceneDiagram = result.sceneDiagram;
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
        sceneDiagram: scene.diagram,
        sceneFrames: scene.frames.length > 1 ? scene.frames : undefined,
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

export function isPlaceholderDiagramSvg(svg: string | null | undefined): boolean {
  if (!svg) return true;
  return /Diagram generating/i.test(svg);
}

export function isSceneStoredPicture(promptVersion: string | null | undefined): boolean {
  return String(promptVersion || "").startsWith("scene-");
}

/** Reopen/preview must not redraw just because the prompt version changed. */
export function storedDiagramNeedsRedraw(
  force: boolean,
  currentSvg: string | null | undefined
): boolean {
  return force === true || isPlaceholderDiagramSvg(currentSvg);
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

/** Write the SVG column by itself so a huge drill.json update cannot drop it. Merges scene JSON when present. */
export async function persistDrillDiagramSvg(refCode: string, result: DrillDiagramSvgResult): Promise<void> {
  const row = await prisma.drill.findUnique({
    where: { refCode },
    select: { json: true, diagramSvgPromptVersion: true },
  });
  if (
    isSceneStoredPicture(row?.diagramSvgPromptVersion) &&
    !result.sceneDiagram &&
    !isSceneStoredPicture(result.promptVersion)
  ) {
    console.warn("[diagram] refusing to overwrite scene-xy picture with compiler", { refCode });
    return;
  }
  const data: Record<string, unknown> = {
    diagramSvg: fitDiagramSvgViewBox(result.svg),
    diagramSvgGeneratedAt: new Date(),
    diagramSvgModel: result.model,
    diagramSvgPromptVersion: result.promptVersion,
  };
  if (result.sceneDiagram) {
    const json = asRecord(row?.json);
    data.json = {
      ...json,
      sceneDiagram: result.sceneDiagram,
      scenePromptVersion: result.promptVersion || SCENE_PROMPT_VERSION,
      // Clears a stale sequence when a redraw comes back single-frame.
      sceneFrames: result.sceneFrames ?? null,
      ...(result.sceneCard ? { sceneCard: result.sceneCard } : {}),
    };
  }
  await prisma.drill.update({
    where: { refCode },
    data,
  });
}
