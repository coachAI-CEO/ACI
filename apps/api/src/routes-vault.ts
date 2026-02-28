import express from "express";
import { z } from "zod";
import { prisma } from "./prisma";
import { parseRefCode, extractRefCodes, lookupByRefCode } from "./utils/ref-code";
import {
  findSimilarSessions,
  saveSessionToVault,
  removeSessionFromVault,
  getVaultSessions,
  getVaultSeries,
  saveSeriesToVault,
  saveDrillToVault,
} from "./services/vault";
import { authenticate, AuthRequest } from "./middleware/auth";
import { canAccessVault, getAllowedFormatsAndAgeGroups, getFormatFromFormation, getFormatFromAgeGroupForSession } from "./services/access-permissions";
import { SUBSCRIPTION_LIMITS } from "./config/subscription-limits";

const r = express.Router();

/**
 * Helper function to check vault limits and apply them to results
 */
async function applyVaultLimits(
  userId: string | undefined,
  sessions: any[],
  drills: any[] = []
): Promise<{ sessions: any[]; drills: any[]; limitExceeded: boolean }> {
  if (!userId) {
    // Anonymous users - no limits
    return { sessions, drills, limitExceeded: false };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      subscriptionPlan: true,
      role: true,
      adminRole: true,
    },
  });

  if (!user) {
    return { sessions, drills, limitExceeded: false };
  }

  // Admins bypass all vault limits
  if (user.role === 'ADMIN' || user.adminRole) {
    return { sessions, drills, limitExceeded: false };
  }

  const plan = user.subscriptionPlan as keyof typeof SUBSCRIPTION_LIMITS;
  const limits = SUBSCRIPTION_LIMITS[plan] || SUBSCRIPTION_LIMITS.FREE;

  const vaultSessionsLimit = limits.vaultSessions;
  const vaultDrillsLimit = limits.vaultDrills;

  let limitedSessions = sessions;
  let limitedDrills = drills;
  let limitExceeded = false;

  // Apply sessions limit (-1 means unlimited)
  if (vaultSessionsLimit !== -1 && sessions.length > vaultSessionsLimit) {
    limitedSessions = sessions.slice(0, vaultSessionsLimit);
    limitExceeded = true;
  }

  // Apply drills limit (-1 means unlimited)
  if (vaultDrillsLimit !== -1 && drills.length > vaultDrillsLimit) {
    limitedDrills = drills.slice(0, vaultDrillsLimit);
    limitExceeded = true;
  }

  return { sessions: limitedSessions, drills: limitedDrills, limitExceeded };
}

