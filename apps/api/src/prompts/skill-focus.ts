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
    "- sectionPhrases: Provide 2-4 encourage and 2-4 correct phrases per section. Phrases should be in-depth:",
    "  - Specific and actionable (what to do, when, and why it helps).",
    "  - Include tactical or technical detail where relevant (e.g. body shape, scanning, passing angle).",
    "  - Avoid generic one-liners; aim for phrases a coach would actually say on the pitch.",
    "  - Reference the session theme and drill types where it fits.",
    "",
    "CONTEXT:",
    ctx,
  ].join("\n");
}
