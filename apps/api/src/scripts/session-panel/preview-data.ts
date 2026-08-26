import type { AgentReview, SampleRun } from "./types";
import { PANEL_FIXTURES } from "./fixtures";
import { stripSessionToPacket } from "./packet";
import { panelJudgeInputTokens } from "./agents";
import { aggregatePanel } from "./verdict";
import { runFrozenGates } from "./frozen-gates";

/**
 * Deterministic preview of the HTML board — no LLM. Used by --preview so we
 * can look at layout and token math without burning generate/judge calls.
 */

function review(
  id: AgentReview["agentId"],
  name: string,
  topicTaught: number,
  trainingQuality: number,
  wouldRun: AgentReview["wouldRun"],
  scores: Record<string, number>,
  notes: string,
  evidence: AgentReview["evidence"] = []
): AgentReview {
  return {
    agentId: id,
    agentName: name,
    scores: { ...scores, topicTaught, trainingQuality },
    topicTaught,
    trainingQuality,
    variety: null,
    wouldRun,
    evidence,
    notes,
    parseError: null,
    wouldRunOverridden: false,
  };
}

const DEV = "Youth Development Director";
const INS = "USSF Coaching School Instructor";
const DES = "Pitchside Session Designer";

function fatDrill(type: string, title: string, extra: Record<string, unknown> = {}) {
  const long =
    "This activity integrates our complete possession model so players master playing out under pressure while recognizing supporting angles and circulating across the back line with patience and purpose in a realistic opponent block. ".repeat(2);
  return {
    drillType: type,
    title,
    duration: type === "WARMUP" ? 15 : type === "TECHNICAL" ? 20 : type === "TACTICAL" ? 25 : type === "CONDITIONED_GAME" ? 25 : 5,
    description: extra.description || long,
    organization: {
      setupSteps: [
        "If the squad is bigger than this picture, run two groups on the same activity.",
        ...Array.from({ length: 8 }, (_, i) => `Step ${i + 1}: mark cones, place players, check distances, confirm equipment, explain the role of every line in the ${title} organization in complete sentences.`),
      ],
      area: { lengthYards: 30, widthYards: 25 },
      rotation: "Rotate every two minutes so everyone plays both roles",
      restarts: "Coach plays a new ball in from the side",
      scoring: extra.scoring || "Eight consecutive passes scores a point",
    },
    coachingPoints: extra.coachingPoints || [
      `${title}: scan before the ball arrives`,
      `${title}: pass to the free player`,
      `${title}: move after you pass`,
      `${title}: body open to the field`,
    ],
    progressions: extra.progressions || ["Reduce the grid by four yards", "Add a defender", "Add a small goal"],
    constraints: extra.constraints || ["Defender can intercept only"],
    coachingNotes: long,
    diagram: { players: [{ x: 1 }, { x: 2 }, { x: 3 }, { x: 4 }, { x: 5 }], goals: [], arrows: [{}], annotations: [{}] },
    ...extra,
  };
}

function u9Session() {
  return {
    title: "Pass to the teammate who is free",
    summary: "U9 hour on finding a teammate who is not covered and passing to them. Warmup rondo, then unopposed look-up passing, then 4v1, then a small game where the assist must go to a free player.",
    ageGroup: "U9",
    drills: [
      fatDrill("WARMUP", "Free player rondo", { duration: 10, constraints: ["No tackling"] }),
      fatDrill("TECHNICAL", "Look up then pass", { duration: 15 }),
      fatDrill("TACTICAL", "Pass to the open teammate", { duration: 20, constraints: ["Defender cannot tackle"] }),
      fatDrill("CONDITIONED_GAME", "Find the open teammate to score", {
        duration: 12,
        constraints: ["Goal only counts if the assist is to a player without a defender"],
        scoring: "Goal after a pass to the open teammate",
      }),
      fatDrill("COOLDOWN", "Walk and talk", { duration: 3, constraints: ["n/a"], coachingPoints: ["What did we learn"] }),
    ],
  };
}

function stickerSession() {
  return {
    title: "Possession model",
    summary: "We work on our possession game model to master playing out under pressure.",
    ageGroup: "U16",
    coachLevel: "USSF_B_PLUS",
    drills: [
      fatDrill("WARMUP", "Rondo", { duration: 15 }),
      fatDrill("TECHNICAL", "Passing lanes", { duration: 20 }),
      fatDrill("TACTICAL", "Possession block", {
        duration: 25,
        description: "This tactical drill integrates our complete possession model to master playing out under pressure.",
        coachingPoints: ["Circulate", "Be patient", "Switch", "Work hard"],
        constraints: ["Eight passes"],
      }),
      fatDrill("CONDITIONED_GAME", "Small sided game", {
        duration: 25,
        description: "Play a game.",
        constraints: ["Normal rules"],
        scoring: "Goals count",
        coachingPoints: ["Work hard", "Communicate", "Have fun", "Stay compact"],
      }),
      fatDrill("COOLDOWN", "Stretch", { duration: 5, constraints: ["x"], coachingPoints: ["y"] }),
    ],
  };
}

