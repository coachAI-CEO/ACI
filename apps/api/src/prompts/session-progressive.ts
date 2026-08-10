import type { SessionPromptInput } from "./session";
import { buildSessionPrompt } from "./session";

export type ProgressiveSessionPromptInput = SessionPromptInput & {
  sessionNumber: number;
  totalSessions: number;
  previousSessions?: any[];
};

export function buildProgressiveSessionPrompt(input: ProgressiveSessionPromptInput): string {
  const { sessionNumber, totalSessions, previousSessions = [], ...base } = input;
  const basePrompt = buildSessionPrompt(base);

  // Session 1 has nothing to progress from yet -- no prior sessions exist,
  // so there's nothing to differentiate against. Just generate normally.
  if (previousSessions.length === 0) {
    return [
      "SYSTEM: You are creating session 1 of a progressive training series.",
      `This is session ${sessionNumber} of ${totalSessions}. There is no prior session yet -- this one sets the foundation the rest of the series will build on.`,
      "",
      basePrompt,
    ].join("\n");
  }

  // Previously this was a single soft sentence ("should build on previous
  // sessions with progressive complexity") competing against the base
  // prompt's own TOPIC LOCK, which mandates the exact same topic string be
  // the anchor of EVERY session in the series with equal force each time.
  // With no comparably strong counter-instruction, sessions converged on
  // near-identical titles/content instead of actually progressing -- a
  // real series generated back-to-back came back with the identical title
  // twice. This section is now a MANDATORY LOCK, matching every other
  // instruction in this pipeline that actually needs to be followed
  // reliably rather than treated as a suggestion.
  const previousSummaries = previousSessions.map((s, idx) => {
    const cooldown = Array.isArray(s.drills)
      ? s.drills.find((d: any) => String(d.drillType || "").toUpperCase() === "COOLDOWN")
      : null;
    return {
      sessionNumber: idx + 1,
      title: s.title,
      summary: s.summary || s.sessionSummary,
      drills: Array.isArray(s.drills)
        ? s.drills.map((d: any) => ({
            drillType: d.drillType,
            title: d.title,
            focus: d.focus || d.coachingFocus || d.objective,
          }))
        : [],
      // What the coach was told to reinforce and watch for at the end of
      // THIS session -- the natural starting point for what session N+1
      // should build on, not just "harder version of the same drills."
      debriefKeyTakeaways: cooldown?.debrief?.keyTakeaways || [],
      debriefWatchFor: cooldown?.debrief?.watchFor || [],
    };
  });
  const previousContext = JSON.stringify(previousSummaries, null, 2);
  const lastSession = previousSummaries[previousSummaries.length - 1];

  // A general "don't reuse drill titles" rule alone wasn't enough -- a real
  // test series came back with the model swapping one word per drill title
  // ("Passing Activation..." -> "Dynamic Passing Activation...", "...Rest
  // Defense in Action" -> "...Rest Defense and Build-Up Application") while
  // treating that as sufficiently different. Naming the SPECIFIC prior
  // title next to the exact drill slot it must not resemble, per drill
  // type, is a much harder constraint to satisfy with a superficial
  // word-swap than one general instruction buried among several others.
  const titlesByDrillType = new Map<string, string[]>();
  for (const s of previousSummaries) {
    for (const d of s.drills) {
      if (!d.drillType || !d.title) continue;
      const existing = titlesByDrillType.get(d.drillType) || [];
      existing.push(d.title);
      titlesByDrillType.set(d.drillType, existing);
    }
  }
  const drillTitleConstraints = Array.from(titlesByDrillType.entries()).map(
    ([drillType, titles]) =>
      `- ${drillType} title must be genuinely different from ${titles.map((t) => `"${t}"`).join(", ")} -- not the same title with one word swapped or added (e.g. "Dynamic " prefixed, "Circuit" appended). Change the actual focus or framing, not just the wording.`
  );

  return [
    "SYSTEM: You are creating a progressive training series.",
    `This is session ${sessionNumber} of ${totalSessions}.`,
    "",
    "⚠️ SERIES PROGRESSION LOCK (MANDATORY):",
    `- Every prior session in this series is listed below, in order. Session ${sessionNumber - 1} (the immediately preceding session) is "${lastSession.title}" -- THIS session must be the next concrete step from there, not a restart and not a repeat.`,
    "- Do NOT reuse the same session title, the same drill titles, or the same specific framing as any prior session below -- read them first, then write something textually distinct. A coach flipping between sessions in this series should immediately see they're different sessions, not the same one twice.",
    "- 'Progressive' means each session goes one layer deeper into the same overall theme, not that it repeats the same layer with different wording. Concretely: if the previous session INTRODUCED a concept, this session should ADD a wrinkle to it (more opposition, a new decision, a combined pattern, tighter constraints) -- not teach the same introduction again.",
    `- Vary or increase difficulty across the series to match where session ${sessionNumber} of ${totalSessions} falls in the progression: more players, tighter space, added defensive pressure, faster required decisions, or a related-but-new sub-focus within the same theme.`,
    "- If a topic was specified for this series, treat it as the umbrella theme for ALL sessions, not one session's exact repeated content -- this session must cover a DIFFERENT angle or the next layer of that same theme versus what the prior sessions below already covered, not restate their content.",
    `- Each prior session below includes debriefKeyTakeaways and debriefWatchFor -- what the coach was told to reinforce and watch for at the end of THAT session. This session's content, especially the TACTICAL drill and its own debrief, should pick up from session ${sessionNumber - 1}'s debriefKeyTakeaways specifically -- treat them as the actual starting point for today, not background flavor.`,
    ...drillTitleConstraints,
    "",
    "Prior sessions in this series so far (read these before writing -- do not repeat their titles, drill titles, or framing):",
    previousContext,
    "",
    basePrompt,
    "",
    `⚠️ REMINDER (restated because it is the most-violated rule in series generation): this is session ${sessionNumber} of ${totalSessions} -- it must read as a distinct, progressive next step from "${lastSession.title}" above, never a near-duplicate of it. Every drill title above must also be genuinely different from its same-drill-type predecessor(s), not a one-word variant.`,
  ].join("\n");
}
