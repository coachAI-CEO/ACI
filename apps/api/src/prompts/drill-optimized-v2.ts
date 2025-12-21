export interface DrillPromptInput {
  gameModelId: string;
  ageGroup: string;
  phase: string;
  zone: string;
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
 * Optimized generator prompt - conservative 35% reduction while maintaining quality
 */
export function buildDrillPrompt(input: DrillPromptInput): string {
  const ctx = JSON.stringify(input, null, 2);

  return [
    "SYSTEM: Output ONE JSON object matching the structure below.",
    "Hard rules:",
    "- organization MUST be an object (with setupSteps, area, rotation, restarts, scoring).",
    "- Use 'diagram' (NOT 'diagramV1').",
    "- Use 'progressions' array (NOT 'progression').",
    "- Do NOT wrap JSON in markdown or add comments.",
    "",
    "INPUT:", ctx,
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
      diagram: { pitch: { variant: "HALF" }, players: [], goals: [] },
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
    '    "pitch": {"variant": "FULL"|"HALF"|"THIRD"|"QUARTER", "orientation": "HORIZONTAL", "showZones": boolean, "zones": {...}},',
    '    "players": [{"id": string, "number": number, "team": "ATT"|"DEF"|"NEUTRAL", "role": string, "x": number, "y": number, "facingAngle": number}],',
    '    "coach": {"x": number, "y": number, "label": "Coach", "note": string},',
    '    "arrows": [{"from": {"playerId": string}, "to": {"playerId": string}, "type": "pass"|"run"|"press"}],',
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
    "  - ALL must match exactly",
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
    '  "scores": {"structure": number, "gameModel": number, "psych": number, "clarity": number, "realism": number, "constraints": number, "safety": number},',
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
    "CLARITY (score based on how easy it is for a coach to run the drill):",
    "",
    "Score 5 (excellent):",
    "- organization.setupSteps has 5-8 clear, verb-starting steps",
    "- organization.area has numeric lengthYards AND widthYards (both numbers)",
    "- organization.rotation, restarts, scoring are clear, non-empty strings",
    "- No age mismatches (all mentions = drill.ageGroup)",
    "- Player counts are consistent across fields",
    "- No forbidden keys (uses 'diagram', 'progressions' array)",
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
    "",
    "IMPORTANT: If organization object exists with setupSteps, area (numeric), rotation, restarts, scoring,",
    "and only minor issues (e.g., one age mention off, slight count difference), score 3-4, NOT 2.",
    "",
    "DRILL JSON:",
    prettyDrill
  ].join("\n");
}

