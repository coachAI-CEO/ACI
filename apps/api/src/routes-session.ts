import express from "express";
import type { SessionPromptInput } from "./prompts/session";
import { generateAndReviewSession } from "./services/session";
import { generateProgressiveSessionSeries } from "./services/session-progressive";
import { findSimilarSessions } from "./services/vault";
import { generateSessionPdf, generateCompactSessionPdf } from "./services/pdf-export";
import { generateText, setMetricsContext, clearMetricsContext } from "./gemini";
import { extractRefCodes, lookupByRefCode } from "./utils/ref-code";
import { authenticate, requireFeature, AuthRequest } from "./middleware/auth";
import { checkUsageLimit, incrementUsage } from "./services/auth";
import { canGenerateSessions } from "./services/access-permissions";
import {
  clearGenerationCancelled,
  isGenerationCancelled,
  markGenerationCancelled,
} from "./services/generation-cancel";

const r = express.Router();

function normalizeCoachLevel(value: unknown): string {
  const v = String(value || "")
    .trim()
    .toUpperCase();
  if (v === "GRASSROOTS") return "GRASSROOTS";
  if (v === "USSF_C") return "USSF_C";
  if (v === "USSF_B_PLUS" || v === "USSF_B+" || v === "USSF_B") return "USSF_B_PLUS";
  return v;
}

function applyCoachLevelGuardrails<T extends { coachLevel?: unknown; playerLevel?: unknown }>(input: T): T {
  const next = { ...(input || {}) } as T;
  const coachLevel = normalizeCoachLevel(next.coachLevel);

  if (coachLevel === "GRASSROOTS" || coachLevel === "USSF_C" || coachLevel === "USSF_B_PLUS") {
    next.coachLevel = coachLevel;
  }
  if (coachLevel === "GRASSROOTS") {
    next.playerLevel = "BEGINNER";
  }

  return next as T;
}

r.post("/ai/cancel-generation", authenticate, async (req: AuthRequest, res) => {
  const generationId = String(req.body?.generationId || "").trim();
  if (!generationId) {
    return res.status(400).json({ ok: false, error: "generationId is required" });
  }
  markGenerationCancelled(generationId);
  console.log(`[SESSION] Cancel requested for generationId=${generationId}`);
  return res.json({ ok: true, cancelled: true, generationId });
});

