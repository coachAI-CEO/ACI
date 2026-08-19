export type CurriculumWeekDraft = {
  weekIndex: number;
  theme: string;
  moment: string;
  phase: string;
  zone: string;
  focus: string;
  notes: string;
};

export type CurriculumPlayerLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type CurriculumCoachLevel = "USSF_D" | "USSF_C" | "USSF_B_PLUS";
export type TeamBand = "NPL" | "NAVY" | "DEVELOPMENT";

type WeekSkeleton = {
  moment: string;
  phase: string;
  zone: string;
};

type WeekCopy = {
  theme: string;
  focus: string;
  notes: string;
};

const SKELETON: WeekSkeleton[] = [
  { moment: "attackingOrganization", phase: "ATTACKING", zone: "DEFENSIVE_THIRD" },
  { moment: "attackingOrganization", phase: "ATTACKING", zone: "MIDDLE_THIRD" },
  { moment: "attackingOrganization", phase: "ATTACKING", zone: "ATTACKING_THIRD" },
  { moment: "attackingTransition", phase: "TRANSITION", zone: "MIDDLE_THIRD" },
  { moment: "defensiveOrganization", phase: "DEFENDING", zone: "ATTACKING_THIRD" },
  { moment: "defensiveOrganization", phase: "DEFENDING", zone: "MIDDLE_THIRD" },
  { moment: "defensiveOrganization", phase: "DEFENDING", zone: "DEFENSIVE_THIRD" },
  { moment: "defensiveTransition", phase: "TRANSITION", zone: "MIDDLE_THIRD" },
  { moment: "attackingOrganization", phase: "ATTACKING", zone: "DEFENSIVE_THIRD" },
  { moment: "attackingOrganization", phase: "ATTACKING", zone: "MIDDLE_THIRD" },
  { moment: "attackingOrganization", phase: "ATTACKING", zone: "ATTACKING_THIRD" },
  { moment: "attackingTransition", phase: "TRANSITION", zone: "ATTACKING_THIRD" },
  { moment: "defensiveOrganization", phase: "DEFENDING", zone: "ATTACKING_THIRD" },
  { moment: "defensiveOrganization", phase: "DEFENDING", zone: "MIDDLE_THIRD" },
  { moment: "defensiveOrganization", phase: "DEFENDING", zone: "DEFENSIVE_THIRD" },
  { moment: "defensiveTransition", phase: "TRANSITION", zone: "DEFENSIVE_THIRD" },
];

export const CURRICULUM_WEEK_COUNT = SKELETON.length;

export const CURRICULUM_SECTIONS = [
  { id: "attackingOrganization", label: "Attacking organization" },
  { id: "attackingTransition", label: "Attacking transition" },
  { id: "defensiveOrganization", label: "Defensive organization" },
  { id: "defensiveTransition", label: "Defensive transition" },
] as const;

