import express from "express";
import { prisma } from "./prisma";
import { authenticate, AuthRequest, requireFeature } from "./middleware/auth";
import { generatePlayerPlanFromSession, generatePlayerPlanFromSeries } from "./services/player-plan";
import { generatePlayerPlanPdf } from "./services/pdf-export";

const r = express.Router();

// All routes require authentication
r.use(authenticate);

/**
 * POST /player-plans/from-session/:sessionId
 * Create a player-only training plan from a session
 */
r.post("/player-plans/from-session/:sessionId", requireFeature('canCreatePlayerPlans'), async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const { durationMin, focus, sourceRefCode } = req.body || {};

    // Normalise the session identifier. Some frontends have been sending the
    // literal string "undefined" in the path segment; treat that as missing.
    const pathId = sessionId && sessionId !== "undefined" && sessionId !== "null" ? sessionId : undefined;
    const sessionIdentifier = pathId || sourceRefCode; // Prefer valid path param, fall back to refCode from body

    console.log(`[PLAYER_PLAN] Creating plan from session: ${sessionIdentifier}, userId: ${req.userId}`);

    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    if (!sessionIdentifier) {
      return res.status(400).json({ ok: false, error: "Missing session identifier (id or refCode)" });
    }

    const result = await generatePlayerPlanFromSession(sessionIdentifier, req.userId, {
      durationMin: durationMin ? Number(durationMin) : undefined,
      focus: focus ? String(focus) : undefined,
    });

    return res.json({
      ok: true,
      plan: result.plan,
      id: result.id,
      refCode: result.refCode,
    });
  } catch (error: any) {
    console.error("[PLAYER_PLAN] Error creating plan from session:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to create player plan",
    });
  }
});

/**
 * POST /player-plans/from-series/:seriesId
 * Create a player-only training plan from a series
 */
r.post("/player-plans/from-series/:seriesId", requireFeature('canCreatePlayerPlans'), async (req: AuthRequest, res) => {
  try {
    const { seriesId } = req.params;
    const { sessionNumbers, durationMin, focus } = req.body || {};

    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const result = await generatePlayerPlanFromSeries(seriesId, req.userId, {
      sessionNumbers: Array.isArray(sessionNumbers)
        ? sessionNumbers.map((n) => Number(n)).filter((n) => Number.isFinite(n))
        : undefined,
      durationMin: durationMin ? Number(durationMin) : undefined,
      focus: focus ? String(focus) : undefined,
    });

    return res.json({
      ok: true,
      plan: result.plan,
      id: result.id,
      refCode: result.refCode,
    });
  } catch (error: any) {
    console.error("[PLAYER_PLAN] Error creating plan from series:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to create player plan",
    });
  }
});

/**
 * GET /player-plans
 * List user's player plans
 */
r.get("/player-plans", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const sourceType = req.query.sourceType as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: any = { userId: req.userId };
    if (sourceType && (sourceType === "SESSION" || sourceType === "SERIES")) {
      where.sourceType = sourceType;
    }

    const [plans, total] = await Promise.all([
      prisma.playerPlan.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          refCode: true,
          title: true,
          ageGroup: true,
          playerLevel: true,
          durationMin: true,
          sourceType: true,
          sourceRefCode: true,
          createdAt: true,
        },
      }),
      prisma.playerPlan.count({ where }),
    ]);

    return res.json({
      ok: true,
      plans,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("[PLAYER_PLAN] Error listing plans:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to list player plans",
    });
  }
});

/**
 * GET /player-plans/:planId
 * Get plan details
 */
r.get("/player-plans/:planId", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const { planId } = req.params;

    const plan = await prisma.playerPlan.findFirst({
      where: {
        id: planId,
        userId: req.userId, // Ensure user can only access their own plans
      },
    });

    if (!plan) {
      return res.status(404).json({ ok: false, error: "Player plan not found" });
    }

    return res.json({
      ok: true,
      plan,
    });
  } catch (error: any) {
    console.error("[PLAYER_PLAN] Error fetching plan:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to fetch player plan",
    });
  }
});

/**
 * GET /player-plans/by-source/:sourceType/:sourceId
 * Check if a player plan exists for a given source (session or series)
 */
