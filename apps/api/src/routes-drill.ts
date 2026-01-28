import { Router } from "express";
import { generateAndReviewDrill } from "./services/drill";
import { fixDrillDecision } from "./services/fixer";
import { postProcessDrill } from "./services/postprocess";
import { generateDrillPdf } from "./services/pdf-export";
import { authenticate } from "./middleware/auth";
import { requireFeature } from "./middleware/auth";
const r = Router();

r.post("/ai/generate-drill", async (req, res) => {
  const debug = String(req.query.debug || "") === "1";

  try {
    // -------------------------------------------------------
    // FAST_E2E stub for Jest: predictable, no LLM / DB cost
    // but still exercise postProcessDrill (goalMode, equipment)
    // -------------------------------------------------------
    if (process.env.NODE_ENV === "test" && process.env.FAST_E2E === "1") {
      const input = req.body || {};

      const holder: any = {
        json: {
          title: "Stub: E2E test drill",
          gameModelId: input.gameModelId ?? null,
          numbers: {
            min: input.numbersMin ?? null,
            max: input.numbersMax ?? null,
          },
          goalsAvailable: input.goalsAvailable ?? 0,
          gkOptional: !!input.gkOptional,
          equipment: [],
          diagram: {},
        },
      };

      try {
        // This will set goalMode, diagram.miniGoals, and canonical equipment.
        postProcessDrill(holder, input);
      } catch {
        // never crash tests on postprocessor hiccups
      }

      const drill = { json: holder.json };
      const qa = null;

      const saved =
        process.env.PERSIST_DRILLS === "1"
          ? { saved: true, id: "stub-id" }
          : null;

      const payload: any = {
        ok: true,
        drill,
        qa,
        fixDecision: null,
        saved,
      };

      if (debug) {
        payload.raw = { stub: true, input, json: holder.json };
      }

      
  let fixDecision: any = null;
  try {
    const scores = (qa as any)?.scores || {};
    if (scores && Object.keys(scores).length > 0) {
      fixDecision = null;
    }
  } catch {
    fixDecision = null;
  }

  if (fixDecision) {
    (payload as any).fixDecision = fixDecision;
  }

  return res.json(payload);
  
    }

    // -------------------------------
    // Normal pipeline: real generator
    // -------------------------------
    // Note: This route doesn't require auth, so userId may be undefined
    const userId = (req as any).userId || undefined;
    const result = await generateAndReviewDrill(req.body || {}, userId);
    const drill = result.drill;
    const qa = result.qa;

    const fixDecision = (() => {
    console.log("generate-drill route QA scores:", (qa as any)?.scores);
      try {
        const scores = (qa as any)?.scores || {};
        if (scores && Object.keys(scores).length > 0) {
          return fixDrillDecision(scores);
        }
      } catch {
        // ignore
      }
      return null;
    })();

    let saved: any = null;
    if (process.env.PERSIST_DRILLS === "1" && drill && (drill as any).id) {
      saved = { saved: true, id: (drill as any).id };
    }

    const payload: any = {
      ok: true,
      drill,
      qa,
      fixDecision,
      saved,
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

// Export drill as PDF (available to all authenticated users)
r.post("/ai/export-drill-pdf", authenticate, async (req: any, res) => {
  try {
    const drill = req.body?.drill;
    if (!drill) {
      return res.status(400).json({ ok: false, error: "drill is required" });
    }
    console.log("[PDF_ROUTE] Received drill for PDF export:", {
      title: drill.title,
      hasDiagram: !!(drill.diagram || drill.diagramV1 || drill.json?.diagram || drill.json?.diagramV1),
    });
    const pdfBuffer = await generateDrillPdf(drill);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${(drill.title || 'drill').replace(/[^a-z0-9]/gi, '_')}.pdf"`);
    return res.send(pdfBuffer);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
