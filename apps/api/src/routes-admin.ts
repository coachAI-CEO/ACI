import express from "express";
import { randomUUID } from "crypto";
import { SUBSCRIPTION_LIMITS, getFeaturesForUser } from "./config/subscription-limits";
import { checkUsageLimit } from "./services/auth";
import { prisma } from "./prisma";
import {
  createClub,
  deleteClub,
  getClubByCode,
  getClubById,
  getClubByName,
  listClubs,
  updateClub,
} from "./services/clubs-store";
import { generateAndReviewSession } from "./services/session";
import { generateProgressiveSessionSeries } from "./services/session-progressive";
import { generateText, setMetricsContext, clearMetricsContext } from "./gemini";
import { buildSessionQAReviewerPrompt } from "./prompts/session";
import { fixSessionDecision, fixDrillDecision } from "./services/fixer";
import { buildQAReviewerPrompt } from "./prompts/drill-optimized-v2";
import { generateAndReviewDrill } from "./services/drill";
import { reenrichDiagramFromDrillJson, needsDiagramEnrichment } from "./services/diagram-enrichment";
import type { FixDecisionCode } from "./services/fixer";
import { requireAdmin, requireAdminPermission, logAdminAction, AdminRequest } from "./middleware/admin-auth";
import { hashPassword } from "./services/auth";
import { generateVerificationToken, sendVerificationEmail } from "./services/email";
import { z } from "zod";

const r = express.Router();
const CLUB_GAME_MODELS = new Set([
  "COACHAI",
  "POSSESSION",
  "PRESSING",
  "TRANSITION",
  "ROCKLIN_FC",
]);

// Protect ALL admin routes
r.use(requireAdmin);

const normalizeJobStatus = {
  running: false,
  startedAt: null as string | null,
  finishedAt: null as string | null,
  processed: 0,
  updated: 0,
  target: 0,
  skippedMissingCore: 0,
  lastError: null as string | null,
};

const reenrichJobStatus = {
  running: false,
  startedAt: null as string | null,
  finishedAt: null as string | null,
  processed: 0,
  updated: 0,
  target: 0,
  lastError: null as string | null,
};

const stripJobStatus = {
  running: false,
  startedAt: null as string | null,
  finishedAt: null as string | null,
  processed: 0,
  updated: 0,
  target: 0,
  lastError: null as string | null,
};

// Primary model pricing defaults (per 1M tokens).
// Keep configurable so analytics stay aligned with deployed model choices.
const GEMINI_PRIMARY_MODEL = process.env.GEMINI_MODEL_PRIMARY || "gemini-3.1-flash-lite-preview";
const GEMINI_INPUT_PRICE_PER_1M = Number(process.env.GEMINI_INPUT_PRICE_PER_1M) || 0.50;
const GEMINI_OUTPUT_PRICE_PER_1M = Number(process.env.GEMINI_OUTPUT_PRICE_PER_1M) || 3.00;

function calculateCost(promptTokens: number, completionTokens: number): number {
  const inputCost = (promptTokens / 1_000_000) * GEMINI_INPUT_PRICE_PER_1M;
  const outputCost = (completionTokens / 1_000_000) * GEMINI_OUTPUT_PRICE_PER_1M;
  return inputCost + outputCost;
}

