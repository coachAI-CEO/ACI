import { postProcessDrill } from "./services/postprocess";
import { Router } from "express";
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
    // FAST path for tests
    if (process.env.FAST_E2E === "1") {
      const stub = {
        drill: {
          json: {
            goalMode: req.body?.goalsAvailable === 1 ? "LARGE" : "MINI2",
            equipment: req.body?.goalsAvailable === 1
              ? ["Soccer balls","Cones","Bibs (2 colors)","1 Full-size goal"]
              : ["Cones","Bibs (2 colors)","Soccer balls","2 Mini-goals"],
            diagram: {
              miniGoals: req.body?.goalsAvailable === 1 ? 0 : 2,
              teams: req.body?.goalsAvailable === 1
                ? [{color:"blue",count:4,label:"Attack"},{color:"red",count:3,label:"Defend"},{color:"green",count:1,label:"GK"}]
                : [{color:"blue",count:4,label:"Attack"},{color:"red",count:3,label:"Defend"}]
            }
          }
        },
        qa: { pass: true, scores: {} },
        raw: {}
      };
      return res.json({ ok: true, ...stub });
    }

    // Real path
    const { generateAndReviewDrill } = await import("./services/drill");
    const result = await generateAndReviewDrill(req.body);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
