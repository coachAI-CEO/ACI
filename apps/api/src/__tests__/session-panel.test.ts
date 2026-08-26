import { PANEL_FIXTURES, fixtureById } from "../scripts/session-panel/fixtures";
import { runFrozenGates } from "../scripts/session-panel/frozen-gates";
import { stripSessionToPacket, formatPacketForJudge, approxTokens } from "../scripts/session-panel/packet";
import { parseAgentReview, AGENT_SPECS, buildAgentPrompt, panelJudgeInputTokens } from "../scripts/session-panel/agents";
import { aggregatePanel } from "../scripts/session-panel/verdict";
import type { AgentReview, SessionPacket } from "../scripts/session-panel/types";
import { buildSessionPrompt } from "../prompts/session";
import { formatLessonsForPrompt, matchingActiveLessons, recordLessonOutcomes, pauseDeadLessons, type LessonBook } from "../services/session-lessons";
import { gateLessonsFromRuns, learnFromPanelRuns } from "../scripts/session-panel/learn";
import { buildPreviewRuns } from "../scripts/session-panel/preview-data";
import {
  formatPriorsForPrompt,
  maxSimilarityToPriors,
  priorsExcludingSelf,
  snapshotFromPacket,
  VARIETY_CLONE_THRESHOLD,
} from "../scripts/session-panel/variety";

const u9 = PANEL_FIXTURES.find((f) => f.id === "u9-d-open-teammate")!;
const u12 = PANEL_FIXTURES.find((f) => f.id === "u12-c-around-press")!;
const u16 = PANEL_FIXTURES.find((f) => f.id === "u16-b-rest-defence")!;

function drill(partial: Record<string, unknown>) {
  return {
    drillType: "TACTICAL",
    title: "Tactical",
    duration: 20,
    description: "Players pass to the open teammate when a defender steps.",
    organization: {
      setupSteps: ["Mark a 20x20 grid", "4v1 inside"],
      area: { lengthYards: 20, widthYards: 20 },
      rotation: "Rotate the defender every 60 seconds",
      restarts: "Coach plays a new ball in",
      scoring: "A pass to a free teammate scores",
    },
    coachingPoints: ["Look up before you pass", "Pass to the teammate who is free", "Move after you pass"],
    progressions: ["Add a second defender"],
    constraints: ["Defender cannot tackle, only intercept"],
    coachingNotes: "",
    diagram: { players: [{}, {}, {}, {}, {}], goals: [], arrows: [{}], annotations: [{}] },
    ...partial,
  };
}

function sessionShape(overrides: Record<string, unknown> = {}) {
  return {
    title: "Pass to the teammate who is free",
    summary: "U9 session on passing to the open teammate.",
    ageGroup: "U9",
    coachLevel: "USSF_D",
    playerLevel: "BEGINNER",
    gameModelId: "POSSESSION",
    topic: "Passing to the open teammate",
    durationMin: 60,
    drills: [
      drill({
        drillType: "WARMUP",
        title: "Free player rondo",
        duration: 10,
        coachingPoints: ["Keep your head up in the circle", "Pass to the teammate who is free", "Jog to a new spot after you pass"],
      }),
      drill({
        drillType: "TECHNICAL",
        title: "Look up, pass",
        duration: 15,
        coachingPoints: ["Take a touch that faces your teammate", "Look before the ball arrives", "Hit the open player, not the covered one"],
      }),
      drill({
        drillType: "TACTICAL",
        title: "Pass to the open teammate",
        duration: 20,
        coachingPoints: ["When a defender steps, find the free teammate", "Don't force it into the crowd", "The helper should be to the side, not behind"],
      }),
      drill({
        drillType: "CONDITIONED_GAME",
        title: "Find the open teammate to score",
        duration: 12,
        constraints: ["Goal only counts if the assist is to a player without a defender"],
        scoring: "Goal after a pass to the open teammate",
        coachingPoints: ["Use the extra player", "If they are marked, keep it", "The goal has to come from a free teammate"],
      }),
      drill({ drillType: "COOLDOWN", title: "Walk and talk", duration: 3, constraints: ["n/a"], coachingPoints: ["What did we learn"] }),
    ],
    ...overrides,
  };
}

