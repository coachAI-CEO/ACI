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

// Minimum arrow/annotation/safeZone counts, per coachLevel -- must stay in
// sync with the arrowRange/annotationRange/safeZoneRange targets in
// buildSessionPrompt (session.ts): USSF_D 2-4/1-2/0-1, USSF_C 5-7/3-4/1-2,
// USSF_B_PLUS 7-10/4-6/2-3. Previously this used one fixed threshold
// (7/4/1) for every level -- effectively the B+ minimum -- so a USSF_C or
// USSF_D session that correctly followed its own coachLevel's (lower)
// target still failed this check almost every time, forcing an
// unnecessary extra generation round-trip (~5s) per drill for the two
// coach levels that are supposed to have LESS diagram detail, not more.
function minimumsForCoachLevel(coachLevel?: string) {
  const level = String(coachLevel || "").toUpperCase();
  if (level === "USSF_D") return { arrows: 2, annotations: 1, safeZones: 0 };
  if (level === "USSF_B_PLUS") return { arrows: 7, annotations: 4, safeZones: 2 };
  // USSF_C or unknown -- unknown keeps the previous (strictest, B+-shaped)
  // behavior only for arrows/annotations minima that used to apply
  // universally; C's own real target is looser, so default to it when the
  // level is actually USSF_C, and fall back to the old fixed numbers only
  // when coachLevel wasn't provided at all (existing callers that don't
  // pass one, e.g. the admin audit tool).
  return coachLevel ? { arrows: 5, annotations: 3, safeZones: 1 } : { arrows: 7, annotations: 4, safeZones: 1 };
}

export function needsDiagramEnrichment(diagram: any, coachLevel?: string) {
  if (!diagram) return true;
  const { arrows: minArrows, annotations: minAnnotations, safeZones: minSafeZones } = minimumsForCoachLevel(coachLevel);
  const arrows = Array.isArray(diagram.arrows) ? diagram.arrows.length : 0;
  const annotations = Array.isArray(diagram.annotations) ? diagram.annotations.length : 0;
  const safeZones = Array.isArray(diagram.safeZones) ? diagram.safeZones.length : 0;
  if (arrows < minArrows || annotations < minAnnotations || safeZones < minSafeZones) return true;
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
    "- Include arrows (7-10) using types pass/movement/press/run. Every arrow's from/to MUST be a literal {x, y} number pair copied from the actual player position it starts/ends at -- never a playerId reference, since an id that doesn't exactly match diagram.players collapses the arrow to a single point.",
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
  const model = process.env.GEMINI_DIAGRAM_ENRICHMENT_MODEL || process.env.GEMINI_FAST_MODEL;
  setMetricsContext({
    operationType: "diagram_enrichment",
    ageGroup: typeof drillJson?.ageGroup === "string" ? drillJson.ageGroup : undefined,
    gameModelId: typeof drillJson?.gameModelId === "string" ? drillJson.gameModelId : undefined,
    phase: typeof drillJson?.phase === "string" ? drillJson.phase : undefined,
  });
  let text = "";
  try {
    text = await generateText(prompt, { timeout: 30000, retries: Number(process.env.GEMINI_MAX_RETRIES ?? 1), model });
  } finally {
    clearMetricsContext();
  }
  const parsed = parseJsonSafe(text);
  const diagram = parsed?.diagram || parsed;
  if (!diagram || typeof diagram !== "object") return null;
  return diagram;
}
