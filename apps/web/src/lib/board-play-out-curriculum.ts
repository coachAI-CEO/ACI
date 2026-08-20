/** Play-out curriculum for the board Principles tab. Age from the team; shape from the board. */

export type BoardCoachBand = "USSF_D" | "USSF_C" | "USSF_B_PLUS";
export type PlayOutShape =
  | "4-3-3"
  | "4-2-3-1"
  | "4-4-2"
  | "3-5-2"
  | "4-1-4-1"
  | "5-3-2"
  | "2-3-1"
  | "3-2-1"
  | "3-2-3"
  | "2-3-2-1"
  | "3-3-2";

export type ShapeCurriculum = {
  picture: string;
  jobs: string[];
  teach: string;
  avoid: string;
  boardAsk: string;
};

export type LicenseCurriculum = {
  band: BoardCoachBand;
  license: string;
  age: string;
  who: string;
  playerDemand: string;
  language: string;
  sessionRule: string;
  shapes: Partial<Record<PlayOutShape, ShapeCurriculum>>;
};

export const PLAY_OUT_LICENSE_BANDS: LicenseCurriculum[] = [
  {
    band: "USSF_D",
    license: "USSF D",
    age: "U8–U10",
    who: "7v7. Fun, one job, lots of time on the ball. Play out means: goalkeeper finds a friend.",
    playerDemand: "Beginner: receive and pass. No 1–2 touch. No rest-defence language.",
    language: "Ordinary words. Helper, next pass, stay wide. Do not say pivot, pocket, or trigger.",
    sessionRule: "One picture. Replay the restart. Celebrate the first pass that is not a boot.",
    shapes: {
      "2-3-1": {
        picture:
          "Two backs, three in the middle, one striker. The 6 is the helper in front of the two backs. Wingers stay wide.",
        jobs: [
          "GK: pass to a back or the 6 — not a long boot unless nobody is free.",
          "#6: stand in front of the goalkeeper and show for the ball.",
          "#7 / #11: stay wide so the middle is not a crowd.",
          "#9: stay high as the target.",
        ],
        teach: "If they run at the 6, play wide to a 7 or 11. That is the whole lesson.",
        avoid: "Do not teach 11v11 4-3-3 jobs on a 7v7 board.",
        boardAsk: "Play out from our goal kick in a 2-3-1. Just draw it.",
      },
      "3-2-1": {
        picture:
          "Three backs, two mids, one striker. A back is the first helper. Two mids stay in front.",
        jobs: [
          "GK to a side back. The middle back is cover.",
          "The two mids: one shows, one stays.",
          "The 9 stays high.",
        ],
        teach: "If they jump one mid, play the other. Two helpers, one striker.",
        avoid: "Do not invent wingers from an 11v11 4-3-3.",
        boardAsk: "Play out from our goal kick in a 3-2-1. Just draw it.",
      },
    },
  },
  {
    band: "USSF_D",
    license: "USSF D",
    age: "U11–U12",
    who: "9v9. Still one job per shirt. A little more scanning. Still generous time on the ball.",
    playerDemand: "Beginner–intermediate: scan, receive, pass. No 1–2 touch lock.",
    language: "Clear sentences. Helper, support, next pass. Do not stack rest defence.",
    sessionRule: "One picture. Three or four arrows. Replay the same restart.",
    shapes: {
      "3-2-3": {
        picture:
          "Three backs, two mids, front three. The two mids are the helpers. Wingers stay high and wide. 9 is the target.",
        jobs: [
          "GK to a split back or a mid.",
          "Two mids: one shows, one stays. If they jump one, play the other.",
          "7 and 11 hold the touchline. 9 stays high.",
        ],
        teach: "If they jump a mid, the next pass is the other mid or a wide player — not back to the keeper.",
        avoid: "Do not assume an 11v11 4-3-3. This is a 3-2-3.",
        boardAsk: "Play out from our goal kick in a 3-2-3. Just draw it.",
      },
      "2-3-2-1": {
        picture:
          "Two backs, a 6, two 8s, two attacking mids, one 9. The 6 is the first helper. The 10s stay higher — they do not come get the first pass.",
        jobs: [
          "GK to a back or the 6.",
          "6 shows; 8s are the next pass if the 6 is jumped.",
          "The two attacking mids wait between the lines.",
        ],
        teach: "The 6 is the helper. The next pass is an 8. The 10s stay in the hole.",
        avoid: "Do not drop the 10s onto the goalkeeper.",
        boardAsk: "Play out from our goal kick in a 2-3-2-1. Just draw it.",
      },
      "3-3-2": {
        picture:
          "Three backs, three mids, two strikers. One mid is the helper; the other two stay a step higher. Two strikers — one shows, one stays.",
        jobs: [
          "GK to a side back or the holding mid.",
          "One 9 shows to feet, one stays high.",
          "Wide mids give the sides.",
        ],
        teach: "Two strikers means one can come get it and one stays a target.",
        avoid: "Do not flatten this into a 4-3-3.",
        boardAsk: "Play out from our goal kick in a 3-3-2. Just draw it.",
      },
    },
  },
  {
    band: "USSF_D",
    license: "USSF D",
    age: "U13",
    who: "First full 11v11 year. One job per shirt. Generous time on the ball.",
    playerDemand: "Beginner–intermediate: scan, receive, pass. No 1–2 touch lock.",
    language:
      "Clear, run-it-now sentences. Do not say overload, half-space, third-man, rest defence, or pressing trigger.",
    sessionRule: "One picture. Three or four arrows. One caption. Stop and replay the same restart.",
    shapes: {
      "4-3-3": {
        picture:
          "One holder (#6) in front of the back four. Wingers stay high and wide so the middle does not crowd the first pass. The 9 stays a target, not a midfielder.",
        jobs: [
          "GK: open hips, first pass to a split centre-back or the 6.",
          "#6: get in front of the goalkeeper — be the helper, not a runner up the field.",
          "#2 / #3: stay wide enough that a centre-back can find you.",
          "#7 / #11: hold the touchline so the 8s have a place to play.",
        ],
        teach: "If their strikers jump the 6, the next pass is into an 8 — not back to the keeper.",
        avoid: "Do not drop the wingers into a back six. Do not ask the 9 to come all the way to the box.",
        boardAsk: "Play out from our goal kick in a 4-3-3. Just draw it.",
      },
      "4-2-3-1": {
        picture:
          "Two helpers in front of the backs (#6 and #8). The 10 stays in the hole between their midfield and back line — not next to the goalkeeper.",
        jobs: [
          "GK: pick the free centre-back; the two holders split so one is always open.",
          "#6 / #8: one shows, one stays. If they jump one, play the other.",
          "#10: wait between the lines. Do not drop into the first pass.",
          "#9: pin their centre-backs so the 10 has a window.",
        ],
        teach: "Two holders means we always have a second helper. That is the whole 4-2-3-1 idea at U13.",
        avoid: "Do not let both holders run forward on the first pass. Do not park the 10 on the six-yard box.",
        boardAsk: "Play out from our goal kick in a 4-2-3-1. Just draw it.",
      },
      "4-4-2": {
        picture:
          "Two banks of four. One wide mid stays wide; the other can tuck. Two strikers — one target, one runner. Do not invent a 6 in front of a 4-3-3.",
        jobs: [
          "GK to a centre-back or the nearer 8. The two centre-mids stay a pair.",
          "Wide mids hold the sides so the back four is not playing 4v4 in a phone box.",
          "One 9 shows, one stays high.",
        ],
        teach: "Play out along the line of four, then into a striker. Keep the short team.",
        avoid: "Do not restack this into a 4-3-3 or 4-2-3-1 unless the coach names that change.",
        boardAsk: "Play out from our goal kick in a 4-4-2. Just draw it.",
      },
      "3-5-2": {
        picture:
          "Back three and two wing-backs. The middle centre-back helps the goalkeeper. Two strikers stay high.",
        jobs: [
          "GK to a side centre-back or the holding mid.",
          "Wing-backs give the width — there are no 7 and 11 in a 4-3-3 sense.",
          "One striker shows, one pins.",
        ],
        teach: "Width is the wing-backs. Do not drop them into a back five on the first pass.",
        avoid: "Do not assume a 4-3-3. This is a 3-5-2.",
        boardAsk: "Play out from our goal kick in a 3-5-2. Just draw it.",
      },
      "4-1-4-1": {
        picture:
          "One holder (#6) in front of the back four. A flat four in midfield — two 8s and two wide mids. One striker. Width is the wide mids, not 4-3-3 wingers.",
        jobs: [
          "GK to a split centre-back or the 6.",
          "#6: helper in front of the backs. The two 8s are the next pass if the 6 is jumped.",
          "Wide mids hold the sides. The 9 stays a target.",
        ],
        teach: "If they jump the 6, play an 8. Keep the midfield four — do not invent a 10.",
        avoid: "Do not restack this into a 4-3-3 or 4-2-3-1 unless the coach names that change.",
        boardAsk: "Play out from our goal kick in a 4-1-4-1. Just draw it.",
      },
      "5-3-2": {
        picture:
          "Back five (three centre-backs and two wing-backs) and a midfield three. Two strikers. Width is the wing-backs.",
        jobs: [
          "GK to a side centre-back. The middle centre-back is cover.",
          "One of the three mids shows; the others stay.",
          "One 9 shows, one stays high.",
        ],
        teach: "Play out into a mid, then a striker. Wing-backs give the sides.",
        avoid: "Do not restack this into a 3-5-2 unless the coach names that change.",
        boardAsk: "Play out from our goal kick in a 5-3-2. Just draw it.",
      },
    },
  },
  {
    band: "USSF_C",
    license: "USSF C",
    age: "U14–U15",
    who: "Early 11v11. Courage to receive. One concept per session, named and shown.",
    playerDemand:
      "Intermediate: scan + support angle. Light combined reads. Do not stack three constraints.",
    language:
      "Name one idea (support angle, bounce, or switch) and explain it in the next sentence. No rest-defence / cover-shadow stacking.",
    sessionRule:
      "U14–U15: time on the ball first. Coach the picture, not the duel. Replay the same restart until the next pass is obvious.",
    shapes: {
      "4-3-3": {
        picture:
          "Single 6 as the first support angle. Full-backs give width. Front three stay high so the 6 is not receiving in a crowd.",
        jobs: [
          "Concept: support angle — the 6 shows on the open side of the press, body open to play forward.",
          "If the 6 is jumped, bounce into the 8 on that side. Say that sentence; do not add a third-man lecture.",
          "Wingers hold width until the bounce is played. Then one can tuck.",
          "Centre-backs split to the corners of the box so the first press has to choose.",
        ],
        teach:
          "Players this age often skip the 6 because it feels tight. Reward the receive. The bounce into the 8 is the next session, not the same cue.",
        avoid:
          "Do not demand a 1–2 touch lock. Do not use rest defence as the main teaching point. Do not collapse the 7 and 11 into a midfield five.",
        boardAsk:
          "Play out from our right in a 4-3-3. Show the 6 as the support angle, then bounce into the 8 if they jump the 6.",
      },
      "4-2-3-1": {
        picture:
          "Double pivot so one holder is always the free support angle. The 10 stays in the pocket and does not come get the first pass.",
        jobs: [
          "Concept: bounce — if they jump one holder, the other is the pass. The 10 does not come get the first ball.",
          "Pivots sit as a pair in front of split centre-backs. One pressed, one open.",
          "Full-backs can step higher because two holders protect the middle.",
          "The 9 pins; the 10 receives between lines after the bounce, not before.",
        ],
        teach:
          "Two holders give a second answer when the first is jumped. Keep the 10 in the pocket.",
        avoid:
          "Do not send both pivots into the attack on the first pass. Do not ask the 10 to drop next to the 6. Do not talk cover shadow yet.",
        boardAsk:
          "Play out from our goal kick in a 4-2-3-1. Two holders, bounce into the free 8, 10 stays in the pocket.",
      },
      "4-4-2": {
        picture:
          "Two banks of four. Concept this week: support angle from the nearer centre-mid. Wide mids hold width.",
        jobs: [
          "Name one idea: the nearer 8 shows on the open side of the press.",
          "One wide mid stays wide so we are not playing through a funnel.",
          "One 9 shows to feet, one stays high.",
        ],
        teach: "Replay the restart until the free 8 is obvious. Do not add rest defence.",
        avoid: "Do not restack into another formation unless the coach names it.",
        boardAsk: "Play out from our goal kick in a 4-4-2. Show the free 8 as the support angle.",
      },
      "3-5-2": {
        picture:
          "Back three, two wing-backs. Concept: the middle centre-back or holder is the first helper.",
        jobs: [
          "Wing-backs give width — that is this shape, not a 4-3-3 winger.",
          "One striker shows, one pins.",
          "If they jump the holder, play the side centre-back — one idea.",
        ],
        teach: "Reward the receive in front of the back three. Time on the ball first.",
        avoid: "Do not drop both wing-backs into a back five on the first pass.",
        boardAsk: "Play out from our goal kick in a 3-5-2. Wing-backs wide, one helper in front of the back three.",
      },
      "4-1-4-1": {
        picture:
          "Single 6 as the first support angle. Flat four in midfield. One 9. Concept this week: the 6 shows on the open side of the press.",
        jobs: [
          "Name one idea: if they jump the 6, bounce into an 8. Do not add a third cue.",
          "Wide mids hold width so the 6 is not receiving in a crowd.",
          "The 9 stays a target.",
        ],
        teach: "Reward the receive on the 6. The bounce into the 8 is the next picture, not the same cue.",
        avoid: "Do not invent a 10. Stay in this 4-1-4-1.",
        boardAsk: "Play out from our goal kick in a 4-1-4-1. 6 as the support angle, bounce into an 8 if jumped.",
      },
      "5-3-2": {
        picture:
          "Back five and a midfield three. Concept: the nearer centre-mid is the first helper. Wing-backs give width.",
        jobs: [
          "GK to a side centre-back or the nearer mid.",
          "One 9 shows, one pins.",
          "If they jump one mid, play another — one idea.",
        ],
        teach: "Replay the restart until the free mid is obvious. Time on the ball first.",
        avoid: "Do not restack into a 3-5-2 unless the coach names it.",
        boardAsk: "Play out from our goal kick in a 5-3-2. Wing-backs wide, one helper in the midfield three.",
      },
    },
  },
  {
    band: "USSF_B_PLUS",
    license: "USSF B+",
    age: "U16–U18",
    who: "Game-realistic pressure. Several reads at once. Play-out shapes the next press.",
    playerDemand: "Advanced: tight time and space. Rest defence and bounce are expected.",
    language:
      "Systemic: rest defence, cover shadow, bounce off the 8 when the 6 is jumped, build-up shaping the press.",
    sessionRule:
      "U16–U18: compress time. Name the coalition (GK–CB–pivot–8), not only the ball-carrier. Filmstrip: start, then the play.",
    shapes: {
      "4-3-3": {
        picture:
          "Sweeper-keeper, split CBs, dropping single pivot as a temporary back three vs two strikers. Full-backs high-wide. Front three stay out of the first line. Rest defence is the 6 plus the nearest 8 — not a double screen.",
        jobs: [
          "If they jump the 6, bounce into att-8 — never recycle to the jumped 6 or back to GK.",
          "From our right the passer is #2, not CB #4. Horizontal sluice through the dropped pivot, then diagonal into the 8.",
          "Gegenpress rest defence: nearest three swarm 3–5 seconds; 6 and the weak-side 8 squeeze the centre.",
          "False nine only after the first line is beaten — do not drop the 9 into the build as a fourth midfielder.",
        ],
        teach:
          "4-3-3 play-out is a 3+1 vs their first press, then a flank triangle. The risk is the single 6: the bounce off the 8 is mandatory when they jump.",
        avoid:
          "Do not flatten into a 4-4-2 in possession. Do not leave the 6 as the only rest-defence player if both 8s have gone.",
        boardAsk:
          "Play out from our right in a 4-3-3. Bounce into the 8 if they jump the 6, not back to the GK. As a sequence.",
      },
      "4-2-3-1": {
        picture:
          "Doble pivot as a permanent rest-defence screen. #10 as enganche in the pocket. Full-backs liberated because two holders own the centre. On loss the pivots close central channels; front four drop to 4-4-2 / 4-5-1.",
        jobs: [
          "If they jump the 6, bounce into the 8 — the second pivot is the designed answer, not an emergency.",
          "From our right: #2 into the free pivot, then into the 10’s cover shadow behind their 8.",
          "One pivot never both join the first attack. That is the B+ rest-defence lock.",
          "Wingers occupy inside channels after the bounce; full-backs overlap only once the 10 has the pocket.",
        ],
        teach:
          "Teach the midfield square, then the 10 hole. The second pivot is the designed bounce. Not a generic blob.",
        avoid:
          "Do not let both pivots step past the ball. Do not start the combo from an unnamed shirt if the coach named 9/10/8.",
        boardAsk:
          "Play out from our right in a 4-2-3-1. Bounce into the 8 if they jump the 6, 10 in the pocket, rest defence with the double pivot. As a sequence.",
      },
      "4-4-2": {
        picture:
          "Short team ≤25m. Sliding back four. One wide mid tucks, opposite full-back overlaps after the first line is beaten.",
        jobs: [
          "If they jump a centre-mid, bounce into the other 8 — not back to GK.",
          "Rest defence is the two 8s plus the nearest full-back, not a single 6.",
          "Target + runner up top after the bounce.",
        ],
        teach: "4-4-2 play-out is a pair of 8s and a short team. Keep the distances.",
        avoid: "Do not invent a 4-3-3 6. Stay in this 4-4-2.",
        boardAsk: "Play out from our right in a 4-4-2. Bounce into the free 8. As a sequence.",
      },
      "3-5-2": {
        picture:
          "Libero + holding mid as sluice. Wing-backs high. Two strikers. Rest shape can become 5-3-2 on loss.",
        jobs: [
          "Middle CB carries or finds the holder. Wing-backs are the width.",
          "On loss the wing-backs recover; do not leave a 3v5 in the back.",
          "First forward pass after the bounce is into a striker or the far wing-back.",
        ],
        teach: "3-5-2 play-out is a back-three plus a sluice. Width is not a 4-3-3 winger.",
        avoid: "Do not restack into a back four unless the coach changes shape.",
        boardAsk: "Play out from our goal kick in a 3-5-2. Wing-backs high, bounce into the holder. As a sequence.",
      },
      "4-1-4-1": {
        picture:
          "Single 6 as rest-defence lock. Midfield four screens the centre. One 9. On loss the four drop as a unit.",
        jobs: [
          "If they jump the 6, bounce into an 8 — never recycle to the jumped 6.",
          "Wide mids can tuck after the first line is beaten; one full-back overlaps, the other stays.",
          "Rest defence is the 6 plus the nearest 8. Do not empty the middle.",
        ],
        teach: "4-1-4-1 play-out is a 6 plus a flat four. Keep the distances. Stay in this shape.",
        avoid: "Do not invent a 10 in the pocket. Do not flatten the 6 into a second centre-back on the first pass.",
        boardAsk: "Play out from our right in a 4-1-4-1. Bounce into the 8 if they jump the 6. As a sequence.",
      },
      "5-3-2": {
        picture:
          "Back five as the rest shape. Midfield three as the sluice. Two strikers. Wing-backs start deeper than in a 3-5-2.",
        jobs: [
          "Side centre-back or nearer mid is the first helper. Bounce into another mid if jumped.",
          "On loss the five is already set — do not chase with a centre-back.",
          "First forward pass after the bounce is into a striker or the far wing-back.",
        ],
        teach: "5-3-2 play-out is a back five plus a three. Width is the wing-backs.",
        avoid: "Do not restack into a 3-5-2 unless the coach pushes the wing-backs up.",
        boardAsk: "Play out from our goal kick in a 5-3-2. Bounce into the free mid. As a sequence.",
      },
    },
  },
];

