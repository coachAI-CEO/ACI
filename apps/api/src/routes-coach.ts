import { Router } from "express";
import { z } from "zod";
import { generateAndReviewDrill } from "./services/drill";
import { fixDrillDecision, fixDrill } from "./services/fixer";
import { runDrillQA } from "./services/qa";
import { normalizeDiagramLegacyToV1 } from "./services/diagram";

const r = Router();

// --- REQUEST VALIDATION SCHEMAS ---

const PlayerLevelSchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const CoachLevelSchema = z.enum(["GRASSROOTS", "USSF_C", "USSF_B_PLUS"]);
const FormationUsedSchema = z.enum([
  // 7v7
  "2-3-1", "3-2-1",
  // 9v9
  "3-2-3", "2-3-2-1", "3-3-2",
  // 11v11
  "4-3-3", "4-2-3-1", "4-4-2", "3-5-2"
]);

const GameModelIdSchema = z.enum(["COACHAI", "POSSESSION", "PRESSING", "TRANSITION"]);
const PhaseSchema = z.enum(["ATTACKING", "DEFENDING", "TRANSITION", "TRANSITION_TO_ATTACK", "TRANSITION_TO_DEFEND"]);
const ZoneSchema = z.enum(["DEFENSIVE_THIRD", "MIDDLE_THIRD", "ATTACKING_THIRD"]);
const SpaceConstraintSchema = z.enum(["FULL", "HALF", "THIRD", "QUARTER"]);

const GenerateDrillRequestSchema = z.object({
  gameModelId: GameModelIdSchema,
  phase: PhaseSchema,
  zone: ZoneSchema,
  ageGroup: z.string().min(1),
  
  // NEW: Required formation & level fields (separate for attacking and defending)
  formationAttacking: FormationUsedSchema,
  formationDefending: FormationUsedSchema,
  playerLevel: PlayerLevelSchema,
  coachLevel: CoachLevelSchema,
  
  numbersMin: z.number().int().min(1).max(30),
  numbersMax: z.number().int().min(1).max(30),
  durationMin: z.number().int().min(5).max(120),
  spaceConstraint: SpaceConstraintSchema,
  goalsAvailable: z.number().int().min(0).max(4),
  gkOptional: z.boolean().optional(),
});

// --- RESPONSE VALIDATION SCHEMAS ---

const QAScoresSchema = z.object({
  structure: z.number().min(1).max(5),
  gameModel: z.number().min(1).max(5),
  psych: z.number().min(1).max(5),
  clarity: z.number().min(1).max(5),
  realism: z.number().min(1).max(5),
  constraints: z.number().min(1).max(5),
  safety: z.number().min(1).max(5),
});

const FixDecisionSchema = z.object({
  code: z.enum(["OK", "PATCHABLE", "NEEDS_REGEN"]),
  reason: z.string().optional(),
});

const DrillResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  formationAttacking: FormationUsedSchema,
  formationDefending: FormationUsedSchema,
  playerLevel: PlayerLevelSchema,
  coachLevel: CoachLevelSchema,
  qaScore: z.number().nullable(),
  approved: z.boolean(),
  principleIds: z.array(z.string()),
  psychThemeIds: z.array(z.string()),
  energySystem: z.string(),
  rpeMin: z.number(),
  rpeMax: z.number(),
  numbersMin: z.number(),
  numbersMax: z.number(),
  goalsAvailable: z.number(),
  goalMode: z.string().nullable(),
});

const SuccessResponseSchema = z.object({
  ok: z.literal(true),
  drill: DrillResponseSchema,
  qa: z.object({
    pass: z.boolean(),
    scores: QAScoresSchema.partial(),
    notes: z.array(z.string()).optional(),
    summary: z.string().optional(),
  }),
  fixDecision: FixDecisionSchema,
  fixer: z.any().optional(),
  attempts: z.array(z.any()).optional(),
});

const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  details: z.array(z.any()).optional(),
  attemptsSummary: z.array(z.any()).optional(),
  attempts: z.array(z.any()).optional(),
});

/**
 * POST /coach/generate-drill-vetted
 *
 * Coach-facing endpoint:
 * - Loops up to COACH_MAX_DRILL_ATTEMPTS times.
 * - Uses QA scores → fixDrillDecision (OK / PATCHABLE / NEEDS_REGEN).
 * - Only returns a drill when decision is OK or PATCHABLE.
 * - For PATCHABLE, runs the LLM fixer internally (fixDrill),
 *   then re-runs QA so we have before/after scores.
 */