function parseJsonSafe(text: string) {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return null;
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function inferOrientationFromDiagram(diagram: any): "HORIZONTAL" | "VERTICAL" {
  const goals = Array.isArray(diagram?.goals) ? diagram.goals : [];
  if (goals.length > 0) {
    const left = goals.some((g: any) => typeof g.x === "number" && g.x < 20);
    const right = goals.some((g: any) => typeof g.x === "number" && g.x > 80);
    const top = goals.some((g: any) => typeof g.y === "number" && g.y < 20);
    const bottom = goals.some((g: any) => typeof g.y === "number" && g.y > 80);
    if ((left || right) && !(top || bottom)) return "HORIZONTAL";
    if ((top || bottom) && !(left || right)) return "VERTICAL";
  }
  const players = Array.isArray(diagram?.players) ? diagram.players : [];
  if (players.length >= 2) {
    const xs = players.map((p: any) => p.x).filter((n: any) => Number.isFinite(n));
    const ys = players.map((p: any) => p.y).filter((n: any) => Number.isFinite(n));
    const rangeX = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
    const rangeY = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
    return rangeY >= rangeX ? "VERTICAL" : "HORIZONTAL";
  }
  return "HORIZONTAL";
}

function normalizeDiagramInJson(json: any) {
  let out: any = json || {};
  if (typeof out === "string") {
    try {
      out = JSON.parse(out);
    } catch {
      out = {};
    }
  }
  out.diagram = out.diagram || {};
  const diagram = out.diagram;

  if (typeof diagram.pitch !== "object" || diagram.pitch === null) {
    diagram.pitch = {
      variant: typeof diagram.pitch === "string" ? diagram.pitch : "HALF",
      orientation: "HORIZONTAL",
      showZones: false,
    };
  } else {
    diagram.pitch = diagram.pitch || { variant: "HALF", orientation: "HORIZONTAL", showZones: false };
  }
  diagram.pitch.showZones = false;
  const inferred = inferOrientationFromDiagram(diagram);
  diagram.pitch.orientation = inferred;

  diagram.players = Array.isArray(diagram.players) ? diagram.players : [];
  diagram.goals = Array.isArray(diagram.goals) ? diagram.goals : [];
  diagram.arrows = Array.isArray(diagram.arrows) ? diagram.arrows : [];
  diagram.annotations = Array.isArray(diagram.annotations) ? diagram.annotations : [];
  diagram.safeZones = Array.isArray(diagram.safeZones) ? diagram.safeZones : [];

  // Do not inject generic arrows/annotations/safeZones.
  // These must be supplied by the drill JSON itself.
  diagram.arrows = Array.isArray(diagram.arrows) ? diagram.arrows : [];
  diagram.annotations = Array.isArray(diagram.annotations) ? diagram.annotations : [];
  diagram.safeZones = Array.isArray(diagram.safeZones) ? diagram.safeZones : [];

  out.diagram = diagram;
  return out;
}

function getNormalizationState(json: any) {
  let out: any = json || {};
  if (typeof out === "string") {
    try {
      out = JSON.parse(out);
    } catch {
      return { needsEnhancement: true, missingCore: true };
    }
  }
  const diagram = out?.diagram || {};
  const pitch = diagram?.pitch;
  const pitchMissing = !pitch || typeof pitch !== "object" || pitch.showZones !== false;

  const goals = Array.isArray(diagram.goals) ? diagram.goals : [];
  const players = Array.isArray(diagram.players) ? diagram.players : [];
  const arrows = Array.isArray(diagram.arrows) ? diagram.arrows : [];
  const annotations = Array.isArray(diagram.annotations) ? diagram.annotations : [];
  const safeZones = Array.isArray(diagram.safeZones) ? diagram.safeZones : [];

  const missingCore = players.length === 0 || goals.length === 0;
  const arrowsMissing = arrows.length < 7;
  const annotationsMissing = annotations.length < 4;
  const safeZonesMissing = safeZones.length < 1;

  const hasStyled = annotations.every(
    (a: any) =>
      typeof a?.fontSize === "number" &&
      typeof a?.color === "string" &&
      typeof a?.fontWeight === "string"
  );
  const annotationsUnstyled = !hasStyled;

  const needsEnhancement =
    !missingCore && (pitchMissing || arrowsMissing || annotationsMissing || safeZonesMissing || annotationsUnstyled);

  return { needsEnhancement, missingCore };
}

// Get overall dashboard stats
r.get("/admin/stats", requireAdminPermission('canAccessAdminDashboard'), async (req: AdminRequest, res) => {
  try {
    const [
      totalSessions,
      totalDrills,
      totalSeries,
      vaultSessions,
      vaultDrills,
      totalApiCalls,
      successfulCalls,
      recentMetrics,
      allTimeTokens,
    ] = await Promise.all([
      prisma.session.count(),
      prisma.drill.count(),
      prisma.session.count({ where: { isSeries: true } }),
      prisma.session.count({ where: { savedToVault: true } }),
      prisma.drill.count({ where: { savedToVault: true } }),
      prisma.apiMetrics.count(),
      prisma.apiMetrics.count({ where: { success: true } }),
      prisma.apiMetrics.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          totalTokens: true,
          promptTokens: true,
          completionTokens: true,
          durationMs: true,
        },
      }),
      // All-time token aggregation
      prisma.apiMetrics.aggregate({
        _sum: {
          totalTokens: true,
          promptTokens: true,
          completionTokens: true,
        },
      }),
    ]);

    // Calculate totals from recent metrics
    const recentTotalTokens = recentMetrics.reduce((sum, m) => sum + (m.totalTokens || 0), 0);
    const recentPromptTokens = recentMetrics.reduce((sum, m) => sum + (m.promptTokens || 0), 0);
    const recentCompletionTokens = recentMetrics.reduce((sum, m) => sum + (m.completionTokens || 0), 0);
    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.durationMs, 0);
    const avgDuration = recentMetrics.length > 0 ? Math.round(totalDuration / recentMetrics.length) : 0;

    // All-time totals
    const allTimePromptTokens = allTimeTokens._sum.promptTokens || 0;
    const allTimeCompletionTokens = allTimeTokens._sum.completionTokens || 0;
    const allTimeTotalTokens = allTimeTokens._sum.totalTokens || 0;
    const allTimeCost = calculateCost(allTimePromptTokens, allTimeCompletionTokens);

    // Get unique series count
    const uniqueSeries = await prisma.session.groupBy({
      by: ["seriesId"],
      where: { seriesId: { not: null } },
    });

    // Count drills embedded in sessions (from session JSON)
    const vaultSessionsWithDrills = await prisma.session.findMany({
      where: { savedToVault: true },
      select: { json: true },
    });
    
    let sessionDrillsCount = 0;
    for (const s of vaultSessionsWithDrills) {
      const json = s.json as any;
      if (json?.drills && Array.isArray(json.drills)) {
        sessionDrillsCount += json.drills.length;
      }
    }

    return res.json({
      ok: true,
      stats: {
        database: {
          totalSessions,
          totalDrills,
          totalSeries: uniqueSeries.length,
          vaultSessions,
          vaultDrills,
          seriesSessions: totalSeries,
          sessionDrillsCount, // Drills embedded in vault sessions
        },
        api: {
          totalCalls: totalApiCalls,
          successfulCalls,
          failedCalls: totalApiCalls - successfulCalls,
          successRate: totalApiCalls > 0 ? ((successfulCalls / totalApiCalls) * 100).toFixed(1) : "100",
        },
        tokens: {
          recentTotal: recentTotalTokens,
          recentPromptTokens,
          recentCompletionTokens,
          allTimeTotal: allTimeTotalTokens,
          allTimePromptTokens,
          allTimeCompletionTokens,
          allTimeCost: allTimeCost.toFixed(4),
          recentCost: calculateCost(recentPromptTokens, recentCompletionTokens).toFixed(4),
        },
        performance: {
          avgDurationMs: avgDuration,
          avgDurationSec: (avgDuration / 1000).toFixed(1),
          totalDurationMs: totalDuration,
        },
        pricing: {
          inputPer1M: GEMINI_INPUT_PRICE_PER_1M,
          outputPer1M: GEMINI_OUTPUT_PRICE_PER_1M,
          model: GEMINI_PRIMARY_MODEL,
        },
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Get metrics over time (for charts)
r.get("/admin/metrics/timeline", requireAdminPermission('canViewAnalytics'), async (req: AdminRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await prisma.apiMetrics.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        operationType: true,
        totalTokens: true,
        durationMs: true,
        success: true,
        model: true,
      },
    });

    // Group by day
    const dailyStats: Record<string, {
      date: string;
      calls: number;
      successful: number;
      failed: number;
      tokens: number;
      avgDuration: number;
      totalDuration: number;
      sessions: number;
      drills: number;
      series: number;
      skillFocus: number;
      qaReviews: number;
    }> = {};

    for (const m of metrics) {
      const dateKey = m.createdAt.toISOString().split("T")[0];
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          date: dateKey,
          calls: 0,
          successful: 0,
          failed: 0,
          tokens: 0,
          avgDuration: 0,
          totalDuration: 0,
          sessions: 0,
          drills: 0,
          series: 0,
          skillFocus: 0,
          qaReviews: 0,
        };
      }

      const day = dailyStats[dateKey];
      day.calls++;
      if (m.success) day.successful++;
      else day.failed++;
      day.tokens += m.totalTokens || 0;
      day.totalDuration += m.durationMs;

      // Count by operation type
      switch (m.operationType) {
        case "session":
          day.sessions++;
          break;
        case "drill":
          day.drills++;
          break;
        case "series":
          day.series++;
          break;
        case "skill_focus":
          day.skillFocus++;
          break;
        case "qa_review":
          day.qaReviews++;
          break;
      }
    }

    // Calculate averages
    for (const day of Object.values(dailyStats)) {
      day.avgDuration = day.calls > 0 ? Math.round(day.totalDuration / day.calls) : 0;
    }

    return res.json({
      ok: true,
      days,
      timeline: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Get breakdown by operation type
r.get("/admin/metrics/by-operation", requireAdminPermission('canViewAnalytics'), async (req: AdminRequest, res) => {
  try {
    const metrics = await prisma.apiMetrics.groupBy({
      by: ["operationType"],
      _count: { id: true },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true, durationMs: true },
      _avg: { durationMs: true, totalTokens: true, promptTokens: true, completionTokens: true },
    });

    return res.json({
      ok: true,
      operations: metrics.map((m) => {
        const totalPrompt = m._sum.promptTokens || 0;
        const totalCompletion = m._sum.completionTokens || 0;
        const cost = calculateCost(totalPrompt, totalCompletion);
        
        return {
          type: m.operationType,
          count: m._count.id,
          totalTokens: m._sum.totalTokens || 0,
          totalPromptTokens: totalPrompt,
          totalCompletionTokens: totalCompletion,
          avgTokens: Math.round(m._avg.totalTokens || 0),
          avgPromptTokens: Math.round(m._avg.promptTokens || 0),
          avgCompletionTokens: Math.round(m._avg.completionTokens || 0),
          totalDurationMs: m._sum.durationMs || 0,
          avgDurationMs: Math.round(m._avg.durationMs || 0),
          totalCost: cost.toFixed(4),
          avgCost: (cost / m._count.id).toFixed(4),
        };
      }),
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Get breakdown by model
r.get("/admin/metrics/by-model", requireAdminPermission('canViewAnalytics'), async (req: AdminRequest, res) => {
  try {
    const metrics = await prisma.apiMetrics.groupBy({
      by: ["model"],
      _count: { id: true },
      _sum: { totalTokens: true, durationMs: true },
      _avg: { durationMs: true },
    });

    return res.json({
      ok: true,
      models: metrics.map((m) => ({
        model: m.model,
        count: m._count.id,
        totalTokens: m._sum.totalTokens || 0,
        totalDurationMs: m._sum.durationMs || 0,
        avgDurationMs: Math.round(m._avg.durationMs || 0),
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Get recent API calls (for live feed)
r.get("/admin/metrics/recent", requireAdminPermission('canViewAnalytics'), async (req: AdminRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const metrics = await prisma.apiMetrics.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        operationType: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        promptLength: true,
        responseLength: true,
        durationMs: true,
        success: true,
        errorMessage: true,
        ageGroup: true,
        gameModelId: true,
        createdAt: true,
      },
    });

    return res.json({
      ok: true,
      metrics,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Get database breakdown by age group
r.get("/admin/stats/by-age-group", requireAdminPermission('canAccessAdminDashboard'), async (req: AdminRequest, res) => {
  try {
    // IMPORTANT:
    // - Vault "Sessions" tab excludes series sessions (isSeries=false)
    // - Vault "Series" tab shows isSeries=true grouped by seriesId
    // To avoid mismatched counts between Admin and Vault, return both.
    const [sessionsByAge, seriesSessionsByAge] = await Promise.all([
      prisma.session.groupBy({
        by: ["ageGroup"],
        _count: { id: true },
        where: { savedToVault: true, isSeries: false },
      }),
      prisma.session.groupBy({
        by: ["ageGroup"],
        _count: { id: true },
        where: { savedToVault: true, isSeries: true },
      }),
    ]);

    const drillsByAge = await prisma.drill.groupBy({
      by: ["ageGroup"],
      _count: { id: true },
      where: { savedToVault: true },
    });

    return res.json({
      ok: true,
      sessions: sessionsByAge.map((s) => ({
        ageGroup: s.ageGroup,
        count: s._count.id,
      })),
      seriesSessions: seriesSessionsByAge.map((s) => ({
        ageGroup: s.ageGroup,
        count: s._count.id,
      })),
      drills: drillsByAge.map((d) => ({
        ageGroup: d.ageGroup,
        count: d._count.id,
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Get database breakdown by game model
r.get("/admin/stats/by-game-model", requireAdminPermission('canAccessAdminDashboard'), async (req: AdminRequest, res) => {
  try {
    const sessionsByModel = await prisma.session.groupBy({
      by: ["gameModelId"],
      _count: { id: true },
      where: { savedToVault: true },
    });

    return res.json({
      ok: true,
      sessions: sessionsByModel.map((s) => ({
        gameModelId: s.gameModelId,
        count: s._count.id,
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// -----------------------------
// Admin: Bulk generate sessions
// -----------------------------
type RandomSessionJobStatus = "queued" | "running" | "completed" | "failed";

type RandomSessionJobMode = "session" | "series";

type RandomSessionJob = {
  id: string;
  ageGroup: string;
  mode: RandomSessionJobMode;
  sessionsPerSeries?: number;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  status: RandomSessionJobStatus;
  startedAt: string;
  finishedAt?: string;
  userId?: string; // User who initiated the job
  results: Array<
    | { kind: "session"; id: string; refCode?: string; title?: string }
    | { kind: "series"; seriesId: string; totalSessions: number; firstRefCode?: string; title?: string }
  >;
  errors: Array<{ index: number; message: string }>;
};

const randomSessionJobs = new Map<string, RandomSessionJob>();

function randomId(prefix: string) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}_${s}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formationsForAge(ageGroup: string): string[] {
  // Keep these conservative/compatible with current prompts
  if (ageGroup === "U8" || ageGroup === "U9") return ["2-3-1", "3-2-1"];
  if (ageGroup === "U10" || ageGroup === "U11") return ["2-3-1", "3-2-1"];
  if (ageGroup === "U12" || ageGroup === "U13") return ["3-3-2", "2-3-3"];
  if (ageGroup === "U14" || ageGroup === "U15") return ["4-3-3", "3-4-3"];
  if (ageGroup === "U16" || ageGroup === "U17") return ["4-3-3", "4-2-3-1"];
  if (ageGroup === "U18") return ["4-3-3", "4-2-3-1"];
  return ["4-3-3", "4-2-3-1"];
}

function outfieldCountFromFormation(formation: string): number {
  const parts = formation.split("-").map((n) => Number(n)).filter((n) => Number.isFinite(n));
  const outfield = parts.reduce((sum, n) => sum + n, 0);
  return outfield || 10;
}

async function runRandomSessionJob(jobId: string) {
  const job = randomSessionJobs.get(jobId);
  if (!job) return;
  job.status = "running";
  const userId = job.userId; // Get userId from job

  const gameModels = ["COACHAI", "POSSESSION", "PRESSING", "TRANSITION", "ROCKLIN_FC"] as const;
  const phases = ["ATTACKING", "DEFENDING", "TRANSITION"] as const;
  const zones = ["DEFENSIVE_THIRD", "MIDDLE_THIRD", "ATTACKING_THIRD"] as const;
  const playerLevels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
  const coachLevels = ["GRASSROOTS", "USSF_C", "USSF_B_PLUS"] as const;
  const spaceConstraints = ["FULL", "HALF", "THIRD", "QUARTER"] as const;

  for (let i = 0; i < job.total; i++) {
    try {
      const formationAttacking = pick(formationsForAge(job.ageGroup));
      const outfield = outfieldCountFromFormation(formationAttacking);

      // Slightly flexible headcount; include GK implicitly in prompt expectations
      const numbersMin = Math.max(6, outfield);
      const numbersMax = Math.max(numbersMin, outfield + 4);

      const input: any = {
        gameModelId: pick([...gameModels]),
        ageGroup: job.ageGroup,
        phase: pick([...phases]),
        zone: pick([...zones]),
        formationAttacking,
        formationDefending: formationAttacking,
        playerLevel: pick([...playerLevels]),
        coachLevel: pick([...coachLevels]),
        numbersMin,
        numbersMax,
        goalsAvailable: 2,
        spaceConstraint: pick([...spaceConstraints]),
        durationMin: pick([60, 90]),
      };

      if (job.mode === "series") {
        const seriesLen = Math.min(10, Math.max(2, Number(job.sessionsPerSeries || 3)));
        const seriesResult = await generateProgressiveSessionSeries(input, seriesLen, userId);
        const first = seriesResult.series?.[0]?.session;
        job.succeeded += 1;
        job.results.push({
          kind: "series",
          seriesId: seriesResult.seriesId,
          totalSessions: seriesLen,
          firstRefCode: first?.refCode,
          title: first?.title,
        });
      } else {
        const result = await generateAndReviewSession(input, userId);
        job.succeeded += 1;
        job.results.push({
          kind: "session",
          id: result.session?.id,
          refCode: result.session?.refCode,
          title: result.session?.title,
        });
      }
    } catch (e: any) {
      job.failed += 1;
      job.errors.push({ index: i + 1, message: e?.message || String(e) });
    } finally {
      job.completed += 1;
    }
  }

  job.status = job.failed > 0 && job.succeeded === 0 ? "failed" : "completed";
  job.finishedAt = new Date().toISOString();
}

// Start a random-session generation job
r.post("/admin/random-sessions/start", requireAdminPermission('canGenerateBulkContent'), async (req: AdminRequest, res) => {
  try {
    const ageGroup = String(req.body?.ageGroup || "").trim();
    const count = Number(req.body?.count || 0);
    const mode = String(req.body?.mode || "session").trim() as RandomSessionJobMode;
    const sessionsPerSeries = Number(req.body?.sessionsPerSeries || 3);

    if (!ageGroup) {
      return res.status(400).json({ ok: false, error: "ageGroup is required" });
    }
    if (mode !== "session" && mode !== "series") {
      return res.status(400).json({ ok: false, error: "mode must be 'session' or 'series'" });
    }

    const maxCount = mode === "series" ? 10 : 25;
    if (!Number.isFinite(count) || count < 1 || count > maxCount) {
      return res
        .status(400)
        .json({ ok: false, error: `count must be between 1 and ${maxCount} for mode=${mode}` });
    }

    let finalSessionsPerSeries: number | undefined = undefined;
    if (mode === "series") {
      if (!Number.isFinite(sessionsPerSeries) || sessionsPerSeries < 2 || sessionsPerSeries > 10) {
        return res.status(400).json({ ok: false, error: "sessionsPerSeries must be between 2 and 10" });
      }
      finalSessionsPerSeries = sessionsPerSeries;
    }

    // Log admin action
    await logAdminAction(
      req.userId!,
      'bulk.generate_sessions',
      {
        resourceType: 'Session',
        data: { ageGroup, count, mode, sessionsPerSeries: finalSessionsPerSeries }
      },
      req
    );

    const jobId = randomId("rand_sessions");
    const job: RandomSessionJob = {
      id: jobId,
      ageGroup,
      mode,
      sessionsPerSeries: finalSessionsPerSeries,
      total: count,
      completed: 0,
      succeeded: 0,
      failed: 0,
      status: "queued",
      startedAt: new Date().toISOString(),
      userId: req.userId,
      results: [],
      errors: [],
    };
    randomSessionJobs.set(jobId, job);

    // Run asynchronously; respond immediately with jobId
    setImmediate(() => {
      runRandomSessionJob(jobId).catch((err) => {
        const j = randomSessionJobs.get(jobId);
        if (j) {
          j.status = "failed";
          j.finishedAt = new Date().toISOString();
          j.errors.push({ index: -1, message: err?.message || String(err) });
        }
      });
    });

    return res.json({ ok: true, jobId });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Poll job status
r.get("/admin/random-sessions/:jobId", requireAdminPermission('canGenerateBulkContent'), async (req: AdminRequest, res) => {
  const jobId = String(req.params.jobId || "");
  const job = randomSessionJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ ok: false, error: "Job not found" });
  }
  return res.json({ ok: true, job });
});

// ------------------------------------
// Admin: Review a session QA + regen
// ------------------------------------
r.post("/admin/sessions/review", requireAdminPermission('canReviewQA'), async (req: AdminRequest, res) => {
  const sessionRef = String(req.body?.sessionRef || "").trim();

  if (!sessionRef) {
    return res.status(400).json({ ok: false, error: "sessionRef is required (id or refCode)" });
  }

  // Log admin action
  await logAdminAction(
    req.userId!,
    'qa.review_session',
    {
      resourceType: 'Session',
      resourceId: sessionRef
    },
    req
  );

  const sessionRow = await prisma.session.findFirst({
    where: {
      OR: [{ id: sessionRef }, { refCode: sessionRef }],
    },
  });

  if (!sessionRow) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  // Build QA prompt from stored session JSON
  const sessionJson = (sessionRow.json as any) || {};
  const qaPrompt = buildSessionQAReviewerPrompt(sessionJson);

  setMetricsContext({
    operationType: "qa_review",
    artifactId: sessionRow.id,
    ageGroup: sessionRow.ageGroup,
    gameModelId: String(sessionRow.gameModelId),
    phase: sessionRow.phase ? String(sessionRow.phase) : undefined,
  });

  try {
    const qaText = await generateText(qaPrompt, { timeout: 60000, retries: 0 });
    const qaJson: any = parseJsonSafe(qaText);
    if (!qaJson) {
      return res.status(500).json({ ok: false, error: "LLM returned non-JSON QA" });
    }

    const scores = qaJson?.scores || {};
    const vals = Object.values(scores).map((v: any) => Number(v || 0)).filter((n) => Number.isFinite(n));
    const avgScore = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const fixDecision = fixSessionDecision(scores);

    // Persist QA snapshot
    await prisma.qAReport.create({
      data: {
        artifactId: sessionRow.id,
        artifactType: "SESSION",
        sessionId: sessionRow.id,
        pass: !!qaJson.pass,
        scores: scores || {},
        summary: qaJson.summary || null,
      },
    });

    // Update session metadata
    await prisma.session.update({
      where: { id: sessionRow.id },
      data: {
        qaScore: avgScore,
        approved: !!qaJson.pass,
      },
    });

    return res.json({
      ok: true,
      session: {
        id: sessionRow.id,
        refCode: sessionRow.refCode,
        title: sessionRow.title,
        ageGroup: sessionRow.ageGroup,
        gameModelId: sessionRow.gameModelId,
        phase: sessionRow.phase,
        zone: sessionRow.zone,
        qaScore: avgScore,
        approved: !!qaJson.pass,
      },
      qa: {
        pass: !!qaJson.pass,
        scores,
        avgScore,
        summary: qaJson.summary || null,
        notes: qaJson.notes || [],
      },
      fixDecision,
    });
  } finally {
    clearMetricsContext();
  }
});

// Review Drill (QA)
r.post("/admin/drills/review", requireAdminPermission('canReviewQA'), async (req: AdminRequest, res) => {
  const drillRef = String(req.body?.drillRef || "").trim();

  if (!drillRef) {
    return res.status(400).json({ ok: false, error: "drillRef is required (id or refCode)" });
  }

  // Log admin action
  await logAdminAction(
    req.userId!,
    'qa.review_drill',
    {
      resourceType: 'Drill',
      resourceId: drillRef
    },
    req
  );

  const drillRow = await prisma.drill.findFirst({
    where: {
      OR: [{ id: drillRef }, { refCode: drillRef }],
    },
  });

  if (!drillRow) {
    return res.status(404).json({ ok: false, error: "Drill not found" });
  }

  // Build QA prompt from stored drill JSON
  const drillJson = (drillRow.json as any) || {};
  const qaPrompt = buildQAReviewerPrompt(drillJson);

  setMetricsContext({
    operationType: "qa_review",
    artifactId: drillRow.id,
    ageGroup: drillRow.ageGroup,
    gameModelId: String(drillRow.gameModelId),
    phase: drillRow.phase ? String(drillRow.phase) : undefined,
  });

  try {
    const qaText = await generateText(qaPrompt, { timeout: 60000, retries: 0 });
    const qaJson: any = parseJsonSafe(qaText);
    if (!qaJson) {
      return res.status(500).json({ ok: false, error: "LLM returned non-JSON QA" });
    }

    const scores = qaJson?.scores || {};
    const vals = Object.values(scores).map((v: any) => Number(v || 0)).filter((n) => Number.isFinite(n));
    const avgScore = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const fixDecision = fixDrillDecision(scores);

    // Persist QA snapshot
    await prisma.qAReport.create({
      data: {
        artifactId: drillRow.id,
        artifactType: "DRILL",
        drillId: drillRow.id,
        pass: !!qaJson.pass,
        scores: scores || {},
        summary: qaJson.summary || null,
      },
    });

    // Update drill metadata
    await prisma.drill.update({
      where: { id: drillRow.id },
      data: {
        qaScore: avgScore,
        approved: !!qaJson.pass,
      },
    });

    return res.json({
      ok: true,
      drill: {
        id: drillRow.id,
        refCode: drillRow.refCode,
        title: drillRow.title,
        ageGroup: drillRow.ageGroup,
        gameModelId: drillRow.gameModelId,
        phase: drillRow.phase,
        zone: drillRow.zone,
        qaScore: avgScore,
        approved: !!qaJson.pass,
      },
      qa: {
        pass: !!qaJson.pass,
        scores,
        avgScore,
        summary: qaJson.summary || null,
        notes: qaJson.notes || [],
      },
      fixDecision,
    });
  } finally {
    clearMetricsContext();
  }
});

// Normalize Drill Diagram (add missing elements / fix orientation)
r.post("/admin/drills/normalize-diagram", requireAdminPermission('canReviewQA'), async (req: AdminRequest, res) => {
  console.log("[ADMIN] normalize-diagram start", req.body);
  normalizeJobStatus.running = true;
  normalizeJobStatus.startedAt = new Date().toISOString();
  normalizeJobStatus.finishedAt = null;
  normalizeJobStatus.processed = 0;
  normalizeJobStatus.updated = 0;
  normalizeJobStatus.skippedMissingCore = 0;
  normalizeJobStatus.lastError = null;
  const schema = z.object({
    drillRef: z.string().optional(),
    all: z.boolean().optional(),
    limit: z.number().int().min(1).max(500).optional(),
    dryRun: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    normalizeJobStatus.running = false;
    normalizeJobStatus.lastError = "Invalid payload";
    return res.status(400).json({ ok: false, error: "Invalid payload" });
  }
  const { drillRef, all, limit, dryRun } = parsed.data;
  if (!drillRef && !all) {
    normalizeJobStatus.running = false;
    normalizeJobStatus.lastError = "Provide drillRef or all=true";
    return res.status(400).json({ ok: false, error: "Provide drillRef or all=true" });
  }

  const updated: Array<{ id: string; refCode: string | null }> = [];
  let processedTotal = 0;

  if (drillRef) {
    const drills = await prisma.drill.findMany({
      where: { OR: [{ id: drillRef }, { refCode: drillRef }] },
    });
    if (drills.length === 0) {
      normalizeJobStatus.running = false;
      normalizeJobStatus.lastError = "No drills found";
      return res.status(404).json({ ok: false, error: "No drills found" });
    }
    for (const drill of drills) {
      processedTotal += 1;
      const json = JSON.parse(JSON.stringify(drill.json || {}));
      const before = JSON.stringify(json);
      const normalized = normalizeDiagramInJson(json);
      const after = JSON.stringify(normalized);
      if (before !== after) {
        if (!dryRun) {
          await prisma.drill.update({
            where: { id: drill.id },
            data: { json: normalized },
          });
        }
        updated.push({ id: drill.id, refCode: drill.refCode });
      }
    }
  } else {
    const maxUpdates = limit || 50;
    const batchSize = 200;
    let processed = 0;
    let offset = 0;
    normalizeJobStatus.target = maxUpdates;
    while (updated.length < maxUpdates) {
      const drills = await prisma.drill.findMany({
        skip: offset,
        take: batchSize,
        orderBy: { createdAt: "desc" },
      });
      if (drills.length === 0) break;
      for (const drill of drills) {
        if (updated.length >= maxUpdates) break;
        processedTotal += 1;
        const json = JSON.parse(JSON.stringify(drill.json || {}));
        const state = getNormalizationState(json);
        if (state.missingCore) {
          normalizeJobStatus.skippedMissingCore += 1;
          continue;
        }
        if (!state.needsEnhancement) {
          continue;
        }
        const before = JSON.stringify(json);
        const normalized = normalizeDiagramInJson(json);
        const after = JSON.stringify(normalized);
        if (before !== after) {
          if (!dryRun) {
            await prisma.drill.update({
              where: { id: drill.id },
              data: { json: normalized },
            });
          }
          updated.push({ id: drill.id, refCode: drill.refCode });
          normalizeJobStatus.updated = updated.length;
        }
      }
      processed += drills.length;
      offset += drills.length;
      normalizeJobStatus.processed = processedTotal;
      console.log("[ADMIN] normalize-diagram progress", { processed, updated: updated.length, target: maxUpdates });
    }
  }

  console.log("[ADMIN] normalize-diagram done", { updated: updated.length, dryRun: !!dryRun });
  normalizeJobStatus.running = false;
  normalizeJobStatus.finishedAt = new Date().toISOString();
  normalizeJobStatus.processed = processedTotal;
  normalizeJobStatus.updated = updated.length;
  return res.json({
    ok: true,
    dryRun: !!dryRun,
    processed: processedTotal,
    updatedCount: updated.length,
    skippedMissingCore: normalizeJobStatus.skippedMissingCore,
    updated,
  });
});

// Drill normalization status (how many need normalization)
r.get("/admin/drills/normalize-status", requireAdminPermission('canReviewQA'), async (_req: AdminRequest, res) => {
  const total = await prisma.drill.count();
  const batchSize = 500;
  let needs = 0;
  let missingCore = 0;
  let needsReenrich = 0;
  let processed = 0;

  while (processed < total) {
    const drills = await prisma.drill.findMany({
      skip: processed,
      take: batchSize,
      orderBy: { createdAt: "desc" },
      select: { json: true },
    });
    if (drills.length === 0) break;
    for (const d of drills) {
      const state = getNormalizationState(d.json);
      if (state.missingCore) missingCore += 1;
      if (state.needsEnhancement) needs += 1;
      const json = typeof d.json === "string" ? parseJsonSafe(d.json) : d.json;
      const diagram = json?.diagram;
      if (needsDiagramEnrichment(diagram)) needsReenrich += 1;
    }
    processed += drills.length;
  }

  return res.json({
    ok: true,
    total,
    needsNormalization: needs,
    missingCore,
    needsReenrich,
    processed,
    batchSize,
    job: normalizeJobStatus,
    reenrichJob: reenrichJobStatus,
    stripJob: stripJobStatus,
  });
});

// Strip generic overlays from diagrams (annotations/arrows/safeZones)
r.post("/admin/drills/strip-generic-diagram", requireAdminPermission('canReviewQA'), async (req: AdminRequest, res) => {
  stripJobStatus.running = true;
  stripJobStatus.startedAt = new Date().toISOString();
  stripJobStatus.finishedAt = null;
  stripJobStatus.processed = 0;
  stripJobStatus.updated = 0;
  stripJobStatus.lastError = null;

  const schema = z.object({
    all: z.boolean().optional(),
    limit: z.number().int().min(1).max(500).optional(),
    includeSessions: z.boolean().optional(),
    dryRun: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    stripJobStatus.running = false;
    stripJobStatus.lastError = "Invalid payload";
    return res.status(400).json({ ok: false, error: "Invalid payload" });
  }
  const { all, limit, includeSessions, dryRun } = parsed.data;
  if (!all) {
    stripJobStatus.running = false;
    stripJobStatus.lastError = "Provide all=true";
    return res.status(400).json({ ok: false, error: "Provide all=true" });
  }

  const defaultAnnTexts = new Set([
    "PRESS TRIGGER",
    "STAY COMPACT",
    "WIDE 2V1",
    "TRIGGER PASS",
  ]);
  const defaultArrowSet = [
    { from: { x: 20, y: 50 }, to: { x: 40, y: 45 }, type: "pass", label: "1" },
    { from: { x: 40, y: 45 }, to: { x: 60, y: 40 }, type: "pass", label: "2" },
    { from: { x: 60, y: 40 }, to: { x: 70, y: 30 }, type: "movement" },
    { from: { x: 70, y: 30 }, to: { x: 50, y: 25 }, type: "pass", label: "3" },
    { from: { x: 30, y: 55 }, to: { x: 40, y: 45 }, type: "press" },
    { from: { x: 55, y: 55 }, to: { x: 50, y: 45 }, type: "press" },
    { from: { x: 50, y: 70 }, to: { x: 50, y: 55 }, type: "run" },
  ];

  const isDefaultArrow = (a: any) =>
    defaultArrowSet.some(
      (d) =>
        a?.type === d.type &&
        String(a?.label || "") === String(d.label || "") &&
        a?.from?.x === d.from.x &&
        a?.from?.y === d.from.y &&
        a?.to?.x === d.to.x &&
        a?.to?.y === d.to.y
    );

  const stripDiagram = (diagram: any) => {
    if (!diagram) return false;
    let changed = false;
    if (Array.isArray(diagram.annotations) && diagram.annotations.length > 0) {
      const allDefault = diagram.annotations.every((a: any) =>
        defaultAnnTexts.has(String(a?.text || "").toUpperCase())
      );
      if (allDefault) {
        diagram.annotations = [];
        changed = true;
      }
    }
    if (Array.isArray(diagram.arrows) && diagram.arrows.length > 0) {
      const defaultCount = diagram.arrows.filter(isDefaultArrow).length;
      if (defaultCount >= 4) {
        diagram.arrows = diagram.arrows.filter((a: any) => !isDefaultArrow(a));
        changed = true;
      }
    }
    if (Array.isArray(diagram.safeZones) && diagram.safeZones.length > 0) {
      const allGenericZones = diagram.safeZones.every(
        (z: any) =>
          String(z?.label || "").toUpperCase() === "WIDE CHANNEL" &&
          z?.width === 15 &&
          z?.height === 100
      );
      if (allGenericZones) {
        diagram.safeZones = [];
        changed = true;
      }
    }
    return changed;
  };

  const updated: Array<{ id: string; refCode: string | null }> = [];
  const maxUpdates = limit || 50;
  stripJobStatus.target = maxUpdates;
  let processed = 0;

  const batchSize = 200;
  let offset = 0;
  while (updated.length < maxUpdates) {
    const drills = await prisma.drill.findMany({
      skip: offset,
      take: batchSize,
      orderBy: { createdAt: "desc" },
      select: { id: true, refCode: true, json: true },
    });
    if (drills.length === 0) break;
    for (const drill of drills) {
      if (updated.length >= maxUpdates) break;
      processed += 1;
      const json = typeof drill.json === "string" ? parseJsonSafe(drill.json) : drill.json;
      if (!json) continue;
      const changed = stripDiagram(json.diagram);
      if (changed && !dryRun) {
        await prisma.drill.update({ where: { id: drill.id }, data: { json } });
        if (includeSessions && drill.refCode) {
          const sessions = await prisma.session.findMany({
            where: { savedToVault: true },
            select: { id: true, json: true },
          });
          for (const s of sessions) {
            const sj = typeof s.json === "string" ? parseJsonSafe(s.json) : s.json;
            if (!sj || !Array.isArray(sj.drills)) continue;
            let sChanged = false;
            sj.drills = sj.drills.map((d: any) => {
              if (String(d?.refCode || "").toUpperCase() === String(drill.refCode || "").toUpperCase()) {
                const did = stripDiagram(d.diagram);
                if (did) sChanged = true;
                return d;
              }
              return d;
            });
            if (sChanged) {
              await prisma.session.update({ where: { id: s.id }, data: { json: sj } });
            }
          }
        }
      }
      if (changed) updated.push({ id: drill.id, refCode: drill.refCode });
      stripJobStatus.updated = updated.length;
    }
    offset += drills.length;
    stripJobStatus.processed = processed;
  }

  stripJobStatus.running = false;
  stripJobStatus.finishedAt = new Date().toISOString();
  stripJobStatus.processed = processed;
  stripJobStatus.updated = updated.length;

  return res.json({
    ok: true,
    dryRun: !!dryRun,
    processed,
    updatedCount: updated.length,
    updated,
  });
});

// Re-enrich Drill Diagram via LLM (rebuild arrows/annotations/safeZones per drill content)
r.post("/admin/drills/reenrich-diagram", requireAdminPermission('canReviewQA'), async (req: AdminRequest, res) => {
  console.log("[ADMIN] reenrich-diagram start", req.body);
  reenrichJobStatus.running = true;
  reenrichJobStatus.startedAt = new Date().toISOString();
  reenrichJobStatus.finishedAt = null;
  reenrichJobStatus.processed = 0;
  reenrichJobStatus.updated = 0;
  reenrichJobStatus.lastError = null;

  const schema = z.object({
    drillRef: z.string().optional(),
    all: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional(),
    includeSessions: z.boolean().optional(),
    dryRun: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    reenrichJobStatus.running = false;
    reenrichJobStatus.lastError = "Invalid payload";
    return res.status(400).json({ ok: false, error: "Invalid payload" });
  }
  const { drillRef, all, limit, includeSessions, dryRun } = parsed.data;
  if (!drillRef && !all) {
    reenrichJobStatus.running = false;
    reenrichJobStatus.lastError = "Provide drillRef or all=true";
    return res.status(400).json({ ok: false, error: "Provide drillRef or all=true" });
  }

  const updated: Array<{ id: string; refCode: string | null }> = [];
  const touchedSessionIds = new Set<string>();
  let sessionsUpdated = 0;
  let sessionsTouched = 0;
  const maxUpdates = limit || 50;
  reenrichJobStatus.target = maxUpdates;

  const enrichDrill = async (drillRow: any) => {
    const drillJson = typeof drillRow.json === "string" ? parseJsonSafe(drillRow.json) : drillRow.json;
    if (!drillJson) return null;
    return await reenrichDiagramFromDrillJson(drillJson);
  };

  const updateSessionsForRef = async (refCode: string, newDiagram: any) => {
    const sessions = await prisma.session.findMany({
      where: { savedToVault: true },
      select: { id: true, json: true },
    });
    for (const s of sessions) {
      const json = typeof s.json === "string" ? parseJsonSafe(s.json) : s.json;
      if (!json || !Array.isArray(json.drills)) continue;
      let changed = false;
      json.drills = json.drills.map((d: any) => {
        if (String(d?.refCode || "").toUpperCase() === refCode.toUpperCase()) {
          changed = true;
          return { ...d, diagram: newDiagram, json: { ...(d.json || {}), diagram: newDiagram } };
        }
        return d;
      });
      if (changed && !dryRun) {
        await prisma.session.update({ where: { id: s.id }, data: { json } });
        sessionsUpdated += 1;
      }
      if (changed) {
        sessionsTouched += 1;
        touchedSessionIds.add(s.id);
      }
    }
  };

  let processed = 0;
  if (drillRef) {
    const drills = await prisma.drill.findMany({
      where: { OR: [{ id: drillRef }, { refCode: drillRef }] },
    });
    if (drills.length === 0) {
      reenrichJobStatus.running = false;
      reenrichJobStatus.lastError = "No drills found";
      return res.status(404).json({ ok: false, error: "No drills found" });
    }
    for (const drill of drills) {
      processed += 1;
      const newDiagram = await enrichDrill(drill);
      if (!newDiagram) continue;
      if (!dryRun) {
        const json = typeof drill.json === "string" ? parseJsonSafe(drill.json) : drill.json;
        const updatedJson = { ...(json || {}), diagram: newDiagram };
        await prisma.drill.update({ where: { id: drill.id }, data: { json: updatedJson } });
        if (includeSessions && drill.refCode) {
          await updateSessionsForRef(drill.refCode, newDiagram);
        }
      }
      updated.push({ id: drill.id, refCode: drill.refCode });
    }
  } else {
    const batchSize = 50;
    let offset = 0;
    while (updated.length < maxUpdates) {
      const drills = await prisma.drill.findMany({
        skip: offset,
        take: batchSize,
        orderBy: { createdAt: "desc" },
      });
      if (drills.length === 0) break;
      for (const drill of drills) {
        if (updated.length >= maxUpdates) break;
        processed += 1;
        const newDiagram = await enrichDrill(drill);
        if (!newDiagram) continue;
        if (!dryRun) {
          const json = typeof drill.json === "string" ? parseJsonSafe(drill.json) : drill.json;
          const updatedJson = { ...(json || {}), diagram: newDiagram };
          await prisma.drill.update({ where: { id: drill.id }, data: { json: updatedJson } });
          if (includeSessions && drill.refCode) {
            await updateSessionsForRef(drill.refCode, newDiagram);
          }
        }
        updated.push({ id: drill.id, refCode: drill.refCode });
        reenrichJobStatus.updated = updated.length;
      }
      offset += drills.length;
      reenrichJobStatus.processed = processed;
      console.log("[ADMIN] reenrich-diagram progress", { processed, updated: updated.length, target: maxUpdates });
    }
  }

  reenrichJobStatus.running = false;
  reenrichJobStatus.finishedAt = new Date().toISOString();
  reenrichJobStatus.processed = processed;
  reenrichJobStatus.updated = updated.length;

  return res.json({
    ok: true,
    dryRun: !!dryRun,
    processed,
    updatedCount: updated.length,
    sessionsUpdated,
    sessionsTouched,
    sessions: Array.from(touchedSessionIds).slice(0, 25),
    updated,
  });
});

// Re-enrich diagrams for a single session by ID or refCode
r.post("/admin/sessions/reenrich-diagram", requireAdminPermission('canReviewQA'), async (req: AdminRequest, res) => {
  const schema = z.object({
    sessionId: z.string().min(1).optional(),
    refCode: z.string().min(1).optional(),
    dryRun: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid payload" });
  }
  const { sessionId, refCode, dryRun } = parsed.data;
  if (!sessionId && !refCode) {
    return res.status(400).json({ ok: false, error: "Provide sessionId or refCode" });
  }

  const ref = String(refCode || "").toUpperCase();
  let session = await prisma.session.findFirst({
    where: sessionId ? { id: sessionId } : { refCode: ref },
    select: { id: true, json: true, refCode: true },
  });
  if (!session && refCode) {
    // Fallback: some legacy sessions may store refCode only inside json
    const total = await prisma.session.count();
    const batchSize = 500;
    let processed = 0;
    while (processed < total && !session) {
      const sessions = await prisma.session.findMany({
        skip: processed,
        take: batchSize,
        orderBy: { createdAt: "desc" },
        select: { id: true, json: true, refCode: true },
      });
      if (sessions.length === 0) break;
      for (const s of sessions) {
        const json = typeof s.json === "string" ? parseJsonSafe(s.json) : s.json;
        const jsonRef = String(json?.refCode || "").toUpperCase();
        if (jsonRef === ref) {
          session = s;
          break;
        }
      }
      processed += sessions.length;
    }
  }
  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  const json = typeof session.json === "string" ? parseJsonSafe(session.json) : session.json;
  if (!json || !Array.isArray(json.drills)) {
    return res.status(400).json({ ok: false, error: "Session JSON missing drills" });
  }

  const updatedDrills: Array<{ refCode?: string; title?: string }> = [];
  for (const drill of json.drills) {
    try {
      const reenriched = await reenrichDiagramFromDrillJson(drill);
      if (reenriched) {
        drill.diagram = reenriched;
        if (drill.json && typeof drill.json === "object") {
          drill.json.diagram = reenriched;
        }
        updatedDrills.push({ refCode: drill.refCode, title: drill.title });
      }
    } catch (err: any) {
      console.error("[ADMIN] session reenrich drill failed:", err?.message || String(err));
    }
  }

  if (!dryRun) {
    await prisma.session.update({ where: { id: session.id }, data: { json } });
  }

  return res.json({
    ok: true,
    sessionId: session.id,
    refCode: refCode || undefined,
    updatedCount: updatedDrills.length,
    updatedDrills,
  });
});

// Get Drill by ID
r.get("/admin/drills/:drillId", requireAdminPermission('canReviewQA'), async (req: AdminRequest, res) => {
  const drillId = req.params.drillId;
  
  try {
    const drill = await prisma.drill.findFirst({
      where: {
        OR: [{ id: drillId }, { refCode: drillId }],
      },
    });
    
    if (!drill) {
      return res.status(404).json({ ok: false, error: "Drill not found" });
    }
    
    return res.json({
      ok: true,
      drill,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Regenerate Drill
r.post("/admin/drills/regenerate", requireAdminPermission('canReviewQA'), async (req: AdminRequest, res) => {
  const drillRef = String(req.body?.drillRef || "").trim();
  const replace = req.body?.replace === true; // If true, delete old drill instead of marking as superseded

  if (!drillRef) {
    return res.status(400).json({ ok: false, error: "drillRef is required (id or refCode)" });
  }

  // Log admin action
  await logAdminAction(
    req.userId!,
    'drill.regenerate',
    {
      resourceType: 'Drill',
      resourceId: drillRef,
      data: { replace }
    },
    req
  );

  const drillRow = await prisma.drill.findFirst({
    where: {
      OR: [{ id: drillRef }, { refCode: drillRef }],
    },
  });

  if (!drillRow) {
    return res.status(404).json({ ok: false, error: "Drill not found" });
  }

  const drillJson = (drillRow.json as any) || {};

  // Build input from original drill metadata
  const regenInput: any = {
    gameModelId: String(drillRow.gameModelId),
    ageGroup: drillRow.ageGroup,
    phase: drillRow.phase ? String(drillRow.phase) : undefined,
    zone: drillRow.zone ? String(drillRow.zone) : undefined,
    drillType: drillJson.drillType || "TACTICAL",
    formationAttacking: drillJson.formationAttacking || "4-3-3",
    formationDefending: drillJson.formationDefending || drillJson.formationAttacking || "4-3-3",
    playerLevel: drillJson.playerLevel || "INTERMEDIATE",
    coachLevel: drillJson.coachLevel || "GRASSROOTS",
    numbersMin: drillRow.numbersMin ?? drillJson.numbersMin ?? 8,
    numbersMax: drillRow.numbersMax ?? drillJson.numbersMax ?? 12,
    goalsAvailable: drillJson.goalsAvailable ?? 2,
    spaceConstraint: drillRow.spaceConstraint ? String(drillRow.spaceConstraint) : drillJson.spaceConstraint ?? "HALF",
    durationMin: drillRow.durationMin ?? drillJson.durationMin ?? 25,
    gkOptional: drillJson.gkOptional ?? false,
  };

  // Generate new drill (auto-saved to vault, includes QA)
  const regen = await generateAndReviewDrill(regenInput, req.userId);
  const replacement = regen?.drill || null;

  if (!replacement || !(replacement as any).id) {
    return res.status(500).json({ ok: false, error: "Failed to generate replacement drill" });
  }

  const replacementId = (replacement as any).id;
  const replacementRefCode = (replacement as any).refCode;
  const replacementTitle = (replacement as any).title;
  const replacementQaScore = (replacement as any).qaScore;
  const replacementApproved = (replacement as any).approved;

  if (replace) {
    // Delete old drill
    // Note: QAReports will cascade delete automatically (via onDelete: Cascade in schema)
    // Favorites must be deleted explicitly (no cascade delete in schema)
    await prisma.favorite.deleteMany({
      where: { drillId: drillRow.id },
    });
    
    await prisma.drill.delete({
      where: { id: drillRow.id },
    });
  } else {
    // Mark original drill JSON as superseded (keep both)
    await prisma.drill.update({
      where: { id: drillRow.id },
      data: {
        approved: false,
        json: {
          ...(drillJson || {}),
          supersededBy: {
            id: replacementId,
            refCode: replacementRefCode,
            title: replacementTitle,
          },
        } as any,
      },
    });
  }

  return res.json({
    ok: true,
    replaced: replace,
    original: replace
      ? null
      : {
          id: drillRow.id,
          refCode: drillRow.refCode,
          title: drillRow.title,
        },
    replacement: {
      id: replacementId,
      refCode: replacementRefCode,
      title: replacementTitle,
      qaScore: replacementQaScore,
      approved: replacementApproved,
    },
  });
});


r.post("/admin/sessions/regenerate", requireAdminPermission('canReviewQA'), async (req: AdminRequest, res) => {
  const sessionRef = String(req.body?.sessionRef || "").trim();
  const replace = req.body?.replace === true; // If true, delete old session instead of marking as superseded

  if (!sessionRef) {
    return res.status(400).json({ ok: false, error: "sessionRef is required (id or refCode)" });
  }

  // Log admin action
  await logAdminAction(
    req.userId!,
    'session.regenerate',
    {
      resourceType: 'Session',
      resourceId: sessionRef,
      data: { replace }
    },
    req
  );

  const sessionRow = await prisma.session.findFirst({
    where: {
      OR: [{ id: sessionRef }, { refCode: sessionRef }],
    },
  });

  if (!sessionRow) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  const sessionJson = (sessionRow.json as any) || {};

  // Build input from original session metadata
  const formation = (sessionRow.formationUsed as any) || sessionJson.formationAttacking || "4-3-3";
  const regenInput: any = {
    gameModelId: String(sessionRow.gameModelId),
    ageGroup: sessionRow.ageGroup,
    phase: sessionRow.phase ? String(sessionRow.phase) : undefined,
    zone: sessionRow.zone ? String(sessionRow.zone) : undefined,
    formationAttacking: formation,
    formationDefending: formation,
    playerLevel: (sessionRow.playerLevel as any) || sessionJson.playerLevel || "INTERMEDIATE",
    coachLevel: (sessionRow.coachLevel as any) || sessionJson.coachLevel || "GRASSROOTS",
    numbersMin: (sessionRow.numbersMin as any) ?? sessionJson.numbersMin ?? 8,
    numbersMax: (sessionRow.numbersMax as any) ?? sessionJson.numbersMax ?? 12,
    goalsAvailable: (sessionRow.goalsAvailable as any) ?? sessionJson.goalsAvailable ?? 2,
    spaceConstraint: (sessionRow.spaceConstraint as any) ?? sessionJson.spaceConstraint ?? "HALF",
    durationMin: (sessionRow.durationMin as any) ?? sessionJson.durationMin ?? 90,
  };

  // Generate new session (auto-saved to vault, includes QA)
  const regen = await generateAndReviewSession(regenInput, req.userId);
  const replacement = regen?.session || null;

  if (!replacement) {
    return res.status(500).json({ ok: false, error: "Failed to generate replacement session" });
  }

  if (replace) {
    // Delete old session
    // Note: QAReports and SkillFocus will cascade delete automatically (via onDelete: Cascade in schema)
    // Favorites must be deleted explicitly (no cascade delete in schema)
    await prisma.favorite.deleteMany({
      where: { sessionId: sessionRow.id },
    });
    
    await prisma.session.delete({
      where: { id: sessionRow.id },
    });
  } else {
    // Mark original session JSON as superseded (keep both)
    await prisma.session.update({
      where: { id: sessionRow.id },
      data: {
        approved: false,
        json: {
          ...(sessionJson || {}),
          supersededBy: {
            id: replacement.id,
            refCode: replacement.refCode,
            title: replacement.title,
          },
        } as any,
      },
    });
  }

  return res.json({
    ok: true,
    replaced: replace,
    original: replace
      ? null
      : {
          id: sessionRow.id,
          refCode: sessionRow.refCode,
          title: sessionRow.title,
        },
    replacement: {
      id: replacement.id,
      refCode: replacement.refCode,
      title: replacement.title,
      qaScore: replacement.qaScore,
      approved: replacement.approved,
    },
  });
});

r.delete("/admin/sessions/:sessionRef", requireAdminPermission('canDeleteSessions'), async (req: AdminRequest, res) => {
  const sessionRef = String(req.params.sessionRef || "").trim();
  if (!sessionRef) {
    return res.status(400).json({ ok: false, error: "sessionRef is required" });
  }

  const sessionRow = await prisma.session.findFirst({
    where: {
      OR: [{ id: sessionRef }, { refCode: sessionRef.toUpperCase() }],
    },
    select: { id: true, refCode: true, title: true },
  });

  if (!sessionRow) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  await logAdminAction(
    req.userId!,
    "session.delete",
    {
      resourceType: "Session",
      resourceId: sessionRow.id,
      data: { refCode: sessionRow.refCode, title: sessionRow.title },
    },
    req
  );

  const result = await prisma.$transaction(async (tx) => {
    const favoritesDeleted = await tx.favorite.deleteMany({
      where: { sessionId: sessionRow.id },
    });
    const calendarEventsDeleted = await tx.calendarEvent.deleteMany({
      where: { sessionId: sessionRow.id },
    });
    const playerPlansDeleted = await tx.playerPlan.deleteMany({
      where: { sourceType: "SESSION", sourceId: sessionRow.id },
    });
    await tx.session.delete({ where: { id: sessionRow.id } });

    return {
      favoritesDeleted: favoritesDeleted.count,
      calendarEventsDeleted: calendarEventsDeleted.count,
      playerPlansDeleted: playerPlansDeleted.count,
    };
  });

  return res.json({
    ok: true,
    deleted: {
      id: sessionRow.id,
      refCode: sessionRow.refCode,
      title: sessionRow.title,
    },
    ...result,
  });
});

// ------------------------------------
// Admin: QA Status Analytics
// ------------------------------------
r.get("/admin/analytics/qa-status", requireAdminPermission('canViewAnalytics'), async (req: AdminRequest, res) => {
  try {
    console.log('[QA-STATUS] Starting QA status analytics query...');
    // Get all sessions with their latest QA reports
    const sessions = await prisma.session.findMany({
      where: {
        savedToVault: true, // Only count vault sessions
      },
      include: {
        qaReports: {
          orderBy: { createdAt: "desc" },
          take: 1, // Get only the latest QA report
        },
      },
    });
    console.log(`[QA-STATUS] Found ${sessions.length} sessions`);

    // Compute fixDecision for each session based on latest QA scores
    const statusCounts: Record<FixDecisionCode, number> = {
      OK: 0,
      PATCHABLE: 0,
      NEEDS_REGEN: 0,
      NO_QA_OR_PASS: 0,
    };

    const sessionsByStatus: Record<FixDecisionCode, Array<{ id: string; refCode: string | null; title: string; qaScore: number | null }>> = {
      OK: [],
      PATCHABLE: [],
      NEEDS_REGEN: [],
      NO_QA_OR_PASS: [],
    };

    for (const session of sessions) {
      const latestQA = session.qaReports[0];
      let fixDecisionCode: FixDecisionCode = "NO_QA_OR_PASS";

      if (latestQA && latestQA.scores) {
        const scores = latestQA.scores as any;
        const fixDecision = fixSessionDecision(scores);
        fixDecisionCode = fixDecision.code;
      } else if (session.qaScore !== null) {
        // If no QA report but has qaScore, try to infer from approved status
        fixDecisionCode = session.approved ? "OK" : "NO_QA_OR_PASS";
      }

      statusCounts[fixDecisionCode]++;
      sessionsByStatus[fixDecisionCode].push({
        id: session.id,
        refCode: session.refCode,
        title: session.title,
        qaScore: session.qaScore,
      });
    }

    // Sort sessions by QA score (highest first) for each status
    Object.keys(sessionsByStatus).forEach((key) => {
      sessionsByStatus[key as FixDecisionCode].sort((a, b) => {
        if (a.qaScore === null && b.qaScore === null) return 0;
        if (a.qaScore === null) return 1;
        if (b.qaScore === null) return -1;
        return b.qaScore - a.qaScore;
      });
    });

    const total = sessions.length;
    const withQA = sessions.filter((s) => s.qaReports.length > 0).length;
    const withoutQA = total - withQA;

    const response = {
      ok: true,
      total,
      withQA,
      withoutQA,
      statusCounts,
      sessionsByStatus: {
        OK: sessionsByStatus.OK.slice(0, 10), // Top 10 for each status
        PATCHABLE: sessionsByStatus.PATCHABLE.slice(0, 10),
        NEEDS_REGEN: sessionsByStatus.NEEDS_REGEN.slice(0, 10),
        NO_QA_OR_PASS: sessionsByStatus.NO_QA_OR_PASS.slice(0, 10),
      },
    };
    console.log('[QA-STATUS] Query completed successfully');
    return res.json(response);
  } catch (e: any) {
    console.error('[QA-STATUS] Error:', e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// QA Status Analytics for Drills (standalone only, not contained in sessions)
r.get("/admin/analytics/qa-status-drills", requireAdminPermission('canViewAnalytics'), async (req: AdminRequest, res) => {
  try {
    console.log('[QA-STATUS-DRILLS] Starting QA status analytics query for standalone drills...');
    
    // First, get all sessions and extract drill refCodes from their JSON
    const sessions = await prisma.session.findMany({
      where: {
        savedToVault: true,
      },
      select: {
        json: true,
      },
    });
    
    // Collect all drill refCodes that appear in sessions
    const drillRefCodesInSessions = new Set<string>();
    for (const session of sessions) {
      const sessionJson = session.json as any;
      if (sessionJson?.drills && Array.isArray(sessionJson.drills)) {
        for (const drill of sessionJson.drills) {
          if (drill.refCode) {
            drillRefCodesInSessions.add(drill.refCode);
          }
        }
      }
    }
    
    console.log(`[QA-STATUS-DRILLS] Found ${drillRefCodesInSessions.size} drill refCodes in sessions`);
    
    // Get all standalone drills (not in sessions) with their latest QA reports
    const allDrills = await prisma.drill.findMany({
      where: {
        savedToVault: true, // Only count vault drills
      },
      include: {
        qaReports: {
          orderBy: { createdAt: "desc" },
          take: 1, // Get only the latest QA report
        },
      },
    });
    
    // Filter out drills that are contained in sessions
    const drills = allDrills.filter(drill => {
      // If drill has no refCode, include it (standalone)
      if (!drill.refCode) return true;
      // Exclude if refCode appears in any session
      return !drillRefCodesInSessions.has(drill.refCode);
    });
    
    console.log(`[QA-STATUS-DRILLS] Found ${allDrills.length} total vault drills, ${drills.length} standalone drills (not in sessions)`);

    // Compute fixDecision for each drill based on latest QA scores
    const statusCounts: Record<FixDecisionCode, number> = {
      OK: 0,
      PATCHABLE: 0,
      NEEDS_REGEN: 0,
      NO_QA_OR_PASS: 0,
    };

    const drillsByStatus: Record<FixDecisionCode, Array<{ id: string; refCode: string | null; title: string; qaScore: number | null }>> = {
      OK: [],
      PATCHABLE: [],
      NEEDS_REGEN: [],
      NO_QA_OR_PASS: [],
    };

    for (const drill of drills) {
      const latestQA = drill.qaReports[0];
      let fixDecisionCode: FixDecisionCode = "NO_QA_OR_PASS";

      if (latestQA && latestQA.scores) {
        const scores = latestQA.scores as any;
        const fixDecision = fixDrillDecision(scores);
        fixDecisionCode = fixDecision.code;
      } else if (drill.qaScore !== null) {
        // If no QA report but has qaScore, try to infer from approved status
        fixDecisionCode = drill.approved ? "OK" : "NO_QA_OR_PASS";
      }

      statusCounts[fixDecisionCode]++;
      drillsByStatus[fixDecisionCode].push({
        id: drill.id,
        refCode: drill.refCode,
        title: drill.title,
        qaScore: drill.qaScore,
      });
    }

    // Sort drills by QA score (highest first) for each status
    Object.keys(drillsByStatus).forEach((key) => {
      drillsByStatus[key as FixDecisionCode].sort((a, b) => {
        if (a.qaScore === null && b.qaScore === null) return 0;
        if (a.qaScore === null) return 1;
        if (b.qaScore === null) return -1;
        return b.qaScore - a.qaScore;
      });
    });

    const total = drills.length;
    const withQA = drills.filter((d) => d.qaReports.length > 0).length;
    const withoutQA = total - withQA;

    const response = {
      ok: true,
      total,
      withQA,
      withoutQA,
      statusCounts,
      drillsByStatus: {
        OK: drillsByStatus.OK.slice(0, 10), // Top 10 for each status
        PATCHABLE: drillsByStatus.PATCHABLE.slice(0, 10),
        NEEDS_REGEN: drillsByStatus.NEEDS_REGEN.slice(0, 10),
        NO_QA_OR_PASS: drillsByStatus.NO_QA_OR_PASS.slice(0, 10),
      },
    };
    console.log('[QA-STATUS-DRILLS] Query completed successfully');
    return res.json(response);
  } catch (e: any) {
    console.error('[QA-STATUS-DRILLS] Error:', e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// ------------------------------------
// Admin: User Summary (counts by role/access)
// ------------------------------------

r.get("/admin/users/summary", requireAdminPermission('canManageUsers'), async (req: AdminRequest, res) => {
  try {
    const [totalUsers, byRoleRaw, byAdminRoleRaw, byPlanRaw, byStatusRaw] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({
        by: ["role"],
        _count: { id: true },
      }),
      prisma.user.groupBy({
        by: ["adminRole"],
        _count: { id: true },
        where: { adminRole: { not: null } },
      }),
      prisma.user.groupBy({
        by: ["subscriptionPlan"],
        _count: { id: true },
      }),
      prisma.user.groupBy({
        by: ["subscriptionStatus"],
        _count: { id: true },
      }),
    ]);

    const initRecord = (keys: string[]) =>
      keys.reduce<Record<string, number>>((acc, key) => {
        acc[key] = 0;
        return acc;
      }, {});

    const roleKeys = ["FREE", "COACH", "CLUB", "ADMIN", "TRIAL"];
    const adminRoleKeys = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "SUPPORT"];
    const planKeys = ["FREE", "COACH_BASIC", "COACH_PRO", "CLUB_STANDARD", "CLUB_PREMIUM", "TRIAL"];
    const statusKeys = ["ACTIVE", "CANCELLED", "EXPIRED", "TRIAL"];

    const byRole = initRecord(roleKeys);
    for (const row of byRoleRaw) {
      byRole[row.role] = row._count.id;
    }

    const byAdminRole = initRecord(adminRoleKeys);
    for (const row of byAdminRoleRaw) {
      if (row.adminRole) {
        byAdminRole[row.adminRole] = row._count.id;
      }
    }

    const bySubscriptionPlan = initRecord(planKeys);
    for (const row of byPlanRaw) {
      bySubscriptionPlan[row.subscriptionPlan] = row._count.id;
    }

    const bySubscriptionStatus = initRecord(statusKeys);
    for (const row of byStatusRaw) {
      bySubscriptionStatus[row.subscriptionStatus] = row._count.id;
    }

    return res.json({
      ok: true,
      summary: {
        totalUsers,
        byRole,
        byAdminRole,
        bySubscriptionPlan,
        bySubscriptionStatus,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Admin: Account alerts (overview widget)
r.get("/admin/account-alerts", requireAdminPermission('canAccessAdminDashboard'), async (_req: AdminRequest, res) => {
  return res.json({
    ok: true,
    alerts: [],
  });
});

// ------------------------------------
// Admin: User Management
// ------------------------------------

// Quick-create user (minimal admin flow)
r.post("/admin/users/quick-create", requireAdminPermission('canManageUsers'), async (req: AdminRequest, res) => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1).optional(),
    role: z.enum(["FREE", "COACH", "CLUB", "ADMIN", "TRIAL"]).optional(),
    subscriptionPlan: z.enum(["FREE", "COACH_BASIC", "COACH_PRO", "CLUB_STANDARD", "CLUB_PREMIUM", "TRIAL"]).optional(),
    subscriptionStatus: z.enum(["ACTIVE", "CANCELLED", "EXPIRED", "TRIAL"]).optional(),
    adminRole: z.enum(["SUPER_ADMIN", "ADMIN", "MODERATOR", "SUPPORT"]).optional(),
    password: z.string().min(8).optional().or(z.literal("").transform(() => undefined)),
    autoVerifyEmail: z.boolean().optional(),
    coachLevel: z.enum(["GRASSROOTS", "USSF_C", "USSF_B_PLUS"]).optional(),
    teamAgeGroups: z.array(z.string()).optional(),
  });

  try {
    const body = schema.parse(req.body || {});

    // Prevent non-super admins from assigning admin roles
    if (body.adminRole && req.adminRole !== "SUPER_ADMIN") {
      return res.status(403).json({
        ok: false,
        error: "Only SUPER_ADMIN can assign admin roles",
      });
    }

    // Validate coach-specific fields when role is COACH
    const role = body.role || "FREE";
    if (role === "COACH") {
      if (!body.coachLevel) {
        return res.status(400).json({
          ok: false,
          error: "Coach level is required when role is COACH",
        });
      }
      if (!body.teamAgeGroups || body.teamAgeGroups.length === 0) {
        return res.status(400).json({
          ok: false,
          error: "At least one age group is required when role is COACH",
        });
      }
    }

    // Check for existing user
    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });

    if (existing) {
      return res.status(400).json({ ok: false, error: "User with this email already exists" });
    }

    // Map role to default subscription plan if not explicitly provided
    const defaultPlanByRole: Record<string, string> = {
      FREE: "FREE",
      COACH: "COACH_BASIC",
      CLUB: "CLUB_STANDARD",
      ADMIN: "FREE",
      TRIAL: "TRIAL",
    };

    const subscriptionPlan = body.subscriptionPlan || (defaultPlanByRole[role] as any);

    // Default status: TRIAL for trial plan, ACTIVE otherwise
    const subscriptionStatus = body.subscriptionStatus || (subscriptionPlan === "TRIAL" ? "TRIAL" : "ACTIVE");

    const autoPassword = !body.password;
    const plainPassword =
      body.password ||
      // 12-char random password using URL-safe base64
      require("crypto").randomBytes(9).toString("base64url").slice(0, 12);

    const passwordHash = await hashPassword(plainPassword);

    const now = new Date();
    let trialEndDate: Date | null = null;
    if (subscriptionPlan === "TRIAL" || role === "TRIAL") {
      trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7);
    }

    const shouldAutoVerify = !!body.autoVerifyEmail || body.adminRole === "SUPER_ADMIN";

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        name: body.name,
        role: role as any,
        subscriptionPlan: subscriptionPlan as any,
        subscriptionStatus: subscriptionStatus as any,
        subscriptionStartDate: subscriptionStatus === "ACTIVE" || subscriptionStatus === "TRIAL" ? now : null,
        trialEndDate: trialEndDate,
        lastResetDate: now,
        adminRole: body.adminRole as any,
        emailVerified: shouldAutoVerify,
        emailVerifiedAt: shouldAutoVerify ? now : null,
        coachLevel: body.coachLevel as any,
        teamAgeGroups: body.teamAgeGroups || [],
      },
    });

    // If not auto-verified, create verification token & send email
    if (!shouldAutoVerify && user.email) {
      const verificationToken = generateVerificationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await prisma.emailVerificationToken.create({
        data: {
          token: verificationToken,
          userId: user.id,
          email: user.email,
          expiresAt,
        },
      });

      try {
        await sendVerificationEmail(user.email, user.name, verificationToken);
        console.log(`[ADMIN] Verification email sent to ${user.email} for quick-create user`);
      } catch (err: any) {
        console.error("[ADMIN] Failed to send verification email for quick-create user:", err);
        // Don't fail the user creation if email fails, but log it clearly
        console.warn(`[ADMIN] User ${user.email} created but verification email failed. Token: ${verificationToken}`);
      }
    }

    await logAdminAction(
      req.userId!,
      "user.quick_create",
      {
        resourceType: "User",
        resourceId: user.id,
        data: {
          role,
          subscriptionPlan,
          subscriptionStatus,
          adminRole: body.adminRole ?? null,
          autoPassword,
        },
      },
      req
    );

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        adminRole: user.adminRole,
        emailVerified: user.emailVerified,
      },
      initialPassword: autoPassword ? plainPassword : undefined,
      autoPassword,
    });
  } catch (error: any) {
    console.error("[ADMIN] quick-create user error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        ok: false,
        error: "Invalid input",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

// List users with pagination
r.get("/admin/users", requireAdminPermission('canManageUsers'), async (req: AdminRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          sessionsGeneratedThisMonth: true,
          drillsGeneratedThisMonth: true,
          createdAt: true,
          lastLoginAt: true,
          adminRole: true,
          blocked: true,
          blockedAt: true,
          blockedReason: true,
          emailVerified: true,
          emailVerifiedAt: true,
          coachLevel: true,
          teamAgeGroups: true,
          organizationName: true,
        }
      }),
      prisma.user.count()
    ]);
    
    return res.json({
      ok: true,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Get user details
r.get("/admin/users/:userId", requireAdminPermission('canViewAllUserData'), async (req: AdminRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: {
        favorites: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            favorites: true,
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    // Get usage limits
    const sessionLimit = await checkUsageLimit(user.id, 'session');
    const drillLimit = await checkUsageLimit(user.id, 'drill');

    // Get subscription features (SUPER_ADMIN has no feature limits)
    const features = getFeaturesForUser({
      subscriptionPlan: user.subscriptionPlan,
      adminRole: user.adminRole,
    });

    // Count vault items
    const vaultSessionsCount = await prisma.session.count({
      where: {
        savedToVault: true,
        generatedBy: user.id,
      },
    });
    
    // Note: Drills in vault are global (not user-specific in current schema)
    // For now, we'll set this to 0 or count all drills if needed
    const vaultDrillsCount = 0;

    // Count favorites
    const favoritesCount = await prisma.favorite.count({
      where: { userId: user.id },
    });

    // Calculate vault limits (SUPER_ADMIN unlimited)
    const plan = user.subscriptionPlan as keyof typeof SUBSCRIPTION_LIMITS;
    const limits = SUBSCRIPTION_LIMITS[plan] || SUBSCRIPTION_LIMITS.FREE;
    const isSuperAdmin = user.adminRole === "SUPER_ADMIN";
    const vaultSessionsLimit = isSuperAdmin ? -1 : limits.vaultSessions;
    const vaultDrillsLimit = isSuperAdmin ? -1 : limits.vaultDrills;
    const favoritesLimit = isSuperAdmin ? -1 : limits.maxFavorites;

    // Trial status
    let trialStatus = null;
    if (user.subscriptionPlan === 'TRIAL' && user.trialEndDate) {
      const now = new Date();
      const trialEnd = new Date(user.trialEndDate);
      const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      trialStatus = {
        trialEndDate: user.trialEndDate,
        daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
        trialExpired: trialEnd < now,
      };
    }

    // Monthly reset info
    const lastReset = new Date(user.lastResetDate);
    const now = new Date();
    const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilNextReset = 30 - daysSinceReset;

    return res.json({
      ok: true,
      user: {
        ...user,
        usage: {
          sessions: {
            used: user.sessionsGeneratedThisMonth,
            limit: sessionLimit.limit,
            remaining: sessionLimit.remaining,
            percentage: sessionLimit.limit === -1 ? 0 : Math.round((user.sessionsGeneratedThisMonth / sessionLimit.limit) * 100),
          },
          drills: {
            used: user.drillsGeneratedThisMonth,
            limit: drillLimit.limit,
            remaining: drillLimit.remaining,
            percentage: drillLimit.limit === -1 ? 0 : Math.round((user.drillsGeneratedThisMonth / drillLimit.limit) * 100),
          },
        },
        vault: {
          sessions: {
            count: vaultSessionsCount,
            limit: vaultSessionsLimit,
            remaining: vaultSessionsLimit === -1 ? -1 : Math.max(0, vaultSessionsLimit - vaultSessionsCount),
          },
          drills: {
            count: vaultDrillsCount,
            limit: vaultDrillsLimit,
            remaining: vaultDrillsLimit === -1 ? -1 : Math.max(0, vaultDrillsLimit - vaultDrillsCount),
          },
        },
        favorites: {
          count: favoritesCount,
          limit: favoritesLimit,
          remaining: favoritesLimit === -1 ? -1 : Math.max(0, favoritesLimit - favoritesCount),
        },
        features,
        trialStatus,
        monthlyReset: {
          lastResetDate: user.lastResetDate,
          daysSinceReset,
          daysUntilNextReset: daysUntilNextReset > 0 ? daysUntilNextReset : 0,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Update user subscription
r.patch("/admin/users/:userId/subscription", requireAdminPermission('canManageSubscriptions'), async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    const { subscriptionPlan, subscriptionStatus } = req.body;
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan,
        subscriptionStatus,
        subscriptionStartDate: subscriptionStatus === 'ACTIVE' ? new Date() : undefined,
      }
    });
    
    await logAdminAction(
      req.userId!,
      'subscription.changed',
      {
        resourceType: 'User',
        resourceId: userId,
        data: { subscriptionPlan, subscriptionStatus }
      },
      req
    );
    
    return res.json({ ok: true, user });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Delete user
r.delete("/admin/users/:userId", requireAdminPermission('canDeleteUsers'), async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    
    // Prevent deleting yourself
    if (userId === req.userId) {
      return res.status(400).json({ ok: false, error: 'Cannot delete your own account' });
    }
    
    // Prevent deleting other admins (unless super admin)
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { adminRole: true, email: true }
    });
    
    if (targetUser?.adminRole && req.adminRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        ok: false, 
        error: 'Cannot delete admin users' 
      });
    }

    if (!targetUser) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    // Hard-delete account data: remove user-owned and user-generated artifacts.
    const generatedSessions = await prisma.session.findMany({
      where: { generatedBy: userId },
      select: { id: true, seriesId: true },
    });
    const generatedSessionIds = generatedSessions.map((s) => s.id);
    const generatedSeriesIds = Array.from(new Set(
      generatedSessions
        .map((s) => String(s.seriesId || "").trim())
        .filter(Boolean)
    ));

    const generatedDrills = await prisma.drill.findMany({
      where: { generatedBy: userId },
      select: { id: true },
    });
    const generatedDrillIds = generatedDrills.map((d) => d.id);

    const deleted = await prisma.$transaction(async (tx) => {
      let favoritesBySession = 0;
      let favoritesBySeries = 0;
      let favoritesByDrill = 0;
      let calendarBySession = 0;
      let playerPlansBySession = 0;
      let playerPlansBySeries = 0;
      let skillFocusBySession = 0;
      let skillFocusBySeries = 0;
      let sessionsDeleted = 0;
      let drillsDeleted = 0;

      if (generatedSessionIds.length > 0) {
        const favSession = await tx.favorite.deleteMany({
          where: { sessionId: { in: generatedSessionIds } },
        });
        favoritesBySession = favSession.count;

        const calSession = await tx.calendarEvent.deleteMany({
          where: { sessionId: { in: generatedSessionIds } },
        });
        calendarBySession = calSession.count;

        const ppSession = await tx.playerPlan.deleteMany({
          where: { sourceType: "SESSION", sourceId: { in: generatedSessionIds } },
        });
        playerPlansBySession = ppSession.count;

        const sfSession = await tx.skillFocus.deleteMany({
          where: { sessionId: { in: generatedSessionIds } },
        });
        skillFocusBySession = sfSession.count;

        const sess = await tx.session.deleteMany({
          where: { id: { in: generatedSessionIds } },
        });
        sessionsDeleted = sess.count;
      }

      if (generatedSeriesIds.length > 0) {
        const favSeries = await tx.favorite.deleteMany({
          where: { seriesId: { in: generatedSeriesIds } },
        });
        favoritesBySeries = favSeries.count;

        const ppSeries = await tx.playerPlan.deleteMany({
          where: { sourceType: "SERIES", sourceId: { in: generatedSeriesIds } },
        });
        playerPlansBySeries = ppSeries.count;

        const sfSeries = await tx.skillFocus.deleteMany({
          where: { seriesId: { in: generatedSeriesIds } },
        });
        skillFocusBySeries = sfSeries.count;
      }

      if (generatedDrillIds.length > 0) {
        const favDrill = await tx.favorite.deleteMany({
          where: { drillId: { in: generatedDrillIds } },
        });
        favoritesByDrill = favDrill.count;

        const dr = await tx.drill.deleteMany({
          where: { id: { in: generatedDrillIds } },
        });
        drillsDeleted = dr.count;
      }

      const deletedUser = await tx.user.delete({ where: { id: userId } });

      return {
        userId: deletedUser.id,
        sessionsDeleted,
        drillsDeleted,
        favoritesBySession,
        favoritesBySeries,
        favoritesByDrill,
        calendarBySession,
        playerPlansBySession,
        playerPlansBySeries,
        skillFocusBySession,
        skillFocusBySeries,
      };
    });
    
    await logAdminAction(
      req.userId!,
      'user.deleted',
      {
        resourceType: 'User',
        resourceId: userId,
        data: {
          email: targetUser.email || null,
          hardDelete: true,
          deleted,
        },
      },
      req
    );
    
    return res.json({ ok: true, deleted });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Update user role (regular role or admin role)
r.patch("/admin/users/:userId/role", requireAdminPermission('canChangeUserRoles'), async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    const { role, adminRole } = req.body;
    
    // Prevent changing your own role
    if (userId === req.userId) {
      return res.status(400).json({ ok: false, error: 'Cannot change your own role' });
    }
    
    const updateData: any = {};
    
    // Update regular role if provided
    if (role) {
      if (!['FREE', 'COACH', 'CLUB', 'ADMIN', 'TRIAL'].includes(role)) {
        return res.status(400).json({ ok: false, error: 'Invalid role' });
      }
      updateData.role = role;

      // Keep role and subscription limits aligned when role is changed in admin.
      const defaultPlanByRole: Record<string, string> = {
        FREE: "FREE",
        COACH: "COACH_BASIC",
        CLUB: "CLUB_STANDARD",
        ADMIN: "FREE",
        TRIAL: "TRIAL",
      };
      const now = new Date();
      const mappedPlan = defaultPlanByRole[role] || "FREE";
      updateData.subscriptionPlan = mappedPlan;
      updateData.subscriptionStatus = mappedPlan === "TRIAL" ? "TRIAL" : "ACTIVE";
      updateData.subscriptionStartDate = now;
      updateData.lastResetDate = now;
      updateData.sessionsGeneratedThisMonth = 0;
      updateData.drillsGeneratedThisMonth = 0;

      if (mappedPlan === "TRIAL") {
        const trialEndDate = new Date(now);
        trialEndDate.setDate(trialEndDate.getDate() + 7);
        updateData.trialEndDate = trialEndDate;
      } else {
        updateData.trialEndDate = null;
      }
    }
    
    // Update admin role if provided
    if (adminRole !== undefined) {
      if (adminRole !== null && !['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'].includes(adminRole)) {
        return res.status(400).json({ ok: false, error: 'Invalid admin role' });
      }
      
      // Only super admin can assign admin roles
      if (req.adminRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ ok: false, error: 'Only super admins can assign admin roles' });
      }
      
      // Prevent removing admin role from other admins (unless super admin)
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { adminRole: true }
      });
      
      if (targetUser?.adminRole && adminRole === null && req.adminRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ ok: false, error: 'Cannot remove admin role from other admins' });
      }
      
      updateData.adminRole = adminRole;
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ ok: false, error: 'No role updates provided' });
    }
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        adminRole: true,
      }
    });
    
    await logAdminAction(
      req.userId!,
      'user.role.changed',
      {
        resourceType: 'User',
        resourceId: userId,
        data: updateData
      },
      req
    );
    
    return res.json({ ok: true, user });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Reset user password
r.post("/admin/users/:userId/reset-password", requireAdminPermission('canManageUsers'), async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    const { password, autoGenerate } = req.body;
    
    // Prevent resetting your own password
    if (userId === req.userId) {
      return res.status(400).json({ ok: false, error: 'Cannot reset your own password' });
    }
    
    // Get user to verify they exist
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true }
    });
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    let newPassword: string;
    const shouldAutoGenerate = autoGenerate === true || (autoGenerate !== false && (!password || password.trim() === ''));
    
    if (shouldAutoGenerate) {
      // Auto-generate 12-char random password
      newPassword = require("crypto").randomBytes(9).toString("base64url").slice(0, 12);
      console.log(`[ADMIN] Auto-generating password for user ${user.email} (${userId})`);
    } else if (password && password.trim()) {
      const trimmedPassword = password.trim();
      if (trimmedPassword.length < 8) {
        return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' });
      }
      newPassword = trimmedPassword;
      console.log(`[ADMIN] Setting custom password for user ${user.email} (${userId})`);
    } else {
      return res.status(400).json({ ok: false, error: 'Password is required' });
    }
    
    // Hash the password
    const passwordHash = await hashPassword(newPassword);
    console.log(`[ADMIN] Password hashed successfully for user ${user.email}`);
    
    // Update user with new password hash
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true, email: true, passwordHash: true }
    });
    
    console.log(`[ADMIN] Password updated in database for user ${user.email}`);
    
    // Verify the password was saved correctly by testing it
    const { verifyPassword } = await import('./services/auth');
    const passwordMatches = await verifyPassword(newPassword, updatedUser.passwordHash!);
    if (!passwordMatches) {
      console.error(`[ADMIN] CRITICAL: Password verification failed after reset for user ${user.email}`);
      return res.status(500).json({ 
        ok: false, 
        error: 'Password was set but verification failed. Please try again.' 
      });
    }
    
    console.log(`[ADMIN] Password verification successful for user ${user.email}`);
    
    await logAdminAction(
      req.userId!,
      'user.password.reset',
      {
        resourceType: 'User',
        resourceId: userId,
        data: { autoGenerated: shouldAutoGenerate, userEmail: user.email }
      },
      req
    );
    
    return res.json({
      ok: true,
      newPassword: shouldAutoGenerate ? newPassword : undefined,
      message: shouldAutoGenerate 
        ? 'Password reset successfully. New password generated.'
        : 'Password reset successfully.'
    });
  } catch (error: any) {
    console.error('[ADMIN] Password reset error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Manually verify user email
r.post("/admin/users/:userId/verify-email", requireAdminPermission('canManageUsers'), async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        emailVerifiedAt: true,
      }
    });
    
    await logAdminAction(
      req.userId!,
      'user.email.verified',
      {
        resourceType: 'User',
        resourceId: userId,
        data: { manuallyVerified: true }
      },
      req
    );
    
    return res.json({ ok: true, user });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Resend verification email
r.post("/admin/users/:userId/resend-verification", requireAdminPermission('canManageUsers'), async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, emailVerified: true }
    });
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({ ok: false, error: 'Email is already verified' });
    }
    
    if (!user.email) {
      return res.status(400).json({ ok: false, error: 'User has no email address' });
    }
    
    // Delete old tokens
    await prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id }
    });
    
    // Create new token
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    await prisma.emailVerificationToken.create({
      data: {
        token: verificationToken,
        userId: user.id,
        email: user.email,
        expiresAt,
      }
    });
    
    // Send email
    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
      console.log(`[ADMIN] Verification email resent to ${user.email}`);
    } catch (err: any) {
      console.error("[ADMIN] Failed to resend verification email:", err);
      return res.status(502).json({
        ok: false,
        error: 'Failed to send verification email. Please verify SMTP settings and check server logs.',
        token: process.env.NODE_ENV === 'development' ? verificationToken : undefined, // Only show token in dev
      });
    }
    
    await logAdminAction(
      req.userId!,
      'user.verification.resent',
      {
        resourceType: 'User',
        resourceId: userId,
      },
      req
    );
    
    return res.json({
      ok: true,
      message: 'Verification email sent',
      token: process.env.NODE_ENV === 'development' ? verificationToken : undefined, // Only show token in dev
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Update user coach level
r.patch("/admin/users/:userId/coach-level", requireAdminPermission('canManageUsers'), async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    const { coachLevel, teamAgeGroups, promoteToCoach } = req.body;
    
    const schema = z.object({
      coachLevel: z.enum(["GRASSROOTS", "USSF_C", "USSF_B_PLUS"]).nullable().optional(),
      teamAgeGroups: z.array(z.string()).optional(),
      promoteToCoach: z.boolean().optional(),
    });
    
    const body = schema.parse({ coachLevel, teamAgeGroups, promoteToCoach });
    
    // Get user to verify they exist and check their role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true }
    });
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    const shouldPromoteToCoach =
      user.role !== 'COACH' &&
      (body.promoteToCoach ?? true) &&
      (body.coachLevel !== undefined || body.teamAgeGroups !== undefined);

    // Keep a guard in case caller explicitly disables promotion.
    if (user.role !== 'COACH' && !shouldPromoteToCoach) {
      return res.status(400).json({
        ok: false,
        error: 'Coach level can only be set for users with COACH role',
      });
    }
    
    const updateData: any = {};
    if (shouldPromoteToCoach) {
      updateData.role = 'COACH';
    }
    if (body.coachLevel !== undefined) {
      updateData.coachLevel = body.coachLevel;
    }
    if (body.teamAgeGroups !== undefined) {
      updateData.teamAgeGroups = body.teamAgeGroups;
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        coachLevel: true,
        teamAgeGroups: true,
      }
    });
    
    await logAdminAction(
      req.userId!,
      'user.coach_level.updated',
      {
        resourceType: 'User',
        resourceId: userId,
        data: {
          coachLevel: body.coachLevel,
          teamAgeGroups: body.teamAgeGroups,
          rolePromotedToCoach: shouldPromoteToCoach,
        }
      },
      req
    );
    
    return res.json({ ok: true, user: updatedUser });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ ok: false, error: 'Invalid input', details: error.errors });
    }
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Block/unblock user access
r.patch("/admin/users/:userId/block", requireAdminPermission('canManageUsers'), async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    const { blocked, reason } = req.body;
    
    // Prevent blocking yourself
    if (userId === req.userId) {
      return res.status(400).json({ ok: false, error: 'Cannot block your own account' });
    }
    
    if (typeof blocked !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'blocked must be a boolean' });
    }
    
    const updateData: any = {
      blocked,
      blockedAt: blocked ? new Date() : null,
      blockedReason: blocked ? (reason || null) : null,
    };
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        blocked: true,
        blockedAt: true,
        blockedReason: true,
      }
    });
    
    await logAdminAction(
      req.userId!,
      blocked ? 'user.blocked' : 'user.unblocked',
      {
        resourceType: 'User',
        resourceId: userId,
        data: { blocked, reason: reason || null }
      },
      req
    );
    
    return res.json({ ok: true, user });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Promote user to admin
r.post("/admin/users/:userId/promote", requireAdminPermission('canChangeUserRoles'), async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    const { adminRole } = req.body;
    
    if (!['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'].includes(adminRole)) {
      return res.status(400).json({ ok: false, error: 'Invalid admin role' });
    }
    
    // Only super admin can create other admins
    if (req.adminRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ ok: false, error: 'Only super admins can promote users' });
    }
    
    // Auto-verify email for SUPER_ADMIN
    const updateData: any = { adminRole };
    if (adminRole === 'SUPER_ADMIN') {
      updateData.emailVerified = true;
      updateData.emailVerifiedAt = new Date();
    }
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });
    
    await logAdminAction(
      req.userId!,
      'user.promoted',
      {
        resourceType: 'User',
        resourceId: userId,
        data: { adminRole, emailAutoVerified: adminRole === 'SUPER_ADMIN' }
      },
      req
    );
    
    return res.json({ ok: true, user });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Admin audit log
r.get("/admin/audit-log", requireAdminPermission('canAccessAdminDashboard'), async (req: AdminRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = (page - 1) * limit;
    
    const [actions, total] = await Promise.all([
      prisma.adminAction.findMany({
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: {
              id: true,
              email: true,
              name: true,
              adminRole: true,
            }
          }
        }
      }),
      prisma.adminAction.count()
    ]);
    
    return res.json({
      ok: true,
      actions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================
// Access Permissions Management
// ============================================

// Get all access permissions
r.get("/admin/access-permissions", requireAdminPermission('canManageUsers'), async (req: AdminRequest, res) => {
  try {
    const permissions = await prisma.accessPermission.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            coachLevel: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return res.json({ ok: true, permissions });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Create or update access permission
r.post("/admin/access-permissions", requireAdminPermission('canManageUsers'), async (req: AdminRequest, res) => {
  try {
    const schema = z.object({
      id: z.string().uuid().optional(), // If provided, update existing
      userId: z.string().uuid().nullable().optional(), // Specific user ID (if set, overrides coachLevel)
      resourceType: z.enum(["SESSION", "VAULT", "BOTH", "VIDEO_REVIEW"]),
      coachLevel: z.enum(["GRASSROOTS", "USSF_C", "USSF_B_PLUS"]).nullable().optional(),
      ageGroups: z.array(z.string()).default([]), // Empty = all age groups
      formats: z.array(z.enum(["7v7", "9v9", "11v11"])).default([]), // Empty = all formats
      canGenerateSessions: z.boolean().default(false),
      canAccessVault: z.boolean().default(false),
      canAccessVideoReview: z.boolean().default(false),
      notes: z.string().optional(),
      updateUserCoachLevel: z.boolean().optional(), // If true, update the user's coachLevel property
    });
    
    const body = schema.parse(req.body);
    
    // If userId is provided, verify user exists and optionally update their coach level
    if (body.userId) {
      const user = await prisma.user.findUnique({
        where: { id: body.userId },
        select: { id: true, role: true }
      });
      if (!user) {
        return res.status(404).json({ ok: false, error: 'User not found' });
      }
      
      // If coachLevel is provided and updateUserCoachLevel flag is set (or not explicitly false), update the user's coachLevel property
      if (body.coachLevel && body.updateUserCoachLevel !== false) {
        if (user.role !== 'COACH') {
          return res.status(400).json({ 
            ok: false, 
            error: 'Cannot set coach level for a user who is not a COACH' 
          });
        }
        
        await prisma.user.update({
          where: { id: body.userId },
          data: { coachLevel: body.coachLevel }
        });
        
        await logAdminAction(
          req.userId!,
          'user.coach_level.updated',
          {
            resourceType: 'User',
            resourceId: body.userId,
            data: { coachLevel: body.coachLevel, updatedVia: 'access_permission' }
          },
          req
        );
      }
    }
    
    const data: any = {
      resourceType: body.resourceType,
      userId: body.userId || null,
      coachLevel: body.userId ? null : (body.coachLevel || null), // Only set coachLevel if userId is not set
      ageGroups: body.ageGroups,
      formats: body.formats,
      canGenerateSessions: body.canGenerateSessions,
      canAccessVault: body.canAccessVault,
      canAccessVideoReview: body.canAccessVideoReview,
      notes: body.notes || null,
      createdBy: req.userId || null,
    };
    
    let permission;
    if (body.id) {
      // Update existing
      permission = await prisma.accessPermission.update({
        where: { id: body.id },
        data,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            }
          }
        }
      });
    } else {
      // Create new
      permission = await prisma.accessPermission.create({ 
        data,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            }
          }
        }
      });
    }
    
    await logAdminAction(
      req.userId!,
      body.id ? 'access_permission.updated' : 'access_permission.created',
      {
        resourceType: 'AccessPermission',
        resourceId: permission.id,
        data: { 
          resourceType: body.resourceType, 
          userId: body.userId,
          coachLevel: body.coachLevel, 
          ageGroups: body.ageGroups, 
          formats: body.formats 
        }
      },
      req
    );
    
    return res.json({ ok: true, permission });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ ok: false, error: 'Invalid input', details: error.errors });
    }
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Delete access permission
r.delete("/admin/access-permissions/:permissionId", requireAdminPermission('canManageUsers'), async (req: AdminRequest, res) => {
  try {
    const { permissionId } = req.params;
    
    await prisma.accessPermission.delete({
      where: { id: permissionId }
    });
    
    await logAdminAction(
      req.userId!,
      'access_permission.deleted',
      {
        resourceType: 'AccessPermission',
        resourceId: permissionId,
      },
      req
    );
    
    return res.json({ ok: true, message: 'Permission deleted' });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Check user permissions (for testing/debugging)
r.get("/admin/access-permissions/check/:userId", requireAdminPermission('canManageUsers'), async (req: AdminRequest, res) => {
  try {
    const { userId } = req.params;
    const { ageGroup, coachLevel } = req.query;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coachLevel: true, adminRole: true }
    });
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    const { canGenerateSessions, canAccessVault, canAccessVideoReview } = await import('./services/access-permissions');
    
    const checks: any = {
      userId,
      coachLevel: user.coachLevel,
      adminRole: user.adminRole,
    };
    
    if (ageGroup) {
      checks.canGenerateSessions = await canGenerateSessions(userId, ageGroup as string, coachLevel as any || user.coachLevel);
      checks.canAccessVault = await canAccessVault(userId, ageGroup as string, coachLevel as any || user.coachLevel);
    } else {
      checks.canAccessVault = await canAccessVault(userId);
    }
    checks.canAccessVideoReview = await canAccessVideoReview(userId, coachLevel as any || user.coachLevel);
    
    return res.json({ ok: true, ...checks });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================
// Club Management (Layer 5)
// ============================================

r.get("/admin/clubs", requireAdminPermission("canManageUsers"), async (_req: AdminRequest, res) => {
  try {
    const clubs = await listClubs();
    const withCounts = await Promise.all(
      clubs.map(async (club) => {
        const memberCount = await prisma.user.count({
          where: { organizationName: club.name },
        });
        return { ...club, _count: { users: memberCount } };
      })
    );

    withCounts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ ok: true, clubs: withCounts });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message || "Failed to load clubs" });
  }
});

r.get("/admin/clubs/:clubId", requireAdminPermission("canManageUsers"), async (req: AdminRequest, res) => {
  try {
    const { clubId } = req.params;
    const club = await getClubById(clubId);
    if (!club) {
      return res.status(404).json({ ok: false, error: "Club not found" });
    }

    const users = await prisma.user.findMany({
      where: { organizationName: club.name },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionPlan: true,
        coachLevel: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      ok: true,
      club: {
        ...club,
        users,
        _count: { users: users.length },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message || "Failed to load club" });
  }
});

r.post("/admin/clubs", requireAdminPermission("canManageUsers"), async (req: AdminRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(120),
      code: z.string().min(1).max(64),
      gameModelId: z.string().min(1).max(64),
      description: z.string().max(500).optional(),
      active: z.boolean().optional(),
    });

    const body = schema.parse(req.body ?? {});
    const normalizedCode = body.code.trim().toLowerCase();
    const normalizedName = body.name.trim();

    if (!CLUB_GAME_MODELS.has(body.gameModelId)) {
      return res.status(400).json({ ok: false, error: "Invalid game model for club" });
    }
    if (await getClubByCode(normalizedCode)) {
      return res.status(400).json({ ok: false, error: "Club code already exists" });
    }
    if (await getClubByName(normalizedName)) {
      return res.status(400).json({ ok: false, error: "Club name already exists" });
    }

    const club = await createClub({
      id: randomUUID(),
      name: normalizedName,
      code: normalizedCode,
      gameModelId: body.gameModelId,
      description: body.description?.trim() || null,
      active: body.active ?? true,
      createdBy: req.userId || null,
    });

    await logAdminAction(
      req.userId!,
      "club.created",
      {
        resourceType: "Club",
        resourceId: club.id,
        data: {
          name: club.name,
          code: club.code,
          gameModelId: club.gameModelId,
        },
      },
      req
    );

    return res.json({ ok: true, club });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ ok: false, error: "Invalid input", details: error.errors });
    }
    return res.status(500).json({ ok: false, error: error.message || "Failed to create club" });
  }
});

r.patch("/admin/clubs/:clubId", requireAdminPermission("canManageUsers"), async (req: AdminRequest, res) => {
  try {
    const { clubId } = req.params;
    const schema = z.object({
      name: z.string().min(1).max(120).optional(),
      code: z.string().min(1).max(64).optional(),
      gameModelId: z.string().min(1).max(64).optional(),
      description: z.string().max(500).nullable().optional(),
      active: z.boolean().optional(),
    });
    const body = schema.parse(req.body ?? {});

    const current = await getClubById(clubId);
    if (!current) {
      return res.status(404).json({ ok: false, error: "Club not found" });
    }

    const nextCode = body.code ? body.code.trim().toLowerCase() : current.code;
    const nextName = body.name ? body.name.trim() : current.name;
    const nextGameModelId = body.gameModelId ?? current.gameModelId;

    if (!CLUB_GAME_MODELS.has(nextGameModelId)) {
      return res.status(400).json({ ok: false, error: "Invalid game model for club" });
    }

    const existingByCode = await getClubByCode(nextCode);
    if (existingByCode && existingByCode.id !== clubId) {
      return res.status(400).json({ ok: false, error: "Club code already exists" });
    }
    const existingByName = await getClubByName(nextName);
    if (existingByName && existingByName.id !== clubId) {
      return res.status(400).json({ ok: false, error: "Club name already exists" });
    }

    const updatedClub = await updateClub(clubId, {
      name: nextName,
      code: nextCode,
      gameModelId: nextGameModelId,
      description:
        body.description !== undefined
          ? (body.description?.trim() || null)
          : current.description,
      active: body.active ?? current.active,
    });
    if (!updatedClub) {
      return res.status(404).json({ ok: false, error: "Club not found" });
    }

    if (current.name !== updatedClub.name) {
      await prisma.user.updateMany({
        where: { organizationName: current.name },
        data: { organizationName: updatedClub.name },
      });
    }

    await logAdminAction(
      req.userId!,
      "club.updated",
      {
        resourceType: "Club",
        resourceId: updatedClub.id,
        data: updatedClub,
      },
      req
    );

    return res.json({ ok: true, club: updatedClub });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ ok: false, error: "Invalid input", details: error.errors });
    }
    return res.status(500).json({ ok: false, error: error.message || "Failed to update club" });
  }
});

