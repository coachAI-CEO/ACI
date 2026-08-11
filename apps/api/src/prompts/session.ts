import { FIELD_SPECS, type FieldFormat as RealFieldFormat } from "../data/field-dimensions";

export type ClubPhilosophyPromptInput = {
  attackingOrganization?: string | null;
  defensiveTransition?: string | null;
  defensiveOrganization?: string | null;
  attackingTransition?: string | null;
};

export interface SessionPromptInput {
  gameModelId: string;
  ageGroup: string;
  phase?: string;
  zone?: string;
  numbersMin: number;
  numbersMax: number;
  goalsAvailable: number;
  spaceConstraint: string;
  durationMin: number; // 60 or 90 minutes
  
  formationAttacking: string;
  formationDefending: string;
  playerLevel: string;
  coachLevel: string;
  
  // Optional: specific drill types to include
  focus?: string; // e.g., "technical", "tactical", "match_preparation"

  // Optional: the specific tactical subject selected for this session (e.g.
  // "Rest Defense Setup"). See TOPIC LOCK in buildSessionPrompt.
  topic?: string;

  /** Club-authored 4-moment DNA from DOC Hub; preferred over hardcoded model profiles. */
  clubPhilosophy?: ClubPhilosophyPromptInput | null;
}

export type GameFormat = "7v7" | "9v9" | "11v11";

export function getGameFormatForAgeGroup(ageGroup: string): GameFormat {
  const age = Number(String(ageGroup || "").replace(/^U/i, ""));
  if (age >= 8 && age <= 10) return "7v7";
  if (age >= 11 && age <= 12) return "9v9";
  return "11v11";
}

export function getPlayersPerTeamForFormat(format: GameFormat): number {
  if (format === "7v7") return 7;
  if (format === "9v9") return 9;
  return 11;
}

/**
 * Concrete yard dimensions per spaceConstraint, derived from the real field
 * size for this age group's format (same FIELD_SPECS the diagram pipeline
 * uses) rather than a fixed guess -- "half pitch" for an 11v11-age group is
 * a very different size than "half pitch" for a 7v7-age group. "Half"
 * splits the length (goal-to-goal) in two, keeping full width, which is how
 * a real half-field session is actually marked out.
 */
function getSpaceConstraintDimensions(gameFormat: GameFormat, spaceConstraint: string) {
  const spec = FIELD_SPECS[gameFormat.toUpperCase() as RealFieldFormat];
  const full = { lengthYards: spec.lengthYards, widthYards: spec.widthYards };
  const half = { lengthYards: Math.round(spec.lengthYards / 2), widthYards: spec.widthYards };
  const third = { lengthYards: Math.round(spec.lengthYards / 3), widthYards: spec.widthYards };
  const quarter = { lengthYards: Math.round(spec.lengthYards / 4), widthYards: spec.widthYards };
  const key = String(spaceConstraint || "FULL").toUpperCase();
  const dims = key === "HALF" ? half : key === "THIRD" ? third : key === "QUARTER" ? quarter : full;
  return { ...dims, label: `${dims.lengthYards}x${dims.widthYards} yards`, full, half, third, quarter };
}

function clubPhilosophyGuidance(
  philosophy: ClubPhilosophyPromptInput,
  gameModelId: string,
  common: string[]
): string {
  const lines = [
    ...common,
    "CLUB PHILOSOPHY PROFILE (DOC-authored — MANDATORY):",
    `- gameModelId=${gameModelId} is the club's locked model; every drill must reflect the stages below.`,
  ];
  if (philosophy.attackingOrganization) {
    lines.push(
      "Stage 1 — Attacking Organization (in possession):",
      philosophy.attackingOrganization
    );
  }
  if (philosophy.defensiveTransition) {
    lines.push(
      "Stage 2 — Defensive Transition (on ball loss):",
      philosophy.defensiveTransition
    );
  }
  if (philosophy.defensiveOrganization) {
    lines.push(
      "Stage 3 — Defensive Organization (out of possession):",
      philosophy.defensiveOrganization
    );
  }
  if (philosophy.attackingTransition) {
    lines.push(
      "Stage 4 — Attacking Transition (on ball regain):",
      philosophy.attackingTransition
    );
  }
  lines.push(
    "- CONDITIONED_GAME must explicitly test the same club philosophy decisions trained earlier.",
    "- Do not invent a conflicting club identity; stay inside these four stages."
  );
  return lines.join("\n");
}

function philosophyHasContent(philosophy?: ClubPhilosophyPromptInput | null): boolean {
  if (!philosophy) return false;
  return Boolean(
    philosophy.attackingOrganization ||
      philosophy.defensiveTransition ||
      philosophy.defensiveOrganization ||
      philosophy.attackingTransition
  );
}