describe("session panel packet", () => {
  test("strips diagram player objects down to counts", () => {
    const packet = stripSessionToPacket(sessionShape(), u9);
    expect(packet.drills[0].diagramCounts.players).toBe(5);
    expect(JSON.stringify(packet)).not.toMatch(/"x":/);
  });
});

describe("session panel frozen gates", () => {
  test("a topic-faithful U9 D session passes", () => {
    const packet = stripSessionToPacket(sessionShape(), u9);
    const gates = runFrozenGates(packet, u9);
    expect(gates.issues).toEqual([]);
    expect(gates.ok).toBe(true);
  });

  test("D jargon fails even if the topic is present", () => {
    const packet = stripSessionToPacket(
      sessionShape({
        drills: sessionShape().drills.map((d: any, i: number) =>
          i === 2 ? { ...d, coachingPoints: [...d.coachingPoints, "Hold rest defense when you lose it"] } : d
        ),
      }),
      u9
    );
    const gates = runFrozenGates(packet, u9);
    expect(gates.ok).toBe(false);
    expect(gates.issues.some((i) => i.code === "d-jargon")).toBe(true);
  });

  test("beginner 1-touch fails", () => {
    const packet = stripSessionToPacket(
      sessionShape({
        drills: sessionShape().drills.map((d: any, i: number) =>
          i === 1 ? { ...d, constraints: ["1-touch only"] } : d
        ),
      }),
      u9
    );
    expect(runFrozenGates(packet, u9).issues.some((i) => i.code === "beginner-touch")).toBe(true);
  });

  test("11v11 on U9 fails", () => {
    const packet = stripSessionToPacket(sessionShape({ title: "U9 11v11 possession" }), u9);
    expect(runFrozenGates(packet, u9).issues.some((i) => i.code === "format")).toBe(true);
  });

  test("title-sticker topic (no tactical/game signal) fails", () => {
    const hollow = sessionShape({
      title: "Possession model",
      summary: "We work on our possession game model.",
      drills: [
        drill({ drillType: "WARMUP", title: "Rondo", duration: 10, description: "Keep the ball.", coachingPoints: ["Scan", "Pass", "Move"] }),
        drill({ drillType: "TECHNICAL", title: "Passing", duration: 15, description: "Pass and move.", coachingPoints: ["Scan", "Pass", "Move"] }),
        drill({
          drillType: "TACTICAL",
          title: "Possession block",
          duration: 20,
          description: "Integrate our possession model under pressure.",
          coachingPoints: ["Circulate", "Be patient", "Switch"],
          constraints: ["Must complete 8 passes"],
        }),
        drill({
          drillType: "CONDITIONED_GAME",
          title: "Small sided game",
          duration: 12,
          description: "Play a game.",
          constraints: ["Normal rules"],
          scoring: "Goals count",
          coachingPoints: ["Work hard", "Communicate", "Have fun"],
        }),
      ],
    });
    const packet = stripSessionToPacket(hollow, u9);
    const codes = runFrozenGates(packet, u9).issues.map((i) => i.code);
    expect(codes).toContain("topic-signal");
  });

  test("copy-pasted coaching points across three drills fail", () => {
    const points = ["Always scan before you receive the ball today", "Pass with the inside of the foot", "Move into space after the pass"];
    const packet = stripSessionToPacket(
      sessionShape({
        drills: sessionShape().drills.map((d: any) =>
          /COOLDOWN/i.test(d.drillType) ? d : { ...d, coachingPoints: points }
        ),
      }),
      u9
    );
    expect(runFrozenGates(packet, u9).issues.some((i) => i.code === "copy-paste-points")).toBe(true);
  });

  test("C session using rest defence fails", () => {
    const packet = stripSessionToPacket(
      {
        ...sessionShape(),
        title: "Playing around the first press",
        summary: "When the first presser steps, play around the press.",
        ageGroup: "U12",
        coachLevel: "USSF_C",
        drills: [
          drill({
            drillType: "TACTICAL",
            title: "Play around the first press",
            description: "When the first defender steps, play around the press. Hold rest defense behind.",
            duration: 25,
          }),
          drill({
            drillType: "CONDITIONED_GAME",
            title: "Around the first press to goal",
            description: "Playing around the first press scores.",
            constraints: ["Goal counts if you play around the first presser"],
            scoring: "Around the press then finish",
            duration: 25,
          }),
          drill({ drillType: "WARMUP", duration: 15 }),
          drill({ drillType: "TECHNICAL", duration: 20 }),
          drill({ drillType: "COOLDOWN", duration: 5, constraints: ["x"], coachingPoints: ["y"] }),
        ],
      },
      u12
    );
    expect(runFrozenGates(packet, u12).issues.some((i) => i.code === "c-jargon")).toBe(true);
  });

  test("U16 rest defence session matches topic signals", () => {
    const packet = stripSessionToPacket(
      {
        title: "Rest defence after we lose it in the middle third",
        summary: "Protect the counter when we lose the ball in midfield.",
        ageGroup: "U16",
        coachLevel: "USSF_B_PLUS",
        drills: [
          drill({ drillType: "WARMUP", duration: 15, title: "Loss reaction", description: "When we lose it, recover." }),
          drill({ drillType: "TECHNICAL", duration: 20 }),
          drill({
            drillType: "TACTICAL",
            title: "Rest defence after we lose it",
            description: "Rest defence after we lose it in the middle third. Cover the counter.",
            duration: 25,
            coachingPoints: ["Nearest press, next two recover", "Protect against the counter", "Far side tucks"],
          }),
          drill({
            drillType: "CONDITIONED_GAME",
            title: "Lose it, rest defence",
            description: "When we lose the ball in the middle third, rest defence must be set.",
            constraints: ["If they counter into our box after we lose it, they get a bonus point"],
            scoring: "We score; they score on the counter if rest defence is broken",
            duration: 25,
          }),
          drill({ drillType: "COOLDOWN", duration: 5, constraints: ["x"], coachingPoints: ["y"] }),
        ],
      },
      u16
    );
    const gates = runFrozenGates(packet, u16);
    expect(gates.issues.filter((i) => i.code.startsWith("topic"))).toEqual([]);
  });

  test("full-pitch tactical fails tactical-is-match", () => {
    const packet = stripSessionToPacket(
      {
        title: "Rest defence after we lose it in the middle third",
        summary: "Protect the counter when we lose the ball in midfield.",
        ageGroup: "U16",
        drills: [
          drill({ drillType: "WARMUP", duration: 15 }),
          drill({
            drillType: "TECHNICAL",
            duration: 20,
            organization: {
              setupSteps: ["Mark a 35x40", "Two groups of 8"],
              area: { lengthYards: 35, widthYards: 40 },
              rotation: "Rotate groups every 3 minutes",
              restarts: "Coach plays a new ball in",
              scoring: "Rest defence recoveries score",
            },
          }),
          drill({
            drillType: "TACTICAL",
            title: "Rest defence after we lose it",
            description: "Rest defence after we lose it in the middle third. Cover the counter.",
            duration: 25,
            organization: {
              setupSteps: ["Full pitch 11v11"],
              area: { lengthYards: 120, widthYards: 80 },
              rotation: "n/a",
              restarts: "From the GK",
              scoring: "Counter if rest defence is broken",
            },
          }),
          drill({
            drillType: "CONDITIONED_GAME",
            title: "Lose it, rest defence",
            description: "When we lose the ball in the middle third, rest defence must be set.",
            constraints: ["If they counter into our box after we lose it, they get a bonus point"],
            duration: 25,
          }),
        ],
      },
      u16
    );
    expect(runFrozenGates(packet, u16).issues.some((i) => i.code === "tactical-is-match")).toBe(true);
  });

  test("small technical picture without a second group fails idle-squad on a 22-player squad", () => {
    const packet = stripSessionToPacket(
      {
        title: "Rest defence after we lose it in the middle third",
        summary: "Protect the counter when we lose the ball in midfield.",
        ageGroup: "U16",
        drills: [
          drill({ drillType: "WARMUP", duration: 15 }),
          drill({
            drillType: "TECHNICAL",
            duration: 20,
            organization: {
              setupSteps: ["Mark a 35x40", "7 players in a diamond"],
              area: { lengthYards: 35, widthYards: 40 },
              rotation: "Stay in",
              restarts: "Coach plays a new ball in",
              scoring: "Rest defence recoveries score",
            },
            diagram: { players: [{}, {}, {}, {}, {}, {}, {}], goals: [], arrows: [{}], annotations: [{}] },
          }),
          drill({
            drillType: "TACTICAL",
            title: "Rest defence after we lose it",
            description: "Rest defence after we lose it in the middle third.",
            duration: 25,
            organization: {
              setupSteps: ["70x60 middle third"],
              area: { lengthYards: 70, widthYards: 60 },
              rotation: "n/a",
              restarts: "From the coach",
              scoring: "Broken rest defence is a counter goal",
            },
          }),
          drill({
            drillType: "CONDITIONED_GAME",
            title: "Lose it, rest defence",
            description: "When we lose the ball in the middle third, rest defence must be set.",
            constraints: ["If they counter into our box after we lose it, they get a bonus point"],
            duration: 25,
          }),
        ],
      },
      u16
    );
    expect(runFrozenGates(packet, u16).issues.some((i) => i.code === "idle-squad")).toBe(true);
  });

  test("technical that splits the squad into pairs is not idle-squad", () => {
    const packet = stripSessionToPacket(
      {
        title: "Rest defence after we lose it in the middle third",
        summary: "Protect the counter when we lose the ball in midfield.",
        ageGroup: "U16",
        drills: [
          drill({ drillType: "WARMUP", duration: 15 }),
          drill({
            drillType: "TECHNICAL",
            duration: 20,
            organization: {
              setupSteps: ["Mark a 30x40 channel", "Split the squad into pairs of attackers and defenders"],
              area: { lengthYards: 40, widthYards: 30 },
              rotation: "Pairs rotate after each wave",
              restarts: "Diagonal feed",
              scoring: "Recovery tackle scores",
            },
            diagram: { players: [{}, {}, {}, {}], goals: [], arrows: [{}], annotations: [{}] },
          }),
          drill({
            drillType: "TACTICAL",
            title: "Rest defence after we lose it",
            description: "Rest defence after we lose it in the middle third.",
            duration: 25,
            organization: {
              setupSteps: ["70x60 middle third"],
              area: { lengthYards: 70, widthYards: 60 },
              rotation: "n/a",
              restarts: "From the coach",
              scoring: "Broken rest defence is a counter goal",
            },
          }),
          drill({
            drillType: "CONDITIONED_GAME",
            title: "Lose it, rest defence",
            description: "When we lose the ball in the middle third, rest defence must be set.",
            constraints: ["If they counter into our box after we lose it, they get a bonus point"],
            duration: 25,
          }),
        ],
      },
      u16
    );
    expect(runFrozenGates(packet, u16).issues.some((i) => i.code === "idle-squad")).toBe(false);
  });

  test("first session has no variety-clone gate", () => {
    const packet = stripSessionToPacket(sessionShape(), u9);
    expect(runFrozenGates(packet, u9).issues.some((i) => i.code === "variety-clone")).toBe(false);
    expect(runFrozenGates(packet, u9, { priors: [] }).ok).toBe(true);
  });

  test("cloned practice form vs prior fails variety-clone", () => {
    const packet = stripSessionToPacket(sessionShape(), u9);
    const gates = runFrozenGates(packet, u9, { priors: [snapshotFromPacket(packet)] });
    expect(gates.issues.some((i) => i.code === "variety-clone")).toBe(true);
  });

  test("different grid/scoring/constraints vs prior passes variety-clone", () => {
    const prior = stripSessionToPacket(sessionShape(), u9);
    const next = stripSessionToPacket(
      sessionShape({
        title: "Find the spare player in a 3v1 diamond",
        drills: sessionShape().drills.map((d: any) => ({
          ...d,
          title: `${d.title} diamond`,
          organization: {
            ...d.organization,
            area: { lengthYards: 28, widthYards: 18 },
            scoring: "A 3-second bounce pass through the diamond scores; no 8-pass rondo points",
          },
          constraints: ["Neutral plays a bounce pass only", "Defender starts outside the diamond", "Goals are two mini-gates on the end line"],
        })),
      }),
      u9
    );
    const sim = maxSimilarityToPriors(snapshotFromPacket(next), [snapshotFromPacket(prior)], u9.input.topic || "");
    expect(sim).toBeLessThan(VARIETY_CLONE_THRESHOLD);
    expect(runFrozenGates(next, u9, { priors: [snapshotFromPacket(prior)] }).issues.some((i) => i.code === "variety-clone")).toBe(
      false
    );
  });

  test("re-judging a session ignores its own history snapshot", () => {
    const packet = stripSessionToPacket(sessionShape({ title: "Rest Defence and Counterpress Integration in the Middle Third" }), u9);
    const live = snapshotFromPacket(packet);
    const stored = { ...live, drills: live.drills.map((d) => ({ ...d, players: 0, scoring: d.scoring.slice(0, 40) + "…" })) };
    const kept = priorsExcludingSelf(live, [stored], u9.input.topic || "");
    expect(kept).toEqual([]);
  });
});

