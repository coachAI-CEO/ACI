import { Router } from "express";
import { fixDrill } from "./services/fixer";

const r = Router();

/**
 * POST /ai/fix-drill
 * Body: { original: any, qa: any }
 */
r.post("/ai/fix-drill", async (req, res) => {
  try {
    const { original, qa } = req.body || {};
    const result = await fixDrill(original, qa);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
