import { Router } from "express";
import { generateAndReviewDrill } from "./services/drill";
import { fixDrillDecision, fixDrill } from "./services/fixer";
import { runDrillQA } from "./services/qa";
import { postProcessGoalMode } from "./services/goals";

const r = Router();

/**
 * POST /coach/generate-drill-vetted
 *
 * Coach-facing endpoint:
 * - Loops up to COACH_MAX_DRILL_ATTEMPTS times.
 * - Uses QA scores → fixDrillDecision (OK / PATCHABLE / NEEDS_REGEN).
 * - Only returns a drill when decision is OK or PATCHABLE.
 * - For PATCHABLE, runs the LLM fixer internally (fixDrill),
 *   then re-runs QA so we have before/after scores.
 */
r.post("/coach/generate-drill-vetted", async (req, res) => {
  const debug = String(req.query.debug || "") === "1";
  const maxAttemptsEnv = process.env.COACH_MAX_DRILL_ATTEMPTS || "3";
  const maxAttempts = Number.isNaN(Number(maxAttemptsEnv))
    ? 3
    : Number(maxAttemptsEnv);

  const input = req.body || {};

  const attemptsSummary: Array<{
    title: string | null;
    scores: any;
    decision: any;
  }> = [];

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await generateAndReviewDrill(input);
      const drill = result.drill;
      const qa = result.qa;

      const decision = fixDrillDecision(qa?.scores || null);

      attemptsSummary.push({
        title:
          (drill as any)?.json?.title ??
          (drill as any)?.title ??
          null,
        scores: qa?.scores || null,
        decision,
      });

      // Only accept high-quality drills
      if (decision.code === "OK" || decision.code === "PATCHABLE") {
        let finalDrill: any = drill;
        let fixerMeta: any = null;
        let qaAfter: any = null;

        // For PATCHABLE → attempt LLM-based localized fixes + QA after
        if (decision.code === "PATCHABLE") {
          try {
            // Use the inner JSON if present (DB drill), otherwise the drill itself
            const originalPayload = (drill as any).json ?? drill;
            const fixResult = await fixDrill(originalPayload, qa);

            fixerMeta = {
              decision: fixResult.decision,
              raw: fixResult.raw,
            };

            const improved = fixResult.drill;
            if (improved) {
              if ((drill as any).json) {
                // Persist improved JSON back onto the drill wrapper
                (drill as any).json = improved;
              } else {
                finalDrill = improved;
              }
            }

            // Re-run QA on the patched drill so we have before/after
            const qaTarget = (finalDrill as any).json ?? finalDrill;
            qaAfter = await runDrillQA(qaTarget);
          } catch (e: any) {
            fixerMeta = {
              ...(fixerMeta || {}),
              error: e?.message || String(e),
            };
          }
        }

        const payload: any = {
          ok: true,
          drill: finalDrill,
          // keep original `qa` field as "before" for compatibility
          qa,
          qaBefore: qa,
          ...(qaAfter ? { qaAfter } : {}),
          fixDecision: decision,
        };

        if (fixerMeta) {
          payload.fixer = fixerMeta;
        }

        if (debug) {
          payload.attempts = attemptsSummary;
        }

        // 🔍 Logging for successful response
        logVettedRequest(input, {
          ok: true,
          attempts: attemptsSummary,
          fixer: payload.fixer || null,
          qaAfter: payload.qaAfter || null,
        });

        return res.json(payload);
      }

      // Otherwise (NEEDS_REGEN), loop and try another attempt
    } catch (e: any) {
      // If something blows up hard (e.g., Gemini 503), abort and surface error
      logVettedRequest(input, {
        ok: false,
        attempts: attemptsSummary,
        error: e?.message || String(e),
      });

      return res.status(500).json({
        ok: false,
        error: e?.message || String(e),
      });
    }
  }

  // If we reach here, all attempts were NEEDS_REGEN or non-acceptable
  const payload: any = {
    ok: false,
    error:
      "Could not generate a high-quality drill after several attempts. Please try again.",
  };
  if (debug) {
    payload.attempts = attemptsSummary;
  }

  // 🔍 Logging for non-acceptable completion
  logVettedRequest(input, {
    ok: false,
    attempts: attemptsSummary,
  });

  return res.status(422).json(payload);
});

/**
 * Dev logging helper for /coach/generate-drill-vetted.
 */
function logVettedRequest(input: any, summary: any) {
  const ts = new Date().toISOString();
  console.log("\n=================== ACI /coach/generate-drill-vetted ===================");
  console.log("Timestamp:", ts);
  console.log(
    "Config:",
    JSON.stringify(
      {
        gameModelId: input.gameModelId,
        ageGroup: input.ageGroup,
        phase: input.phase,
        zone: input.zone,
        numbersMin: input.numbersMin,
        numbersMax: input.numbersMax,
        spaceConstraint: input.spaceConstraint,
        durationMin: input.durationMin,
      },
      null,
      2,
    ),
  );

  console.log("\nAttempts Summary:");
  (summary.attempts || []).forEach((a: any, idx: number) => {
    console.log(`  Attempt ${idx + 1}:`, {
      title: a.title,
      decision: a.decision?.code,
      scores: a.scores,
    });
  });

  if (summary.fixer) {
    console.log("\nFixer:", {
      decision: summary.fixer.decision,
      raw: summary.fixer.raw,
    });
  }

  if (summary.qaAfter) {
    console.log("\nQA-After:", {
      pass: summary.qaAfter.pass,
      scores: summary.qaAfter.scores,
    });
  }

  if (summary.error) {
    console.log("\nError:", summary.error);
  }

  console.log("\nFinal Status:", summary.ok ? "SUCCESS" : "FAILURE");
  console.log(
    "=========================================================================\n",
  );
}

export default r;
