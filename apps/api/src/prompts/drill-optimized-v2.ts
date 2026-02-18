export interface DrillPromptInput {
  gameModelId: string;
  ageGroup: string;
  phase: string;
  zone: string;
  drillType: string; // WARMUP | TECHNICAL | TACTICAL | CONDITIONED_GAME | FULL_GAME | COOLDOWN
  numbersMin: number;
  numbersMax: number;
  gkOptional?: boolean;
  goalsAvailable: number;
  spaceConstraint: string;
  durationMin?: number;
  
  formationAttacking: string;
  formationDefending: string;
  playerLevel: string;
  coachLevel: string;
}

/**
 * Get drill type-specific guidance that significantly changes the prompt
 */
function getDrillTypeGuidance(drillType: string, ageGroup: string, playerLevel: string): string {
  const base = `For ${ageGroup} ${playerLevel} players, `;
  
  switch (drillType) {
    case "WARMUP":
      return [
        "🎯 WARMUP DRILL REQUIREMENTS:",
        "",
        "PURPOSE: Activation, technical touches, low intensity preparation",
        "",
        "CHARACTERISTICS:",
        "- Duration: 5-15 minutes (shorter than other drills)",
        "- Intensity: LOW (RPE 3-5)",
        "- Focus: High touches, low pressure, movement patterns",
        "- Space: Smaller areas (QUARTER or THIRD of field)",
        "- Players: Fewer players (4-8 total), can be unopposed or light opposition",
        "- Equipment: Minimal (cones, balls, maybe small goals)",
        "",
        "CONTENT REQUIREMENTS:",
        "- Description: Emphasize activation, movement, technical touches",
        "- Organization: Simple setup, quick rotation, continuous flow",
        "- Coaching Points: Focus on movement quality, ball control, body positioning",
        "- Progressions: Increase speed/intensity, add light pressure",
        "- Constraints: Keep it simple, avoid complex rules",
        "- loadNotes.structure: Short work periods (30s-2min) with equal or longer rest",
        "",
        "❌ DO NOT: Create complex tactical situations, high pressure, long duration",
        "✅ DO: Keep it simple, fun, movement-focused, high repetition",
        "",
        base + "create a warmup that gets players moving, touching the ball frequently, and preparing for training."
      ].join("\n");

    case "TECHNICAL":
      return [
        "🎯 TECHNICAL DRILL REQUIREMENTS:",
        "",
        "PURPOSE: Skill development, repetition, muscle memory",
        "",
        "CHARACTERISTICS:",
        "- Duration: 10-20 minutes",
        "- Intensity: MEDIUM (RPE 4-6)",
        "- Focus: Specific technique repetition (passing, shooting, first touch, dribbling)",
        "- Space: Medium areas (THIRD or HALF of field)",
        "- Players: Medium groups (6-12 total), can be unopposed or opposed",
        "- Equipment: Specific to technique (goals for finishing, targets for passing)",
        "",
        "CONTENT REQUIREMENTS:",
        "- Description: Clearly state the technical skill being developed",
        "- Organization: Repetitive structure, clear progression from simple to complex",
        "- Coaching Points: Technical cues (body position, contact point, follow-through)",
        "- Progressions: Add pressure, increase speed, add decision-making",
        "- Constraints: Focus on technique quality, not game situations",
        "- loadNotes.structure: Repetitive work periods (1-3min) with short rest",
        "",
        "❌ DO NOT: Create complex game situations, focus on tactics over technique",
        "✅ DO: Emphasize repetition, quality of execution, specific technical focus",
        "",
        base + "create a technical drill that develops a specific skill through repetition and quality practice."
      ].join("\n");

    case "TACTICAL":
      return [
        "🎯 TACTICAL DRILL REQUIREMENTS:",
        "",
        "PURPOSE: Game understanding, decision-making, patterns of play",
        "",
        "CHARACTERISTICS:",
        "- Duration: 15-30 minutes",
        "- Intensity: MEDIUM-HIGH (RPE 5-7)",
        "- Focus: Tactical concepts, decision-making, game situations",
        "- Space: Medium to large areas (HALF or FULL field depending on concept)",
        "- Players: Game-realistic numbers (8-16 total)",
        "- Equipment: Goals, cones for zones/constraints",
        "",
        "CONTENT REQUIREMENTS:",
        "- Description: Emphasize tactical objective (build-up, pressing, transitions)",
        "- Organization: Game-like setup with specific constraints to focus on tactical concept",
        "- Coaching Points: Tactical cues (when to press, where to position, decision-making)",
        "- Progressions: Remove constraints, add complexity, increase game-realistic elements",
        "- Constraints: Shape behavior to emphasize tactical concept",
        "- loadNotes.structure: Game-like work periods (3-5min) with rest",
        "",
        "❌ DO NOT: Focus on isolated technique, create unrealistic situations",
        "✅ DO: Emphasize decision-making, game understanding, tactical patterns",
        "",
        base + "create a tactical drill that develops game understanding and decision-making in realistic situations."
      ].join("\n");

    case "CONDITIONED_GAME":
      return [
        "🎯 CONDITIONED GAME REQUIREMENTS:",
        "",
        "PURPOSE: Apply skills in game context with specific constraints",
        "",
        "CHARACTERISTICS:",
        "- Duration: 20-40 minutes",
        "- Intensity: HIGH (RPE 6-8)",
        "- Focus: Game application with modified rules to emphasize specific concepts",
        "- Space: Large areas (HALF or FULL field)",
        "- Players: Game-realistic numbers (10-20 total)",
        "- Equipment: Full goals, cones for constraints",
        "",
        "CONTENT REQUIREMENTS:",
        "- Description: Emphasize game context and the constraint/condition",
        "- Organization: Game-like setup with clear rules and constraints",
        "- Coaching Points: Game-related cues, applying previous work",
        "- Progressions: Modify constraints, change conditions, increase game realism",
        "- Constraints: Specific rules that shape play (e.g., 'must pass through middle third', 'offside applies')",
        "- loadNotes.structure: Game-like periods (4-8min) with rest",
        "",
        "❌ DO NOT: Create isolated drills, ignore game context",
        "✅ DO: Emphasize game application, realistic situations, constraint-based learning",
        "",
        base + "create a conditioned game that applies skills in a game context with specific constraints."
      ].join("\n");

    case "FULL_GAME":
      return [
        "🎯 FULL GAME REQUIREMENTS:",
        "",
        "PURPOSE: Match simulation, full game context",
        "",
        "CHARACTERISTICS:",
        "- Duration: 30-60 minutes",
        "- Intensity: VERY HIGH (RPE 7-9)",
        "- Focus: Full game simulation, all aspects of play",
        "- Space: FULL field",
        "- Players: Full team numbers (18-22 total for 9v9 or 11v11)",
        "- Equipment: Full goals, full field markings",
        "",
        "CONTENT REQUIREMENTS:",
        "- Description: Emphasize match simulation, full game context",
        "- Organization: Full field setup, realistic game structure",
        "- Coaching Points: Game management, all phases of play",
        "- Progressions: Adjust game format, add specific focus areas",
        "- Constraints: Minimal - let the game flow naturally",
        "- loadNotes.structure: Match periods (15-30min halves) with halftime",
        "",
        "❌ DO NOT: Over-constrain, create unrealistic situations",
        "✅ DO: Emphasize full game context, realistic match conditions",
        "",
        base + "create a full game scenario that simulates match conditions."
      ].join("\n");

    case "COOLDOWN":
      return [
        "🎯 COOLDOWN DRILL REQUIREMENTS:",
        "",
        "PURPOSE: Recovery, stretching, reflection",
        "",
        "CHARACTERISTICS:",
        "- Duration: 5-10 minutes",
        "- Intensity: VERY LOW (RPE 2-3)",
        "- Focus: Recovery, light movement, stretching",
        "- Space: Small area or no specific area needed",
        "- Players: All players together",
        "- Equipment: Minimal (cones for stretching stations, balls optional)",
        "",
        "CONTENT REQUIREMENTS:",
        "- Description: Emphasize recovery, cool-down, reflection",
        "- Organization: Simple, relaxed structure, optional light ball work",
        "- Coaching Points: Recovery cues, stretching technique, reflection questions",
        "- Progressions: N/A (cooldown doesn't progress)",
        "- Constraints: Keep it relaxed, no pressure",
        "- loadNotes.structure: Continuous light activity (5-10min) or static stretching",
        "",
        "❌ DO NOT: Create intense activity, complex organization",
        "✅ DO: Emphasize recovery, light movement, stretching, reflection",
        "",
        base + "create a cooldown activity that helps players recover and reflect."
      ].join("\n");

    default:
      return `⚠️ Unknown drill type: ${drillType}. Use standard drill structure.`;
  }
}

