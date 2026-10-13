import fs from "fs";
import path from "path";
import type { SessionPacket } from "./types";

export type DrillForm = {
  type: string;
  title: string;
  area: string;
  players: number;
  scoring: string;
  constraints: string[];
};

export type SessionFormSnapshot = {
  title: string;
  drills: DrillForm[];
};

export type FixtureHistoryEntry = {
  at: string;
  verdict?: string;
  snapshot: SessionFormSnapshot;
};

export type VarietyHistory = {
  version: 1;
  byFixture: Record<string, FixtureHistoryEntry[]>;
};

export const VARIETY_HISTORY_PATH = path.join(__dirname, "../../data/session-panel-history.json");
export const VARIETY_CLONE_THRESHOLD = 0.7;
const KEEP = 3;

function clip(s: string, n: number): string {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}

function areaOf(drill: SessionPacket["drills"][number]): string {
  const area = drill.organization?.area;
  if (area && typeof area === "object") {
    const a = area as { lengthYards?: number; widthYards?: number };
    if (a.lengthYards && a.widthYards) return `${a.lengthYards}x${a.widthYards}`;
  }
  if (typeof area === "string") return clip(area, 24);
  return "";
}

export function snapshotFromPacket(packet: SessionPacket): SessionFormSnapshot {
  return {
    title: clip(packet.title, 80),
    drills: packet.drills.map((d) => ({
      type: d.drillType,
      title: clip(d.title, 70),
      area: areaOf(d),
      players: d.diagramCounts?.players || 0,
      scoring: clip(d.organization.scoring, 90),
      constraints: (d.constraints || []).slice(0, 3).map((c) => clip(c, 70)),
    })),
  };
}

function topicStopWords(topic: string): Set<string> {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "then",
    "from",
    "into",
    "must",
    "team",
    "players",
    "player",
    "session",
    "drill",
    "after",
    "when",
    "ball",
    "possession",
    "during",
    "their",
    "your",
    "our",
    "none",
  ]);
  for (const w of topic.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length > 2) stop.add(w);
  }
  return stop;
}

/** Practice-form tokens only: grids, numbers, scoring mechanic, constraints — not the topic name. */
export function formTokens(snapshot: SessionFormSnapshot, topic = ""): Set<string> {
  const stop = topicStopWords(topic);
  const bag = new Set<string>();
  const push = (raw: string) => {
    const nums = raw.match(/\d+\s*x\s*\d+|\d+\s*v\s*\d+|\d+/gi) || [];
    for (const n of nums) bag.add(n.toLowerCase().replace(/\s+/g, ""));
    for (const w of raw.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length < 3 || stop.has(w)) continue;
      bag.add(w);
    }
  };
  for (const d of snapshot.drills) {
    if (/COOLDOWN/i.test(d.type)) continue;
    if (d.players) bag.add(`${d.players}p`);
    push(d.area);
    push(d.scoring);
    for (const c of d.constraints) push(c);
    push(d.title);
  }
  return bag;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export function maxSimilarityToPriors(
  current: SessionFormSnapshot,
  priors: SessionFormSnapshot[],
  topic = ""
): number {
  const cur = formTokens(current, topic);
  let max = 0;
  for (const prior of priors) {
    max = Math.max(max, jaccard(cur, formTokens(prior, topic)));
  }
  return max;
}

export function compactPriorCard(snapshot: SessionFormSnapshot, n?: number): string {
  const label = n != null ? `PRIOR ${n}` : "PRIOR";
  const lines = [`${label} (same topic, different PRACTICE FORM — do not clone): ${snapshot.title}`];
  for (const d of snapshot.drills) {
    if (/COOLDOWN/i.test(d.type)) continue;
    const cx = d.constraints.length ? ` | ${d.constraints.join("; ")}` : "";
    const players = d.players ? `${d.players}p` : "";
    lines.push(`${d.type} ${d.area} ${players} | ${d.scoring}${cx} | ${d.title}`.replace(/\s+/g, " ").trim());
  }
  return lines.join("\n");
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const k = v.toLowerCase();
    if (!v || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function scoringStem(scoring: string): string {
  return clip(scoring.replace(/[.…]+$/g, ""), 48);
}

/**
 * Generator-facing lock. Ban lists only — do not paste full PRIOR scoring/
 * constraint sentences or Flash Lite will copy them.
 */
export function formatPriorsForPrompt(priors: SessionFormSnapshot[]): string {
  if (!priors.length) return "";
  const latest = priors.slice(-2);
  const drills = latest.flatMap((s) => s.drills.filter((d) => !/COOLDOWN/i.test(d.type)));
  const areas = unique(drills.map((d) => d.area).filter(Boolean));
  const scores = unique(drills.map((d) => scoringStem(d.scoring)).filter(Boolean));
  const titles = unique(latest.map((s) => s.title).concat(drills.map((d) => clip(d.title, 40))));
  return [
    "⚠️ VARIETY LOCK (MANDATORY — a clone of PRIOR is an INVALID session):",
    "Same topic. Different PRACTICE FORM. Retitling the same rondo/grid/score is a fail.",
    areas.length ? `- BANNED grids (do not reuse): ${areas.join(", ")}` : "",
    scores.length ? `- BANNED scoring stems (do not rewrite these): ${scores.join(" / ")}` : "",
    titles.length ? `- BANNED titles: ${titles.join("; ")}` : "",
    "- At least 3 of 4 drills must change BOTH the area AND the activity type vs PRIOR (if PRIOR warmup is a perimeter rondo, do not write another rondo — use a directional wave, 4v2 channel, or target-player activation).",
    "- Write new scoring that still forces today's topic. Do not copy PRIOR constraint sentences.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function emptyHistory(): VarietyHistory {
  return { version: 1, byFixture: {} };
}

export function loadVarietyHistory(filePath: string = VARIETY_HISTORY_PATH): VarietyHistory {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as VarietyHistory;
    if (!parsed?.byFixture) return emptyHistory();
    return { version: 1, byFixture: parsed.byFixture };
  } catch {
    return emptyHistory();
  }
}

export function saveVarietyHistory(history: VarietyHistory, filePath: string = VARIETY_HISTORY_PATH): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(history, null, 2) + "\n");
}

export function priorsExcludingSelf(
  current: SessionFormSnapshot,
  priors: SessionFormSnapshot[],
  topic = ""
): SessionFormSnapshot[] {
  return priors.filter((prior) => {
    if (current.title && prior.title && current.title === prior.title) return false;
    return maxSimilarityToPriors(current, [prior], topic) < 0.9;
  });
}

export function priorsForFixture(history: VarietyHistory, fixtureId: string): SessionFormSnapshot[] {
  return (history.byFixture[fixtureId] || []).map((e) => e.snapshot);
}

export function recordVarietyHistory(
  history: VarietyHistory,
  fixtureId: string,
  packet: SessionPacket,
  verdict?: string
): void {
  const list = history.byFixture[fixtureId] || [];
  list.push({
    at: new Date().toISOString(),
    verdict,
    snapshot: snapshotFromPacket(packet),
  });
  history.byFixture[fixtureId] = list.slice(-KEEP);
}
