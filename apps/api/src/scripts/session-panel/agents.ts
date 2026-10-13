import { approxTokens, formatPacketForJudge, parseJsonSafe } from "./packet";
import type { AgentId, AgentReview, AgentScores, PanelFixture, SessionPacket, WouldRun } from "./types";
import { compactPriorCard, type SessionFormSnapshot } from "./variety";

const SHARED_QUALITY_RULES = `
Rate TODAY'S TOPIC as training, not JSON completeness. Length ≠ quality. Slogan paragraphs score 2.

t topicTaught 1-5: 5=whole hour is this problem (WU→tech→tact→game→debrief). 3=named in tactical, game generic. 1=title sticker; points still true if you swapped the topic.
q trainingQuality 1-5: 5=run Saturday from the card (area, restart, score, constraint that FORCES the topic, live coaching points, progressions that change THIS problem). 2="integrates our possession model". 1=empty/unsafe. D can be a 5 in short sentences.
run: yes (requires t>=4 and q>=4; also v>=4 when PRIOR is present) | rewrite | no
ev: for any score <4 quote the session (drill + point/constraint/score). No quote → invalid. Do not grade diagram geometry. pic:Np is squad vs working group only.
n: max 2 sentences. No generic praise.
Return ONLY compact JSON. No markdown.
`.trim();

const VARIETY_RULES = `
v variety 1-5 vs PRIOR practice form (not vs a different topic): 5=same problem, different grid/numbers/scoring/constraints. 3=same rondo or game with a new title. 1=clone of PRIOR. Quote what was copied if v<4.
`.trim();

type AgentSpec = {
  id: AgentId;
  name: string;
  lensKeys: string[];
  identity: string;
};

export const AGENT_SPECS: AgentSpec[] = [
  {
    id: "development",
    name: "Youth Development Director",
    lensKeys: ["ageFit", "load", "learningFocus", "engagement"],
    identity:
      "Academy director. Rate THE PLAYER. ageFit=age/format demand. load=volume/rest vs lines. learningFocus=one problem they can take to the game. engagement=leave better at the topic. Hard fail ageFit<3: U9 lecture, 11v11 stuffed into U10, unsafe volume.",
  },
  {
    id: "instructor",
    name: "USSF Coaching School Instructor",
    lensKeys: ["licenseFit", "teachability", "vocabularyHonesty"],
    identity:
      "License educator. Rate THE SATURDAY COACH. D=plain verbs, no textbook (teach jargon topics in ordinary words). C=name ONE concept, explain next sentence; no two systemic ideas in one clause. B+=connected moments, not a longer D rondo with fancy labels. teachability=this license can set it up. vocabularyHonesty=D that reads B+ fails; thin B+ fails. Topic still taught at this license's DEPTH.",
  },
  {
    id: "designer",
    name: "Pitchside Session Designer",
    lensKeys: ["progression", "constraintDesign", "realism"],
    identity:
      "Session designer. Rate THE HOUR. progression=WU prepares tech, tech feeds tact, game is the same problem. constraintDesign=score/restarts/CX FORCE today's topic. realism=mark it in 5 min, numbers fit, not unsafe. Five themed titles with no through-line fails.",
  },
];

function schemaFor(spec: AgentSpec, withVariety: boolean): string {
  const lens = spec.lensKeys.map((k) => `"${k}":n`).join(",");
  const head = withVariety ? '{"t":n,"q":n,"v":n,' : '{"t":n,"q":n,';
  return `${head}"run":"yes|rewrite|no","s":{${lens}},"ev":[{"d":"drill","q":"quote","w":"why"}],"n":"2 sentences"}`;
}

export function buildAgentPrompt(
  spec: AgentSpec,
  packet: SessionPacket,
  fixture: PanelFixture,
  priors: SessionFormSnapshot[] = []
): string {
  // Identical prefix first so Gemini can cache the card across the 3 agents.
  const priorBlock = priors.length ? ["PRIOR:", compactPriorCard(priors[priors.length - 1])] : [];
  return [
    "CARD:",
    formatPacketForJudge(packet),
    ...priorBlock,
    `ASSIGN ${fixture.input.ageGroup} ${fixture.input.coachLevel} ${fixture.input.playerLevel} | model ${fixture.input.gameModelId} | ${fixture.input.phase}/${fixture.input.zone}`,
    `TOPIC "${fixture.input.topic}" — ${fixture.topicMeaning}`,
    SHARED_QUALITY_RULES,
    ...(priors.length ? [VARIETY_RULES] : []),
    spec.identity,
    "JSON:",
    schemaFor(spec, priors.length > 0),
  ].join("\n");
}