r.delete("/admin/clubs/:clubId", requireAdminPermission("canManageUsers"), async (req: AdminRequest, res) => {
  try {
    const { clubId } = req.params;
    const club = await getClubById(clubId);
    if (!club) {
      return res.status(404).json({ ok: false, error: "Club not found" });
    }

    await prisma.user.updateMany({
      where: { organizationName: club.name },
      data: { organizationName: null },
    });

    await deleteClub(clubId);

    await logAdminAction(
      req.userId!,
      "club.deleted",
      {
        resourceType: "Club",
        resourceId: clubId,
        data: { name: club.name, code: club.code },
      },
      req
    );

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message || "Failed to delete club" });
  }
});

r.post("/admin/clubs/:clubId/users/:userId", requireAdminPermission("canManageUsers"), async (req: AdminRequest, res) => {
  try {
    const { clubId, userId } = req.params;
    const club = await getClubById(clubId);
    if (!club) {
      return res.status(404).json({ ok: false, error: "Club not found" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, organizationName: true },
    });
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { organizationName: club.name },
    });

    await logAdminAction(
      req.userId!,
      "club.user_assigned",
      {
        resourceType: "Club",
        resourceId: clubId,
        data: { userId, userEmail: user.email, clubName: club.name },
      },
      req
    );

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message || "Failed to assign user" });
  }
});

