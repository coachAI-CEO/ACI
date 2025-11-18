import { Router } from "express";
import { generateAndReviewDrill } from "./services/drill";
import { fixDrillDecision, fixDrill } from "./services/fixer";
import { runDrillQA } from "./services/qa";

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
            qaAfter = await runDrillQA(qaTarget, input);
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

        return res.json(payload);
      }

      // Otherwise (NEEDS_REGEN), loop and try another attempt
    } catch (e: any) {
      // If something blows up hard (e.g., Gemini 503), abort and surface error
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
  return res.status(422).json(payload);
});

export default r;
