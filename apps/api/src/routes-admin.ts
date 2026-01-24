import express from "express";
import { prisma } from "./prisma";
import { generateAndReviewSession } from "./services/session";
import { generateProgressiveSessionSeries } from "./services/session-progressive";
import { generateText, setMetricsContext, clearMetricsContext } from "./gemini";
import { buildSessionQAReviewerPrompt } from "./prompts/session";
import { fixSessionDecision, fixDrillDecision } from "./services/fixer";
import { buildQAReviewerPrompt } from "./prompts/drill-optimized-v2";
import { generateAndReviewDrill } from "./services/drill";
import type { FixDecisionCode } from "./services/fixer";
import { requireAdmin, requireAdminPermission, logAdminAction, AdminRequest } from "./middleware/admin-auth";
import { hashPassword } from "./services/auth";
import { generateVerificationToken, sendVerificationEmail } from "./services/email";
import { z } from "zod";

const r = express.Router();

// Protect ALL admin routes
r.use(requireAdmin);

// Gemini 2.0 Flash pricing (per 1M tokens)
const GEMINI_INPUT_PRICE_PER_1M = 0.10;  // $0.10 per 1M input tokens
const GEMINI_OUTPUT_PRICE_PER_1M = 0.40; // $0.40 per 1M output tokens

function calculateCost(promptTokens: number, completionTokens: number): number {
  const inputCost = (promptTokens / 1_000_000) * GEMINI_INPUT_PRICE_PER_1M;
  const outputCost = (completionTokens / 1_000_000) * GEMINI_OUTPUT_PRICE_PER_1M;
  return inputCost + outputCost;
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
          model: "gemini-2.0-flash",
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

function parseJsonSafe(text: string) {
  try {
    const cleaned = String(text || "")
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return null;
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

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

  const gameModels = ["COACHAI", "POSSESSION", "PRESSING", "TRANSITION"] as const;
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
        const seriesResult = await generateProgressiveSessionSeries(input, seriesLen);
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
        const result = await generateAndReviewSession(input);
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
  const regen = await generateAndReviewDrill(regenInput);
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
  const regen = await generateAndReviewSession(regenInput);
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
    password: z.string().min(8).optional(),
    autoVerifyEmail: z.boolean().optional(),
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

    // Check for existing user
    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });

    if (existing) {
      return res.status(400).json({ ok: false, error: "User with this email already exists" });
    }

    const role = body.role || "FREE";

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

      sendVerificationEmail(user.email, user.name, verificationToken).catch((err) => {
        console.error("[ADMIN] Failed to send verification email for quick-create user:", err);
      });
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
    
    return res.json({ ok: true, user });
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
      select: { adminRole: true }
    });
    
    if (targetUser?.adminRole && req.adminRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        ok: false, 
        error: 'Cannot delete admin users' 
      });
    }
    
    await prisma.user.delete({ where: { id: userId } });
    
    await logAdminAction(
      req.userId!,
      'user.deleted',
      {
        resourceType: 'User',
        resourceId: userId
      },
      req
    );
    
    return res.json({ ok: true });
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

export default r;
