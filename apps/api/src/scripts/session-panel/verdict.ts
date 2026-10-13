import type { AgentReview, FrozenGates, PanelResult } from "./types";

const HARD_KEYS: Record<string, string[]> = {
  development: ["ageFit", "topicTaught", "trainingQuality"],
  instructor: ["licenseFit", "topicTaught", "trainingQuality"],
  designer: ["realism", "topicTaught", "trainingQuality"],
};

function hardFails(agent: AgentReview): string[] {
  const keys = HARD_KEYS[agent.agentId] || ["topicTaught", "trainingQuality"];
  const out: string[] = [];
  for (const key of keys) {
    const n = key === "topicTaught" ? agent.topicTaught : key === "trainingQuality" ? agent.trainingQuality : agent.scores[key];
    if (typeof n === "number" && n < 3) {
      out.push(`${agent.agentId}.${key}=${n}`);
    }
  }
  if (typeof agent.variety === "number" && agent.variety < 3) {
    out.push(`${agent.agentId}.variety=${agent.variety}`);
  }
  if (agent.parseError) out.push(`${agent.agentId}.parseError`);
  if (agent.wouldRun === "no") out.push(`${agent.agentId}.wouldRun=no`);
  return out;
}

function disagreement(agents: AgentReview[]): boolean {
  if (agents.length < 2) return false;
  const topics = agents.map((a) => a.topicTaught);
  const quality = agents.map((a) => a.trainingQuality);
  const spread = (vals: number[]) => Math.max(...vals) - Math.min(...vals);
  const would = new Set(agents.map((a) => a.wouldRun));
  return spread(topics) >= 1.5 || spread(quality) >= 1.5 || would.size > 1;
}

/**
 * Do not average three opinions into a fake 4.2. Disagreement is the report.
 *
 * proud  — gates pass, all three wouldRun yes, topicTaught and trainingQuality >= 4
 *          (and variety >= 4 when judged against a prior session)
 * review — salvageable disagreement (e.g. two yes, one rewrite); no hard fail
 * fail   — frozen gate, any wouldRun no, or any hard dimension < 3
 */
export function aggregatePanel(gates: FrozenGates, agents: AgentReview[]): PanelResult {
  const reasons: string[] = [];

  if (!gates.ok) {
    reasons.push(`frozen gates: ${gates.issues.map((i) => i.code).join(", ")}`);
  }

  const hards = agents.flatMap(hardFails);
  reasons.push(...hards.map((h) => `hard fail ${h}`));

  if (agents.length === 0) {
    return {
      verdict: gates.ok ? "review" : "fail",
      reasons: reasons.length ? reasons : ["gates only — judges skipped"],
      disagreement: false,
    };
  }

  const allYes = agents.length === 3 && agents.every((a) => a.wouldRun === "yes");
  const anyNo = agents.some((a) => a.wouldRun === "no" || a.parseError);
  const topicOk = agents.length === 3 && agents.every((a) => a.topicTaught >= 4);
  const qualityOk = agents.length === 3 && agents.every((a) => a.trainingQuality >= 4);
  const varietyOk = agents.length === 3 && agents.every((a) => a.variety == null || a.variety >= 4);

  if (gates.ok && allYes && topicOk && qualityOk && varietyOk && hards.length === 0) {
    return {
      verdict: "proud",
      reasons: reasons.length ? reasons : ["all three agents would run this as today's topic"],
      disagreement: disagreement(agents),
    };
  }

  const salvageable =
    gates.ok &&
    !anyNo &&
    hards.length === 0 &&
    agents.length === 3 &&
    agents.filter((a) => a.wouldRun === "yes" || a.wouldRun === "rewrite").length === 3;

  if (salvageable) {
    const votes = agents.map((a) => `${a.agentId}:${a.wouldRun}`).join(", ");
    reasons.push(`panel split (${votes})`);
    return { verdict: "review", reasons, disagreement: true };
  }

  if (reasons.length === 0) reasons.push("insufficient agent reviews");
  return { verdict: "fail", reasons, disagreement: disagreement(agents) };
}
