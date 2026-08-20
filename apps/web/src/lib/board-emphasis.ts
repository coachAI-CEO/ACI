import type { DiagramV1 } from "@/types/diagram";
import type {
  BoardSetupChannel,
  BoardSetupPhase,
  BoardSetupZone,
} from "@/lib/board-phase-setup";
import type { PrincipleTopic } from "@/lib/board-principle-topics";
import type { PlayOutShape } from "@/lib/board-play-out-curriculum";

export type BoardEmphasis = {
  phase: BoardSetupPhase | null;
  zone: BoardSetupZone | null;
  channel: BoardSetupChannel | null;
  attFormation?: string | null;
};

export type PhaseZoneExpect = {
  title: string;
  body: string;
  canDo: string[];
  notYet: string[];
};

function textFromDiagram(diagram?: DiagramV1 | null): string {
  if (!diagram) return "";
  const labels = (diagram.labels || []).map((l) => l.text || "");
  const areas = (diagram.areas || []).map((a) => a.label || "");
  const frames = diagram.sequence?.frames || [];
  const active =
    frames.find((f) => f.id === diagram.sequence?.activeFrameId) || frames[frames.length - 1];
  const frameLabels = (active?.labels || []).map((l) => l.text || "");
  const frameAreas = (active?.areas || []).map((a) => a.label || "");
  return [...labels, ...areas, ...frameLabels, ...frameAreas].filter(Boolean).join(" · ");
}

function parseText(text: string): Pick<BoardEmphasis, "phase" | "zone" | "channel"> {
  const t = text.toLowerCase();
  let phase: BoardSetupPhase | null = null;
  if (/\btransition\b|press after|counterpress|gegenpress/.test(t)) phase = "TRANSITION";
  else if (/\bdefending\b|red defending|out of possession/.test(t)) phase = "DEFENDING";
  else if (/\battacking\b|blue attacking|build[-\s]?up|play(?:ing)?[\s-]?out/.test(t)) {
    phase = "ATTACKING";
  }

  let zone: BoardSetupZone | null = null;
  if (/def(?:ensive)? third|goal[-\s]?kick|build[-\s]?up/.test(t)) zone = "DEFENSIVE_THIRD";
  else if (/att(?:acking)? third|final third/.test(t)) zone = "ATTACKING_THIRD";
  else if (/\bmiddle\b|\bpocket\b/.test(t)) zone = "MIDDLE_THIRD";

  let channel: BoardSetupChannel | null = null;
  if (/\bleft\b/.test(t)) channel = "LEFT";
  else if (/\bright\b/.test(t)) channel = "RIGHT";
  else if (/\bcenter|central\b/.test(t)) channel = "CENTER";

  return { phase, zone, channel };
}

function fromBall(diagram?: DiagramV1 | null): Pick<BoardEmphasis, "zone" | "channel"> {
  const frames = diagram?.sequence?.frames || [];
  const active =
    frames.find((f) => f.id === diagram?.sequence?.activeFrameId) || frames[frames.length - 1];
  const ball = (active?.balls || diagram?.balls || [])[0] as { x?: number; y?: number } | undefined;
  let zone: BoardSetupZone | null = null;
  let channel: BoardSetupChannel | null = null;
  if (typeof ball?.y === "number") {
    if (ball.y >= 67) zone = "DEFENSIVE_THIRD";
    else if (ball.y <= 33) zone = "ATTACKING_THIRD";
    else zone = "MIDDLE_THIRD";
  }
  if (typeof ball?.x === "number") {
    if (ball.x >= 62) channel = "LEFT";
    else if (ball.x <= 38) channel = "RIGHT";
    else channel = "CENTER";
  }
  return { zone, channel };
}

/** Setup dropdowns win; otherwise captions + ball on the live diagram. */
export function resolveEmphasis(
  live?: BoardEmphasis | null,
  diagram?: DiagramV1 | null
): BoardEmphasis {
  const parsed = parseText(textFromDiagram(diagram));
  const ball = fromBall(diagram);
  const phase = live?.phase || parsed.phase;
  const zone = live?.zone || parsed.zone || ball.zone;
  const channel = live?.channel || parsed.channel || ball.channel;
  return {
    phase,
    zone,
    channel,
    attFormation: live?.attFormation || null,
  };
}

