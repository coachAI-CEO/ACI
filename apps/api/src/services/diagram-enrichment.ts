import { generateText, setMetricsContext, clearMetricsContext } from "../gemini";

function parseJsonSafe(text: string) {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return null;
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

export function needsDiagramEnrichment(diagram: any) {
  if (!diagram) return true;
  const arrows = Array.isArray(diagram.arrows) ? diagram.arrows.length : 0;
  const annotations = Array.isArray(diagram.annotations) ? diagram.annotations.length : 0;
  const safeZones = Array.isArray(diagram.safeZones) ? diagram.safeZones.length : 0;
  if (arrows < 7 || annotations < 4 || safeZones < 1) return true;
  const defaultAnnTexts = new Set([
    "PRESS TRIGGER",
    "STAY COMPACT",
    "WIDE 2V1",
    "TRIGGER PASS",
  ]);
  const annotationsAllDefault =
    annotations > 0 &&
    diagram.annotations.every((a: any) => defaultAnnTexts.has(String(a?.text || "").toUpperCase()));
  return annotationsAllDefault;
}

export function buildDiagramEnrichmentPrompt(drillJson: any) {
  return [
    "You are a tactical soccer diagram assistant.",
    "Given the DRILL JSON below, output ONLY a JSON object with a single key: diagram.",
    "The diagram MUST be specific to this drill, using its coachingPoints, setupSteps, and description.",
    "",
    "Rules:",
    "- Output format: { \"diagram\": { ... } }",
    "- Preserve existing pitch/goals/players if present; do not change players count.",
    "- Ensure pitch.showZones = false.",
    "- Include arrows (7-10) using types pass/movement/press/run.",
    "- Include annotations (4-6) derived from THIS drill's coachingPoints/setupSteps (no generic defaults).",
    "- Include safeZones (1-3) only if spatial concepts exist (wide channel, zone, third, corridor).",
    "- Use coordinates 0-100.",
    "",
    "DRILL JSON:",
    JSON.stringify(drillJson),
  ].join("\n");
}

export async function reenrichDiagramFromDrillJson(drillJson: any) {
  const prompt = buildDiagramEnrichmentPrompt(drillJson);
  setMetricsContext({
    operationType: "diagram_enrichment",
    ageGroup: typeof drillJson?.ageGroup === "string" ? drillJson.ageGroup : undefined,
    gameModelId: typeof drillJson?.gameModelId === "string" ? drillJson.gameModelId : undefined,
    phase: typeof drillJson?.phase === "string" ? drillJson.phase : undefined,
  });
  let text = "";
  try {
    text = await generateText(prompt, { timeout: 60000, retries: 0 });
  } finally {
    clearMetricsContext();
  }
  const parsed = parseJsonSafe(text);
  const diagram = parsed?.diagram || parsed;
  if (!diagram || typeof diagram !== "object") return null;
  return diagram;
}
