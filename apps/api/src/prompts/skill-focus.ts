export type SkillFocusContext = {
  title?: string;
  ageGroup?: string;
  gameModelId?: string;
  coachLevel?: string | null;
  playerLevel?: string | null;
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
  const coachLevel = String(context.coachLevel || "").toUpperCase();
  const playerLevel = String(context.playerLevel || "").toUpperCase();
  const isGrassroots = coachLevel === "GRASSROOTS";

  return [
    "SYSTEM: You are a soccer coach assistant.",
    "Return ONE JSON object ONLY (no markdown) for a player coaching emphasis tied to this session or series.",
    "",
    "Output JSON format:",
    "{",
    '  "title": "Short coaching emphasis title",',
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
    `- Input coachLevel=${coachLevel || "UNKNOWN"}, playerLevel=${playerLevel || "UNKNOWN"} MUST be respected.`,
    isGrassroots
      ? "- GRASSROOTS PROFILE: use simple, positive, fun-first language. Corrections must be encouraging, short, and easy to execute."
      : "- USSF_C / USSF_B_PLUS PROFILE: use specific tactical/technical coaching language with clear corrective detail.",
    isGrassroots
      ? "- For corrections in GRASSROOTS: use 'try this', 'next rep', 'great idea, now...' style phrasing. Avoid harsh/negative tone."
      : "- For corrections in USSF_C/USSF_B_PLUS: include precise details (body shape, trigger, spacing, timing, pressing cue, cover angle).",
    isGrassroots
      ? "- For GRASSROOTS: prioritize confidence, enjoyment, repetition quality, and simple decision cues over dense tactical language."
      : "- For USSF_C/USSF_B_PLUS: keep cues specific to game moments and tactical consequences.",
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
