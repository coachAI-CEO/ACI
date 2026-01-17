import { generateText, setMetricsContext, clearMetricsContext } from "../gemini";
import type { Drill } from "../types/drill";

export type DrillQAScores = {
  structure?: number;
  gameModel?: number;
  psych?: number;
  clarity?: number;
  realism?: number;
  constraints?: number;
  safety?: number;
};

export type SessionQAScores = {
  structure?: number;
  gameModel?: number;
  psych?: number;
  clarity?: number;
  realism?: number;
  constraints?: number;
  safety?: number;
  progression?: number; // Additional score for session drill progression
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
  // BYPASS QA: If env flag set, always accept drills (for debugging)
  if (process.env.BYPASS_QA === "1") {
    return {
      code: "OK",
      reason: "QA BYPASSED via BYPASS_QA=1 flag (debugging mode)",
    };
  }

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

  // Fallback: values exist but do not hit the above patterns
  return {
    code: "PATCHABLE",
    reason: "Scores are mixed; treat as patchable with targeted fixes.",
  };
}

/**
 * Session fixer decision - same logic as drill fixer but with progression score
 */
export function fixSessionDecision(
  scores: Partial<SessionQAScores> | null | undefined
): FixDecision {
  // BYPASS QA: If env flag set, always accept sessions (for debugging)
  if (process.env.BYPASS_QA === "1") {
    return {
      code: "OK",
      reason: "QA BYPASSED via BYPASS_QA=1 flag (debugging mode)",
    };
  }

  const keys: (keyof SessionQAScores)[] = [
    "structure",
    "gameModel",
    "psych",
    "clarity",
    "realism",
    "constraints",
    "safety",
    "progression",
  ];

  const vals = keys
    .map((k) => {
      const v = (scores as any)?.[k];
      return typeof v === "number" && !Number.isNaN(v) ? v : null;
    })
    .filter((v) => v !== null) as number[];

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

  // Fallback: values exist but do not hit the above patterns
  return {
    code: "PATCHABLE",
    reason: "Scores are mixed; treat as patchable with targeted fixes.",
  };
}

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

function buildInlineFixerPrompt(drill: any, qa: any): string {
  const prettyDrill = JSON.stringify(drill, null, 2);
  const prettyQA = JSON.stringify(qa, null, 2);

  return [
    "You are CoachAI-Fixer, a UEFA A-license coach and elite training-session editor.",
    "",
    "You receive:",
    "1) A youth soccer drill in JSON called 'original'.",
    "2) A QA report for that drill in JSON called 'qa'.",
    "",
    "Use the QA to apply only the minimum necessary fixes so the drill is runnable, realistic, and aligned with the game model and psychological intent.",
    "Preserve ageGroup, phase, zone, numbers, and overall tactical idea.",
    "",
    "Return ONLY a single JSON object representing the improved drill.",
    "Do NOT wrap it in markdown code fences.",
    "",
    "Here is 'original' (the drill):",
    prettyDrill,
    "",
    "Here is 'qa' (the review):",
    prettyQA,
  ].join("\n");
}

/**
 * Fixer:
 * - Computes decision via fixDrillDecision.
 * - NEEDS_REGEN / OK / NO_QA_OR_PASS → never calls LLM.
 * - PATCHABLE:
 *   - If USE_LLM_FIXER !== '1': behaves like stub (no LLM).
 *   - If USE_LLM_FIXER === '1': calls Gemini and returns improved drill when parseable.
 */
export async function fixDrill(drill: Partial<Drill>, qa: any) {
  const decision = fixDrillDecision(qa?.scores || null);

  const actions: Array<{ code: string; reason: string }> = [];

  // 1) NEEDS_REGEN: Try fixing first (don't skip LLM)
  // We'll attempt to fix even low-scoring drills before regenerating
  if (decision.code === "NEEDS_REGEN") {
    // Continue to LLM fixer attempt below (don't return early)
    actions.push({
      code: "NEEDS_REGEN",
      reason: "At least one QA dimension is ≤2; attempting fix before regenerating.",
    });
  }

  if (decision.code === "OK") {
    actions.push({
      code: "OK",
      reason: "Drill quality is high; no fixer mutations needed.",
    });
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

  if (decision.code === "NO_QA_OR_PASS") {
    actions.push({
      code: "NO_QA_OR_PASS",
      reason: "No usable QA scores; fixer is effectively a no-op.",
    });
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

  // 2) NEEDS_REGEN or PATCHABLE — attempt LLM fix if enabled
  if (decision.code !== "PATCHABLE" && decision.code !== "NEEDS_REGEN") {
    actions.push({
      code: "UNKNOWN",
      reason: "Unexpected fixer decision code; skipping LLM fixer.",
    });
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

  if (process.env.USE_LLM_FIXER !== "1") {
    actions.push({
      code: decision.code,
      reason: `LLM fixer disabled by env (USE_LLM_FIXER != '1'); returning original drill.`,
    });
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

  // 3) NEEDS_REGEN or PATCHABLE + LLM allowed → call Gemini to fix
  try {
    // Set metrics context for fixer
    setMetricsContext({
      operationType: "fixer",
    });
    
    const prompt = buildInlineFixerPrompt(drill, qa);
    const text = await generateText(prompt);
    clearMetricsContext();
    
    const fixedJson = parseJsonSafe(text);

    if (fixedJson && typeof fixedJson === "object") {
      actions.push({
        code: decision.code,
        reason: `Applied LLM-based fixes to the drill based on QA (${decision.code}).`,
      });

      const merged = {
        ...drill,
        ...fixedJson,
      };

      return {
        drill: merged,
        qa,
        decision,
        raw: {
          fixed: true,
          actions,
        },
      };
    }

    actions.push({
      code: "PATCHABLE",
      reason: "LLM response could not be parsed as JSON; returned original drill.",
    });
    return {
      drill,
      qa,
      decision,
      raw: {
        fixed: false,
        actions,
      },
    };
  } catch (err: any) {
    actions.push({
      code: "PATCHABLE",
      reason: "Error during LLM fixer call; returned original drill.",
    });
    return {
      drill,
      qa,
      decision,
      raw: {
        fixed: false,
        error: err?.message || String(err),
        actions,
      },
    };
  }
}
