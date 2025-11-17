import { Router } from "express";
import { generateAndReviewDrill } from "./services/drill";
import { fixDrillDecision } from "./services/fixer";

const r = Router();

/**
 * POST /coach/generate-drill-vetted
 *
 * Body: same shape as /ai/generate-drill.
 *
 * Behavior:
 * - Calls generateAndReviewDrill() up to maxAttempts times.
 * - Uses fixDrillDecision(qa.scores) to classify quality.
 * - If decision.code === "NEEDS_REGEN" → try again.
 * - If decision.code === "PATCHABLE" or "OK" → accept and return drill to user.
 * - If still no acceptable drill after maxAttempts → return 500 with friendly error.
 *
 * NOTE: We are NOT calling the LLM fixer here yet. That will be a later step
 *       when we want PATCHABLE drills to be auto-refined before returning.
 */
r.post("/coach/generate-drill-vetted", async (req, res) => {
  const input = req.body || {};
  const maxAttempts = 3;

  let lastDecision: any = null;
  let lastQa: any = null;

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await generateAndReviewDrill(input);
      const drill = result.drill;
      const qa = result.qa;

      lastQa = qa;

      const decision = fixDrillDecision(qa?.scores || null);
      lastDecision = decision;

      // Hard fail → try again (if we have attempts left)
      if (decision.code === "NEEDS_REGEN") {
        if (attempt < maxAttempts) {
          continue;
        }
        // fall through to failure response after loop
        break;
      }

      // PATCHABLE or OK → accept this drill as good enough for now
      return res.json({
        ok: true,
        drill,
        qa,
        fixDecision: decision,
        attempts: attempt,
      });
    }

    // If we get here, all attempts ended in NEEDS_REGEN (or some weird case)
    return res.status(500).json({
      ok: false,
      error:
        "Could not generate a high-quality drill after several attempts. Please try again.",
      lastDecision,
      lastQa,
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
