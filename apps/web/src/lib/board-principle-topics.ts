import type { PlayOutShape } from "@/lib/board-play-out-curriculum";

export type PrincipleTopic =
  | "overview"
  | "play_out"
  | "attacking_combo"
  | "defensive_transition"
  | "attacking_transition"
  | "press";

export type TopicLesson = {
  topic: PrincipleTopic;
  title: string;
  lineage: string;
  idea: string;
  involved: string[];
  jobs: string[];
  teach: string;
  avoid: string;
  boardAsk: string;
};

const THIN_ASK =
  /^(just draw( it)?|draw it|1|2|yes|ok|okay|a a a|now the left|now the right|left|right)$/i;

export function isThinBoardAsk(text: string): boolean {
  return THIN_ASK.test(String(text || "").trim());
}

/** Shirt chain like "6 to 8/10 to the 9 and then the 11". */
export function isPassingSequenceAsk(raw: string): boolean {
  const m = String(raw || "").toLowerCase();
  if (
    /\b(pass(?:ing)? sequence|sequence of pass(?:es)?|passing pattern|create a (?:pass|passing)|pass(?:ing)? from)\b/.test(
      m
    )
  ) {
    return true;
  }
  if (/\bfrom (?:the )?#?\d+\b/.test(m) && /\bto (?:the )?#?\d+\b/.test(m)) return true;
  if (
    /\b#?\d+\s*(?:\/\s*#?\d+)?(?:\s*(?:to|then|and then|→|->)\s*(?:the )?#?\d+(?:\s*\/\s*#?\d+)?){1,}/.test(
      m
    )
  ) {
    return true;
  }
  return false;
}

