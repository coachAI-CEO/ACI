export type SkillFocusContext = {
  title?: string;
  ageGroup?: string;
  gameModelId?: string;
  phase?: string | null;
  zone?: string | null;
  durationMin?: number | null;
  sessionSummary?: string | null;
  drills?: Array<{ title?: string; drillType?: string; focus?: string }>;
  series?: Array<{
    title?: string;
    sessionSummary?: string | null;
    drills?: Array<{ title?: string; drillType?: string; focus?: string }>;
  }>;
};

export function buildSkillFocusPrompt(context: SkillFocusContext): string {
  const ctx = JSON.stringify(context, null, 2);
  return [
    "SYSTEM: You are a soccer coach assistant.",
    "Return ONE JSON object ONLY (no markdown) for a player skill focus tied to this session or series.",
    "",
    "Output JSON format:",
    "{",
    '  "title": "Short skill focus title",',
    '  "summary": "1-2 sentences on why this focus fits the session",',
    '  "keySkills": ["Skill 1", "Skill 2", "Skill 3"],',
    '  "coachingPoints": ["Point 1", "Point 2", "Point 3"],',
    '  "psychology": {',
    '    "good": ["What to do to encourage good behavior (coach actions)"],',
    '    "bad": ["How to correct or redirect bad behavior (coach actions)"]',
    "  }",
    '  "sectionPhrases": {',
    '    "warmup": { "encourage": ["..."], "correct": ["..."] },',
    '    "technical": { "encourage": ["..."], "correct": ["..."] },',
    '    "tactical": { "encourage": ["..."], "correct": ["..."] },',
    '    "conditioned_game": { "encourage": ["..."], "correct": ["..."] },',
    '    "cooldown": { "encourage": ["..."], "correct": ["..."] }',
    "  }",
    "}",
    "",
    "Constraints:",
    "- Make it age-appropriate.",
    "- Tailor the psychology guidance to skill level, age group, and game model.",
    "- Keep it specific to the session theme and drills.",
    "- Use 3-5 keySkills and 3-5 coachingPoints.",
    "- Provide 2-4 psychology.good and 2-4 psychology.bad items.",
    "- Each item must be an actionable coaching cue (what to do), not just an observation.",
    "- Provide 1-2 encourage and 1-2 correct phrases per section in sectionPhrases.",
    "",
    "CONTEXT:",
    ctx,
  ].join("\n");
}
