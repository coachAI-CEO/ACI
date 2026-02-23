export interface VideoAnalysisPromptInput {
  ageGroup: string;
  playerLevel: string;
  coachLevel: string;
  formationUsed: string;
  gameModelId: string;
  phase: string;
  zone: string;
  focusTeamColor: string;
  opponentTeamColor?: string;
  minItems?: number;
  maxItems?: number;
}

function getScopedTacticalMission(gameModelId: string, phase: string, zone: string): string {
  if (gameModelId === "POSSESSION" && phase === "ATTACKING" && zone === "DEFENSIVE_THIRD") {
    return [
      "Primary tactical mission:",
      "- Build out from the back under pressure and progress cleanly into the middle third.",
      "- Evaluate passing lanes, support angles, body orientation, and recycle decisions in first/second phase build-up.",
      "- Treat long clearances and rushed vertical balls as tactical failure unless clearly necessary for safety.",
    ].join("\n");
  }

  if (gameModelId === "PRESSING" && phase === "DEFENDING") {
    return [
      "Primary tactical mission:",
      "- Regain possession through coordinated pressure, cover, and compactness.",
      "- Prioritize pressing triggers, lock-side behavior, and central-lane protection.",
    ].join("\n");
  }

  if (gameModelId === "TRANSITION") {
    return [
      "Primary tactical mission:",
      "- Judge the first 3-6 seconds after regain/loss and quality of immediate decisions.",
      "- Prioritize reaction speed, support distances, and next-action clarity.",
    ].join("\n");
  }

  return [
    "Primary tactical mission:",
    `- Keep analysis strictly aligned to ${gameModelId} behaviors inside phase=${phase} and zone=${zone}.`,
    "- Prioritize tactical actions that can be coached this week.",
  ].join("\n");
}

