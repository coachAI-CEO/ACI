export type DrillQAScores = {
  structure?: number;
  gameModel?: number;
  psych?: number;
  clarity?: number;
  realism?: number;
  constraints?: number;
  safety?: number;
};

export type FixDecisionCode = "NO_QA_OR_PASS" | "NEEDS_REGEN" | "PATCHABLE" | "OK";

export interface FixDecision {
  code: FixDecisionCode;
  reason: string;
}

function normalizeScores(scores: Partial<DrillQAScores> | null | undefined): number[] {
  if (!scores) return [];

  const keys: (keyof DrillQAScores)[] = [
    "structure",
    "gameModel",
    "psych",
    "clarity",
    "realism",
    "constraints",
    "safety",
  ];

  const vals = keys
    .map((k) => {
      const v = (scores as any)[k];
      return typeof v === "number" && !Number.isNaN(v) ? v : null;
    })
    .filter((v) => v !== null) as number[];

  return vals;
}

/**
 * Pure decision engine: given QA scores, decide what we should do.
 *
 * - NO_QA_OR_PASS → no scores, just log / ignore.
 * - NEEDS_REGEN   → at least one dim ≤ 2.
 * - OK            → all dims ≥ 4.
 * - PATCHABLE     → all dims ≥ 3, at least one = 3 (or fallback case).
 */
export function fixDrillDecision(
  scores: Partial<DrillQAScores> | null | undefined
): FixDecision {
  const vals = normalizeScores(scores);

  if (!vals.length) {
    return {
      code: "NO_QA_OR_PASS",
      reason: "No QA scores present; fixer is a no-op except for logging / metadata.",
    };
  }

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const hasThree = vals.some((v) => v === 3);
  const allAtLeastFour = vals.every((v) => v >= 4);

  // Hard fail: any dimension ≤ 2 → force regeneration
  if (min <= 2) {
    return {
      code: "NEEDS_REGEN",
      reason: "At least one QA dimension is ≤2; treat as hard fail → full regeneration required.",
    };
  }

  // Clean pass: all ≥4
  if (allAtLeastFour) {
    return {
      code: "OK",
      reason: "All QA dimensions are ≥4 → high quality, no fixer needed.",
    };
  }

  // Patchable: all ≥3 but at least one exactly 3
  if (hasThree && min >= 3) {
    return {
      code: "PATCHABLE",
      reason: "All QA dimensions are ≥3 but at least one = 3 → patchable with targeted fixes.",
    };
  }

  // Fallback: values exist but don't hit the above patterns
  return {
    code: "PATCHABLE",
    reason: `Scores in [${min}, ${max}] → treat as patchable with targeted fixes.`,
  };
}

/**
 * Fixer stub:
 * - Computes decision via fixDrillDecision.
 * - Does NOT mutate the drill yet (we keep generator stable).
 * - raw.actions gives a simple trace for debugging.
 */
export async function fixDrill(drill: any, qa: any) {
  const decision = fixDrillDecision(qa?.scores || null);

  const actions: Array<{ code: string; reason: string }> = [];

  if (decision.code === "NEEDS_REGEN") {
    actions.push({
      code: "NEEDS_REGEN",
      reason:
        "At least one QA dimension is ≤2; recommend regenerating drill instead of auto-fix.",
    });
  } else if (decision.code === "PATCHABLE") {
    actions.push({
      code: "PATCHABLE",
      reason: "Safe to apply localized text / constraint fixes via LLM.",
    });
  } else if (decision.code === "OK") {
    actions.push({
      code: "OK",
      reason: "Drill quality is high; no fixer mutations needed.",
    });
  } else {
    actions.push({
      code: "NO_QA_OR_PASS",
      reason: "No usable QA scores; fixer is effectively a no-op.",
    });
  }

  return {
    drill,
    qa,
    decision,
    raw: {
      fixed: false,
      actions,
    },
  };
}