const GAME_MODEL_PLAY_OUT: Record<string, string> = {
  POSSESSION:
    "Play-out is ball security first: height, width, depth, then a line-break. Circulate to move their first press before you penetrate.",
  PRESSING:
    "Play-out prepares the next press. Keep rest-defence distances short. Prefer a vertical option when it is on; do not sterile-circulate into a broken rest shape.",
  TRANSITION:
    "The restart is a 3–6 second rehearsal. First action after a loss (press or drop) matters as much as the first pass. Body open to play forward.",
  ROCKLIN_FC:
    "Advance through the thirds with passing, dribbling, and movement. On loss, steal it back or force an error; if not, compact. On regain, counter if it is on.",
  COACHAI:
    "Balance security and penetration. Mix a safe support angle with a line-break when the picture is on. Do not live only in sterile keeping or forced directness.",
};

export function gameModelPlayOutNote(gameModelId?: string | null): string {
  const id = String(gameModelId || "COACHAI").toUpperCase();
  return GAME_MODEL_PLAY_OUT[id] || GAME_MODEL_PLAY_OUT.COACHAI;
}

export function gameModelLabel(gameModelId?: string | null): string {
  const id = String(gameModelId || "").toUpperCase();
  if (id === "POSSESSION") return "Possession";
  if (id === "PRESSING") return "Pressing";
  if (id === "TRANSITION") return "Transition";
  if (id === "ROCKLIN_FC") return "Rocklin FC";
  if (id === "COACHAI") return "Balanced";
  return id ? id.replace(/_/g, " ") : "Club model";
}

