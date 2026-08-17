import { generateText, setMetricsContext, clearMetricsContext } from "../gemini";
import { prisma } from "../prisma";
import { buildProgressiveSessionPrompt, ProgressiveSessionPromptInput } from "../prompts/session-progressive";
import { buildSessionQAReviewerPrompt } from "../prompts/session";
import { fixSessionDecision } from "./fixer";
import { SessionPromptInput } from "../prompts/session";
import { generateRefCode } from "../utils/ref-code";
import { needsDiagramEnrichment, reenrichDiagramFromDrillJson } from "./diagram-enrichment";
import { needsDescriptionExpansion, expandDrillDescription } from "./description-enrichment";
import { enforceDiagramGoalAvailability } from "./diagram-goals";
import { generateDrillDiagramSvg, omitDiagramSvgFromDrill } from "./drill-diagram-svg";
import { resolveSessionClubId } from "./club-philosophy";
import {
  normalizeGoalkeeperPositions,
  enforceConditionedGameFormatDiagram,
  enforceDiagramPlayerLimit,
  replaceFormatMentions,
} from "./session";

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

function isUssfDCoachLevel(coachLevel?: string): boolean {
  return String(coachLevel || "").toUpperCase() === "USSF_D";
}

function applyCoachLevelDiagramProfile(drill: any, coachLevel?: string) {
  if (!isUssfDCoachLevel(coachLevel)) return;
  if (!drill || drill.drillType === "COOLDOWN" || !drill.diagram) return;

  const diagram = drill.diagram;
  diagram.pitch = diagram.pitch || {};
  diagram.pitch.showZones = false;
  if (diagram.pitch && typeof diagram.pitch === "object" && "zones" in diagram.pitch) {
    delete diagram.pitch.zones;
  }

  if (Array.isArray(diagram.safeZones)) {
    diagram.safeZones = [];
  }
  if (Array.isArray(diagram.arrows)) {
    diagram.arrows = diagram.arrows.slice(0, 3);
  }
  if (Array.isArray(diagram.annotations)) {
    diagram.annotations = diagram.annotations.slice(0, 1);
  }
}

const USSF_D_LANGUAGE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bmeticulously\b/gi, "carefully"],
  [/\bcomprehensive\b/gi, "complete"],
  [/\btactical intelligence\b/gi, "decision-making"],
  [/\btactical nuances?\b/gi, "key ideas"],
  [/\bnumerical superiority\b/gi, "an extra player"],
  [/\brest defense\b/gi, "cover behind the ball"],
  [/\bline-breaking\b/gi, "forward"],
  [/\bprogression lanes\b/gi, "passing lanes"],
  [/\bverticality\b/gi, "playing forward"],
  [/\bcounterpress(?:ing)?\b/gi, "win the ball back quickly"],
  [/\bphase(?:s)?\b/gi, "moment"],
  [/\bman-oriented\b/gi, "player-to-player"],
  [/\bzonal\b/gi, "area-based"],
  [/\bpositional superiority\b/gi, "better positioning"],
  [/\bfunctional game application\b/gi, "real game use"],
  [/\bcognitive scanning\b/gi, "scanning"],
  [/\bunder high-pressure scenarios?\b/gi, "under pressure"],
  [/\bhigh-pressure situations?\b/gi, "pressure situations"],
  [/\bexploit(?:ing)? gaps?\b/gi, "find spaces"],
  [/\bnuances?\b/gi, "details"],
  [/\bincentivized\b/gi, "rewarded"],
  [/\btertiary\b/gi, "third"],
  [/\bstructured\b/gi, "organized"],
  [/\bcohesive\b/gi, "clear"],
  [/\bculminating\b/gi, "final"],
  [/\bmanipulate\b/gi, "move"],
  [/\bspatial awareness\b/gi, "awareness of space"],
];

function simplifyUssfDText(text: string): string {
  let out = String(text || "");
  for (const [pattern, replacement] of USSF_D_LANGUAGE_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  out = out
    .replace(/[“”]/g, '"')
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
  out = out
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      const words = sentence.split(/\s+/).filter(Boolean);
      if (words.length <= 22) return sentence;
      return `${words.slice(0, 22).join(" ")}.`;
    })
    .join(" ");
  return out.trim();
}

