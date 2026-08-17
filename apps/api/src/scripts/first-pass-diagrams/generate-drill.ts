import { generateText } from "../../gemini";
import { buildDrillPrompt } from "../../prompts/drill-optimized-v2";
import { sanitizeDrillOutput } from "../../services/drill";
import { applyYouthGuards } from "../../services/youth-guards";
import { postProcessDrill } from "../../services/postprocess";
import { enforceDiagramGoalAvailability } from "../../services/diagram-goals";
import { extraPromptForPack, type PromptPackName } from "./prompt-packs";
import type { FirstPassFixture } from "./fixtures";

function parseJsonSafe(text: string): unknown {
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

export function drillModel(): string {
  const requested =
    process.env.GEMINI_DRILL_MODEL || process.env.GEMINI_GENERATION_MODEL || "gemini-3.5-flash-lite";
  if (/gemini-3\.[56]-flash$/i.test(requested) && !/lite/i.test(requested)) {
    throw new Error(`Refusing banned non-lite model "${requested}". Use gemini-3.5-flash-lite.`);
  }
  return requested;
}

export async function generateDrillJson(fixture: FirstPassFixture, pack: PromptPackName = "base"): Promise<any> {
  const extra = extraPromptForPack(pack, fixture);
  const prompt = extra ? `${buildDrillPrompt(fixture.input)}\n\n${extra}` : buildDrillPrompt(fixture.input);
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const text = await generateText(prompt, {
      timeout: Number(process.env.SANDBOX_GEN_TIMEOUT_MS || 45000),
      retries: Number(process.env.GEMINI_MAX_RETRIES ?? 1),
      model: drillModel(),
    });
    const parsed = parseJsonSafe(text);
    if (!parsed) {
      lastError = new Error(`Model returned non-JSON drill output (attempt ${attempt})`);
      continue;
    }
    const { drill } = sanitizeDrillOutput(parsed);
    drill.goalsAvailable = fixture.input.goalsAvailable;
    drill.spaceConstraint = fixture.input.spaceConstraint;
    drill.fieldFormat = fixture.input.fieldFormat;
    drill.drillType = fixture.input.drillType;
    applyYouthGuards(drill, fixture.input);
    try {
      postProcessDrill({ json: drill }, fixture.input);
    } catch (err: any) {
      console.error(`  [${fixture.id} postprocess] ${err?.message || err}`);
    }
    enforceDiagramGoalAvailability(drill, fixture.input);
    return drill;
  }
  throw lastError || new Error("Model returned non-JSON drill output");
}
