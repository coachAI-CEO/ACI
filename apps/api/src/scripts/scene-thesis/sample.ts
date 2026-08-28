/**
 * Scene-XY diagram sampler.
 *
 * Stratified batch through the REAL generation path now that new sessions
 * draw with scene XY:
 *   drill prompt  →  real drill JSON  →  buildSceneCard  →  Flash Lite object XY
 *                 →  sceneToDrawerParams  →  same TE SVG painter
 * Then the unified frozen scorer (score.ts, shared with compare.ts) grades
 * each picture and an HTML contact sheet + results.json land in sandbox-output/.
 *
 * Two Gemini calls per sample (drill + scene). No DB writes, no QA pass.
 *
 *   pnpm --filter api sandbox:scene-sample -- --count 12 --concurrency 2
 *   pnpm --filter api sandbox:scene-sample -- --profile 9v9 --count 6
 */
import "../../config/load-env";
import fs from "fs";
import path from "path";
import { generateText } from "../../gemini";
import { buildDrillPrompt, type DrillPromptInput } from "../../prompts/drill-optimized-v2";
import { sanitizeDrillOutput } from "../../services/drill";
import { applyYouthGuards } from "../../services/youth-guards";
import { postProcessDrill } from "../../services/postprocess";
import { enforceDiagramGoalAvailability } from "../../services/diagram-goals";
import { buildSceneCard, isWorkingGroupDrill, type SceneDrillLike } from "../../services/scene-card";
import {
  extractScene,
  promptForScene,
  sceneToDrawerParams,
  type SceneDiagram,
  type SceneCard,
} from "../../services/scene-document";
import { applyGoalOverlay } from "../../services/goal-overlay";
import { fitDiagramSvgViewBox } from "../../services/fit-diagram-viewbox";
import { renderDeterministicDiagramSVG } from "../../services/deterministic-drawer-svg";
import { computeTokenRadius, scaleFactorFromTokenRadius, type FieldFormat } from "../../data/field-dimensions";
import { pinGoalsToEnds, snapKeepersToGoals } from "../../services/scene-space";
import type { DrawerParams } from "../../types/drawer";
import { frozenConfidence, scoreScene, type SceneExpectation, type SceneScores } from "./score";
import { judgeSceneVisual, type JudgeIdea } from "./judge";
import type { VisualQaResult } from "../first-pass-diagrams/visual-qa";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

const args = {
  count: Math.max(1, Number(argValue("--count") || 12) || 12),
  concurrency: Math.max(1, Number(argValue("--concurrency") || 2) || 2),
  seed: Number(argValue("--seed") || 0) || 0,
  profile: argValue("--profile"),
  out: argValue("--out"),
  // PNG visual judge (extra Gemini call per sample). macOS only (qlmanage).
  visual: process.argv.includes("--visual"),
};

// ---------------------------------------------------------------------------
// Stratified sample matrix (mirrors diagram-sandbox.ts — format/formation
// dimensions are what stress the picture; content dimensions vary freely).
// ---------------------------------------------------------------------------

type FormatProfile = {
  label: string;
  numbersMin: number;
  numbersMax: number;
  formationAttacking: string;
  formationDefending: string;
  goalsAvailable: number;
  fieldFormat: FieldFormat;
};

const FORMAT_PROFILES: FormatProfile[] = [
  { label: "unopposed/rondo (6-8)", numbersMin: 6, numbersMax: 8, formationAttacking: "3-1", formationDefending: "2-1", goalsAvailable: 0, fieldFormat: "7V7" },
  { label: "small-sided 4v4 (2 mini goals)", numbersMin: 8, numbersMax: 10, formationAttacking: "2-2", formationDefending: "2-2", goalsAvailable: 2, fieldFormat: "7V7" },
  { label: "7v7", numbersMin: 12, numbersMax: 14, formationAttacking: "2-3-1", formationDefending: "3-2-1", goalsAvailable: 1, fieldFormat: "7V7" },
  { label: "9v9", numbersMin: 16, numbersMax: 18, formationAttacking: "3-2-3", formationDefending: "3-3-2", goalsAvailable: 1, fieldFormat: "9V9" },
  { label: "11v11", numbersMin: 20, numbersMax: 22, formationAttacking: "4-3-3", formationDefending: "4-4-2", goalsAvailable: 1, fieldFormat: "11V11" },
  { label: "one full goal + 2 mini goals", numbersMin: 12, numbersMax: 14, formationAttacking: "2-3-1", formationDefending: "3-2-1", goalsAvailable: 1, fieldFormat: "7V7" },
  { label: "conditioned game, two full goals", numbersMin: 16, numbersMax: 18, formationAttacking: "3-2-3", formationDefending: "3-3-2", goalsAvailable: 2, fieldFormat: "9V9" },
];