r.delete("/admin/clubs/:clubId/users/:userId", requireAdminPermission("canManageUsers"), async (req: AdminRequest, res) => {
  try {
    const { clubId, userId } = req.params;
    const club = await getClubById(clubId);
    if (!club) {
      return res.status(404).json({ ok: false, error: "Club not found" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, organizationName: true },
    });
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { organizationName: null },
    });

    await logAdminAction(
      req.userId!,
      "club.user_removed",
      {
        resourceType: "Club",
        resourceId: clubId,
        data: { userId, userEmail: user.email, previousOrganizationName: user.organizationName },
      },
      req
    );

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message || "Failed to remove user from club" });
  }
});

// ------------------------------------
// Admin: Analytics Endpoints
// ------------------------------------

/**
 * GET /admin/analytics/usage-by-plan
 * Track usage patterns across subscription plans
 */
r.get("/admin/analytics/usage-by-plan", requireAdminPermission('canViewAnalytics'), async (req: AdminRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        subscriptionPlan: true,
        sessionsGeneratedThisMonth: true,
        drillsGeneratedThisMonth: true,
      },
    });

    const usageByPlan: Record<string, {
      totalUsers: number;
      totalSessionsUsed: number;
      totalDrillsUsed: number;
      avgSessionsPerUser: number;
      avgDrillsPerUser: number;
      usersAtLimit: number;
      usersApproachingLimit: number; // 80%+
    }> = {};

    for (const plan of Object.keys(SUBSCRIPTION_LIMITS)) {
      const planUsers = users.filter(u => u.subscriptionPlan === plan);
      const limits = SUBSCRIPTION_LIMITS[plan as keyof typeof SUBSCRIPTION_LIMITS];
      
      let totalSessions = 0;
      let totalDrills = 0;
      let usersAtLimit = 0;
      let usersApproachingLimit = 0;

      for (const user of planUsers) {
        totalSessions += user.sessionsGeneratedThisMonth;
        totalDrills += user.drillsGeneratedThisMonth;

        if (limits.sessionsPerMonth !== -1) {
          const sessionPct = (user.sessionsGeneratedThisMonth / limits.sessionsPerMonth) * 100;
          if (sessionPct >= 100) usersAtLimit++;
          else if (sessionPct >= 80) usersApproachingLimit++;
        }
        if (limits.drillsPerMonth !== -1) {
          const drillPct = (user.drillsGeneratedThisMonth / limits.drillsPerMonth) * 100;
          if (drillPct >= 100) usersAtLimit++;
          else if (drillPct >= 80) usersApproachingLimit++;
        }
      }

      usageByPlan[plan] = {
        totalUsers: planUsers.length,
        totalSessionsUsed: totalSessions,
        totalDrillsUsed: totalDrills,
        avgSessionsPerUser: planUsers.length > 0 ? totalSessions / planUsers.length : 0,
        avgDrillsPerUser: planUsers.length > 0 ? totalDrills / planUsers.length : 0,
        usersAtLimit,
        usersApproachingLimit,
      };
    }

    return res.json({ ok: true, usageByPlan });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /admin/analytics/vault-usage
 * Track vault usage across all users
 */
