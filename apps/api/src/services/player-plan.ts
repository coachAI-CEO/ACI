import { prisma } from "../prisma";
import { generateText, setMetricsContext, clearMetricsContext } from "../gemini";
import {
  buildPlayerPlanAdaptationPrompt,
  buildPlayerPlanFromSessionPrompt,
} from "../prompts/player-plan";
import { generateRefCode } from "../utils/ref-code";

/**
 * Parse JSON safely from LLM text output
 */
function parseJsonSafe(text: string) {
  try {
    const cleaned = text
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

/**
 * Generate a player-only training plan from a session
 */
export async function generatePlayerPlanFromSession(
  sessionId: string,
  userId: string,
  options?: {
    durationMin?: 30 | 45;
    focus?: string;
    playerLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  }
): Promise<{ plan: any; id: string; refCode: string }> {
  // Load source session - try by ID first, then by refCode if it looks like a refCode
  let session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      refCode: true,
      title: true,
      ageGroup: true,
      playerLevel: true,
      durationMin: true,
      json: true,
    },
  });

  // If not found by ID, try by refCode (in case sessionId is actually a refCode)
  if (!session && (sessionId.startsWith("S-") || sessionId.startsWith("SR-"))) {
    console.log(`[PLAYER_PLAN] Session not found by ID, trying refCode: ${sessionId}`);
    session = await prisma.session.findFirst({
      where: { refCode: sessionId.toUpperCase() },
      select: {
        id: true,
        refCode: true,
        title: true,
        ageGroup: true,
        playerLevel: true,
        durationMin: true,
        json: true,
      },
    });
  }

  if (!session) {
    console.error(`[PLAYER_PLAN] Session not found with ID/refCode: ${sessionId}`);
    throw new Error(`Session not found: ${sessionId}`);
  }

  const sessionJson = (session.json as any) || {};
  const drills = sessionJson.drills || [];

  if (!Array.isArray(drills) || drills.length === 0) {
    throw new Error("Session has no drills to adapt");
  }

  // Extract playerLevel from session (check both fields)
  const sourcePlayerLevel = (session.playerLevel as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null) ||
                            (sessionJson.playerLevel as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null) ||
                            null;
  const playerLevel = options?.playerLevel || sourcePlayerLevel;

  // Set metrics context
  setMetricsContext({
    operationType: "player_plan",
    artifactId: sessionId,
    ageGroup: session.ageGroup,
  });

  try {
    const requestedDuration: 30 | 45 = options?.durationMin === 30 ? 30 : 45;
    const expectedActivities = requestedDuration === 30 ? 2 : 3;
    const sourceDrills = Array.isArray(drills)
      ? drills.map((d: any) => ({
          title: d?.title,
          drillType: d?.drillType,
          focus: d?.focus || d?.coachingFocus || d?.objective,
          coachingPoints: Array.isArray(d?.coachingPoints) ? d.coachingPoints.slice(0, 4) : [],
        }))
      : [];

    const prompt = buildPlayerPlanFromSessionPrompt({
      sessionTitle: session.title,
      sessionSummary: sessionJson.summary || null,
      sourceDrills,
      ageGroup: session.ageGroup,
      playerLevel,
      durationMin: requestedDuration,
      focus: options?.focus,
    });

    console.log(`[PLAYER_PLAN] Generating complementary player plan (${requestedDuration}min, ${expectedActivities} activities)`);
    const adaptedText = await generateText(prompt, { timeout: 45000, retries: 0 });
    const parsedPlan = parseJsonSafe(adaptedText);
    const adaptedDrillsRaw = Array.isArray(parsedPlan?.drills) ? parsedPlan.drills : [];
    const adaptedDrills = adaptedDrillsRaw.slice(0, expectedActivities);

    if (adaptedDrills.length !== expectedActivities) {
      throw new Error(`Expected ${expectedActivities} solo activities, got ${adaptedDrills.length}`);
    }

    const equipmentSet = new Set<string>();
    adaptedDrills.forEach((drill: any) => {
      if (drill?.organization?.equipment && Array.isArray(drill.organization.equipment)) {
        drill.organization.equipment.forEach((eq: string) => equipmentSet.add(eq));
      }
    });

    const totalDuration = requestedDuration;
    const objectives =
      parsedPlan?.objectives ||
      `Solo plan that complements "${session.title}" with ${adaptedDrills.length} targeted activities for ${playerLevel || "intermediate"} players.`;

    // Generate reference code
    const refCode = await generateRefCode("player-plan");

    // Create PlayerPlan record
    const playerPlan = await prisma.playerPlan.create({
      data: {
        refCode,
        userId,
        sourceType: "SESSION",
        sourceId: sessionId,
        sourceRefCode: session.refCode,
        title: parsedPlan?.title || `${session.title} - Player Version`,
        ageGroup: session.ageGroup,
        playerLevel: playerLevel as any,
        objectives,
        durationMin: totalDuration,
        json: {
          drills: adaptedDrills,
          source: {
            sessionId: session.id,
            sessionRefCode: session.refCode,
            sessionTitle: session.title,
          },
        },
        equipment: Array.from(equipmentSet),
      },
    });

    return {
      plan: playerPlan,
      id: playerPlan.id,
      refCode: playerPlan.refCode || "",
    };
  } finally {
    clearMetricsContext();
  }
}