export function hasEmphasis(e: BoardEmphasis): boolean {
  return Boolean(e.phase || e.zone || e.channel);
}

export function emphasisLabel(e: BoardEmphasis, shape?: PlayOutShape | null): string {
  const bits = [
    e.phase === "ATTACKING" ? "Attacking" : e.phase === "DEFENDING" ? "Defending" : e.phase === "TRANSITION" ? "Transition" : null,
    e.zone === "DEFENSIVE_THIRD" ? "def third" : e.zone === "MIDDLE_THIRD" ? "middle third" : e.zone === "ATTACKING_THIRD" ? "att third" : null,
    e.channel === "LEFT" ? "left" : e.channel === "RIGHT" ? "right" : e.channel === "CENTER" ? "center" : null,
    shape || e.attFormation || null,
  ].filter(Boolean);
  return bits.join(" · ") || "No phase / zone / channel set";
}

/** No clear chat ask → principle from Setup emphasis. */
export function topicFromEmphasis(e: BoardEmphasis): PrincipleTopic {
  if (e.phase === "TRANSITION") return "defensive_transition";
  if (e.phase === "DEFENDING") return "press";
  if (e.phase === "ATTACKING") {
    if (e.zone === "DEFENSIVE_THIRD") return "play_out";
    return "attacking_combo";
  }
  if (e.zone === "DEFENSIVE_THIRD") return "play_out";
  if (e.zone === "ATTACKING_THIRD" || e.zone === "MIDDLE_THIRD") return "attacking_combo";
  return "overview";
}