r.get("/admin/analytics/vault-usage", requireAdminPermission('canViewAnalytics'), async (req: AdminRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        subscriptionPlan: true,
      },
    });

    const vaultUsageByPlan: Record<string, {
      totalUsers: number;
      totalVaultSessions: number;
      totalVaultDrills: number;
      avgSessionsPerUser: number;
      avgDrillsPerUser: number;
      usersExceedingLimit: number;
    }> = {};

    // Get total vault drills (global, shared across all users)
    const totalVaultDrills = await prisma.drill.count({
      where: { savedToVault: true },
    });

    for (const plan of Object.keys(SUBSCRIPTION_LIMITS)) {
      const planUsers = users.filter(u => u.subscriptionPlan === plan);
      const limits = SUBSCRIPTION_LIMITS[plan as keyof typeof SUBSCRIPTION_LIMITS];
      
      let totalSessions = 0;
      let usersExceedingLimit = 0;

      for (const user of planUsers) {
        const userSessions = await prisma.session.count({
          where: { savedToVault: true, generatedBy: user.id },
        });
        
        totalSessions += userSessions;

        // Check if user exceeds vault session limit
        if (limits.vaultSessions !== -1 && userSessions > limits.vaultSessions) {
          usersExceedingLimit++;
        }
        // Note: Vault drills are global, so we don't check per-user drill limits here
        // All users see the same global vault drills
      }

      // For drills, we use the global count (drills are shared in vault)
      // Calculate average as if drills were distributed across all users
      const avgDrillsPerUser = planUsers.length > 0 ? totalVaultDrills / planUsers.length : 0;

      vaultUsageByPlan[plan] = {
        totalUsers: planUsers.length,
        totalVaultSessions: totalSessions,
        totalVaultDrills: totalVaultDrills, // Global count (same for all plans)
        avgSessionsPerUser: planUsers.length > 0 ? totalSessions / planUsers.length : 0,
        avgDrillsPerUser,
        usersExceedingLimit,
      };
    }

    return res.json({ ok: true, vaultUsageByPlan });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /admin/analytics/favorites-usage
 * Track favorites usage across users
 */
