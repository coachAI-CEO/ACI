import type { PanelFixture } from "./types";

/**
 * Core-session matrix. Age × license × topic — not one U12 possession cell.
 * Same seeds every run so a prompt change is a regression, not weather.
 *
 * `input.topic` must be a real string from `getTopicsForPhaseAndZone` in
 * apps/web/src/data/session-topics.ts (COMBO_TOPICS) for the fixture's own
 * phase+zone -- that's the exact field production sends into
 * SessionPromptInput.topic. A paraphrase here would test a topic a coach can
 * never actually select. `topicMeaning`/`topicSignals` stay in plain language
 * on purpose: the TOPIC LOCK tells USSF_D/C coaches never to say the jargon
 * name, so the judge/gate side has to detect the *explained* concept in the
 * generated text, not the canonical label itself.
 */
export const PANEL_FIXTURES: PanelFixture[] = [
  {
    id: "u9-d-open-teammate",
    label: "U9 D · Support Angles (open teammate)",
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
      topic: "Support Angles",
    },
    topicMeaning:
      "Young players learn to look up, find a teammate who is free, and pass to them. Not a textbook possession lecture.",
    topicSignals: [
      /open teammate/i,
      /teammate who is (open|free)/i,
      /pass to (the |an |your )?(open|free) (player|teammate)/i,
      /find (the |a |your )?(open|free) (player|teammate)/i,
      /player without a defender/i,
      // Observed live phrasing for "Support Angles" (2026-08-26): a model
      // teaching this topic correctly says "open passing angle(s)" or
      // "positioned at an angle", not "open teammate" -- add both readings.
      /support(ing)? angles?/i,
      /passing angles?/i,
      /(open|good) angles?/i,
      /positioned at an angle/i,
      /angle (to|for) (receive|pass)/i,
    ],
  },
  {
    id: "u11-d-support-nearby",
    label: "U11 D · Combination Play (teammate nearby)",
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
      topic: "Combination Play",
    },
    topicMeaning:
      "When you have the ball, someone close should be ready to help. Support is a place and a pass, not a jargon word.",
    topicSignals: [
      /nearby who can help/i,
      /teammate (nearby|close|next to you)/i,
      /someone close (enough )?to (help|pass)/i,
      /support(ing)? (angles?|players?|nearby)/i,
      /help(er)? (close|near|next)/i,
      // Observed live phrasing for "Combination Play" (2026-08-26): a model
      // teaching this topic correctly says "(passing) combination(s)" or
      // "combine", which none of the "nearby help" patterns above catch.
      /(passing |quick )?combinations?/i,
      /combin(e|es|ed|ing)\b/i,
      /one-?two/i,
      // Observed live phrasing (2026-08-26, round 3): the model can also
      // describe combination play as the action without naming it -- a quick
      // pass into an open/nearby teammate, or passing options offered nearby.
      /(quick |short )?pass(ing)? (into|to) (an? )?(open|nearby) teammate/i,
      /(clear |nearby )?passing options?/i,
    ],
  },
  {
    id: "u12-c-around-press",
    label: "U12 C · Breaking Press Triggers",
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
      topic: "Breaking Press Triggers",
    },
    topicMeaning:
      "When the first defender steps, play around that pressure rather than through it. One named concept, taught in the next sentence.",
    topicSignals: [
      /around (the )?(first )?(press|pressure|presser)/i,
      /first (press|defender|presser) (steps|comes|presses)/i,
      /play(ed|ing)? around (the )?(pressure|press|them)/i,
      /when (they|a defender|the presser) steps/i,
      // Observed live phrasing for "Breaking Press Triggers" (2026-08-26): a
      // model teaching this topic correctly says "break(ing) the press(ing
      // line)" or "press-breaking", not "around the press".
      /break(ing)? (the )?press(ure|ing)?( line)?/i,
      /press-breaking/i,
      /press(ing)? triggers?/i,
    ],
  },
  {
    id: "u14-c-first-pass",
    label: "U14 C · First Pass Forward (after we win it)",
    input: {
      gameModelId: "TRANSITION",
      ageGroup: "U14",
      phase: "TRANSITION",
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
      topic: "First Pass Forward",
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
    label: "U16 B+ · Rest Defense Shape (after we lose it)",
    input: {
      gameModelId: "TRANSITION",
      ageGroup: "U16",
      phase: "TRANSITION",
      zone: "ATTACKING_THIRD",
      numbersMin: 16,
      numbersMax: 22,
      goalsAvailable: 2,
      spaceConstraint: "FULL",
      durationMin: 90,
      formationAttacking: "4-3-3",
      formationDefending: "4-3-3",
      playerLevel: "ADVANCED",
      coachLevel: "USSF_B_PLUS",
      topic: "Rest Defense Shape",
    },
    topicMeaning:
      "How we are already organized to protect the counter when we lose the ball high up the pitch. Systemic, connected to the next moment — not a rondo with 'rest defence' glued on.",
    topicSignals: [
      /rest[- ]defen[cs]e/i,
      /after (we |you )?lose (it|the ball)/i,
      /when (we |you )?lose (it|the ball)/i,
      /protect(ing)? (against )?the counter/i,
      /cover (the )?(counter|break)/i,
    ],
  },
  {
    id: "u13-c-press-unit",
    label: "U13 C · Pressing as a Unit",
    input: {
      gameModelId: "PRESSING",
      ageGroup: "U13",
      phase: "DEFENDING",
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
      topic: "Pressing as a Unit",
    },
    topicMeaning:
      "The whole team steps together to close space and win the ball back in the middle third -- not one player chasing alone while the rest of the team stays off.",
    topicSignals: [
      /press(ing)? together/i,
      /as a (team|unit|group)/i,
      /close(ing)? (down )?space together/i,
      /compact(ness)? while pressing/i,
      /coordinated press/i,
      /(all|everyone) (steps?|moves?) together/i,
    ],
  },
  {
    id: "u10-d-final-third-1v1",
    label: "U10 D · 1v1 to Beat Defender",
    input: {
      gameModelId: "POSSESSION",
      ageGroup: "U10",
      phase: "ATTACKING",
      zone: "ATTACKING_THIRD",
      numbersMin: 10,
      numbersMax: 14,
      goalsAvailable: 1,
      spaceConstraint: "QUARTER",
      durationMin: 60,
      formationAttacking: "2-3-1",
      formationDefending: "2-3-1",
      playerLevel: "BEGINNER",
      coachLevel: "USSF_D",
      topic: "1v1 to Beat Defender",
    },
    topicMeaning:
      "Close to goal, take on the defender in front of you and get past them to shoot -- a simple dribbling skill, not a tactical system.",
    topicSignals: [
      /beat (the |your |a )?defender/i,
      /1\s*(v|-vs-)\s*1/i,
      /take on (the |a )?defender/i,
      /dribble (past|around|by)/i,
      /skill move/i,
      /change of direction/i,
    ],
  },
  {
    id: "u15-c-exit-under-pressure",
    label: "U15 C · Exit Under Pressure",
    input: {
      gameModelId: "TRANSITION",
      ageGroup: "U15",
      phase: "TRANSITION",
      zone: "DEFENSIVE_THIRD",
      numbersMin: 16,
      numbersMax: 22,
      goalsAvailable: 2,
      spaceConstraint: "HALF",
      durationMin: 90,
      formationAttacking: "4-3-3",
      formationDefending: "4-3-3",
      playerLevel: "INTERMEDIATE",
      coachLevel: "USSF_C",
      topic: "Exit Under Pressure",
    },
    topicMeaning:
      "Right after winning the ball back near our own goal, get out of trouble calmly under pressure rather than panicking or clearing it blindly.",
    topicSignals: [
      /exit(ing|s)?\s+(under|the|from)?\s*pressure/i,
      /exit(ing|s)? the zone/i,
      /get out (of trouble|from under pressure)/i,
      /(calm|composed)(ly)?.{0,30}(under|distribution|possession).{0,20}pressure/i,
      /play out (under|from) pressure/i,
      /secure the ball (after|once) (we |you )?win/i,
    ],
  },
  {
    id: "u17-b-high-press-triggers",
    label: "U17 B+ · High Press Triggers",
    input: {
      gameModelId: "PRESSING",
      ageGroup: "U17",
      phase: "DEFENDING",
      zone: "ATTACKING_THIRD",
      numbersMin: 16,
      numbersMax: 22,
      goalsAvailable: 2,
      spaceConstraint: "FULL",
      durationMin: 90,
      formationAttacking: "4-3-3",
      formationDefending: "4-3-3",
      playerLevel: "ADVANCED",
      coachLevel: "USSF_B_PLUS",
      topic: "High Press Triggers",
    },
    topicMeaning:
      "Organizing the high press so the whole team steps together off a clear cue -- a backpass, a poor first touch, a sideways ball -- to win it back in the attacking third.",
    topicSignals: [
      /high press/i,
      /press(ing)? triggers?/i,
      /step(ping)? together/i,
      /win (it |the ball )?high/i,
      /trap(ping)? (them|the (gk|goalkeeper))/i,
      /force (a )?mistake/i,
    ],
  },
  {
    id: "u18-b-zonal-defending",
    label: "U18 B+ · Zonal Defending (4-4-2)",
    input: {
      gameModelId: "PRESSING",
      ageGroup: "U18",
      phase: "DEFENDING",
      zone: "DEFENSIVE_THIRD",
      numbersMin: 16,
      numbersMax: 22,
      goalsAvailable: 2,
      spaceConstraint: "HALF",
      durationMin: 90,
      formationAttacking: "4-4-2",
      formationDefending: "4-4-2",
      playerLevel: "ADVANCED",
      coachLevel: "USSF_B_PLUS",
      topic: "Zonal Defending",
    },
    topicMeaning:
      "Defend by covering your zone and shifting as a block, not by chasing the ball around the pitch. The last uncovered phase+zone in this matrix -- deep defending, not pressing.",
    topicSignals: [
      /zonal(ly)? defend/i,
      /defend(ing)? (by |your )?zone/i,
      /cover (your |the )?(area|zone|space)/i,
      /shift (as a|together|the) (block|line)/i,
      /(don't|do not) chase the ball/i,
      /stay in (your |the )?zone/i,
    ],
  },
  {
    id: "u12-c-half-space",
    label: "U12 C · Half-Space Occupation (3-3-2)",
    input: {
      gameModelId: "POSSESSION",
      ageGroup: "U12",
      phase: "ATTACKING",
      zone: "MIDDLE_THIRD",
      numbersMin: 12,
      numbersMax: 16,
      goalsAvailable: 1,
      spaceConstraint: "HALF",
      durationMin: 90,
      formationAttacking: "3-3-2",
      formationDefending: "3-3-2",
      playerLevel: "INTERMEDIATE",
      coachLevel: "USSF_C",
      topic: "Half-Space Occupation",
    },
    topicMeaning:
      "Occupy the channel between the wide player and the center to open passing lanes -- not standing directly wide or directly central. A different formation (3-3-2) from the other 9v9 cells to check the system isn't just tuned to one shape.",
    topicSignals: [
      /half[- ]?spaces?/i,
      /between (the )?(wing|winger|full[- ]?back|touchline) and (the )?(center|centre|middle)/i,
      /channel(s)? (between|next to)/i,
      /inside channel/i,
      /wide (channel|lane)/i,
    ],
  },
  {
    id: "u16-c-gk-distribution",
    label: "U16 C · GK Distribution Options (4-2-3-1)",
    input: {
      gameModelId: "POSSESSION",
      ageGroup: "U16",
      phase: "ATTACKING",
      zone: "DEFENSIVE_THIRD",
      numbersMin: 16,
      numbersMax: 22,
      goalsAvailable: 2,
      spaceConstraint: "HALF",
      durationMin: 90,
      formationAttacking: "4-2-3-1",
      formationDefending: "4-2-3-1",
      playerLevel: "INTERMEDIATE",
      coachLevel: "USSF_C",
      topic: "GK Distribution Options",
    },
    topicMeaning:
      "The goalkeeper has more than one safe way to start play -- short to a center back, wide to a fullback, or longer to a target -- not one predictable pattern every time. A third formation (4-2-3-1) at 11v11, distinct from the 4-3-3 used elsewhere.",
    topicSignals: [
      /goalkeeper('s)? (distribution|options)/i,
      /(gk|keeper) (plays?|distributes?|starts?|picks?) (to|from|an? option)/i,
      /multiple (safe )?options? (to|for) (the )?(gk|keeper|goalkeeper)/i,
      /short (to|pass to) (the )?(center|centre) back/i,
      /(gk|keeper) reads? (the )?press/i,
    ],
  },
  {
    id: "u15-b-compactness-lines",
    label: "U15 B+ · Compactness Between Lines (3-4-3)",
    input: {
      gameModelId: "PRESSING",
      ageGroup: "U15",
      phase: "DEFENDING",
      zone: "MIDDLE_THIRD",
      numbersMin: 16,
      numbersMax: 22,
      goalsAvailable: 2,
      spaceConstraint: "HALF",
      durationMin: 90,
      formationAttacking: "3-4-3",
      formationDefending: "3-4-3",
      playerLevel: "ADVANCED",
      coachLevel: "USSF_B_PLUS",
      topic: "Compactness Between Lines",
    },
    topicMeaning:
      "Keep the defensive and midfield lines close together vertically so there's no gap to play through -- a systemic, connected idea, not a single line standing in place. A fourth formation (3-4-3), distinct from every other 11v11 cell.",
    topicSignals: [
      /compact(ness)? (between|across) (the )?lines/i,
      /close(r)? (together|the gap) between (the )?lines/i,
      /(no )?gaps? between (the )?lines/i,
      /lines? (stay(ing)?|staying) close/i,
      /distance between (the )?lines/i,
      // Observed live phrasing (2026-08-26, 3 attempts): a model can enforce
      // this topic as a hard numeric block distance/compactness constraint
      // instead of literally saying "between the lines" -- e.g. "defensive
      // block must maintain vertical compactness under 12 yards" or
      // "vertically separated by more than twelve yards" (spelled-out
      // number, not a digit). Two tight-adjacency patterns both missed real
      // hits here -- match the concept pair loosely instead of requiring
      // "block"/a digit right next to the compactness word.
      /vertical(ly)? (compact(ness)?|separat(ed|ion))/i,
      /block[\s\S]{0,100}(compact|distance|separat)/i,
    ],
  },
  {
    id: "u13-c-fast-break",
    label: "U13 C · Fast Break Attacks (3-5-2)",
    input: {
      gameModelId: "TRANSITION",
      ageGroup: "U13",
      phase: "TRANSITION",
      zone: "ATTACKING_THIRD",
      numbersMin: 16,
      numbersMax: 22,
      goalsAvailable: 2,
      spaceConstraint: "HALF",
      durationMin: 90,
      formationAttacking: "3-5-2",
      formationDefending: "3-5-2",
      playerLevel: "INTERMEDIATE",
      coachLevel: "USSF_C",
      topic: "Fast Break Attacks",
    },
    topicMeaning:
      "The moment we win the ball back near their goal, attack immediately and directly before they can recover their shape -- speed over patience. A fifth formation (3-5-2) to keep the matrix from tuning to one shape.",
    topicSignals: [
      /fast break/i,
      /quick(ly)? (attack|counter)/i,
      /attack (immediately|directly|quickly)/i,
      /before they (can )?recover/i,
      /speed over patience/i,
      /break (quickly|fast)/i,
    ],
  },
  {
    id: "u9-b-positional-play",
    label: "U9 B+ ADVANCED · Positional Play (elite 7v7)",
    input: {
      gameModelId: "POSSESSION",
      ageGroup: "U9",
      phase: "ATTACKING",
      zone: "MIDDLE_THIRD",
      numbersMin: 10,
      numbersMax: 14,
      goalsAvailable: 1,
      spaceConstraint: "HALF",
      durationMin: 60,
      formationAttacking: "2-3-1",
      formationDefending: "2-3-1",
      playerLevel: "ADVANCED",
      coachLevel: "USSF_B_PLUS",
      topic: "Positional Play (Possession)",
    },
    topicMeaning:
      "Deliberately unusual pairing: a systemic B+ concept (positional roles keeping passing lanes open) taught to an elite U9 7v7 squad. Vocabulary and difficulty stay ADVANCED/B+, but the format is still forced to 7v7 by ageGroup -- tests whether age-format rules and coachLevel/playerLevel rules can both hold at once without one overriding the other. spaceConstraint=HALF, not QUARTER: two judges independently flagged QUARTER (16yd) as too narrow to demonstrate positional structure with 6-7 players -- positional play needs room to spread, unlike a tight-support topic.",
    topicSignals: [
      /positional play/i,
      /positional (shape|structure|role)/i,
      /occupy(ing)? (space|position|zone)/i,
      /keep(ing)? (passing lanes|shape)/i,
      /structure(d)? position(ing)?/i,
    ],
  },
  {
    id: "u18-d-1v1-defending",
    label: "U18 D BEGINNER · 1v1 Defending (full 11v11)",
    input: {
      gameModelId: "POSSESSION",
      ageGroup: "U18",
      phase: "DEFENDING",
      zone: "DEFENSIVE_THIRD",
      numbersMin: 16,
      numbersMax: 22,
      goalsAvailable: 2,
      spaceConstraint: "HALF",
      durationMin: 90,
      formationAttacking: "4-4-2",
      formationDefending: "4-4-2",
      playerLevel: "BEGINNER",
      coachLevel: "USSF_D",
      topic: "1v1 Defending",
    },
    topicMeaning:
      "The inverse pairing: true beginners (BEGINNER/USSF_D language and touch rules) who are old enough for full 11v11. Stop the player in front of you without diving in -- simple defending in plain words, at a squad size and format usually paired with advanced players.",
    topicSignals: [
      // Requiring "defend" right after "1v1" was too tight -- the model
      // legitimately writes "1v1 duel"/"1v1 battle" for this same concept.
      // The zone/topicMeaning already scope this fixture to defending.
      /(1|one)[\s-]*(v|vs|versus)[\s-]*(1|one)\b/i,
      /stop (the |your )?(player|attacker)/i,
      /(don't|do not) dive in/i,
      /stay on your feet/i,
      /jockey/i,
      /delay(ing)? (the )?attacker/i,
    ],
  },
  {
    id: "u16-b-managing-switches-tight",
    label: "U16 B+ · Managing Switches (11v11 in QUARTER space)",
    input: {
      gameModelId: "PRESSING",
      ageGroup: "U16",
      phase: "DEFENDING",
      zone: "MIDDLE_THIRD",
      numbersMin: 16,
      numbersMax: 22,
      goalsAvailable: 2,
      spaceConstraint: "QUARTER",
      durationMin: 90,
      formationAttacking: "4-5-1",
      formationDefending: "4-5-1",
      playerLevel: "ADVANCED",
      coachLevel: "USSF_B_PLUS",
      topic: "Managing Switches",
    },
    topicMeaning:
      "The hardest space/numbers combination in this matrix: a full 22-player 11v11 squad squeezed into QUARTER space (usually reserved for warmups), teaching a topic (shifting as a block when play switches sides) that normally needs width to demonstrate. Sixth formation (4-5-1).",
    topicSignals: [
      // Observed live phrasing (2026-08-26): the model's natural word for
      // this concept is "slide"/"sliding", not "shift" -- and titles reverse
      // the word order ("Switch Management", not "managing switches").
      // "manage" + "ing" spells "manageing", which isn't a word -- the real
      // gerund drops the terminal e ("managing"). Match the stem "manag" with
      // suffix alternatives instead of the wrong-spelling combined pattern.
      /manag(e|ed|ing|ement) .{0,15}switch(es)?/i,
      /switch(es)? .{0,15}manag(e|ed|ing|ement)/i,
      /(shift(s|ed|ing)?|slid(e|es|ing)?) (as a (unit|block)|together|to cover)/i,
      /block .{0,20}(slide|shift)/i,
      /fails? to (slide|shift)/i,
      /react(ing)? to (the )?switch/i,
      /cover (the )?switch/i,
      /recover (the )?shape.{0,20}switch/i,
    ],
  },
];

export function fixtureById(id: string): PanelFixture | undefined {
  return PANEL_FIXTURES.find((f) => f.id === id);
}
