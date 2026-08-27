import "../../config/load-env";
import fs from "fs";
import path from "path";
import { generateText } from "../../gemini";
import { generateTextWithMetrics as generateDeepseek } from "../../services/deepseek";
import { generateTextWithMetrics as generateMinimax } from "../../services/minimax";
import { generateTextWithMetrics as generateOpenAI } from "../../services/openai";
import { buildSessionPrompt } from "../../prompts/session";
import {
  loadLessonBook,
  matchingActiveLessons,
  promoteProposed,
  saveLessonBook,
  setLessonStatus,
  type LessonBook,
  type LessonStatus,
} from "../../services/session-lessons";
import { AGENT_SPECS, buildAgentPrompt, emptyFailedReview, panelJudgeInputTokens, parseAgentReview } from "./agents";
import { PANEL_FIXTURES, fixtureById } from "./fixtures";
import { runFrozenGates } from "./frozen-gates";
import { learnFromPanelRuns } from "./learn";
import { parseJsonSafe, stripSessionToPacket } from "./packet";
import { buildPreviewRuns } from "./preview-data";
import { buildPanelReportHtml } from "./report";
import type { AgentReview, PanelFixture, SampleRun } from "./types";
import { aggregatePanel } from "./verdict";
import {
  formatPriorsForPrompt,
  loadVarietyHistory,
  maxSimilarityToPriors,
  priorsExcludingSelf,
  priorsForFixture,
  recordVarietyHistory,
  saveVarietyHistory,
  snapshotFromPacket,
  VARIETY_CLONE_THRESHOLD,
  type SessionFormSnapshot,
  type VarietyHistory,
} from "./variety";

/**
 * Independent 3-agent session panel + playbook loop.
 *
 * Generation stays on Flash Lite. Judges are a stronger, separate model.
 * After a run, frozen-gate fails become active lessons in
 * src/data/session-panel-lessons.json (injected into the next generate).
 * Judge-written lessons stay proposed until you --apply them.
 *
 *   pnpm --filter api sandbox:session-panel -- --preview
 *   pnpm --filter api sandbox:session-panel -- --cells u9-d-open-teammate --learn
 *   pnpm --filter api sandbox:session-panel -- --learn --learn-judges --cells u16-b-rest-defence
 *   pnpm --filter api sandbox:session-panel -- --apply
 *   pnpm --filter api sandbox:session-panel -- --lessons
 *   pnpm --filter api sandbox:session-panel -- --until 3 --learn --cells u16-b-rest-defence
 *   pnpm --filter api sandbox:session-panel -- --learn-from apps/api/sandbox-output/session-panel-preview/results.json
 *
 * Variety: each generated hour is fingerprinted (grid/numbers/scoring/constraints)
 * against the last 3 on that cell. First session is N/A. Clones fail the
 * variety-clone gate; judges score v when a PRIOR card is present.
 */

type Args = {
  generateModel: string;
  judgeModel: string;
  cells: string[];
  count: number;
  concurrency: number;
  gatesOnly: boolean;
  cheap: boolean;
  fromJson?: string;
  cell?: string;
  out?: string;
  list: boolean;
  preview: boolean;
  learn: boolean;
  learnJudges: boolean;
  autoApply: boolean;
  noLessons: boolean;
  until: number;
  lessons: boolean;
  apply: boolean;
  pause?: string;
  retire?: string;
  learnFrom?: string;
};

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseArgs(): Args {
  const cheap = hasFlag("--cheap");
  const envJudge = process.env.SESSION_PANEL_JUDGE_MODEL;
  const judgeModel =
    getArgValue("--judgeModel") ||
    envJudge ||
    (cheap ? "gemini-3.5-flash-lite" : "gemini-3.5-flash");
  const cellsRaw = getArgValue("--cells");
  return {
    generateModel: getArgValue("--model") || "gemini-3.5-flash-lite",
    judgeModel,
    cells: cellsRaw ? cellsRaw.split(",").map((s) => s.trim()).filter(Boolean) : PANEL_FIXTURES.map((f) => f.id),
    count: Math.max(1, Number(getArgValue("--count") || 1) || 1),
    concurrency: Math.max(1, Number(getArgValue("--concurrency") || 1) || 1),
    gatesOnly: hasFlag("--gates-only"),
    cheap,
    fromJson: getArgValue("--from-json"),
    cell: getArgValue("--cell"),
    out: getArgValue("--out"),
    list: hasFlag("--list"),
    preview: hasFlag("--preview"),
    learn: hasFlag("--learn") || hasFlag("--until") || Boolean(getArgValue("--learn-from")),
    learnJudges: hasFlag("--learn-judges"),
    autoApply: hasFlag("--auto-apply"),
    noLessons: hasFlag("--no-lessons"),
    until: Math.max(1, Number(getArgValue("--until") || 1) || 1),
    lessons: hasFlag("--lessons"),
    apply: hasFlag("--apply"),
    pause: getArgValue("--pause"),
    retire: getArgValue("--retire"),
    learnFrom: getArgValue("--learn-from"),
  };
}

