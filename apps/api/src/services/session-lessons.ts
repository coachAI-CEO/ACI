import fs from "fs";
import path from "path";
import type { SessionPromptInput } from "../prompts/session";

export type LessonStatus = "proposed" | "active" | "paused" | "retired";
export type LessonKind = "must" | "never";
export type LessonSource = "gate" | "development" | "instructor" | "designer" | "human";

export type LessonScope = {
  coachLevel?: string;
  playerLevel?: string;
  ageGroup?: string;
  topic?: string;
  gameModelId?: string;
};

export type PanelLesson = {
  id: string;
  status: LessonStatus;
  kind: LessonKind;
  /** One sentence the generator must follow. Keep under 180 chars. */
  rule: string;
  because: string;
  source: LessonSource;
  scope: LessonScope;
  seen: number;
  helped: number;
  failed: number;
  createdAt: string;
  updatedAt: string;
};

export type LessonBook = {
  version: 1;
  updatedAt: string;
  lessons: PanelLesson[];
};

export const LESSONS_PATH = path.join(__dirname, "../data/session-panel-lessons.json");
export const MAX_PROMPT_LESSONS = 12;
export const RULE_MAX_CHARS = 180;
const PAUSE_AFTER_FAILS = 3;

const emptyBook = (): LessonBook => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  lessons: [],
});

export function loadLessonBook(filePath: string = LESSONS_PATH): LessonBook {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as LessonBook;
    if (!parsed || !Array.isArray(parsed.lessons)) return emptyBook();
    return { version: 1, updatedAt: parsed.updatedAt || emptyBook().updatedAt, lessons: parsed.lessons };
  } catch {
    return emptyBook();
  }
}

export function saveLessonBook(book: LessonBook, filePath: string = LESSONS_PATH): void {
  book.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(book, null, 2) + "\n");
}

export function clipRule(rule: string): string {
  const t = String(rule || "").replace(/\s+/g, " ").trim();
  if (t.length <= RULE_MAX_CHARS) return t;
  return t.slice(0, RULE_MAX_CHARS - 1) + "…";
}

export function scopeMatches(scope: LessonScope, input: SessionPromptInput): boolean {
  const same = (a?: string, b?: string) => !a || !b || a.toLowerCase() === b.toLowerCase();
  if (!same(scope.coachLevel, input.coachLevel)) return false;
  if (!same(scope.playerLevel, input.playerLevel)) return false;
  if (!same(scope.ageGroup, input.ageGroup)) return false;
  if (!same(scope.gameModelId, input.gameModelId)) return false;
  if (scope.topic) {
    const topic = String(input.topic || "").toLowerCase();
    const want = scope.topic.toLowerCase();
    if (!topic) return false;
    if (!topic.includes(want) && !want.includes(topic)) return false;
  }
  return true;
}

function scopeWeight(scope: LessonScope): number {
  return Object.values(scope).filter(Boolean).length;
}

export function matchingActiveLessons(input: SessionPromptInput, book: LessonBook): PanelLesson[] {
  return book.lessons
    .filter((l) => l.status === "active" && scopeMatches(l.scope, input))
    .sort((a, b) => scopeWeight(b.scope) - scopeWeight(a.scope) || b.helped - a.helped || b.seen - a.seen)
    .slice(0, MAX_PROMPT_LESSONS);
}

/**
 * Compact block for the generator. Empty string when nothing matches — no
 * extra tokens on a fresh playbook.
 */
export function formatLessonsForPrompt(input: SessionPromptInput, book?: LessonBook): string {
  if (Array.isArray(input.panelLessons)) {
    const lines = input.panelLessons.map(clipRule).filter(Boolean).slice(0, MAX_PROMPT_LESSONS);
    if (!lines.length) return "";
    return ["⚠️ PANEL LESSONS (from independent coaches — follow):", ...lines.map((r) => `- ${r}`)].join("\n");
  }
  if (input.panelLessons === null) return "";
  const matched = matchingActiveLessons(input, book || loadLessonBook());
  if (!matched.length) return "";
  return [
    "⚠️ PANEL LESSONS (from independent coaches — follow):",
    ...matched.map((l) => `- ${clipRule(l.rule)}`),
  ].join("\n");
}

