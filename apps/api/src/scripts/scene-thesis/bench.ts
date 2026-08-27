/**
 * One-shot numbers: current diagram path vs model-XY scene path.
 *
 *   pnpm --filter api sandbox:scene-thesis:bench
 */
import "../../config/load-env";
import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { prisma } from "../../prisma";
import { generateTextWithMetrics, setMetricsContext, clearMetricsContext } from "../../gemini";
import { applyGoalOverlay } from "../../services/goal-overlay";
import { fitDiagramSvgViewBox } from "../../services/fit-diagram-viewbox";
import { computeTokenRadius, scaleFactorFromTokenRadius } from "../../data/field-dimensions";
import { renderDeterministicDiagramSVG } from "../../services/deterministic-drawer-svg";
import { buildSessionPrompt } from "../../prompts/session";
import { buildDrillPrompt } from "../../prompts/drill-optimized-v2";
import { buildDiagramEnrichmentPrompt } from "../../services/diagram-enrichment";
import type { DrawerParams } from "../../types/drawer";
import { compilerParams } from "./compiler";
import { THESIS_IDEAS } from "./ideas";
import { extractScene, promptFor, sceneToDrawerParams } from "./scene";
import { pinGoalsToEnds, snapKeepersToGoals } from "./space";

const INPUT_PER_M = Number(process.env.GEMINI_INPUT_PRICE_PER_1M) || 0.5;
const OUTPUT_PER_M = Number(process.env.GEMINI_OUTPUT_PRICE_PER_1M) || 3;

function paint(params: DrawerParams): string {
  const goals = pinGoalsToEnds(params.goals);
  const snapped = { ...params, goals, players: snapKeepersToGoals(params.players, goals) };
  const tokenRadius =
    typeof snapped.lockTokenRadius === "number" && snapped.lockTokenRadius > 0
      ? snapped.lockTokenRadius
      : computeTokenRadius(snapped.widthYards, snapped.lengthYards, snapped.fieldFormat, snapped.players.length);
  return fitDiagramSvgViewBox(applyGoalOverlay(renderDeterministicDiagramSVG(snapped), snapped.goals, scaleFactorFromTokenRadius(tokenRadius)));
}