function getGameModelGuidance(gameModelId: string, phase: string, zone: string): string {
  const common = [
    "MODEL-LOCK RULES (MANDATORY):",
    `- gameModelId=${gameModelId} must change drill behavior, not just labels.`,
    `- phase=${phase} and zone=${zone} must appear in setup, constraints, and coaching points.`,
    "- Include at least 3 model-specific cues in coachingPoints and at least 2 in constraints/progressions.",
    "- Diagram arrows and annotations must represent the model's decision moments.",
  ];

  if (gameModelId === "POSSESSION") {
    return [
      ...common,
      "POSSESSION REQUIREMENTS:",
      "- Emphasize creating overloads, third-man support, and controlled circulation.",
      "- Constraints should reward pass count, line breaks, switch of play, or positional support.",
      "- Coaching points must include scanning, body orientation, and tempo control.",
      "- Diagram should show support triangles/diamonds and circulation lanes.",
      "- Avoid transition-chaos framing as the core objective.",
    ].join("\n");
  }

  if (gameModelId === "PRESSING") {
    return [
      ...common,
      "PRESSING REQUIREMENTS:",
      "- Emphasize pressing triggers (bad touch/back pass/closed body shape), cover shadow, and compactness.",
      "- Constraints should reward regains in target windows/zones and punish passive retreat.",
      "- Coaching points must include press angle, second/third defender roles, and rest defense.",
      "- Diagram should show pressing runs, trap zones, and nearest support rotations.",
      "- Avoid passive block-only behavior unless explicitly part of the press trap.",
    ].join("\n");
  }

  if (gameModelId === "TRANSITION") {
    return [
      ...common,
      "TRANSITION REQUIREMENTS:",
      "- Emphasize immediate reaction after regain/loss (first 3-6 seconds).",
      "- Constraints should reward fast counter/secure-first-pass after regain and immediate counterpress after loss.",
      "- Coaching points must include first action quality, supporting runs, and reaction speed.",
      "- Diagram should show regain events, counter lanes, and recovery/counterpress movement.",
      "- Avoid long settled-possession phases as the main objective.",
    ].join("\n");
  }

  return [
    ...common,
    "COACHAI REQUIREMENTS:",
    "- Use a balanced profile across possession, pressing, and transition moments.",
    "- Constraints should include at least one trigger from each moment type.",
    "- Coaching points must connect when to keep the ball vs when to attack quickly vs when to press.",
    "- Diagram should show mixed moments (build, loss, regain, finish).",
  ].join("\n");
}

