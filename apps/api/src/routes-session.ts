import express from "express";
import { generateAndReviewSession } from "./services/session";
import { generateProgressiveSessionSeries } from "./services/session-progressive";
import { findSimilarSessions } from "./services/vault";
import { generateSessionPdf } from "./services/pdf-export";

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

// Generate progressive series
r.post("/ai/generate-progressive-series", async (req, res) => {
  const debug = String(req.query.debug || "") === "1";
  const skipRecommendation = String(req.query.skipRecommendation || "") === "1";

  try {
    const body = req.body || {};
    const baseInput = body.baseInput || body;
    const numberOfSessions = Number(body.numberOfSessions) || 3;

    if (numberOfSessions < 2 || numberOfSessions > 10) {
      return res.status(400).json({
        ok: false,
        error: "numberOfSessions must be between 2 and 10",
      });
    }

    let recommendations: any[] = [];
    if (!skipRecommendation) {
      try {
        if (baseInput.gameModelId && baseInput.ageGroup) {
          recommendations = await findSimilarSessions(baseInput, 0.85);
          const seriesRecommendations = recommendations.filter(r => r.session.isSeries);
          if (seriesRecommendations.length > 0) {
            return res.json({
              ok: true,
              hasRecommendations: true,
              recommendations: seriesRecommendations.slice(0, 5),
              message: `Found ${seriesRecommendations.length} similar series in vault. Use skipRecommendation=1 to generate new.`,
            });
          }
        }
      } catch (e) {
        console.error("[VAULT] Error checking for similar series:", e);
      }
    }

    const result = await generateProgressiveSessionSeries(baseInput, numberOfSessions);
    const payload: any = {
      ...result,
      recommendations: recommendations.length > 0 ? recommendations.slice(0, 3) : [],
    };

    if (debug) {
      payload.debug = {
        numberOfSessions,
      };
    }

    return res.json(payload);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Export session as PDF
r.post("/ai/export-session-pdf", async (req, res) => {
  try {
    const session = req.body?.session;
    if (!session) {
      return res.status(400).json({ ok: false, error: "session is required" });
    }
    console.log("[PDF_ROUTE] Received session for PDF export:", {
      title: session.title,
      drillsCount: session.drills?.length,
      firstDrillHasDiagram: !!(session.drills?.[0]?.diagram || session.drills?.[0]?.diagramV1),
      firstDrillKeys: session.drills?.[0] ? Object.keys(session.drills[0]) : [],
    });
    const pdfBuffer = await generateSessionPdf(session);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=session.pdf");
    return res.send(pdfBuffer);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;