const PHASE: Record<string, Record<string, { headline: string; body: string; canDo: string[]; notYet: string[] }>> = {
  "U8–U10": {
    ATTACKING: {
      headline: "Attacking · 7v7",
      body: "Score and keep the ball with friends. One job. Lots of time. The picture is who has the ball and a free friend — not a system.",
      canDo: ["Pass to a friend", "Dribble into space", "Shoot when near goal"],
      notYet: ["Rest defence", "Named combinations of four shirts", "1–2 touch"],
    },
    DEFENDING: {
      headline: "Defending · 7v7",
      body: "Get behind the ball as a group. Nearest player can go to the ball. Ordinary words.",
      canDo: ["Run back together", "Nearest friend to the ball"],
      notYet: ["Pressing triggers", "Cover shadow", "Lock-side language"],
    },
    TRANSITION: {
      headline: "Transition · 7v7",
      body: "If we lose it: get it back or get behind the ball. If we steal it: pass to a friend who is free.",
      canDo: ["Steal or recover — one cue"],
      notYet: ["3–5 second gegenpress", "Name press or drop as a system"],
    },
  },
  "U11–U12": {
    ATTACKING: {
      headline: "Attacking · 9v9",
      body: "Scan, receive, pass. Helpers in midfield. Still generous time. One picture.",
      canDo: ["If they jump a helper, play the other", "Stay wide so the middle is not a crowd"],
      notYet: ["Rest-defence lock", "Three-phase filmstrip"],
    },
    DEFENDING: {
      headline: "Defending · 9v9",
      body: "Nearest hunt. The rest get behind the ball. Front players can start; mids screen.",
      canDo: ["Two pictures: hunt, or recover"],
      notYet: ["Cover-shadow stacking", "Low-block sliding lecture"],
    },
    TRANSITION: {
      headline: "Transition · 9v9",
      body: "First pass forward if it is obvious. Else a friend. On loss: nearest hunts, rest recover.",
      canDo: ["Sequence: first this, then that"],
      notYet: ["Named 3–6 second coalition"],
    },
  },
  U13: {
    ATTACKING: {
      headline: "Attacking · first 11v11",
      body: "One picture, ordinary words. Helper, next pass, stay wide. Bounce is the next pass — not rest defence as the main point.",
      canDo: ["One job per shirt on a full field", "Replay the same restart"],
      notYet: ["False nine as the first session", "1–2 touch lock"],
    },
    DEFENDING: {
      headline: "Defending · first 11v11",
      body: "Front players can start the hunt. A helper screens. Backs stay a group. Say hunt or get behind — not trigger jargon.",
      canDo: ["Jump together on a picture they can see"],
      notYet: ["Lock-side / cover-shadow stack"],
    },
    TRANSITION: {
      headline: "Transition · first 11v11",
      body: "Nearest three can hunt. The holder and a far mid stay. Ordinary words.",
      canDo: ["Hunt or get behind, from where they stand"],
      notYet: ["Gegenpress as a 3–5 second system name"],
    },
  },
  "U14–U15": {
    ATTACKING: {
      headline: "Attacking · one named concept",
      body: "Courage to receive. Name support angle or bounce. Time on the ball. Coach the picture, not the duel.",
      canDo: ["One concept, shown and repeated", "Body open on the open side of the press"],
      notYet: ["Rest defence as the main cue", "Three constraints in one activity"],
    },
    DEFENDING: {
      headline: "Defending · one trigger",
      body: "Name one trigger and jump together. Reward the recover. Do not stack cover shadow yet.",
      canDo: ["One trigger, shown"],
      notYet: ["Low-block + press + rest defence in the same shout"],
    },
    TRANSITION: {
      headline: "Transition · press or drop",
      body: "Name press or drop. Reward the recover. Time on the ball when we win it back.",
      canDo: ["One shared decision"],
      notYet: ["Cover-shadow lecture on the same restart"],
    },
  },
  "U16–U18": {
    ATTACKING: {
      headline: "Attacking · game-realistic",
      body: "Tight time/space. Combinations plus rest defence. Sequence: start, then the play. Bounce when the first helper is jumped.",
      canDo: ["Named shirts in a path", "6 plus nearest 8 as rest while the combo plays"],
      notYet: ["Changing shape unless the coach names it"],
    },
    DEFENDING: {
      headline: "Defending · coordinated press or block",
      body: "Triggers, lock-side, cover behind the first presser. Compact if broken. Protect space in behind.",
      canDo: ["Jump together", "Force one way"],
      notYet: ["Chasing as individuals"],
    },
    TRANSITION: {
      headline: "Transition · 3–6 seconds",
      body: "Nearest three swarm. Name the coalition. If bypassed, compact zonal block. On regain, first action while they are disorganised.",
      canDo: ["Press or drop named early", "Rest defence as part of the picture"],
      notYet: ["Jogging into a broken shape"],
    },
  },
};

const ZONE: Record<string, Record<string, string>> = {
  "U8–U10": {
    DEFENSIVE_THIRD: "Near our goal: goalkeeper finds a friend. Replay the restart. Celebrate the first pass that is not a boot.",
    MIDDLE_THIRD: "In the middle: pass or dribble into space. Do not crowd.",
    ATTACKING_THIRD: "Near their goal: shoot or pass to a friend. Fun finishes.",
  },
  "U11–U12": {
    DEFENSIVE_THIRD: "Our third: helpers show. If they jump one, play the other or wide.",
    MIDDLE_THIRD: "Middle: two helpers. Wingers stay wide. Scan before you receive.",
    ATTACKING_THIRD: "Their third: 9 stays a target. Wide players hold the sides.",
  },
  U13: {
    DEFENSIVE_THIRD: "Our third: split backs, helper in front, next pass if they jump. One picture.",
    MIDDLE_THIRD: "Middle: circulate then a line-break. Stay wide. One caption.",
    ATTACKING_THIRD: "Their third: 9 is a target. Combinations after the first line is beaten — not a false nine on the first pass.",
  },
  "U14–U15": {
    DEFENSIVE_THIRD: "Our third: support angle on the helper. Reward the receive. Bounce is the next picture, not the same cue.",
    MIDDLE_THIRD: "Middle: one named concept (bounce or switch). Time on the ball.",
    ATTACKING_THIRD: "Their third: patience to create a 2v1 or a cutback. Do not demand a 1–2 touch lock.",
  },
  "U16–U18": {
    DEFENSIVE_THIRD: "Our third: play-out shapes the next press. Bounce when jumped. Rest defence is part of the restart.",
    MIDDLE_THIRD: "Middle: progression with rest distances short. Diagonal after the sluice. Sequence frames.",
    ATTACKING_THIRD: "Their third: flank triangle or interior path, then rest defence. False nine only after the first line is beaten.",
  },
};