export function buildVideoAnalysisPrompt(input: VideoAnalysisPromptInput): string {
  const {
    ageGroup,
    playerLevel,
    coachLevel,
    formationUsed,
    gameModelId,
    phase,
    zone,
    focusTeamColor,
    opponentTeamColor = "unknown",
    minItems = 28,
    maxItems = 40,
  } = input;
  const scopedMission = getScopedTacticalMission(gameModelId, phase, zone);

  return [
    "You are an elite youth football analyst.",
    "Be very critical but constructive.",
    "Return ONLY valid JSON with no markdown.",
    "",
    "CONTEXT:",
    `- ageGroup=${ageGroup}`,
    `- playerLevel=${playerLevel}`,
    `- coachLevel=${coachLevel}`,
    `- formationUsed=${formationUsed}`,
    `- gameModelId=${gameModelId}`,
    `- phase=${phase}`,
    `- zone=${zone}`,
    `- focusTeamColor=${focusTeamColor}`,
    `- opponentTeamColor=${opponentTeamColor}`,
    "",
    scopedMission,
    "",
    "TACTICAL LOCK RULES (MANDATORY):",
    `- Keep all analysis aligned to gameModelId=${gameModelId}.`,
    `- Prioritize actions and observations in phase=${phase} and zone=${zone}.`,
    "- Classify every observation by scopeTag: IN_SCOPE | SUPPORTING | OUT_OF_SCOPE.",
    "- IN_SCOPE means directly tied to selected model+phase+zone tactical mission.",
    "- SUPPORTING means relevant but indirect.",
    "- OUT_OF_SCOPE means unrelated phase/zone/model context.",
    "- At least 70% of analysisArray items must be IN_SCOPE.",
    "- OUT_OF_SCOPE items must be at most 15% of analysisArray.",
    "- topPriorities must only use IN_SCOPE items.",
    "- Do not let broad all-phase commentary dominate output.",
    "",
    "TEAM LABELING RULES (MANDATORY AND STRICT):",
    `- Team A = focus team (${focusTeamColor}).`,
    `- Team B = opponent (${opponentTeamColor}).`,
    "- Do not use real names or personal identifiers.",
    "- You are STRICTLY FORBIDDEN from using jersey numbers. NEVER output '#25', '#12', or any other number to identify a player.",
    "- If you use a jersey number, the system will crash. Use role labels ONLY (e.g., 'Team A Striker', 'Team B Central Midfielder').",
    "- Use team unit labels and role labels only (example: Team A central midfielder, Team A fullback).",
    "",
    "FORMATION CONTEXT RULES (MANDATORY):",
    `- Team A formation for relational analysis: ${formationUsed}.`,
    "- Evaluate spacing, line heights, and role responsibilities relative to this shape.",
    "- If observed structure differs from the declared shape, state the mismatch and coaching implication.",
    "- Explicitly populate the 'matchFormat' (e.g., '7v7', '9v9', '11v11') and 'formation' fields inside the teamDefinition output.",
    "",
    "FOCUS TEAM EMPHASIS RULES (MANDATORY):",
    "- Timeline emphasis must stay on Team A development needs.",
    "- At least 75% of analysisArray items must be TEAM_A or BOTH focus.",
    "- TEAM_B-only items must be at most 15% of analysisArray.",
    "- Any TEAM_B-only observation must include a concrete Team A implication.",
    "- Even when describing opponent actions, frame what Team A should adjust next.",
    "",
    "ANIMATION CONTINUITY RULES (MANDATORY):",
    "- You are generating data for a continuous 2D tactical animation.",
    "- You MUST include the coordinates (x, y) for ALL PLAYERS on the pitch in EVERY single frame inside diagramFrames.",
    "- Deduce the match format from the formationUsed (e.g., '2-3-1' implies 7v7, meaning exactly 7 Team A players and 7 Team B players). Ensure the correct total number of players is present for BOTH teams in EVERY frame.",
    `- If Team B's formation is unclear or unknown, assume they are playing the exact same formation as Team A (${formationUsed}).`,
    "- Never omit a player just because they are away from the ball. Estimate their structural position based on the formation if off-screen.",
    "- Player IDs (e.g., 'A_CB_1', 'B_ST_1') MUST remain strictly identical across all frames to allow positional tracking.",
    "- Frames MUST be in strict chronological order to tell a complete story.",
    "",
    "SPATIAL ORIENTATION RULES (MANDATORY):",
    "- Coordinate system: x increases left->right, y increases top->bottom.",
    "- Team A attacks toward increasing x (to the right); Team B attacks toward decreasing x (to the left).",
    "- Team A 'left' roles (LB/LM/LW) should be lower y values than Team A 'right' roles (RB/RM/RW).",
    "- Team B is facing the opposite direction, so Team B 'left' roles must be higher y values (closer to bottom) than Team B 'right' roles.",
    "- Never mirror Team B left/right as if they shared Team A's orientation.",
    "",
    "OUTPUT JSON SCHEMA:",
    "{",
    '  "context": {"ageGroup": string, "playerLevel": string, "coachLevel": string, "formationUsed": string, "gameModelId": string, "phase": string, "zone": string, "focusTeamColor": string, "opponentTeamColor": string},',
    '  "teamDefinition": {"matchFormat": string, "focusTeam": {"label": "Team A", "color": string, "formation": string}, "opponentTeam": {"label": "Team B", "color": string, "formation": string}},',
    '  "overall": {"summary": string, "scopeSummary": string, "topPriorities": string[5], "videoQualityRisks": string[]},',
    '  "diagramFrames": [',
    "    {",
    '      "frameId": string,',
    '      "timestamp": string,',
    '      "coordinateSystem": {"unit": "PERCENT_0_100", "origin": "TOP_LEFT"},',
    '      "pitch": {"orientation": "HORIZONTAL" | "VERTICAL"},',
    '      "players": [',
    '        {"id": string, "team": "A" | "B", "role": string, "jersey": null, "x": number, "y": number}',
    "      ],",
    '      "ball": {"x": number, "y": number},',
    '      "arrows": [',
    '        {"type": "PASS" | "RUN" | "PRESS", "from": {"x": number, "y": number}, "to": {"x": number, "y": number}, "team": "A" | "B"}',
    "      ],",
    '      "notes": string',
    "    }",
    "  ],",
    '  "analysisArray": [',
    "    {",
    '      "id": string,',
    '      "category": "technical" | "tactical" | "decision-making" | "physical",',
    '      "scopeTag": "IN_SCOPE" | "SUPPORTING" | "OUT_OF_SCOPE",',
      '      "teamFocus": "TEAM_A" | "TEAM_B" | "BOTH" | "UNSPECIFIED",',
      '      "title": string,',
      '      "severity": "critical" | "major" | "minor",',
      '      "confidence": number,',
    '      "timestamp": string,',
    '      "whatHappened": string,',
    '      "teamAImplication": string,',
    '      "whyItMatters": string,',
    '      "coachingCue": string,',
    '      "microCorrection": string,',
    '      "u10Adaptation": string,',
    '      "diagramFrameIds": string[]',
    "    }",
    "  ],",
    '  "sessionRecommendations": [',
    '    {"focus": string, "durationMin": number, "objective": string, "constraints": string[], "successCriteria": string[]}',
    "  ]",
    "}",
    "",
    "ANALYSIS REQUIREMENTS:",
    `- analysisArray must contain ${minItems} to ${maxItems} items.`,
    "- Include all categories with at least 6 items each.",
    "- diagramFrames must contain 8 to 15 key moments from the clip.",
    "- You MUST generate at least 8 frames.",
    "- Do NOT compress the timeline into only a few snapshots.",
    "- Keep temporal continuity: avoid gaps larger than 5 seconds between consecutive frame timestamps when events exist in-between.",
    "- Map almost every major analysisArray event to its own unique frame whenever timestamps differ.",
    "- Avoid reusing the same frameId for unrelated events; create additional frames instead.",
    "- Every diagramFrames.*.players/ball/arrows coordinate must be numeric and normalized to 0..100.",
    "- Every diagram frame must include all players for Team A and Team B according to matchFormat/formation assumptions.",
    "- Keep player ids stable across frames to preserve identity tracking in animation pipelines.",
    "- diagramFrames must be chronologically ordered.",
    "- Every analysisArray item must reference at least one frameId in diagramFrameIds.",
    "- Keep drawings focused on Team A tactical actions in the selected scope.",
    "- teamFocus must be set for every analysis item.",
    "- teamAImplication is required and non-empty when teamFocus=TEAM_B.",
    "- STRICT SCHEMA ENFORCEMENT: Every single object inside analysisArray MUST contain all 15 fields defined in the schema. Do NOT omit 'scopeTag', 'teamFocus', 'teamAImplication', or 'diagramFrameIds'.",
    "- Do not include jersey numbers in title, narrative, cues, priorities, or notes.",
    "- First sentence of overall.summary must explicitly restate the tactical mission in plain language.",
    "- overall.scopeSummary must quantify how well Team A matched selected tactical mission.",
    "- Use exact timestamps/ranges from visible events.",
    "- Do not invent unseen events; lower confidence if uncertain.",
    "- Prioritize actions a coach can train this week.",
  ].join("\n");
}