async function generateForModel(model: string, prompt: string, timeout: number, jsonMode: boolean): Promise<string> {
  if (model.startsWith("deepseek-")) {
    return (await generateDeepseek(prompt, { model, timeout })).text;
  }
  if (model.startsWith("MiniMax-")) {
    return (await generateMinimax(prompt, { model, timeout })).text;
  }
  if (model.startsWith("gpt-")) {
    // GPT-5 family are reasoning models -- without an explicit effort level
    // they default to a higher tier and can burn the entire timeout on
    // invisible reasoning tokens before ever emitting the JSON, especially
    // on this prompt's size (~30k chars). "low" matches the fast, single-shot
    // structured-generation task this actually is. Even at "low", the
    // INTERMEDIATE/ADVANCED prompt variants (longer vocabulary-ceiling and
    // constraint blocks) timed out at 150s live-tested 2026-08-26 while
    // BEGINNER ones didn't -- give gpt- models real headroom rather than
    // reuse Gemini's tighter budget.
    return (await generateOpenAI(prompt, { model, timeout: Math.max(timeout, 280000), reasoningEffort: "low" })).text;
  }
  return generateText(prompt, {
    model,
    fallbackModel: null,
    timeout,
    retries: 0,
    ...(jsonMode ? { responseMimeType: "application/json" } : {}),
  });
}

function panelOutDir(name: string): string {
  return path.join(__dirname, "..", "..", "..", "sandbox-output", name);
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function next(): Promise<void> {
    const i = cursor++;
    if (i >= items.length) return;
    results[i] = await worker(items[i]);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientJudgeError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || "");
  return /503|429|high demand|unavailable|RESOURCE_EXHAUSTED|try again/i.test(msg);
}

async function judgePacket(
  packet: ReturnType<typeof stripSessionToPacket>,
  fixture: PanelFixture,
  judgeModel: string,
  priors: SessionFormSnapshot[] = []
): Promise<AgentReview[]> {
  return Promise.all(
    AGENT_SPECS.map(async (spec, i) => {
      if (i) await sleep(1500 * i);
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const text = await generateForModel(judgeModel, buildAgentPrompt(spec, packet, fixture, priors), 90000, true);
          const review = parseAgentReview(spec, text, { requireVariety: priors.length > 0 });
          if (!review.parseError) return review;
          if (attempt < 3) {
            console.warn(`[session-panel] ${spec.id} returned non-JSON, retrying (${attempt + 1})`);
            await sleep(1500);
            continue;
          }
          return review;
        } catch (err: any) {
          if (attempt < 3 && isTransientJudgeError(err)) {
            const wait = 5000 * (attempt + 1);
            console.warn(`[session-panel] ${spec.id} ${err?.message || err} — wait ${wait / 1000}s`);
            await sleep(wait);
            continue;
          }
          if (attempt < 3) {
            console.warn(`[session-panel] ${spec.id} judge error, retrying:`, err?.message || err);
            await sleep(1500);
            continue;
          }
          return emptyFailedReview(spec, err?.message || String(err));
        }
      }
      return emptyFailedReview(spec, "Judge failed after retry");
    })
  );
}

async function runSample(opts: {
  fixture: PanelFixture;
  generateModel: string;
  judgeModel: string;
  sampleIdx: number;
  gatesOnly: boolean;
  existingSession?: any;
  noLessons?: boolean;
  book?: LessonBook;
  priors?: SessionFormSnapshot[];
}): Promise<SampleRun> {
  const priors = opts.priors || [];
  const base: SampleRun = {
    fixtureId: opts.fixture.id,
    label: opts.fixture.label,
    generateModel: opts.generateModel,
    judgeModel: opts.judgeModel,
    sampleIdx: opts.sampleIdx,
    latencyMs: null,
    error: null,
    title: null,
    packet: null,
    gates: null,
    agents: [],
    panel: null,
    judgeInputTokensApprox: null,
    appliedLessonIds: [],
    varietySim: null,
  };

  try {
    let session = opts.existingSession;
    if (!session) {
      const priorCard = formatPriorsForPrompt(priors);
      const input = opts.noLessons
        ? { ...opts.fixture.input, panelLessons: null, panelPriorCard: priorCard || null }
        : { ...opts.fixture.input, panelPriorCard: priorCard || null };
      if (!opts.noLessons) {
        base.appliedLessonIds = matchingActiveLessons(input, opts.book || loadLessonBook()).map((l) => l.id);
      }
      const prompt = buildSessionPrompt(input);
      const t0 = Date.now();
      const genText = await generateForModel(opts.generateModel, prompt, 150000, false);
      base.latencyMs = Date.now() - t0;
      session = parseJsonSafe(genText);
      if (!session) {
        const dumpPath = path.join("/tmp", `session-panel-failure-${Date.now()}.txt`);
        fs.writeFileSync(dumpPath, genText);
        throw new Error(`Generation returned non-JSON (dumped ${dumpPath})`);
      }
    }

    const packet = stripSessionToPacket(session, opts.fixture);
    base.title = packet.title || null;
    base.packet = packet;
    const topic = String(opts.fixture.input.topic || "");
    const judgePriors = priorsExcludingSelf(snapshotFromPacket(packet), priors, topic);
    base.varietySim = judgePriors.length
      ? maxSimilarityToPriors(snapshotFromPacket(packet), judgePriors, topic)
      : null;
    base.gates = runFrozenGates(packet, opts.fixture, { priors: judgePriors });

    if (!opts.gatesOnly) {
      base.judgeInputTokensApprox = panelJudgeInputTokens(packet, opts.fixture, judgePriors);
      base.agents = await judgePacket(packet, opts.fixture, opts.judgeModel, judgePriors);
    }

    base.panel = aggregatePanel(base.gates, base.agents);
    return base;
  } catch (err: any) {
    const message = err?.message || String(err);
    base.error = message;
    base.panel = { verdict: "fail", reasons: [message], disagreement: false };
    return base;
  }
}