const CHANNEL: Record<string, string> = {
  LEFT: "Left channel: the picture lives on that side. Weak side holds width; do not empty it.",
  RIGHT: "Right channel: the picture lives on that side. Weak side holds width; do not empty it.",
  CENTER: "Centre: through the middle. Width still exists so the first pass is not a crowd.",
};

/** Attacking-combination copy only — never play-out, rest defence, or a loss. */
const COMBO_PHASE: Record<string, { headline: string; body: string; canDo: string[]; notYet: string[] }> = {
  "U8–U10": {
    headline: "attacking combination",
    body: "A combination is two or three friends passing in a row. Helper, then a wide player or the 9. Lots of time. Fun.",
    canDo: ["Pass to a friend, then another", "Keep the 9 high"],
    notYet: ["Timed weak-side runs", "Four-pass filmstrips"],
  },
  "U11–U12": {
    headline: "attacking combination",
    body: "Name three shirts. First this pass, then that. Generous time. The 9 stays a target. The wide player waits until the 9 plays.",
    canDo: ["Name three shirts", "Wide player waits for the 9"],
    notYet: ["Adult timing of a weak-side 11"],
  },
  U13: {
    headline: "attacking combination",
    body: "Path: 6 into 8/10, then 9, then 11. One picture. The 9 is a target, not a midfielder. The 11 stays wide until the 9 plays.",
    canDo: ["Name 6, 8/10, 9, 11", "Keep the 11 high until the 9’s pass"],
    notYet: ["Timing windows on the 11’s run"],
  },
  "U14–U15": {
    headline: "attacking combination",
    body: "Courage to receive on the 8/10 between the lines. Bounce into 8/10, then the 9. Time on the ball. The 11’s arrival is the next picture.",
    canDo: ["Receive between the lines on 8/10", "9 to feet or layoff"],
    notYet: ["A second pattern on the same restart"],
  },
  "U16–U18": {
    headline: "attacking combination",
    body: "Settled attacking play. Four actions, one path: 6 weight of pass into 8/10 between the lines; 8/10 half-turn; 9 to feet or layoff; 11 arrives on the 9’s first touch. Name those shirts. This is not a restart from the goalkeeper and not a picture of the loss.",
    canDo: [
      "Execute 6 → 8/10 → 9 → 11 under pressure",
      "Time the 11 with the 9’s first touch",
      "Keep 7 high so 11 is the weak-side finish",
    ],
    notYet: [
      "Skipping the 9 to hit 11 as the default",
      "Dropping the 9 into a fourth midfielder",
      "Starting this combination from the goalkeeper",
    ],
  },
};

