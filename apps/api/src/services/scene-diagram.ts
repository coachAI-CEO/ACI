import { generateText, setMetricsContext, clearMetricsContext } from "../gemini";
import { applyGoalOverlay } from "./goal-overlay";
import { fitDiagramSvgViewBox } from "./fit-diagram-viewbox";
import { computeTokenRadius, scaleFactorFromTokenRadius } from "../data/field-dimensions";
import { renderDeterministicDiagramSVG } from "./deterministic-drawer-svg";
import { buildSceneCard, type SceneDrillLike } from "./scene-card";
import { extractScene, promptForScene, sceneToDrawerParams, sceneFramesToDrawerParams, SCENE_PROMPT_VERSION, type SceneDiagram, type SceneCard } from "./scene-document";
import type { DrawerParams } from "../types/drawer";

/** One painted frame in a scene sequence. */
export type SceneSvgFrame = {
  svg: string;
  role: "setup" | "action";
  note?: string;
  durationMs: number;
};

export type SceneDiagramResult = {
  /** Frame 0's SVG — the stored single picture. Back-compat with callers that want one SVG. */
  svg: string;
  /** >= 2 entries when the model returned a mechanism sequence; 1 otherwise. */
  frames: SceneSvgFrame[];
  diagram: SceneDiagram;
  card: string;
  model: string;
  promptVersion: typeof SCENE_PROMPT_VERSION;
};

// params come from sceneToDrawerParams, which already pins goals, snaps
// keepers, and runs enforceSceneKit. This just renders.
function paintScene(params: DrawerParams): string {
  const tokenRadius =
    typeof params.lockTokenRadius === "number" && params.lockTokenRadius > 0
      ? params.lockTokenRadius
      : computeTokenRadius(params.widthYards, params.lengthYards, params.fieldFormat, params.players.length);
  return fitDiagramSvgViewBox(
    applyGoalOverlay(renderDeterministicDiagramSVG(params), params.goals, scaleFactorFromTokenRadius(tokenRadius))
  );
}

export function renderSceneSvg(card: SceneCard, diagram: SceneDiagram): string {
  return paintScene(sceneToDrawerParams(card, diagram));
}

export function renderSceneFrames(card: SceneCard, diagram: SceneDiagram): SceneSvgFrame[] {
  return sceneFramesToDrawerParams(card, diagram).map((f) => ({
    svg: paintScene(f.params),
    role: f.role,
    note: f.note,
    durationMs: f.durationMs,
  }));
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
    const diagram = extractScene(raw);
    const frames = renderSceneFrames(card, diagram);
    return {
      svg: frames[0].svg,
      frames,
      diagram,
      card: card.card,
      model,
      promptVersion: SCENE_PROMPT_VERSION,
    };
  } finally {
    clearMetricsContext();
  }
}