function agent(partial: Partial<AgentReview> & { agentId: AgentReview["agentId"] }): AgentReview {
  const spec = AGENT_SPECS.find((s) => s.id === partial.agentId)!;
  return {
    agentName: spec.name,
    scores: { topicTaught: 4, trainingQuality: 4, ...(partial.scores || {}) },
    topicTaught: 4,
    trainingQuality: 4,
    variety: null,
    wouldRun: "yes",
    evidence: [{ quote: "pass to the open teammate", drillTitle: "Tactical", why: "topic is live" }],
    notes: "ok",
    parseError: null,
    wouldRunOverridden: false,
    ...partial,
    agentId: spec.id,
  };
}

describe("session panel verdict", () => {
  const passGates = { ok: true, issues: [] as { code: string; detail: string }[] };

  test("proud requires all three yes plus topic and quality >= 4", () => {
    const panel = aggregatePanel(passGates, [
      agent({ agentId: "development" }),
      agent({ agentId: "instructor" }),
      agent({ agentId: "designer" }),
    ]);
    expect(panel.verdict).toBe("proud");
  });

  test("two yes and one rewrite is review, not proud", () => {
    const panel = aggregatePanel(passGates, [
      agent({ agentId: "development" }),
      agent({ agentId: "instructor" }),
      agent({ agentId: "designer", wouldRun: "rewrite", topicTaught: 4, trainingQuality: 4 }),
    ]);
    expect(panel.verdict).toBe("review");
  });

  test("frozen gate fail cannot be proud", () => {
    const panel = aggregatePanel({ ok: false, issues: [{ code: "d-jargon", detail: "x" }] }, [
      agent({ agentId: "development" }),
      agent({ agentId: "instructor" }),
      agent({ agentId: "designer" }),
    ]);
    expect(panel.verdict).toBe("fail");
  });

  test("wouldRun yes is overridden when topicTaught is 3", () => {
    const parsed = parseAgentReview(AGENT_SPECS[0], JSON.stringify({
      scores: { ageFit: 5, load: 4, learningFocus: 4, engagement: 4, topicTaught: 3, trainingQuality: 5 },
      topicTaught: 3,
      trainingQuality: 5,
      wouldRun: "yes",
      evidence: [{ quote: "generic possession", drillTitle: "Game", why: "topic not forced" }],
      notes: "Age is fine but the topic is a sticker.",
    }));
    expect(parsed.wouldRun).toBe("rewrite");
    expect(parsed.wouldRunOverridden).toBe(true);
  });

  test("compact judge JSON (t/q/run/s/ev/n) parses", () => {
    const parsed = parseAgentReview(AGENT_SPECS[2], JSON.stringify({
      t: 4,
      q: 5,
      run: "yes",
      s: { progression: 4, constraintDesign: 5, realism: 4 },
      ev: [{ d: "Game", q: "Goal after a pass to the open teammate", w: "forces topic" }],
      n: "The game scoring is the topic.",
    }));
    expect(parsed.topicTaught).toBe(4);
    expect(parsed.trainingQuality).toBe(5);
    expect(parsed.wouldRun).toBe("yes");
    expect(parsed.scores.constraintDesign).toBe(5);
    expect(parsed.evidence[0].drillTitle).toBe("Game");
    expect(parsed.variety).toBeNull();
  });

  test("variety < 4 overrides wouldRun yes when PRIOR is required", () => {
    const parsed = parseAgentReview(
      AGENT_SPECS[2],
      JSON.stringify({
        t: 5,
        q: 5,
        v: 3,
        run: "yes",
        s: { progression: 5, constraintDesign: 5, realism: 5 },
        ev: [{ d: "WARMUP", q: "same 20x20 rondo scoring 8 consecutive passes", w: "cloned prior" }],
        n: "Same form as last week.",
      }),
      { requireVariety: true }
    );
    expect(parsed.variety).toBe(3);
    expect(parsed.wouldRun).toBe("rewrite");
    expect(parsed.wouldRunOverridden).toBe(true);
  });

  test("proud requires variety >= 4 when judges scored it", () => {
    const panel = aggregatePanel(passGates, [
      agent({ agentId: "development", variety: 3, wouldRun: "rewrite" }),
      agent({ agentId: "instructor", variety: 5 }),
      agent({ agentId: "designer", variety: 5 }),
    ]);
    expect(panel.verdict).toBe("review");
  });

  test("gates-only with a pass is review, not proud or fail", () => {
    const panel = aggregatePanel(passGates, []);
    expect(panel.verdict).toBe("review");
  });
});