const COMBO_ZONE: Record<string, Record<string, string>> = {
  "U8–U10": {
    DEFENSIVE_THIRD: "This combination is not a goal-kick. Get the ball to a helper, then play the little path toward their goal.",
    MIDDLE_THIRD: "In the middle: helper, then a wide friend or the 9. Do not crowd.",
    ATTACKING_THIRD: "Near their goal: helper into the 9 or a wide player, then a finish. Fun.",
  },
  "U11–U12": {
    DEFENSIVE_THIRD: "Do not turn this into play-out from our box. Get it to the helper, then the three-shirt path toward their goal.",
    MIDDLE_THIRD: "Middle: two helpers, then a wide player. The 9 waits as a target.",
    ATTACKING_THIRD: "Their third: 9 stays a target. Wide player waits until the 9 plays, then arrives.",
  },
  U13: {
    DEFENSIVE_THIRD: "This is not a goal-kick play-out. Once the 6 has it in their half, the path is still 6 → 8/10 → 9 → 11.",
    MIDDLE_THIRD: "Middle: 6 into 8/10 between the lines, 9 stays a target higher, 11 stays wide.",
    ATTACKING_THIRD:
      "Their third: 6 plays into 8/10 between their midfield and back line. 8/10 sets or turns into the 9. 9 receives to feet or lays off. 11 stays high and wide until the 9 plays, then arrives.",
  },
  "U14–U15": {
    DEFENSIVE_THIRD: "Not a goal-kick pattern. Advance until the 6 can play 8/10, then the 9, then the 11.",
    MIDDLE_THIRD: "Middle: courage to receive on 8/10. Then the 9. The 11 is the next picture.",
    ATTACKING_THIRD:
      "Their third: patience to free 8/10 between the lines, then the 9, then the 11. Do not demand a 1–2 touch lock on this path yet.",
  },
  "U16–U18": {
    DEFENSIVE_THIRD:
      "This combination is not a goal-kick play-out. If the ball is in our third, get it to the 6 — the attacking path 6 → 8/10 → 9 → 11 starts once you can play forward into their half.",
    MIDDLE_THIRD:
      "Middle third: 6 still finds 8/10 between the lines. 9 stays a target higher. 11 stays wide. Do not flatten this into circulation with no 9 and no 11.",
    ATTACKING_THIRD:
      "Their third: this is the combination. 6 plays into 8/10 between their midfield and back line. That 8/10 sets or turns into the 9. The 9 pins, receives to feet, or lays off — still a target, not a fourth midfielder. The 11 stays high and wide on the weak side until the 9 plays, then arrives. The 7 holds the other flank so the finish is a switch, not a crowd.",
  },
};

const COMBO_CHANNEL: Record<string, string> = {
  LEFT: "Left channel: if 11 is the left winger, this is the finish. 7 holds the right. Same order: 6 → 8/10 → 9 → 11.",
  RIGHT: "Right channel: if the pattern finishes on the right, 7 is the arrival and 11 holds. Same order through 8/10 and 9.",
  CENTER:
    "Centre: 8/10 and 9 occupy the middle so the first pass is not a crowd. Width is 7 and 11 — the 11 is the last action, not an extra body on the first pass.",
};

export function ageExpectationForEmphasis(opts: {
  age?: string | null;
  emphasis: BoardEmphasis;
  shape?: PlayOutShape | null;
  topic?: PrincipleTopic | null;
}): PhaseZoneExpect | null {
  const age = opts.age;
  if (!age) return null;
  const phase = opts.emphasis.phase;
  const zone = opts.emphasis.zone;
  const channel = opts.emphasis.channel;
  if (!phase && !zone && !channel) return null;

  const combo = opts.topic === "attacking_combo";
  const phaseBlock = combo ? COMBO_PHASE[age] || null : phase ? PHASE[age]?.[phase] : null;
  const zoneLine = combo
    ? (zone ? COMBO_ZONE[age]?.[zone] : null)
    : zone
      ? ZONE[age]?.[zone]
      : null;
  const channelLine = combo
    ? (channel ? COMBO_CHANNEL[channel] : null)
    : channel
      ? CHANNEL[channel]
      : null;
  const shapeBit = opts.shape ? ` Stay on this ${opts.shape}.` : "";

  const titleBits = [
    age,
    combo ? "attacking combination" : phaseBlock?.headline || (phase ? phase.toLowerCase() : null),
    zone === "DEFENSIVE_THIRD" ? "def third" : zone === "MIDDLE_THIRD" ? "middle" : zone === "ATTACKING_THIRD" ? "att third" : null,
    channel === "LEFT" ? "left" : channel === "RIGHT" ? "right" : channel === "CENTER" ? "center" : null,
  ].filter(Boolean);

  const body = [phaseBlock?.body, zoneLine, channelLine, shapeBit.trim() || null].filter(Boolean).join(" ");

  return {
    title: titleBits.join(" · "),
    body: body || "Age-honest picture in this part of the field.",
    canDo: phaseBlock?.canDo || [],
    notYet: phaseBlock?.notYet || [],
  };
}

export const EMPHASIS_AGE_BANDS = ["U8–U10", "U11–U12", "U13", "U14–U15", "U16–U18"] as const;