function getSessionGameModelGuidance(
  gameModelId: string,
  phase?: string,
  zone?: string,
  clubPhilosophy?: ClubPhilosophyPromptInput | null
): string {
  const p = phase || "ATTACKING";
  const z = zone || "ATTACKING_THIRD";
  const common = [
    "MODEL-LOCK RULES (MANDATORY):",
    `- gameModelId=${gameModelId} must shape every drill, not just the tactical drill title.`,
    `- phase=${p} and zone=${z} must appear in setup, constraints, and coaching language.`,
    "- Across the session, include at least 8 model-specific cues (coaching points + constraints + progressions).",
    "- CONDITIONED_GAME must explicitly test the same game model decisions trained earlier.",
  ];

  // Prefer live DOC-authored Club DNA when present (any club, including Rocklin).
  if (philosophyHasContent(clubPhilosophy)) {
    return clubPhilosophyGuidance(clubPhilosophy!, gameModelId, common);
  }

  if (gameModelId === "POSSESSION") {
    return [
      ...common,
      "POSSESSION PROFILE:",
      "- Session theme: ball security + positional support + line-breaking options.",
      "- WARMUP/TECHNICAL should build receiving shape and support angles.",
      "- TACTICAL/CONDITIONED_GAME should reward circulation, overloads, and switch timing.",
      "- Avoid transition-chaos as the dominant pattern.",
    ].join("\n");
  }

  if (gameModelId === "PRESSING") {
    return [
      ...common,
      "PRESSING PROFILE:",
      "- Session theme: coordinated regains via triggers, compactness, and pressing angles.",
      "- WARMUP/TECHNICAL should prime press footwork/approach and lock-side behavior.",
      "- TACTICAL/CONDITIONED_GAME should reward regains in target zones/time windows.",
      "- Avoid passive block or pure-possession themes as the dominant pattern.",
    ].join("\n");
  }

  if (gameModelId === "TRANSITION") {
    return [
      ...common,
      "TRANSITION PROFILE:",
      "- Session theme: first action after regain/loss in 3-6 second windows.",
      "- WARMUP/TECHNICAL should build first touch + first pass speed under pressure.",
      "- TACTICAL/CONDITIONED_GAME should reward quick attack after regain and immediate counterpress after loss.",
      "- Avoid long settled phases as the core objective.",
    ].join("\n");
  }

  // Fallback only when Club.philosophy* rows are still empty (pre-DOC save).
  if (gameModelId === "ROCKLIN_FC") {
    return [
      ...common,
      "ROCKLIN_FC PROFILE:",
      "- Session theme: proactive, vertical-possession football with immediate regain intent.",
      "- In possession: create width/depth and support angles; progress with pass-or-dribble line breaks; switch when pressure locks one side.",
      "- Final-third intent: attack with intensity (runs behind, overloads, 1v1/2v1 actions, through balls/crosses, quick finishing decisions).",
      "- On loss (ATT->DEF): immediate 3-5 second counterpress; if not won, recover to compact block.",
      "- Out of possession: coordinated pressure-cover-balance, deny central progression, protect in behind, force predictable play.",
      "- On regain (DEF->ATT): first action forward if on; if not, secure ball and expand shape before next penetration.",
      "- CONDITIONED_GAME should test both transitions: fast counter on regain + immediate reaction on loss.",
      "- Avoid passive low-block as default and avoid sterile circulation without penetration intent.",
    ].join("\n");
  }

  return [
    ...common,
    "COACHAI PROFILE:",
    "- Session theme: balanced moments (possession, pressing, transition) with clear switching cues.",
    "- Each main drill must include at least one cue from each moment type.",
    "- CONDITIONED_GAME should test when to keep, when to press, and when to attack fast.",
  ].join("\n");
}

function getSessionPhaseGuidance(phase?: string, zone?: string): string {
  const p = phase || "ATTACKING";
  const z = zone || "ATTACKING_THIRD";
  const common = [
    `PHASE LOCK RULES (MANDATORY): phase=${p}, zone=${z}`,
    "- Every non-COOLDOWN drill should include at least one phase-specific coaching cue.",
    "- At least two drills must include explicit phase-specific constraints.",
  ];

  if (p === "ATTACKING") {
    return [
      ...common,
      "ATTACKING PROFILE:",
      "- Session should build from secure progression to chance creation and finishing quality.",
      "- Include width/depth support and final-third timing cues.",
    ].join("\n");
  }
  if (p === "DEFENDING") {
    return [
      ...common,
      "DEFENDING PROFILE:",
      "- Session should build pressing/containment structure, compactness, and deny-space priorities.",
      "- Include pressure-cover-balance and line-distance cues.",
    ].join("\n");
  }
  if (p === "TRANSITION_TO_ATTACK") {
    return [
      ...common,
      "TRANSITION_TO_ATTACK PROFILE:",
      "- Session should emphasize first action quality after regain in 0-6 second windows.",
      "- Include immediate support-run and forward-pass decisions.",
    ].join("\n");
  }
  if (p === "TRANSITION_TO_DEFEND") {
    return [
      ...common,
      "TRANSITION_TO_DEFEND PROFILE:",
      "- Session should emphasize immediate reaction after loss: counterpress or recover shape.",
      "- Include nearest-player pressure and second-line recovery decisions.",
    ].join("\n");
  }
  return [
    ...common,
    "TRANSITION PROFILE:",
    "- Session should include both regain-to-attack and loss-to-defend cycles.",
    "- Include role-switch decision speed and communication cues.",
  ].join("\n");
}

/**
 * Build session prompt - generates a full practice session with multiple drills
 */