export function buildPreviewRuns(): SampleRun[] {
  const u9 = PANEL_FIXTURES[0];
  const u11 = PANEL_FIXTURES[1];
  const u12 = PANEL_FIXTURES[2];
  const u14 = PANEL_FIXTURES[3];
  const u16 = PANEL_FIXTURES[4];

  const proudPacket = stripSessionToPacket(u9Session(), u9);
  const proudGates = runFrozenGates(proudPacket, u9);
  const proudAgents = [
    review("development", DEV, 4.5, 4, "yes", { ageFit: 5, load: 4, learningFocus: 4, engagement: 5 }, "Kids get reps finding a free teammate. Format is 7v7-right. I would run this."),
    review("instructor", INS, 4, 4, "yes", { licenseFit: 5, teachability: 5, vocabularyHonesty: 4 }, "Plain verbs. A D coach can set the 4v1 without a DOC."),
    review("designer", DES, 4, 4.5, "yes", { progression: 4, constraintDesign: 5, realism: 4 }, "The game only counts a goal if the assist is to a free player. That is the topic."),
  ];

  const reviewPacket = stripSessionToPacket(
    {
      ...u9Session(),
      title: "Play around the first press",
      summary: "When the first defender steps, play around that pressure. Named once, then explained.",
      ageGroup: "U12",
      coachLevel: "USSF_C",
      drills: [
        fatDrill("WARMUP", "Rondo vs one", { duration: 15, description: "When they step, play around." }),
        fatDrill("TECHNICAL", "Pass around a pole", { duration: 20 }),
        fatDrill("TACTICAL", "Playing around the first press", {
          duration: 25,
          description: "When the first presser steps, play around the press to the free player.",
          coachingPoints: ["Name the first press", "Play around, not through", "Next player shows to the side", "Keep the spare man"],
        }),
        fatDrill("CONDITIONED_GAME", "Around the first press to goal", {
          duration: 25,
          description: "Playing around the first press scores.",
          constraints: ["Goal counts if you play around the first presser"],
          scoring: "Around the press then finish",
        }),
        fatDrill("COOLDOWN", "Talk", { duration: 5, constraints: ["x"], coachingPoints: ["y"] }),
      ],
    },
    u12
  );

  const failPacket = stripSessionToPacket(stickerSession(), u16);
  const failGates = runFrozenGates(failPacket, u16);
  const failAgents = [
    review(
      "development",
      DEV,
      2,
      2,
      "no",
      { ageFit: 3, load: 3, learningFocus: 2, engagement: 2 },
      "U16 advanced rest-defence hour that never trains rest defence. Hollow possession slogans.",
      [{ quote: "integrates our complete possession model", drillTitle: "Possession block", why: "topic swap would still read true" }]
    ),
    review(
      "instructor",
      INS,
      2,
      2,
      "no",
      { licenseFit: 2, teachability: 3, vocabularyHonesty: 2 },
      "B+ floor not met. No rest defence, cover shadow, or connected moments.",
      [{ quote: "Stay compact", drillTitle: "Small sided game", why: "generic, not rest defence after we lose it" }]
    ),
    review(
      "designer",
      DES,
      1,
      2,
      "no",
      { progression: 2, constraintDesign: 1, realism: 3 },
      "Conditioned game is 'goals count' with normal rules. Topic is not in the scoring.",
      [{ quote: "Goals count", drillTitle: "Small sided game", why: "does not force rest defence" }]
    ),
  ];

  const u11Packet = stripSessionToPacket(
    {
      ...u9Session(),
      title: "Teammate nearby who can help",
      summary: "When you have the ball, someone close should be ready to help.",
      ageGroup: "U11",
      drills: [
        fatDrill("WARMUP", "Help nearby", { duration: 15, description: "Always a teammate nearby who can help." }),
        fatDrill("TECHNICAL", "Support close", { duration: 20, description: "Someone close enough to pass." }),
        fatDrill("TACTICAL", "Finding a teammate nearby who can help", {
          duration: 25,
          description: "When you have the ball, a teammate nearby who can help shows for the pass.",
        }),
        fatDrill("CONDITIONED_GAME", "Help nearby to keep it", {
          duration: 25,
          description: "Finding a teammate nearby who can help.",
          constraints: ["Point if the next pass is to someone close"],
          scoring: "Pass to a teammate nearby who can help",
        }),
        fatDrill("COOLDOWN", "Talk", { duration: 5, constraints: ["x"], coachingPoints: ["y"] }),
      ],
    },
    u11
  );

  const u14Packet = stripSessionToPacket(
    {
      title: "First pass after we win it",
      summary: "The first pass after regain is the session.",
      ageGroup: "U14",
      coachLevel: "USSF_C",
      drills: [
        fatDrill("WARMUP", "Win and pass", { duration: 15, description: "When we win it, first pass forward or safe." }),
        fatDrill("TECHNICAL", "Regain then pass", { duration: 20, description: "First pass after we win it, unopposed." }),
        fatDrill("TACTICAL", "First pass after we win it", {
          duration: 25,
          description: "After we win the ball, the first pass must be the one we trained.",
          coachingPoints: ["First pass after we win it goes to the open player", "Don't dribble into traffic", "Second player shows", "Call the pass"],
        }),
        fatDrill("CONDITIONED_GAME", "Win it, first pass, go", {
          duration: 25,
          description: "First pass after we win it, then you may attack.",
          constraints: ["No shot until the first pass after regain is complete"],
          scoring: "Bonus if the first pass after we win it breaks a line",
        }),
        fatDrill("COOLDOWN", "Talk", { duration: 5, constraints: ["x"], coachingPoints: ["y"] }),
      ],
    },
    u14
  );

  const mk = (
    fixture: (typeof PANEL_FIXTURES)[0],
    packet: ReturnType<typeof stripSessionToPacket>,
    agents: AgentReview[],
    latencyMs: number
  ): SampleRun => {
    const gates = runFrozenGates(packet, fixture);
    return {
      fixtureId: fixture.id,
      label: fixture.label,
      generateModel: "gemini-3.5-flash-lite",
      judgeModel: "gemini-3.5-flash",
      sampleIdx: 0,
      latencyMs,
      error: null,
      title: packet.title,
      packet,
      gates,
      agents,
      panel: aggregatePanel(gates, agents),
      judgeInputTokensApprox: panelJudgeInputTokens(packet, fixture),
      appliedLessonIds: [],
      varietySim: null,
    };
  };

  const u11Agents = [
    review("development", DEV, 4, 4, "yes", { ageFit: 4, load: 4, learningFocus: 4, engagement: 4 }, "U11 9v9. Support nearby is the right size of idea."),
    review("instructor", INS, 4, 3, "rewrite", { licenseFit: 4, teachability: 4, vocabularyHonesty: 4 }, "D language is fine. Setup steps are still generic cone lists — I would rewrite organization."),
    review("designer", DES, 4, 4, "yes", { progression: 4, constraintDesign: 4, realism: 4 }, "Scoring a pass to someone close forces the topic."),
  ];

  const u12Agents = [
    review("development", DEV, 4, 4, "yes", { ageFit: 4, load: 4, learningFocus: 4, engagement: 4 }, "One concept. U12 can handle 'when they step, go around'."),
    review("instructor", INS, 4, 4, "yes", { licenseFit: 5, teachability: 4, vocabularyHonesty: 4 }, "Names the first press, then explains. That is C."),
    review("designer", DES, 3, 4, "rewrite", { progression: 3, constraintDesign: 4, realism: 4 }, "Warmup is still a generic rondo. Tactical and game are the topic; the hour does not fully build.", [
      { quote: "Rondo vs one", drillTitle: "WARMUP", why: "does not prepare playing around the first press" },
    ]),
  ];

  const u14Agents = [
    review("development", DEV, 4, 4, "yes", { ageFit: 4, load: 4, learningFocus: 5, engagement: 4 }, "First action after regain is age-right for U14."),
    review("instructor", INS, 4, 4, "yes", { licenseFit: 4, teachability: 4, vocabularyHonesty: 4 }, "One concept, named and taught."),
    review("designer", DES, 5, 4, "yes", { progression: 5, constraintDesign: 5, realism: 4 }, "No shot until the first pass after regain. That is how you teach it."),
  ];

  return [
    mk(u9, proudPacket, proudAgents, 38000),
    mk(u11, u11Packet, u11Agents, 41000),
    mk(u12, reviewPacket, u12Agents, 44000),
    mk(u14, u14Packet, u14Agents, 40000),
    mk(u16, failPacket, failAgents, 43000),
  ];
}