r.get("/admin/analytics/favorites-usage", requireAdminPermission('canViewAnalytics'), async (req: AdminRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        subscriptionPlan: true,
      },
    });

    const favoritesByPlan: Record<string, {
      totalUsers: number;
      totalFavorites: number;
      avgFavoritesPerUser: number;
      usersAtLimit: number;
      distribution: {
        sessions: number;
        drills: number;
        series: number;
      };
    }> = {};

    for (const plan of Object.keys(SUBSCRIPTION_LIMITS)) {
      const planUsers = users.filter(u => u.subscriptionPlan === plan);
      const limits = SUBSCRIPTION_LIMITS[plan as keyof typeof SUBSCRIPTION_LIMITS];
      
      let totalFavorites = 0;
      let usersAtLimit = 0;
      const distribution = { sessions: 0, drills: 0, series: 0 };

      for (const user of planUsers) {
        const [sessionFavs, drillFavs, seriesFavs] = await Promise.all([
          prisma.favorite.count({
            where: { userId: user.id, sessionId: { not: null }, seriesId: null },
          }),
          prisma.favorite.count({
            where: { userId: user.id, drillId: { not: null } },
          }),
          prisma.favorite.count({
            where: { userId: user.id, seriesId: { not: null } },
          }),
        ]);

        const userTotal = sessionFavs + drillFavs + seriesFavs;
        totalFavorites += userTotal;
        distribution.sessions += sessionFavs;
        distribution.drills += drillFavs;
        distribution.series += seriesFavs;

        if (limits.maxFavorites !== -1 && userTotal >= limits.maxFavorites) {
          usersAtLimit++;
        }
      }

      favoritesByPlan[plan] = {
        totalUsers: planUsers.length,
        totalFavorites,
        avgFavoritesPerUser: planUsers.length > 0 ? totalFavorites / planUsers.length : 0,
        usersAtLimit,
        distribution,
      };
    }

    return res.json({ ok: true, favoritesByPlan });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /admin/analytics/feature-access
 * Summary of which FEATURES are enabled per subscription plan.
 *
 * This returns a simple 1/0 matrix derived directly from SUBSCRIPTION_LIMITS,
 * not from how many users happen to be on each plan.
 */
