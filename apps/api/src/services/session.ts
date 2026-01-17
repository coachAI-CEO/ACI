import { generateText, setMetricsContext, clearMetricsContext } from "../gemini";
import { prisma } from "../prisma";
import { buildSessionPrompt, buildSessionQAReviewerPrompt } from "../prompts/session";
import { fixSessionDecision } from "./fixer";

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
  input: Parameters<typeof buildSessionPrompt>[0]
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

  // JSON we persist to the DB
  const jsonForDb = {
    ...finalSession,
    qa: finalQa,
  };

  // Persist session with all fields
  const created = await prisma.session.create({
    data: {
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
      
      json: jsonForDb,
    },
  });
  
  console.log("✅ [SESSION CREATED] ID:", created.id);

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
        qaScore: avgScore,
        approved: !!finalQa.pass,
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