const BEGINNER: WeekCopy[] = [
  {
    theme: "First pass out of the back",
    focus: "Receive with a good first touch, look up, and play a simple pass to a teammate facing forward.",
    notes: "Keep the picture small. Two options only: pass to the nearest open player or dribble into space.",
  },
  {
    theme: "Moving the ball through midfield",
    focus: "Pass, move, and support. Players learn to get open at an angle, not in a straight line.",
    notes: "Freeze when the receiver hides. Show the body-open shape, then play again.",
  },
  {
    theme: "Getting into the box",
    focus: "Dribble or pass into the final third, then shoot or find a teammate near goal.",
    notes: "Reward shots from good areas. Do not demand cutbacks or third-man runs yet.",
  },
  {
    theme: "Winning it and going forward",
    focus: "After a regain, take a positive first touch. If the way is open, dribble or pass forward.",
    notes: "One cue: can we go? If not, keep the ball. No 3-second tactical lecture.",
  },
  {
    theme: "Pressing the ball together",
    focus: "The nearest player goes to the ball. Teammates step up so there are no big gaps.",
    notes: "Hunt as a pair. Stop the session if one player presses alone.",
  },
  {
    theme: "Staying compact in midfield",
    focus: "Protect the middle. Force the opponent wide with a simple shape.",
    notes: "Walk the distances. Beginners feel compact before they understand a block.",
  },
  {
    theme: "Defending our box",
    focus: "Get numbers behind the ball, clear the danger, then restart with a first pass.",
    notes: "Goalkeeper starts the next attack with a simple throw or roll.",
  },
  {
    theme: "What we do when we lose it",
    focus: "The nearest player delays. Everyone else recovers toward our goal together.",
    notes: "Do not chase 30 yards. Recover, then get organised.",
  },
  {
    theme: "Using the goalkeeper in build-up",
    focus: "Split, bounce a simple pass, and play forward when the first player is free.",
    notes: "GK rolls or throws. No driven passes through a press yet.",
  },
  {
    theme: "Creating a 2v1",
    focus: "Two attackers work together to beat one defender with a pass or dribble.",
    notes: "Overlap or wall pass. Isolate the 1v1 only after they can combine.",
  },
  {
    theme: "Crossing and finishing",
    focus: "Deliver from wide areas. Attackers run near post and far post.",
    notes: "Cutbacks come later. First: run, arrive, finish.",
  },
  {
    theme: "Going to goal after a high win",
    focus: "If we win it high, take a shot or a forward pass quickly.",
    notes: "If the lane is closed, keep the ball. Do not force it.",
  },
  {
    theme: "When to press",
    focus: "Press on a bad touch, a back pass, or when the ball is near the sideline.",
    notes: "One trigger at a time. Celebrate the jump, then reset.",
  },
  {
    theme: "Stopping combinations",
    focus: "Stay with your player and cover the easy pass in front of goal.",
    notes: "Second defender covers the lane, not a second man.",
  },
  {
    theme: "Set pieces made simple",
    focus: "Mark a player, win the first header or clearance, then get organised.",
    notes: "Attacking set pieces: one near-post run and one far-post run.",
  },
  {
    theme: "Match week: keep it simple",
    focus: "Shorter session. Repeat the two ideas we already know. Recover shape quickly.",
    notes: "No new patterns. Confidence and spacing only.",
  },
];

const INTERMEDIATE: WeekCopy[] = [
  {
    theme: "Playing out under pressure",
    focus: "Secure the first pass, split the first line, and give the 6 a body-open option.",
    notes: "Build rest-defense behind the ball. Reward patience when the press is set.",
  },
  {
    theme: "Progression through midfield",
    focus: "Third-man support, half-space occupation, and switching after two passes.",
    notes: "Keep height and width so the ball-carrier always has a safe option and a line-break.",
  },
  {
    theme: "Final-third chance creation",
    focus: "Cutbacks, box occupation, and quality entries rather than speculative balls.",
    notes: "Create 2v1s wide, attack near and far post, and recycle when the box is blocked.",
  },
  {
    theme: "Counterattack after regain",
    focus: "First forward pass if the opponent is disorganised; otherwise secure and expand.",
    notes: "Train the 3-second decision: go, or keep. Do not invite a second loss.",
  },
  {
    theme: "High press and counterpress",
    focus: "Press triggers, cover the lane, and force play into a predictable wide area.",
    notes: "Nearest players hunt for 3–5 seconds; the rest compact behind.",
  },
  {
    theme: "Compact mid-block",
    focus: "Protect the centre, deny switches, and compete for second balls.",
    notes: "Pressure–cover–balance stays organised. No free central passes.",
  },
  {
    theme: "Low-block rest defense",
    focus: "Protect the box, clear the cutback zone, and restart with a first-forward option.",
    notes: "Goalkeeper starts the next attack. Fullbacks do not both jump.",
  },
  {
    theme: "Reaction on ball loss",
    focus: "Immediate organised counterpress, then recover compact distances if the ball is not won.",
    notes: "The nearest player delays; the unit drops as one if the press fails.",
  },
  {
    theme: "GK as the extra center back",
    focus: "Split CBs, bounce through the 6, and use the GK to beat the first press.",
    notes: "Body shape to receive. Play forward on the first positive touch.",
  },
  {
    theme: "Overloads and isolation",
    focus: "Create a numerical overload on one side, then isolate 1v1 on the far side.",
    notes: "Switch after attracting. Wide players hold width until the ball travels.",
  },
  {
    theme: "Crossing, cutbacks, and box runs",
    focus: "Near-post, penalty-spot, and far-post occupation with timed late runners.",
    notes: "Cutbacks beat a set back line more often than high crosses.",
  },
  {
    theme: "Vertical transition to goal",
    focus: "Carry or play forward immediately after a high regain.",
    notes: "If the lane is closed, secure, expand, and restart controlled progression.",
  },
  {
    theme: "Pressing traps",
    focus: "Show outside, jump on a weak touch or backward pass, and lock the switch.",
    notes: "Triggers must be coached: bad touch, back pass, sideline.",
  },
  {
    theme: "Defending combination play",
    focus: "Stay compact vs. third-man combinations and deny the split pass to the 10.",
    notes: "Second defender covers the lane, not the man.",
  },
  {
    theme: "Set pieces and second balls",
    focus: "Mark, screen, and win the first clearance; rest-defense for the second ball.",
    notes: "Attacking set pieces this week too: near-post screen and far-post runner.",
  },
  {
    theme: "Game-week recovery and rest defense",
    focus: "Match-week load: recover shape quickly, keep distances, and restart simply.",
    notes: "Shorter session. Sharpen the game model, do not introduce new ideas.",
  },
];