export function pauseDeadLessons(book: LessonBook): PanelLesson[] {
  const paused: PanelLesson[] = [];
  const now = new Date().toISOString();
  for (const lesson of book.lessons) {
    if (lesson.status !== "active") continue;
    if (lesson.failed >= PAUSE_AFTER_FAILS && lesson.helped === 0) {
      lesson.status = "paused";
      lesson.updatedAt = now;
      paused.push(lesson);
    }
  }
  return paused;
}

export function setLessonStatus(book: LessonBook, ids: string[], status: LessonStatus): number {
  const want = new Set(ids);
  let n = 0;
  const now = new Date().toISOString();
  for (const lesson of book.lessons) {
    if (!want.has(lesson.id) && !(ids.length === 1 && ids[0] === "proposed" && lesson.status === "proposed")) continue;
    if (ids[0] === "proposed" && ids.length === 1) {
      if (lesson.status !== "proposed") continue;
      lesson.status = status;
      lesson.updatedAt = now;
      n++;
      continue;
    }
    if (want.has(lesson.id)) {
      lesson.status = status;
      lesson.updatedAt = now;
      n++;
    }
  }
  return n;
}

export function promoteProposed(book: LessonBook): number {
  return setLessonStatus(book, ["proposed"], "active");
}

export function upsertLesson(book: LessonBook, incoming: Omit<PanelLesson, "createdAt" | "updatedAt" | "seen" | "helped" | "failed"> & Partial<Pick<PanelLesson, "seen" | "helped" | "failed" | "status">>): PanelLesson {
  const now = new Date().toISOString();
  const existing = book.lessons.find((l) => l.id === incoming.id);
  if (existing) {
    existing.seen += 1;
    existing.because = incoming.because || existing.because;
    existing.rule = clipRule(incoming.rule || existing.rule);
    existing.updatedAt = now;
    if (existing.status === "retired") {
      // stay retired — human said stop
    } else if (incoming.status && existing.status === "proposed" && incoming.status === "active") {
      existing.status = "active";
    }
    return existing;
  }
  const created: PanelLesson = {
    id: incoming.id,
    status: incoming.status || "proposed",
    kind: incoming.kind,
    rule: clipRule(incoming.rule),
    because: incoming.because,
    source: incoming.source,
    scope: incoming.scope || {},
    seen: incoming.seen ?? 1,
    helped: incoming.helped ?? 0,
    failed: incoming.failed ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  book.lessons.push(created);
  return created;
}

const RANK: Record<string, number> = { proud: 2, review: 1, fail: 0 };

export function recordLessonOutcomes(
  book: LessonBook,
  runs: Array<{
    appliedLessonIds?: string[] | null;
    panel?: { verdict?: string } | null;
    agents?: Array<{ parseError?: string | null; wouldRun?: string | null }> | null;
    gates?: { issues?: Array<{ code?: string }> | null } | null;
  }>
): void {
  const now = new Date().toISOString();
  for (const run of runs) {
    if ((run.agents || []).some((a) => a.parseError)) continue;
    const idsAll = run.appliedLessonIds || [];
    const rank = RANK[run.panel?.verdict || "fail"] ?? 0;
    const improved = rank >= 1;
    const codes = (run.gates?.issues || []).map((i) => i.code).filter(Boolean) as string[];
    const varietyOnlyFail = !improved && codes.length > 0 && codes.every((c) => c === "variety-clone");
    const gateOnlyFail =
      !improved &&
      codes.length > 0 &&
      (run.agents || []).every((a) => !a.parseError && a.wouldRun !== "no");
    const ids = varietyOnlyFail
      ? idsAll.filter((id) => id.includes("variety-clone"))
      : gateOnlyFail
        ? idsAll.filter((id) => codes.some((c) => id.includes(c)))
        : idsAll;
    for (const id of ids) {
      const lesson = book.lessons.find((l) => l.id === id);
      if (!lesson) continue;
      if (improved) lesson.helped += 1;
      else lesson.failed += 1;
      lesson.updatedAt = now;
    }
  }
  pauseDeadLessons(book);
}