r.get(
  "/admin/analytics/feature-access",
  requireAdminPermission("canViewAnalytics"),
  async (_req: AdminRequest, res) => {
    try {
      const featureAccess: Record<
        string,
        {
          canExportPDF: number;
          canGenerateSeries: number;
          canUseAdvancedFilters: number;
          canAccessCalendar: number;
          canCreatePlayerPlans: number;
          canGenerateWeeklySummaries: number;
          canInviteCoaches: number;
          canManageOrganization: number;
        }
      > = {};

      for (const plan of Object.keys(SUBSCRIPTION_LIMITS)) {
        const limits = SUBSCRIPTION_LIMITS[plan as keyof typeof SUBSCRIPTION_LIMITS];
        featureAccess[plan] = {
          canExportPDF: limits.canExportPDF ? 1 : 0,
          canGenerateSeries: limits.canGenerateSeries ? 1 : 0,
          canUseAdvancedFilters: limits.canUseAdvancedFilters ? 1 : 0,
          canAccessCalendar: limits.canAccessCalendar ? 1 : 0,
          canCreatePlayerPlans: limits.canCreatePlayerPlans ? 1 : 0,
          canGenerateWeeklySummaries: limits.canGenerateWeeklySummaries ? 1 : 0,
          canInviteCoaches: limits.canInviteCoaches ? 1 : 0,
          canManageOrganization: limits.canManageOrganization ? 1 : 0,
        };
      }

      return res.json({ ok: true, featureAccess });
    } catch (error: any) {
      return res
        .status(500)
        .json({ ok: false, error: error.message });
    }
  }
);

