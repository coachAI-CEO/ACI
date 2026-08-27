import { generateText, setMetricsContext, clearMetricsContext } from "../gemini";
import { applyGoalOverlay } from "./goal-overlay";
import { fitDiagramSvgViewBox } from "./fit-diagram-viewbox";
import { computeTokenRadius, scaleFactorFromTokenRadius } from "../data/field-dimensions";
import { renderDeterministicDiagramSVG } from "./deterministic-drawer-svg";
import { buildSceneCard, type SceneDrillLike } from "./scene-card";
import { extractScene, promptForScene, sceneToDrawerParams, SCENE_PROMPT_VERSION, type ModelScene } from "./scene-document";
import { pinGoalsToEnds, snapKeepersToGoals } from "./scene-space";
import type { DrawerParams } from "../types/drawer";

export type SceneDiagramResult = {
  svg: string;
  scene: ModelScene;
  card: string;
  model: string;
  promptVersion: typeof SCENE_PROMPT_VERSION;
};

function paintScene(params: DrawerParams): string {
  const goals = pinGoalsToEnds(params.goals);
  const snapped = { ...params, goals, players: snapKeepersToGoals(params.players, goals) };
  const tokenRadius =
    typeof snapped.lockTokenRadius === "number" && snapped.lockTokenRadius > 0
      ? snapped.lockTokenRadius
      : computeTokenRadius(snapped.widthYards, snapped.lengthYards, snapped.fieldFormat, snapped.players.length);
  return fitDiagramSvgViewBox(applyGoalOverlay(renderDeterministicDiagramSVG(snapped), snapped.goals, scaleFactorFromTokenRadius(tokenRadius)));
}

function sceneModel(): string {
  const requested = process.env.GEMINI_SCENE_MODEL || "gemini-3.5-flash-lite";
  if (/gemini-3\.[56]-flash$/i.test(requested) && !/lite/i.test(requested)) {
    console.error(`[diagram] refusing banned scene model "${requested}", using gemini-3.5-flash-lite`);
    return "gemini-3.5-flash-lite";
  }
  return requested;
}

/** Card → Flash Lite object XY → same TE SVG painter. Never drillToDrawerParams. */
export async function generateSceneDiagram(drill: SceneDrillLike): Promise<SceneDiagramResult> {
  const card = buildSceneCard(drill);
  const model = sceneModel();
  setMetricsContext({
    operationType: "scene_diagram",
    ageGroup: typeof (drill.json as any)?.ageGroup === "string" ? (drill.json as any).ageGroup : undefined,
    gameModelId: card.gameModelId,
    phase: card.phase,
  });
  try {
    const raw = await generateText(promptForScene(card), {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      timeout: 60000,
      model,
    });
    const scene = extractScene(raw);
    const params = sceneToDrawerParams(card, scene);
    return {
      svg: paintScene(params),
      scene,
      card: card.card,
      model,
      promptVersion: SCENE_PROMPT_VERSION,
    };
  } finally {
    clearMetricsContext();
  }
}