function persistGeneratedPacket(history: VarietyHistory, run: SampleRun, generated: boolean) {
  if (!generated || !run.packet) return;
  const cloned =
    (run.varietySim != null && run.varietySim >= VARIETY_CLONE_THRESHOLD) ||
    Boolean(run.gates?.issues.some((i) => i.code === "variety-clone"));
  if (cloned) return;
  recordVarietyHistory(history, run.fixtureId, run.packet, run.panel?.verdict || undefined);
  saveVarietyHistory(history);
}

function printLessons(book: LessonBook) {
  if (!book.lessons.length) {
    console.log("(playbook empty — run a panel with --learn)");
    return;
  }
  for (const l of book.lessons) {
    const scope = Object.entries(l.scope)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join(",") || "global";
    console.log(`${l.status.padEnd(9)} ${l.helped}↑/${l.failed}↓  ${l.id}  [${scope}]\n           ${l.rule}`);
  }
}

async function applyLearn(args: Args, results: SampleRun[], book: LessonBook) {
  const report = await learnFromPanelRuns({
    runs: results,
    book,
    fixtureOf: fixtureById,
    learnJudges: args.learnJudges,
    generate: args.learnJudges
      ? (prompt) => generateForModel(args.judgeModel, prompt, 60000, true)
      : undefined,
    recordOutcomes: true,
  });
  if (args.autoApply) {
    const n = promoteProposed(book);
    if (n) console.log(`auto-applied ${n} proposed lesson(s)`);
  }
  saveLessonBook(book);
  console.log(`playbook: +${report.added}  active ${report.active}  proposed ${report.proposed}  paused ${report.paused}`);
  printLessons(book);
}