// AI Chat endpoint for coaching assistant
r.post("/ai/chat", async (req, res) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) {
      return res.status(400).json({ ok: false, error: "prompt is required" });
    }
    
    // Extract any reference codes from the prompt
    const refCodes = extractRefCodes(prompt);
    const referencedItems: Array<{ refCode: string; type: string; data: any }> = [];
    
    // Lookup each referenced item
    for (const code of refCodes) {
      const result = await lookupByRefCode(code);
      if (result) {
        referencedItems.push({
          refCode: code,
          type: result.type,
          data: result.data,
        });
      }
    }
    
    // Build enhanced prompt with referenced context
    let enhancedPrompt = prompt;
    
    if (referencedItems.length > 0) {
      const contextParts = referencedItems.map(item => {
        const json = item.data.json || {};
        if (item.type === "session") {
          return `
[Referenced Session: ${item.refCode}]
Title: ${item.data.title}
Age Group: ${item.data.ageGroup}
Game Model: ${item.data.gameModelId}
Phase: ${item.data.phase || "N/A"}
Zone: ${item.data.zone || "N/A"}
Duration: ${item.data.durationMin || 90} minutes
Formation: ${item.data.formationUsed || "N/A"}
Summary: ${json.summary || "No summary available"}
Drills: ${(json.drills || []).map((d: any) => `${d.refCode || ""} ${d.title}`).join(", ") || "None"}
`;
        } else {
          return `
[Referenced Drill: ${item.refCode}]
Title: ${item.data.title}
Age Group: ${item.data.ageGroup}
Game Model: ${item.data.gameModelId}
Phase: ${item.data.phase}
Zone: ${item.data.zone}
Duration: ${item.data.durationMin || 25} minutes
Drill Type: ${item.data.drillType || "N/A"}
Description: ${json.description || json.objective || "No description available"}
`;
        }
      });
      
      enhancedPrompt = `The user has referenced the following items from their vault:
${contextParts.join("\n")}

User's request: ${prompt}

Please help the user with their request, using the context of the referenced items above.`;
    }
    
    // Set metrics context for tracking chat interactions
    setMetricsContext({
      operationType: "chat",
      ageGroup: context?.ageGroup,
      gameModelId: context?.gameModelId,
    });
    
    try {
      const text = await generateText(enhancedPrompt, { timeout: 30000, retries: 0 });
      return res.json({
        ok: true,
        text,
        referencedItems: referencedItems.map(item => ({
          refCode: item.refCode,
          type: item.type,
          title: item.data.title,
          id: item.data.id,
        })),
      });
    } finally {
      clearMetricsContext();
    }
  } catch (e: any) {
    console.error("[AI_CHAT] Error:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.post("/ai/generate-session", authenticate, async (req: AuthRequest, res) => {
  const debug = String(req.query.debug || "") === "1";
  const strictGameModelAlignment = process.env.STRICT_GAME_MODEL_ALIGNMENT === "1";
  const minGameModelScoreEnv = Number(process.env.MIN_GAME_MODEL_SCORE || "4");
  const minGameModelScore = Number.isFinite(minGameModelScoreEnv) ? minGameModelScoreEnv : 4;
  const strictPhaseAlignment = process.env.STRICT_PHASE_ALIGNMENT === "1";
  const minPhaseScoreEnv = Number(process.env.MIN_PHASE_SCORE || "4");
  const minPhaseScore = Number.isFinite(minPhaseScoreEnv) ? minPhaseScoreEnv : 4;
  if (debug) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    console.log("[SESSION] debug=1 authHeader present:", Boolean(authHeader));
  }

  const generationId = String(req.body?.generationId || "").trim() || undefined;
  if (generationId) {
    console.log(`[SESSION] generationId=${generationId}`);
  }

  let requestCancelled = false;
  const markCancelled = (source: string) => {
    if (requestCancelled) return;
    requestCancelled = true;
    console.log(`[SESSION] Request cancelled by client (${source})`);
  };
  req.on("aborted", () => markCancelled("aborted"));
  req.on("close", () => {
    if (!res.writableEnded) markCancelled("close");
  });

  if (generationId && isGenerationCancelled(generationId)) {
    console.log(`[SESSION] generationId=${generationId} already cancelled before start`);
    clearGenerationCancelled(generationId);
    return res.status(499).json({ ok: false, error: "Request cancelled" });
  }

  try {
    const body = applyCoachLevelGuardrails((req.body || {}) as SessionPromptInput);

    // Check access permissions
    if (req.userId) {
      const ageGroup = body.ageGroup;
      
      if (ageGroup) {
        const hasPermission = await canGenerateSessions(req.userId, ageGroup);
        if (!hasPermission) {
          if (debug) {
            console.log("[SESSION] permission denied for ageGroup:", ageGroup, "userId:", req.userId);
          }
          return res.status(403).json({
            ok: false,
            error: `You do not have permission to generate sessions for age group ${ageGroup}. Please contact an administrator.`,
            ageGroup,
            upgrade: true
          });
        }
      }
      
      // Check usage limit
      const limit = await checkUsageLimit(req.userId, 'session');
      if (!limit.allowed) {
        if (debug) {
          console.log("[SESSION] usage limit reached for userId:", req.userId, "limit:", limit);
        }
        return res.status(403).json({
          ok: false,
          error: 'Monthly limit reached',
          limit: limit.limit,
          used: limit.used,
          remaining: limit.remaining,
          upgrade: true
        });
      }
    }

    // -------------------------------
    // Normal pipeline: real generator
    // -------------------------------
    const result = await generateAndReviewSession(body, req.userId, {
      isCancelled: () =>
        requestCancelled || (generationId ? isGenerationCancelled(generationId) : false),
    });
    const session = result.session;
    const qa = result.qa;

    const fixDecision = result.fixDecision;
    const gameModelScore = Number(qa?.scores?.gameModel ?? 0);
    const phaseScore = Number(qa?.scores?.phase ?? 0);

    if (strictGameModelAlignment && gameModelScore < minGameModelScore) {
      return res.status(422).json({
        ok: false,
        error: "SESSION_GAME_MODEL_ALIGNMENT_FAILED",
        message: `Session gameModel score ${gameModelScore} is below required ${minGameModelScore}.`,
        scores: qa?.scores || null,
        telemetry: {
          gameModelScore: Number.isFinite(gameModelScore) ? gameModelScore : null,
          phaseScore: Number.isFinite(phaseScore) ? phaseScore : null,
          strictGateApplied: strictGameModelAlignment,
          rejectedByGate: true,
          strictPhaseGateApplied: strictPhaseAlignment,
          rejectedByPhaseGate: false,
        },
      });
    }
    if (strictPhaseAlignment && phaseScore < minPhaseScore) {
      return res.status(422).json({
        ok: false,
        error: "SESSION_PHASE_ALIGNMENT_FAILED",
        message: `Session phase score ${phaseScore} is below required ${minPhaseScore}.`,
        scores: qa?.scores || null,
        telemetry: {
          gameModelScore: Number.isFinite(gameModelScore) ? gameModelScore : null,
          phaseScore: Number.isFinite(phaseScore) ? phaseScore : null,
          strictGateApplied: strictGameModelAlignment,
          rejectedByGate: false,
          strictPhaseGateApplied: strictPhaseAlignment,
          rejectedByPhaseGate: true,
        },
      });
    }

    // Increment usage after successful generation
    if (req.userId) {
      await incrementUsage(req.userId, 'session');
    }

    const payload: any = {
      ok: true,
      session,
      qa,
      fixDecision,
      telemetry: {
        gameModelScore: Number.isFinite(gameModelScore) ? gameModelScore : null,
        phaseScore: Number.isFinite(phaseScore) ? phaseScore : null,
        strictGateApplied: strictGameModelAlignment,
        rejectedByGate: false,
        strictPhaseGateApplied: strictPhaseAlignment,
        rejectedByPhaseGate: false,
      },
    };

    if (debug) {
      payload.raw = result.raw || {};
    }

    return res.json(payload);
  } catch (e: any) {
    if (e?.message === "REQUEST_CANCELLED") {
      if (generationId) {
        clearGenerationCancelled(generationId);
      }
      if (!res.headersSent) {
        return res.status(499).json({ ok: false, error: "Request cancelled" });
      }
      return;
    }
    return res
      .status(500)
      .json({ ok: false, error: e?.message || String(e) });
  } finally {
    if (generationId) {
      clearGenerationCancelled(generationId);
    }
  }
});