/**
 * Generate a player-only training plan from a series
 */
export async function generatePlayerPlanFromSeries(
  seriesId: string,
  userId: string,
  options?: {
    sessionNumbers?: number[];
    durationMin?: 30 | 45;
    focus?: string;
    playerLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  }
): Promise<{ plan: any; id: string; refCode: string }> {
  // Load sessions in the series
  const sessions = await prisma.session.findMany({
    where: {
      seriesId,
      savedToVault: true,
    },
    orderBy: { seriesNumber: "asc" },
    select: {
      id: true,
      refCode: true,
      title: true,
      ageGroup: true,
      playerLevel: true,
      durationMin: true,
      seriesNumber: true,
      json: true,
    },
  });

  if (sessions.length === 0) {
    throw new Error("Series not found or has no sessions");
  }

  // Filter by sessionNumbers if provided
  const targetSessions = options?.sessionNumbers
    ? sessions.filter((s) => s.seriesNumber && options.sessionNumbers!.includes(s.seriesNumber))
    : sessions;

  if (targetSessions.length === 0) {
    throw new Error("No sessions match the specified session numbers");
  }

  // Use first session for metadata
  const firstSession = targetSessions[0];
  const sessionJson = (firstSession.json as any) || {};
  const sourcePlayerLevel = (firstSession.playerLevel as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null) ||
                            (sessionJson.playerLevel as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null) ||
                            null;
  const playerLevel = options?.playerLevel || sourcePlayerLevel;

  setMetricsContext({
    operationType: "player_plan",
    artifactId: seriesId,
    ageGroup: firstSession.ageGroup,
  });

  try {
    const allAdaptedDrills: any[] = [];
    const equipmentSet = new Set<string>();

    // Process each session in the series
    for (const session of targetSessions) {
      const sJson = (session.json as any) || {};
      const drills = sJson.drills || [];

      for (const originalDrill of drills) {
        try {
          const prompt = buildPlayerPlanAdaptationPrompt({
            originalDrill,
            ageGroup: session.ageGroup,
            playerLevel,
            focus: options?.focus,
          });

          console.log(`[PLAYER_PLAN] Adapting drill from session ${session.seriesNumber}: ${originalDrill.title || originalDrill.drillType}`);
          const adaptedText = await generateText(prompt, { timeout: 30000, retries: 0 });
          const adaptedDrill = parseJsonSafe(adaptedText);

          if (!adaptedDrill) {
            console.warn(`[PLAYER_PLAN] Failed to parse adapted drill, skipping`);
            continue;
          }

          // Add session context to drill
          adaptedDrill.sessionNumber = session.seriesNumber;
          adaptedDrill.sessionTitle = session.title;

          // Collect equipment
          if (adaptedDrill.organization?.equipment && Array.isArray(adaptedDrill.organization.equipment)) {
            adaptedDrill.organization.equipment.forEach((eq: string) => equipmentSet.add(eq));
          }

          allAdaptedDrills.push(adaptedDrill);
        } catch (error: any) {
          console.error(`[PLAYER_PLAN] Error adapting drill:`, error);
        }
      }
    }

    if (allAdaptedDrills.length === 0) {
      throw new Error("Failed to adapt any drills for player plan");
    }

    // Calculate total duration
    const totalDuration = options?.durationMin ||
      allAdaptedDrills.reduce((sum, d) => sum + (d.durationMin || 10), 0);

    // Generate objectives
    const seriesTitle = targetSessions.length === 1
      ? targetSessions[0].title
      : `Series (${targetSessions.length} sessions)`;
    const objectives = `Solo training plan adapted from series "${seriesTitle}". Focus: ${options?.focus || "All aspects"}. ${allAdaptedDrills.length} exercises across ${targetSessions.length} session(s), designed for ${playerLevel || "intermediate"} level players.`;

    // Generate reference code
    const refCode = await generateRefCode("player-plan");

    // Create PlayerPlan record
    const playerPlan = await prisma.playerPlan.create({
      data: {
        refCode,
        userId,
        sourceType: "SERIES",
        sourceId: seriesId,
        sourceRefCode: null, // Series don't have single refCode
        title: `${seriesTitle} - Player Version`,
        ageGroup: firstSession.ageGroup,
        playerLevel: playerLevel as any,
        objectives,
        durationMin: totalDuration,
        json: {
          drills: allAdaptedDrills,
          source: {
            seriesId,
            sessionCount: targetSessions.length,
            sessionNumbers: targetSessions.map((s) => s.seriesNumber).filter((n) => n !== null),
          },
        },
        equipment: Array.from(equipmentSet),
      },
    });

    return {
      plan: playerPlan,
      id: playerPlan.id,
      refCode: playerPlan.refCode || "",
    };
  } finally {
    clearMetricsContext();
  }
}