function getPhaseGuidance(phase: string, zone: string): string {
  const base = [
    `PHASE LOCK RULES (MANDATORY): phase=${phase}, zone=${zone}`,
    "- Add at least 2 phase-specific constraints and 2 phase-specific coaching cues.",
    "- Diagram arrows must include at least one phase-defining action sequence.",
  ];

  if (phase === "ATTACKING") {
    return [
      ...base,
      "ATTACKING REQUIREMENTS:",
      "- Focus on progression, chance creation, and final action quality.",
      "- Include cues for support depth/width and timing of final-third actions.",
    ].join("\n");
  }

  if (phase === "DEFENDING") {
    return [
      ...base,
      "DEFENDING REQUIREMENTS:",
      "- Focus on compactness, delay/channel, pressure-cover-balance, and protection of key space.",
      "- Include cues for line distances and deny/force direction.",
    ].join("\n");
  }

  if (phase === "TRANSITION_TO_ATTACK") {
    return [
      ...base,
      "TRANSITION_TO_ATTACK REQUIREMENTS:",
      "- Focus on first action after regain (0-6 seconds): secure then exploit space quickly.",
      "- Include cues for support runs, first forward pass quality, and fast decision timing.",
    ].join("\n");
  }

  if (phase === "TRANSITION_TO_DEFEND") {
    return [
      ...base,
      "TRANSITION_TO_DEFEND REQUIREMENTS:",
      "- Focus on immediate reaction after loss (0-6 seconds): counterpress or recover shape.",
      "- Include cues for nearest-player pressure and second-line recovery responsibilities.",
    ].join("\n");
  }

  return [
    ...base,
    "TRANSITION REQUIREMENTS:",
    "- Include both regain-to-attack and loss-to-defend moments in repeated cycles.",
    "- Enforce rapid decision-making around role switches.",
  ].join("\n");
}

