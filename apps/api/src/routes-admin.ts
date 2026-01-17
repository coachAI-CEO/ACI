import express from "express";
import { prisma } from "./prisma";

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
    const sessionsByAge = await prisma.session.groupBy({
      by: ["ageGroup"],
      _count: { id: true },
      where: { savedToVault: true },
    });

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

export default r;