async function main() {
  const args = parseArgs();

  if (args.list) {
    for (const f of PANEL_FIXTURES) {
      console.log(`${f.id}\t${f.input.ageGroup} ${f.input.coachLevel} ${f.input.playerLevel}\t${f.input.topic}`);
    }
    return;
  }

  if (args.lessons) {
    printLessons(loadLessonBook());
    return;
  }

  if (args.apply || args.pause || args.retire) {
    const book = loadLessonBook();
    if (args.apply) {
      const n = promoteProposed(book);
      console.log(`applied ${n} proposed lesson(s)`);
    }
    if (args.pause) {
      const n = setLessonStatus(book, args.pause.split(","), "paused" as LessonStatus);
      console.log(`paused ${n}`);
    }
    if (args.retire) {
      const n = setLessonStatus(book, args.retire.split(","), "retired" as LessonStatus);
      console.log(`retired ${n}`);
    }
    saveLessonBook(book);
    printLessons(book);
    return;
  }

  if (args.learnFrom) {
    const results = JSON.parse(fs.readFileSync(args.learnFrom, "utf8")) as SampleRun[];
    await applyLearn(args, results, loadLessonBook());
    return;
  }

  if (args.preview) {
    const results = buildPreviewRuns();
    const outDir = args.out || panelOutDir("session-panel-preview");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    if (args.learn) await applyLearn(args, results, loadLessonBook());
    fs.writeFileSync(
      path.join(outDir, "report.html"),
      buildPanelReportHtml(results, {
        generateModel: "preview (no LLM)",
        judgeModel: "preview (no LLM)",
        cells: results.map((r) => r.fixtureId).join(", "),
        book: loadLessonBook(),
      })
    );
    const tok = results[0]?.judgeInputTokensApprox;
    console.log(`Preview written. Judge input ~${tok ?? "?"} tok / sample (3 agents, clipped card).`);
    console.log(`Open: ${path.join(outDir, "report.html")}`);
    return;
  }

  if (/lite/i.test(args.judgeModel) && !args.cheap) {
    console.warn(
      `[session-panel] Judge model is ${args.judgeModel}. Flash Lite grading Flash Lite is weak. Pass --judgeModel gemini-3.5-flash (eval only) or --cheap to silence this.`
    );
  } else if (!/lite/i.test(args.judgeModel)) {
    console.warn(
      `[session-panel] EVAL ONLY: judges on ${args.judgeModel}. Session generate stays ${args.generateModel}.`
    );
  }

  const cellIds = args.cell ? [args.cell] : args.cells;
  const fixtures = cellIds.map((id) => {
    const f = fixtureById(id);
    if (!f) throw new Error(`Unknown cell "${id}". Use --list.`);
    return f;
  });

  if (args.fromJson) {
    if (fixtures.length !== 1) throw new Error("--from-json requires exactly one --cell");
    const session = JSON.parse(fs.readFileSync(args.fromJson, "utf8"));
    const history = loadVarietyHistory();
    const run = await runSample({
      fixture: fixtures[0],
      generateModel: "from-json",
      judgeModel: args.judgeModel,
      sampleIdx: 0,
      gatesOnly: args.gatesOnly,
      existingSession: session,
      noLessons: args.noLessons,
      priors: priorsForFixture(history, fixtures[0].id),
    });
    const outDir = args.out || panelOutDir(`session-panel-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify([run], null, 2));
    if (args.learn) await applyLearn(args, [run], loadLessonBook());
    fs.writeFileSync(
      path.join(outDir, "report.html"),
      buildPanelReportHtml([run], {
        generateModel: "from-json",
        judgeModel: args.judgeModel,
        cells: fixtures[0].id,
        book: loadLessonBook(),
      })
    );
    console.log(`${run.panel?.verdict} — ${run.label}`);
    console.log(`Open: ${path.join(outDir, "report.html")}`);
    return;
  }

  const jobs: Array<{ fixture: PanelFixture; sampleIdx: number }> = [];
  for (const fixture of fixtures) {
    for (let i = 0; i < args.count; i++) jobs.push({ fixture, sampleIdx: i });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = args.out || panelOutDir(`session-panel-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  let last: SampleRun[] = [];
  const history = loadVarietyHistory();
  for (let round = 1; round <= args.until; round++) {
    const book = loadLessonBook();
    console.log(
      `Panel round ${round}/${args.until}: ${jobs.length} sample(s), generate=${args.generateModel}, judge=${args.gatesOnly ? "skipped" : args.judgeModel}, lessons=${args.noLessons ? "off" : book.lessons.filter((l) => l.status === "active").length + " active"}`
    );
    let done = 0;
    last = await runWithConcurrency(jobs, args.concurrency, async (job) => {
      const run = await runSample({
        fixture: job.fixture,
        generateModel: args.generateModel,
        judgeModel: args.judgeModel,
        sampleIdx: job.sampleIdx,
        gatesOnly: args.gatesOnly,
        noLessons: args.noLessons,
        book,
        priors: priorsForFixture(history, job.fixture.id),
      });
      persistGeneratedPacket(history, run, true);
      done++;
      const v = run.panel?.verdict || "fail";
      const sim = run.varietySim == null ? "" : ` var:${(run.varietySim * 100).toFixed(0)}%`;
      console.log(
        `  ${done}/${jobs.length} ${job.fixture.id} — ${run.error ? "ERROR " + run.error : v}${run.gates && !run.gates.ok ? ` gates:${run.gates.issues.length}` : ""}${sim}`
      );
      return run;
    });
    fs.writeFileSync(path.join(outDir, args.until > 1 ? `results-round-${round}.json` : "results.json"), JSON.stringify(last, null, 2));
    if (args.learn) await applyLearn(args, last, book);
    const tallies = { proud: 0, review: 0, fail: 0 };
    for (const r of last) tallies[r.panel?.verdict || "fail"] += 1;
    console.log(`round ${round}: proud ${tallies.proud} · review ${tallies.review} · fail ${tallies.fail}`);
    if (tallies.fail === 0 && tallies.review === 0) {
      console.log("all proud — stopping");
      break;
    }
  }

  fs.writeFileSync(
    path.join(outDir, "report.html"),
    buildPanelReportHtml(last, {
      generateModel: args.generateModel,
      judgeModel: args.gatesOnly ? "(gates only)" : args.judgeModel,
      cells: fixtures.map((f) => f.id).join(", "),
      book: loadLessonBook(),
    })
  );
  console.log(`Open: ${path.join(outDir, "report.html")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