export function buildSessionPrompt(input: SessionPromptInput): string {
  const ctx = JSON.stringify(input, null, 2);
  const gameModelGuidance = getSessionGameModelGuidance(
    input.gameModelId,
    input.phase,
    input.zone,
    input.clubPhilosophy
  );
  const phaseGuidance = getSessionPhaseGuidance(input.phase, input.zone);
  const isUssfD = input.coachLevel === "USSF_D";
  const isUssfC = input.coachLevel === "USSF_C";
  const isUssfBPlus = input.coachLevel === "USSF_B_PLUS";
  const isBeginner = input.playerLevel === "BEGINNER";
  const isIntermediate = input.playerLevel === "INTERMEDIATE";
  const isAdvanced = input.playerLevel === "ADVANCED";
  const diagramDetailLabel = isUssfD ? "SIMPLE" : "FULL";
  const arrowRange = isUssfD ? "2-4" : isUssfBPlus ? "7-10" : "5-7";
  const annotationRange = isUssfD ? "1-2" : isUssfBPlus ? "4-6" : "3-4";
  const safeZoneRange = isUssfD ? "0-1" : isUssfBPlus ? "2-3" : "1-2";
  const gameFormat = getGameFormatForAgeGroup(input.ageGroup);
  const playersPerTeam = getPlayersPerTeamForFormat(gameFormat);
  const fullGamePlayerTotal = playersPerTeam * 2;
  const requestedMaxPlayers = Number(input.numbersMax || 0);
  const canRunFullGameFormat = requestedMaxPlayers >= fullGamePlayerTotal;
  const activeGameLabel = canRunFullGameFormat
    ? gameFormat
    : `${Math.max(2, Math.floor(requestedMaxPlayers / 2))}v${Math.max(2, Math.floor(requestedMaxPlayers / 2))} conditioned game`;
  const spaceDims = getSpaceConstraintDimensions(gameFormat, input.spaceConstraint);
  const sessionDuration = input.durationMin || 90;
  const is60Min = sessionDuration === 60;
  
  // Calculate drill durations based on session length
  const warmupDuration = is60Min ? "10" : "15";
  const technicalDuration = is60Min ? "15" : "20";
  const tacticalDuration = is60Min ? "20" : "25";
  const conditionedGameDuration = is60Min ? "12" : "25";
  const cooldownDuration = is60Min ? "3" : "5";
  
  return [
    "SYSTEM: Output ONE JSON object matching the structure below for a complete training session.",
    "A session is a full practice (60 or 90 minutes) containing multiple drills organized by type.",
    `DIAGRAM DETAIL PROFILE: ${diagramDetailLabel} (coachLevel=${input.coachLevel}).`,
    isUssfD
      ? "- For USSF_D, diagrams must be simple and coach-friendly: no pitch zone overlays, fewer arrows, fewer annotations, and optional safe zones."
      : "- For USSF_C and USSF_B_PLUS, use full tactical diagram detail with richer movement, annotations, and safe-zone context.",
    ...(isUssfC
      ? ["- USSF_C diagrams must show tactical cues clearly: 5-7 arrows, 3-4 annotations, and 1-2 safe zones."]
      : []),
    ...(isUssfBPlus
      ? ["- USSF_B_PLUS diagrams must be the richest view: 7-10 arrows, 4-6 annotations, and 2-3 safe zones with advanced tactical labels."]
      : []),
    "COACH LANGUAGE PROFILE (MANDATORY -- THREE DISTINCT LEVELS, NOT TWO. USSF_C and USSF_B_PLUS must read as different from EACH OTHER, not just both different from USSF_D):",
    isUssfD
      ? "- USSF_D: use clear, practical language that a D-license coach can run immediately. Keep terms simple and direct."
      : isUssfC
      ? "- USSF_C: solid, grounded tactical vocabulary -- name ONE concept at a time (pressing trigger, supporting angle, switch of play, third-man pass) and explain it in the same sentence or the next one. A C-license coach knows these terms individually but doesn't yet chain several together fluently."
      : "- USSF_B_PLUS: fluent, interconnected tactical language -- combine multiple concepts in a single idea the way an experienced coach actually talks (e.g. 'use rest-defense shape to cover the counter while the far winger occupies the last line to stretch their block'), reference how phases interact (build-up shaping the press, press triggering the transition), and assume the coach doesn't need each term individually defined.",
    isUssfD
      ? "- BANNED WORDS for USSF_D: never write 'overload', 'numerical superiority', 'half-space', 'half-turn', 'third-man run/combination', 'line-breaking pass', 'defensive block', 'mid-block', 'low-block', 'rest defense', 'unmarking movement', 'positional shape', 'positional play', 'pressing trigger', 'switch the point of attack', 'compact', or 'staggered' -- and nothing that sounds like a coaching-license textbook term in general. Each time you would reach for one of those, write an ORDINARY SENTENCE describing the same idea in your own words instead (e.g. instead of 'positional shape', write something like 'make sure players are spread out where they can help each other' -- a full, natural sentence, NOT a fixed replacement phrase copy-pasted in). The banned words above are examples to avoid, not a find-and-replace table -- do not literally paste in any fixed substitute phrase either; write it fresh, in context, in whatever words fit that specific sentence."
      : isUssfC
      ? "- USSF_C vocabulary ceiling: stick to well-known, individually-taught concepts (pressing triggers, support angles, switching play, third-man passes, basic pressing/possession shape). Avoid B+-tier layered/systemic language: do NOT write 'rest defense', 'cover shadow', 'blindside run', or sentences that fuse 2+ tactical ideas into one clause -- that reads as B+, not C."
      : "- USSF_B_PLUS vocabulary floor: go beyond C's individual-concept vocabulary into named systemic patterns -- 'rest defense', 'cover shadow', 'blindside runs', 'game-model interactions across phases' (how build-up shape sets up the press, how the counterpress relates to rest defense). If a B+ session could be mistaken for a C session, it isn't advanced enough -- add a layered concept, not just a longer sentence.",
    isUssfD
      ? "- USSF D quality target: same detail level and structure, but simpler words and more direct action cues."
      : isUssfC
      ? "- USSF_C quality target: clear, grounded, one tactical idea at a time -- a coach with real but developing tactical background."
      : "- USSF_B_PLUS quality target: dense, fluent, systemic -- a coach who talks in connected tactical patterns, not a vocabulary list.",
    "PLAYER LEVEL DIFFICULTY LOCK (MANDATORY, INDEPENDENT OF COACH LEVEL):",
    "- coachLevel controls VOCABULARY (how it's written). playerLevel controls DIFFICULTY (what's actually demanded of the players). These are two separate dials -- an advanced coachLevel (USSF_C/USSF_B_PLUS) does NOT mean advanced constraints. A USSF_B_PLUS coach can run a session for BEGINNER players; when that happens, keep the tactical vocabulary but the constraints/touch limits/decision load MUST still match BEGINNER, not the coach's license level.",
    `- playerLevel=${input.playerLevel} for THIS session.`,
    isBeginner
      ? "- BEGINNER: unlimited or generous touches (avoid 1-2 touch restrictions), forgiving space, few simultaneous decisions, one clear read per rep. Do not impose 1-touch, 2-touch, or 'strictly N touches' constraints -- beginners need time on the ball to succeed."
      : isIntermediate
      ? "- INTERMEDIATE: moderate constraints are fine (e.g. 2-3 touch limits), some combined decisions (scan + pass under light pressure), but avoid stacking more than one advanced constraint at once."
      : "- ADVANCED: tight constraints are expected and desirable (1-2 touch limits, tight time/space, multiple simultaneous reads, game-realistic pressure) -- do not water these down.",
    isBeginner
      ? "- Coaching points and constraints must describe simple, concrete actions (e.g. 'pass to your open teammate') even when the surrounding language is USSF_C/USSF_B_PLUS-level tactical vocabulary."
      : "- Coaching points and constraints may assume the players can execute complex, multi-step instructions.",
    ...(isBeginner
      ? [
          "- BANNED CONSTRAINTS for BEGINNER (never write these, regardless of coachLevel -- this applies even in a USSF_B_PLUS session, where the surrounding language is advanced but the DEMANDS still must not be): '1-touch', 'one-touch', '2-touch', 'two-touch', 'maximum N touches', 'strictly N touches', any touch limit below 3; multi-zone tactical structures ('three longitudinal channels', 'organized defensive block', named formations like '3-2-3 attacking shape' as a constraint to execute); timed technical windows ('45-second intervals', 'designated windows'); anything requiring players to track more than one instruction at once.",
          "- This rule OVERRIDES coachLevel every time they'd conflict. A USSF_B_PLUS + BEGINNER session should read like an advanced coach's vocabulary describing a beginner-simple activity -- e.g. 'Encourage open body shape to receive (USSF_B_PLUS framing), players may take as many touches as they need to keep control (BEGINNER demand)' -- NOT a genuinely advanced drill with fancy words.",
        ]
      : []),
    "AGE/GAME FORMAT LOCK (MANDATORY):",
    `- ageGroup=${input.ageGroup} uses ${gameFormat}.`,
    "- U8-U10 must be 7v7, U11-U12 must be 9v9, U13-U18 must be 11v11.",
    `- The selected active player range is ${input.numbersMin}-${input.numbersMax}; every drill diagram.players length MUST stay inside that range.`,
    canRunFullGameFormat
      ? `- If a CONDITIONED_GAME is titled or organized as ${gameFormat}, diagram.players MUST contain exactly ${fullGamePlayerTotal} players: ${playersPerTeam} ATT and ${playersPerTeam} DEF, including one GK on each team.`
      : `- Do NOT title or organize any drill as full ${gameFormat}; ${gameFormat} would require ${fullGamePlayerTotal} players, above numbersMax=${input.numbersMax}. Use reduced ${gameFormat} roles within ${input.numbersMax} active players instead.`,
    canRunFullGameFormat
      ? `- Do NOT label a drill ${gameFormat} unless the diagram has the matching ${playersPerTeam}v${playersPerTeam} player count.`
      : `- Reduced games may use smaller active formats such as ${activeGameLabel}; describe them as reduced games using ${gameFormat} roles, not as full ${gameFormat}.`,
    "- Do not mix format labels and player counts: if text says 7v7/9v9/11v11, diagram.players must match that active count exactly.",
    "GOAL AVAILABILITY LOCK (MANDATORY):",
    `- goalsAvailable=${input.goalsAvailable}.`,
    "- goalsAvailable counts FULL-SIZE goals with a GK specifically. If goalsAvailable=0, the coach has NO full-size goal -- do not add a 'BIG' type goal or a GK-defended goal on any drill. Mini-goals/gates ARE still allowed and commonly used as scoring targets (especially for TACTICAL and CONDITIONED_GAME) -- do not write 'full-size goal', 'GK', or 'goalkeeper' language for this session.",
    "- If goalsAvailable=1, use exactly one full-size goal with one GK. The opposite end must use two mini-goals or gates and must NOT have a GK.",
    "- If goalsAvailable=1, do not write 'full-size goals', 'two goals with GKs', or 'game flows through GKs'. Use 'one GK' and 'mini-goal restarts' language.",
    "- If goalsAvailable>=2, two full goals/GKs are allowed only when the setup explicitly needs them.",
    "",
    "SPACE CONSTRAINT LOCK (MANDATORY -- this is the actual amount of field the coach has, not a suggestion):",
    `- spaceConstraint=${input.spaceConstraint} for THIS session. The real field for ${gameFormat} (this ageGroup) is ${spaceDims.full.lengthYards}x${spaceDims.full.widthYards} yards. ${input.spaceConstraint === "FULL" ? "The coach has the full field available." : `The coach only has ${spaceDims.label} available -- ${input.spaceConstraint} of the full field, splitting the length and keeping full width.`}`,
    `- EVERY drill's organization.area (lengthYards x widthYards) MUST fit within ${spaceDims.label}, no exceptions -- not just WARMUP/TECHNICAL, but TACTICAL and CONDITIONED_GAME too. A coach who selected ${input.spaceConstraint} does not suddenly have more field for the bigger drills.`,
    "- Do not default to 'half field' or 'full field' language in setupSteps/description regardless of what sounds more realistic -- use the actual constraint above. If organization.area exceeds the limit, the session is INVALID.",
    "",
    "🚨 DIAGRAM REQUIREMENT (the single most-violated rule -- read carefully, this is stated ONCE and not repeated):",
    "- EVERY drill except COOLDOWN MUST have diagram.players as a POPULATED array (never []) with ONE object per player named in organization.setupSteps -- e.g. 'setupSteps: 4 attackers, 2 defenders' means diagram.players MUST have exactly 6 objects, each {id, number, team: 'ATT'|'DEF'|'NEUTRAL', role, x, y, facingAngle}.",
    "- Also required per drill: diagram.pitch {variant, orientation:'HORIZONTAL', showZones:false}, diagram.arrows (" + arrowRange + " entries, each {id, from:{x,y}, to:{x,y}, type}), diagram.annotations (" + annotationRange + " entries, each {id, text, x, y, fontSize, color, fontWeight}), diagram.safeZones (" + safeZoneRange + " entries), diagram.goals (per GOAL AVAILABILITY LOCK above).",
    "- Position players per formation=" + input.formationAttacking + " (ATT) and " + input.formationDefending + " (DEF). An empty or missing diagram.players array on any non-COOLDOWN drill makes the whole session INVALID.",
    "- DIRECTION LOCK: the pitch is ALWAYS horizontal (diagram.pitch.orientation='HORIZONTAL', never vertical). DEF's own goal is on the RIGHT edge (x→100) and DEF defends it; ATT attacks TOWARD that SAME right edge (x→100) since ATT is attacking DEF's goal, not the opposite end. ATT's own deep/start position is toward the left (x→0). This never flips, for any drill.",
    "",
    "Diagrams REQUIRED for: WARMUP, TECHNICAL, TACTICAL, CONDITIONED_GAME",
    "Diagrams OPTIONAL for: COOLDOWN only",
    "",
    "Hard rules:",
    "- drills array MUST contain 4-5 drills: WARMUP, TECHNICAL, TACTICAL, CONDITIONED_GAME, and optionally COOLDOWN",
    "- Each drill MUST follow the same structure as individual drill generation",
    "- ⚠️ Each drill (except COOLDOWN) MUST include a complete 'diagram' field with pitch (showZones:false), players, goals, arrows, annotations, and safeZones",
    "- Total duration of all drills should approximately equal session duration (" + sessionDuration + " minutes)",
    "- Use 'diagram' (NOT 'diagramV1') for each drill",
    "- Use 'progressions' array (NOT 'progression') for each drill",
    "- Every non-COOLDOWN drill MUST include constraints array with 2-5 non-empty, model-specific rules.",
    "- Do NOT wrap JSON in markdown or add comments.",
    "",
    "INPUT:", ctx,
    "",
    "⚠️ GAME MODEL LOCK:",
    gameModelGuidance,
    "",
    "⚠️ PHASE LOCK:",
    phaseGuidance,
    "",
    ...(input.topic
      ? [
          "⚠️ TOPIC LOCK (MANDATORY):",
          `- topic="${input.topic}" is the specific subject this session is built around. The TACTICAL drill's title, description, and coachingNotes MUST explicitly center on this topic (name it or its direct meaning in the title/description, not just a loosely related theme) -- and the WARMUP/TECHNICAL drills should build toward it where realistic. The session-level title/summary should also reflect it, not just the broader gameModelId.`,
          `- Teach topic="${input.topic}" through the lens of gameModelId=${input.gameModelId} -- the game model is HOW this club plays, the topic is WHAT is being taught today; connect them (e.g. explain the topic as this team's way of expressing that game model), don't treat them as unrelated instructions.`,
          isUssfD
            ? `- Explain topic="${input.topic}" the USSF_D way: in plain, concrete language per the COACH LANGUAGE PROFILE above -- do not introduce it by name if the name itself is jargon; describe the idea in ordinary words.`
            : isUssfC
            ? `- Explain topic="${input.topic}" the USSF_C way: name it plainly and explain the single concept behind it in the same or next sentence, per the COACH LANGUAGE PROFILE above.`
            : `- Explain topic="${input.topic}" the USSF_B_PLUS way: assume the coach already knows the term, and connect it to how it interacts with the surrounding phase/game-model, per the COACH LANGUAGE PROFILE above.`,
          "",
        ]
      : []),
    "SESSION STRUCTURE FOR " + sessionDuration + "-MINUTE SESSION:",
    "",
    "1. WARMUP (" + warmupDuration + " minutes):",
    "   - Purpose: Activation, technical touches, low intensity",
    "   - Duration: " + warmupDuration + " minutes",
    "   - RPE: 3-5",
    "   - Focus: High touches, movement patterns, ball work",
    `   - Space: up to ~${Math.min(spaceDims.quarter.lengthYards, spaceDims.lengthYards)}x${spaceDims.widthYards} yards (small -- never more than the SPACE CONSTRAINT LOCK ceiling above)`,
    "   - Examples: Rondos, passing patterns, dynamic movements with ball",
    "",
    "2. TECHNICAL (" + technicalDuration + " minutes):",
    "   - Purpose: Skill development, repetition, muscle memory",
    "   - Duration: " + technicalDuration + " minutes",
    "   - RPE: 4-6",
    "   - Focus: Specific technique (passing, shooting, first touch, dribbling)",
    `   - Space: up to ~${Math.min(spaceDims.third.lengthYards, spaceDims.lengthYards)}x${spaceDims.widthYards} yards (never more than the SPACE CONSTRAINT LOCK ceiling above)`,
    "   - Examples: Finishing drills, passing accuracy, first touch exercises",
    "",
    "3. TACTICAL (" + tacticalDuration + " minutes):",
    "   - Purpose: Game understanding, decision-making, patterns of play",
    "   - Duration: " + tacticalDuration + " minutes",
    "   - RPE: 5-7",
    "   - Focus: Tactical concepts aligned with gameModelId=" + input.gameModelId + ", phase=" + (input.phase || "ATTACKING") + ", zone=" + (input.zone || "ATTACKING_THIRD"),
    `   - Space: up to ${spaceDims.label} (the FULL amount available under spaceConstraint=${input.spaceConstraint} -- do NOT use more, even if a bigger area would suit the concept better)`,
    "   - Examples: Positional play, build-up patterns, pressing triggers",
    "",
    "4. CONDITIONED_GAME (" + conditionedGameDuration + " minutes):",
    "   - Purpose: Apply skills in game context with constraints",
    "   - Duration: " + conditionedGameDuration + " minutes",
    "   - RPE: 6-8",
    "   - Focus: Modified game rules, small-sided games",
    `   - Space: up to ${spaceDims.label} (the FULL amount available under spaceConstraint=${input.spaceConstraint} -- this is the biggest drill in the session but still cannot exceed what the coach actually has)`,
    "   - Examples: Small-sided games, possession games, transition games",
    "",
    "5. COOLDOWN / DEBRIEF (" + cooldownDuration + " minutes) - a coach debrief, not a stretch routine:",
    "   - Purpose: Close the loop on THIS session, not generic recovery. A brief physical wind-down (light jogging, static stretching) still happens, but it is secondary -- the point of this slot is giving the coach something concrete to reinforce and carry into next time, using what THIS session's drills actually covered.",
    "   - Duration: " + cooldownDuration + " minutes",
    "   - RPE: 2-3",
    "   - MANDATORY: this drill's 'debrief' object (see REQUIRED FIELDS below) must be specific to what THIS session taught -- never generic filler like 'good effort today' or 'great hustle.' If it would read the same on any other session in this game model, it is not specific enough.",
    "",
    "⚠️ BEFORE YOU START: Read ALL diagram requirements below. Every drill MUST have diagram.players array with player objects (NOT empty []).",
    "IMPORTANT: Example below is for STRUCTURE only. Do NOT copy possession-specific content unless gameModelId=POSSESSION.",
    "Only ONE drill (WARMUP) is spelled out below as a worked example. Every other drill in your output (TECHNICAL, TACTICAL, CONDITIONED_GAME, and optionally COOLDOWN) uses the exact same field shape -- see SESSION STRUCTURE above for what each drill type covers and REQUIRED FIELDS below for the full field list. Do not omit fields just because only one example is shown.",
    "⚠️ \"drills\" is an ARRAY of separate drill objects: [ {drillType:'WARMUP',...}, {drillType:'TECHNICAL',...}, {drillType:'TACTICAL',...}, ... ]. It is NEVER an object keyed by drill type name (NOT { warmup: {...}, technical: {...} }). Each drill in the array is its own bare {...} object, comma-separated, exactly like the one WARMUP example below repeated for each drill type.",
    "",
    "EXAMPLE OUTPUT STRUCTURE:",
    JSON.stringify({
      title: "Possession-Based Attacking Session - Final Third",
      ageGroup: input.ageGroup,
      gameModelId: input.gameModelId,
      phase: input.phase || "ATTACKING",
      zone: input.zone || "ATTACKING_THIRD",
      durationMin: sessionDuration,
      summary: "Complete training session focused on possession and attacking in the final third. Session includes warmup, technical passing work, tactical build-up patterns, and a conditioned game.",
      drills: [
        {
          drillType: "WARMUP",
          title: "Dynamic Rondo Activation",
          durationMin: parseInt(warmupDuration),
          description: "Players maintain possession in a 4v1 rondo, focusing on quick passes and movement. High intensity of touches with low physical pressure.",
          organization: {
            setupSteps: [
              "Create a 15x15 yard square using cones",
              "4 players form a circle around the square",
              "1 defender starts in the center",
              "Coach provides multiple balls for quick restarts",
              "Players pass and move, maintaining possession"
            ],
            area: { lengthYards: 15, widthYards: 15, notes: "Small square for high intensity" },
            rotation: "After 30 seconds or 5 passes, rotate defender",
            restarts: "Coach quickly provides new ball if possession is lost",
            scoring: "Attackers: maintain possession for 30 seconds = 1 point. Defender: win ball = 1 point"
          },
          constraints: ["Maximum 2 touches per player", "Defender cannot leave the center until they touch the ball"],
          progressions: ["Reduce space to 12x12", "Add second defender (4v2)"],
          coachingPoints: [
            "Quick passing with one or two touches",
            "Movement off the ball to create angles",
            "Body position to receive and play forward"
          ],
          loadNotes: {
            structure: "3 x 3:00 / 1:00 rest (3:1 work:rest)",
            rationale: "Low intensity activation suitable for " + input.ageGroup
          },
          rpeMin: 3,
          rpeMax: 5,
          // This is the ONLY worked diagram example in this prompt (the other
          // 4 drill types are described in SESSION STRUCTURE above and typed
          // in REQUIRED FIELDS below -- one fully-populated example is enough
          // to show the shape; every drill you output needs the same fields).
          diagram: {
            pitch: { variant: "THIRD", orientation: "HORIZONTAL", showZones: false },
            players: [
              { id: "A1", number: 7, team: "ATT", role: "LW", x: 20, y: 40, facingAngle: 90 },
              { id: "A2", number: 10, team: "ATT", role: "CM", x: 50, y: 40, facingAngle: 90 },
              { id: "A3", number: 11, team: "ATT", role: "RW", x: 80, y: 40, facingAngle: 90 },
              { id: "A4", number: 9, team: "ATT", role: "ST", x: 50, y: 60, facingAngle: 90 },
              { id: "D1", number: 6, team: "DEF", role: "DM", x: 50, y: 50, facingAngle: 270 }
            ],
            goals: [],
            coach: { x: 50, y: 20, label: "Coach", note: "Provides balls" },
            arrows: [
              { id: "arr1", from: { x: 20, y: 40 }, to: { x: 50, y: 40 }, type: "pass", label: "1" },
              { id: "arr2", from: { x: 50, y: 40 }, to: { x: 80, y: 40 }, type: "pass", label: "2" }
            ],
            annotations: [
              { id: "ann1", text: "SCAN FIRST", x: 50, y: 30, fontSize: 10, color: "rgba(34, 211, 238, 0.95)", fontWeight: "700" }
            ],
            safeZones: []
          }
        }
      ],
      sessionPlan: {
        totalDuration: sessionDuration,
        breakdown: [
          { drillType: "WARMUP", duration: parseInt(warmupDuration) },
          { drillType: "TECHNICAL", duration: parseInt(technicalDuration) },
          { drillType: "TACTICAL", duration: parseInt(tacticalDuration) },
          { drillType: "CONDITIONED_GAME", duration: parseInt(conditionedGameDuration) },
          { drillType: "COOLDOWN", duration: parseInt(cooldownDuration) }
        ]
      },
      equipment: ["Cones", "Balls", "Bibs", "Goals"],
      coachingNotes: "Session focuses on " + input.gameModelId + " principles. Adjust intensity based on player response.",
      principleIds: [],
      psychThemeIds: []
    }, null, 2),
    "",
    "REQUIRED FIELDS:",
    "{",
    '  "title": string,',
    '  "ageGroup": "' + input.ageGroup + '",',
    '  "gameModelId": "' + input.gameModelId + '",',
    '  "phase": "' + (input.phase || "ATTACKING") + '",  // Optional but recommended',
    '  "zone": "' + (input.zone || "ATTACKING_THIRD") + '",  // Optional but recommended',
    '  "durationMin": ' + sessionDuration + ',',
    '  "summary": string,  // DETAILED 4-6 sentence overview (minimum 150 words) explaining session goals, key concepts, player outcomes, and how drills connect',
    '  "drills": [  // Array of 4-5 drills',
    '    {',
    '      "drillType": "WARMUP" | "TECHNICAL" | "TACTICAL" | "CONDITIONED_GAME" | "COOLDOWN",',
    '      "title": string,',
    '      "durationMin": number,  // Should match session breakdown',
    '      "description": string,  // DETAILED 4-5 sentences (minimum 80 words) explaining what players do, why this drill matters, key focus areas, and how it connects to the session theme',
    '      "organization": {  // Same structure as individual drill',
    '        "setupSteps": string[],  // 6-10 detailed steps with specific measurements, player positions, and equipment placement',
    '        "area": {"lengthYards": number, "widthYards": number, "notes"?: string},',
    '        "rotation": string,',
    '        "restarts": string,',
    '        "scoring": string',
    '      },',
      '      "progressions": string[],  // 3-4 progressions, each describing a specific way to increase challenge, complexity, or game-realism',
    '      "coachingPoints": string[],  // 4-5 specific, actionable coaching points with clear technical/tactical cues that coaches can use verbatim',
    '      "loadNotes": {',
    '        "structure": string,  // e.g., "6 x 2:00 / 1:00 rest"',
    '        "rationale": string',
    '      },',
    '      "rpeMin": number,',
    '      "rpeMax": number,',
    '      "equipment": string[],',
    '      "diagram": {  // REQUIRED diagram for each drill (use same structure as individual drills)',
    '        "pitch": {"variant": "FULL"|"HALF"|"THIRD"|"QUARTER", "orientation": "HORIZONTAL", "showZones": boolean},',
    '        "players": [{"id": string, "number": number, "team": "ATT"|"DEF"|"NEUTRAL", "role": string, "x": number, "y": number, "facingAngle": number}],',
    '        "coach": {"x": number, "y": number, "label": "Coach", "note": string},',
    '        "arrows": [{"from": {"playerId": string}, "to": {"playerId": string}, "type": "pass"|"run"|"press"}],',
    '        "goals": [{"id": string, "type": "BIG"|"MINI", "width": number, "x": number, "y": number, "facingAngle": number, "teamAttacks": "ATT"|"DEF"|"NEUTRAL"}]',
    '      },',
    '      "debrief": {  // ONLY on the COOLDOWN drill -- omit entirely on every other drill',
    '        "keyTakeaways": string[],  // exactly 3 points, each specific to what THIS session\'s drills covered -- reference the actual tactical/technical content, principleIds, or psychThemeIds, never a generic phrase',
    '        "questionsToAsk": string[],  // 2-3 short questions the coach asks players out loud to check understanding of today\'s specific focus -- not "how did everyone feel?"',
    '        "watchFor": string[]  // 1-2 things the coach should privately note about individual players\' development for next session, grounded in today\'s specific content',
    '      },',
    '    }',
    '  ],',
    '  "sessionPlan": {',
    '    "totalDuration": ' + sessionDuration + ',',
    '    "breakdown": [',
    '      {"drillType": "WARMUP", "duration": ' + parseInt(warmupDuration) + '},',
    '      {"drillType": "TECHNICAL", "duration": ' + parseInt(technicalDuration) + '},',
    '      {"drillType": "TACTICAL", "duration": ' + parseInt(tacticalDuration) + '},',
    '      {"drillType": "CONDITIONED_GAME", "duration": ' + parseInt(conditionedGameDuration) + '},',
    '      {"drillType": "COOLDOWN", "duration": ' + parseInt(cooldownDuration) + '}',
    '    ]',
    '  },',
    '  "equipment": string[],  // Overall equipment list',
    '  "coachingNotes": string,  // Session-level coaching guidance',
    '  "principleIds": string[],  // Tactical principles covered',
    '  "psychThemeIds": string[]  // Psychological themes',
    '}',
    "",
    "CRITICAL RULES:",
    "",
    "⚠️ CONTENT LENGTH REQUIREMENTS (MANDATORY):",
    "- session.summary MUST be 150-200 words (4-6 detailed sentences explaining goals, concepts, player outcomes, and drill connections)",
    "- Each drill.description MUST be 80-120 words (4-5 sentences explaining what players do, why it matters, key focus areas, and theme connection)",
    "- Each organization.setupSteps MUST have 6-10 specific steps with exact measurements, player positions, and equipment details",
    "- Each drill MUST have 4-5 coaching points that are specific, actionable, and usable verbatim by coaches",
    "- Each drill MUST have 3-4 progressions that meaningfully increase challenge or game-realism",
    "- SHORT OR BRIEF CONTENT IS NOT ACCEPTABLE - provide thorough, professional-level explanations",
    "",
    "⚠️ description QUALITY (not just length -- a description that hits 80 words by restating the drill's abstract purpose in fancier language is still a failure):",
    "- BAD (too abstract, and fuses multiple concepts into one clause -- this reads as B+ vocabulary even when coachLevel=USSF_C, and it's exactly the kind of description real coaches have flagged as vague): \"This tactical drill integrates our complete possession model to master playing out under pressure. Players face a realistic opponent block that deploys structured pressing triggers. The objective is recognizing when to circulate safely across the backline and when to execute a third-man pass through midfield lines.\"",
    "- GOOD (same length range, but grounded in the actual mechanics -- describes what a coach would SEE happening, using the specific setup/constraints already in this drill, one concept explained before moving to the next): \"Eight attackers build out against two mini-goal-defending pressers inside the 25x25 grid. Every player checks their shoulder before the ball arrives, then opens their body to receive facing forward -- that's the supporting-angle habit this drill is built around. When a defender steps to press the ball carrier, the nearest teammate offers an angle to receive played around the pressure, not through it. Ten consecutive passes without a defender touch scores the point, so players learn to value patience over forcing a risky pass into a crowded lane.\"",
    "- The difference: BAD describes the drill's THEME in the abstract (\"integrates our possession model,\" \"master playing out under pressure\"). GOOD describes what players actually DO, moment to moment, using the drill's own setup/scoring/constraints as the source of specificity -- pull concrete detail from THIS drill's organization.setupSteps and coachingPoints instead of writing a generic paragraph that could describe any possession drill in any session.",
    "",
    "1. Each drill in the drills array MUST have complete organization object with setupSteps, area (numeric lengthYards/widthYards), rotation, restarts, scoring",
    "1b. Each non-COOLDOWN drill MUST include constraints (2-5 items) and at least one explicit gameModel cue.",
    "2. Each drill MUST have a diagram field with proper structure (pitch, players array with player objects, goals, etc.)",
    "   ⚠️ diagram.players MUST be populated array with player objects matching organization.setupSteps (NOT empty [])",
    "3. Drill durations should sum to approximately " + sessionDuration + " minutes",
    "4. Drill progression: WARMUP → TECHNICAL → TACTICAL → CONDITIONED_GAME → (COOLDOWN)",
    "5. All drills should align with gameModelId=" + input.gameModelId,
    "6. Technical drill should focus on skills relevant to the tactical theme",
    "7. Tactical drill should directly relate to phase=" + (input.phase || "ATTACKING") + " and zone=" + (input.zone || "ATTACKING_THIRD"),
    "8. Age consistency: ALL age mentions = " + input.ageGroup + " exactly",
    "9. playerLevel and coachLevel: see PLAYER LEVEL DIFFICULTY LOCK and COACH LANGUAGE PROFILE above -- those are the authoritative rules, not restated here.",
    "10. The COOLDOWN drill MUST include the 'debrief' object (keyTakeaways x3, questionsToAsk x2-3, watchFor x1-2), specific to this session's actual content -- see COOLDOWN / DEBRIEF above. No other drill includes a 'debrief' field.",
    "",
    "FINAL CHECK before output (this is the diagram rule from above, restated ONE more time because it is the single most-violated rule -- not new information):",
    "- Every non-COOLDOWN drill: diagram.players.length > 0 and equals the player count stated in that drill's organization.setupSteps (e.g. '4 attackers, 2 defenders' = 6 objects, each with id/number/team/role/x/y/facingAngle).",
    "- Every non-COOLDOWN drill also has diagram.arrows (" + arrowRange + "), diagram.annotations (" + annotationRange + "), diagram.safeZones (" + safeZoneRange + ").",
    "- diagram.pitch.orientation is 'HORIZONTAL'; DEF's goal/side is on the right (x→100), ATT attacks the same right edge.",
    "",
    "OUTPUT: Raw JSON only (no markdown wrapper, no ```json)."
  ].join("\n");
}

