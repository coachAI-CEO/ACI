import { prisma } from "../prisma";
import { drillToDrawerParams } from "../mappers/drill-to-drawer-params";
import { buildDrawerPrompt, DRAWER_PROMPT_VERSION } from "../prompts/gemini-drawer-prompt";
import { DEFAULT_GEMINI_DRAWER_MODEL, generateDiagramSVG } from "./gemini-drawer";
import { renderDeterministicDiagramSVG } from "./deterministic-drawer-svg";
import { applyGoalOverlay } from "./goal-overlay";
import { computeTokenRadius, scaleFactorFromTokenRadius } from "../data/field-dimensions";
import type { DrawerParams } from "../types/drawer";

type DrillLike = Parameters<typeof drillToDrawerParams>[0];

export type DrillDiagramSvgResult = {
  svg: string;
  model: string;
  modelFallback: boolean;
  promptVersion: string;
};

function scaleFactorForParams(params: DrawerParams): number {
  return scaleFactorFromTokenRadius(
    computeTokenRadius(params.widthYards, params.lengthYards, params.fieldFormat, params.players.length)
  );
}

/**
 * Draw a single drill's SVG diagram, with the same generate-then-fallback
 * behavior as the POST /api/diagram-svg/generate route -- extracted so the
 * session-generation path can call it directly (in parallel, per drill)
 * instead of the client having to fetch it separately after the session
 * already rendered. Does not touch the DB; callers persist the result.
 */
export async function generateDrillDiagramSvg(drillLike: DrillLike): Promise<DrillDiagramSvgResult> {
  const drawerParams = drillToDrawerParams(drillLike);
  const prompt = buildDrawerPrompt(drawerParams);
  const scale = scaleFactorForParams(drawerParams);
  const result = await generateDiagramSVG(prompt);

  if (result.ok) {
    const model = process.env.GEMINI_DRAWER_MODEL ?? DEFAULT_GEMINI_DRAWER_MODEL;
    return {
      svg: applyGoalOverlay(result.svg, drawerParams.goals, scale),
      model,
      modelFallback: false,
      promptVersion: DRAWER_PROMPT_VERSION,
    };
  }

  return {
    svg: applyGoalOverlay(renderDeterministicDiagramSVG(drawerParams), drawerParams.goals, scale),
    model: "deterministic-fallback",
    modelFallback: true,
    promptVersion: DRAWER_PROMPT_VERSION,
  };
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

/** Write the SVG column by itself so a huge drill.json update cannot drop it. */
export async function persistDrillDiagramSvg(refCode: string, result: DrillDiagramSvgResult): Promise<void> {
  await prisma.drill.update({
    where: { refCode },
    data: {
      diagramSvg: result.svg,
      diagramSvgGeneratedAt: new Date(),
      diagramSvgModel: result.model,
      diagramSvgPromptVersion: result.promptVersion,
    },
  });
}
