import { Router } from "express";
import { fixDrill } from "./services/fixer";

const r = Router();

/**
 * POST /ai/fix-drill
 * body: { original: <drillJson>, qa: <qaJson>, guard: { gameModelId, ageGroup, phase, zone, goalsAvailable, durationMin } }
 */
r.post("/ai/fix-drill", async (req, res) => {
  try {
    const { original, qa, guard } = req.body || {};
    const result = await fixDrill(original, qa, guard);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
