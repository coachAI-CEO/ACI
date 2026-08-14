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

// The base session prompt already mandates 80-120 words per description --
// this exists because that instruction alone wasn't reliable: a real
// session came back with every single drill description under the floor
// (64-72 words), all following the same generic "integrates our possession
// model... tests players' tactical decision-making" shape instead of
// describing what actually happens in the drill. Same philosophy as
// needsDiagramEnrichment: prompt-only isn't enough, so check the actual
// output and fix the ones that fall short instead of trusting the
// instruction was followed.
const MIN_DESCRIPTION_WORDS = 80;

export function needsDescriptionExpansion(description: unknown): boolean {
  const wordCount = String(description || "").trim().split(/\s+/).filter(Boolean).length;
  return wordCount < MIN_DESCRIPTION_WORDS;
}

export function buildDescriptionExpansionPrompt(drill: any, coachLevel?: string): string {
  return [
    "You are a soccer coaching content editor.",
    "The description below is too short and too abstract -- it restates the drill's theme in general terms instead of describing what actually happens, moment to moment, when players run it.",
    "",
    "Rewrite drill.description to be 80-120 words (4-5 sentences). Ground every sentence in the drill's ACTUAL setup steps, constraints, and coaching points below -- concrete mechanics a coach would see happening, not a more verbose restatement of the same abstract theme.",
    `Coach level: ${coachLevel || "unspecified"}. USSF_D: plain everyday language, no jargon. USSF_C: name one tactical concept at a time and explain it in the same or next sentence -- do NOT fuse multiple concepts into one clause. USSF_B_PLUS: fluent, may connect concepts across sentences.`,
    "",
    "BAD example (too abstract, fuses concepts, this is exactly the failure mode to avoid): \"This tactical drill integrates our complete possession model to master playing out under pressure. The objective is recognizing when to circulate safely across the backline and when to execute a third-man pass through midfield lines.\"",
    "GOOD example (same length, grounded in actual mechanics): \"Eight attackers build out against two mini-goal-defending pressers inside the 25x25 grid. Every player checks their shoulder before the ball arrives, then opens their body to receive facing forward. When a defender steps to press the ball carrier, the nearest teammate offers an angle to receive played around the pressure, not through it. Ten consecutive passes without a defender touch scores the point.\"",
    "",
    "Current (too short) description:",
    String(drill.description || ""),
    "",
    "Title:", String(drill.title || ""),
    "Setup steps (pull concrete detail from these):",
    JSON.stringify(drill.organization?.setupSteps || []),
    "Constraints:",
    JSON.stringify(drill.constraints || []),
    "Coaching points:",
    JSON.stringify(drill.coachingPoints || []),
    "",
    "Output ONLY a JSON object: { \"description\": \"...\" }",
  ].join("\n");
}

export async function expandDrillDescription(drill: any, coachLevel?: string): Promise<string | null> {
  const prompt = buildDescriptionExpansionPrompt(drill, coachLevel);
  const model = process.env.GEMINI_DIAGRAM_ENRICHMENT_MODEL || process.env.GEMINI_FAST_MODEL;
  setMetricsContext({ operationType: "description_expansion" });
  let text = "";
  try {
    text = await generateText(prompt, { timeout: 20000, retries: Number(process.env.GEMINI_MAX_RETRIES ?? 1), model });
  } finally {
    clearMetricsContext();
  }
  const parsed = parseJsonSafe(text);
  const description = parsed?.description;
  if (typeof description !== "string" || !description.trim()) return null;
  return description.trim();
}