describe("session packet type export", () => {
  test("strip preserves topic from fixture when session omits it", () => {
    const packet: SessionPacket = stripSessionToPacket({ drills: [] }, u9);
    expect(packet.topic).toBe("Passing to the open teammate");
  });
});

describe("judge packet token trim", () => {
  test("clipped card is much smaller than pretty-printed JSON, with no player coords", () => {
    const fat = sessionShape({
      summary: "word ".repeat(80),
      drills: sessionShape().drills.map((d: any) => ({
        ...d,
        description: "This drill integrates our complete possession model. ".repeat(12),
        organization: {
          ...d.organization,
          setupSteps: Array.from({ length: 10 }, (_, i) => `Step ${i}: ${"mark cones and explain roles ".repeat(8)}`),
        },
        diagram: { players: [{ x: 12, y: 40 }, { x: 30, y: 50 }], goals: [], arrows: [], annotations: [] },
      })),
    });
    const packet = stripSessionToPacket(fat, u9);
    const pretty = JSON.stringify(packet, null, 2);
    const card = formatPacketForJudge(packet);
    expect(card).not.toMatch(/"x":/);
    expect(card.length).toBeLessThan(pretty.length * 0.45);
    expect(panelJudgeInputTokens(packet, u9)).toBeLessThan(approxTokens(pretty) * 3);
    expect(buildAgentPrompt(AGENT_SPECS[0], packet, u9)).toContain("TOPIC");
    const withPrior = buildAgentPrompt(AGENT_SPECS[0], packet, u9, [snapshotFromPacket(packet)]);
    expect(withPrior).toContain("PRIOR");
    expect(withPrior).toContain('"v":n');
  });
});