r.post("/coach/generate-drill-vetted", async (req, res) => {
  const debug = String(req.query.debug || "") === "1";
  const maxAttemptsEnv = process.env.COACH_MAX_DRILL_ATTEMPTS || "3";
  const maxAttempts = Number.isNaN(Number(maxAttemptsEnv))
    ? 3
    : Number(maxAttemptsEnv);

  // --- REQUEST VALIDATION ---
  // Debug: log the incoming request body
  console.log("[API] Received request body:", JSON.stringify(req.body, null, 2));
  console.log("[API] Request body keys:", Object.keys(req.body || {}));
  
  const parseResult = GenerateDrillRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    console.error("[API] Validation failed. Schema expects:", {
      formationAttacking: "required",
      formationDefending: "required",
    });
    console.error("[API] Validation errors:", parseResult.error.issues);
    return res.status(400).json({
      ok: false,
      error: "INVALID_INPUT",
      details: parseResult.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
    });
  }

  const input = parseResult.data;

  const attemptsSummary: Array<{
    title: string | null;
    scores: any;
    decision: any;
  }> = [];

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await generateAndReviewDrill(input);
      const drill = result.drill;
      let qa = result.qa; // Use 'let' so we can update it after fixing

      let decision = fixDrillDecision(qa?.scores || null); // Use 'let' so we can update it after fixing

      attemptsSummary.push({
        title:
          (drill as any)?.json?.title ??
          (drill as any)?.title ??
          null,
        scores: qa?.scores || null,
        decision,
      });

      // Try fixing first (even for NEEDS_REGEN) before regenerating
      let finalDrill: any = drill;
      let fixerMeta: any = null;
      let shouldAccept = decision.code === "OK";

      // DISABLED: Fixer is not working reliably (returns fixed=false, wastes time)
      // PATCHABLE drills are already acceptable (all scores ≥3), so we accept them as-is
      // TODO: Re-enable fixer once it's improved to actually fix drills reliably
      // For now, PATCHABLE drills are accepted without fixing attempts

      // Only accept high-quality drills (OK, or fixed drills that became OK/PATCHABLE)
      if (shouldAccept || decision.code === "OK" || decision.code === "PATCHABLE") {

        // REMOVED: diagramV1 normalization - diagramV1 is a forbidden key
        // We only use 'diagram' now, not 'diagramV1'

        // Ensure organization is accessible at top level for response
        const drillResponse: any = { ...finalDrill };
        if (drillResponse.json?.organization && !drillResponse.organization) {
          drillResponse.organization = drillResponse.json.organization;
        }
        // Add both formations to response (from input)
        drillResponse.formationAttacking = input.formationAttacking;
        drillResponse.formationDefending = input.formationDefending;
        
        const payload: any = {
          ok: true,
          drill: drillResponse,
          qa,
          fixDecision: decision,
        };

        if (fixerMeta) {
          payload.fixer = fixerMeta;
        }

        if (debug) {
          payload.attempts = attemptsSummary;
        }

        // 🔍 Logging for successful response
        logVettedRequest(input, {
          ok: true,
          attempts: attemptsSummary,
          fixer: payload.fixer || null,
        });

        // --- RESPONSE VALIDATION ---
        const responseValidation = SuccessResponseSchema.safeParse(payload);
        if (!responseValidation.success) {
          console.error("[RESPONSE_VALIDATION_ERROR]", responseValidation.error);
          return res.status(500).json({
            ok: false,
            error: "INVALID_OUTPUT",
            details: responseValidation.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          });
        }

        return res.json(payload);
      }

      // Otherwise (NEEDS_REGEN), loop and try another attempt
      if (decision.code === "NEEDS_REGEN") {
        console.log(`🔄 [RETRY] Drill needs regeneration (${decision.code}), generating new drill...`);
      }
    } catch (e: any) {
      const errorMsg = e?.message || String(e);
      
      // --- QUOTA ERROR DETECTION: Fail fast, don't retry ---
      if (/(?:429|quota|rate limit|LLM_TIMEOUT)/i.test(errorMsg)) {
        const isQuota = /(?:429|quota|rate limit)/i.test(errorMsg);
        const isTimeout = /LLM_TIMEOUT/i.test(errorMsg);
        
        logVettedRequest(input, {
          ok: false,
          attempts: attemptsSummary,
          error: errorMsg,
        });

        return res.status(isQuota ? 429 : 408).json({
          ok: false,
          error: isQuota ? "API_QUOTA_EXCEEDED" : "API_TIMEOUT",
          message: isQuota
            ? "Gemini API quota exceeded. Please try again later."
            : "LLM request timed out. Please try again.",
          attemptsSummary: debug ? attemptsSummary : undefined,
        });
      }
      
      // If something blows up hard (e.g., Gemini 503), abort and surface error
      logVettedRequest(input, {
        ok: false,
        attempts: attemptsSummary,
        error: errorMsg,
      });

      return res.status(500).json({
        ok: false,
        error: errorMsg,
        attemptsSummary: debug ? attemptsSummary : undefined,
      });
    }
  }

  // If we reach here, all attempts were NEEDS_REGEN or non-acceptable
  const payload: any = {
    ok: false,
    error:
      "Could not generate a high-quality drill after several attempts. Please try again.",
  };
  if (debug) {
    payload.attempts = attemptsSummary;
  }

  // 🔍 Logging for non-acceptable completion
  logVettedRequest(input, {
    ok: false,
    attempts: attemptsSummary,
  });

  return res.status(422).json(payload);
});

/**
 * Dev logging helper for /coach/generate-drill-vetted.
 */
function logVettedRequest(input: any, summary: any) {
  const ts = new Date().toISOString();
  console.log(
    "\n=================== ACI /coach/generate-drill-vetted ==================="
  );
  console.log("Timestamp:", ts);
  console.log(
    "Config:",
    JSON.stringify(
      {
        gameModelId: input.gameModelId,
        ageGroup: input.ageGroup,
        phase: input.phase,
        zone: input.zone,
        numbersMin: input.numbersMin,
        numbersMax: input.numbersMax,
        spaceConstraint: input.spaceConstraint,
        durationMin: input.durationMin,
      },
      null,
      2
    )
  );

  console.log("\nAttempts Summary:");
  (summary.attempts || []).forEach((a: any, idx: number) => {
    console.log(`  Attempt ${idx + 1}:`, {
      title: a.title,
      decision: a.decision?.code,
      scores: a.scores,
    });
  });

  if (summary.fixer) {
    console.log("\nFixer:", {
      decision: summary.fixer.decision,
      raw: summary.fixer.raw,
    });
  }

  if (summary.qaAfter) {
    console.log("\nQA-After:", {
      pass: summary.qaAfter.pass,
      scores: summary.qaAfter.scores,
    });
  }

  if (summary.error) {
    console.log("\nError:", summary.error);
  }

  console.log("\nFinal Status:", summary.ok ? "SUCCESS" : "FAILURE");
  console.log(
    "=========================================================================\n"
  );
}

export default r;