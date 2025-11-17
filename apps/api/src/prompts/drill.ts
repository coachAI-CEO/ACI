export interface DrillPromptInput {
  gameModelId: string;
  ageGroup: string;
  phase: string;
  zone: string;
  numbersMin: number;
  numbersMax: number;
  gkOptional: boolean;
  goalsAvailable: number;
  spaceConstraint: string;
  durationMin?: number;
}

/**
 * Main generator prompt for a single drill.
 * We keep it structured and JSON-only to make parsing robust.
 */
export function buildDrillPrompt(input: DrillPromptInput): string {
  const ctx = JSON.stringify(input, null, 2);

  return [
    "You are CoachAI-Generator, a UEFA A-license coach who designs youth soccer training drills.",
    "",
    "Generate a single training drill in JSON format.",
    "",
    "Context (under the key 'input'):",
    ctx,
    "",
    "Return ONLY a single JSON object with this structure (no markdown, no comments):",
    "{",
    '  "title": string,',
    '  "ageGroup": string,',
    '  "phase": string,',
    '  "zone": string,',
    '  "gameModelId": string,',
    '  "numbers": { "min": number, "max": number },',
    '  "durationMin": number,',
    '  "description": string,',
    '  "organization": string,',
    '  "constraints": string[],',
    '  "progressions": string[],',
    '  "coachingPoints": string[],',
    '  "psychTheme": string,',
    '  "equipment": string[],',
    '  "diagram": {',
    '    "miniGoals": number',
    "  },",
    '  "goalMode": string,',
    '  "goalsAvailable": number,',
    '  "gkOptional": boolean',
    "}",
    "",
    "Constraints:",
    "- Use clear, runnable language that a grassroots coach can apply immediately.",
    "- Match realism and difficulty to the age group and numbers.",
    "- Align with the given game model and phase.",
    "- Do not include any text outside the JSON object."
  ].join("\n");
}

/**
 * QA reviewer prompt: returns a JSON QA report with scores 1–5.
 */
export function buildQAReviewerPrompt(drill: any): string {
  const prettyDrill = JSON.stringify(drill, null, 2);

  return [
    "You are CoachAI-Reviewer, a UEFA A-license coach with expertise in sport psychology and sport science.",
    "",
    "You will receive a single youth soccer training drill in JSON under the key 'drill'.",
    "Your job is to review the drill for structure, clarity, realism, safety, constraints, and alignment with the game model and psychological theme.",
    "",
    "Respond ONLY with a JSON object of the form:",
    "{",
    '  "pass": boolean,',
    '  "scores": {',
    '    "structure": number,',
    '    "gameModel": number,',
    '    "psych": number,',
    '    "clarity": number,',
    '    "realism": number,',
    '    "constraints": number,',
    '    "safety": number',
    "  },",
    '  "summary": string,',
    '  "notes": string[]',
    "}",
    "",
    "Scoring scale (1–5):",
    "1 = unusable / fundamentally broken.",
    "2 = serious issues; major rewrite required.",
    "3 = usable with clear fixes.",
    "4 = strong.",
    "5 = excellent, model quality.",
    "",
    "Here is the drill JSON to review under 'drill':",
    prettyDrill
  ].join("\n");
}