const gameModels = ["POSSESSION", "PRESSING", "TRANSITION", "COACHAI", "ROCKLIN_FC"];
const ageGroups = ["U10", "U11", "U12", "U13", "U14", "U15"];
const phases = ["ATTACKING", "DEFENDING", "TRANSITION"];
const zones = ["DEFENSIVE_THIRD", "MIDDLE_THIRD", "ATTACKING_THIRD"];
const drillTypes = ["TECHNICAL", "TACTICAL", "CONDITIONED_GAME", "FULL_GAME"];
const playerLevels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const coachLevels = ["USSF_D", "USSF_C", "USSF_B_PLUS"];
const spaceConstraints = ["THIRD", "HALF", "FULL", "QUARTER"];
const durations = [60, 90];

function pick<T>(list: T[], seed: number): T {
  return list[((seed % list.length) + list.length) % list.length];
}

function buildInput(seed: number, pool: FormatProfile[]): { input: DrillPromptInput; profileLabel: string } {
  const profile = pick(pool, seed);
  return {
    profileLabel: profile.label,
    input: {
      gameModelId: pick(gameModels, seed + 1),
      ageGroup: pick(ageGroups, seed + 2),
      phase: pick(phases, seed + 3),
      zone: pick(zones, seed + 4),
      drillType: pick(drillTypes, seed + 5),
      numbersMin: profile.numbersMin,
      numbersMax: profile.numbersMax,
      goalsAvailable: profile.goalsAvailable,
      fieldFormat: profile.fieldFormat,
      spaceConstraint: pick(spaceConstraints, seed + 6),
      durationMin: pick(durations, seed + 7),
      formationAttacking: profile.formationAttacking,
      formationDefending: profile.formationDefending,
      playerLevel: pick(playerLevels, seed + 8),
      coachLevel: pick(coachLevels, seed + 9),
    },
  };
}

// ---------------------------------------------------------------------------
// Generation (drill JSON, then scene XY) — no DB, no QA
// ---------------------------------------------------------------------------

function parseJsonSafe(text: string): any {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    if (a === -1 || b === -1) return null;
    return JSON.parse(cleaned.substring(a, b + 1));
  } catch {
    return null;
  }
}

async function generateDrill(input: DrillPromptInput): Promise<any> {
  const text = await generateText(buildDrillPrompt(input), {
    timeout: Number(process.env.SANDBOX_GEN_TIMEOUT_MS || 45000),
    retries: Number(process.env.GEMINI_MAX_RETRIES ?? 1),
    model: process.env.GEMINI_DRILL_MODEL || process.env.GEMINI_GENERATION_MODEL,
  });
  const parsed = parseJsonSafe(text);
  if (!parsed) throw new Error("drill model returned non-JSON");
  const { drill } = sanitizeDrillOutput(parsed);
  applyYouthGuards(drill, input);
  let processed: any = {};
  try {
    processed = postProcessDrill({ json: drill }, input);
  } catch (err: any) {
    console.error(`  [postprocess] ${err?.message || err}`);
  }
  const json = processed?.json || drill;
  // Production runs this before drawing — it sets json.goalsAvailable/goalMode
  // that buildSceneCard reads. It also mutates json.diagram, which scene XY
  // ignores; harmless here.
  try {
    enforceDiagramGoalAvailability(json, input);
  } catch (err: any) {
    console.error(`  [goal-enforce] ${err?.message || err}`);
  }
  return json;
}

