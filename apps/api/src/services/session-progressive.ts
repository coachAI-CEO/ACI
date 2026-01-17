import { generateText, setMetricsContext, clearMetricsContext } from "../gemini";
import { prisma } from "../prisma";
import { buildProgressiveSessionPrompt, ProgressiveSessionPromptInput } from "../prompts/session-progressive";
import { buildSessionQAReviewerPrompt } from "../prompts/session";
import { fixSessionDecision } from "./fixer";
import { SessionPromptInput } from "../prompts/session";

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
 * Generate a single progressive session (helper function)
 */
async function generateSingleProgressiveSession(
  input: ProgressiveSessionPromptInput
): Promise<any> {
  const prompt = buildProgressiveSessionPrompt(input);
  console.log(`[PROGRESSIVE_SESSION] Generating Session ${input.sessionNumber}/${input.totalSessions} with ${prompt.length} char prompt...`);
  
  const genText = await generateText(prompt, { timeout: 90000, retries: 0 });
  
  let session: any = parseJsonSafe(genText);
  if (!session) throw new Error(`LLM returned non-JSON session for Session ${input.sessionNumber}`);
  
  console.log(`[PROGRESSIVE_SESSION] Generated Session ${input.sessionNumber} with ${session.drills?.length || 0} drills`);
  
  // Normalize diagram format (same as regular session generation)
  if (session.drills && Array.isArray(session.drills)) {
    session.drills.forEach((drill: any) => {
      if (drill.drillType !== "COOLDOWN" && drill.diagram) {
        if (Array.isArray(drill.diagram.elements) && (!Array.isArray(drill.diagram.players) || drill.diagram.players.length === 0)) {
          const playerElements = drill.diagram.elements.filter((el: any) => 
            (el.team || el.role || el.type === 'player' || el.type === 'Player') &&
            typeof el.x === 'number' && 
            typeof el.y === 'number'
          );
          if (playerElements.length > 0) {
            drill.diagram.players = playerElements;
            delete drill.diagram.elements;
          } else {
            drill.diagram.players = [];
          }
        }
        
        if (!drill.diagram.pitch) {
          drill.diagram.pitch = { variant: "HALF", orientation: "HORIZONTAL", showZones: false };
        }
        if (!Array.isArray(drill.diagram.players)) {
          drill.diagram.players = [];
        }
        if (!Array.isArray(drill.diagram.goals)) {
          drill.diagram.goals = [];
        }
      } else if (drill.drillType !== "COOLDOWN" && !drill.diagram) {
        drill.diagram = {
          pitch: { variant: "HALF", orientation: "HORIZONTAL", showZones: false },
          players: [],
          goals: []
        };
      }
    });
  }

  // Run QA review - update metrics context
  setMetricsContext({
    operationType: "qa_review",
    ageGroup: input.ageGroup,
    gameModelId: input.gameModelId,
    phase: input.phase,
  });
  
  const qaPrompt = buildSessionQAReviewerPrompt(session);
  console.log(`[PROGRESSIVE_SESSION] Running QA for Session ${input.sessionNumber}...`);
  const qaText = await generateText(qaPrompt, { timeout: 60000, retries: 0 });
  const qaJson: any = parseJsonSafe(qaText);
  if (!qaJson) throw new Error(`LLM returned non-JSON QA for Session ${input.sessionNumber}`);

  // Compute fixer decision
  const scores = qaJson?.scores || {};
  const fixDecision = fixSessionDecision(scores);

  // Calculate average QA score
  const avgScore = qaJson?.scores
    ? (Object.values(qaJson.scores).reduce(
        (a: number, b: any) => a + Number(b || 0),
        0
      ) as number) / Math.max(1, Object.keys(qaJson.scores).length)
    : null;

  return {
    session,
    qa: qaJson,
    fixDecision,
    qaScore: avgScore,
  };
}

async function generateSingleProgressiveSessionWithRetry(
  input: ProgressiveSessionPromptInput,
  maxRetries: number,
  retryDelayMs: number
): Promise<any> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      attempt += 1;
      console.log(
        `[PROGRESSIVE_SESSION] Attempt ${attempt}/${maxRetries + 1} for Session ${input.sessionNumber}/${input.totalSessions}`
      );
      return await generateSingleProgressiveSession(input);
    } catch (err: any) {
      console.error(
        `[PROGRESSIVE_SESSION] Error on attempt ${attempt} for Session ${input.sessionNumber}:`,
        err?.message || err
      );
      if (attempt > maxRetries) {
        throw err;
      }
      const delay = Math.max(0, retryDelayMs);
      console.log(`[PROGRESSIVE_SESSION] Retrying after ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Failed to generate Session ${input.sessionNumber} after ${maxRetries + 1} attempts`);
}

/**
 * Generate a series of progressive sessions
 * 
 * @param baseInput - Base session configuration (used for all sessions)
 * @param numberOfSessions - Number of sessions to generate (default: 3)
 * @returns Array of sessions with progression metadata
 */
