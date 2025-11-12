import { generateText } from "../gemini";
import { prisma } from "../prisma";
import { buildDrillPrompt, buildQAReviewerPrompt } from "../prompts/drill";

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

export async function generateAndReviewDrill(input: Parameters<typeof buildDrillPrompt>[0]) {
  // 1) Generate
  const prompt = buildDrillPrompt(input);
  const genText = await generateText(prompt);
  const drill = parseJsonSafe(genText);
  if (!drill) throw new Error("LLM returned non-JSON drill");
  if (!Array.isArray(drill.coachingPoints)) drill.coachingPoints = [];
  if ((input.goalsAvailable >= 1) && !drill.coachingPoints.some((p: string) => /^GK\b|^Goalkeeper\b/i.test(p))) {
    drill.coachingPoints.push("GK: starting position and communication on cutbacks (angle/near-post, claim vs. set).");
  }
  // 2) QA (same LLM)
  const qaPrompt = buildQAReviewerPrompt(drill);
  const qaText = await generateText(qaPrompt);
  const qaJson = parseJsonSafe(qaText);
  if (!qaJson) throw new Error("LLM returned non-JSON QA");

  // 3) Persist
  const avgScore =
    qaJson?.scores
      ? Object.values(qaJson.scores).reduce((a: number, b: any) => a + Number(b || 0), 0) /
        Math.max(1, Object.keys(qaJson.scores).length)
      : null;

  const created = await prisma.drill.create({
    data: {
      title: drill.title ?? "Untitled",
      gameModelId: input.gameModelId as any,
      phase: input.phase as any,
      zone: input.zone as any,
      ageGroup: input.ageGroup,
      durationMin: drill.durationMin ?? input.durationMin ?? 25,
      qaScore: avgScore,
      approved: !!qaJson.pass,
      numbersMin: input.numbersMin,
      numbersMax: input.numbersMax,
      gkOptional: (input.goalsAvailable >= 1) ? false : !!input.gkOptional,
      spaceConstraint: input.spaceConstraint as any,
      goalsSupported: [input.goalsAvailable],
      json: drill,
    },
  });

  await prisma.qAReport.create({
    data: {
      artifactId: created.id,
      pass: !!qaJson.pass,
      scores: qaJson.scores ?? {},
      summary: qaJson.summary ?? "",
    },
  });

  return { drill: created, qa: qaJson, raw: { genText, qaText } };
}