export function agentPromptTokens(
  spec: AgentSpec,
  packet: SessionPacket,
  fixture: PanelFixture,
  priors: SessionFormSnapshot[] = []
): number {
  return approxTokens(buildAgentPrompt(spec, packet, fixture, priors));
}

export function panelJudgeInputTokens(
  packet: SessionPacket,
  fixture: PanelFixture,
  priors: SessionFormSnapshot[] = []
): number {
  return AGENT_SPECS.reduce((sum, spec) => sum + agentPromptTokens(spec, packet, fixture, priors), 0);
}

function clampScore(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(5, Math.round(n * 10) / 10));
}

function asWouldRun(value: unknown): WouldRun | null {
  const s = String(value || "").toLowerCase().trim();
  if (s === "yes" || s === "rewrite" || s === "no") return s;
  return null;
}

function applyWouldRunOverride(review: AgentReview): AgentReview {
  let wouldRun = review.wouldRun;
  let overridden = false;
  const varietyLow = review.variety != null && review.variety < 4;
  const varietyFail = review.variety != null && review.variety < 3;
  if ((review.topicTaught < 4 || review.trainingQuality < 4 || varietyLow) && wouldRun === "yes") {
    wouldRun = "rewrite";
    overridden = true;
  }
  if ((review.topicTaught < 3 || review.trainingQuality < 3 || varietyFail) && wouldRun !== "no") {
    wouldRun = "no";
    overridden = true;
  }
  return { ...review, wouldRun, wouldRunOverridden: overridden };
}

export function parseAgentReview(
  spec: AgentSpec,
  rawText: string,
  opts?: { requireVariety?: boolean }
): AgentReview {
  const parsed = parseJsonSafe(rawText);
  if (!parsed) {
    return emptyFailedReview(spec, "Judge returned non-JSON");
  }

  const rawScores = parsed.s && typeof parsed.s === "object" ? parsed.s : parsed.scores && typeof parsed.scores === "object" ? parsed.scores : parsed;
  const scores: AgentScores = {};
  for (const key of spec.lensKeys) {
    const n = clampScore(rawScores[key]);
    if (n != null) scores[key] = n;
  }

  const topicTaught = clampScore(parsed.t) ?? clampScore(parsed.topicTaught) ?? clampScore(rawScores.topicTaught) ?? 1;
  const trainingQuality = clampScore(parsed.q) ?? clampScore(parsed.trainingQuality) ?? clampScore(rawScores.trainingQuality) ?? 1;
  scores.topicTaught = topicTaught;
  scores.trainingQuality = trainingQuality;

  const parsedVariety =
    clampScore(parsed.v) ?? clampScore(parsed.variety) ?? clampScore(rawScores.variety);
  const variety = opts?.requireVariety ? parsedVariety ?? 1 : parsedVariety ?? null;
  if (variety != null) scores.variety = variety;

  const rawEv = Array.isArray(parsed.ev) ? parsed.ev : Array.isArray(parsed.evidence) ? parsed.evidence : [];
  const evidence = rawEv
    .map((item: any) => ({
      quote: String(item?.q || item?.quote || "").trim(),
      drillTitle: String(item?.d || item?.drillTitle || "").trim(),
      why: String(item?.w || item?.why || "").trim(),
    }))
    .filter((item: { quote: string }) => item.quote.length > 0);

  for (const key of Object.keys(scores)) {
    if (scores[key] >= 4) continue;
    if (evidence.length === 0) scores[key] = Math.min(scores[key], 2);
  }

  const wouldRun = asWouldRun(parsed.run) ?? asWouldRun(parsed.wouldRun) ?? "rewrite";

  return applyWouldRunOverride({
    agentId: spec.id,
    agentName: spec.name,
    scores,
    topicTaught: scores.topicTaught ?? 1,
    trainingQuality: scores.trainingQuality ?? 1,
    variety: variety != null ? scores.variety ?? variety : null,
    wouldRun,
    evidence,
    notes: String(parsed.n || parsed.notes || "").trim(),
    parseError: null,
    wouldRunOverridden: false,
  });
}

export function emptyFailedReview(spec: AgentSpec, error: string): AgentReview {
  return {
    agentId: spec.id,
    agentName: spec.name,
    scores: {},
    topicTaught: 1,
    trainingQuality: 1,
    variety: null,
    wouldRun: "no",
    evidence: [],
    notes: "",
    parseError: error,
    wouldRunOverridden: false,
  };
}