export async function generateProgressiveSessionSeries(
  baseInput: SessionPromptInput,
  numberOfSessions: number = 3
): Promise<{
  ok: boolean;
  series: Array<{
    sessionNumber: number;
    session: any;
    qa: any;
    fixDecision: any;
    qaScore: number | null;
    id?: string;
  }>;
  metadata: {
    totalSessions: number;
    gameModelId: string;
    ageGroup: string;
    generatedAt: string;
  };
  seriesId: string;
}> {
  console.log(`[PROGRESSIVE_SERIES] Starting generation of ${numberOfSessions} progressive sessions...`);
  
  // Generate a unique series ID upfront so all sessions are linked
  const seriesId = `series-${Date.now()}`;
  console.log(`[PROGRESSIVE_SERIES] Series ID: ${seriesId}`);
  
  // Set metrics context for tracking
  setMetricsContext({
    operationType: "series",
    ageGroup: baseInput.ageGroup,
    gameModelId: baseInput.gameModelId,
    phase: baseInput.phase,
  });
  
  const maxRetries = Number(process.env.PROGRESSIVE_SESSION_MAX_RETRIES ?? 1);
  const retryDelayMs = Number(process.env.PROGRESSIVE_SESSION_RETRY_DELAY_MS ?? 5000);
  const retries = Number.isFinite(maxRetries) && maxRetries >= 0 ? maxRetries : 1;
  const retryDelay = Number.isFinite(retryDelayMs) && retryDelayMs >= 0 ? retryDelayMs : 5000;
  console.log(`[PROGRESSIVE_SERIES] Session-level retries: ${retries} delayMs=${retryDelay}`);
  
  const sessions: Array<{
    sessionNumber: number;
    session: any;
    qa: any;
    fixDecision: any;
    qaScore: number | null;
    id?: string;
  }> = [];

  // Generate each session progressively
  for (let i = 1; i <= numberOfSessions; i++) {
    console.log(`[PROGRESSIVE_SERIES] Generating Session ${i}/${numberOfSessions}...`);
    
    // Build progressive input with previous sessions
    const progressiveInput: ProgressiveSessionPromptInput = {
      ...baseInput,
      sessionNumber: i,
      totalSessions: numberOfSessions,
      previousSessions: sessions.map(s => s.session), // Pass all previous sessions
    };

    // Generate this session with retries
    const result = await generateSingleProgressiveSessionWithRetry(
      progressiveInput,
      retries,
      retryDelay
    );
    
    // Persist to database
    const jsonForDb = {
      ...result.session,
      qa: result.qa,
    };

    const created = await prisma.session.create({
      data: {
        title: jsonForDb.title || `Session ${i}`,
        gameModelId: baseInput.gameModelId as any,
        phase: baseInput.phase as any,
        zone: baseInput.zone as any,
        ageGroup: baseInput.ageGroup,
        durationMin: baseInput.durationMin ?? jsonForDb.durationMin ?? 90,
        qaScore: result.qaScore,
        approved: !!result.qa.pass,
        numbersMin: baseInput.numbersMin,
        numbersMax: baseInput.numbersMax,
        principleIds: Array.isArray(jsonForDb.principleIds) 
          ? jsonForDb.principleIds 
          : [],
        psychThemeIds: Array.isArray(jsonForDb.psychThemeIds) 
          ? jsonForDb.psychThemeIds 
          : [],
        formationUsed: baseInput.formationAttacking,
        playerLevel: baseInput.playerLevel as any,
        coachLevel: baseInput.coachLevel as any,
        spaceConstraint: baseInput.spaceConstraint as any,
        goalsAvailable: baseInput.goalsAvailable ?? 0,
        json: jsonForDb,
        // Auto-save to vault as part of series
        savedToVault: true,
        isSeries: true,
        seriesId: seriesId,
        seriesNumber: i,
      },
    });

    // Persist QA snapshot
    await prisma.qAReport.create({
      data: {
        artifactId: created.id,
        artifactType: "SESSION",
        sessionId: created.id,
        pass: !!result.qa.pass,
        scores: result.qa.scores || {},
        summary: result.qa.summary || null,
      },
    });

    sessions.push({
      sessionNumber: i,
      session: {
        ...result.session,
        id: created.id,
        qaScore: result.qaScore,
        approved: !!result.qa.pass,
      },
      qa: result.qa,
      fixDecision: result.fixDecision,
      qaScore: result.qaScore,
      id: created.id,
    });

    console.log(`[PROGRESSIVE_SERIES] ✅ Session ${i}/${numberOfSessions} completed (ID: ${created.id})`);
  }

  console.log(`[PROGRESSIVE_SERIES] ✅ All ${numberOfSessions} sessions generated successfully`);

  // Clear metrics context
  clearMetricsContext();
  
  return {
    ok: true,
    series: sessions,
    metadata: {
      totalSessions: numberOfSessions,
      gameModelId: baseInput.gameModelId,
      ageGroup: baseInput.ageGroup,
      generatedAt: new Date().toISOString(),
    },
    seriesId: seriesId,
  };
}