export function passingPathFromAsk(raw?: string | null): string | null {
  const m = String(raw || "");
  const nums = [...m.matchAll(/\b(?:#|the )?(\d{1,2})(?:\s*\/\s*(?:#)?(\d{1,2}))?/gi)];
  const shirts = nums
    .map((x) => (x[2] ? `${x[1]}/${x[2]}` : x[1]))
    .filter((n, i, arr) => arr.indexOf(n) === i);
  if (shirts.length < 2) return null;
  return shirts.map((n) => `#${n}`).join(" → ");
}

export function classifyBoardAsk(raw?: string | null): PrincipleTopic {
  const m = String(raw || "").toLowerCase();
  if (!m.trim() || isThinBoardAsk(m)) return "overview";

  if (
    /\b(defensive transition|transition from attack|from attack.{0,40}to defend|to defend in this|after (we |a |the )?(loss|we lose)|when we lose|press after (a )?loss|counter[- ]?press|gegenpress|rest defen[cs]e)\b/.test(
      m
    ) ||
    (/\bwho is involved\b/.test(m) && /\b(defend|transition|loss)\b/.test(m) && !isPassingSequenceAsk(m))
  ) {
    return "defensive_transition";
  }
  if (
    /\b(attacking transition|on regain|when we win it|counter[- ]?attack|first action after (we )?win)\b/.test(m)
  ) {
    return "attacking_transition";
  }
  const namedPlayOut =
    /\b(play(?:ing)?[\s-]?out|goal[- ]?kick|build[- ]?out|from our (?:goal|gk|keeper))\b/.test(m);
  if (namedPlayOut && !isPassingSequenceAsk(m)) {
    return "play_out";
  }
  if (/\b(high press|mid[- ]?block|low[- ]?block|press them|press their)\b/.test(m) && !isPassingSequenceAsk(m)) {
    return "press";
  }
  if (
    isPassingSequenceAsk(m) ||
    /\b(combination|combo|pattern|wall[- ]?pass|give[- ]and[- ]go|one[- ]two|1[- ]2|triangle|overlap|cutback|third[- ]?man|involve|sequence)\b/.test(
      m
    )
  ) {
    return "attacking_combo";
  }
  return "overview";
}

export function topicLabel(topic: PrincipleTopic): string {
  if (topic === "play_out") return "Play out";
  if (topic === "attacking_combo") return "Attacking combinations";
  if (topic === "defensive_transition") return "Defensive transition";
  if (topic === "attacking_transition") return "Attacking transition";
  if (topic === "press") return "Pressing";
  return "This shape";
}

function lesson(
  topic: PrincipleTopic,
  title: string,
  lineage: string,
  idea: string,
  involved: string[],
  jobs: string[],
  teach: string,
  avoid: string,
  boardAsk: string
): TopicLesson {
  return { topic, title, lineage, idea, involved, jobs, teach, avoid, boardAsk };
}

const COMBO: Partial<Record<PlayOutShape, TopicLesson>> = {
  "4-3-3": lesson(
    "attacking_combo",
    "4-3-3 attacking combination plays",
    "Interior bounce, then the 9, then the weak-side 11",
    "This is an attacking combination in this 4-3-3 — the path on the grass: 6 into 8 or 10, then the 9, then the 11. The 6 plays forward into a midfielder between the lines. That 8/10 sets or turns into the 9. The 9 receives to feet or lays off. The 11 finishes the pattern on the weak side. The 7 holds the other flank so the 11 is the switch, not a crowd.",
    [
      "#6: first pass. Body open, play into #8 or #10 between their midfield and back line — not back, not a hopeful ball into the 9 first.",
      "#8 or #10: the bounce. Receive on the half-turn, set or release into #9 on the next action.",
      "#9: the link. To feet, or a layoff — still the target. Do not drop into midfield as a fourth passer on this pattern.",
      "#11: the finish. High and wide on the weak side until #9 plays, then arrive. #7 holds the strong-side width so this stays a 4-3-3 front three.",
    ],
    [
      "Draw the four actions in order: 6 → 8/10 → 9 → 11. Same shirts, same 4-3-3, attacking third.",
      "Time the 11’s run with the 9’s first touch, not after the 9 has already turned.",
      "If they jump the 6, the 8/10 is still the next pass — then 9, then 11. Do not skip the 9 to hit the 11 early unless that picture is on.",
    ],
    "Replay 6 → 8/10 → 9 → 11 until the next pass is obvious. One path. This 4-3-3.",
    "Do not start this pattern from the goalkeeper. Do not drop the 9 into the midfield four. Do not pull the 11 inside before the 9 plays.",
    "Same shirts. Passing sequence 6 to 8/10 to 9 to 11. Just draw it."
  ),
  "4-2-3-1": lesson(
    "attacking_combo",
    "4-2-3-1 attacking combination plays",
    "Midfield square into the 10 pocket",
    "Stay in 4-2-3-1. The combo is pivot → free pivot or full-back → 10 in the hole → winger or 9. One holder never both join.",
    [
      "Ball side: full-back, the free pivot, #10.",
      "#9 pins. Wide attacker on that side inverts or holds.",
      "The other pivot stays — this pattern does not need both holders in the pass.",
    ],
    [
      "Bounce into the free holder if they jump the first.",
      "10 receives after the bounce, not as the first helper.",
      "Overlap only once the 10 has the pocket.",
    ],
    "Name the shirts: 2, free 8, 10. Keep the second pivot home.",
    "Do not invent a single 6 4-3-3. Do not drop the 10 onto the first pass.",
    "Same shirts. 4-2-3-1 combo: bounce into the free 8, 10 in the pocket. Just draw it."
  ),
  "4-4-2": lesson(
    "attacking_combo",
    "4-4-2 attacking combination plays",
    "Target + runner, tuck + overlap",
    "Stay in 4-4-2. Combo is hold-up into the runner or tucked wide mid, then the overlapping full-back.",
    [
      "Target 9 holds. Runner 9 or wide mid arrives.",
      "One wide mid tucks; opposite full-back overlaps.",
      "The two 8s stay a pair — one can set, one stays.",
    ],
    [
      "Lay off, then runner. Do not both 9s come short.",
      "Keep the short team while the combo plays.",
    ],
    "One flank pattern. Replay it.",
    "Do not invent a 4-3-3 6 or a 10.",
    "Same shirts. 4-4-2 combo: target lays off, runner goes, overlap. Just draw it."
  ),
  "3-5-2": lesson(
    "attacking_combo",
    "3-5-2 attacking combination plays",
    "Wing-back + mid + striker",
    "Stay in 3-5-2. Width is the wing-back. Combo is WB → holder or 8 → showing 9, or WB give-and-go with the near 8.",
    [
      "Ball-side wing-back, near 8, showing 9.",
      "Second 9 pins. Far wing-back holds width.",
      "Back three plus holder stay in the shape — they are not extra passers on this combination.",
    ],
    [
      "Do not drop both wing-backs into a five on the first pass of the combo.",
      "One 9 shows, one stays.",
    ],
    "Name the three: wing-back, 8, 9.",
    "Do not restack into a back four.",
    "Same shirts. 3-5-2 combo down the right wing-back. Just draw it."
  ),
  "4-1-4-1": lesson(
    "attacking_combo",
    "4-1-4-1 attacking combination plays",
    "6 lock, then 8 + wide mid",
    "Stay in 4-1-4-1. Combo is 6 or full-back into an 8, then wide mid. No 10 unless the coach named one.",
    ["#6 stays as lock.", "Near 8 and wide mid play the pattern.", "#9 is the target."],
    ["If they jump the 6, bounce into the 8, then wide.", "Far wide mid does not both fly."],
    "Three shirts. Keep the 6.",
    "Do not invent a 10 in the pocket.",
    "Same shirts. 4-1-4-1 combo: 6 bounce into 8, wide mid. Just draw it."
  ),
  "5-3-2": lesson(
    "attacking_combo",
    "5-3-2 attacking combination plays",
    "Mid three into a striker",
    "Stay in a back five. Combo is nearer mid → other mid or showing 9. Wing-back can overlap after the set.",
    ["Nearer mid, a second mid, showing 9.", "Wing-back width without emptying the five."],
    ["Play into a mid first. Then the 9.", "One 9 shows, one pins."],
    "Do not skip the mid as a habit.",
    "Do not restack into a 3-5-2 unless the coach pushes the wing-backs up.",
    "Same shirts. 5-3-2 combo into the free mid, then a 9. Just draw it."
  ),
  "2-3-1": lesson(
    "attacking_combo",
    "2-3-1 combination (7v7)",
    "Helper, then wide",
    "Stay in 2-3-1. A combination is 6 into a wide 7/11, or back → 6 → 9. One pattern.",
    ["#6 helper.", "#7 or #11 wide.", "#9 target."],
    ["If they run at the 6, play wide — that is the combo.", "Do not crowd the middle."],
    "Replay the same three friends.",
    "Do not teach 11v11 flank triangles.",
    "Same shirts. 2-3-1: 6 then wide. Just draw it."
  ),
  "3-2-1": lesson(
    "attacking_combo",
    "3-2-1 combination (7v7)",
    "Two mids, one 9",
    "Stay in 3-2-1. Combo is one mid sets, the other or the 9 goes.",
    ["Two mids.", "#9.", "A side back can start it."],
    ["If they jump one mid, play the other."],
    "Two helpers, one target.",
    "Do not invent wingers.",
    "Same shirts. 3-2-1: one mid, the other, 9. Just draw it."
  ),
  "3-2-3": lesson(
    "attacking_combo",
    "3-2-3 combination (9v9)",
    "Two mids + a winger",
    "Stay in 3-2-3. Triangle is a mid, a winger, and the 9 or the other mid.",
    ["Two mids as helpers.", "7 or 11.", "9 stays high."],
    ["If they jump a mid, the combo is the other mid or the wide player."],
    "Front three stay a front three.",
    "Do not assume an 11v11 4-3-3.",
    "Same shirts. 3-2-3 combo: mid, 7, 9. Just draw it."
  ),
  "2-3-2-1": lesson(
    "attacking_combo",
    "2-3-2-1 combination (9v9)",
    "6 then 8, 10 stays in the hole",
    "Stay in 2-3-2-1. Combo is 6 → 8 → a 10. The 10s do not come get the first pass.",
    ["#6.", "An 8.", "A 10 in the hole.", "#9 target."],
    ["Bounce into the 8 if the 6 is jumped."],
    "10s stay higher.",
    "Do not drop the 10s onto the keeper.",
    "Same shirts. 2-3-2-1: 6, 8, 10 in the hole. Just draw it."
  ),
  "3-3-2": lesson(
    "attacking_combo",
    "3-3-2 combination (9v9)",
    "Helper into a showing 9",
    "Stay in 3-3-2. Combo is holding mid or wide mid into the showing 9; the other 9 stays high.",
    ["Helper mid.", "Showing 9.", "Second 9 pins."],
    ["One comes get it, one stays."],
    "Do not both 9s come short.",
    "Do not flatten into a 4-3-3.",
    "Same shirts. 3-3-2: helper into the showing 9. Just draw it."
  ),
};

const DEF_TRANS: Partial<Record<PlayOutShape, TopicLesson>> = {
  "4-3-3": lesson(
    "defensive_transition",
    "4-3-3: attack → defend in this picture",
    "Gegenpress, then compact — still this 4-3-3",
    "Do not restack the shirts. The transition is who hunts and who is rest defence from where they stand now. Nearest three swarm 3–5 seconds. The 6 and the weak-side 8 squeeze the centre. If the hunt fails, compact — do not chase as individuals.",
    [
      "Hunt: the three nearest to the ball (often the 9, a winger, and the near 8).",
      "Rest defence: #6 plus the far #8. They step up and squeeze, they do not both fly.",
      "Back four: step as a line. No huge hole behind the 6.",
      "Far winger: recover inside, not a jog on the touchline.",
    ],
    [
      "Name press or drop in one voice within a few seconds.",
      "If we win it in the swarm, the next action is forward. If not, the block is already forming.",
      "Keep 4-3-3 distances — this is not a 4-4-2 flatten unless the coach names it.",
    ],
    "Draw arrows from the live shirts. Who hunts, who covers. Same picture.",
    "Do not move everyone back to a goal kick. Do not invent a second 6.",
    "Keep the board how it is. Draw the transition from attack to defend. Who is involved? Just draw it."
  ),
  "4-2-3-1": lesson(
    "defensive_transition",
    "4-2-3-1: attack → defend in this picture",
    "Double pivot as the rest screen",
    "Same shirts. Nearest front players hunt. The two holders stay a screen — one never both join the swarm. Front four drop toward a 4-4-2/4-5-1 rest without renaming the attacking shape unless the coach does.",
    [
      "Hunt: 9, 10, ball-side wide attacker — whoever is nearest.",
      "Rest: both pivots. They close the centre.",
      "Full-backs recover if they were high.",
    ],
    ["Name press or drop.", "Pivots do not both step past the ball."],
    "Screen first. Then the swarm.",
    "Do not empty both holders into the hunt.",
    "Keep the board how it is. Transition from attack to defend. Pivots stay. Just draw it."
  ),
  "4-4-2": lesson(
    "defensive_transition",
    "4-4-2: attack → defend in this picture",
    "Two banks of four immediately",
    "Same shirts. Instant two lines of four. Strikers harass. Short team stays short.",
    [
      "Front two: nearest to the ball delays or hunts.",
      "Mid four and back four drop as banks.",
      "Nearest 8 covers the centre.",
    ],
    ["Do not let the two fours split.", "Lateral squeeze, not a sprint in four directions."],
    "Two banks. Same picture.",
    "Do not invent a 6.",
    "Keep the board how it is. Attack to defend as two banks of four. Just draw it."
  ),
  "3-5-2": lesson(
    "defensive_transition",
    "3-5-2: attack → defend in this picture",
    "Wing-backs recover or the three is exposed",
    "Same shirts. Wing-backs must recover. Hunt with a striker and near mid. Back three stay tight. Rest picture can look like a five — still this team’s 3-5-2.",
    [
      "Hunt: nearest 9 and near 8.",
      "Wing-backs: recover now.",
      "Back three plus holder: squeeze.",
    ],
    ["Do not leave a 3v5.", "Force wide, then isolate."],
    "Recovery of the wing-backs is the whole lesson.",
    "Do not restack into a back four.",
    "Keep the board how it is. Attack to defend: wing-backs recover. Just draw it."
  ),
  "4-1-4-1": lesson(
    "defensive_transition",
    "4-1-4-1: attack → defend in this picture",
    "6 lock, four drop as a unit",
    "Same shirts. 6 stays. Midfield four drop together. Nearest wide mid and 9 can hunt for a few seconds.",
    ["Hunt: nearest two or three.", "#6 plus nearest 8: rest.", "Four drop as a unit."],
    ["Do not empty the middle.", "Do not invent a 10."],
    "The 6 is the lock on loss too.",
    "Do not flatten the 6 into a third centre-back as the first answer.",
    "Keep the board how it is. Attack to defend: 6 stays, four drop. Just draw it."
  ),
  "5-3-2": lesson(
    "defensive_transition",
    "5-3-2: attack → defend in this picture",
    "The five is already the rest",
    "Same shirts. Hunt with a mid and a striker. The five does not chase. Force wide.",
    ["Hunt: nearest mid and 9.", "Five: already set.", "Other mids screen."],
    ["Do not break the five to hunt."],
    "Rest is free because you already have five.",
    "Do not push both wing-backs up on the loss.",
    "Keep the board how it is. Attack to defend from the five. Just draw it."
  ),
  "2-3-1": lesson(
    "defensive_transition",
    "2-3-1: get it back or get behind the ball",
    "7v7 — no named gegenpress",
    "Same shirts. Nearest players try to steal. Everyone else gets behind the ball. Ordinary words.",
    ["Nearest friend hunts.", "The rest get behind the ball.", "Two backs stay a pair."],
    ["Get it back or get behind the ball."],
    "Fun, fast, one cue.",
    "Do not lecture cover shadow.",
    "Keep the board how it is. If we lose it, get it back or get behind the ball. Just draw it."
  ),
  "3-2-1": lesson(
    "defensive_transition",
    "3-2-1: two mids recover, three backs stay",
    "7v7 cover",
    "Same shirts. Nearest mid can hunt. Other mid and three backs recover as a group.",
    ["One mid hunts or delays.", "Other mid recovers.", "Three backs stay a group."],
    ["Do not all chase the ball."],
    "Cover in the middle.",
    "No rest-defence lecture.",
    "Keep the board how it is. Lose it: one hunts, the rest recover. Just draw it."
  ),
  "3-2-3": lesson(
    "defensive_transition",
    "3-2-3: front three hunt, two mids screen",
    "9v9",
    "Same shirts. Nearest of the front three hunt. Two mids are the screen. Three backs stay.",
    ["Nearest 7/9/11 hunts.", "Two mids recover as a pair.", "Back three cover."],
    ["Front three can start the hunt. Mids do not both fly."],
    "Still one job per shirt.",
    "Do not assume 11v11 rest defence.",
    "Keep the board how it is. Attack to defend: nearest hunt, mids screen. Just draw it."
  ),
  "2-3-2-1": lesson(
    "defensive_transition",
    "2-3-2-1: 6 screens, 10s do not both chase",
    "9v9",
    "Same shirts. Nearest 10 or 9 hunts. 6 stays. 8s recover. The other 10 does not both chase.",
    ["Nearest attacker hunts.", "#6 screens.", "8s recover."],
    ["10s do not both hunt the first loss."],
    "6 at home.",
    "Do not drop everyone onto the keeper.",
    "Keep the board how it is. Loss: 6 stays, nearest hunts. Just draw it."
  ),
  "3-3-2": lesson(
    "defensive_transition",
    "3-3-2: two 9s start the hunt, three mids recover",
    "9v9",
    "Same shirts. One 9 hunts. Other 9 drops. Three mids recover as a group. Three backs stay.",
    ["Nearest 9 hunts.", "Helper mid screens.", "Backs cover."],
    ["Not both 9s chase into the corner."],
    "Two strikers, one hunts.",
    "Do not flatten into a 4-3-3.",
    "Keep the board how it is. Loss: nearest 9 hunts, mids recover. Just draw it."
  ),
};

const ATT_TRANS: Partial<Record<PlayOutShape, TopicLesson>> = {
  "4-3-3": lesson(
    "attacking_transition",
    "4-3-3: when we win it",
    "First forward option, then expand",
    "Same 4-3-3. On regain, look forward into the 7, 11, or 9 if they are on the shoulder. If not, secure into the 6 or 8 and expand. Do not sterile-keep and do not boot.",
    ["First passer: whoever won it.", "Forward options: 7, 11, 9.", "Secure options: 6, near 8."],
    ["3–6 seconds. Forward if they are broken.", "If not, 6/8 then expand height and width."],
    "Name the first shirt after the regain.",
    "Do not restack. Same picture, new arrows.",
    "Keep the board how it is. We win it — first action forward or secure. Just draw it."
  ),
};

const PRESS: Partial<Record<PlayOutShape, TopicLesson>> = {
  "4-3-3": lesson(
    "press",
    "4-3-3 press (this shape)",
    "Front three + 6 screen",
    "Stay in 4-3-3. Front three start the press. 6 screens. Near 8 jumps or covers the bounce. Back four steps up.",
    ["#9, #7, #11 curve the first press.", "#6 screens the centre.", "Near #8 covers the bounce."],
    ["Jump together. Cover behind the first presser.", "Force one way."],
    "One trigger. Replay it.",
    "Do not flatten into a 4-4-2 to press unless the coach names it.",
    "Keep the shirts. High press in a 4-3-3. Just draw it."
  ),
};

const TOPIC_AGE: Record<string, Partial<Record<PrincipleTopic, string>>> = {
  "U8–U10": {
    attacking_combo:
      "One extra pass. 6 (or the helper) finds a friend, then a wide player. Celebrate the sequence. No third-man lecture, no timing windows.",
    defensive_transition: "Get it back or get behind the ball. That is the whole transition.",
    attacking_transition: "If we steal it, pass to a friend who is free. Fun, not a counter system.",
    play_out: "Goalkeeper finds a friend.",
    press: "Run to the ball as a group. Ordinary words.",
  },
  "U11–U12": {
    attacking_combo:
      "Name three shirts. First this pass, then that. Generous time on the ball. The 9 stays a target; the wide player waits until the 9 plays.",
    defensive_transition: "Nearest hunts. The rest get behind the ball. Two pictures, not three.",
    attacking_transition: "First pass forward if it is obvious. Else a friend.",
    play_out: "If they jump a helper, play the other.",
    press: "Front players can start the hunt. Mids are the screen.",
  },
  U13: {
    attacking_combo:
      "Name the path: 6 into 8/10, then 9, then 11. One picture. The 8/10 is the next pass if they jump the 6. The 9 does not come all the way to the 6. The 11 stays wide until the 9 plays.",
    defensive_transition: "Nearest three hunt. 6 and far 8 stay. Ordinary words: hunt or get behind.",
    attacking_transition: "First forward pass if they are broken. Else the 6.",
    play_out: "Helper, next pass, stay wide.",
    press: "Front three start. 6 is the helper behind the press.",
  },
  "U14–U15": {
    attacking_combo:
      "Courage to receive between the lines on the 8/10. Name one idea: the bounce into 8/10, then the 9. Time on the ball. The 11’s arrival is the next cue, not the same shout.",
    defensive_transition: "Name press or drop. Reward the recover. Do not stack cover shadow yet.",
    attacking_transition: "Forward if on; otherwise secure and expand — one concept.",
    play_out: "Support angle. Reward the receive on the 6.",
    press: "One trigger, shown. Jump together.",
  },
  "U16–U18": {
    attacking_combo:
      "Tight time. Four actions, one path: 6 weight of pass into 8/10 between the lines; 8/10 receives on the half-turn; 9 pins, takes it to feet, or lays off; 11’s run starts with the 9’s first touch — high and wide until then. Sequence those frames. The 7 holds the other flank. This is settled attacking play in their third, not a goal-kick and not a picture of the loss.",
    defensive_transition: "3–5 second swarm. Name the coalition. If bypassed, compact zonal block.",
    attacking_transition: "First action while they are disorganised. Then the next penetration.",
    play_out: "Bounce when the 6 is jumped. Rest defence is part of the restart.",
    press: "Triggers, lock-side, cover behind. Rest distances short.",
  },
};

export type TopicAgeBlock = {
  headline: string;
  body: string;
  canDo: string[];
  notYet: string[];
  talk: string;
};

const TOPIC_AGE_BLOCK: Record<string, Partial<Record<PrincipleTopic, TopicAgeBlock>>> = {
  "U8–U10": {
    attacking_combo: {
      headline: "Attacking combinations · 7v7",
      body:
        "A combination is two or three friends passing in a row. Helper into a wide player or the 9. Lots of time. Fun. Replay the same little path.",
      canDo: ["Pass to a friend, then another", "Keep the 9 high", "Stay wide so the middle is not a crowd"],
      notYet: ["Timed runs off the 9’s touch", "Four-pass filmstrips", "1–2 touch"],
      talk: "Helper, next pass, stay wide. Do not say bounce, pocket, or third-man.",
    },
  },
  "U11–U12": {
    attacking_combo: {
      headline: "Attacking combinations · 9v9",
      body:
        "Name three shirts. Scan, receive, pass. The next pass is the other mid or a wide player. Generous time. The 9 waits as a target.",
      canDo: ["First this pass, then that", "Wide player waits until the 9 plays"],
      notYet: ["Adult timing of a weak-side 11", "Two ideas in one shout"],
      talk: "Name the three shirts. Next pass. Stay wide.",
    },
  },
  U13: {
    attacking_combo: {
      headline: "Attacking combinations · first 11v11",
      body:
        "This 4-3-3 path is 6 → 8/10 → 9 → 11. One picture. Ordinary words. The 8/10 is between the lines. The 9 is the target, not a midfielder. The 11 stays wide until the 9 plays. Replay until that order is obvious.",
      canDo: [
        "Name 6, 8/10, 9, 11",
        "Play 8/10 if they jump the 6",
        "Keep the 11 high until the 9’s pass",
      ],
      notYet: ["Timing windows on the 11’s run", "Adding a second pattern on the same restart"],
      talk: "6 into 8 or 10, then the 9, then the 11. Next pass. Stay wide.",
    },
  },
  "U14–U15": {
    attacking_combo: {
      headline: "Attacking combinations · one concept",
      body:
        "Courage to receive on the 8/10 between the lines. Name the bounce into 8/10, then the 9. Time on the ball. The 11’s arrival is the next picture — do not stack it on the same cue this week if they are still skipping the 6.",
      canDo: [
        "Receive between the lines on 8/10",
        "9 to feet or layoff",
        "Replay until the next pass is obvious",
      ],
      notYet: ["1–2 touch lock on the combination", "A second pattern (overlap, false nine) in the same activity"],
      talk: "Support angle on the 8/10. Then the 9. Then the 11. One idea at a time.",
    },
  },
  "U16–U18": {
    attacking_combo: {
      headline: "Attacking combinations · their third",
      body:
        "11v11. Time and space shrink toward the adult game, on this combination — not on a loss and not on a goal-kick. The path is 6 → 8/10 → 9 → 11. The 6 plays a weighted ball into an 8 (or the 10) between their midfield and back line. That 8/10 receives on the half-turn, sets, or releases into the 9. The 9 is still a target: to feet, or a layoff — not a fourth midfielder on the first pass. The 11 stays high and wide on the weak side until the 9 plays, then arrives on that first touch. The 7 holds the other flank so the finish is a switch, not a crowd. Filmstrip those four actions. Name the shirts (6, 8/10, 9, 11), not only the ball-carrier.",
      canDo: [
        "Execute 6 → 8/10 → 9 → 11 under game-realistic pressure",
        "8/10 half-turn between the lines",
        "Time the 11’s run with the 9’s first touch",
        "Keep 7 high so 11 is the weak-side finish",
      ],
      notYet: [
        "Skipping the 9 to hit 11 as the default",
        "Dropping the 9 into a fourth midfielder on this pattern",
        "Starting the combination from the goalkeeper",
        "Adding a rest-defence or press picture on the same restart",
      ],
      talk:
        "Name the path: 6 into 8/10, 9, 11. Half-turn. Pin. Arrival. Sequence those four actions — this combination only. Do not say rest defence, cover shadow, or play-out on this ask.",
    },
  },
};

export function topicAgeBlock(
  age: string | null | undefined,
  topic: PrincipleTopic
): TopicAgeBlock | null {
  if (!age || topic === "overview") return null;
  return TOPIC_AGE_BLOCK[age]?.[topic] || null;
}

export function topicAgeNote(age: string | null | undefined, topic: PrincipleTopic): string | null {
  if (!age || topic === "overview") return null;
  return TOPIC_AGE[age]?.[topic] || null;
}

export function topicLessonForShape(
  shape: PlayOutShape | null,
  topic: PrincipleTopic
): TopicLesson | null {
  if (!shape || topic === "overview") return null;
  if (topic === "attacking_combo") return COMBO[shape] || null;
  if (topic === "defensive_transition") return DEF_TRANS[shape] || genericDefTrans(shape);
  if (topic === "attacking_transition") return ATT_TRANS[shape] || genericAttTrans(shape);
  if (topic === "press") return PRESS[shape] || genericPress(shape);
  return null;
}

function genericDefTrans(shape: PlayOutShape): TopicLesson {
  return lesson(
    "defensive_transition",
    `${shape}: attack → defend`,
    "Hunt or recover — stay in this shape",
    `Keep the ${shape}. Draw who hunts and who covers from the live shirts.`,
    ["Nearest players hunt.", "The rest recover behind the ball.", "Do not restack the formation."],
    ["Name press or drop.", "Same picture, new arrows."],
    "Who is involved from where they stand now.",
    "Do not invent another formation.",
    `Keep the board how it is. Transition from attack to defend in a ${shape}. Just draw it.`
  );
}

function genericAttTrans(shape: PlayOutShape): TopicLesson {
  return lesson(
    "attacking_transition",
    `${shape}: when we win it`,
    "Forward if on, else secure",
    `Stay in this ${shape}. First action after the regain.`,
    ["The winner of the ball.", "A forward option.", "A secure friend."],
    ["3–6 seconds."],
    "Same shirts.",
    "Do not restack.",
    `Keep the board how it is. We win it in a ${shape}. First action. Just draw it.`
  );
}

function genericPress(shape: PlayOutShape): TopicLesson {
  return lesson(
    "press",
    `${shape} press`,
    "Jump together, cover behind",
    `Stay in this ${shape}.`,
    ["First presser.", "Cover.", "The rest of the block."],
    ["One trigger."],
    "Replay the same press.",
    "Do not change attacking shape to press.",
    `Keep the shirts. Press in a ${shape}. Just draw it.`
  );
}
