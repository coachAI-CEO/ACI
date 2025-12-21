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
  
  formationUsed: string;
  playerLevel: string;
  coachLevel: string;
}

/**
 * Optimized generator prompt - ~40% shorter while maintaining quality
 */
export function buildDrillPrompt(input: DrillPromptInput): string {
  const ctx = JSON.stringify(input, null, 2);

  return [
    "SYSTEM: Output JSON matching the structure below. Use 'diagram' (not 'diagramV1'), 'progressions' array (not 'progression'), and 'organization' as object.",
    "",
    "INPUT:", ctx,
    "",
    "EXAMPLE STRUCTURE:",
    JSON.stringify({
      title: "4v4+GK Possession Game in Final Third",
      ageGroup: "U10",
      description: "Attackers keep possession to create chances. Defenders win ball and counter.",
      organization: {
        setupSteps: [
          "Mark a 35x25 yard area with cones",
          "Place two mini-goals on one end, 10 yards apart",
          "Place one large goal on opposite end with GK",
          "Split 9 players: 4 attackers, 4 defenders, 1 GK",
          "Position attackers in 2-2 shape",
          "Start with coach pass to attacker"
        ],
        area: { lengthYards: 35, widthYards: 25, notes: "Attacking third" },
        rotation: "After 2 goals: attackers→defenders→rest→attackers",
        restarts: "Coach passes to attacker after goal",
        scoring: "+1 per goal, +2 for one-touch finish"
      },
      progressions: ["Add recovering defender", "Require 5 passes minimum"],
      diagram: { pitch: { variant: "HALF" }, players: [], goals: [] },
      numbersOnField: { attackersOnField: 4, defendersOnField: 4, gkForDefend: true, totalPlayersOnField: 9 }
    }, null, 2),
    "",
    "CRITICAL RULES:",
    "1. organization MUST be object with: setupSteps (5-8 verb-starting steps), area (lengthYards/widthYards), rotation, restarts, scoring",
    "2. Use 'diagram' NOT 'diagramV1', 'progressions' array NOT 'progression'",
    "3. ALL age mentions = " + input.ageGroup + " (check description, organization, loadNotes)",
    "4. Player counts consistent: description = organization = diagram = numbersOnField",
    "5. formationUsed=" + input.formationUsed + " determines roles (e.g., 4-3-3 uses ST/LW/RW, not generic 'forward')",
    "6. playerLevel=" + input.playerLevel + ": BEGINNER=simple patterns, INTERMEDIATE=combinations, ADVANCED=complex decisions",
    "7. coachLevel=" + input.coachLevel + ": GRASSROOTS=simple language, USSF_C=moderate detail, USSF_B_PLUS=advanced tactics",
    "8. spaceConstraint=" + input.spaceConstraint + " determines area size (FULL/HALF/THIRD/QUARTER)",
    "9. goalsAvailable=" + input.goalsAvailable + " → goalMode: 0=NONE, 1=LARGE, 2+=MINI2",
    "",
    "REQUIRED FIELDS:",
    "{",
    '  "title": string,',
    '  "ageGroup": "' + input.ageGroup + '",',
    '  "phase": "' + input.phase + '",',
    '  "zone": "' + input.zone + '",',
    '  "gameModelId": "' + input.gameModelId + '",',
    '  "formationUsed": "' + input.formationUsed + '",',
    '  "playerLevel": "' + input.playerLevel + '",',
    '  "coachLevel": "' + input.coachLevel + '",',
    '  "description": string,  // Max 3 sentences',
    '  "organization": {',
    '    "setupSteps": string[],  // 5-8 steps, each starts with verb',
    '    "area": {"lengthYards": number, "widthYards": number, "notes"?: string},',
    '    "rotation": string,  // Who rotates when',
    '    "restarts": string,  // How ball restarts',
    '    "scoring": string    // Scoring rules',
    '  },',
    '  "progressions": string[],  // 2-4 progressions',
    '  "constraints": string[],',
    '  "coachingPoints": string[],',
    '  "psychTheme": string,',
    '  "equipment": string[],',
    '  "loadNotes": {',
    '    "structure": string,  // e.g., "6 x 2:00 / 1:00 rest (1:0.5)"',
    '    "rationale": string',
    '  },',
    '  "teamShape": {',
    '    "formation": string,',
    '    "attackRoles": [{"role": string, "line": "last"|"back"|"middle"|"front", "side": "left"|"right"|"central"}],',
    '    "defendRoles": [...],',
    '    "notes": string',
    '  },',
    '  "numbersOnField": {',
    '    "attackersOnField": number,',
    '    "defendersOnField": number,',
    '    "neutralsOnField": number,',
    '    "gkForAttack": boolean,',
    '    "gkForDefend": boolean,',
    '    "totalPlayersOnField": number  // Must be within [' + input.numbersMin + ', ' + input.numbersMax + ']',
    '  },',
    '  "roleUsage": {',
    '    "activeAttackRoles": string[],',
    '    "activeDefendRoles": string[],',
    '    "activeNeutralRoles": string[],',
    '    "notes": string',
    '  },',
    '  "diagram": {',
    '    "pitch": {"variant": "FULL"|"HALF"|"THIRD"|"QUARTER", "orientation": "HORIZONTAL", "showZones": boolean, "zones": {...}},',
    '    "players": [{"id": string, "number": number, "team": "ATT"|"DEF"|"NEUTRAL", "role": string, "x": number, "y": number, "facingAngle": number}],',
    '    "coach": {"x": number, "y": number, "label": "Coach", "note": string},',
    '    "arrows": [{"from": {"playerId": string}, "to": {"playerId": string}, "type": "pass"|"run"|"press"}],',
    '    "goals": [{"id": string, "type": "BIG"|"MINI", "width": number, "x": number, "y": number, "facingAngle": number, "teamAttacks": "ATT"|"DEF"|"NEUTRAL"}]',
    '  },',
    '  "goalMode": string,',
    '  "goalsAvailable": ' + input.goalsAvailable + ',',
    '  "gkOptional": ' + (input.gkOptional ? 'true' : 'false'),
    '}',
    "",
    "DIAGRAM: ATT attacks bottom→top (y: 80→10), x: 0-100 (left→right). Position roles per formationUsed. DEF faces down (180°) for pressing.",
    "",
    "OUTPUT: Raw JSON only (no markdown wrapper). Verify: organization=object, age=" + input.ageGroup + " everywhere, counts consistent, 'diagram' not 'diagramV1', 'progressions' not 'progression'."
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
    "Scoring (1-5): 1=broken, 2=serious issues, 3=fixable, 4=strong, 5=excellent",
    "",
    "CLARITY (score 5 if all true, 1-2 if any false):",
    "✓ organization.setupSteps exists (5-8 verb-starting steps)",
    "✓ organization.area has numeric lengthYards/widthYards",
    "✓ organization.rotation/restarts/scoring are clear strings",
    "✓ NO age mismatches (all = drill.ageGroup)",
    "✓ Player counts consistent (description = organization = diagram)",
    "✓ NO duplicate keys (diagramV1, progression)",
    "✓ Has 'diagram' not 'diagramV1', 'progressions' array not 'progression'",
    "",
    "DRILL JSON:",
    prettyDrill
  ].join("\n");
}

