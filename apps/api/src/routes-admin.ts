import express from "express";
import { prisma } from "./prisma";
import { generateAndReviewSession } from "./services/session";
import { generateProgressiveSessionSeries } from "./services/session-progressive";
import { generateText, setMetricsContext, clearMetricsContext } from "./gemini";
import { buildSessionQAReviewerPrompt } from "./prompts/session";
import { fixSessionDecision } from "./services/fixer";

const r = express.Router();

// Gemini 2.0 Flash pricing (per 1M tokens)
const GEMINI_INPUT_PRICE_PER_1M = 0.10;  // $0.10 per 1M input tokens
const GEMINI_OUTPUT_PRICE_PER_1M = 0.40; // $0.40 per 1M output tokens

function calculateCost(promptTokens: number, completionTokens: number): number {
  const inputCost = (promptTokens / 1_000_000) * GEMINI_INPUT_PRICE_PER_1M;
  const outputCost = (completionTokens / 1_000_000) * GEMINI_OUTPUT_PRICE_PER_1M;
  return inputCost + outputCost;
}

// Get overall dashboard stats
r.get("/admin/stats", async (req, res) => {
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
r.get("/admin/metrics/timeline", async (req, res) => {
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
r.get("/admin/metrics/by-operation", async (req, res) => {
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
r.get("/admin/metrics/by-model", async (req, res) => {
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
r.get("/admin/metrics/recent", async (req, res) => {
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
r.get("/admin/stats/by-age-group", async (req, res) => {
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
r.get("/admin/stats/by-game-model", async (req, res) => {
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
r.post("/admin/random-sessions/start", async (req, res) => {
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
r.get("/admin/random-sessions/:jobId", async (req, res) => {
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
r.post("/admin/sessions/review", async (req, res) => {
  const sessionRef = String(req.body?.sessionRef || "").trim();

  if (!sessionRef) {
    return res.status(400).json({ ok: false, error: "sessionRef is required (id or refCode)" });
  }

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

r.post("/admin/sessions/regenerate", async (req, res) => {
  const sessionRef = String(req.body?.sessionRef || "").trim();

  if (!sessionRef) {
    return res.status(400).json({ ok: false, error: "sessionRef is required (id or refCode)" });
  }

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

  // Mark original session JSON as superseded
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

  return res.json({
    ok: true,
    original: {
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

export default r;