function drillLikeFrom(json: any, input: DrillPromptInput): SceneDrillLike {
  return {
    title: json.title || "Drill",
    json,
    drillType: input.drillType,
    durationMin: Number(json.durationMin ?? input.durationMin ?? 20),
    rpeMin: Number(json.rpeMin ?? 4),
    rpeMax: Number(json.rpeMax ?? 7),
    numbersMin: input.numbersMin,
    numbersMax: input.numbersMax,
    spaceConstraint: input.spaceConstraint,
    formationUsed: input.formationAttacking,
    phase: input.phase,
    zone: input.zone,
    coachLevel: input.coachLevel,
    goalsAvailable: Number(json.goalsAvailable ?? input.goalsAvailable ?? 0),
  };
}

function paint(params: DrawerParams): string {
  const goals = pinGoalsToEnds(params.goals);
  const snapped = { ...params, goals, players: snapKeepersToGoals(params.players, goals) };
  const tokenRadius =
    typeof snapped.lockTokenRadius === "number" && snapped.lockTokenRadius > 0
      ? snapped.lockTokenRadius
      : computeTokenRadius(snapped.widthYards, snapped.lengthYards, snapped.fieldFormat, snapped.players.length);
  return fitDiagramSvgViewBox(
    applyGoalOverlay(renderDeterministicDiagramSVG(snapped), snapped.goals, scaleFactorFromTokenRadius(tokenRadius))
  );
}

