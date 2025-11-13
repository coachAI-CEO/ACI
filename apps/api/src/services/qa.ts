export type DrillQAScores = {
  structure: number;
  gameModel: number;
  psych: number;
  clarity: number;
  realism: number;
  constraints: number;
  safety: number;
};

export interface DrillQA {
  pass: boolean;
  scores: DrillQAScores;
  notes: string[];
}

/**
 * Deterministic QA stub (no AI yet).
 *
 * It checks:
 * - structure: title, description, coaching points, organization
 * - gameModel: gameModelId present
 * - psych: psychTheme present
 * - clarity: based on description + coaching points richness
 * - constraints: goalsSupported/goalMode present
 * - realism & safety: conservative defaults unless structure is really bad
 *
 * PASS ONLY IF all dimensions meet strict thresholds.
 */
export function runDrillQAStub(drill: any): DrillQA {
  const json = drill?.json ?? drill ?? {};
  const notes: string[] = [];

  // --- Structural checks ---
  const titleOk =
    typeof json.title === "string" && json.title.trim().length >= 8;

  const descriptionOk =
    typeof json.description === "string" &&
    json.description.trim().length >= 40; // at least a couple of sentences

  const coachingOk =
    Array.isArray(json.coachingPoints) &&
    json.coachingPoints.filter((p: any) => String(p || "").trim().length > 0)
      .length >= 3;

  const orgOk =
    typeof json.organization === "string" &&
    json.organization.trim().length >= 20;

  const structureOk = titleOk && descriptionOk && coachingOk && orgOk;

  // --- Game model / psych / constraints ---
  const gameModelOk =
    typeof json.gameModelId === "string" &&
    ["POSSESSION", "PRESSING", "TRANSITION", "COACHAI"].includes(
      json.gameModelId
    );

  const psychOk =
    typeof json.psychTheme === "string" &&
    json.psychTheme.trim().length > 0;

  const constraintsOk =
    Array.isArray(json.goalsSupported) &&
    json.goalsSupported.length > 0 &&
    json.goalMode != null;

  // --- Clarity: richer text & coaching detail ---
  const clarityOk =
    descriptionOk &&
    coachingOk &&
    (typeof json.keyDetail === "string"
      ? json.keyDetail.trim().length >= 20
      : true);

  // --- Realism & safety: conservative defaults based on structure ---
  const realismOk = structureOk;
  const safetyOk = true; // we only flag if something obvious appears, which we don't yet

  // --- Map to 0–5 scores ---
  const scores: DrillQAScores = {
    structure: structureOk ? 5 : 2,
    gameModel: gameModelOk ? 5 : 2,
    psych: psychOk ? 5 : 2,
    clarity: clarityOk ? 5 : 1,
    realism: realismOk ? 5 : 2,
    constraints: constraintsOk ? 5 : 2,
    safety: safetyOk ? 5 : 3,
  };

  // --- Strict thresholds for pass ---
  const thresholds: Record<keyof DrillQAScores, number> = {
    structure: 4,
    gameModel: 4,
    psych: 4,
    clarity: 4,
    realism: 4,
    constraints: 4,
    safety: 4,
  };

  const failingKeys = (Object.entries(scores) as [keyof DrillQAScores, number][])
    .filter(([k, v]) => v < thresholds[k])
    .map(([k]) => k);

  const pass = failingKeys.length === 0;

  // --- Build notes ---
  if (!structureOk) {
    notes.push(
      "Structure: strengthen title, description, organization, and coaching points (aim for ≥3 specific, actionable points)."
    );
  }
  if (!gameModelOk) {
    notes.push(
      "Game model: gameModelId should be one of POSSESSION, PRESSING, TRANSITION, or COACHAI and must be set on the drill JSON."
    );
  }
  if (!psychOk) {
    notes.push(
      "Psych: psychTheme is missing or too short; add a clear psychological focus aligned with the game model."
    );
  }
  if (!clarityOk) {
    notes.push(
      "Clarity: description and coaching points should clearly explain setup, triggers, and success criteria for coaches."
    );
  }
  if (!constraintsOk) {
    notes.push(
      "Constraints: goalsSupported / goalMode should be correctly set (0/1/2) via post-process + selection logic."
    );
  }
  if (!realismOk) {
    notes.push(
      "Realism: make sure the drill reflects realistic player numbers, spaces, and decisions for the age group."
    );
  }
  if (!safetyOk) {
    notes.push(
      "Safety: check spacing, contact level, and intensity to ensure suitability for the age group."
    );
  }

  if (notes.length === 0) {
    notes.push(
      "QA: strict thresholds met on all stub checks (structure, game model, psych, clarity, constraints, realism, safety). Full AI reviewer still TODO."
    );
  } else {
    notes.unshift(
      "QA: strict thresholds NOT met for some dimensions. Scores are 0–5 and pass=true only when all dimensions meet their thresholds."
    );
  }

  return { pass, scores, notes };
}