// Find sessions not saved to vault (orphaned sessions)
r.get("/vault/orphaned-sessions", async (req, res) => {
  try {
    const orphaned = await prisma.session.findMany({
      where: { savedToVault: false },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    
    return res.json({
      ok: true,
      count: orphaned.length,
      sessions: orphaned.map(s => ({
        id: s.id,
        title: s.title,
        ageGroup: s.ageGroup,
        formationUsed: s.formationUsed,
        gameModelId: s.gameModelId,
        phase: s.phase,
        createdAt: s.createdAt,
        isSeries: s.isSeries,
        seriesId: s.seriesId,
        seriesNumber: s.seriesNumber,
      })),
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.post("/vault/sessions/:sessionId/save", authenticate, async (req: AuthRequest, res) => {
  try {
    // Check vault access permission
    if (req.userId) {
      // Get session to check age group
      const session = await prisma.session.findUnique({
        where: { id: req.params.sessionId },
        select: { ageGroup: true }
      });
      
      if (session) {
        const hasPermission = await canAccessVault(req.userId, session.ageGroup);
        if (!hasPermission) {
          return res.status(403).json({
            ok: false,
            error: `You do not have permission to save sessions for age group ${session.ageGroup} to vault. Please contact an administrator.`,
            ageGroup: session.ageGroup,
          });
        }
      }
    }
    
    const { sessionId } = req.params;
    const result = await saveSessionToVault(sessionId);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.post("/vault/drills/:drillId/save", async (req, res) => {
  try {
    const { drillId } = req.params;
    const result = await saveDrillToVault(drillId);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.post("/vault/sessions/:sessionId/remove", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await removeSessionFromVault(sessionId);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.get("/vault/sessions", authenticate, async (req: AuthRequest, res) => {
  console.log("[VAULT] GET /vault/sessions - Request received");
  try {
    // Check vault access permission
    if (req.userId) {
      const ageGroup = req.query.ageGroup as string | undefined;
      const hasPermission = await canAccessVault(req.userId, ageGroup);
      if (!hasPermission) {
        return res.status(403).json({
          ok: false,
          error: ageGroup 
            ? `You do not have permission to access vault for age group ${ageGroup}. Please contact an administrator.`
            : 'You do not have permission to access the vault. Please contact an administrator.',
          ageGroup,
        });
      }
    }
    
    const filters = {
      gameModelId: req.query.gameModelId as string | undefined,
      ageGroup: req.query.ageGroup as string | undefined,
      phase: req.query.phase as string | undefined,
      zone: req.query.zone as string | undefined,
      excludeSeries: req.query.excludeSeries === undefined
        ? undefined
        : String(req.query.excludeSeries).toLowerCase() !== "false",
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };
    console.log("[VAULT] Filters:", filters);
    console.log("[VAULT] Calling getVaultSessions...");
    let result = await getVaultSessions(filters);
    
    // Filter sessions by format and age group permissions if user has restrictions
    if (req.userId) {
      const restrictions = await getAllowedFormatsAndAgeGroups(req.userId);
      const allowedFormats = restrictions.formats;
      const allowedAgeGroups = restrictions.ageGroups;
      
      if ((allowedFormats && allowedFormats.length > 0) || (allowedAgeGroups && allowedAgeGroups.length > 0)) {
        console.log(`[VAULT] Filtering sessions by restrictions:`, {
          formats: allowedFormats || "all",
          ageGroups: allowedAgeGroups || "all"
        });
        const originalCount = result.sessions.length;
        result.sessions = result.sessions.filter((session: any) => {
          // Check age group restriction
          if (allowedAgeGroups && allowedAgeGroups.length > 0) {
            if (!session.ageGroup || !allowedAgeGroups.includes(session.ageGroup)) {
              console.log(`[VAULT] Filtering out session ${session.id} (ageGroup: ${session.ageGroup}, allowed: ${allowedAgeGroups.join(", ")})`);
              return false;
            }
          }
          
          // Check format restriction
          if (allowedFormats && allowedFormats.length > 0) {
            // Get format from session's formation first
            const sessionJson = session.json as any || {};
            const formation = session.formationUsed || sessionJson.formationAttacking || sessionJson.formation;
            let finalFormat = getFormatFromFormation(formation);
            
            // If format is unknown from formation, derive from age group
            if (finalFormat === "unknown" && session.ageGroup) {
              finalFormat = getFormatFromAgeGroupForSession(session.ageGroup);
            }
            
            // If still unknown, skip format filtering for this session (allow it to be safe)
            if (finalFormat === "unknown") {
              console.log(`[VAULT] Session ${session.id} has unknown format (formation: ${formation}, ageGroup: ${session.ageGroup}), allowing it`);
              return true;
            }
            
            if (!allowedFormats.includes(finalFormat)) {
              console.log(`[VAULT] Filtering out session ${session.id} (format: ${finalFormat}, allowed: ${allowedFormats.join(", ")})`);
              return false;
            }
          }
          
          return true;
        });
        result.total = result.sessions.length; // Update total count
        console.log(`[VAULT] Filtered ${originalCount} sessions to ${result.sessions.length} based on format and age group permissions`);
      }
    }
    
    // Apply vault limits based on subscription plan
    const { sessions: limitedSessions, limitExceeded } = await applyVaultLimits(
      req.userId,
      result.sessions,
      []
    );

    console.log("[VAULT] Result - Sessions count:", limitedSessions?.length || 0, limitExceeded ? "(limited)" : "");
    
    return res.json({ 
      ok: true, 
      sessions: limitedSessions,
      total: limitedSessions.length,
      limitExceeded,
      ...(limitExceeded && req.userId ? {
        warning: `You have reached your vault limit. Showing first ${limitedSessions.length} sessions.`
      } : {})
    });
  } catch (e: any) {
    console.error("[VAULT] Error in /vault/sessions:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.get("/vault/series", authenticate, async (req: AuthRequest, res) => {
  console.log("[VAULT] GET /vault/series - Request received");
  try {
    // Check vault access permission
    if (req.userId) {
      const hasPermission = await canAccessVault(req.userId);
      if (!hasPermission) {
        return res.status(403).json({
          ok: false,
          error: 'You do not have permission to access the vault. Please contact an administrator.',
        });
      }
    }
    
    console.log("[VAULT] Calling getVaultSeries...");
    let series = await getVaultSeries();
    
    // Filter series by format and age group permissions if user has restrictions
    if (req.userId) {
      const restrictions = await getAllowedFormatsAndAgeGroups(req.userId);
      const allowedFormats = restrictions.formats;
      const allowedAgeGroups = restrictions.ageGroups;
      
      if ((allowedFormats && allowedFormats.length > 0) || (allowedAgeGroups && allowedAgeGroups.length > 0)) {
        console.log(`[VAULT] Filtering series by restrictions:`, {
          formats: allowedFormats || "all",
          ageGroups: allowedAgeGroups || "all"
        });
        const originalCount = series.length;
        series = series.filter((s: any) => {
          // Check if any session in the series matches restrictions
          const matchingSessions = s.sessions.filter((session: any) => {
            // Check age group restriction
            if (allowedAgeGroups && allowedAgeGroups.length > 0) {
              if (!session.ageGroup || !allowedAgeGroups.includes(session.ageGroup)) {
                return false;
              }
            }
            
            // Check format restriction
            if (allowedFormats && allowedFormats.length > 0) {
              const sessionJson = session.json as any || {};
              const formation = session.formationUsed || sessionJson.formationAttacking || sessionJson.formation;
              let finalFormat = getFormatFromFormation(formation);
              
              // If format is unknown from formation, derive from age group
              if (finalFormat === "unknown" && session.ageGroup) {
                finalFormat = getFormatFromAgeGroupForSession(session.ageGroup);
              }
              
              // If still unknown, allow it
              if (finalFormat === "unknown") {
                return true;
              }
              
              if (!allowedFormats.includes(finalFormat)) {
                return false;
              }
            }
            
            return true;
          });
          
          // Only include series if it has at least one matching session
          if (matchingSessions.length > 0) {
            // Update the series to only include matching sessions
            s.sessions = matchingSessions;
            s.totalSessions = matchingSessions.length;
            return true;
          }
          
          return false;
        });
        console.log(`[VAULT] Filtered ${originalCount} series to ${series.length} based on format and age group permissions`);
      }
    }
    
    console.log("[VAULT] Result - Series count:", series?.length || 0);
    return res.json({ ok: true, series });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Get sessions by seriesId
r.get("/vault/series/:seriesId", async (req, res) => {
  try {
    const { seriesId } = req.params;
    console.log("[VAULT] Fetching series with ID:", seriesId);
    
    const sessions = await prisma.session.findMany({
      where: {
        seriesId,
        savedToVault: true,
        isSeries: true,
      },
      orderBy: { seriesNumber: "asc" },
    });
    
    console.log("[VAULT] Found sessions:", sessions.length);
    
    if (sessions.length === 0) {
      // Debug: check if any sessions exist with this seriesId without the filters
      const allWithSeriesId = await prisma.session.findMany({
        where: { seriesId },
        select: { id: true, savedToVault: true, isSeries: true, seriesNumber: true },
      });
      console.log("[VAULT] Debug - all sessions with seriesId:", allWithSeriesId);
      
      return res.status(404).json({ ok: false, error: "Series not found" });
    }
    
    return res.json({ ok: true, sessions, seriesId });
  } catch (e: any) {
    console.error("[VAULT] Error fetching series:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.post("/vault/series/save", async (req, res) => {
  try {
    const schema = z.object({
      seriesId: z.string().optional(),
      sessionIds: z.array(z.string().uuid()),
    });
    const body = schema.parse(req.body);
    const result = await saveSeriesToVault(body.seriesId || "", body.sessionIds);
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.post("/vault/sessions/similar", async (req, res) => {
  try {
    const schema = z.object({
      gameModelId: z.string(),
      ageGroup: z.string(),
      phase: z.string().optional(),
      zone: z.string().optional(),
      formationAttacking: z.string(),
      formationDefending: z.string(),
      playerLevel: z.string(),
      coachLevel: z.string(),
      numbersMin: z.number(),
      numbersMax: z.number(),
      goalsAvailable: z.number(),
      spaceConstraint: z.string(),
      durationMin: z.number(),
      threshold: z.number().min(0).max(1).optional(),
    });

    const input = schema.parse(req.body);
    const threshold = input.threshold || 0.85;
    const similar = await findSimilarSessions(
      {
        gameModelId: input.gameModelId,
        ageGroup: input.ageGroup,
        phase: input.phase,
        zone: input.zone,
        formationAttacking: input.formationAttacking,
        formationDefending: input.formationDefending,
        playerLevel: input.playerLevel,
        coachLevel: input.coachLevel,
        numbersMin: input.numbersMin,
        numbersMax: input.numbersMax,
        goalsAvailable: input.goalsAvailable,
        spaceConstraint: input.spaceConstraint,
        durationMin: input.durationMin,
      },
      threshold
    );

    return res.json({ ok: true, matches: similar, count: similar.length });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.get("/vault/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.session.findUnique({ 
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    if (!session) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }
    return res.json({ ok: true, session });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

r.get("/vault/sessions/:sessionId/status", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, savedToVault: true },
    });
    if (!session) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }
    return res.json({ ok: true, savedToVault: session.savedToVault });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Semantic search endpoint for chat assistant
r.post("/vault/sessions/search", async (req, res) => {
  try {
    const { query, params, limit = 5 } = req.body;
    
    // Build database filters from extracted params
    const where: any = {
      savedToVault: true,
    };
    
    if (params?.ageGroup) {
      where.ageGroup = params.ageGroup;
    }
    if (params?.gameModelId) {
      where.gameModelId = params.gameModelId;
    }
    if (params?.phase) {
      where.phase = params.phase;
    }
    if (params?.zone) {
      where.zone = params.zone;
    }
    
    // Fetch matching sessions
    const sessions = await prisma.session.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 20),
      select: {
        id: true,
        title: true,
        gameModelId: true,
        ageGroup: true,
        phase: true,
        zone: true,
        durationMin: true,
        formationUsed: true,
        qaScore: true,
        json: true,
      },
    });
    
    // If we have a query string, do basic text matching on title and summary
    let results: Array<{ session: typeof sessions[number]; similarity: number }>;
    
    if (query && typeof query === "string") {
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      
      results = sessions.map(s => {
        const title = (s.title || "").toLowerCase();
        const summary = ((s.json as any)?.summary || "").toLowerCase();
        const content = title + " " + summary;
        
        // Simple relevance score based on word matches
        let score = 0;
        for (const word of queryWords) {
          if (content.includes(word)) score += 1;
        }
        
        return {
          session: s,
          similarity: Math.min(1, score / Math.max(queryWords.length, 1)),
        };
      })
      .filter(r => r.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    } else {
      results = sessions.map(s => ({ session: s, similarity: 1 }));
    }
    
    return res.json({ ok: true, results, count: results.length });
  } catch (e: any) {
    console.error("[VAULT_SEARCH] Error:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Lookup by reference code (D-XXXX, S-XXXX, SR-XXXX)
r.get("/vault/lookup/:refCode", async (req, res) => {
  try {
    const { refCode } = req.params;
    const parsed = parseRefCode(refCode);
    
    if (!parsed) {
      return res.status(400).json({
        ok: false,
        error: "Invalid reference code format. Expected D-XXXX, S-XXXX, or SR-XXXX",
      });
    }
    
    let result = await lookupByRefCode(refCode);
    
    // If drill not found, try to find and create from session JSON
    if (!result && parsed.type === "drill") {
      const sessions = await prisma.session.findMany({
        where: { savedToVault: true },
        select: { id: true, json: true, gameModelId: true, phase: true, zone: true, ageGroup: true, formationUsed: true, playerLevel: true, coachLevel: true, numbersMin: true, numbersMax: true, spaceConstraint: true },
      });

      for (const session of sessions) {
        const sessionJson = session.json as any;
        const drills = sessionJson?.drills || [];
        
        for (const drillJson of drills) {
          if (drillJson.refCode === refCode.toUpperCase()) {
            // Found the drill in session JSON, create standalone record
            try {
              const drillData: any = {
                refCode: refCode.toUpperCase(),
                title: drillJson.title || "Untitled Drill",
                gameModelId: session.gameModelId as any,
                phase: (session.phase || drillJson.phase || "ATTACKING") as any,
                zone: (session.zone || drillJson.zone || "ATTACKING_THIRD") as any,
                ageGroup: session.ageGroup,
                durationMin: drillJson.durationMin ?? 25,
                drillType: drillJson.drillType || "TECHNICAL",
                
                // Map from session or drill JSON
                numbersMin: drillJson.numbersMin ?? session.numbersMin,
                numbersMax: drillJson.numbersMax ?? session.numbersMax,
                spaceConstraint: drillJson.spaceConstraint ?? session.spaceConstraint,
                formationUsed: drillJson.formationUsed ?? session.formationUsed,
                playerLevel: session.playerLevel as any,
                coachLevel: session.coachLevel as any,
                principleIds: drillJson.principleIds || sessionJson.principleIds || [],
                psychThemeIds: drillJson.psychThemeIds || sessionJson.psychThemeIds || [],
                
                // Store full drill JSON
                json: drillJson,
                savedToVault: true,
              };

              const createdDrill = await prisma.drill.upsert({
                where: { refCode: refCode.toUpperCase() },
                update: { ...drillData, updatedAt: new Date() },
                create: drillData,
              });
              
              console.log(`[VAULT_LOOKUP] Created missing drill ${refCode.toUpperCase()} from session ${session.id}`);
              
              // Now lookup again
              result = await lookupByRefCode(refCode);
              break;
            } catch (err: any) {
              console.error(`[VAULT_LOOKUP] Failed to create drill ${refCode.toUpperCase()}:`, err?.message);
            }
          }
        }
        if (result) break;
      }
    }
    
    if (!result) {
      return res.status(404).json({
        ok: false,
        error: `No ${parsed.type} found with reference code ${refCode.toUpperCase()}`,
      });
    }
    
    return res.json({
      ok: true,
      found: true,
      type: result.type,
      refCode: refCode.toUpperCase(),
      data: result.data,
    });
  } catch (e: any) {
    console.error("[VAULT_LOOKUP] Error:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Lookup multiple reference codes at once
r.post("/vault/lookup", async (req, res) => {
  try {
    const { refCodes } = req.body;
    
    if (!Array.isArray(refCodes) || refCodes.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "refCodes must be a non-empty array",
      });
    }
    
    const results: Array<{
      refCode: string;
      type: "drill" | "session" | "player-plan" | null;
      data: any;
      found: boolean;
    }> = [];
    
    for (const code of refCodes.slice(0, 50)) { // Limit to 50 lookups
      const parsed = parseRefCode(code);
      let result = await lookupByRefCode(code);
      
      // If drill not found, try to find and create from session JSON
      if (!result && parsed && parsed.type === "drill") {
        const sessions = await prisma.session.findMany({
          where: { savedToVault: true },
          select: { id: true, json: true, gameModelId: true, phase: true, zone: true, ageGroup: true, formationUsed: true, playerLevel: true, coachLevel: true, numbersMin: true, numbersMax: true, spaceConstraint: true },
        });

        for (const session of sessions) {
          const sessionJson = session.json as any;
          const drills = sessionJson?.drills || [];
          
          for (const drillJson of drills) {
            if (drillJson.refCode === code.toUpperCase()) {
              // Found the drill in session JSON, create standalone record
              try {
                const drillData: any = {
                  refCode: code.toUpperCase(),
                  title: drillJson.title || "Untitled Drill",
                  gameModelId: session.gameModelId as any,
                  phase: (session.phase || drillJson.phase || "ATTACKING") as any,
                  zone: (session.zone || drillJson.zone || "ATTACKING_THIRD") as any,
                  ageGroup: session.ageGroup,
                  durationMin: drillJson.durationMin ?? 25,
                  drillType: drillJson.drillType || "TECHNICAL",
                  
                  // Map from session or drill JSON
                  numbersMin: drillJson.numbersMin ?? session.numbersMin,
                  numbersMax: drillJson.numbersMax ?? session.numbersMax,
                  spaceConstraint: drillJson.spaceConstraint ?? session.spaceConstraint,
                  formationUsed: drillJson.formationUsed ?? session.formationUsed,
                  playerLevel: session.playerLevel as any,
                  coachLevel: session.coachLevel as any,
                  principleIds: drillJson.principleIds || sessionJson.principleIds || [],
                  psychThemeIds: drillJson.psychThemeIds || sessionJson.psychThemeIds || [],
                  
                  // Store full drill JSON
                  json: drillJson,
                  savedToVault: true,
                };

                await prisma.drill.upsert({
                  where: { refCode: code.toUpperCase() },
                  update: { ...drillData, updatedAt: new Date() },
                  create: drillData,
                });
                
                // Now lookup again
                result = await lookupByRefCode(code);
                break;
              } catch (err: any) {
                console.error(`[VAULT_LOOKUP_BATCH] Failed to create drill ${code.toUpperCase()}:`, err?.message);
              }
            }
          }
          if (result) break;
        }
      }
      
      results.push({
        refCode: code.toUpperCase(),
        type: result?.type || null,
        data: result?.data || null,
        found: !!result,
      });
    }
    
    return res.json({
      ok: true,
      results,
      found: results.filter(r => r.found).length,
      notFound: results.filter(r => !r.found).length,
    });
  } catch (e: any) {
    console.error("[VAULT_LOOKUP_BATCH] Error:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Extract reference codes from text
r.post("/vault/extract-refs", async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== "string") {
      return res.status(400).json({
        ok: false,
        error: "text must be a non-empty string",
      });
    }
    
    const refCodes = extractRefCodes(text);
    
    // Lookup each extracted code
    const results = await Promise.all(
      refCodes.map(async (code) => {
        const result = await lookupByRefCode(code);
        return {
          refCode: code,
          type: result?.type || null,
          found: !!result,
          title: result?.data?.title || null,
        };
      })
    );
    
    return res.json({
      ok: true,
      refCodes,
      results,
    });
  } catch (e: any) {
    console.error("[VAULT_EXTRACT_REFS] Error:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default r;
