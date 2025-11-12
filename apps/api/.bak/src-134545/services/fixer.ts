import { generateText } from "../gemini";
import { buildDrillFixerPrompt } from "../prompts/fixer";

function parseJsonSafe(text: string) {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function fixDrill(originalDrill: any, qa: any, guard: {
  gameModelId: "COACHAI"|"POSSESSION"|"PRESSING"|"TRANSITION";
  ageGroup: string;
  phase: string;
  zone: string;
  goalsAvailable: 0|1|2;
  durationMin: number;
}) {
  const prompt = buildDrillFixerPrompt({ originalDrill, qa, guard });
  const text = await generateText(prompt);
  const fixed = parseJsonSafe(text);
  if (!fixed) throw new Error("Fixer returned non-JSON drill");
  return { fixed, raw: text };
}
