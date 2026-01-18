import express from "express";
import { prisma } from "./prisma";

const r = express.Router();

/**
 * Get or create user by ID (anonymous users use localStorage-generated IDs)
 */
async function getOrCreateUser(userId: string) {
  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    user = await prisma.user.create({
      data: { id: userId },
    });
  }
  return user;
}

/**
 * Extract userId from request header
 */
function getUserId(req: express.Request): string | null {
  const userId = req.headers["x-user-id"];
  if (typeof userId === "string" && userId.length > 0) {
    return userId;
  }
  return null;
}

// Get user's favorites with optional filters
r.get("/favorites", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ ok: false, error: "x-user-id header required" });
    }

    const type = req.query.type as string | undefined; // "session" | "drill" | "series" | undefined
    const gameModelId = req.query.gameModelId as string | undefined;
    const ageGroup = req.query.ageGroup as string | undefined;
    const phase = req.query.phase as string | undefined;

    // Build where clause for favorites
    const where: any = { userId };
    if (type === "session") {
      where.sessionId = { not: null };
      where.seriesId = null; // Exclude series
    } else if (type === "drill") {
      where.drillId = { not: null };
    } else if (type === "series") {
      where.seriesId = { not: null };
    }

    const favorites = await prisma.favorite.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Fetch the actual items
    const sessionIds = favorites.filter(f => f.sessionId && !f.seriesId).map(f => f.sessionId!);
    const drillIds = favorites.filter(f => f.drillId).map(f => f.drillId!);
    const seriesIds = favorites.filter(f => f.seriesId).map(f => f.seriesId!);

    // Build filters for sessions
    const sessionWhere: any = { id: { in: sessionIds } };
    if (gameModelId) sessionWhere.gameModelId = gameModelId;
    if (ageGroup) sessionWhere.ageGroup = ageGroup;
    if (phase) sessionWhere.phase = phase;

    // Build filters for drills
    const drillWhere: any = { id: { in: drillIds } };
    if (gameModelId) drillWhere.gameModelId = gameModelId;
    if (ageGroup) drillWhere.ageGroup = ageGroup;
    if (phase) drillWhere.phase = phase;

    const [sessions, drills, seriesSessions] = await Promise.all([
      sessionIds.length > 0
        ? prisma.session.findMany({
            where: sessionWhere,
            orderBy: { createdAt: "desc" },
          })
        : [],
      drillIds.length > 0
        ? prisma.drill.findMany({
            where: drillWhere,
            orderBy: { createdAt: "desc" },
          })
        : [],
      seriesIds.length > 0
        ? prisma.session.findMany({
            where: {
              seriesId: { in: seriesIds },
              isSeries: true,
              ...(gameModelId ? { gameModelId: gameModelId as any } : {}),
              ...(ageGroup ? { ageGroup } : {}),
              ...(phase ? { phase: phase as any } : {}),
            },
            orderBy: [{ seriesId: "asc" }, { seriesNumber: "asc" }],
          })
        : [],
    ]);

    // Group series sessions by seriesId
    const seriesMap = new Map<string, any[]>();
    for (const session of seriesSessions) {
      if (!session.seriesId) continue;
      if (!seriesMap.has(session.seriesId)) {
        seriesMap.set(session.seriesId, []);
      }
      seriesMap.get(session.seriesId)!.push(session);
    }

    const series = Array.from(seriesMap.entries()).map(([seriesId, sessions]) => ({
      seriesId,
      sessions: sessions.sort((a, b) => (a.seriesNumber || 0) - (b.seriesNumber || 0)),
      totalSessions: sessions.length,
      createdAt: sessions[0]?.createdAt,
      gameModelId: sessions[0]?.gameModelId,
      ageGroup: sessions[0]?.ageGroup,
      favoriteCount: sessions[0]?.favoriteCount || 0,
    }));

    return res.json({
      ok: true,
      sessions,
      drills,
      series,
      counts: {
        sessions: sessions.length,
        drills: drills.length,
        series: series.length,
        total: sessions.length + drills.length + series.length,
      },
    });
  } catch (e: any) {
    console.error("[FAVORITES] Error:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Add session to favorites
r.post("/favorites/session/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ ok: false, error: "x-user-id header required" });
    }

    const { id: sessionId } = req.params;

    // Verify session exists
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }

    // Get or create user
    await getOrCreateUser(userId);

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: { userId_sessionId: { userId, sessionId } },
    });

    if (existing) {
      return res.json({ ok: true, message: "Already favorited", favoriteCount: session.favoriteCount });
    }

    // Create favorite and increment count
    await prisma.$transaction([
      prisma.favorite.create({
        data: { userId, sessionId },
      }),
      prisma.session.update({
        where: { id: sessionId },
        data: { favoriteCount: { increment: 1 } },
      }),
    ]);

    return res.json({ ok: true, favoriteCount: session.favoriteCount + 1 });
  } catch (e: any) {
    console.error("[FAVORITES] Error adding session:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Remove session from favorites
r.delete("/favorites/session/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ ok: false, error: "x-user-id header required" });
    }

    const { id: sessionId } = req.params;

    // Check if favorited
    const existing = await prisma.favorite.findUnique({
      where: { userId_sessionId: { userId, sessionId } },
    });

    if (!existing) {
      return res.json({ ok: true, message: "Not favorited" });
    }

    // Delete favorite and decrement count
    await prisma.$transaction([
      prisma.favorite.delete({
        where: { userId_sessionId: { userId, sessionId } },
      }),
      prisma.session.update({
        where: { id: sessionId },
        data: { favoriteCount: { decrement: 1 } },
      }),
    ]);

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { favoriteCount: true },
    });

    return res.json({ ok: true, favoriteCount: session?.favoriteCount || 0 });
  } catch (e: any) {
    console.error("[FAVORITES] Error removing session:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Add drill to favorites
r.post("/favorites/drill/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ ok: false, error: "x-user-id header required" });
    }

    const { id: drillId } = req.params;

    // Verify drill exists
    const drill = await prisma.drill.findUnique({ where: { id: drillId } });
    if (!drill) {
      return res.status(404).json({ ok: false, error: "Drill not found" });
    }

    // Get or create user
    await getOrCreateUser(userId);

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: { userId_drillId: { userId, drillId } },
    });

    if (existing) {
      return res.json({ ok: true, message: "Already favorited", favoriteCount: drill.favoriteCount });
    }

    // Create favorite and increment count
    await prisma.$transaction([
      prisma.favorite.create({
        data: { userId, drillId },
      }),
      prisma.drill.update({
        where: { id: drillId },
        data: { favoriteCount: { increment: 1 } },
      }),
    ]);

    return res.json({ ok: true, favoriteCount: drill.favoriteCount + 1 });
  } catch (e: any) {
    console.error("[FAVORITES] Error adding drill:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Remove drill from favorites
r.delete("/favorites/drill/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ ok: false, error: "x-user-id header required" });
    }

    const { id: drillId } = req.params;

    // Check if favorited
    const existing = await prisma.favorite.findUnique({
      where: { userId_drillId: { userId, drillId } },
    });

    if (!existing) {
      return res.json({ ok: true, message: "Not favorited" });
    }

    // Delete favorite and decrement count
    await prisma.$transaction([
      prisma.favorite.delete({
        where: { userId_drillId: { userId, drillId } },
      }),
      prisma.drill.update({
        where: { id: drillId },
        data: { favoriteCount: { decrement: 1 } },
      }),
    ]);

    const drill = await prisma.drill.findUnique({
      where: { id: drillId },
      select: { favoriteCount: true },
    });

    return res.json({ ok: true, favoriteCount: drill?.favoriteCount || 0 });
  } catch (e: any) {
    console.error("[FAVORITES] Error removing drill:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Add series to favorites
r.post("/favorites/series/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ ok: false, error: "x-user-id header required" });
    }

    const { id: seriesId } = req.params;

    // Verify series exists
    const sessions = await prisma.session.findMany({
      where: { seriesId, isSeries: true },
      take: 1,
    });

    if (sessions.length === 0) {
      return res.status(404).json({ ok: false, error: "Series not found" });
    }

    // Get or create user
    await getOrCreateUser(userId);

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: { userId_seriesId: { userId, seriesId } },
    });

    if (existing) {
      return res.json({ ok: true, message: "Already favorited" });
    }

    // Create favorite and increment count on all series sessions
    await prisma.$transaction([
      prisma.favorite.create({
        data: { userId, seriesId },
      }),
      prisma.session.updateMany({
        where: { seriesId, isSeries: true },
        data: { favoriteCount: { increment: 1 } },
      }),
    ]);

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[FAVORITES] Error adding series:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Remove series from favorites
r.delete("/favorites/series/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ ok: false, error: "x-user-id header required" });
    }

    const { id: seriesId } = req.params;

    // Check if favorited
    const existing = await prisma.favorite.findUnique({
      where: { userId_seriesId: { userId, seriesId } },
    });

    if (!existing) {
      return res.json({ ok: true, message: "Not favorited" });
    }

    // Delete favorite and decrement count on all series sessions
    await prisma.$transaction([
      prisma.favorite.delete({
        where: { userId_seriesId: { userId, seriesId } },
      }),
      prisma.session.updateMany({
        where: { seriesId, isSeries: true },
        data: { favoriteCount: { decrement: 1 } },
      }),
    ]);

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[FAVORITES] Error removing series:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Check if items are favorited (batch)
r.post("/favorites/check", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      // Return empty results instead of error for anonymous users
      return res.json({
        ok: true,
        sessions: {},
        drills: {},
        series: {},
      });
    }

    const { sessionIds, drillIds, seriesIds } = req.body;

    // Build OR conditions only for non-empty arrays
    const orConditions = [
      ...(sessionIds?.length ? [{ sessionId: { in: sessionIds } }] : []),
      ...(drillIds?.length ? [{ drillId: { in: drillIds } }] : []),
      ...(seriesIds?.length ? [{ seriesId: { in: seriesIds } }] : []),
    ];

    // If no items to check, return empty results
    if (orConditions.length === 0) {
      return res.json({
        ok: true,
        sessions: {},
        drills: {},
        series: {},
      });
    }

    const favorites = await prisma.favorite.findMany({
      where: {
        userId,
        OR: orConditions,
      },
    });

    const favoritedSessionIds = new Set(favorites.filter(f => f.sessionId).map(f => f.sessionId));
    const favoritedDrillIds = new Set(favorites.filter(f => f.drillId).map(f => f.drillId));
    const favoritedSeriesIds = new Set(favorites.filter(f => f.seriesId).map(f => f.seriesId));

    return res.json({
      ok: true,
      sessions: Object.fromEntries((sessionIds || []).map((id: string) => [id, favoritedSessionIds.has(id)])),
      drills: Object.fromEntries((drillIds || []).map((id: string) => [id, favoritedDrillIds.has(id)])),
      series: Object.fromEntries((seriesIds || []).map((id: string) => [id, favoritedSeriesIds.has(id)])),
    });
  } catch (e: any) {
    console.error("[FAVORITES] Error checking:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
