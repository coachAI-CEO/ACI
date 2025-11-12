import { Router } from "express";
import { generateAndReviewDrill } from "./services/drill";
const r = Router();

/**
 * Body example:
 * {
 *   "gameModelId":"POSSESSION",
 *   "ageGroup":"U12",
 *   "coachLevel":"advanced",
 *   "playerLevel":"developing",
 *   "phase":"ATTACKING",
 *   "zone":"ATTACKING_THIRD",
 *   "numbersMin":10, "numbersMax":12,
 *   "gkOptional": true,
 *   "goalsAvailable": 2,
 *   "spaceConstraint":"HALF",
 *   "durationMin":25,
 *   "titleHint":"Switch → third-man finish"
 * }
 */
r.post("/ai/generate-drill", async (req, res) => {
  try {
    const result = await generateAndReviewDrill(req.body);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