const ADVANCED: WeekCopy[] = [
  {
    theme: "Playing out vs a high press",
    focus: "Split the first line with a disguised bounce, third-man, or GK as a free man under a set press.",
    notes: "Rest-defense numbers behind the ball. If the press locks, play long to the spare runner.",
  },
  {
    theme: "Breaking lines in tight midfield",
    focus: "Half-space occupation, opposite-side 8, and a third-man through after attracting two markers.",
    notes: "Switch only after the press has shifted. Quality of the receiving body shape matters more than speed.",
  },
  {
    theme: "Chance creation against a set block",
    focus: "Cutbacks, far-side isolation, and third-man entries into the box rather than hopeful crosses.",
    notes: "Attack the cutback zone. Recycle if the box is occupied and restart the overload.",
  },
  {
    theme: "Counterattack with rest-defense behind",
    focus: "First forward pass if the opponent is disorganised; otherwise secure, then break with numbers.",
    notes: "Do not empty the rest-defense. The 6 and one CB stay connected.",
  },
  {
    theme: "Coordinated high press",
    focus: "Pressing traps, cover shadows, and forcing play into a prepared wide pocket.",
    notes: "Jump together. If the first press is beaten, recover as a unit in 3 seconds.",
  },
  {
    theme: "Mid-block with aggressive cover",
    focus: "Protect the centre, deny the 10, and jump the switch only when the far side is locked.",
    notes: "Pressure–cover–balance at speed. Second balls belong to the nearest midfielder.",
  },
  {
    theme: "Low block and first-forward restart",
    focus: "Protect the box and cutback lane, then restart with a prepared first-forward option.",
    notes: "Fullbacks do not both jump. GK starts the next attack on a positive first touch.",
  },
  {
    theme: "Counterpress or recover as one",
    focus: "Immediate organised counterpress; if the ball is not won, drop distances together.",
    notes: "The nearest player delays. No individual chase that opens the centre.",
  },
  {
    theme: "GK as the free center back",
    focus: "Use the GK to create a +1 vs the first press, then play through the 6 or the spare 8.",
    notes: "Body-open receive. Play forward on the first positive touch or reset without panic.",
  },
  {
    theme: "Overload to isolate",
    focus: "Attract two or three on one side, then isolate the far 1v1 or the far 8 in the half-space.",
    notes: "Width stays until the ball travels. The isolated attacker must be ready to finish or combine.",
  },
  {
    theme: "Box occupation vs a set back line",
    focus: "Near post, penalty spot, and far post with a late 8. Cutbacks over high crosses.",
    notes: "Time the far-post runner. Recycle if the first delivery is blocked.",
  },
  {
    theme: "Vertical transition after a high regain",
    focus: "Carry or play forward immediately. If the lane closes, secure and restart positional play.",
    notes: "The first pass after the regain decides the attack. Do not dribble into a recovered block.",
  },
  {
    theme: "Pressing traps and locking the switch",
    focus: "Show outside, jump on a weak touch or back pass, and take away the far-side escape.",
    notes: "Triggers: bad touch, back pass, sideline. The cover player owns the lane.",
  },
  {
    theme: "Defending third-man combinations",
    focus: "Stay compact vs bounce-and-spin combinations and deny the split pass into the 10.",
    notes: "Second defender covers the lane. Do not both jump the same player.",
  },
  {
    theme: "Set pieces: first ball and rest-defense",
    focus: "Mark, screen, and win the first clearance; rest-defense wins the second ball.",
    notes: "Attacking set pieces: near-post screen, penalty-spot attacker, far-post runner.",
  },
  {
    theme: "Game-week sharpness and rest defense",
    focus: "Match-week load: recover shape quickly, keep distances, sharpen the two key principles.",
    notes: "Shorter session. No new patterns. Confirm rest-defense numbers for Saturday.",
  },
];