/**
 * Optimized generator prompt - conservative 35% reduction while maintaining quality
 */
export function buildDrillPrompt(input: DrillPromptInput): string {
  const ctx = JSON.stringify(input, null, 2);

  // Build drill type-specific guidance
  const drillTypeGuidance = getDrillTypeGuidance(input.drillType, input.ageGroup, input.playerLevel);
  const gameModelGuidance = getGameModelGuidance(
    input.gameModelId,
    input.phase,
    input.zone
  );
  const phaseGuidance = getPhaseGuidance(input.phase, input.zone);

  return [
    "SYSTEM: Output ONE JSON object matching the structure below.",
    "Hard rules:",
    "- organization MUST be an object (with setupSteps, area, rotation, restarts, scoring).",
    "- Use 'diagram' (NOT 'diagramV1').",
    "- Use 'progressions' array (NOT 'progression').",
    "- diagram MUST include arrows and annotations arrays (even if minimal).",
    "- annotations MUST include fontSize, color (rgba), and fontWeight.",
    "- diagram.pitch.showZones MUST be false (avoid auto-zone overlap).",
    "- Do NOT wrap JSON in markdown or add comments.",
    "- constraints MUST be non-empty (2-5 items) and include model-specific behavior for gameModelId.",
    "",
    "INPUT:", ctx,
    "",
    "⚠️ DRILL TYPE: " + input.drillType + " - This SIGNIFICANTLY changes the drill structure and content:",
    drillTypeGuidance,
    "",
    "⚠️ GAME MODEL LOCK:",
    gameModelGuidance,
    "",
    "⚠️ PHASE LOCK:",
    phaseGuidance,
    "",
    "IMPORTANT: Example below is for STRUCTURE only. Do NOT copy possession behavior unless gameModelId=POSSESSION.",
    "",
    "EXAMPLE OUTPUT (copy this structure EXACTLY - this scores Structure=4, Clarity=4+):",
    JSON.stringify({
      title: "4v4+GK Possession Game in Final Third",
      ageGroup: "U10",
      description: "Attackers maintain possession and create scoring chances through quick passing combinations. Defenders press to win the ball and counter-attack immediately when possession is gained.",
      organization: {
        setupSteps: [
          "Mark a 35x25 yard rectangular area using cones",
          "Place two mini-goals 10 yards apart on one end line",
          "Place one full-size goal with goalkeeper on the opposite end",
          "Divide 9 players into two teams: 4 attackers (blue), 4 defenders (red), 1 goalkeeper",
          "Position attackers in their specified attacking formation within the area",
          "Position defenders in their specified defending formation to mark attackers closely",
          "Coach stands at the sideline with multiple balls ready",
          "Start play with coach passing ball to an attacking player"
        ],
        area: { lengthYards: 35, widthYards: 25, notes: "Attacking third of field" },  // NOTE: 35 and 25 are NUMBERS, not strings "35" or "25"
        rotation: "After 2 goals scored, attackers become defenders, defenders rest on sideline, resting players rotate in as new attackers",
        restarts: "Coach passes ball to attacking midfielder after each goal, out of bounds, or stoppage",
        scoring: "Attackers score 1 point per goal in mini-goals, 2 points for goal in large goal. Defenders score 1 point for winning ball and scoring in large goal."
      },
      progressions: ["Add one recovering defender who joins after 3 passes", "Require minimum 5 passes before shooting"],
      coachingPoints: [
        "Scan the field before receiving the ball",
        "Use body shape to protect the ball from defenders",
        "Look for quick combination play in tight spaces"
      ],
      loadNotes: {
        structure: "6 x 2:00 / 1:00 rest (1:0.5 work:rest ratio)",
        rationale: "Suitable for U10 players with 2-minute work periods and equal rest to maintain intensity and focus"
      },
      diagram: {
        pitch: { variant: "HALF", orientation: "HORIZONTAL", showZones: false },
        players: [],
        goals: [],
        arrows: [
          { id: "arr1", from: { x: 20, y: 50 }, to: { x: 40, y: 45 }, type: "pass", label: "1" },
          { id: "arr2", from: { x: 40, y: 45 }, to: { x: 30, y: 35 }, type: "press" }
        ],
        annotations: [
          { id: "ann1", text: "PRESS TRIGGER", x: 30, y: 30, fontSize: 10, color: "rgba(239, 68, 68, 0.95)" },
          { id: "ann2", text: "STAY COMPACT", x: 55, y: 55, fontSize: 10, color: "rgba(251, 191, 36, 0.95)" }
        ]
      },
      numbersOnField: { attackersOnField: 4, defendersOnField: 4, gkForDefend: true, totalPlayersOnField: 9 }
    }, null, 2),
    "",
    "⚠️ CRITICAL: Structure/Clarity score 4+ REQUIRES ALL of these (missing any = score 2-3):",
    "",
    "1. organization object (MANDATORY - structure fails if missing or string):",
    "   - setupSteps: MUST be 5–8 steps. EACH starts with verb (Mark, Place, Split, Position, Start, Rotate, etc.).",
    "     ❌ BAD: 'Set up the field', 'Organize players', 'Start the drill'",
    "     ✅ GOOD: 'Mark a 35x25 yard rectangular area using cones', 'Divide 9 players into two teams: 4 attackers (blue), 4 defenders (red)'",
    "     Must cover ALL: (1) space/area setup, (2) goal placement, (3) player distribution/teams, (4) starting positions, (5) restart location/coach position",
    "   - area: MUST be object {lengthYards: number, widthYards: number, notes?: string}.",
    "     ⚠️ CRITICAL FOR CLARITY: lengthYards and widthYards MUST be NUMBERS (not strings, not null, not undefined).",
    "     ❌ WRONG (causes clarity=2): {lengthYards: \"35\", widthYards: \"25\"} or {lengthYards: null}",
    "     ✅ CORRECT: {lengthYards: 35, widthYards: 25} (both are numbers)",
    "     Use realistic dimensions for " + input.spaceConstraint + " (HALF≈35x25, THIRD≈25x20, QUARTER≈20x15).",
    "   - rotation: MUST be explicit who rotates when (e.g., 'After 2 goals: attackers become defenders, defenders rest, resting players rotate in').",
    "   - restarts: MUST state exactly how ball restarts (e.g., 'Coach passes to attacking midfielder after goal or out of bounds').",
    "   - scoring: MUST have clear scoring rules (e.g., '+1 per goal in mini-goals, +2 for goal in large goal').",
    "2. Use 'diagram' NOT 'diagramV1'.",
    "3. Use 'progressions' array (2–4 items) NOT 'progression'.",
    "4. ⚠️ AGE CONSISTENCY (causes clarity=2 if wrong): ALL age mentions MUST equal " + input.ageGroup + " exactly.",
    "   Check: description, organization.setupSteps, organization.area.notes, loadNotes.rationale, coachingPoints.",
    "   ❌ WRONG: Mentioning U12, U14, or any other age in a " + input.ageGroup + " drill",
    "   ✅ CORRECT: Only mention " + input.ageGroup + " throughout the entire drill",
    "5. ⚠️ PLAYER COUNT CONSISTENCY (causes clarity=2 if inconsistent):",
    "   The SAME numbers must appear in: description text, organization.setupSteps, diagram.players array, numbersOnField object.",
    "   Example: If description says '4v4+GK', then setupSteps must say '4 attackers, 4 defenders, 1 GK',",
    "   diagram must have 9 players total, and numbersOnField must be {attackersOnField: 4, defendersOnField: 4, gkForDefend: true, totalPlayersOnField: 9}",
    "6. FORMATIONS:",
    "   - Attacking formation: " + input.formationAttacking + " → ATT team roles (e.g., 4-3-3 uses ST/LW/RW, not generic 'forward').",
    "   - Defending formation: " + input.formationDefending + " → DEF team roles (e.g., 4-4-2 uses CB/LB/RB, not generic 'defender').",
    "   - Position players in diagram according to their team's formation.",
    "7. playerLevel=" + input.playerLevel + ": BEGINNER=simple, INTERMEDIATE=some combinations, ADVANCED=complex, game-realistic.",
    "8. coachLevel=" + input.coachLevel + ": GRASSROOTS=simple language, USSF_C=moderate detail, USSF_B_PLUS=advanced tactical detail.",
    "9. spaceConstraint=" + input.spaceConstraint + " sets area size; goalsAvailable=" + input.goalsAvailable + " sets goalMode (0=NONE, 1=LARGE, 2+=MINI2).",
    "10. diagram MUST include arrows and annotations arrays. Include 7-10 arrows and 4-6 annotations (each annotation must include fontSize, color, fontWeight).",
    "11. diagram.players MUST include EVERY player described in organization.setupSteps (no partial scenario diagrams).",
    "12. diagram.pitch.showZones MUST be false.",
    "13. diagram.pitch.orientation MUST match the data: goals on top/bottom => VERTICAL, goals on left/right => HORIZONTAL.",
    "14. gameModelId MUST be visible in behaviors:",
    "   - POSSESSION: circulation/overloads/line breaks dominate.",
    "   - PRESSING: triggers/angles/compact regains dominate.",
    "   - TRANSITION: regain-loss reaction windows dominate.",
    "   - COACHAI: balanced moments with explicit switching logic.",
    "   If these are missing, this is a gameModel failure.",
    "15. constraints MUST be 2-5 concrete rules and include at least one explicit gameModel cue.",
    "16. phase MUST be visible in drill behavior:",
    "   - ATTACKING: progression/chance creation/finishing cues.",
    "   - DEFENDING: compactness/channeling/protection cues.",
    "   - TRANSITION_TO_ATTACK: first action after regain cues.",
    "   - TRANSITION_TO_DEFEND: immediate reaction after loss cues.",
    "   - TRANSITION: both transition directions in the same drill flow.",
    "",
    "REQUIRED FIELDS:",
    "{",
    '  "title": string, "ageGroup": "' + input.ageGroup + '", "phase": "' + input.phase + '", "zone": "' + input.zone + '",',
    '  "gameModelId": "' + input.gameModelId + '", "formationAttacking": "' + input.formationAttacking + '", "formationDefending": "' + input.formationDefending + '",',
    '  "playerLevel": "' + input.playerLevel + '", "coachLevel": "' + input.coachLevel + '",',
    '  "description": string,  // MUST be ≥40 chars. 2-3 sentences explaining what players DO (actions, not just objective).',
    '    // ❌ BAD: "A possession game in the final third"',
    '    // ✅ GOOD: "Attackers maintain possession and create scoring chances through quick passing combinations. Defenders press to win the ball and counter-attack immediately."',
    '  "organization": {  // MUST be an object (NOT a string)',
    '    "setupSteps": string[],  // 5-8 clear steps, each starts with a verb and describes concrete coachable actions',
    '    "area": {"lengthYards": number, "widthYards": number, "notes"?: string},',
    '    "rotation": string,  // Who rotates when',
    '    "restarts": string,  // How ball restarts',
    '    "scoring": string    // Scoring rules',
    '  },',
    '  "progressions": string[],  // 2-4 progressions that clearly build complexity',
    '  "constraints": string[],   // 2-5 constraints that shape player behavior (not just generic rules)',
    '  "coachingPoints": string[],  // MUST have ≥3 specific, actionable points. Each should be a coachable cue.',
    '    // ✅ GOOD: ["Scan the field before receiving the ball", "Use body shape to protect the ball from defenders", "Look for quick combination play in tight spaces"]',
    '    // ❌ BAD: ["Pass the ball", "Work hard", "Play well"]',
    '  "psychTheme": string, "equipment": string[],',
    '  "loadNotes": {', 
    '    "structure": string,  // MUST be explicit like "6 x 2:00 / 1:00 rest (1:0.5)" or "8 x 90s / 90s rest (1:1)"',
    '    "rationale": string   // why this load suits ' + input.ageGroup + ' and ' + input.playerLevel,
    '  },',
    '  "teamShape": {',
    '    "formation": string,',
    '    "attackRoles": [{"role": string, "line": "last"|"back"|"middle"|"front", "side": "left"|"right"|"central"}],',
    '    "defendRoles": [...], "notes": string',
    '  },',
    '  "numbersOnField": {',
    '    "attackersOnField": number, "defendersOnField": number, "neutralsOnField": number,',
    '    "gkForAttack": boolean, "gkForDefend": boolean,',
    '    "totalPlayersOnField": number  // Must be within [' + input.numbersMin + ', ' + input.numbersMax + ']',
    '  },',
    '  "roleUsage": {"activeAttackRoles": string[], "activeDefendRoles": string[], "activeNeutralRoles": string[], "notes": string},',
    '  "diagram": {',
    '    "pitch": {"variant": "FULL"|"HALF"|"THIRD"|"QUARTER", "orientation": "HORIZONTAL"|"VERTICAL", "showZones": false},',
    '    "players": [{"id": string, "number": number, "team": "ATT"|"DEF"|"NEUTRAL", "role": string, "x": number, "y": number, "facingAngle": number}],',
    '    "coach": {"x": number, "y": number, "label": "Coach", "note": string},',
    '    "arrows": [{"id": string, "from": {"playerId"?: string, "x"?: number, "y"?: number}, "to": {"playerId"?: string, "x"?: number, "y"?: number}, "type": "pass"|"run"|"press"|"movement", "label"?: string, "color"?: string}], // 7-10 arrows',
    '    "annotations": [{"id": string, "text": string, "x": number, "y": number, "fontSize": number, "color": string, "fontWeight": string, "backgroundColor"?: string}], // 4-6 annotations',
    '    "safeZones": [{"id": string, "x": number, "y": number, "width": number, "height": number, "team": "ATT"|"DEF"|"NEUTRAL", "label"?: string}], // 1-3 zones',
    '    "goals": [{"id": string, "type": "BIG"|"MINI", "width": number, "x": number, "y": number, "facingAngle": number, "teamAttacks": "ATT"|"DEF"|"NEUTRAL"}]',
    '  },',
    '  "goalMode": string, "goalsAvailable": ' + input.goalsAvailable + ', "gkOptional": ' + (input.gkOptional ? 'true' : 'false'),
    '}',
    "",
    "DIAGRAM: ATT attacks bottom→top (y: 80→10), x: 0–100. Position ATT players per formationAttacking=" + input.formationAttacking + ". Position DEF players per formationDefending=" + input.formationDefending + ". DEF faces 180° for pressing. Keep spacing realistic and age-appropriate.",
    "",
    "⚠️ VALIDATION CHECKLIST - Run this BEFORE outputting JSON (ALL must pass or clarity=2):",
    "",
    "STEP 1: Check organization.area:",
    "  - lengthYards must be a NUMBER (typeof lengthYards === 'number')",
    "  - widthYards must be a NUMBER (typeof widthYards === 'number')",
    "  - ❌ FAILS if: lengthYards is string, null, undefined, or missing",
    "  - ✅ PASSES if: {lengthYards: 35, widthYards: 25} (both are numbers)",
    "",
    "STEP 2: Check age consistency:",
    "  - Search entire JSON for age patterns (U8, U9, U10, U11, U12, U13, U14, U15, U16, U17, U18)",
    "  - ALL must equal " + input.ageGroup + " exactly",
    "  - Check: description, organization.setupSteps (each step), organization.area.notes, loadNotes.rationale, coachingPoints",
    "",
    "STEP 3: Check player count consistency:",
    "  - Extract numbers from description (e.g., '4v4+GK' = 9 total)",
    "  - Extract numbers from organization.setupSteps (e.g., '4 attackers, 4 defenders, 1 GK' = 9 total)",
    "  - Check numbersOnField.totalPlayersOnField",
    "  - ALL must match exactly, and diagram.players length must equal the total",
    "",
    "STEP 4: Verify structure:",
    "  - organization is OBJECT (not string)",
    "  - setupSteps is array with 5-8 items, each starts with verb",
    "  - rotation, restarts, scoring are non-empty strings",
    "  - Using 'diagram' (not 'diagramV1'), 'progressions' array (not 'progression')",
    "",
    "OUTPUT: Raw JSON only (no markdown wrapper, no ```json). If ANY validation step fails, fix it before outputting."
  ].join("\n");
}