// Generate progressive series
r.post("/ai/generate-progressive-series", authenticate, requireFeature('canGenerateSeries'), async (req: AuthRequest, res) => {
  const debug = String(req.query.debug || "") === "1";
  const skipRecommendation = String(req.query.skipRecommendation || "") === "1";

  try {
    const body = req.body || {};
    const baseInput = applyCoachLevelGuardrails((body.baseInput || body) as SessionPromptInput);
    const numberOfSessions = Number(body.numberOfSessions) || 3;

    if (numberOfSessions < 2 || numberOfSessions > 10) {
      return res.status(400).json({
        ok: false,
        error: "numberOfSessions must be between 2 and 10",
      });
    }

    // Check usage limit (counts as multiple sessions).
    // Unlimited plans/admins return limit = -1 and should always pass.
    if (req.userId) {
      const limit = await checkUsageLimit(req.userId, 'session');
      const isUnlimited = limit.limit === -1;
      if (!isUnlimited && (!limit.allowed || limit.remaining < numberOfSessions)) {
        return res.status(403).json({
          ok: false,
          error: 'Insufficient monthly limit for series',
          limit: limit.limit,
          used: limit.used,
          remaining: limit.remaining,
          required: numberOfSessions,
          upgrade: true
        });
      }
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

    const result = await generateProgressiveSessionSeries(baseInput, numberOfSessions, req.userId);
    
    // Increment usage (count as number of sessions generated)
    if (req.userId) {
      for (let i = 0; i < numberOfSessions; i++) {
        await incrementUsage(req.userId, 'session');
      }
    }

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
r.post("/ai/export-session-pdf", authenticate, requireFeature('canExportPDF'), async (req: AuthRequest, res) => {
  try {
    const session = req.body?.session;
    const format  = req.body?.format === "compact" ? "compact" : "full";
    if (!session) {
      return res.status(400).json({ ok: false, error: "session is required" });
    }
    console.log("[PDF_ROUTE] Received session for PDF export:", {
      title: session.title,
      drillsCount: session.drills?.length,
      format,
    });
    const pdfBuffer = format === "compact"
      ? await generateCompactSessionPdf(session)
      : await generateSessionPdf(session);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=session.pdf");
    return res.send(pdfBuffer);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
