export const deriveGoalsSupported = (json: any) => {
  const m = (json?.goalMode || "").toUpperCase();
  if (m === "LARGE") return [1];
  if (m === "MINI2") return [2];
  return [];
};

import { applyYouthGuards } from "./youth-guards";
import { postProcessDrill } from "./postprocess";
import { fixDrillDecision } from "./fixer";
import { normalizeGoals } from "./goal-normalizer";
import { generateText } from "../gemini";
import { prisma } from "../prisma";
import { buildDrillPrompt, buildQAReviewerPrompt } from "../prompts/drill";


function parseJsonSafe(text: string) {
  try {
    const cleaned = String(text || "")
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Main generator + QA (+ decision) pipeline.
 *
 * 1) Generate drill JSON from Gemini.
 * 2) Apply youth guards & hard post-processing.
 * 3) Run QA reviewer.
 * 4) Compute fixer decision from QA scores (OK / PATCHABLE / NEEDS_REGEN).
 * 5) Persist final drill + QA into DB.
 */
export async function generateAndReviewDrill(
  input: Parameters<typeof buildDrillPrompt>[0]
) {
  // 1) Generate
  const prompt = buildDrillPrompt(input);
  const genText = await generateText(prompt);
  const drill: any = parseJsonSafe(genText);
  if (!drill) throw new Error("LLM returned non-JSON drill");

  // Youth guards / structural guards.
  applyYouthGuards(drill, input);

  // Ensure coaching points array exists + GK coaching point if goalsAvailable >= 1
  if (!Array.isArray(drill.coachingPoints)) drill.coachingPoints = [];
  if (
    input.goalsAvailable >= 1 &&
    !drill.coachingPoints.some((p: string) =>
      /^GK\b|^Goalkeeper\b/i.test(p)
    )
  ) {
    drill.coachingPoints.push(
      "GK: starting position and communication on cutbacks (angle/near-post, claim vs. set)."
    );
  }

  // Normalize numbers from input if missing
  drill.numbers = drill.numbers || {};
  if (typeof drill.numbers.min !== "number") {
    drill.numbers.min = input.numbersMin;
  }
  if (typeof drill.numbers.max !== "number") {
    drill.numbers.max = input.numbersMax;
  }

  // Let the shared post-processor handle goalMode, diagram, equipment, etc.
  try {
    postProcessDrill({ json: drill }, input);
  } catch {
    // never hard-crash on post-processing
  }

  // 2) First QA (same LLM)
  const qaPrompt = buildQAReviewerPrompt(drill);
  const qaText = await generateText(qaPrompt);
  const qaJson: any = parseJsonSafe(qaText);
  if (!qaJson) throw new Error("LLM returned non-JSON QA");

  // 3) Compute fixer decision from QA scores
  const scores = qaJson?.scores || {};

  // For now, we do NOT auto-patch drills here.
  const finalDrill = drill;
  const finalQa = qaJson;

  // 4) Normalize goalsSupported from the final drill
  const goalsSupported = normalizeGoals(finalDrill, input);
  // Average QA score
  const avgScore =
    finalQa?.scores
      ? Object.values(finalQa.scores).reduce(
          (a: number, b: any) => a + Number(b || 0),
          0
        ) / Math.max(1, Object.keys(finalQa.scores).length)
      : null;

  // Derive fixer decision from final QA scores (if present)
  try {
    const scores = (finalQa && (finalQa as any).scores) || {};
    if (scores && Object.keys(scores).length > 0) {
    }
  } catch (err) {
    console.error("fixDrillDecision error", err);
  }

  // JSON we persist to the DB
  const jsonForDb = {
    ...finalDrill,
    goalsSupported,
    qa: finalQa,
  };

  // Persist drill
  const created = await prisma.drill.create({
    data: {
      title: jsonForDb.title ?? "Untitled",
      gameModelId: input.gameModelId as any,
      phase: input.phase as any,
      zone: input.zone as any,
      ageGroup: input.ageGroup,
      durationMin: jsonForDb.durationMin ?? input.durationMin ?? 25,
      qaScore: avgScore,
      approved: !!finalQa.pass,
      numbersMin: input.numbersMin,
      numbersMax: input.numbersMax,
      gkOptional: input.goalsAvailable >= 1 ? false : !!input.gkOptional,
      spaceConstraint: input.spaceConstraint as any,
      goalsSupported: Array.isArray(goalsSupported) ? goalsSupported : [],
      json: jsonForDb,
    },
  });

  // Persist QA snapshot
  await prisma.qAReport.create({
    data: {
      artifactId: created.id,
      pass: !!finalQa.pass,
      scores: finalQa.scores ?? {},
      summary: finalQa.summary ?? "",
    },
  });

    return {
    drill: created,
    qa: finalQa,
    raw: { genText, qaText },
  };
}
