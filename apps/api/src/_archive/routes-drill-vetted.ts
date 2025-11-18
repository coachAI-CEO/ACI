import { Router } from "express";
import { generateAndReviewDrill } from "./services/drill";
import { fixDrill } from "./services/fixer";

const r = Router();

/**
 * POST /coach/generate-drill-vetted
 *
 * Body: same shape as /ai/generate-drill.
 *
 * Behavior:
 * - Calls generateAndReviewDrill() up to maxAttempts times.
 * - Passes each (drill, qa) through fixDrill(), which:
 *     - Computes decision via fixDrillDecision(qa.scores).
 *     - For NEEDS_REGEN / OK / NO_QA_OR_PASS → never calls LLM.
 *     - For PATCHABLE:
 *         - If USE_LLM_FIXER !== "1": returns original drill (stub).
 *         - If USE_LLM_FIXER === "1": calls Gemini to apply localized fixes.
 * - If final decision.code === "NEEDS_REGEN" → try again (if attempts left).
 * - If decision.code === "PATCHABLE" or "OK" (or NO_QA_OR_PASS) → accept and return drill to user.
 * - If still no acceptable drill after maxAttempts → return 500 with friendly error.
 */
r.post("/coach/generate-drill-vetted", async (req, res) => {
  const input = req.body || {};
  const maxAttempts = 3;

  let lastDecision: any = null;
  let lastQa: any = null;
  let lastRaw: any = null;

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // 1) Generate + QA in one go
      const result = await generateAndReviewDrill(input);
      let drill = result.drill;
      let qa = result.qa;

      // 2) Run through fixer pipeline (may or may not call LLM)
      const fixerResult = await fixDrill(drill, qa);
      drill = fixerResult.drill;
      qa = fixerResult.qa;
      const decision = fixerResult.decision;
      const raw = fixerResult.raw;

      lastDecision = decision;
      lastQa = qa;
      lastRaw = raw;

      // 3) Hard fail → try again (if we have attempts left)
      if (decision.code === "NEEDS_REGEN") {
        if (attempt < maxAttempts) {
          continue;
        }
        // fall through to failure response after loop
        break;
      }

      // 4) PATCHABLE / OK / NO_QA_OR_PASS / UNKNOWN → accept this drill for now
      return res.json({
        ok: true,
        drill,
        qa,
        fixDecision: decision,
        fixerRaw: raw,
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
      lastRaw,
    });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