export function ageYearsFromGroup(ageGroup?: string | null): number | null {
  const n = parseInt(String(ageGroup || "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** Assigned team age → curriculum band. Null = no age (DOC): show how age changes. */
export function curriculumForAssignedAge(ageGroup?: string | null): LicenseCurriculum | null {
  const y = ageYearsFromGroup(ageGroup);
  if (y == null) return null;
  if (y <= 10) return PLAY_OUT_LICENSE_BANDS[0];
  if (y <= 12) return PLAY_OUT_LICENSE_BANDS[1];
  if (y === 13) return PLAY_OUT_LICENSE_BANDS[2];
  if (y <= 15) return PLAY_OUT_LICENSE_BANDS[3];
  return PLAY_OUT_LICENSE_BANDS[4];
}

export function languageForLicense(coachLevel?: string | null): { license: string; language: string } {
  const v = String(coachLevel || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (v === "USSF_C" || v === "C") {
    return { license: "USSF C", language: PLAY_OUT_LICENSE_BANDS[3].language };
  }
  if (v === "USSF_B_PLUS" || v === "USSF_B" || v === "B+" || v === "B") {
    return { license: "USSF B+", language: PLAY_OUT_LICENSE_BANDS[4].language };
  }
  return { license: "USSF D", language: PLAY_OUT_LICENSE_BANDS[2].language };
}

export function curriculumForBand(band?: string | null): LicenseCurriculum {
  const v = String(band || "").toUpperCase().replace(/\s+/g, "_");
  if (v === "USSF_C" || v === "C") return PLAY_OUT_LICENSE_BANDS[3];
  if (v === "USSF_B_PLUS" || v === "USSF_B" || v === "B+" || v === "B") {
    return PLAY_OUT_LICENSE_BANDS[4];
  }
  return PLAY_OUT_LICENSE_BANDS[2];
}

export function normalizePlayOutShape(raw?: string | null): PlayOutShape | null {
  const n = String(raw || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/^433$/i, "4-3-3")
    .replace(/^4231$/i, "4-2-3-1")
    .replace(/^442$/i, "4-4-2")
    .replace(/^352$/i, "3-5-2")
    .replace(/^4141$/i, "4-1-4-1")
    .replace(/^532$/i, "5-3-2")
    .replace(/^231$/i, "2-3-1")
    .replace(/^321$/i, "3-2-1")
    .replace(/^323$/i, "3-2-3")
    .replace(/^2321$/i, "2-3-2-1")
    .replace(/^332$/i, "3-3-2");
  const known: PlayOutShape[] = [
    "4-3-3",
    "4-2-3-1",
    "4-4-2",
    "3-5-2",
    "4-1-4-1",
    "5-3-2",
    "2-3-1",
    "3-2-1",
    "3-2-3",
    "2-3-2-1",
    "3-3-2",
  ];
  return known.includes(n as PlayOutShape) ? (n as PlayOutShape) : null;
}

/** Live attacking shape only. Never default to 4-3-3 or 4-2-3-1. */
export function inferAttShape(opts: {
  attFormation?: string | null;
  players?: Array<{ team?: string; role?: string; number?: number }>;
}): PlayOutShape | null {
  const fromRoster = inferAttShapeFromPlayers(opts.players);
  if (fromRoster) return fromRoster;
  return normalizePlayOutShape(opts.attFormation);
}

function inferAttShapeFromPlayers(
  players?: Array<{ team?: string; role?: string; number?: number }>
): PlayOutShape | null {
  const att = (players || []).filter((p) => String(p.team || "").toUpperCase() === "ATT");
  if (att.length < 6) return null;
  const roles = att.map((p) => String(p.role || "").toUpperCase());
  const count = (re: RegExp) => roles.filter((r) => re.test(r)).length;
  const n = att.filter((p) => p.number !== 1 && String(p.role || "").toUpperCase() !== "GK").length;
  const cbs = count(/^(CB|RCB|LCB)$/);
  const cdms = count(/^(CDM|DM)$/);
  const cams = count(/^(CAM|AM)$/);
  const cms = count(/^(CM|RCM|LCM)$/);
  const wideMids = count(/^(RM|LM)$/);
  const wingers = count(/^(RW|LW|RAM|LAM)$/);
  const wingBacks = count(/^(RWB|LWB|WB)$/);
  const strikers = count(/^(ST|CF)$/);
  if (n <= 6) {
    if (cbs >= 1 && count(/^(CB|RB|LB)$/) >= 3 && cms >= 2) return "3-2-1";
    if (wideMids >= 2 && cms + cdms >= 1) return "2-3-1";
    if (wingers >= 2 && cms + cdms >= 1) return "2-3-1";
    return null;
  }
  if (n <= 8) {
    if (cdms >= 1 && (cams >= 2 || wingers >= 2)) return "2-3-2-1";
    if (strikers >= 2 && cms + cdms >= 3) return "3-3-2";
    if (cbs >= 1 && count(/^(CB|RB|LB)$/) >= 3 && wingers >= 2) return "3-2-3";
    return null;
  }
  if (cbs >= 3 && wingBacks >= 2) {
    if (cms >= 3 && cdms === 0) return "5-3-2";
    return "3-5-2";
  }
  if (cbs >= 3) return "3-5-2";
  if (cdms >= 2 && (cams >= 1 || wingers >= 2)) return "4-2-3-1";
  if (cdms === 1 && wideMids >= 2 && strikers <= 1) return "4-1-4-1";
  if (wideMids >= 2) return "4-4-2";
  if (cdms === 1 && cms >= 2) return "4-3-3";
  if (wingers >= 2 && cms >= 2 && cdms <= 1) return "4-3-3";
  return null;
}

export function shapeLesson(
  band: LicenseCurriculum | null,
  shape: PlayOutShape
): ShapeCurriculum | null {
  if (band?.shapes[shape]) return band.shapes[shape] || null;
  for (const b of PLAY_OUT_LICENSE_BANDS) {
    if (b.shapes[shape]) return b.shapes[shape] || null;
  }
  return null;
}

export function bandsThatHaveShape(shape: PlayOutShape): LicenseCurriculum[] {
  return PLAY_OUT_LICENSE_BANDS.filter((b) => Boolean(b.shapes[shape]));
}

export function chassisForShape(shape: PlayOutShape): { title: string; body: string } {
  if (shape === "4-3-3") {
    return {
      title: "This attacking shape: 4-3-3",
      body:
        "One holder (#6). If their first press jumps that 6, the designed next pass is a bounce into an 8. Width lives in the 7 and 11. The 9 stays a target.",
    };
  }
  if (shape === "4-2-3-1") {
    return {
      title: "This attacking shape: 4-2-3-1",
      body:
        "Two holders (#6 and #8). One can be jumped and the other is still free. The 10 stays in the pocket and does not come get the first pass.",
    };
  }
  if (shape === "4-4-2") {
    return {
      title: "This attacking shape: 4-4-2",
      body: "Two banks of four. A pair of 8s, not a single 6. One wide mid can tuck; two strikers — target and runner.",
    };
  }
  if (shape === "3-5-2") {
    return {
      title: "This attacking shape: 3-5-2",
      body: "Back three and wing-backs for width. A holder in front of the three. Two strikers.",
    };
  }
  if (shape === "4-1-4-1") {
    return {
      title: "This attacking shape: 4-1-4-1",
      body: "One holder (#6). A flat four in midfield. One striker. Width lives in the wide mids.",
    };
  }
  if (shape === "5-3-2") {
    return {
      title: "This attacking shape: 5-3-2",
      body: "Back five and a midfield three. Two strikers. Width is the wing-backs.",
    };
  }
  if (shape === "2-3-1") {
    return {
      title: "This attacking shape: 2-3-1",
      body: "7v7. Two backs, a helper in front (#6), wide 7 and 11, one striker.",
    };
  }
  if (shape === "3-2-1") {
    return {
      title: "This attacking shape: 3-2-1",
      body: "7v7. Three backs, two mids as helpers, one striker.",
    };
  }
  if (shape === "3-2-3") {
    return {
      title: "This attacking shape: 3-2-3",
      body: "9v9. Three backs, two mids, front three. Helpers are the two mids.",
    };
  }
  if (shape === "2-3-2-1") {
    return {
      title: "This attacking shape: 2-3-2-1",
      body: "9v9. A 6 as first helper, 8s next, attacking mids stay in the hole.",
    };
  }
  return {
    title: `This attacking shape: ${shape}`,
    body: "Stay on this shape. Do not restack into another formation unless the coach names it.",
  };
}
