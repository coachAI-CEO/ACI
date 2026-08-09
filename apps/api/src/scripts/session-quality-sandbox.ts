import "../config/load-env";
import fs from "fs";
import path from "path";
import { generateText } from "../gemini";
import { buildSessionPrompt, buildSessionQAReviewerPrompt, type SessionPromptInput } from "../prompts/session";

/**
 * Session quality sandbox.
 *
 * Unlike diagram-sandbox.ts (which checks structural consistency -- counts,
 * positions, direction), this compares actual generation QUALITY across
 * models, coach levels, and player levels:
 *   - latency (coaches lose attention past ~30-40s, per product ask)
 *   - the production QA reviewer's own scores (structure/clarity/etc, held
 *     to a FIXED judge model so it's not testing itself)
 *   - a new LLM-judge pass specifically for language fit: is USSF_D
 *     language actually simpler than USSF_C/B+? Is BEGINNER language
 *     simpler than ADVANCED? Is the coaching content sound, not just
 *     readable?
 *
 * No DB writes -- this calls buildSessionPrompt/generateText directly
 * (same trimmed-pipeline pattern as diagram-sandbox.ts) rather than the
 * full generateAndReviewSession(), which persists a Session+Drill rows and
 * needs a userId. That persistence path is what production actually runs,
 * but re-deriving comparable text output doesn't require it, and a sandbox
 * run should not pollute the vault with test data.
 *
 * Usage:
 *   pnpm --filter api sandbox:session-quality -- --count 1
 *   pnpm --filter api sandbox:session-quality -- --models gemini-3.5-flash-lite,gemini-3.1-flash-lite-preview --coachLevels USSF_D,USSF_B_PLUS
 *
 * gemini-3.5-flash and gemini-3.6-flash (non-lite) are banned -- see
 * gemini.ts for the cost comparison. Do not pass them via --models.
 */

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

