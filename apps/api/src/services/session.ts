import { generateText, setMetricsContext, clearMetricsContext } from "../gemini";
import { prisma } from "../prisma";
import { buildSessionPrompt, buildSessionQAReviewerPrompt } from "../prompts/session";
import { fixSessionDecision } from "./fixer";
import { generateRefCode } from "../utils/ref-code";
import { needsDiagramEnrichment, reenrichDiagramFromDrillJson } from "./diagram-enrichment";

// Re-export for convenience
export { fixSessionDecision };

/**
 * Parse JSON safely from LLM text output
 */
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

/**
 * Main generator + QA pipeline for sessions.
 *
 * 1) Generate session JSON from Gemini.
 * 2) Run QA reviewer.
 * 3) Compute fixer decision from QA scores (OK / PATCHABLE / NEEDS_REGEN).
 * 4) Persist final session + QA into DB.
 */
export async function generateAndReviewSession(
  input: Parameters<typeof buildSessionPrompt>[0],
  userId?: string
) {
  // Set metrics context for tracking
  setMetricsContext({
    operationType: "session",
    ageGroup: input.ageGroup,
    gameModelId: input.gameModelId,
    phase: input.phase,
  });
  
  try {
    // 1) Generate (longer timeout for sessions - more complex than drills)
    const prompt = buildSessionPrompt(input);
    console.log(`[SESSION] Starting generation with ${prompt.length} char prompt...`);
    const genText = await generateText(prompt, { timeout: 90000, retries: 0 });
  
  // Log raw response for debugging (first 5000 chars to see diagram structure)
  const rawPreview = genText.substring(0, 5000);
  console.log(`[SESSION] Raw LLM response (first 5000 chars):`, rawPreview);
  // Also log the last 2000 chars in case diagrams are at the end
  if (genText.length > 5000) {
    console.log(`[SESSION] Raw LLM response (last 2000 chars):`, genText.substring(genText.length - 2000));
  }
  
  let session: any = parseJsonSafe(genText);
  if (!session) throw new Error("LLM returned non-JSON session");
  
  // Log parsed session structure
  console.log(`[SESSION] Parsed session structure:`, {
    hasDrills: !!session.drills,
    drillsCount: session.drills?.length,
    drills: session.drills?.map((d: any) => ({
      drillType: d.drillType,
      title: d.title,
      hasDiagram: !!d.diagram,
      diagramKeys: d.diagram ? Object.keys(d.diagram) : [],
      playersCount: d.diagram?.players?.length ?? 0
    }))
  });

  // Log raw session structure for debugging
  console.log(`[SESSION] Generated session with ${session.drills?.length || 0} drills`);
  if (session.drills && Array.isArray(session.drills)) {
    session.drills.forEach((drill: any, index: number) => {
      console.log(`[SESSION] Drill ${index}: ${drill.drillType} - "${drill.title}"`);
      console.log(`[SESSION]   Has diagram: ${!!drill.diagram}`);
      if (drill.diagram) {
        console.log(`[SESSION]   Diagram keys:`, Object.keys(drill.diagram));
        console.log(`[SESSION]   Players array type:`, typeof drill.diagram.players);
        console.log(`[SESSION]   Players is array:`, Array.isArray(drill.diagram.players));
        console.log(`[SESSION]   Players length:`, drill.diagram.players?.length ?? 'undefined');
        if (drill.diagram.players && drill.diagram.players.length > 0) {
          console.log(`[SESSION]   First player:`, JSON.stringify(drill.diagram.players[0]));
        } else {
          console.error(`[SESSION]   ⚠️ EMPTY PLAYERS ARRAY for drill "${drill.title}"`);
          console.error(`[SESSION]   Full drill.diagram:`, JSON.stringify(drill.diagram, null, 2));
          // Also check if elements array has data
          if (drill.diagram.elements && Array.isArray(drill.diagram.elements)) {
            console.error(`[SESSION]   Elements array length:`, drill.diagram.elements.length);
            if (drill.diagram.elements.length > 0) {
              console.error(`[SESSION]   First element:`, JSON.stringify(drill.diagram.elements[0], null, 2));
            }
          }
        }
      }
    });
  }

  // Normalize diagram format: convert elements to players if needed
  if (session.drills && Array.isArray(session.drills)) {
    session.drills.forEach((drill: any, index: number) => {
      if (drill.drillType !== "COOLDOWN" && drill.diagram) {
        const inferOrientation = (diagram: any) => {
          const goals = Array.isArray(diagram.goals) ? diagram.goals : [];
          if (goals.length > 0) {
            const left = goals.some((g: any) => typeof g.x === "number" && g.x < 20);
            const right = goals.some((g: any) => typeof g.x === "number" && g.x > 80);
            const top = goals.some((g: any) => typeof g.y === "number" && g.y < 20);
            const bottom = goals.some((g: any) => typeof g.y === "number" && g.y > 80);
            if ((left || right) && !(top || bottom)) return "HORIZONTAL";
            if ((top || bottom) && !(left || right)) return "VERTICAL";
          }
          const players = Array.isArray(diagram.players) ? diagram.players : [];
          if (players.length >= 2) {
            const xs = players.map((p: any) => p.x).filter((n: any) => Number.isFinite(n));
            const ys = players.map((p: any) => p.y).filter((n: any) => Number.isFinite(n));
            const rangeX = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
            const rangeY = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
            return rangeY >= rangeX ? "VERTICAL" : "HORIZONTAL";
          }
          return "HORIZONTAL";
        };

        // If diagram has 'elements' instead of 'players', try to convert it
        if (Array.isArray(drill.diagram.elements) && (!Array.isArray(drill.diagram.players) || drill.diagram.players.length === 0)) {
          console.warn(`[SESSION] Drill ${index} uses 'elements' format, attempting to convert to 'players' format`);
          // Try to extract player objects from elements
          const playerElements = drill.diagram.elements.filter((el: any) => 
            (el.team || el.role || el.type === 'player' || el.type === 'Player') &&
            typeof el.x === 'number' && 
            typeof el.y === 'number'
          );
          
          if (playerElements.length > 0) {
            drill.diagram.players = playerElements;
            delete drill.diagram.elements;
            console.log(`[SESSION] ✅ Converted ${playerElements.length} elements to players for drill ${index}`);
          } else {
            console.error(`[SESSION] ⚠️ Could not find player-like elements in elements array`);
            drill.diagram.players = [];
          }
        }
        
        // Ensure diagram has required structure
        if (!drill.diagram.pitch) {
          drill.diagram.pitch = { variant: "HALF", orientation: "HORIZONTAL", showZones: false };
        }
        if (drill.diagram.pitch) {
          const inferred = inferOrientation(drill.diagram);
          if (drill.diagram.pitch.orientation !== inferred) {
            drill.diagram.pitch.orientation = inferred;
            console.log(`[SESSION] Adjusted diagram orientation to ${inferred} for drill ${index}`);
          }
        }

        // Align goal teamAttacks with player positioning
        const goals = Array.isArray(drill.diagram.goals) ? drill.diagram.goals : [];
        const players = Array.isArray(drill.diagram.players) ? drill.diagram.players : [];
        if (goals.length >= 2 && players.length > 0) {
          const attPlayers = players.filter((p: any) => p.team === "ATT");
          if (attPlayers.length > 0) {
            const attCentroidX =
              attPlayers.reduce((sum: number, p: any) => sum + (p.x || 0), 0) /
              attPlayers.length;
            const attCentroidY =
              attPlayers.reduce((sum: number, p: any) => sum + (p.y || 0), 0) /
              attPlayers.length;
            if (drill.diagram.pitch.orientation === "HORIZONTAL") {
              const leftGoal = goals.reduce((min: any, g: any) => (g.x < min.x ? g : min), goals[0]);
              const rightGoal = goals.reduce((max: any, g: any) => (g.x > max.x ? g : max), goals[0]);
              const distLeft = Math.abs(attCentroidX - leftGoal.x);
              const distRight = Math.abs(attCentroidX - rightGoal.x);
              if (distRight < distLeft) {
                leftGoal.teamAttacks = "DEF";
                rightGoal.teamAttacks = "ATT";
              } else {
                leftGoal.teamAttacks = "ATT";
                rightGoal.teamAttacks = "DEF";
              }
            } else {
              const topGoal = goals.reduce((min: any, g: any) => (g.y < min.y ? g : min), goals[0]);
              const bottomGoal = goals.reduce((max: any, g: any) => (g.y > max.y ? g : max), goals[0]);
              const distTop = Math.abs(attCentroidY - topGoal.y);
              const distBottom = Math.abs(attCentroidY - bottomGoal.y);
              if (distBottom < distTop) {
                topGoal.teamAttacks = "DEF";
                bottomGoal.teamAttacks = "ATT";
              } else {
                topGoal.teamAttacks = "ATT";
                bottomGoal.teamAttacks = "DEF";
              }
            }
          }
        }
        if (!Array.isArray(drill.diagram.players)) {
          drill.diagram.players = [];
        }
        if (!Array.isArray(drill.diagram.goals)) {
          drill.diagram.goals = [];
        }
        
        // Validate players array is populated
        if (drill.diagram.players.length === 0) {
          console.error(`[SESSION] ⚠️ CRITICAL: Drill ${index} (${drill.drillType || 'unknown'}) has empty players array!`);
          console.error(`[SESSION] Drill organization:`, drill.organization?.setupSteps);
          
          // Try to extract player count from organization.setupSteps
          const setupText = JSON.stringify(drill.organization?.setupSteps || []);
          const playerMatches = setupText.match(/(\d+)\s*(?:attackers?|defenders?|players?|GK|goalkeeper)/gi);
          
          if (playerMatches && playerMatches.length > 0) {
            console.warn(`[SESSION] Attempting to infer player count from setupSteps:`, playerMatches);
          }
        } else {
          console.log(`[SESSION] ✅ Drill ${index} (${drill.drillType}) has ${drill.diagram.players.length} players in diagram`);
        }
      } else if (drill.drillType !== "COOLDOWN" && !drill.diagram) {
        // Ensure diagram exists
        console.warn(`[SESSION] Drill ${index} (${drill.drillType || 'unknown'}) missing diagram, creating minimal diagram`);
        drill.diagram = {
          pitch: { variant: "HALF", orientation: "HORIZONTAL", showZones: false },
          players: [],
          goals: []
        };
      }
    });
  }

  // 2) QA Review - update metrics context
  setMetricsContext({
    operationType: "qa_review",
    ageGroup: input.ageGroup,
    gameModelId: input.gameModelId,
    phase: input.phase,
  });
  
  const qaPrompt = buildSessionQAReviewerPrompt(session);
  console.log(`[SESSION] Starting QA with ${qaPrompt.length} char prompt...`);
  const qaText = await generateText(qaPrompt, { timeout: 60000, retries: 0 });
  const qaJson: any = parseJsonSafe(qaText);
  if (!qaJson) throw new Error("LLM returned non-JSON QA");

  // 3) Compute fixer decision from QA scores
  const scores = qaJson?.scores || {};

  // For now, we do NOT auto-patch sessions here (similar to drills)
  const finalSession = session;
  const finalQa = qaJson;

  // Average QA score
  const avgScore =
    finalQa?.scores
      ? Object.values(finalQa.scores).reduce(
          (a: number, b: any) => a + Number(b || 0),
          0
        ) / Math.max(1, Object.keys(finalQa.scores).length)
      : null;

  // Generate unique reference code for the session
  const sessionRefCode = await generateRefCode("session");
  
  // Add ref codes to embedded drills in the session JSON and persist as standalone records
  const drillsWithRefCodes = finalSession.drills ? await Promise.all(
    finalSession.drills.map(async (drill: any) => {
      try {
        if (needsDiagramEnrichment(drill?.diagram)) {
          const reenriched = await reenrichDiagramFromDrillJson(drill);
          if (reenriched) {
            drill.diagram = reenriched;
            if (drill.json && typeof drill.json === "object") {
              drill.json.diagram = reenriched;
            }
          }
        }
      } catch (err: any) {
        console.error("[SESSION] Diagram re-enrichment failed:", err?.message || String(err));
      }
      const drillRefCode = drill.refCode || await generateRefCode("drill");
      
      // Persist drill as standalone record (upsert by refCode)
      try {
        const drillData: any = {
          refCode: drillRefCode,
          title: drill.title || "Untitled Drill",
          gameModelId: input.gameModelId as any,
          phase: input.phase as any,
          zone: input.zone as any,
          ageGroup: input.ageGroup,
          durationMin: drill.durationMin ?? input.durationMin ?? 25,
          drillType: drill.drillType || "TECHNICAL",
          
          // Map from input or drill JSON
          numbersMin: drill.numbersMin ?? input.numbersMin,
          numbersMax: drill.numbersMax ?? input.numbersMax,
          spaceConstraint: drill.spaceConstraint ?? input.spaceConstraint,
          formationUsed: drill.formationUsed ?? input.formationAttacking,
          playerLevel: input.playerLevel as any,
          coachLevel: input.coachLevel as any,
          principleIds: drill.principleIds || finalSession.principleIds || [],
          psychThemeIds: drill.psychThemeIds || finalSession.psychThemeIds || [],
          
          // Store full drill JSON
          json: drill,
          savedToVault: true,
        };

        await prisma.drill.upsert({
          where: { refCode: drillRefCode },
          update: { ...drillData, updatedAt: new Date() },
          create: drillData,
        });
      } catch (err: any) {
        console.error(`[SESSION] Failed to save drill ${drillRefCode}:`, err?.message);
        // Continue - don't fail session save if drill save fails
      }
      
      return {
        ...drill,
        refCode: drillRefCode,
      };
    })
  ) : [];

  // JSON we persist to the DB
  const jsonForDb = {
    ...finalSession,
    drills: drillsWithRefCodes,
    qa: finalQa,
  };

  // Persist session with all fields
  const created = await prisma.session.create({
    data: {
      refCode: sessionRefCode,
      title: jsonForDb.title || "Untitled Session",
      gameModelId: input.gameModelId as any,
      phase: input.phase as any,
      zone: input.zone as any,
      ageGroup: input.ageGroup,
      durationMin: input.durationMin ?? jsonForDb.durationMin ?? 90,
      qaScore: avgScore,
      approved: !!finalQa.pass,
      
      // Session constraints
      numbersMin: input.numbersMin,
      numbersMax: input.numbersMax,
      
      principleIds: Array.isArray(jsonForDb.principleIds) 
        ? jsonForDb.principleIds 
        : [],
      psychThemeIds: Array.isArray(jsonForDb.psychThemeIds) 
        ? jsonForDb.psychThemeIds 
        : [],
      
      // Formation & level metadata
      formationUsed: input.formationAttacking,
      playerLevel: input.playerLevel as any,
      coachLevel: input.coachLevel as any,
      
      spaceConstraint: input.spaceConstraint as any,
      goalsAvailable: input.goalsAvailable ?? 0,
      
      // Auto-save to vault
      savedToVault: true,
      
      // Track who generated this session
      generatedBy: userId || null,
      
      json: jsonForDb,
    },
  });
  
  console.log("✅ [SESSION CREATED] ID:", created.id);

  // Fetch creator info if userId was provided
  let creator = null;
  if (userId) {
    const creatorUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (creatorUser) {
      creator = {
        id: creatorUser.id,
        name: creatorUser.name,
        email: creatorUser.email,
      };
    }
  }

  // Persist QA snapshot
  await prisma.qAReport.create({
    data: {
      artifactId: created.id,
      artifactType: "SESSION",
      sessionId: created.id,
      pass: !!finalQa.pass,
      scores: finalQa.scores || {},
      summary: finalQa.summary || null,
    },
  });

  // Compute fixer decision
  let fixDecision: any = null;
  try {
    const scoresObj = (finalQa && (finalQa as any).scores) || {};
    if (scoresObj && Object.keys(scoresObj).length > 0) {
      fixDecision = fixSessionDecision(scoresObj);
    }
  } catch (err) {
    console.error("fixSessionDecision error", err);
  }

    return {
      session: {
        ...finalSession,
        id: created.id,
        refCode: sessionRefCode,
        drills: drillsWithRefCodes,
        qaScore: avgScore,
        approved: !!finalQa.pass,
        // Include creator information
        creator,
      },
      qa: finalQa,
      fixDecision,
      raw: {
        created: { id: created.id },
      },
    };
  } finally {
    clearMetricsContext();
  }
}