/**
 * QA reviewer prompt for sessions
 */
/**
 * The QA rubric below only ever checks whether diagram.players/arrows/
 * annotations/safeZones are non-empty and roughly the right size (e.g.
 * "players matching setupSteps count") -- it never scores actual
 * coordinates, colors, or shapes. Sending the full diagram (every player's
 * x/y/role, every arrow's from/to, etc.) was pure waste: a real session's
 * QA prompt was 50k+ chars, dominated by diagram arrays the reviewer
 * structurally can't use for anything beyond "is this populated and
 * roughly this many items." Replacing each array with its length (plus a
 * populated flag) keeps every check in the rubric answerable while cutting
 * the bulk of the prompt -- and therefore the token cost -- of every QA
 * call, which runs on every single session generated.
 */
function summarizeDiagramForQa(diagram: any): any {
  if (!diagram || typeof diagram !== "object") return diagram;
  const countOf = (value: unknown) => (Array.isArray(value) ? value.length : 0);
  return {
    hasPitch: Boolean(diagram.pitch),
    playersCount: countOf(diagram.players),
    arrowsCount: countOf(diagram.arrows),
    annotationsCount: countOf(diagram.annotations),
    safeZonesCount: countOf(diagram.safeZones),
    goalsCount: countOf(diagram.goals),
  };
}

