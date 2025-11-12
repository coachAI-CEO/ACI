export function buildDrillPrompt(input: {
  titleHint?: string;
  gameModelId: "COACHAI" | "POSSESSION" | "PRESSING" | "TRANSITION";
  ageGroup: string;                // e.g., "U12"
  coachLevel: "novice" | "intermediate" | "advanced";
  playerLevel: "emerging" | "developing" | "competitive" | "elite";
  phase: "ATTACKING" | "DEFENDING" | "TRANSITION_TO_ATTACK" | "TRANSITION_TO_DEFEND";
  zone: "DEFENSIVE_THIRD" | "MIDDLE_THIRD" | "ATTACKING_THIRD";
  numbersMin: number;
  numbersMax: number;
  gkOptional?: boolean;
  goalsAvailable: 0 | 1 | 2;
  spaceConstraint: "FULL" | "HALF" | "THIRD" | "QUARTER";
  durationMin?: number;            // default to 25 if missing
}) {
  const dur = input.durationMin ?? 25;

  return `You are CoachAI Drill Architect.
Return ONLY valid JSON for a single drill with no markdown fences.

Requirements:
- Enforce game model: ${input.gameModelId}.
- Age group: ${input.ageGroup}; player level: ${input.playerLevel}; coach level: ${input.coachLevel}.
- Phase: ${input.phase}; Zone: ${input.zone}.
- Numbers available: min ${input.numbersMin}, max ${input.numbersMax}; GK optional: ${!!input.gkOptional}.
- Goals available: ${input.goalsAvailable}; Space: ${input.spaceConstraint}.
- Target duration: ${dur} minutes.

Output JSON fields (strict):
- "coachingPoints" MUST include at least one GK-specific point when goalsAvailable ≥ 1 (e.g., "GK: starting position & communication on cutbacks").
{
  "title": string,
  "objective": string,
  "organization": string,
  "setup": string,
  "constraints": string | string[],
  "progression": string[],
  "equipment": string[],
  "coachingPoints": string[],
  "phase": "${input.phase}",
  "zone": "${input.zone}",
  "age": "${input.ageGroup}",
  "goalsAvailable": ${input.goalsAvailable},
  "tags": string[],
  "gameModel": "${input.gameModelId}",
  "durationMin": ${dur},
  "diagram": {
    "pitch": "${input.spaceConstraint}",
    "teams": [
      {"label":"Attack","count": ${Math.ceil((input.numbersMin+input.numbersMax)/4)}, "color":"blue"},
      {"label":"Defend","count": ${Math.ceil((input.numbersMin+input.numbersMax)/5)}, "color":"red"}
    ],
    "channels": [],
    "miniGoals": ${input.goalsAvailable === 2 ? 2 : 0},
    "arrows": []
  },
  "psychTheme": {
    "theme": "See Next Action",
    "rationale": "Cues, scanning, and confidence aligned to ${input.gameModelId} principles for ${input.ageGroup}."
  }
}`;
}

export function buildQAReviewerPrompt(drillJson: any) {
  return `You are a UEFA A-License coach, expert in elite player development, sport psychology, and sport science.
Review the following drill JSON. Score each 1-5. Decide pass/fail. If fail, include mustFix array.

Return ONLY JSON:
{
  "scores": {
    "principleAlignment": 1-5,
    "ageAppropriateness": 1-5,
    "constraintsQuality": 1-5,
    "progressionsLogic": 1-5,
    "clarityForCoachLevel": 1-5,
    "gkIntegration": 1-5,
    "loadSafety": 1-5,
    "psychClimate": 1-5,
    "diagramCompleteness": 1-5
  },
  "mustFix": string[],
  "redFlags": string[],
  "pass": boolean,
  "summary": string,
  "loadNotes": {
    "blockMinutes": number,
    "workRest": string,
    "intensityGuide": string
  }
}

Drill to review:
${JSON.stringify(drillJson)}`;
}