/**
 * Optimized QA reviewer prompt
 */
export function buildQAReviewerPrompt(drill: any): string {
  const prettyDrill = JSON.stringify(drill, null, 2);

  return [
    "You are CoachAI-Reviewer, a UEFA A-license coach.",
    "Review this drill JSON and return ONLY JSON:",
    "{",
    '  "pass": boolean,',
    '  "scores": {"structure": number, "gameModel": number, "phase": number, "psych": number, "clarity": number, "realism": number, "constraints": number, "safety": number},',
    '  "summary": string,',
    '  "notes": string[]',
    "}",
    "",
    "Scoring (1-5): 1=broken, 2=serious issues, 3=fixable, 4=strong, 5=excellent.",
    "",
    "STRUCTURE (rate structure, not just content):",
    "- 5: organization.setupSteps (5–8) give a complete, coachable sequence (space, numbers, roles, start/restart, rotation).",
    "- 3: some structure present but important details missing (e.g., unclear rotation or restarts).",
    "- 1–2: organization missing, string-only, or unusably vague.",
    "",
    "GAMEMODEL (rate alignment with drill.gameModelId):",
    "- 5: Drill behaviors, constraints, coaching points, and diagram all clearly express the selected model.",
    "- 4: Mostly aligned with one or two weak spots.",
    "- 3: Mixed or generic; model label present but behaviors are weak.",
    "- 1-2: Model mismatch (e.g., possession drill labeled PRESSING) or no model-specific cues.",
    "",
    "PHASE (rate alignment with drill.phase):",
    "- 5: Drill actions and constraints clearly match phase intent and decision moments.",
    "- 4: Mostly phase-aligned with minor drift.",
    "- 3: Phase referenced but behavior is generic.",
    "- 1-2: Phase mismatch (e.g., ATTACKING label but defending-first behaviors dominate).",
    "",
    "CLARITY (score based on how easy it is for a coach to run the drill):",
    "",
    "Score 5 (excellent):",
    "- organization.setupSteps has 5-8 clear, verb-starting steps",
    "- organization.area has numeric lengthYards AND widthYards (both numbers)",
    "- organization.rotation, restarts, scoring are clear, non-empty strings",
    "- No age mismatches (all mentions = drill.ageGroup)",
    "- Player counts are consistent across fields",
    "- No forbidden keys (uses 'diagram', 'progressions' array)",
    "- diagram includes arrows[] and annotations[] (both present, not empty)",
    "",
    "Score 4 (strong):",
    "- Most clarity requirements met, minor issues (e.g., one age mention off, slight count inconsistency)",
    "- SetupSteps might be 4 or 9 instead of 5-8, but still clear",
    "- Area fields are numbers, rotation/restarts/scoring present but could be slightly clearer",
    "",
    "Score 3 (fixable):",
    "- Basic structure present but some clarity issues (e.g., area as strings, unclear rotation)",
    "- Age mismatches in non-critical fields",
    "- Player counts mostly consistent with minor discrepancies",
    "",
    "Score 2 (serious issues) ONLY if:",
    "- organization.area is missing OR lengthYards/widthYards are strings (not numbers)",
    "- organization.rotation, restarts, or scoring are missing or empty",
    "- Multiple age mismatches in critical fields (description, setupSteps)",
    "- Major player count inconsistencies (e.g., description says 4v4 but numbersOnField says 12)",
    "- Forbidden keys present (diagramV1, progression instead of progressions)",
    "- diagram missing arrows/annotations arrays",
    "",
    "IMPORTANT: If organization object exists with setupSteps, area (numeric), rotation, restarts, scoring,",
    "and only minor issues (e.g., one age mention off, slight count difference), score 3-4, NOT 2.",
    "",
    "DRILL JSON:",
    prettyDrill
  ].join("\n");
}
