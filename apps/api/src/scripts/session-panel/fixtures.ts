import type { PanelFixture } from "./types";

/**
 * Core-session matrix. Age × license × topic — not one U12 possession cell.
 * Same seeds every run so a prompt change is a regression, not weather.
 */
export const PANEL_FIXTURES: PanelFixture[] = [
  {
    id: "u9-d-open-teammate",
    label: "U9 D · passing to the open teammate",
    input: {
      gameModelId: "POSSESSION",
      ageGroup: "U9",
      phase: "ATTACKING",
      zone: "MIDDLE_THIRD",
      numbersMin: 10,
      numbersMax: 14,
      goalsAvailable: 0,
      spaceConstraint: "QUARTER",
      durationMin: 60,
      formationAttacking: "2-3-1",
      formationDefending: "2-3-1",
      playerLevel: "BEGINNER",
      coachLevel: "USSF_D",
      topic: "Passing to the open teammate",
    },
    topicMeaning:
      "Young players learn to look up, find a teammate who is free, and pass to them. Not a textbook possession lecture.",
    topicSignals: [
      /open teammate/i,
      /teammate who is (open|free)/i,
      /pass to (the |an |your )?(open|free) (player|teammate)/i,
      /find (the |a |your )?(open|free) (player|teammate)/i,
      /player without a defender/i,
    ],
  },
  {
    id: "u11-d-support-nearby",
    label: "U11 D · teammate nearby who can help",
    input: {
      gameModelId: "POSSESSION",
      ageGroup: "U11",
      phase: "ATTACKING",
      zone: "MIDDLE_THIRD",
      numbersMin: 12,
      numbersMax: 16,
      goalsAvailable: 1,
      spaceConstraint: "HALF",
      durationMin: 90,
      formationAttacking: "3-2-3",
      formationDefending: "3-2-3",
      playerLevel: "BEGINNER",
      coachLevel: "USSF_D",
      topic: "Finding a teammate nearby who can help",
    },
    topicMeaning:
      "When you have the ball, someone close should be ready to help. Support is a place and a pass, not a jargon word.",
    topicSignals: [
      /nearby who can help/i,
      /teammate (nearby|close|next to you)/i,
      /someone close (enough )?to (help|pass)/i,
      /support(ing)? (angle|player|nearby)/i,
      /help(er)? (close|near|next)/i,
    ],
  },
  {
    id: "u12-c-around-press",
    label: "U12 C · playing around the first press",
    input: {
      gameModelId: "POSSESSION",
      ageGroup: "U12",
      phase: "ATTACKING",
      zone: "DEFENSIVE_THIRD",
      numbersMin: 12,
      numbersMax: 16,
      goalsAvailable: 1,
      spaceConstraint: "HALF",
      durationMin: 90,
      formationAttacking: "3-2-3",
      formationDefending: "3-2-3",
      playerLevel: "INTERMEDIATE",
      coachLevel: "USSF_C",
      topic: "Playing around the first press",
    },
    topicMeaning:
      "When the first defender steps, play around that pressure rather than through it. One named concept, taught in the next sentence.",
    topicSignals: [
      /around (the )?(first )?(press|pressure|presser)/i,
      /first (press|defender|presser) (steps|comes|presses)/i,
      /play(ed|ing)? around (the )?(pressure|press|them)/i,
      /when (they|a defender|the presser) steps/i,
    ],
  },
  {
    id: "u14-c-first-pass",
    label: "U14 C · first pass after we win it",
    input: {
      gameModelId: "TRANSITION",
      ageGroup: "U14",
      phase: "ATTACKING",
      zone: "MIDDLE_THIRD",
      numbersMin: 16,
      numbersMax: 22,
      goalsAvailable: 2,
      spaceConstraint: "HALF",
      durationMin: 90,
      formationAttacking: "4-3-3",
      formationDefending: "4-3-3",
      playerLevel: "INTERMEDIATE",
      coachLevel: "USSF_C",
      topic: "First pass after we win it",
    },
    topicMeaning:
      "The first pass after regain is the session. Direction, speed, and who is available — not a generic transition slogan.",
    topicSignals: [
      /first pass after (we |you )?(win|regain|win it)/i,
      /after (we |you )?(win|regain|win the ball)/i,
      /first (pass|action) after (the |a )?regain/i,
      /when (we |you )?win (the ball|it)/i,
      /first pass (forward|wide)/i,
      /winning possession must .{0,40}first pass/i,
    ],
  },
  {
    id: "u16-b-rest-defence",
    label: "U16 B+ · rest defence after we lose it",
    input: {
      gameModelId: "TRANSITION",
      ageGroup: "U16",
      phase: "DEFENDING",
      zone: "MIDDLE_THIRD",
      numbersMin: 16,
      numbersMax: 22,
      goalsAvailable: 2,
      spaceConstraint: "FULL",
      durationMin: 90,
      formationAttacking: "4-3-3",
      formationDefending: "4-3-3",
      playerLevel: "ADVANCED",
      coachLevel: "USSF_B_PLUS",
      topic: "Rest defence after we lose it in the middle third",
    },
    topicMeaning:
      "How we are already organized to protect the counter when we lose the ball in midfield. Systemic, connected to the next moment — not a rondo with 'rest defence' glued on.",
    topicSignals: [
      /rest[- ]defen[cs]e/i,
      /after (we |you )?lose (it|the ball)/i,
      /when (we |you )?lose (it|the ball) in (the )?middle/i,
      /protect(ing)? (against )?the counter/i,
      /cover (the )?(counter|break)/i,
    ],
  },
];

export function fixtureById(id: string): PanelFixture | undefined {
  return PANEL_FIXTURES.find((f) => f.id === id);
}