function toUssfDCoachVoice(text: string): string {
  let out = String(text || "").trim();
  if (!out) return out;

  out = out
    .replace(/^this (training session|session) (is|was) (specifically )?designed to/gi, "Run this session to")
    .replace(/^this (technical|tactical|conditioned)?\s*drill (focuses on|is designed to|is built to)/gi, "Run this drill to")
    .replace(/\bthe primary focus is\b/gi, "Focus on")
    .replace(/\bthe core focus is\b/gi, "Focus on")
    .replace(/\bthe focus is on\b/gi, "Focus on")
    .replace(/\bplayers should\b/gi, "Players")
    .replace(/\bcoaches should\b/gi, "Coach")
    .replace(/\bthis drill\b/gi, "The drill")
    .replace(/\bthis session\b/gi, "The session")
    .replace(/\bwill be able to\b/gi, "can");

  return out.replace(/\s{2,}/g, " ").trim();
}

function simplifyUssfDStringArray(values: any): any {
  if (!Array.isArray(values)) return values;
  return values.map((value) =>
    typeof value === "string" ? toUssfDCoachVoice(simplifyUssfDText(value)) : value
  );
}

function applyCoachLevelLanguageProfile(session: any, coachLevel?: string) {
  if (!isUssfDCoachLevel(coachLevel) || !session || typeof session !== "object") return;

  if (typeof session.summary === "string") {
    session.summary = toUssfDCoachVoice(simplifyUssfDText(session.summary));
  }

  if (!Array.isArray(session.drills)) return;
  session.drills.forEach((drill: any) => {
    if (!drill || typeof drill !== "object") return;

    if (typeof drill.description === "string") {
      drill.description = toUssfDCoachVoice(simplifyUssfDText(drill.description));
    }
    drill.coachingPoints = simplifyUssfDStringArray(drill.coachingPoints);
    drill.progressions = simplifyUssfDStringArray(drill.progressions);
    drill.constraints = simplifyUssfDStringArray(drill.constraints);

    if (drill.loadNotes && typeof drill.loadNotes === "object") {
      if (typeof drill.loadNotes.rationale === "string") {
        drill.loadNotes.rationale = simplifyUssfDText(drill.loadNotes.rationale);
      }
      if (typeof drill.loadNotes.structure === "string") {
        drill.loadNotes.structure = simplifyUssfDText(drill.loadNotes.structure);
      }
    }

    if (drill.organization && typeof drill.organization === "object") {
      if (Array.isArray(drill.organization.setupSteps)) {
        drill.organization.setupSteps = simplifyUssfDStringArray(drill.organization.setupSteps);
      }
      if (typeof drill.organization.rotation === "string") {
        drill.organization.rotation = simplifyUssfDText(drill.organization.rotation);
      }
      if (typeof drill.organization.restarts === "string") {
        drill.organization.restarts = simplifyUssfDText(drill.organization.restarts);
      }
      if (typeof drill.organization.scoring === "string") {
        drill.organization.scoring = simplifyUssfDText(drill.organization.scoring);
      }
    }

    if (Array.isArray(drill.coachingPoints)) {
      drill.coachingPoints = drill.coachingPoints.map((point: any) => {
        const text = simplifyUssfDText(String(point || ""));
        const coachVoice = toUssfDCoachVoice(text);
        const words = coachVoice.split(/\s+/).filter(Boolean);
        return words.length > 18 ? `${words.slice(0, 18).join(" ")}.` : coachVoice;
      });
    }

    if (drill.debrief && typeof drill.debrief === "object") {
      drill.debrief.keyTakeaways = simplifyUssfDStringArray(drill.debrief.keyTakeaways);
      drill.debrief.questionsToAsk = simplifyUssfDStringArray(drill.debrief.questionsToAsk);
      drill.debrief.watchFor = simplifyUssfDStringArray(drill.debrief.watchFor);
    }
  });
}

/**
 * Generate a single progressive session (helper function)
 */
