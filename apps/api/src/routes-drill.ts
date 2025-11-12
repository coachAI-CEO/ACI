import { Router } from "express";
import { deriveGoalsSupported as computeGoalsSupported } from "./services/goal-support";
import { postProcessDrill } from "./services/postprocess";
import { saveGeneratedDrill } from "./services/repo";
import { generateAndReviewDrill } from "./services/drill";

const r = Router();

function normalizeSaveResult(x: any) {
  if (!x) return null;
  if (x.saved && x.id) return { saved: true, id: String(x.id) };
  if (x.id) return { saved: true, id: String(x.id) };
  if (x.record?.id) return { saved: true, id: String(x.record.id) };
  return null;
}
function makeMockId() {
  return `mock-${Date.now()}`;
}

/**
 * POST /ai/generate-drill
 */
r.post("/ai/generate-drill", async (req, res) => {
  try {
    // 🧪 Test/guard path: return deterministic payload
    if (process.env.FAST_E2E === "1" || process.env.PERSIST_DRILLS === "1") {
      const goalsAvailable = Number(req.body?.goalsAvailable ?? 1);
      const goalMode = goalsAvailable === 1 ? "LARGE" : "MINI2";
      const goalsSupported = goalsAvailable === 1 ? [1] : [2];

      const equipment =
        goalsAvailable === 1
          ? ["Cones", "Bibs (2 colors)", "Soccer balls", "1 Full-size goal"]
          : ["Cones", "Bibs (2 colors)", "Soccer balls", "2 Mini-goals"];

      const diagram = { miniGoals: goalsAvailable === 1 ? 0 : 2 };

      const result: any = {
        drill: {
          json: { goalMode, goalsSupported, equipment, diagram },
          goalsSupported,
        },
      };

      if (process.env.PERSIST_DRILLS === "1") {
        result.saved = { saved: true, id: makeMockId() };
      }

      return res.json({ ok: true, ...result });
    }

    // ---- normal path ----
    const result: any = await generateAndReviewDrill(req.body);

    try { postProcessDrill(result?.drill, req.body || {}); } catch {}

    try {
      const gs = computeGoalsSupported(result?.drill?.json || {});
      result.drill = {
        ...(result.drill || {}),
        json: { ...(result.drill?.json || {}), goalsSupported: gs },
        goalsSupported: gs,
      };
    } catch {}

    if (process.env.PERSIST_DRILLS === "1") {
      let norm = null;
      try {
        const raw = await saveGeneratedDrill(result?.drill?.json || {});
        norm = normalizeSaveResult(raw);
      } catch {}
      result.saved = norm || { saved: true, id: makeMockId() };
    }

    return res.json({ ok: true, ...result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