r.get("/player-plans/by-source/:sourceType/:sourceId", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const { sourceType, sourceId } = req.params;

    if (sourceType !== "SESSION" && sourceType !== "SERIES") {
      return res.status(400).json({ ok: false, error: "Invalid sourceType. Must be SESSION or SERIES" });
    }

    const plan = await prisma.playerPlan.findFirst({
      where: {
        userId: req.userId,
        sourceType: sourceType as "SESSION" | "SERIES",
        sourceId: sourceId,
      },
      select: {
        id: true,
        refCode: true,
        title: true,
        createdAt: true,
      },
    });

    return res.json({
      ok: true,
      exists: !!plan,
      plan: plan || null,
    });
  } catch (error: any) {
    console.error("[PLAYER_PLAN] Error checking plan by source:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to check player plan",
    });
  }
});

/**
 * POST /player-plans/bulk-lookup
 * Bulk lookup player plans for multiple sources
 * Body: { sessions?: string[], series?: string[] }
 */
r.post("/player-plans/bulk-lookup", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const { sessions = [], series = [] } = req.body || {};

    if (!Array.isArray(sessions) || !Array.isArray(series)) {
      return res.status(400).json({ ok: false, error: "sessions and series must be arrays" });
    }

    // Build OR conditions for bulk lookup
    const orConditions: any[] = [];
    if (sessions.length > 0) {
      orConditions.push({
        sourceType: "SESSION",
        sourceId: { in: sessions },
      });
    }
    if (series.length > 0) {
      orConditions.push({
        sourceType: "SERIES",
        sourceId: { in: series },
      });
    }

    if (orConditions.length === 0) {
      return res.json({
        ok: true,
        sessions: {},
        series: {},
      });
    }

    const plans = await prisma.playerPlan.findMany({
      where: {
        userId: req.userId,
        OR: orConditions,
      },
      select: {
        id: true,
        refCode: true,
        sourceType: true,
        sourceId: true,
        title: true,
        createdAt: true,
      },
    });

    // Build response maps: sourceId -> plan info
    const sessionsMap: Record<string, { id: string; refCode: string | null }> = {};
    const seriesMap: Record<string, { id: string; refCode: string | null }> = {};

    plans.forEach((plan) => {
      const planInfo = {
        id: plan.id,
        refCode: plan.refCode,
      };
      if (plan.sourceType === "SESSION") {
        sessionsMap[plan.sourceId] = planInfo;
      } else if (plan.sourceType === "SERIES") {
        seriesMap[plan.sourceId] = planInfo;
      }
    });

    return res.json({
      ok: true,
      sessions: sessionsMap,
      series: seriesMap,
    });
  } catch (error: any) {
    console.error("[PLAYER_PLAN] Error bulk looking up plans:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to bulk lookup player plans",
    });
  }
});

/**
 * POST /player-plans/:planId/export-pdf
 * Export player plan as PDF
 */
r.post("/player-plans/:planId/export-pdf", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const { planId } = req.params;
    const planData = req.body?.plan;

    // If plan data is provided in body, use it; otherwise fetch from DB
    let plan = planData;
    if (!plan) {
      plan = await prisma.playerPlan.findFirst({
        where: {
          id: planId,
          userId: req.userId, // Ensure user can only export their own plans
        },
      });

      if (!plan) {
        return res.status(404).json({ ok: false, error: "Player plan not found" });
      }
    }

    const pdfBuffer = await generatePlayerPlanPdf(plan);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${(plan.title || "player_plan").replace(/[^a-z0-9]/gi, "_")}_player_plan.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[PLAYER_PLAN] Error exporting PDF:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to export player plan PDF",
    });
  }
});

/**
 * DELETE /player-plans/:planId
 * Delete a player plan
 */
r.delete("/player-plans/:planId", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const { planId } = req.params;

    // Check ownership
    const plan = await prisma.playerPlan.findFirst({
      where: {
        id: planId,
        userId: req.userId,
      },
    });

    if (!plan) {
      return res.status(404).json({ ok: false, error: "Player plan not found" });
    }

    await prisma.playerPlan.delete({
      where: { id: planId },
    });

    return res.json({ ok: true });
  } catch (error: any) {
    console.error("[PLAYER_PLAN] Error deleting plan:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to delete player plan",
    });
  }
});

export default r;