async function generateSingleProgressiveSession(
  input: ProgressiveSessionPromptInput
): Promise<any> {
  const prompt = buildProgressiveSessionPrompt(input);
  console.log(`[PROGRESSIVE_SESSION] Generating Session ${input.sessionNumber}/${input.totalSessions} with ${prompt.length} char prompt...`);
  
  const generationModel = process.env.GEMINI_SESSION_MODEL || process.env.GEMINI_GENERATION_MODEL;
  const genText = await generateText(prompt, {
    timeout: Number(process.env.PROGRESSIVE_SESSION_GENERATION_TIMEOUT_MS || 90000),
    retries: 0,
    model: generationModel,
  });
  
  let session: any = parseJsonSafe(genText);
  if (!session) throw new Error(`LLM returned non-JSON session for Session ${input.sessionNumber}`);
  
  console.log(`[PROGRESSIVE_SESSION] Generated Session ${input.sessionNumber} with ${session.drills?.length || 0} drills`);
  
  // Normalize diagram format and apply the SAME deterministic correction
  // pipeline as regular single-session generation (services/session.ts).
  // Previously this path only reshaped the raw diagram fields and applied
  // the coachLevel simplification profile -- it never ran goal-availability
  // enforcement, conditioned-game player-count correction, the player-limit
  // trim, goalkeeper normalization, or the sparse-diagram re-enrichment
  // safety net that single-session generation has relied on. A series
  // session could ship with wrong goal counts or an uncorrected player
  // count in a way a single session never would, purely because it went
  // through this second, drifted copy of the pipeline.
  // Captured from the CONDITIONED_GAME drill's own format correction below,
  // then applied to the session-level summary/coachingNotes afterward --
  // see the matching fix in services/session.ts for why.
  let conditionedGameFormatLabel: string | undefined;
  if (session.drills && Array.isArray(session.drills)) {
    await Promise.all(
      session.drills.map(async (drill: any) => {
        // COOLDOWN has no formation/ball work to draw -- the UI shows the
        // session summary in its place instead.
        if (drill.drillType === "COOLDOWN" && drill.diagram) {
          delete drill.diagram;
          return;
        }
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

        if (drill.drillType === "COOLDOWN") return;

        try {
          if (needsDiagramEnrichment(drill?.diagram, input.coachLevel)) {
            const reenriched = await reenrichDiagramFromDrillJson(drill);
            if (reenriched) {
              drill.diagram = reenriched;
              if (drill.json && typeof drill.json === "object") {
                drill.json.diagram = reenriched;
              }
            }
          }
        } catch (err: any) {
          console.error("[PROGRESSIVE_SESSION] Diagram re-enrichment failed:", err?.message || String(err));
        }

        if (drill.diagram) {
          const formatLabel = enforceConditionedGameFormatDiagram(drill, input);
          if (formatLabel) conditionedGameFormatLabel = formatLabel;
          enforceDiagramPlayerLimit(drill, input.numbersMax);
          enforceDiagramGoalAvailability(drill, input);
          normalizeGoalkeeperPositions(drill.diagram);
          applyCoachLevelDiagramProfile(drill, input.coachLevel);
        }

        try {
          if (needsDescriptionExpansion(drill?.description)) {
            const expanded = await expandDrillDescription(drill, input.coachLevel);
            if (expanded) {
              drill.description = expanded;
              if (drill.json && typeof drill.json === "object") {
                drill.json.description = expanded;
              }
            }
          }
        } catch (err: any) {
          console.error("[PROGRESSIVE_SESSION] Description expansion failed:", err?.message || String(err));
        }
      })
    );
  }

  if (conditionedGameFormatLabel) {
    if (typeof session.summary === "string") {
      session.summary = replaceFormatMentions(session.summary, conditionedGameFormatLabel);
    }
    if (typeof session.coachingNotes === "string") {
      session.coachingNotes = replaceFormatMentions(session.coachingNotes, conditionedGameFormatLabel);
    }
  }

  applyCoachLevelLanguageProfile(session, input.coachLevel);

  // Run QA review - update metrics context
  setMetricsContext({
    operationType: "qa_review",
    ageGroup: input.ageGroup,
    gameModelId: input.gameModelId,
    phase: input.phase,
  });
  
  const qaPrompt = buildSessionQAReviewerPrompt(session);
  console.log(`[PROGRESSIVE_SESSION] Running QA for Session ${input.sessionNumber}...`);
  const qaModel = process.env.GEMINI_QA_MODEL || process.env.GEMINI_FAST_MODEL;
  const qaText = await generateText(qaPrompt, {
    timeout: Number(process.env.PROGRESSIVE_SESSION_QA_TIMEOUT_MS || 30000),
    retries: 0,
    model: qaModel,
    fallbackModel: null,
  });
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
  numberOfSessions: number = 3,
  userId?: string
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

  // USSF_C and USSF_B_PLUS coaches are never paired with BEGINNER players --
  // same rule and same reasoning as single-session generation (see
  // generateAndReviewSession in session.ts). Applied once here, up front,
  // so it covers every session in the series rather than needing to be
  // re-checked per session.
  if (String(baseInput.coachLevel || "").toUpperCase() !== "USSF_D" && String(baseInput.playerLevel || "").toUpperCase() === "BEGINNER") {
    console.warn(
      `[PROGRESSIVE_SERIES] coachLevel=${baseInput.coachLevel} cannot pair with playerLevel=BEGINNER -- bumping to INTERMEDIATE`
    );
    baseInput = { ...baseInput, playerLevel: "INTERMEDIATE" };
  }

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
    
    // Generate unique reference code for series sessions
    const sessionRefCode = await generateRefCode("series");
    
    // Add ref codes to embedded drills in the session JSON and persist as standalone records
    const drillsWithRefCodes = result.session.drills ? await Promise.all(
      result.session.drills.map(async (drill: any) => {
        const drillRefCode = drill.refCode || await generateRefCode("drill");

        // Draw the diagram SVG now, in parallel across every drill in this
        // session, same as regular single-session generation -- previously
        // series sessions shipped with no rendered diagram at all, so the
        // client had nothing to show until it separately fetched one
        // per drill (or, for this path, had no fetch trigger at all).
        let diagramResult: Awaited<ReturnType<typeof generateDrillDiagramSvg>> | null = null;
        if (String(drill.drillType || "").toUpperCase() !== "COOLDOWN") {
          try {
            diagramResult = await generateDrillDiagramSvg({
              title: drill.title || "Drill",
              json: drill,
              drillType: drill.drillType || "TECHNICAL",
              durationMin: drill.durationMin ?? baseInput.durationMin ?? 25,
              rpeMin: drill.rpeMin ?? 5,
              rpeMax: drill.rpeMax ?? 7,
              numbersMin: baseInput.numbersMin,
              numbersMax: baseInput.numbersMax,
            });
            drill.diagramSvg = diagramResult.svg;
          } catch (err: any) {
            console.error(`[PROGRESSIVE] Failed to draw diagram for drill ${drillRefCode}:`, err?.message);
          }
        }

        // Persist drill as standalone record (upsert by refCode)
        try {
          const drillData: any = {
            refCode: drillRefCode,
            title: drill.title || "Untitled Drill",
            gameModelId: baseInput.gameModelId as any,
            phase: baseInput.phase as any,
            zone: baseInput.zone as any,
            ageGroup: baseInput.ageGroup,
            durationMin: drill.durationMin ?? baseInput.durationMin ?? 25,
            drillType: drill.drillType || "TECHNICAL",

            // Map from input or drill JSON
            numbersMin: drill.numbersMin ?? baseInput.numbersMin,
            numbersMax: drill.numbersMax ?? baseInput.numbersMax,
            spaceConstraint: drill.spaceConstraint ?? baseInput.spaceConstraint,
            formationUsed: drill.formationUsed ?? baseInput.formationAttacking,
            playerLevel: baseInput.playerLevel as any,
            coachLevel: baseInput.coachLevel as any,
            principleIds: drill.principleIds || result.session.principleIds || [],
            psychThemeIds: drill.psychThemeIds || result.session.psychThemeIds || [],

            json: omitDiagramSvgFromDrill(drill),
            savedToVault: true,
            ...(diagramResult
              ? {
                  diagramSvg: diagramResult.svg,
                  diagramSvgGeneratedAt: new Date(),
                  diagramSvgModel: diagramResult.model,
                  diagramSvgPromptVersion: diagramResult.promptVersion,
                }
              : {}),
          };

          await prisma.drill.upsert({
            where: { refCode: drillRefCode },
            update: { ...drillData, updatedAt: new Date() },
            create: drillData,
          });
        } catch (err: any) {
          console.error(`[PROGRESSIVE] Failed to save drill ${drillRefCode}:`, err?.message);
          // Continue - don't fail session save if drill save fails
        }

        return {
          ...drill,
          refCode: drillRefCode,
        };
      })
    ) : [];

    // Persist to database
    const jsonForDb = {
      ...result.session,
      drills: drillsWithRefCodes.map((drill: any) => omitDiagramSvgFromDrill(drill)),
      qa: result.qa,
    };

    const created = await prisma.session.create({
      data: {
        refCode: sessionRefCode,
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
        generatedBy: userId || null,
        clubId: (await resolveSessionClubId(userId, String(baseInput.gameModelId))) || undefined,
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
        refCode: sessionRefCode,
        drills: drillsWithRefCodes,
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
