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
}

function getSessionGameModelGuidance(gameModelId: string, phase?: string, zone?: string): string {
  const p = phase || "ATTACKING";
  const z = zone || "ATTACKING_THIRD";
  const common = [
    "MODEL-LOCK RULES (MANDATORY):",
    `- gameModelId=${gameModelId} must shape every drill, not just the tactical drill title.`,
    `- phase=${p} and zone=${z} must appear in setup, constraints, and coaching language.`,
    "- Across the session, include at least 8 model-specific cues (coaching points + constraints + progressions).",
    "- CONDITIONED_GAME must explicitly test the same game model decisions trained earlier.",
  ];

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
    input.zone
  );
  const phaseGuidance = getSessionPhaseGuidance(input.phase, input.zone);
  const isGrassroots = input.coachLevel === "GRASSROOTS";
  const isUssfCorB =
    input.coachLevel === "USSF_C" || input.coachLevel === "USSF_B_PLUS";
  const diagramDetailLabel = isGrassroots ? "SIMPLE" : "FULL";
  const arrowRange = isGrassroots ? "2-4" : "7-10";
  const annotationRange = isGrassroots ? "1-2" : "4-6";
  const safeZoneRange = isGrassroots ? "0-1" : "1-3";
  
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
    isGrassroots
      ? "- For GRASSROOTS, diagrams must be simple and coach-friendly: no pitch zone overlays, fewer arrows, fewer annotations, and optional safe zones."
      : "- For USSF_C and USSF_B_PLUS, use full tactical diagram detail with richer movement, annotations, and safe-zone context.",
    ...(isUssfCorB
      ? ["- USSF_C and USSF_B_PLUS share the same diagram structure and detail level."]
      : []),
    "COACH LANGUAGE PROFILE (MANDATORY):",
    isGrassroots
      ? "- GRASSROOTS: use clear, practical language that a grassroots coach can run immediately. Keep terms simple and direct."
      : "- USSF_C / USSF_B_PLUS: tactical language is allowed, but instructions must still be clear and executable.",
    isGrassroots
      ? "- Avoid heavy jargon and abstract wording (e.g., numerical superiority, tactical nuances, rest defense). Use plain alternatives."
      : "- Use tactical vocabulary where helpful, tied to concrete actions and coaching cues.",
    isGrassroots
      ? "- Grassroots quality target: same detail level and structure, but simpler words and more direct action cues."
      : "- Keep advanced detail, while staying coach-friendly and session-ready.",
    ...(isUssfCorB
      ? ["- For USSF_C and USSF_B_PLUS, keep tactical terminology and detail; do not rewrite into grassroots-style simplified language."]
      : []),
    "",
    "🚨🚨🚨 CRITICAL DIAGRAM REQUIREMENT 🚨🚨🚨",
    "",
    "EVERY drill (except COOLDOWN) MUST have a diagram field with a POPULATED players array.",
    "",
    "❌ ABSOLUTELY FORBIDDEN: diagram: { pitch: {...}, players: [], goals: [] }",
    "   (Empty players array [] is INVALID and will cause QA to fail)",
    "",
    "✅ REQUIRED: diagram: {",
    "     pitch: { variant: 'HALF', orientation: 'HORIZONTAL', showZones: false },",
    "     players: [",
    "       { id: 'A1', number: 7, team: 'ATT', role: 'LW', x: 25, y: 50, facingAngle: 90 },",
    "       { id: 'A2', number: 10, team: 'ATT', role: 'CM', x: 50, y: 50, facingAngle: 90 },",
    "       { id: 'D1', number: 4, team: 'DEF', role: 'CB', x: 50, y: 40, facingAngle: 270 },",
    "       ...  // MUST include ALL players from organization.setupSteps",
    "     ],",
    "     arrows: [",
    "       { id: 'arr1', from: { x: 25, y: 50 }, to: { x: 50, y: 50 }, type: 'pass', label: '1' },",
    "       { id: 'arr2', from: { x: 50, y: 50 }, to: { x: 40, y: 40 }, type: 'press' }",
    "     ],",
    "     annotations: [",
    "       { id: 'ann1', text: 'PRESS TRIGGER', x: 35, y: 35, fontSize: 10, color: 'rgba(239, 68, 68, 0.95)', fontWeight: '700' },",
    "       { id: 'ann2', text: 'STAY COMPACT', x: 55, y: 55, fontSize: 10, color: 'rgba(251, 191, 36, 0.95)', fontWeight: '700' }",
    "     ],",
    "     safeZones: [",
    "       { id: 'sz1', x: 0, y: 0, width: 15, height: 100, team: 'ATT', label: 'WIDE CHANNEL' }",
    "     ],",
    "     goals: [...]",
    "   }",
    "",
    "⚠️ YOU MUST:",
    "1. Read organization.setupSteps to count players (e.g., '4 attackers, 2 defenders' = 6 players)",
    "2. Create diagram.players array with that many player objects",
    "3. Each player object needs: id, number, team, role, x, y, facingAngle",
    "4. Position players according to formation=" + input.formationAttacking + " (ATT) and " + input.formationDefending + " (DEF)",
    "5. Add diagram.arrows array (" + arrowRange + " arrows) and diagram.annotations array (" + annotationRange + " annotations with fontSize, color, fontWeight)",
    "6. diagram.players MUST include EVERY player described in organization.setupSteps (no partial scenario diagrams).",
    "7. diagram.pitch.showZones MUST be false.",
    "8. diagram.safeZones should include " + safeZoneRange + " entries.",
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
    "SESSION STRUCTURE FOR " + sessionDuration + "-MINUTE SESSION:",
    "",
    "1. WARMUP (" + warmupDuration + " minutes):",
    "   - Purpose: Activation, technical touches, low intensity",
    "   - Duration: " + warmupDuration + " minutes",
    "   - RPE: 3-5",
    "   - Focus: High touches, movement patterns, ball work",
    "   - Space: Smaller areas (QUARTER or THIRD)",
    "   - Examples: Rondos, passing patterns, dynamic movements with ball",
    "",
    "2. TECHNICAL (" + technicalDuration + " minutes):",
    "   - Purpose: Skill development, repetition, muscle memory",
    "   - Duration: " + technicalDuration + " minutes",
    "   - RPE: 4-6",
    "   - Focus: Specific technique (passing, shooting, first touch, dribbling)",
    "   - Space: Medium areas (THIRD or HALF)",
    "   - Examples: Finishing drills, passing accuracy, first touch exercises",
    "",
    "3. TACTICAL (" + tacticalDuration + " minutes):",
    "   - Purpose: Game understanding, decision-making, patterns of play",
    "   - Duration: " + tacticalDuration + " minutes",
    "   - RPE: 5-7",
    "   - Focus: Tactical concepts aligned with gameModelId=" + input.gameModelId + ", phase=" + (input.phase || "ATTACKING") + ", zone=" + (input.zone || "ATTACKING_THIRD"),
    "   - Space: Medium to large areas (HALF or FULL depending on concept)",
    "   - Examples: Positional play, build-up patterns, pressing triggers",
    "",
    "4. CONDITIONED_GAME (" + conditionedGameDuration + " minutes):",
    "   - Purpose: Apply skills in game context with constraints",
    "   - Duration: " + conditionedGameDuration + " minutes",
    "   - RPE: 6-8",
    "   - Focus: Modified game rules, small-sided games",
    "   - Space: Large areas (HALF or FULL)",
    "   - Examples: Small-sided games, possession games, transition games",
    "",
    "5. COOLDOWN (" + cooldownDuration + " minutes) - optional but recommended:",
    "   - Purpose: Recovery, stretching, reflection",
    "   - Duration: " + cooldownDuration + " minutes",
    "   - RPE: 2-3",
    "   - Focus: Light jogging, static stretching, team discussion",
    "",
    "⚠️ BEFORE YOU START: Read ALL diagram requirements below. Every drill MUST have diagram.players array with player objects (NOT empty []).",
    "IMPORTANT: Example below is for STRUCTURE only. Do NOT copy possession-specific content unless gameModelId=POSSESSION.",
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
            coach: { x: 50, y: 20, label: "Coach", note: "Provides balls" }
          }
        },
        {
          drillType: "TECHNICAL",
          title: "Passing and Receiving Under Pressure",
          durationMin: parseInt(technicalDuration),
          description: "Players practice passing and receiving in a 4v2 possession game with focus on first touch and quick decision-making.",
          organization: {
            setupSteps: [
              "Create a 30x20 yard rectangle using cones",
              "4 attackers start inside the area",
              "2 defenders start in the center",
              "Coach provides balls on the sideline",
              "Attackers maintain possession with quick passes"
            ],
            area: { lengthYards: 30, widthYards: 20, notes: "Technical area for passing practice" },
            rotation: "Every 2 minutes: one attacker becomes defender, one defender rotates out",
            restarts: "Coach passes new ball if possession is lost",
            scoring: "Attackers: 10 consecutive passes = 1 point. Defenders: win ball = 1 point"
          },
          progressions: ["Add time limit (must complete 10 passes in 30 seconds)", "Reduce to 3v2"],
          coachingPoints: [
            "First touch should set up next action",
            "Body position to receive and pass quickly",
            "Scan before receiving the ball"
          ],
          loadNotes: {
            structure: "4 x 3:00 / 1:30 rest (2:1 work:rest)",
            rationale: "Technical repetition with adequate rest for " + input.ageGroup
          },
          rpeMin: 4,
          rpeMax: 6,
          diagram: {
            pitch: { variant: "HALF", orientation: "HORIZONTAL", showZones: false },
            players: [
              { id: "A1", number: 7, team: "ATT", role: "LW", x: 25, y: 50, facingAngle: 90 },
              { id: "A2", number: 8, team: "ATT", role: "CM", x: 50, y: 50, facingAngle: 90 },
              { id: "A3", number: 10, team: "ATT", role: "CM", x: 50, y: 60, facingAngle: 90 },
              { id: "A4", number: 11, team: "ATT", role: "RW", x: 75, y: 50, facingAngle: 90 },
              { id: "D1", number: 4, team: "DEF", role: "CB", x: 50, y: 40, facingAngle: 270 },
              { id: "D2", number: 5, team: "DEF", role: "CB", x: 50, y: 55, facingAngle: 270 }
            ],
            goals: [],
            coach: { x: 10, y: 50, label: "Coach", note: "Provides balls" }
          }
        },
        {
          drillType: "TACTICAL",
          title: "Build-Up Play in Final Third",
          durationMin: parseInt(tacticalDuration),
          description: "Practice building attacks from the back with emphasis on creating scoring opportunities in the final third through quick passing and movement.",
          organization: {
            setupSteps: [
              "Use half field (50x35 yards)",
              "Place one full-size goal with GK at one end",
              "Set up 6v4+GK situation (6 attackers, 4 defenders, 1 GK)",
              "Start with GK distribution",
              "Attackers build from back to create scoring chance"
            ],
            area: { lengthYards: 50, widthYards: 35, notes: "Half field for tactical work" },
            rotation: "After goal or 2 minutes: rotate 2 attackers to defenders",
            restarts: "GK restarts after goal or out of bounds",
            scoring: "Attackers score by finishing in goal. Defenders score by winning ball and clearing"
          },
          progressions: ["Add offside line", "Require minimum 5 passes before shooting"],
          coachingPoints: [
            "Width and depth in build-up",
            "Support angles for the player on the ball",
            "Timing of runs into final third"
          ],
          loadNotes: {
            structure: "4 x 4:00 / 2:00 rest (2:1 work:rest)",
            rationale: "Tactical understanding requires longer periods for " + input.ageGroup
          },
          rpeMin: 5,
          rpeMax: 7,
          diagram: {
            pitch: { variant: "HALF", orientation: "HORIZONTAL", showZones: true },
            players: [
              { id: "GK1", number: 1, team: "DEF", role: "GK", x: 10, y: 50, facingAngle: 90 },
              { id: "D1", number: 2, team: "DEF", role: "RB", x: 25, y: 30, facingAngle: 270 },
              { id: "D2", number: 4, team: "DEF", role: "CB", x: 25, y: 50, facingAngle: 270 },
              { id: "D3", number: 5, team: "DEF", role: "CB", x: 25, y: 70, facingAngle: 270 },
              { id: "D4", number: 3, team: "DEF", role: "LB", x: 25, y: 90, facingAngle: 270 },
              { id: "A1", number: 7, team: "ATT", role: "LW", x: 50, y: 30, facingAngle: 90 },
              { id: "A2", number: 8, team: "ATT", role: "CM", x: 50, y: 50, facingAngle: 90 },
              { id: "A3", number: 10, team: "ATT", role: "CM", x: 50, y: 70, facingAngle: 90 },
              { id: "A4", number: 11, team: "ATT", role: "RW", x: 50, y: 90, facingAngle: 90 },
              { id: "A5", number: 9, team: "ATT", role: "ST", x: 70, y: 50, facingAngle: 90 },
              { id: "A6", number: 6, team: "ATT", role: "DM", x: 40, y: 50, facingAngle: 90 }
            ],
            goals: [
              { id: "G1", type: "BIG", width: 8, x: 10, y: 50, facingAngle: 90, teamAttacks: "ATT" }
            ],
            coach: { x: 80, y: 50, label: "Coach", note: "Observes" }
          }
        },
        {
          drillType: "CONDITIONED_GAME",
          title: "7v7 Possession Game with Restrictions",
          durationMin: parseInt(conditionedGameDuration),
          description: "Small-sided game focusing on maintaining possession and creating scoring opportunities with modified rules to emphasize game model principles.",
          organization: {
            setupSteps: [
              "Set up 7v7 game on half field (60x40 yards)",
              "Place two full-size goals with GKs",
              "Divide players into two teams of 7",
              "Set offside line at halfway",
              "Start with kickoff"
            ],
            area: { lengthYards: 60, widthYards: 40, notes: "Half field for conditioned game" },
            rotation: "Teams swap ends at halftime",
            restarts: "GK restarts after goal, kick-in for out of bounds",
            scoring: "Normal goals (1 point each). Bonus: 5+ pass sequence before goal = 2 points"
          },
          progressions: ["Remove restrictions", "Add touch limits in certain zones"],
          coachingPoints: [
            "Maintain possession under pressure",
            "Quick transitions from defense to attack",
            "Creating and finishing scoring chances"
          ],
          loadNotes: {
            structure: "2 x 12:00 / 3:00 rest" + (is60Min ? "" : " (for 90-min session: 2 x 20:00 / 5:00 rest"),
            rationale: "Game-like intensity for " + input.ageGroup + " players"
          },
          rpeMin: 6,
          rpeMax: 8,
          diagram: {
            pitch: { variant: "HALF", orientation: "HORIZONTAL", showZones: true },
            players: [
              { id: "GK1", number: 1, team: "DEF", role: "GK", x: 10, y: 50, facingAngle: 90 },
              { id: "D1", number: 2, team: "DEF", role: "RB", x: 30, y: 30, facingAngle: 270 },
              { id: "D2", number: 4, team: "DEF", role: "CB", x: 30, y: 50, facingAngle: 270 },
              { id: "D3", number: 5, team: "DEF", role: "CB", x: 30, y: 70, facingAngle: 270 },
              { id: "D4", number: 3, team: "DEF", role: "LB", x: 30, y: 90, facingAngle: 270 },
              { id: "D5", number: 6, team: "DEF", role: "DM", x: 45, y: 40, facingAngle: 270 },
              { id: "D6", number: 8, team: "DEF", role: "CM", x: 45, y: 60, facingAngle: 270 },
              { id: "GK2", number: 1, team: "ATT", role: "GK", x: 90, y: 50, facingAngle: 270 },
              { id: "A1", number: 7, team: "ATT", role: "LW", x: 60, y: 30, facingAngle: 90 },
              { id: "A2", number: 10, team: "ATT", role: "CM", x: 60, y: 50, facingAngle: 90 },
              { id: "A3", number: 11, team: "ATT", role: "RW", x: 60, y: 70, facingAngle: 90 },
              { id: "A4", number: 9, team: "ATT", role: "ST", x: 75, y: 50, facingAngle: 90 },
              { id: "A5", number: 8, team: "ATT", role: "CM", x: 60, y: 60, facingAngle: 90 },
              { id: "A6", number: 6, team: "ATT", role: "DM", x: 55, y: 40, facingAngle: 90 },
              { id: "A7", number: 4, team: "ATT", role: "CB", x: 70, y: 50, facingAngle: 90 }
            ],
            goals: [
              { id: "G1", type: "BIG", width: 8, x: 10, y: 50, facingAngle: 90, teamAttacks: "ATT" },
              { id: "G2", type: "BIG", width: 8, x: 90, y: 50, facingAngle: 270, teamAttacks: "DEF" }
            ]
          }
        },
        {
          drillType: "COOLDOWN",
          title: "Recovery and Stretch",
          durationMin: parseInt(cooldownDuration),
          description: "Light movement and static stretching to aid recovery and prevent injury.",
          organization: {
            setupSteps: [
              "Players form a circle",
              "Begin with light jogging",
              "Transition to static stretches",
              "Include key muscle groups: hamstrings, quads, calves, groin"
            ],
            area: { lengthYards: 20, widthYards: 20, notes: "Small area for cooldown" },
            rotation: "No rotation needed",
            restarts: "Not applicable",
            scoring: "Not applicable"
          },
          progressions: [],
          coachingPoints: [
            "Hold each stretch for 20-30 seconds",
            "Focus on breathing and relaxation",
            "Use this time for team discussion and feedback"
          ],
          loadNotes: {
            structure: "5-10 minutes continuous",
            rationale: "Recovery and reflection for " + input.ageGroup
          },
          rpeMin: 2,
          rpeMax: 3
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
    "9. playerLevel=" + input.playerLevel + ": BEGINNER=simpler drills, INTERMEDIATE=moderate complexity, ADVANCED=complex, game-realistic",
    "10. coachLevel=" + input.coachLevel + ": ALL levels MUST provide COMPREHENSIVE, DETAILED content. GRASSROOTS=clear accessible language with full explanations, USSF_C=moderate tactical terminology with thorough detail, USSF_B_PLUS=advanced tactical terminology with expert-level depth. Never sacrifice content length for any coach level.",
    "",
    "DIAGRAM REQUIREMENTS FOR EACH DRILL:",
    "- Each drill MUST include a 'diagram' field (NOT 'diagramV1')",
    "- ⚠️ CRITICAL: diagram.players MUST be a populated array (NOT empty []) with ALL players mentioned in organization.setupSteps",
    "- Diagram structure: pitch (variant, orientation, showZones:false), players array (with id, number, team, role, x, y, facingAngle), goals array, arrows array (7-10), annotations array (4-6), safeZones array (1-3), optional coach",
    "- ATT attacks bottom→top (y: 80→10), x: 0–100 (left→right)",
    "- Position ATT players per formation=" + input.formationAttacking + ", position DEF players per formation=" + input.formationDefending,
    "- DEF players face 180° (down) for pressing",
    "- Player counts MUST match: description text = organization.setupSteps = diagram.players array length",
    "- Example: If setupSteps says '4 attackers, 4 defenders, 1 GK', then diagram.players MUST have 9 player objects",
    "- COOLDOWN drills may have simpler diagrams or can be omitted, but all other drills MUST have diagrams with populated players arrays",
    "",
    "⚠️ DIAGRAM REQUIREMENT (CRITICAL - missing diagrams or empty players = structure score 1-2):",
    "",
    "EVERY drill (except COOLDOWN) MUST include a complete 'diagram' field:",
    "- WARMUP drill: MUST have diagram with populated players array",
    "- TECHNICAL drill: MUST have diagram with populated players array", 
    "- TACTICAL drill: MUST have diagram with populated players array",
    "- CONDITIONED_GAME drill: MUST have diagram with populated players array",
    "- COOLDOWN drill: diagram optional (can be omitted)",
    "",
    "Each diagram MUST have this structure:",
    "{",
    '  "pitch": {"variant": "FULL"|"HALF"|"THIRD"|"QUARTER", "orientation": "HORIZONTAL", "showZones": boolean},',
    '  "players": [',
    '    {"id": "A1", "number": number, "team": "ATT"|"DEF"|"NEUTRAL", "role": string, "x": number, "y": number, "facingAngle": number},',
    '    {"id": "A2", "number": number, "team": "ATT", "role": string, "x": number, "y": number, "facingAngle": number},',
    '    ...  // ⚠️ MUST include ALL players mentioned in organization.setupSteps - players array MUST NOT be empty []',
    '  ],',
    '  "goals": [',
    '    {"id": "G1", "type": "BIG"|"MINI", "width": number, "x": number, "y": number, "facingAngle": number, "teamAttacks": "ATT"|"DEF"|"NEUTRAL"},',
    '    ...  // Include goals based on drill setup (e.g., if setupSteps mentions goals or GK)',
    '  ],',
    '  "coach": {"x": number, "y": number, "label": "Coach", "note": string},  // Optional but recommended',
    '  "arrows": [...]  // Optional',
    "}",
    "",
    "⚠️ VALIDATION CHECKLIST - Before outputting JSON (FAILURE TO FOLLOW = STRUCTURE SCORE 1):",
    "",
    "STEP 1: For EACH drill (except COOLDOWN):",
    "  a) Verify diagram field exists",
    "  b) Verify diagram.players is an array",
    "  c) ⚠️ CRITICAL: Verify diagram.players.length > 0 (NOT empty [])",
    "  d) Verify diagram.arrows exists and has length >= 7",
    "  e) Verify diagram.annotations exists and has length >= 4",
    "  f) Verify diagram.players.length equals the total players described in setupSteps",
    "  g) Verify diagram.safeZones exists and has length >= 1",
    "",
    "STEP 2: For EACH drill, count players:",
    "  a) Read organization.setupSteps text (e.g., '4 attackers, 2 defenders' = 6 players)",
    "  b) Verify diagram.players.length equals the total player count from setupSteps",
    "  c) If arrows/annotations missing, add them before output",
    "  c) If setupSteps says '4v2', then diagram.players MUST have 6 player objects",
    "",
    "STEP 3: For EACH player object in diagram.players:",
    "  a) Verify it has: id (string), number (number), team ('ATT'|'DEF'|'NEUTRAL'), role (string), x (number), y (number), facingAngle (number)",
    "  b) ATT players: facingAngle = 90 (attacking up)",
    "  c) DEF players: facingAngle = 270 (facing down for pressing)",
    "",
    "STEP 4: Position players:",
    "  a) ATT players positioned per formation=" + input.formationAttacking,
    "  b) DEF players positioned per formation=" + input.formationDefending,
    "",
    "❌ IF diagram.players is [] (empty array), THE OUTPUT IS INVALID AND WILL FAIL QA.",
    "❌ IF diagram.arrows or diagram.annotations are missing, THE OUTPUT IS INVALID AND WILL FAIL QA.",
    "✅ diagram.players MUST contain player objects matching organization.setupSteps player count.",
    "✅ diagram.arrows MUST have at least 2 arrows; diagram.annotations MUST have at least 2 labels.",
    "",
    "OUTPUT: Raw JSON only (no markdown wrapper, no ```json)."
  ].join("\n");
}

/**
 * QA reviewer prompt for sessions
 */
export function buildSessionQAReviewerPrompt(session: any): string {
  const prettySession = JSON.stringify(session, null, 2);

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
    "STRUCTURE (rate overall session structure):",
    "- 5: Session has complete drills array (4-5 drills), each drill has complete organization object with setupSteps (5-8), area (numeric), rotation, restarts, scoring, AND diagram field with populated players array plus arrows, annotations, and safeZones",
    "- 3: Some drills missing organization details, diagrams, or diagrams have empty players arrays",
    "- 1-2: Missing drills, drills missing organization/diagrams, OR any drill has diagram.players = [] (empty array) or missing arrows/annotations/safeZones - this is a critical failure",
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
    "- Each drill (except COOLDOWN) has diagram field with pitch, players array, goals array, arrows array, annotations array",
    "- ⚠️ CRITICAL: Each drill's diagram.players is a NON-EMPTY array with player objects matching setupSteps player count (no partial scenario diagrams)",
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
    "- ⚠️ ANY drill (except COOLDOWN) has diagram.players = [] (empty array) - this is a critical failure",
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
