import { DRILL_FIXER_SYSTEM_PROMPT } from "./prompts/drillFixerPrompt";

// TODO: if you already have a QAScores type, reuse that instead.
export type QAScores = {
  structure: number;
  gameModel: number;
  psych: number;
  clarity: number;
  realism: number;
  constraints: number;
  safety: number;
};

export type FixDecisionCode = "OK" | "PATCHABLE" | "NEEDS_REGEN";

export type Drill = any; // replace with your real Drill type if you have one

export type DrillFixerInput = {
  drill: Drill;
  qaScores: QAScores;
  qaNotes?: string;
  constraints: {
    ageGroup: string;
    gameModelId: string;
    phase: string;
    zone: string;
    spaceConstraint: string;
    goalsAvailable: number;
    numbersMin: number;
    numbersMax: number;
  };
};

export type DrillFixerOutput = {
  drill: Drill | null;
  changelog: {
    field: string;
    change: string;
    reason: string;
  }[];
};

// IMPORTANT: wire this to your real AI client.
// Replace the body of callModel with your actual call to Gemini/OpenAI/Claude.
async function callModel(params: { system: string; user: string }): Promise<string> {
  throw new Error("callModel not wired yet. Import your real AI client here.");
}

export async function runDrillFixer(
  input: DrillFixerInput
): Promise<DrillFixerOutput> {
  const userContent = JSON.stringify(
    {
      drill: input.drill,
      qaScores: input.qaScores,
      qaNotes: input.qaNotes ?? null,
      constraints: input.constraints,
    },
    null,
    2
  );

  const raw = await callModel({
    system: DRILL_FIXER_SYSTEM_PROMPT,
    user: userContent,
  });

  let parsed: DrillFixerOutput;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse fixer JSON. Raw response:\n${raw}\nError: ${(err as Error).message}`
    );
  }

  if (!parsed || typeof parsed !== "object" || !("changelog" in parsed)) {
    throw new Error(
      `Fixer response missing expected shape. Raw response:\n${raw}`
    );
  }

  return parsed;
}
