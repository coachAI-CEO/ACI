import { prisma } from "../prisma";
import { generateText } from "../gemini";
import { getCoachLanguageProfile, buildSessionQAReviewerPrompt } from "../prompts/session";
import { getAgeGroupMaturityNote, getDefaultPlayerAndCoachLevel } from "./game-model-readiness";
import { resolveAgeGroupMaturityNote } from "./age-group-maturity";

export type TrainingIntent = {
  tacticalProblem: string;
  mustBeAvailable: string;
  mustBeAvoided: string;
};

type SubprincipleFields = {
  trigger: string;
  response: string;
  antiPattern: string | null;
};

/**
 * Distinguishes "the model returned unparseable text" from every other
 * failure mode in this chain (team not found, DB error, etc.) so a caller
 * can react differently -- e.g. retry the same call vs. surface a hard error.
 */
export class LlmResponseParseError extends Error {
  constructor(public readonly rawResponse: string, cause: unknown) {
    super(`Failed to parse LLM JSON response: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "LlmResponseParseError";
  }
}

function parseJsonResponse<T>(text: string): T {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new LlmResponseParseError(text, err);
  }
}

/**
 * Call 1: derive a narrow training intent from a subprinciple. Deliberately
 * produces a SMALL structured artifact -- tacticalProblem / mustBeAvailable /
 * mustBeAvoided -- rather than passing the raw trigger/response straight
 * through. Call 2 conditions on THIS output, not on the subprinciple text
 * directly, which is what forces the constraint-generation step to actually
 * derive from the priority instead of independently pattern-matching a
 * plausible-sounding drill for the drillType. See the architecture doc's
 * finding: a single-shot call can only ever make a principle and a
 * constraint CO-OCCUR in the same text, never causally depend on one
 * another -- splitting this into two calls, each conditioned on the
 * previous one's OUTPUT rather than its input, is what fixes that.
 */
export async function deriveTrainingIntent(
  subprinciple: SubprincipleFields,
  context: { ageGroup: string; playerLevel: string; maturityNote?: string }
): Promise<TrainingIntent> {
  const maturityNote = context.maturityNote ?? getAgeGroupMaturityNote(context.ageGroup);
  const prompt = [
    "You are translating a football club's game-model subprinciple into a training intent for one drill.",
    "",
    `TRIGGER: ${subprinciple.trigger}`,
    `RESPONSE: ${subprinciple.response}`,
    ...(subprinciple.antiPattern ? [`ANTI-PATTERN: ${subprinciple.antiPattern}`] : []),
    `Context: ageGroup=${context.ageGroup}, playerLevel=${context.playerLevel}`,
    ...(maturityNote ? [`Age-group maturity: ${maturityNote}`] : []),
    "",
    "Produce a training intent -- NOT a drill, NOT constraints yet. Just the underlying design problem:",
    "- tacticalProblem: one sentence naming the specific decision/action players must repeatedly face.",
    "- mustBeAvailable: what has to be true in the drill's setup for the trigger to occur repeatedly.",
    "- mustBeAvoided: the anti-pattern restated as a design requirement (what the constraints must actively prevent, not just avoid rewarding).",
    "",
    'Output JSON only: { "tacticalProblem": string, "mustBeAvailable": string, "mustBeAvoided": string }',
  ].join("\n");

  const text = await generateText(prompt, { maxOutputTokens: 400 });
  return parseJsonResponse<TrainingIntent>(text);
}

export type GeneratedDrill = {
  title: string;
  drillType: string;
  organization: {
    area: { lengthYards: number; widthYards: number };
    setupSteps: string[];
    rotation: string;
    restarts: string;
    scoring: string;
  };
  constraints: string[];
  coachingPoints: string[];
};

/**
 * Call 2: generate the actual drill, conditioned ONLY on Call 1's intent
 * (plus session context and the coach-level language tier) -- not on the
 * raw subprinciple. This is the step that was previously a single call
 * pattern-matching a plausible drill for the drillType; now it has to
 * design constraints that serve mustBeAvailable and actively block
 * mustBeAvoided, because that's the only tactical context it's given.
 */
export async function generateDrillFromIntent(
  intent: TrainingIntent,
  context: {
    ageGroup: string;
    playerLevel: string;
    coachLevel: string;
    drillType?: string;
    maturityNote?: string;
  }
): Promise<GeneratedDrill> {
  const languageProfile = getCoachLanguageProfile(context.coachLevel);
  const maturityNote = context.maturityNote ?? getAgeGroupMaturityNote(context.ageGroup);

  const prompt = [
    "SYSTEM: Output ONE JSON object for a single football training drill.",
    "",
    languageProfile,
    "",
    `Design a ${context.drillType || "TACTICAL"} drill for ageGroup=${context.ageGroup}, playerLevel=${context.playerLevel}.`,
    ...(maturityNote ? [`Age-group maturity: ${maturityNote}`] : []),
    "",
    "The drill's constraints (rules, scoring, restart conditions) must be built so that:",
    `- ${intent.mustBeAvailable}`,
    `- The design actively prevents: ${intent.mustBeAvoided}`,
    `- Players repeatedly face this problem: ${intent.tacticalProblem}`,
    "",
    "Do not restate the tactical problem as prose in the constraints -- build actual rules/scoring/restarts",
    "that make it structurally true, the way a real coach would design a session.",
    "",
    "Output JSON only:",
    "{",
    '  "title": string,',
    '  "drillType": string,',
    '  "organization": { "area": {"lengthYards": number, "widthYards": number}, "setupSteps": string[], "rotation": string, "restarts": string, "scoring": string },',
    '  "constraints": string[] (3-5 items),',
    '  "coachingPoints": string[] (2-3 items)',
    "}",
  ].join("\n");

  const text = await generateText(prompt, { maxOutputTokens: 800 });
  return parseJsonResponse<GeneratedDrill>(text);
}

export type PriorityDrillResult = {
  intent: TrainingIntent;
  drill: GeneratedDrill;
  qa: {
    pass: boolean;
    principleAlignment?: { contradicted: boolean; contradictingConstraint: string | null; explanation: string };
    raw: unknown;
  };
};

/**
 * Full chain for one TrainingPriority: Call 1 -> Call 2 -> the hard-fail
 * principle-alignment QA gate. Returns the generated drill AND the QA
 * verdict together -- callers decide whether a failed verdict blocks
 * showing the drill to a coach; this function doesn't discard the drill on
 * failure, since the failure itself (and why) is useful to see.
 */
export async function generateDrillForTrainingPriority(trainingPriorityId: string): Promise<PriorityDrillResult> {
  const priority = await prisma.trainingPriority.findUniqueOrThrow({
    where: { id: trainingPriorityId },
    include: {
      subprinciple: { select: { trigger: true, response: true, antiPattern: true } },
      team: { select: { ageGroup: true, playerLevel: true, clubId: true } },
    },
  });

  const ageGroup = priority.team.ageGroup;
  // Team has no coachLevel field yet and playerLevel is null on every real
  // seeded team -- fall back to the age/format-band default (matching the
  // existing BEGINNER-only-pairs-with-USSF_D rule) rather than a flat
  // hardcode that would give U8 teams adult-level vocabulary/difficulty.
  const defaults = getDefaultPlayerAndCoachLevel(ageGroup);
  const playerLevel = priority.team.playerLevel || defaults.playerLevel;
  const coachLevel = defaults.coachLevel;
  // Club's own editable maturity note if the DOC has set one, else the
  // shared default -- resolved once here so both calls below use the same
  // note rather than each independently hitting the DB.
  const maturityNote = await resolveAgeGroupMaturityNote(priority.team.clubId, ageGroup);

  const intent = await deriveTrainingIntent(priority.subprinciple, { ageGroup, playerLevel, maturityNote });
  const drill = await generateDrillFromIntent(intent, { ageGroup, playerLevel, coachLevel, maturityNote });

  const qaPrompt = buildSessionQAReviewerPrompt(
    { title: drill.title, ageGroup, drills: [{ ...drill, diagram: { players: [], arrows: [], annotations: [], safeZones: [], goals: [], pitch: {} } }] },
    priority.subprinciple
  );
  const qaText = await generateText(qaPrompt, { timeout: 45000, retries: 0 });
  const qaJson = parseJsonResponse<{ pass: boolean; principleAlignment?: PriorityDrillResult["qa"]["principleAlignment"] }>(qaText);

  return {
    intent,
    drill,
    qa: { pass: qaJson.pass, principleAlignment: qaJson.principleAlignment, raw: qaJson },
  };
}