function summarizeSessionForQa(session: any): any {
  if (!session || typeof session !== "object") return session;
  const drills = Array.isArray(session.drills)
    ? session.drills.map((drill: any) => ({
        ...drill,
        diagram: drill?.diagram ? summarizeDiagramForQa(drill.diagram) : drill?.diagram,
      }))
    : session.drills;
  return { ...session, drills };
}

export function buildSessionQAReviewerPrompt(session: any): string {
  const prettySession = JSON.stringify(summarizeSessionForQa(session), null, 2);

  return [
    "You are CoachAI-Reviewer, a UEFA A-license coach.",
    "Review this training session JSON and return ONLY JSON:",
    "{",
    '  "pass": boolean,',
    '  "scores": {"structure": number, "gameModel": number, "phase": number, "psych": number, "clarity": number, "realism": number, "constraints": number, "safety": number, "progression": number},',
    '  "summary": string,',
    '  "notes": string[]',
    "}",
    "",
    "Scoring (1-5): 1=broken, 2=serious issues, 3=fixable, 4=strong, 5=excellent.",
    "",
    "NOTE: each drill's diagram field below is summarized as counts (playersCount, arrowsCount, annotationsCount, safeZonesCount, goalsCount, hasPitch) rather than the full arrays -- judge diagram completeness by whether these counts are non-zero and reasonable, not by inspecting coordinates.",
    "",
    "STRUCTURE (rate overall session structure):",
    "- 5: Session has complete drills array (4-5 drills), each drill has complete organization object with setupSteps (5-8), area (numeric), rotation, restarts, scoring, AND diagram field with playersCount/arrowsCount/annotationsCount/safeZonesCount all > 0",
    "- 3: Some drills missing organization details, or diagrams have playersCount = 0",
    "- 1-2: Missing drills, drills missing organization/diagrams, OR any drill has diagram.playersCount = 0 or arrowsCount/annotationsCount = 0 - this is a critical failure",
    "",
    "PROGRESSION (rate drill progression within session):",
    "- 5: Clear progression WARMUP → TECHNICAL → TACTICAL → CONDITIONED_GAME → (COOLDOWN), with logical flow and building complexity",
    "- 3: Progression exists but could be clearer or more logical",
    "- 1-2: No clear progression, drills don't build on each other",
    "",
    "CLARITY (score based on how easy it is for a coach to run the session):",
    "",
    "Score 5 (excellent):",
    "- Session summary is 150+ words with comprehensive detail about goals, concepts, and outcomes",
    "- Each drill description is 80+ words with thorough explanation of the activity and its purpose",
    "- Each drill has organization.setupSteps with 6-10 clear, verb-starting steps with specific measurements",
    "- Each drill has 4-5 specific, actionable coaching points",
    "- Each drill has 3-4 meaningful progressions",
    "- Each drill has organization.area with numeric lengthYards AND widthYards (both numbers)",
    "- Each drill has organization.rotation, restarts, scoring as clear, non-empty strings",
    "- Each drill (except COOLDOWN) has diagram field with hasPitch=true and playersCount/goalsCount/arrowsCount/annotationsCount all > 0",
    "- ⚠️ CRITICAL: Each drill's diagram.playersCount is > 0 and roughly matches the player count implied by setupSteps (no partial scenario diagrams)",
    "- No age mismatches (all mentions = session.ageGroup)",
    "- Drill durations sum to approximately session.durationMin",
    "",
    "Score 4 (strong):",
    "- Most clarity requirements met, minor issues (e.g., one drill missing area details, slight duration mismatch)",
    "- SetupSteps might be 4 or 9 instead of 5-8, but still clear",
    "",
    "Score 3 (fixable):",
    "- Basic structure present but some clarity issues (e.g., area as strings, unclear rotation in some drills)",
    "- Session summary under 100 words or drill descriptions under 50 words (too brief)",
    "- Less than 4 coaching points per drill or less than 3 progressions",
    "- Age mismatches in non-critical fields",
    "- Drill durations don't sum correctly",
    "",
    "Score 2 (serious issues) ONLY if:",
    "- Missing drills array or drills array empty",
    "- Multiple drills missing organization.area or area fields are strings (not numbers)",
    "- Multiple drills missing organization.rotation, restarts, or scoring",
    "- Multiple drills missing diagram field (except COOLDOWN)",
    "- ⚠️ ANY drill (except COOLDOWN) has diagram.playersCount = 0 - this is a critical failure",
    "- Multiple age mismatches in critical fields",
    "- Major duration mismatches",
    "",
    "GAMEMODEL (rate alignment with gameModelId):",
    "- 5: All drills align with gameModelId, tactical drill clearly demonstrates game model principles",
    "- 3: Some alignment but could be stronger",
    "- 1-2: Drills don't align with gameModelId",
    "- For POSSESSION: expect support angles, circulation, overloads, line breaks.",
    "- For PRESSING: expect triggers, compactness, coordinated regains, trap behavior.",
    "- For TRANSITION: expect 3-6 second reactions after regain/loss, fast attack/counterpress choices.",
    "- For ROCKLIN_FC: expect vertical progression + final-third intensity + immediate loss reaction + compact recovery.",
    "- For COACHAI: expect explicit switching logic across all three moments.",
    "",
    "PHASE (rate alignment with phase/zone intent):",
    "- 5: Drill behaviors and constraints clearly match the requested phase and zone moments.",
    "- 3: Some phase cues present but generic flow dominates.",
    "- 1-2: Session behavior mismatches phase intent.",
    "",
    "REALISM (rate realistic nature of session):",
    "- 5: Session is realistic, achievable, appropriate for age group and player level",
    "- 3: Mostly realistic with minor issues",
    "- 1-2: Unrealistic, inappropriate for age/level, or unsafe",
    "",
    "SESSION JSON:",
    prettySession
  ].join("\n");
}