function median(ns: number[]): number {
  const s = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function timeMs(fn: () => void, rounds = 25): { median: number; mean: number } {
  fn();
  const samples: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return { median: median(samples), mean: samples.reduce((a, b) => a + b, 0) / samples.length };
}

function costUsd(promptTokens: number, completionTokens: number): number {
  return (promptTokens / 1e6) * INPUT_PER_M + (completionTokens / 1e6) * OUTPUT_PER_M;
}

function latestModelJson(id: string): string | null {
  const root = path.resolve(__dirname, "../../../sandbox-output");
  if (!fs.existsSync(root)) return null;
  const dirs = fs
    .readdirSync(root)
    .filter((d) => d.startsWith("scene-thesis-"))
    .sort()
    .reverse();
  for (const d of dirs) {
    const p = path.join(root, d, `${id}.model.json`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function metricsByType() {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const rows = await prisma.apiMetrics.groupBy({
    by: ["operationType"],
    where: { createdAt: { gte: since }, success: true, durationMs: { gt: 50 } },
    _count: { _all: true },
    _avg: { durationMs: true, promptTokens: true, completionTokens: true, promptLength: true, responseLength: true },
  });
  return rows.map((r) => ({
    type: r.operationType,
    n: r._count._all,
    ms: Math.round(r._avg.durationMs || 0),
    inTok: Math.round(r._avg.promptTokens || 0),
    outTok: Math.round(r._avg.completionTokens || 0),
    inChars: Math.round(r._avg.promptLength || 0),
    outChars: Math.round(r._avg.responseLength || 0),
  }));
}

async function main() {
  const ideas = THESIS_IDEAS.filter((i) => ["new-overlap", "new-3v2", "new-cutback", "c-switch", "c-press-unit"].includes(i.id));
  const cpu: Array<{ id: string; compilerMs: number; scenePaintMs: number; players: number }> = [];
  for (const idea of ideas) {
    const compiler = compilerParams(idea);
    const c = timeMs(() => {
      paint(compiler);
    });
    const jsonPath = latestModelJson(idea.id);
    let scenePaint = { median: NaN, mean: NaN };
    let players = compiler.players.length;
    if (jsonPath) {
      const scene = extractScene(fs.readFileSync(jsonPath, "utf8"));
      const params = sceneToDrawerParams(idea, scene);
      players = params.players.length;
      scenePaint = timeMs(() => {
        paint(params);
      });
    }
    cpu.push({ id: idea.id, compilerMs: c.median, scenePaintMs: scenePaint.median, players });
  }

  const overlap = THESIS_IDEAS.find((i) => i.id === "new-overlap")!;
  const sessionPrompt = buildSessionPrompt({
    gameModelId: "POSSESSION",
    ageGroup: "U12",
    phase: "ATTACKING",
    zone: "ATTACKING_THIRD",
    numbersMin: 8,
    numbersMax: 12,
    goalsAvailable: 1,
    spaceConstraint: "HALF",
    durationMin: 90,
    formationAttacking: "2-3-1",
    formationDefending: "3-2-1",
    playerLevel: "INTERMEDIATE",
    coachLevel: "USSF_C",
    panelLessons: null,
  });
  const drillPrompt = buildDrillPrompt({
    gameModelId: "POSSESSION",
    ageGroup: "U12",
    phase: "ATTACKING",
    zone: "ATTACKING_THIRD",
    numbersMin: 8,
    numbersMax: 12,
    goalsAvailable: 1,
    spaceConstraint: "HALF",
    durationMin: 20,
    formationAttacking: "2-1",
    formationDefending: "1-1",
    playerLevel: "INTERMEDIATE",
    coachLevel: "USSF_C",
    fieldFormat: "9V9",
    drillType: "TECHNICAL",
  } as any);
  const scenePrompt = promptFor(overlap);
  const enrichPrompt = buildDiagramEnrichmentPrompt({
    title: overlap.title,
    drillType: overlap.drillType,
    coachingPoints: ["Overlap on the right flank"],
    setupSteps: ["2v1 channel", "one full goal"],
    description: overlap.card,
    diagram: { players: [{ x: 50, y: 50 }], arrows: [], annotations: [] },
  });

  setMetricsContext({ operationType: "scene_thesis" });
  let live: { durationMs: number; promptTokens: number | null; completionTokens: number | null; promptLength: number; responseLength: number | null } | null =
    null;
  try {
    const t0 = performance.now();
    const result = await generateTextWithMetrics(scenePrompt, {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      timeout: 60000,
    });
    live = {
      durationMs: result.durationMs,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      promptLength: scenePrompt.length,
      responseLength: result.text.length,
    };
    console.log(`[bench] live scene generate ${Math.round(performance.now() - t0)}ms wall`);
  } finally {
    clearMetricsContext();
  }

  let db: Awaited<ReturnType<typeof metricsByType>> = [];
  try {
    db = await metricsByType();
  } catch (err) {
    console.warn("[bench] metrics query failed:", err instanceof Error ? err.message : err);
  }

  const report = {
    paintCpuMsMedian: cpu,
    promptChars: {
      sceneXy: scenePrompt.length,
      diagramEnrichment: enrichPrompt.length,
      oneDrillGenerate: drillPrompt.length,
      fullSessionGenerate: sessionPrompt.length,
    },
    liveSceneGenerate: live,
    liveSceneCostUsd:
      live && live.promptTokens && live.completionTokens ? costUsd(live.promptTokens, live.completionTokens) : null,
    dbLast14d: db,
    notes: {
      paint: "Same SVG painter both paths. Median of 25 runs after warmup.",
      currentPicture:
        "Today a diagram is a side-effect of session/drill JSON + optional enrichment, then drillToDrawerParams.",
      newPicture: "One Flash Lite JSON of object XY, then the same painter. No compiler.",
      price: `$${INPUT_PER_M}/1M in · $${OUTPUT_PER_M}/1M out (admin defaults / lite).`,
    },
  };

  const outDir = path.resolve(__dirname, "../../../sandbox-output", `scene-thesis-bench-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "bench.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