/**
 * GET /admin/analytics/trial-accounts
 * Track trial accounts and conversions
 */
r.get("/admin/analytics/trial-accounts", requireAdminPermission('canViewAnalytics'), async (req: AdminRequest, res) => {
  try {
    const trialUsers = await prisma.user.findMany({
      where: {
        OR: [
          { subscriptionPlan: 'TRIAL' },
          { role: 'TRIAL' },
        ],
      },
      select: {
        id: true,
        email: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndDate: true,
        createdAt: true,
      },
    });

    const now = new Date();
    const activeTrials = trialUsers.filter(u => {
      if (!u.trialEndDate) return false;
      return new Date(u.trialEndDate) >= now;
    });

    const expiredTrials = trialUsers.filter(u => {
      if (!u.trialEndDate) return false;
      return new Date(u.trialEndDate) < now;
    });

    // Calculate days remaining distribution
    const daysRemainingDist: Record<string, number> = {};
    for (const user of activeTrials) {
      if (user.trialEndDate) {
        const days = Math.ceil((new Date(user.trialEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const bucket = days <= 1 ? '0-1' : days <= 3 ? '2-3' : days <= 5 ? '4-5' : '6-7';
        daysRemainingDist[bucket] = (daysRemainingDist[bucket] || 0) + 1;
      }
    }

    // Track conversions (users who were TRIAL and now have a paid plan)
    const convertedUsers = await prisma.user.findMany({
      where: {
        subscriptionPlan: { in: ['COACH_BASIC', 'COACH_PRO', 'CLUB_STANDARD', 'CLUB_PREMIUM'] },
      },
      select: {
        id: true,
        subscriptionPlan: true,
        createdAt: true,
      },
    });

    // Estimate conversion rate (this is approximate - would need historical data for accurate tracking)
    const conversionRate = trialUsers.length > 0 
      ? (convertedUsers.length / (trialUsers.length + convertedUsers.length)) * 100 
      : 0;

    return res.json({
      ok: true,
      trialAccounts: {
        total: trialUsers.length,
        active: activeTrials.length,
        expired: expiredTrials.length,
        daysRemainingDistribution: daysRemainingDist,
        conversionRate: Math.round(conversionRate * 100) / 100,
        upcomingExpirations: activeTrials
          .filter(u => u.trialEndDate)
          .map(u => ({
            userId: u.id,
            email: u.email,
            trialEndDate: u.trialEndDate,
            daysRemaining: Math.ceil((new Date(u.trialEndDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          }))
          .sort((a, b) => a.daysRemaining - b.daysRemaining)
          .slice(0, 20), // Top 20 upcoming expirations
      },
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /admin/analytics/limit-enforcement
 * Track when limits are hit (429 errors from ApiMetrics)
 */
r.get("/admin/analytics/limit-enforcement", requireAdminPermission('canViewAnalytics'), async (req: AdminRequest, res) => {
  try {
    // Query ApiMetrics for 429 status codes (limit exceeded)
    // Note: We'd need to track HTTP status codes in ApiMetrics, but for now we'll use a different approach
    // Check users who are at or over their limits
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        subscriptionPlan: true,
        sessionsGeneratedThisMonth: true,
        drillsGeneratedThisMonth: true,
      },
    });

    const limitHits: Array<{
      userId: string;
      email: string | null;
      plan: string;
      limitType: 'sessions' | 'drills';
      used: number;
      limit: number;
    }> = [];

    for (const user of users) {
      const plan = user.subscriptionPlan as keyof typeof SUBSCRIPTION_LIMITS;
      const limits = SUBSCRIPTION_LIMITS[plan] || SUBSCRIPTION_LIMITS.FREE;

      if (limits.sessionsPerMonth !== -1 && user.sessionsGeneratedThisMonth >= limits.sessionsPerMonth) {
        limitHits.push({
          userId: user.id,
          email: user.email,
          plan: user.subscriptionPlan,
          limitType: 'sessions',
          used: user.sessionsGeneratedThisMonth,
          limit: limits.sessionsPerMonth,
        });
      }

      if (limits.drillsPerMonth !== -1 && user.drillsGeneratedThisMonth >= limits.drillsPerMonth) {
        limitHits.push({
          userId: user.id,
          email: user.email,
          plan: user.subscriptionPlan,
          limitType: 'drills',
          used: user.drillsGeneratedThisMonth,
          limit: limits.drillsPerMonth,
        });
      }
    }

    // Group by plan
    const hitsByPlan: Record<string, number> = {};
    const hitsByType: Record<string, number> = { sessions: 0, drills: 0 };

    for (const hit of limitHits) {
      hitsByPlan[hit.plan] = (hitsByPlan[hit.plan] || 0) + 1;
      hitsByType[hit.limitType]++;
    }

    return res.json({
      ok: true,
      limitEnforcement: {
        totalHits: limitHits.length,
        hitsByPlan,
        hitsByType,
        recentHits: limitHits.slice(0, 50), // Most recent 50
      },
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /admin/analytics/club-accounts
 * Track CLUB account usage and organization features
 */
r.get("/admin/analytics/club-accounts", requireAdminPermission('canViewAnalytics'), async (req: AdminRequest, res) => {
  try {
    const clubUsers = await prisma.user.findMany({
      where: {
        role: 'CLUB',
      },
      select: {
        id: true,
        email: true,
        subscriptionPlan: true,
        organizationName: true,
        createdAt: true,
      },
    });

    const standardCount = clubUsers.filter(u => u.subscriptionPlan === 'CLUB_STANDARD').length;
    const premiumCount = clubUsers.filter(u => u.subscriptionPlan === 'CLUB_PREMIUM').length;

    // Count organizations
    const orgNames = new Set(clubUsers.map(u => u.organizationName).filter(Boolean));
    const organizations = Array.from(orgNames);

    // Count coaches per organization
    const orgCoachCounts: Record<string, number> = {};
    for (const orgName of organizations) {
      const coachCount = await prisma.user.count({
        where: {
          organizationName: orgName,
          role: 'COACH',
        },
      });
      orgCoachCounts[orgName!] = coachCount;
    }

    const avgCoachesPerOrg = organizations.length > 0
      ? Object.values(orgCoachCounts).reduce((a, b) => a + b, 0) / organizations.length
      : 0;

    return res.json({
      ok: true,
      clubAccounts: {
        total: clubUsers.length,
        standard: standardCount,
        premium: premiumCount,
        organizations: {
          total: organizations.length,
          avgCoachesPerOrg: Math.round(avgCoachesPerOrg * 100) / 100,
          coachCounts: orgCoachCounts,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

export default r;