async function generateScene(card: SceneCard): Promise<SceneDiagram> {
  const model = process.env.GEMINI_SCENE_MODEL || "gemini-3.5-flash-lite";
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateText(promptForScene(card), {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        timeout: 60000,
        model,
      });
      return extractScene(raw);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function expectationFrom(card: SceneCard, drillLike: SceneDrillLike, scene: SceneDiagram): SceneExpectation {
  const goalsAvailable = Number(drillLike.goalsAvailable ?? 0);
  const workingGroup = isWorkingGroupDrill(String(drillLike.drillType));
  const numbersMax = Number(drillLike.numbersMax ?? 14);
  return {
    picture: card.picture,
    goalsAvailable: Number.isFinite(goalsAvailable) ? goalsAvailable : 0,
    keepers: !workingGroup && goalsAvailable >= 1,
    outfieldPerSide: workingGroup ? 0 : Math.round(Math.max(4, numbersMax) / 2) - (goalsAvailable >= 1 ? 1 : 0),
    coachLevel: drillLike.coachLevel ?? undefined,
    workingGroup,
    rawArrowCount: Array.isArray(scene.arrows) ? scene.arrows.length : undefined,
  };
}

// ---------------------------------------------------------------------------
// Records + report
// ---------------------------------------------------------------------------

type SampleRecord = {
  idx: number;
  profileLabel: string;
  input: DrillPromptInput;
  title: string | null;
  card: string | null;
  note: string | null;
  players: number;
  pass: boolean;
  scores: SceneScores | null;
  confidence: number | null;
  issues: string[];
  visual: VisualQaResult | null;
  svg: string | null;
  durationMs: number;
  error: string | null;
};

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function next(): Promise<void> {
    const i = cursor++;
    if (i >= items.length) return;
    out[i] = await worker(items[i], i);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return out;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function badge(ok: boolean, label: string): string {
  const c = ok ? "#16a34a" : "#dc2626";
  const bg = ok ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.15)";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:${c};background:${bg};border:1px solid ${c};margin:2px 4px 2px 0;">${ok ? "PASS" : "FAIL"} ${label}</span>`;
}

function reportHtml(records: SampleRecord[], model: string): string {
  const total = records.length;
  const errored = records.filter((r) => r.error).length;
  const passed = records.filter((r) => !r.error && r.pass).length;
  const cards = records
    .map((r) => {
      if (r.error) {
        return `<article class="card err"><h2>#${r.idx} — ${esc(r.profileLabel)}</h2><pre class="e">${esc(r.error)}</pre><pre class="i">${esc(JSON.stringify(r.input, null, 2))}</pre></article>`;
      }
      const s = r.scores!;
      const badges = Object.entries(s).map(([k, v]) => badge(v.ok, k)).join("");
      const issues = r.issues.length
        ? `<ul class="issues">${r.issues.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
        : `<p class="ok">No issues from the frozen checks.</p>`;
      const v = r.visual;
      const visualHtml = v
        ? `<p class="visual ${v.verdict}">JUDGE ${v.verdict.toUpperCase()} · ${v.confidence} — ${esc(v.summary)}</p>${
            v.issues.length ? `<ul class="issues">${v.issues.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""
          }`
        : "";
      return `<article class="card ${r.pass ? "pass" : "fail"}">
  <h2>#${r.idx} — ${esc(r.title || "Untitled")} <span class="tag">${r.pass ? "PASS" : "FAIL"} · ${r.confidence}${
        v ? ` · judge ${v.confidence}` : ""
      }</span></h2>
  <p class="meta">${esc(r.profileLabel)} · ${esc(r.input.drillType)} · ${esc(r.input.gameModelId)} · ${esc(r.input.ageGroup)} · ${esc(r.input.coachLevel)} · ${esc(r.input.spaceConstraint)} · ${r.players} shirts · ${r.durationMs}ms</p>
  <div class="svg">${r.svg}</div>
  <div class="badges">${badges}</div>
  ${visualHtml}
  ${issues}
  ${r.note ? `<p class="note"><span>on the figure</span> ${esc(r.note)}</p>` : ""}
  <details><summary>Scene card sent to the model</summary><pre class="card-text">${esc(r.card || "")}</pre></details>
</article>`;
    })
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Scene-XY diagram sample</title><style>
  body{background:#060a13;color:#e2e8f0;font:14px/1.5 -apple-system,system-ui,sans-serif;margin:0;padding:28px}
  h1{font-size:20px;margin:0 0 4px}h1 span{color:#34d399}
  .lede{color:#94a3b8;margin:0 0 20px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:16px}
  .card{background:#0a0f1a;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:16px}
  .card.pass{border-color:rgba(22,163,74,0.4)}.card.fail{border-color:rgba(220,38,38,0.4)}.card.err{border-color:rgba(234,179,8,0.5)}
  h2{font-size:14px;margin:0 0 6px}.tag{float:right;font-size:11px;color:#94a3b8}
  .meta{color:#64748b;font-size:12px;margin:0 0 8px}
  .svg svg{width:100%;height:auto;background:#08111f;border-radius:10px;border:1px solid rgba(255,255,255,0.06)}
  .badges{margin:8px 0}
  .issues{margin:6px 0 0;padding-left:18px;color:#fca5a5;font-size:12px}
  .ok{color:#4ade80;font-size:12px}
  .note{color:#6ee7b7;font-size:12px}.note span{color:#64748b;text-transform:uppercase;font-size:10px;letter-spacing:.06em;margin-right:6px}
  .visual{font-size:12px;font-weight:700;margin:6px 0 0}
  .visual.pass{color:#34d399}.visual.review{color:#fbbf24}.visual.fail{color:#f87171}
  details{margin-top:8px}summary{cursor:pointer;color:#93c5fd;font-size:12px}
  .card-text{white-space:pre-wrap;background:#08111f;border-radius:8px;padding:10px;font-size:12px;color:#cbd5e1}
  .e{color:#fca5a5;white-space:pre-wrap;font-size:12px}.i{color:#64748b;font-size:11px;white-space:pre-wrap;max-height:160px;overflow:auto}
</style></head><body>
<h1>Tactical<span>Edge</span> scene-XY sample</h1>
<p class="lede"><b>${total}</b> samples · <b style="color:#4ade80">${passed} pass</b> · <b style="color:#f87171">${total - errored - passed} fail</b> · <b style="color:#facc15">${errored} error</b> · model ${esc(model)}</p>
<div class="grid">${cards}</div>
</body></html>`;
}

function printSummary(records: SampleRecord[]) {
  const scored = records.filter((r) => !r.error && r.scores);
  console.log("\n=== Scene-XY sample summary ===");
  console.log(`Total:   ${records.length}`);
  console.log(`Errored: ${records.filter((r) => r.error).length}`);
  console.log(`Passed:  ${scored.filter((r) => r.pass).length}/${scored.length}`);
  const keys = scored[0]?.scores ? Object.keys(scored[0].scores) : [];
  console.log("\nPer-check pass rate:");
  for (const k of keys) {
    const ok = scored.filter((r) => (r.scores as any)[k].ok).length;
    console.log(`  ${k.padEnd(12)} ${ok}/${scored.length}`);
  }
  const judged = scored.filter((r) => r.visual);
  if (judged.length) {
    const jp = judged.filter((r) => r.visual!.verdict === "pass").length;
    const jr = judged.filter((r) => r.visual!.verdict === "review").length;
    console.log(`\nVisual judge:  ${jp} pass · ${jr} review · ${judged.length - jp - jr} fail  (of ${judged.length})`);
  }
  for (const r of records.filter((r) => r.error)) console.log(`  ERROR #${r.idx} (${r.profileLabel}): ${r.error}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let pool = FORMAT_PROFILES;
  if (args.profile) {
    const needle = args.profile.toLowerCase();
    pool = FORMAT_PROFILES.filter((p) => p.label.toLowerCase().includes(needle));
    if (!pool.length) {
      console.error(`No profile matches "${args.profile}". Have: ${FORMAT_PROFILES.map((p) => p.label).join(", ")}`);
      process.exit(1);
    }
  }
  const samples = Array.from({ length: args.count }, (_, i) => buildInput(args.seed + i, pool));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = args.out || path.resolve(__dirname, "../../../sandbox-output", `scene-sample-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });
  const model = process.env.GEMINI_SCENE_MODEL || "gemini-3.5-flash-lite";
  console.log(
    `Scene-XY sample: ${samples.length} drills, concurrency ${args.concurrency}` +
      `${args.visual ? " · visual judge ON" : ""}\nOutput: ${outDir}\n`
  );

  let done = 0;
  const records = await runWithConcurrency(samples, args.concurrency, async ({ input, profileLabel }, idx): Promise<SampleRecord> => {
    const startedAt = Date.now();
    try {
      const json = await generateDrill(input);
      const drillLike = drillLikeFrom(json, input);
      const card = buildSceneCard(drillLike);
      const scene = await generateScene(card);
      const params = sceneToDrawerParams(card, scene);
      const exp = expectationFrom(card, drillLike, scene);
      const { pass, scores, issues } = scoreScene(params, exp);
      const svg = paint(params);
      const tag = String(idx).padStart(2, "0");
      fs.writeFileSync(path.join(outDir, `${tag}.scene.json`), JSON.stringify(scene, null, 2));

      let visual: VisualQaResult | null = null;
      if (args.visual) {
        const judgeIdea: JudgeIdea = {
          id: tag,
          title: card.title,
          card: card.card,
          picture: card.picture,
          coachLevel: card.coachLevel as JudgeIdea["coachLevel"],
          outfieldPerSide: exp.outfieldPerSide,
          keepers: exp.keepers,
          fieldFormat: card.fieldFormat,
        };
        try {
          visual = await judgeSceneVisual({ svg, idea: judgeIdea, params, outDir, tag: "model", frozenIssues: issues });
        } catch (err: any) {
          visual = { confidence: 0, verdict: "review", issues: [`judge failed: ${err?.message || err}`], summary: "" };
        }
      }
      process.stdout.write(`\r  ${++done}/${samples.length}`);
      return {
        idx, profileLabel, input,
        title: card.title, card: card.card, note: null,
        players: params.players.length, pass, scores,
        confidence: frozenConfidence(scores), issues, visual, svg,
        durationMs: Date.now() - startedAt, error: null,
      };
    } catch (err: any) {
      process.stdout.write(`\r  ${++done}/${samples.length}`);
      return {
        idx, profileLabel, input, title: null, card: null, note: null, players: 0,
        pass: false, scores: null, confidence: null, issues: [], visual: null, svg: null,
        durationMs: Date.now() - startedAt, error: err?.message || String(err),
      };
    }
  });

  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(records.map(({ svg: _s, ...r }) => r), null, 2));
  fs.writeFileSync(path.join(outDir, "report.html"), reportHtml(records, model));
  printSummary(records);
  console.log(`\nOpen: ${path.join(outDir, "report.html")}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("scene sample failed:", err);
    process.exit(1);
  });