const COPY: Record<CurriculumPlayerLevel, WeekCopy[]> = {
  BEGINNER,
  INTERMEDIATE,
  ADVANCED,
};

function coachCue(coachLevel: CurriculumCoachLevel): string {
  if (coachLevel === "USSF_D") {
    return "D license: show the picture, two coaching points, freeze-demo-play.";
  }
  if (coachLevel === "USSF_C") {
    return "C license: connect the principle to the moment. Ask before you tell.";
  }
  return "B+ license: principle over pattern. Rest-defense numbers and scan-receive-play.";
}

export function normalizeCoachLevel(raw?: string | null): CurriculumCoachLevel {
  const v = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (v === "USSF_C" || v === "C") return "USSF_C";
  if (v === "USSF_B_PLUS" || v === "USSF_B+" || v === "USSF_B" || v === "B+" || v === "B") return "USSF_B_PLUS";
  return "USSF_D";
}

export function normalizePlayerLevel(raw?: string | null): CurriculumPlayerLevel | null {
  const v = String(raw || "").trim().toUpperCase();
  if (v === "BEGINNER" || v === "INTERMEDIATE" || v === "ADVANCED") return v;
  return null;
}

export function teamBandFromName(name?: string | null): TeamBand {
  const n = String(name || "").toLowerCase();
  if (/\bnpl\b/.test(n) || /\becrl\b/.test(n)) return "NPL";
  if (/\bnavy\b/.test(n) || /\bpre[-\s]?npl\b/.test(n)) return "NAVY";
  return "DEVELOPMENT";
}

export const TEAM_BAND_RULES = [
  { band: "NPL" as const, label: "NPL / ECRL", playerLevel: "ADVANCED" as const, coachLevel: null, detail: "Advanced players. Coach license follows the assigned coach." },
  { band: "NAVY" as const, label: "Navy / Pre-NPL", playerLevel: "INTERMEDIATE" as const, coachLevel: null, detail: "Intermediate players. Coach license follows the assigned coach." },
  { band: "DEVELOPMENT" as const, label: "White / Grey / other", playerLevel: "BEGINNER" as const, coachLevel: "USSF_D" as const, detail: "Beginner players on a D-license curriculum." },
];

export function sessionAudience(input: {
  coachLevel?: string | null;
  ageGroup?: string | null;
  teamName?: string | null;
  playerLevel?: string | null;
}): {
  coachLevel: CurriculumCoachLevel;
  playerLevel: CurriculumPlayerLevel;
  band: TeamBand;
  source: "override" | "name" | "fallback";
} {
  const assignedCoach = normalizeCoachLevel(input.coachLevel);
  const override = normalizePlayerLevel(input.playerLevel);
  const band = teamBandFromName(input.teamName);

  if (override) {
    return {
      coachLevel: override === "BEGINNER" ? "USSF_D" : assignedCoach,
      playerLevel: override,
      band,
      source: "override",
    };
  }

  if (input.teamName) {
    if (band === "NPL") {
      return { coachLevel: assignedCoach, playerLevel: "ADVANCED", band, source: "name" };
    }
    if (band === "NAVY") {
      return { coachLevel: assignedCoach, playerLevel: "INTERMEDIATE", band, source: "name" };
    }
    return { coachLevel: "USSF_D", playerLevel: "BEGINNER", band, source: "name" };
  }

  const years = parseInt(String(input.ageGroup || "").replace(/\D/g, ""), 10);
  const y = Number.isFinite(years) ? years : null;
  if (assignedCoach === "USSF_D") {
    return {
      coachLevel: assignedCoach,
      playerLevel: y != null && y >= 13 ? "INTERMEDIATE" : "BEGINNER",
      band,
      source: "fallback",
    };
  }
  if (assignedCoach === "USSF_B_PLUS") {
    return {
      coachLevel: assignedCoach,
      playerLevel: y != null && y >= 15 ? "ADVANCED" : "INTERMEDIATE",
      band,
      source: "fallback",
    };
  }
  return {
    coachLevel: assignedCoach,
    playerLevel: y != null && y >= 16 ? "ADVANCED" : "INTERMEDIATE",
    band,
    source: "fallback",
  };
}

