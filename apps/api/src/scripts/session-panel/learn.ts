import { parseJsonSafe } from "./packet";
import { C_BANNED_SYSTEMIC } from "./frozen-gates";
import type { PanelFixture, SampleRun } from "./types";
import {
  clipRule,
  pauseDeadLessons,
  recordLessonOutcomes,
  upsertLesson,
  type LessonBook,
  type LessonKind,
  type LessonSource,
  type PanelLesson,
} from "../../services/session-lessons";

// D_BANNED has 16 terms — naming all of them blows past RULE_MAX_CHARS (180)
// once framed as a sentence, and clipRule's ellipsis truncation would cut the
// list mid-word. Name a representative spread as concrete examples instead;
// the frozen gate itself still enforces the full list regardless of prompt text.
const D_BANNED_EXAMPLES = ["overload", "compact", "half-turn", "rest defense", "positional shape", "pressing trigger"].join(", ");
const C_BANNED_LIST = C_BANNED_SYSTEMIC.map((b) => b.term).join(", ");

const GATE_RULES: Record<string, { rule: string; kind: LessonKind; scopeFrom: Array<"coachLevel" | "playerLevel" | "topic"> }> = {
  "topic-signal": {
    kind: "must",
    scopeFrom: [],
    rule: "Tactical and conditioned-game text must teach today's topic in scoring or a constraint, not only in the title.",
  },
  "topic-tactical": {
    kind: "must",
    scopeFrom: [],
    rule: "The TACTICAL title and description must be about today's topic, not only the game model.",
  },
  "topic-game": {
    kind: "must",
    scopeFrom: [],
    rule: "CONDITIONED_GAME scoring or a constraint must be false if you swapped today's topic for a different subject.",
  },
  "d-jargon": {
    kind: "never",
    scopeFrom: ["coachLevel"],
    rule: `USSF_D: never write textbook terms (e.g. ${D_BANNED_EXAMPLES}). Describe the action in ordinary grass words.`,
  },
  "c-jargon": {
    kind: "never",
    scopeFrom: ["coachLevel"],
    rule: `USSF_C: never write any of these words — ${C_BANNED_LIST}. Name one concept, explain it in the next sentence.`,
  },
  "beginner-touch": {
    kind: "never",
    scopeFrom: ["playerLevel"],
    rule: "BEGINNER: no 1-touch or 2-touch limits. Players need time on the ball.",
  },
  "copy-paste-points": {
    kind: "never",
    scopeFrom: [],
    rule: "Each drill's coaching points must be unique to that drill. Do not repeat the same points from warmup through the game.",
  },
  format: {
    kind: "never",
    scopeFrom: [],
    rule: "Do not mention a bigger match format than this age group plays (U8-U10 7v7, U11-U12 9v9, U13+ 11v11).",
  },
  "warmup-crowd": {
    kind: "must",
    scopeFrom: [],
    rule: "Warmup picture is one working group (~8), not the whole squad.",
  },
  "tech-crowd": {
    kind: "must",
    scopeFrom: [],
    rule: "Technical picture is one working group (~8-10), not the whole squad.",
  },
  "variety-clone": {
    kind: "never",
    scopeFrom: ["topic"],
    rule: "Do not reuse PRIOR grids or scoring stems. Change activity type (not a retitled rondo). New score must still force today's topic.",
  },
  "tactical-is-match": {
    kind: "never",
    scopeFrom: [],
    rule: "TACTICAL is a reduced problem grid, not a second full-format match. Only CONDITIONED_GAME is 11v11/9v9/7v7 on the full pitch.",
  },
  "idle-squad": {
    kind: "must",
    scopeFrom: [],
    rule: "If the squad is bigger than one working group, WARMUP/TECHNICAL setupSteps name a second group on the same score. No idle spectators.",
  },
};

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export function gateLessonsFromRuns(runs: SampleRun[], fixtureOf: (id: string) => PanelFixture | undefined): Array<Omit<PanelLesson, "createdAt" | "updatedAt" | "seen" | "helped" | "failed"> & Partial<PanelLesson>> {
  const byId = new Map<string, PanelLesson>();
  const now = new Date().toISOString();
  for (const run of runs) {
    const fixture = fixtureOf(run.fixtureId);
    const input = fixture?.input;
    for (const issue of run.gates?.issues || []) {
      const tmpl = GATE_RULES[issue.code];
      if (!tmpl) continue;
      const scope: PanelLesson["scope"] = {};
      if (tmpl.scopeFrom.includes("coachLevel") && input?.coachLevel) scope.coachLevel = input.coachLevel;
      if (tmpl.scopeFrom.includes("playerLevel") && input?.playerLevel) scope.playerLevel = input.playerLevel;
      if (tmpl.scopeFrom.includes("topic") && input?.topic) scope.topic = input.topic;
      const id = ["gate", issue.code, scope.coachLevel, scope.playerLevel, scope.topic ? slug(scope.topic) : ""].filter(Boolean).join(":");
      const prev = byId.get(id);
      if (prev) {
        prev.seen += 1;
        prev.because = issue.detail;
        continue;
      }
      byId.set(id, {
        id,
        status: "active",
        kind: tmpl.kind,
        rule: tmpl.rule,
        because: issue.detail,
        source: "gate",
        scope,
        seen: 1,
        helped: 0,
        failed: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return [...byId.values()];
}

function failDigest(run: SampleRun, fixture?: PanelFixture): string {
  const topic = fixture?.input.topic || run.packet?.topic || "";
  const lines = [
    `${run.fixtureId} ${run.panel?.verdict} topic="${topic}" ${fixture?.input.ageGroup || ""} ${fixture?.input.coachLevel || ""} ${fixture?.input.playerLevel || ""}`,
    run.gates?.issues?.length ? `gates: ${run.gates.issues.map((i) => i.code).join(", ")}` : "",
  ];
  for (const a of run.agents) {
    if (a.wouldRun === "yes" && a.topicTaught >= 4 && a.trainingQuality >= 4 && (a.variety == null || a.variety >= 4)) continue;
    const q = a.evidence[0] ? ` "${a.evidence[0].quote}" (${a.evidence[0].drillTitle})` : "";
    const v = a.variety != null ? ` v=${a.variety}` : "";
    lines.push(`${a.agentId} t=${a.topicTaught} q=${a.trainingQuality}${v} ${a.wouldRun}: ${String(a.notes).slice(0, 180)}${q}`);
  }
  return lines.filter(Boolean).join("\n");
}

const SYNTH_PROMPT_HEAD = `You turn independent coaching-panel fails into NEW generator rules.
Each rule is ONE sentence, <=180 chars, something Flash Lite can follow next time.
Do not repeat EXISTING rules. Do not write rubric commentary.
Scope a rule to coachLevel/topic when it would be wrong globally (e.g. rest-defence scoring on a U9 passing session).
Return ONLY JSON: {"lessons":[{"rule":"...","kind":"must"|"never","source":"development"|"instructor"|"designer","scope":{"coachLevel?":"","topic?":""}}]}
0-3 lessons. Empty array if nothing new.`;

export async function judgeLessonsFromRuns(
  runs: SampleRun[],
  book: LessonBook,
  fixtureOf: (id: string) => PanelFixture | undefined,
  generate: (prompt: string) => Promise<string>
): Promise<Omit<PanelLesson, "createdAt" | "updatedAt" | "seen" | "helped" | "failed">[]> {
  const fails = runs.filter((r) => r.panel?.verdict && r.panel.verdict !== "proud" && r.agents.length);
  if (!fails.length) return [];

  const existing = book.lessons
    .filter((l) => l.status !== "retired")
    .map((l) => `- ${l.rule}`)
    .slice(0, 16)
    .join("\n");

  const digest = fails.map((r) => failDigest(r, fixtureOf(r.fixtureId))).join("\n---\n").slice(0, 3500);
  const prompt = [SYNTH_PROMPT_HEAD, "EXISTING:", existing || "(none)", "FAILS:", digest].join("\n");
  const text = await generate(prompt);
  const parsed = parseJsonSafe(text);
  const raw = Array.isArray(parsed?.lessons) ? parsed.lessons : [];
  const nowIds = new Set<string>();
  const out: Omit<PanelLesson, "createdAt" | "updatedAt" | "seen" | "helped" | "failed">[] = [];
  for (const item of raw.slice(0, 3)) {
    const rule = clipRule(String(item?.rule || ""));
    if (rule.length < 24) continue;
    if (book.lessons.some((l) => l.rule.toLowerCase() === rule.toLowerCase())) continue;
    const source = (["development", "instructor", "designer"] as LessonSource[]).includes(item?.source) ? item.source : "designer";
    const scope = item?.scope && typeof item.scope === "object" ? item.scope : {};
    const id = `judge:${source}:${slug(rule)}`;
    if (nowIds.has(id)) continue;
    nowIds.add(id);
    out.push({
      id,
      status: "proposed",
      kind: item?.kind === "never" ? "never" : "must",
      rule,
      because: `judge ${source} on panel fail`,
      source,
      scope: {
        ...(scope.coachLevel ? { coachLevel: String(scope.coachLevel) } : {}),
        ...(scope.topic ? { topic: String(scope.topic) } : {}),
        ...(scope.playerLevel ? { playerLevel: String(scope.playerLevel) } : {}),
        ...(scope.ageGroup ? { ageGroup: String(scope.ageGroup) } : {}),
      },
    });
  }
  return out;
}

export function mergeLearnedLessons(
  book: LessonBook,
  incoming: Array<Omit<PanelLesson, "createdAt" | "updatedAt" | "seen" | "helped" | "failed"> & Partial<PanelLesson>>
): { added: number; bumped: number } {
  const before = new Set(book.lessons.map((l) => l.id));
  let bumped = 0;
  for (const lesson of incoming) {
    const existed = before.has(lesson.id);
    upsertLesson(book, lesson);
    if (existed) bumped++;
  }
  return { added: incoming.filter((l) => !before.has(l.id)).length, bumped };
}

export type LearnReport = {
  added: number;
  bumped: number;
  proposed: number;
  active: number;
  paused: number;
};

export async function learnFromPanelRuns(opts: {
  runs: SampleRun[];
  book: LessonBook;
  fixtureOf: (id: string) => PanelFixture | undefined;
  learnJudges?: boolean;
  generate?: (prompt: string) => Promise<string>;
  recordOutcomes?: boolean;
}): Promise<LearnReport> {
  if (opts.recordOutcomes !== false) {
    recordLessonOutcomes(opts.book, opts.runs);
  }
  const incoming = [
    ...gateLessonsFromRuns(opts.runs, opts.fixtureOf),
    ...((opts.learnJudges && opts.generate
      ? await judgeLessonsFromRuns(opts.runs, opts.book, opts.fixtureOf, opts.generate)
      : []) as ReturnType<typeof gateLessonsFromRuns>),
  ];
  const merged = mergeLearnedLessons(opts.book, incoming);
  pauseDeadLessons(opts.book);
  return {
    added: merged.added,
    bumped: merged.bumped,
    proposed: opts.book.lessons.filter((l) => l.status === "proposed").length,
    active: opts.book.lessons.filter((l) => l.status === "active").length,
    paused: opts.book.lessons.filter((l) => l.status === "paused").length,
  };
}