type Args = {
  models: string[];
  coachLevels: string[];
  playerLevels: string[];
  count: number;
  concurrency: number;
  judgeModel: string;
  qaModel: string;
  out?: string;
  latencyTargetMs: number;
};

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function parseListArg(flag: string, fallback: string[]): string[] {
  const raw = getArgValue(flag);
  if (!raw) return fallback;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseArgs(): Args {
  const count = Number(getArgValue("--count") || 1);
  const concurrency = Number(getArgValue("--concurrency") || 2);
  const latencyTargetMs = Number(getArgValue("--latencyTargetMs") || 40000);
  return {
    // gemini-3.5-flash and gemini-3.6-flash (non-lite) are banned as
    // defaults -- $21.5 and $76.5 in a single day's spend versus
    // $1.24/$1.29 combined for the lite variants. Pass --models explicitly
    // if a deliberate one-off comparison against a non-lite model is
    // needed; the default set here must never silently bill one.
    models: parseListArg("--models", ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite-preview"]),
    coachLevels: parseListArg("--coachLevels", ["USSF_D", "USSF_C", "USSF_B_PLUS"]),
    playerLevels: parseListArg("--playerLevels", ["BEGINNER", "ADVANCED"]),
    count: Number.isFinite(count) && count > 0 ? count : 1,
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 2,
    judgeModel: getArgValue("--judgeModel") || "gemini-3.5-flash-lite",
    qaModel: getArgValue("--qaModel") || process.env.GEMINI_QA_MODEL || "gemini-3.1-flash-lite-preview",
    out: getArgValue("--out"),
    latencyTargetMs: Number.isFinite(latencyTargetMs) && latencyTargetMs > 0 ? latencyTargetMs : 40000,
  };
}

// ---------------------------------------------------------------------------
// Fixed base input -- only model/coachLevel/playerLevel vary between
// samples, so any difference in output is attributable to those, not to
// noise from a different game model/zone/age group each time.
// ---------------------------------------------------------------------------

const BASE_INPUT: Omit<SessionPromptInput, "coachLevel" | "playerLevel"> = {
  gameModelId: "POSSESSION",
  ageGroup: "U12",
  phase: "ATTACKING",
  zone: "MIDDLE_THIRD",
  numbersMin: 10,
  numbersMax: 14,
  goalsAvailable: 1,
  spaceConstraint: "HALF",
  durationMin: 90,
  formationAttacking: "3-2-3",
  formationDefending: "3-2-3",
};

function parseJsonSafe(text: string): any {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return null;
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Language-fit / coaching-soundness judge
// ---------------------------------------------------------------------------

const JUDGE_RUBRIC = `
You are a UEFA-licensed youth coaching curriculum reviewer. You will be shown
a generated training session (JSON) along with the COACH LEVEL and PLAYER
LEVEL it was written for. Score it on four dimensions, 1-5 each:

languageFitCoachLevel -- does the WRITING STYLE match the coach level?
  - USSF_D: plain, encouraging, no tactical jargon (no "rest defense",
    "third-man run", "counterpress", "cover shadow" etc). Short sentences.
  - USSF_C: moderate tactical vocabulary, assumes some coaching background.
  - USSF_B_PLUS: full tactical vocabulary, advanced concepts expected.
  Score 5 = clearly, consistently matches the target level throughout.
  Score 1 = reads the same regardless of level, or uses jargon inappropriate
  for USSF_D, or is condescendingly simple for USSF_B_PLUS.

languageFitPlayerLevel -- do coaching points/constraints assume the right
  skill level (BEGINNER = simple technical cues, forgiving constraints;
  ADVANCED = complex decision-making, tighter constraints)?
  Score 5 = clearly calibrated. Score 1 = no distinguishable calibration.

coachingSoundness -- is the actual tactical/technical content correct and
  age-appropriate soccer coaching, independent of how it's worded?
  Score 5 = a real coach would trust and run this as written.
  Score 1 = tactically wrong, unsafe, or incoherent.

overall -- your holistic 1-5 judgment of this session's usefulness to the
  coach it claims to be written for.

Return ONLY JSON:
{
  "languageFitCoachLevel": number,
  "languageFitPlayerLevel": number,
  "coachingSoundness": number,
  "overall": number,
  "reasoning": string,
  "flaggedPhrases": string[]
}
"reasoning" must be 2-4 sentences citing SPECIFIC phrases from the session
text (quote them) as evidence for your scores -- not generic praise.
"flaggedPhrases" lists any phrase that is wrong for the stated coach/player
level (e.g. jargon in a USSF_D session), empty array if none.
`.trim();

async function judgeSession(params: {
  session: any;
  coachLevel: string;
  playerLevel: string;
  judgeModel: string;
}): Promise<any> {
  const prompt = [
    JUDGE_RUBRIC,
    "",
    `TARGET COACH LEVEL: ${params.coachLevel}`,
    `TARGET PLAYER LEVEL: ${params.playerLevel}`,
    "",
    "SESSION JSON:",
    JSON.stringify(params.session, null, 2),
  ].join("\n");

  const text = await generateText(prompt, {
    timeout: 60000,
    retries: 0,
    model: params.judgeModel,
    fallbackModel: null,
  });
  const parsed = parseJsonSafe(text);
  if (!parsed) throw new Error("Judge returned non-JSON output");
  return parsed;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

// Deterministic diagram-structure check -- does NOT trust the model's own
// self-report (the QA reviewer and judge are both LLM calls that can be
// fooled or just wrong). Mirrors the actual production requirement from
// the prompt's DIAGRAM REQUIREMENT blocks: every non-COOLDOWN drill needs
// a non-empty diagram.players array, plus arrows/annotations/safeZones.
// This is the ground truth for "did trimming the prompt lose anything."
type DiagramCheck = {
  drillsChecked: number;
  drillsWithDiagram: number;
  drillsWithNonEmptyPlayers: number;
  drillsWithArrows: number;
  drillsWithAnnotations: number;
  drillsWithSafeZones: number;
  issues: string[];
  ok: boolean;
};

function checkDiagramStructure(session: any): DiagramCheck {
  const drills = Array.isArray(session?.drills) ? session.drills : [];
  const nonCooldown = drills.filter((d: any) => d?.drillType !== "COOLDOWN");
  const issues: string[] = [];
  let withDiagram = 0;
  let withPlayers = 0;
  let withArrows = 0;
  let withAnnotations = 0;
  let withSafeZones = 0;

  for (const d of nonCooldown) {
    const diagram = d?.diagram;
    if (!diagram || typeof diagram !== "object") {
      issues.push(`${d?.drillType || "drill"} "${d?.title || "?"}": missing diagram field`);
      continue;
    }
    withDiagram++;
    const players = Array.isArray(diagram.players) ? diagram.players : [];
    if (players.length > 0) withPlayers++;
    else issues.push(`${d?.drillType} "${d?.title}": diagram.players is empty`);
    if (Array.isArray(diagram.arrows) && diagram.arrows.length > 0) withArrows++;
    else issues.push(`${d?.drillType} "${d?.title}": diagram.arrows missing/empty`);
    if (Array.isArray(diagram.annotations) && diagram.annotations.length > 0) withAnnotations++;
    else issues.push(`${d?.drillType} "${d?.title}": diagram.annotations missing/empty`);
    if (Array.isArray(diagram.safeZones) && diagram.safeZones.length > 0) withSafeZones++;
    // safeZones are lower-priority (0-1 allowed for USSF_D) -- not an issue on its own.
  }

  return {
    drillsChecked: nonCooldown.length,
    drillsWithDiagram: withDiagram,
    drillsWithNonEmptyPlayers: withPlayers,
    drillsWithArrows: withArrows,
    drillsWithAnnotations: withAnnotations,
    drillsWithSafeZones: withSafeZones,
    issues,
    ok: nonCooldown.length > 0 && withDiagram === nonCooldown.length && withPlayers === nonCooldown.length,
  };
}

type SampleResult = {
  model: string;
  coachLevel: string;
  playerLevel: string;
  sampleIdx: number;
  latencyMs: number | null;
  latencyOk: boolean | null;
  error: string | null;
  title: string | null;
  summary: string | null;
  firstDrillTitle: string | null;
  firstDrillDescription: string | null;
  firstDrillCoachingPoints: string[];
  diagramCheck: DiagramCheck | null;
  qa: { pass: boolean; scores: Record<string, number>; avg: number | null } | null;
  judge: {
    languageFitCoachLevel: number;
    languageFitPlayerLevel: number;
    coachingSoundness: number;
    overall: number;
    reasoning: string;
    flaggedPhrases: string[];
  } | null;
};

async function runSample(
  model: string,
  coachLevel: string,
  playerLevel: string,
  sampleIdx: number,
  args: Args
): Promise<SampleResult> {
  const base: SampleResult = {
    model,
    coachLevel,
    playerLevel,
    sampleIdx,
    latencyMs: null,
    latencyOk: null,
    error: null,
    title: null,
    summary: null,
    firstDrillTitle: null,
    firstDrillDescription: null,
    firstDrillCoachingPoints: [],
    diagramCheck: null,
    qa: null,
    judge: null,
  };

  try {
    const input: SessionPromptInput = { ...BASE_INPUT, coachLevel, playerLevel };
    const prompt = buildSessionPrompt(input);

    const t0 = Date.now();
    const genText = await generateText(prompt, {
      timeout: 150000,
      retries: 0,
      model,
      fallbackModel: null, // a fallback would silently swap the model under test
    });
    const latencyMs = Date.now() - t0;

    const session = parseJsonSafe(genText);
    if (!session) {
      const cleaned = genText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      let parseErr = "n/a";
      try {
        JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (e: any) {
        parseErr = e?.message || String(e);
      }
      const dumpPath = path.join("/tmp", `session-quality-failure-${Date.now()}.txt`);
      fs.writeFileSync(dumpPath, genText);
      console.error(`[RAW FAILURE] ${model}/${coachLevel}/${playerLevel} -- JSON.parse error: ${parseErr} -- full text dumped to ${dumpPath}`);
      throw new Error("Generation returned non-JSON session");
    }

    base.latencyMs = latencyMs;
    base.latencyOk = latencyMs <= args.latencyTargetMs;
    base.title = session.title || null;
    base.summary = session.summary || null;
    const firstDrill = Array.isArray(session.drills) ? session.drills[0] : null;
    base.firstDrillTitle = firstDrill?.title || null;
    base.firstDrillDescription = firstDrill?.description || null;
    base.firstDrillCoachingPoints = Array.isArray(firstDrill?.coachingPoints) ? firstDrill.coachingPoints : [];
    base.diagramCheck = checkDiagramStructure(session);

    // Production QA reviewer, held to a FIXED model across every sample so
    // its scores are a consistent yardstick, not a second thing under test.
    try {
      const qaPrompt = buildSessionQAReviewerPrompt(session);
      const qaText = await generateText(qaPrompt, {
        timeout: 90000,
        retries: 0,
        model: args.qaModel,
        fallbackModel: null,
      });
      const qaJson = parseJsonSafe(qaText);
      if (qaJson) {
        const scores: Record<string, number> = qaJson.scores || {};
        const vals = Object.values(scores).filter((n) => typeof n === "number") as number[];
        const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        base.qa = { pass: !!qaJson.pass, scores, avg };
      }
    } catch (err: any) {
      console.error(`[QA] failed for ${model}/${coachLevel}/${playerLevel}:`, err?.message || err);
    }

    // Language-fit / coaching-soundness judge.
    try {
      base.judge = await judgeSession({ session, coachLevel, playerLevel, judgeModel: args.judgeModel });
    } catch (err: any) {
      console.error(`[JUDGE] failed for ${model}/${coachLevel}/${playerLevel}:`, err?.message || err);
    }

    return base;
  } catch (err: any) {
    base.error = err?.message || String(err);
    return base;
  }
}

// ---------------------------------------------------------------------------
// Concurrency-limited runner (same pattern as diagram-sandbox.ts)
// ---------------------------------------------------------------------------

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function next(): Promise<void> {
    const i = cursor++;
    if (i >= items.length) return;
    results[i] = await worker(items[i], i);
    return next();
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function round1(n: number | null): string {
  return n == null ? "-" : (Math.round(n * 10) / 10).toFixed(1);
}

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildReportHtml(results: SampleResult[], args: Args): string {
  const byModel = new Map<string, SampleResult[]>();
  for (const r of results) {
    if (!byModel.has(r.model)) byModel.set(r.model, []);
    byModel.get(r.model)!.push(r);
  }

  const modelSummaryRows = args.models
    .map((model) => {
      const rows = (byModel.get(model) || []).filter((r) => !r.error);
      const avg = (fn: (r: SampleResult) => number | null) => {
        const vals = rows.map(fn).filter((n): n is number => n != null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };
      const latencyAvg = avg((r) => r.latencyMs);
      const latencyPassRate = rows.length ? rows.filter((r) => r.latencyOk).length / rows.length : null;
      const qaAvg = avg((r) => r.qa?.avg ?? null);
      const langCoach = avg((r) => r.judge?.languageFitCoachLevel ?? null);
      const langPlayer = avg((r) => r.judge?.languageFitPlayerLevel ?? null);
      const soundness = avg((r) => r.judge?.coachingSoundness ?? null);
      const overall = avg((r) => r.judge?.overall ?? null);
      const diagramRows = rows.filter((r) => r.diagramCheck);
      const diagramPassRate = diagramRows.length ? diagramRows.filter((r) => r.diagramCheck!.ok).length / diagramRows.length : null;
      const errorCount = (byModel.get(model) || []).filter((r) => r.error).length;
      return `<tr>
        <td class="model-name">${esc(model)}</td>
        <td>${latencyAvg == null ? "-" : Math.round(latencyAvg / 100) / 10}s</td>
        <td class="${latencyPassRate != null && latencyPassRate < 1 ? "warn" : ""}">${latencyPassRate == null ? "-" : Math.round(latencyPassRate * 100) + "%"}</td>
        <td class="${diagramPassRate != null && diagramPassRate < 1 ? "warn" : ""}" title="deterministic check: every non-COOLDOWN drill has diagram.players non-empty">${diagramPassRate == null ? "-" : Math.round(diagramPassRate * 100) + "%"}</td>
        <td>${round1(qaAvg)}</td>
        <td>${round1(langCoach)}</td>
        <td>${round1(langPlayer)}</td>
        <td>${round1(soundness)}</td>
        <td class="overall">${round1(overall)}</td>
        <td>${errorCount > 0 ? `<span class="warn">${errorCount} error(s)</span>` : "-"}</td>
      </tr>`;
    })
    .join("\n");

  // Head-to-head: one block per (coachLevel, playerLevel) combo, comparing
  // every model side by side for that exact combo.
  const combos: Array<{ coachLevel: string; playerLevel: string }> = [];
  for (const c of args.coachLevels) for (const p of args.playerLevels) combos.push({ coachLevel: c, playerLevel: p });

  const headToHeadBlocks = combos
    .map(({ coachLevel, playerLevel }) => {
      const cells = args.models
        .map((model) => {
          const sample = results.find((r) => r.model === model && r.coachLevel === coachLevel && r.playerLevel === playerLevel && !r.error);
          if (!sample) {
            const errSample = results.find((r) => r.model === model && r.coachLevel === coachLevel && r.playerLevel === playerLevel);
            return `<div class="h2h-cell">
              <div class="h2h-model">${esc(model)}</div>
              <div class="warn">${esc(errSample?.error || "no sample")}</div>
            </div>`;
          }
          const j = sample.judge;
          return `<div class="h2h-cell">
            <div class="h2h-model">${esc(model)} <span class="latency">${sample.latencyMs == null ? "" : `${Math.round(sample.latencyMs / 100) / 10}s`}</span></div>
            ${j ? `<div class="h2h-scores">
              <span title="language fit for coach level">Coach ${round1(j.languageFitCoachLevel)}</span>
              <span title="language fit for player level">Player ${round1(j.languageFitPlayerLevel)}</span>
              <span title="coaching soundness">Sound ${round1(j.coachingSoundness)}</span>
              <span class="overall" title="overall">Overall ${round1(j.overall)}</span>
            </div>
            <div class="h2h-reasoning">${esc(j.reasoning)}</div>
            ${j.flaggedPhrases?.length ? `<div class="flagged">Flagged: ${j.flaggedPhrases.map((p) => `"${esc(p)}"`).join(", ")}</div>` : ""}` : `<div class="warn">judge failed</div>`}
            <details>
              <summary>Sample text</summary>
              <div class="sample-text"><strong>${esc(sample.title)}</strong><br/>${esc(sample.summary)}<hr/><em>${esc(sample.firstDrillTitle)}</em><br/>${esc(sample.firstDrillDescription)}</div>
            </details>
          </div>`;
        })
        .join("\n");
      return `<section class="combo">
        <h3>${esc(coachLevel)} / ${esc(playerLevel)}</h3>
        <div class="h2h-row">${cells}</div>
      </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Session Quality Sandbox</title>
<style>
  body { font-family: -apple-system, Arial, sans-serif; background: #0b0f14; color: #e6edf3; margin: 0; padding: 24px 32px 80px; }
  h1 { font-size: 22px; }
  h2 { font-size: 16px; color: #9fb3c8; margin-top: 40px; }
  h3 { font-size: 14px; color: #9fb3c8; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  th, td { border: 1px solid #223; padding: 8px 10px; font-size: 13px; text-align: left; }
  th { background: #11161d; color: #9fb3c8; }
  td.model-name { font-weight: 600; }
  td.overall, span.overall { color: #5eead4; font-weight: 700; }
  .warn { color: #f97316; font-weight: 600; }
  .meta { color: #7d8b99; font-size: 12px; margin-bottom: 20px; }
  .combo { border: 1px solid #223; border-radius: 8px; padding: 14px 18px; margin-top: 14px; }
  .h2h-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-top: 10px; }
  .h2h-cell { background: #10151b; border: 1px solid #1c2530; border-radius: 8px; padding: 10px 12px; }
  .h2h-model { font-weight: 700; margin-bottom: 6px; }
  .latency { color: #7d8b99; font-weight: 400; font-size: 11px; }
  .h2h-scores { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #9fb3c8; margin-bottom: 6px; }
  .h2h-reasoning { font-size: 12px; color: #c9d4de; line-height: 1.4; }
  .flagged { font-size: 11px; color: #f97316; margin-top: 6px; }
  details { margin-top: 8px; }
  summary { cursor: pointer; font-size: 11px; color: #5eead4; }
  .sample-text { font-size: 12px; color: #9fb3c8; margin-top: 6px; line-height: 1.4; }
</style>
</head>
<body>
  <h1>Session Quality Sandbox</h1>
  <div class="meta">
    Models: ${esc(args.models.join(", "))} &middot;
    Coach levels: ${esc(args.coachLevels.join(", "))} &middot;
    Player levels: ${esc(args.playerLevels.join(", "))} &middot;
    Judge model: ${esc(args.judgeModel)} &middot;
    QA model: ${esc(args.qaModel)} &middot;
    Latency target: ${args.latencyTargetMs / 1000}s
  </div>

  <h2>Model summary (averaged across all combos)</h2>
  <table>
    <thead><tr>
      <th>Model</th><th>Avg latency</th><th>Latency &le; target</th><th>Diagram structure OK</th><th>QA avg</th>
      <th>Lang fit (coach)</th><th>Lang fit (player)</th><th>Coaching soundness</th><th>Overall</th><th></th>
    </tr></thead>
    <tbody>${modelSummaryRows}</tbody>
  </table>

  <h2>Head-to-head by coach/player level</h2>
  ${headToHeadBlocks}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const combos: Array<{ model: string; coachLevel: string; playerLevel: string; sampleIdx: number }> = [];
  for (const model of args.models) {
    for (const coachLevel of args.coachLevels) {
      for (const playerLevel of args.playerLevels) {
        for (let i = 0; i < args.count; i++) {
          combos.push({ model, coachLevel, playerLevel, sampleIdx: i });
        }
      }
    }
  }

  console.log(
    `Running ${combos.length} samples (${args.models.length} models x ${args.coachLevels.length} coach levels x ${args.playerLevels.length} player levels x ${args.count} count), concurrency=${args.concurrency}...`
  );

  let done = 0;
  const results = await runWithConcurrency(combos, args.concurrency, async (combo) => {
    const r = await runSample(combo.model, combo.coachLevel, combo.playerLevel, combo.sampleIdx, args);
    done++;
    console.log(
      `  ${done}/${combos.length} ${combo.model} / ${combo.coachLevel} / ${combo.playerLevel} -- ${r.error ? "ERROR: " + r.error : `${Math.round((r.latencyMs || 0) / 100) / 10}s, judge overall=${r.judge?.overall ?? "n/a"}`}`
    );
    return r;
  });

  const outDir = args.out || path.join(__dirname, "..", "..", "sandbox-output", `session-quality-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(outDir, "report.html"), buildReportHtml(results, args));

  console.log(`\nErrored: ${results.filter((r) => r.error).length}/${results.length}`);
  console.log(`Open: ${path.join(outDir, "report.html")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
