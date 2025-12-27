import express from "express";
import { generateAndReviewSession } from "./services/session";

const r = express.Router();

r.post("/ai/generate-session", async (req, res) => {
  const debug = String(req.query.debug || "") === "1";

  try {
    // -------------------------------
    // Normal pipeline: real generator
    // -------------------------------
    const result = await generateAndReviewSession(req.body || {});
    const session = result.session;
    const qa = result.qa;

    const fixDecision = result.fixDecision;

    const payload: any = {
      ok: true,
      session,
      qa,
      fixDecision,
    };

    if (debug) {
      payload.raw = result.raw || {};
    }

    return res.json(payload);
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;