export function buildDefaultCurriculumWeeks(input?: {
  playerLevel?: string | null;
  coachLevel?: string | null;
  teamName?: string | null;
}): CurriculumWeekDraft[] {
  const audience = sessionAudience({
    playerLevel: input?.playerLevel,
    coachLevel: input?.coachLevel,
    teamName: input?.teamName,
  });
  const copy = COPY[audience.playerLevel];
  const cue = coachCue(audience.coachLevel);
  return SKELETON.map((week, index) => {
    const text = copy[index];
    return {
      weekIndex: index + 1,
      moment: week.moment,
      phase: week.phase,
      zone: week.zone,
      theme: text.theme,
      focus: text.focus,
      notes: `${text.notes} ${cue}`,
    };
  });
}

export function currentWeekIndex(startDate: Date, now = new Date()): number {
  const start = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.floor((today - start) / 86_400_000);
  if (diffDays < 0) return 1;
  return Math.min(CURRICULUM_WEEK_COUNT, Math.floor(diffDays / 7) + 1);
}

export function sessionBuilderQuery(params: {
  ageGroup: string;
  gameModelId: string;
  phase?: string | null;
  zone?: string | null;
  topic?: string | null;
  coachLevel?: string | null;
  playerLevel?: string | null;
  teamName?: string | null;
}): string {
  const audience = sessionAudience({
    coachLevel: params.coachLevel,
    ageGroup: params.ageGroup,
    playerLevel: params.playerLevel,
    teamName: params.teamName,
  });
  const search = new URLSearchParams({
    ageGroup: params.ageGroup,
    gameModelId: params.gameModelId,
    coachLevel: audience.coachLevel,
    playerLevel: audience.playerLevel,
  });
  if (params.phase) search.set("phase", params.phase);
  if (params.zone) search.set("zone", params.zone);
  if (params.topic) search.set("topic", params.topic);
  return `/demo/session?${search.toString()}`;
}

export type WeekSessionIdea = {
  slot: string;
  title: string;
  detail: string;
};

export type WeekKnowledge = {
  audienceLabel: string;
  format: string;
  why: string;
  constraints: string[];
  ideas: WeekSessionIdea[];
};

function ageYears(ageGroup?: string | null): number | null {
  const years = parseInt(String(ageGroup || "").replace(/\D/g, ""), 10);
  return Number.isFinite(years) ? years : null;
}

function formatForAge(ageGroup?: string | null): string {
  const y = ageYears(ageGroup);
  if (y == null) return "small-sided";
  if (y <= 11) return "7v7";
  if (y <= 13) return "9v9";
  return "11v11";
}

function zoneLabel(zone?: string | null): string {
  if (zone === "DEFENSIVE_THIRD") return "the defensive third";
  if (zone === "ATTACKING_THIRD") return "the attacking third";
  return "midfield";
}

function momentLabel(moment?: string | null): string {
  if (moment === "attackingTransition") return "attacking transition";
  if (moment === "defensiveOrganization") return "defensive organization";
  if (moment === "defensiveTransition") return "defensive transition";
  return "attacking organization";
}