describe("session panel playbook", () => {
  const book = (): LessonBook => ({ version: 1, updatedAt: "", lessons: [] });

  test("gate fails from the U16 sticker session become active topic lessons", () => {
    const runs = buildPreviewRuns();
    const u16Run = runs.find((r) => r.fixtureId === "u16-b-rest-defence")!;
    const learned = gateLessonsFromRuns([u16Run], fixtureById);
    expect(learned.some((l) => l.id.includes("topic-game") && l.status === "active")).toBe(true);
  });

  test("scoped D-jargon lesson does not inject into a B+ session", () => {
    const b = book();
    b.lessons.push({
      id: "gate:d-jargon:USSF_D",
      status: "active",
      kind: "never",
      rule: "USSF_D: never write textbook terms.",
      because: "test",
      source: "gate",
      scope: { coachLevel: "USSF_D" },
      seen: 1,
      helped: 0,
      failed: 0,
      createdAt: "",
      updatedAt: "",
    });
    expect(matchingActiveLessons(u16.input, b)).toHaveLength(0);
    expect(matchingActiveLessons(u9.input, b)).toHaveLength(1);
  });

  test("buildSessionPrompt injects panelLessons override and skip with null", () => {
    const withRules = buildSessionPrompt({
      ...u9.input,
      panelLessons: ["CONDITIONED_GAME scoring must force today's topic."],
    });
    expect(withRules).toContain("PANEL LESSONS");
    expect(withRules).toContain("CONDITIONED_GAME scoring must force");
    const skipped = buildSessionPrompt({ ...u9.input, panelLessons: null });
    expect(skipped).not.toContain("PANEL LESSONS");
  });

  test("buildSessionPrompt injects VARIETY LOCK from panelPriorCard", () => {
    const prior = formatPriorsForPrompt([snapshotFromPacket(stripSessionToPacket(sessionShape(), u9))]);
    const prompt = buildSessionPrompt({ ...u9.input, panelLessons: null, panelPriorCard: prior });
    expect(prompt).toContain("VARIETY LOCK");
    expect(prompt).toContain("BANNED grids");
    expect(prompt).toContain("20x20");
    expect(prompt).not.toContain("Defender cannot tackle, only intercept");
  });

  test("a lesson that never helps is paused after three fails", () => {
    const b = book();
    b.lessons.push({
      id: "x",
      status: "active",
      kind: "must",
      rule: "Say hello.",
      because: "t",
      source: "human",
      scope: {},
      seen: 3,
      helped: 0,
      failed: 2,
      createdAt: "",
      updatedAt: "",
    });
    recordLessonOutcomes(b, [{ appliedLessonIds: ["x"], panel: { verdict: "fail" } }]);
    expect(b.lessons[0].status).toBe("paused");
    expect(pauseDeadLessons(b)).toHaveLength(0);
  });

  test("a variety-clone-only fail does not punish unrelated lessons", () => {
    const b = book();
    b.lessons.push({
      id: "gate:topic-game",
      status: "active",
      kind: "must",
      rule: "Game must force the topic.",
      because: "t",
      source: "gate",
      scope: {},
      seen: 1,
      helped: 1,
      failed: 0,
      createdAt: "",
      updatedAt: "",
    });
    b.lessons.push({
      id: "gate:variety-clone:rest-defence",
      status: "active",
      kind: "never",
      rule: "Do not clone prior grids.",
      because: "t",
      source: "gate",
      scope: {},
      seen: 1,
      helped: 0,
      failed: 0,
      createdAt: "",
      updatedAt: "",
    });
    recordLessonOutcomes(b, [
      {
        appliedLessonIds: ["gate:topic-game", "gate:variety-clone:rest-defence"],
        panel: { verdict: "fail" },
        gates: { issues: [{ code: "variety-clone" }] },
      },
    ]);
    expect(b.lessons[0].failed).toBe(0);
    expect(b.lessons[1].failed).toBe(1);
  });

  test("formatLessonsForPrompt stays compact", () => {
    const block = formatLessonsForPrompt(
      { ...u9.input, panelLessons: ["A".repeat(300), "Keep the game scoring about the topic."] },
      book()
    );
    expect(block.length).toBeLessThan(500);
    expect(block.split("\n").length).toBeLessThanOrEqual(10);
  });

  test("learnFromPanelRuns records gate lessons without a judge LLM", async () => {
    const b = book();
    const runs = buildPreviewRuns();
    await learnFromPanelRuns({ runs, book: b, fixtureOf: fixtureById, recordOutcomes: false });
    expect(b.lessons.some((l) => l.source === "gate" && l.status === "active")).toBe(true);
  });
});
