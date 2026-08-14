export type PhilosophyStageKey =
  | 'attackingOrganization'
  | 'defensiveTransition'
  | 'defensiveOrganization'
  | 'attackingTransition';

export type PhilosophyAssistMode = 'polish' | 'expand' | 'shorten' | 'draft' | 'align';

export const PHILOSOPHY_STAGE_META: Record<
  PhilosophyStageKey,
  { stageNumber: number; title: string; moment: string; coachQuestion: string; tips: string[] }
> = {
  attackingOrganization: {
    stageNumber: 1,
    title: 'Attacking Organization',
    moment: 'In possession',
    coachQuestion: 'How do we build, progress, and create when we have the ball?',
    tips: [
      'Name shape principles (width, depth, support angles).',
      'Say how we break lines (pass, dribble, third man).',
      'Define final-third intent in plain coach language.',
    ],
  },
  defensiveTransition: {
    stageNumber: 2,
    title: 'Defensive Transition',
    moment: 'On ball loss',
    coachQuestion: 'What is the first 3–6 second reaction after we lose the ball?',
    tips: [
      'Set a time window (e.g. 3–5 seconds).',
      'Clarify counterpress vs recover-to-shape triggers.',
      'Name who presses and who covers.',
    ],
  },
  defensiveOrganization: {
    stageNumber: 3,
    title: 'Defensive Organization',
    moment: 'Out of possession',
    coachQuestion: 'How do we deny progression and force predictable play?',
    tips: [
      'Describe compactness / line distances.',
      'Say where we want to force the opponent.',
      'Protect the space in behind explicitly.',
    ],
  },
  attackingTransition: {
    stageNumber: 4,
    title: 'Attacking Transition',
    moment: 'On ball regain',
    coachQuestion: 'What is the first action after we win the ball?',
    tips: [
      'First look forward if advantage exists.',
      'If not, secure and expand before the next penetration.',
      'Keep the window short and decisive.',
    ],
  },
};

export function buildClubPhilosophyAssistPrompt(input: {
  mode: PhilosophyAssistMode;
  stageKey: PhilosophyStageKey;
  gameModelId: string;
  clubName: string;
  currentText: string;
  notes?: string | null;
  otherStages?: Partial<Record<PhilosophyStageKey, string | null>>;
}): string {
  const meta = PHILOSOPHY_STAGE_META[input.stageKey];
  const other = input.otherStages || {};
  const modeInstruction: Record<PhilosophyAssistMode, string> = {
    polish:
      'Improve clarity, grammar, and coach-ready language. Keep the same intent and length band (±20%). Do not invent a new identity.',
    expand:
      'Expand into more actionable coaching detail (cues, roles, spatial principles) while staying faithful to the DOC intent. Target 4–8 sentences.',
    shorten:
      'Tighten into crisp coaching language. Keep the decisive rules. Target 2–4 sentences.',
    draft:
      'Draft a strong stage description from the notes and game model. If notes are thin, use sound principles for that game model — still write as club DNA, not generic filler.',
    align:
      'Rewrite so tone and principles align with the club game model and the other filled stages. Keep this stage’s unique moment focus.',
  };

  return [
    'SYSTEM: You are a Director of Coaching writing assistant for a youth/academy soccer club.',
    'Your job is to help the DOC write clear, actionable game-model DNA that will be injected into AI session generation as MANDATORY club philosophy.',
    'Write in direct coach language (imperatives and principles). Avoid marketing fluff, emojis, and bullet-symbol spam.',
    'Return ONLY the rewritten stage text as plain prose (1–3 short paragraphs or short sentences). No title, no markdown, no quotes wrapper.',
    '',
    `Club: ${input.clubName}`,
    `Locked game model: ${input.gameModelId}`,
    `Stage ${meta.stageNumber}: ${meta.title} (${meta.moment})`,
    `Stage focus question: ${meta.coachQuestion}`,
    `Assist mode: ${input.mode}`,
    `Mode instruction: ${modeInstruction[input.mode]}`,
    '',
    'Other stages (for consistency; do not rewrite them):',
    `- Attacking Organization: ${other.attackingOrganization || '(empty)'}`,
    `- Defensive Transition: ${other.defensiveTransition || '(empty)'}`,
    `- Defensive Organization: ${other.defensiveOrganization || '(empty)'}`,
    `- Attacking Transition: ${other.attackingTransition || '(empty)'}`,
    '',
    `Current stage draft:\n${input.currentText?.trim() || '(empty)'}`,
    '',
    `DOC notes / direction:\n${(input.notes || '').trim() || '(none)'}`,
    '',
    'Hard limits:',
    '- Max 3500 characters.',
    '- Stay inside this stage’s moment; do not cover all four stages in one answer.',
    '- Prefer concrete decisions coaches can train this week.',
  ].join('\n');
}