export function buildWeekKnowledge(input: {
  theme: string;
  moment: string;
  phase: string;
  zone: string | null;
  focus: string;
  ageGroup: string;
  playerLevel: string;
  coachLevel: string;
}): WeekKnowledge {
  const audience = sessionAudience({
    ageGroup: input.ageGroup,
    playerLevel: input.playerLevel,
    coachLevel: input.coachLevel,
  });
  const y = ageYears(input.ageGroup) || 12;
  const format = formatForAge(input.ageGroup);
  const zone = zoneLabel(input.zone);
  const moment = momentLabel(input.moment);
  const player = audience.playerLevel;
  const coach = audience.coachLevel;

  const why =
    player === "BEGINNER"
      ? `${input.ageGroup} beginners need a small picture of ${input.theme.toLowerCase()}. Keep it in ${zone}, use ${format} numbers, and coach one action at a time so they can repeat it.`
      : player === "ADVANCED"
        ? `${input.ageGroup} advanced players should solve ${input.theme.toLowerCase()} at game speed. Demand the scan, the extra, and rest-defense while they play through ${zone}.`
        : `${input.ageGroup} intermediate players can connect ${input.theme.toLowerCase()} to ${moment}. Give them a clear trigger in ${zone}, then let them decide.`;

  const constraints =
    player === "BEGINNER"
      ? [
          y <= 11 ? "3v3 to 5v5, lots of ball contacts" : "4v4 to 6v6, short activities",
          "Two coaching points, freeze–demo–play",
          "Unopposed or light pressure before a live game",
          "Success is the first touch and a simple next pass",
        ]
      : player === "ADVANCED"
        ? [
            format === "11v11" ? "7v7 to 11v11, directional, rest-defense numbered" : `Play toward ${format} size`,
            "Principle over pattern — ask before you tell",
            "Live pressure early; opposed combinations",
            "Every restart has a first-forward option",
          ]
        : [
            format === "7v7" ? "4v4 to 7v7, one ball, clear direction" : "5v5 to 8v8, then a bigger game",
            "One trigger, one cover cue",
            "Light pressure → opposed → game",
            "Name the extra player before they receive",
          ];

  const ideas: WeekSessionIdea[] =
    player === "BEGINNER"
      ? [
          {
            slot: "Warm-up",
            title: `Ball mastery into ${input.theme.toLowerCase()}`,
            detail: `Rondo or 2v1 in a tight grid. ${y <= 11 ? "Everyone has a ball first, then share one." : "Body-open receive, then a simple pass."} Finish with a 3v1.`,
          },
          {
            slot: "Technical",
            title: input.focus.split(".")[0],
            detail: `Unopposed pattern in ${zone}: receive, look, play. Then add a passive defender. ${coach === "USSF_D" ? "Show it, then let them copy." : "Ask what they see before the pass."}`,
          },
          {
            slot: "Tactical",
            title: `${format} picture for ${moment}`,
            detail: `Small directional game. Condition: must play a first pass into space before they can score. Coach the picture, not the lecture.`,
          },
          {
            slot: "Game",
            title: `Free ${format} with one rule`,
            detail: `Normal game. One rule only: the first option after a win or restart is forward. Stop once, show the theme, play.`,
          },
        ]
      : player === "ADVANCED"
        ? [
            {
              slot: "Warm-up",
              title: "Positional rondo with rest-defense",
              detail: `4v4+3 or 6v4. Bounce, third-man, and a spare behind the ball. If they lose it, the nearest two counterpress for three seconds.`,
            },
            {
              slot: "Technical",
              title: input.focus.split(".")[0],
              detail: `Opposed repetition in ${zone}. Attract, release, occupy. ${coach === "USSF_B_PLUS" ? "Name the principle, not the pattern." : "Connect the extra to the game-model moment."}`,
            },
            {
              slot: "Tactical",
              title: `${moment} in ${zone}`,
              detail: `Directional ${format === "11v11" ? "8v8 to 11v11" : format} with a lock-the-switch or rest-defense condition. Live pressure from the first repetition.`,
            },
            {
              slot: "Game",
              title: "Match picture, two principles",
              detail: `Open game. Score bonus for the theme (line-break, cutback, or counterpress). Keep rest-defense numbers behind every attack.`,
            },
          ]
        : [
            {
              slot: "Warm-up",
              title: "Rondo into a forward pass",
              detail: `4v2 or 5v3. After three passes, the free player must play forward into a mini-goal. Sets the theme without a lecture.`,
            },
            {
              slot: "Technical",
              title: input.focus.split(".")[0],
              detail: `Wave or channel work in ${zone}: receive, combine, release. Add a recovering defender after two clean reps.`,
            },
            {
              slot: "Tactical",
              title: `${moment} condition`,
              detail: `Directional ${format === "7v7" ? "5v5" : "6v6 to 8v8"}. Condition tied to ${input.theme.toLowerCase()}. One freeze if the trigger is missed.`,
            },
            {
              slot: "Game",
              title: `Even ${format} game`,
              detail: `Play. Coach only the week’s trigger. If it appears, freeze, ask, play. No new ideas in the last 15 minutes.`,
            },
          ];

  const playerLabel =
    player === "BEGINNER" ? "Beginner" : player === "ADVANCED" ? "Advanced" : "Intermediate";
  const coachLabel = coach === "USSF_D" ? "USSF D" : coach === "USSF_B_PLUS" ? "USSF B+" : "USSF C";

  return {
    audienceLabel: `${input.ageGroup} · ${playerLabel} · ${coachLabel}`,
    format,
    why,
    constraints,
    ideas,
  };
}
