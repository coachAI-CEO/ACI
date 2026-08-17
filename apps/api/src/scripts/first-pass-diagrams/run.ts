import "../../config/load-env";
import fs from "fs";
import path from "path";
import { enforceDiagramGoalAvailability } from "../../services/diagram-goals";
import { drillToDrawerParams } from "../../mappers/drill-to-drawer-params";
import { renderDeterministicDiagramSVG } from "../../services/deterministic-drawer-svg";
import { applyGoalOverlay } from "../../services/goal-overlay";
import { fitDiagramSvgViewBox } from "../../services/fit-diagram-viewbox";
import { computeTokenRadius, matchupWithKeepers, scaleFactorFromTokenRadius } from "../../data/field-dimensions";
import { fixturesForScene } from "./fixtures";
import { PROMPT_PACK_NAMES, type PromptPackName } from "./prompt-packs";
import { renderSvgPreview } from "./preview";
import { frozenConfidence, judgeDiagramVisual, sceneConfidence, type VisualQaResult } from "./visual-qa";
import { scoreFirstPass } from "./score";
import { generateDrillJson } from "./generate-drill";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  const next = index === -1 ? undefined : process.argv[index + 1];
  if (!next || next.startsWith("--")) return undefined;
  return next;
}

function optionalArgNumber(flag: string, whenPresentDefault: number): number | undefined {
  if (!hasFlag(flag)) return undefined;
  const raw = argValue(flag);
  if (raw && /^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return whenPresentDefault;
}

function compileSvg(drillLike: Record<string, unknown>): string {
  const params = drillToDrawerParams(drillLike as any);
  const scale = scaleFactorFromTokenRadius(
    computeTokenRadius(params.widthYards, params.lengthYards, params.fieldFormat, params.players.length)
  );
  return fitDiagramSvgViewBox(applyGoalOverlay(renderDeterministicDiagramSVG(params), params.goals, scale));
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function matchupLabel(params: { players: Array<{ team: string }> }): string {
  const att = params.players.filter((p) => p.team === "home").length;
  const def = params.players.filter((p) => p.team === "away").length;
  const neu = params.players.filter((p) => p.team === "neutral").length;
  const gk = params.players.filter((p) => p.team === "gk").length;
  return matchupWithKeepers(att, def, gk, neu);
}

function visualColor(visual: VisualQaResult | null | undefined, pass: boolean): string {
  if (!visual) return pass ? "#16a34a" : "#dc2626";
  if (visual.verdict === "pass") return "#16a34a";
  if (visual.verdict === "review") return "#f59e0b";
  return "#dc2626";
}

type Row = {
  id: string;
  label: string;
  pass: boolean;
  frozenPass: boolean;
  frozenScore: number;
  issues: string[];
  svg: string | null;
  error: string | null;
  durationMs: number;
  playerCount: number;
  matchup: string;
  pack: PromptPackName;
  rounds: number;
  visual: VisualQaResult | null;
};

function reportHtml(rows: Row[], meta: { scene: string; visual: boolean; target: number | null; confidence: number }): string {
  const passed = rows.filter((r) => r.pass).length;
  const conf = meta.visual ? `${meta.confidence}/100 visual confidence` : `${passed}/${rows.length} frozen pass`;
  const target = meta.target != null ? ` · target ${meta.target}` : "";
  const cards = rows
    .map((r) => {
      const tag = r.error
        ? "ERROR"
        : r.visual
          ? `${r.visual.verdict.toUpperCase()} ${r.visual.confidence}`
          : r.pass
            ? "PASS"
            : "FAIL";
      const color = r.error ? "#f59e0b" : visualColor(r.visual, r.pass);
      const visualBlock = r.visual
        ? `<p style="color:#cbd5e1;font-size:13px">${escapeHtml(r.visual.summary)}</p>
           ${r.visual.issues.length ? `<ul class="issues">${r.visual.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : ""}`
        : "";
      const issues = r.issues.length
        ? `<p style="color:#94a3b8;font-size:11px;margin:8px 0 0">Frozen: ${r.issues.map(escapeHtml).join("; ")}</p>`
        : "";
      return `<section style="margin:0 0 32px;padding:16px;border:1px solid #334155;border-radius:12px;background:#0f172a">
        <h2 style="margin:0 0 8px;font-size:16px">${escapeHtml(r.id)} — ${escapeHtml(r.label)}
          <span style="color:${color};font-size:12px;margin-left:8px">${tag}</span>
        </h2>
        <p style="color:#94a3b8;font-size:12px">${r.matchup ? `${escapeHtml(r.matchup)} · ` : ""}${r.playerCount} players · pack ${r.pack} · ${r.rounds} round${r.rounds === 1 ? "" : "s"} · ${r.durationMs}ms</p>
        ${r.error ? `<pre style="color:#fbbf24">${escapeHtml(r.error)}</pre>` : ""}
        ${visualBlock}
        ${issues}
        ${r.svg ? r.svg : ""}
      </section>`;
    })
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>First-pass diagrams ${escapeHtml(meta.scene)}</title>
    <style>body{font-family:Arial,sans-serif;background:#020617;color:#e2e8f0;padding:24px;max-width:900px;margin:0 auto}
    svg{width:100%;height:auto;display:block;background:#08111f;border-radius:12px}
    .issues{color:#fca5a5}</style></head>
    <body><h1>First-pass diagrams — scene ${escapeHtml(meta.scene)}</h1>
    <p>${conf}${target} · ${passed}/${rows.length} cards at target · visual QA is the pass, frozen schema is supporting</p>
    ${cards}</body></html>`;
}

function cardPasses(args: { frozenPass: boolean; visual: VisualQaResult | null; visualOn: boolean; target: number | null }): boolean {
  if (!args.visualOn) return args.frozenPass;
  if (!args.visual) return false;
  const floor = args.target ?? 75;
  return args.visual.confidence >= floor && args.visual.verdict !== "fail";
}

async function compileAndJudge(args: {
  fixture: FirstPassFixture;
  json: any;
  outDir: string;
  visualOn: boolean;
  pack: PromptPackName;
}): Promise<{
  params: ReturnType<typeof drillToDrawerParams>;
  svg: string;
  scored: ReturnType<typeof scoreFirstPass>;
  visual: VisualQaResult | null;
}> {
  args.json.spaceConstraint = args.fixture.input.spaceConstraint;
  args.json.fieldFormat = args.fixture.input.fieldFormat;
  args.json.goalsAvailable = args.fixture.input.goalsAvailable;
  args.json.drillType = args.fixture.input.drillType;
  enforceDiagramGoalAvailability(args.json, args.fixture.input);
  const drillLike = {
    title: String(args.json.title || args.fixture.label),
    json: args.json,
    drillType: args.fixture.input.drillType,
    durationMin: args.fixture.input.durationMin ?? 20,
    rpeMin: 4,
    rpeMax: 7,
    numbersMin: args.fixture.input.numbersMin,
    numbersMax: args.fixture.input.numbersMax,
    spaceConstraint: args.fixture.input.spaceConstraint,
  };
  const params = drillToDrawerParams(drillLike as any);
  const svg = compileSvg(drillLike);
  const scored = scoreFirstPass({ json: args.json, params, svg, fixture: args.fixture });
  fs.writeFileSync(path.join(args.outDir, `${args.fixture.id}.svg`), svg);
  fs.writeFileSync(path.join(args.outDir, `${args.fixture.id}.json`), JSON.stringify(args.json, null, 2));

  let visual: VisualQaResult | null = null;
  if (args.visualOn) {
    const previewDir = path.join(args.outDir, "preview");
    const svgPath = path.join(args.outDir, `${args.fixture.id}.svg`);
    const pngPath = renderSvgPreview(svgPath, previewDir);
    if (!pngPath) {
      visual = {
        confidence: frozenConfidence(scored.scores),
        verdict: scored.pass ? "review" : "fail",
        issues: ["could not render PNG preview (qlmanage)"],
        summary: "Fell back to frozen checks; no visual judge.",
      };
    } else {
      visual = await judgeDiagramVisual({
        pngPath,
        fixture: args.fixture,
        params,
        frozenIssues: scored.issues,
      });
    }
  }
  return { params, svg, scored, visual };
}

async function main() {
  const scene = argValue("--scene") || "A";
  const only = (argValue("--only") || "")
    .split(",")
    .map((id) => id.trim().toUpperCase())
    .filter(Boolean);
  const fixtures = fixturesForScene(scene).filter((f) => only.length === 0 || only.includes(f.id));
  if (fixtures.length === 0) {
    console.error(`No fixtures for scene "${scene}"${only.length ? ` with --only ${only.join(",")}` : ""}. Use A, B, C, D, or ALL.`);
    process.exit(1);
  }
  const replayDir = argValue("--replay");
  const visualOn = !hasFlag("--no-visual");
  const target = optionalArgNumber("--until-confidence", 75) ?? null;
  const maxRounds = Math.max(1, optionalArgNumber("--max-rounds", 3) ?? (target != null ? 3 : 1));
  const startPack = (argValue("--pack") as PromptPackName | undefined) || "base";
  const startPackIndex = Math.max(0, PROMPT_PACK_NAMES.indexOf(startPack));
  const outDir =
    argValue("--out") ||
    (replayDir
      ? replayDir
      : path.join(__dirname, "..", "..", "..", "sandbox-output", `first-pass-${scene}-${new Date().toISOString().replace(/[:.]/g, "-")}`));
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`Scene ${scene}: ${fixtures.map((f) => f.id).join(", ")}`);
  console.log(`${replayDir ? "Replay" : "Output"} ${outDir}`);
  console.log(
    visualOn
      ? `Visual QA on${target != null ? ` · loop until ${target} confidence · max ${maxRounds} rounds` : " · one pass"}`
      : "Visual QA off (--no-visual)"
  );

  const rows: Row[] = [];
  for (const fixture of fixtures) {
    const started = Date.now();
    process.stdout.write(`  ${fixture.id} ${fixture.label} ... `);
    try {
      let best: Awaited<ReturnType<typeof compileAndJudge>> | null = null;
      let bestPack: PromptPackName = startPack;
      let rounds = 0;
      const replayPath = replayDir ? path.join(replayDir, `${fixture.id}.json`) : null;
      const canReplayFirst = Boolean(replayPath && fs.existsSync(replayPath));

      for (let round = 0; round < maxRounds; round++) {
        const pack = PROMPT_PACK_NAMES[Math.min(startPackIndex + round, PROMPT_PACK_NAMES.length - 1)];
        const json =
          round === 0 && canReplayFirst
            ? JSON.parse(fs.readFileSync(replayPath!, "utf8"))
            : await generateDrillJson(fixture, pack);
        const judged = await compileAndJudge({ fixture, json, outDir, visualOn, pack });
        rounds = round + 1;
        const score = judged.visual?.confidence ?? (judged.scored.pass ? 100 : 0);
        const bestScore = best?.visual?.confidence ?? (best?.scored.pass ? 100 : -1);
        if (!best || score >= bestScore) {
          best = judged;
          bestPack = pack;
          fs.writeFileSync(path.join(outDir, `${fixture.id}.svg`), judged.svg);
          fs.writeFileSync(path.join(outDir, `${fixture.id}.json`), JSON.stringify(json, null, 2));
        }
        const conf = judged.visual ? `${judged.visual.verdict} ${judged.visual.confidence}` : judged.scored.pass ? "PASS" : "FAIL";
        process.stdout.write(round === 0 ? `${conf}` : ` → ${pack} ${conf}`);
        const goodEnough =
          target == null
            ? true
            : visualOn
              ? (judged.visual?.confidence ?? 0) >= target && judged.visual?.verdict !== "fail"
              : judged.scored.pass;
        if (goodEnough) break;
        if (round === 0 && canReplayFirst && target != null) {
          process.stdout.write(" (regen)");
        }
      }

      const judged = best!;
      const pass = cardPasses({
        frozenPass: judged.scored.pass,
        visual: judged.visual,
        visualOn,
        target,
      });
      rows.push({
        id: fixture.id,
        label: fixture.label,
        pass,
        frozenPass: judged.scored.pass,
        frozenScore: frozenConfidence(judged.scored.scores),
        issues: judged.scored.issues,
        svg: judged.svg,
        error: null,
        durationMs: Date.now() - started,
        playerCount: judged.params.players.length,
        matchup: matchupLabel(judged.params),
        pack: bestPack,
        rounds,
        visual: judged.visual,
      });
      console.log(pass ? "  keep" : "  below target");
      if (judged.visual?.issues.length) console.log(`    visual: ${judged.visual.issues.join("; ")}`);
      if (judged.scored.scores.picture.issues.length) {
        console.log(`    picture: ${judged.scored.scores.picture.issues.join("; ")}`);
      }
    } catch (err: any) {
      rows.push({
        id: fixture.id,
        label: fixture.label,
        pass: false,
        frozenPass: false,
        frozenScore: 0,
        issues: [],
        svg: null,
        error: err?.message || String(err),
        durationMs: Date.now() - started,
        playerCount: 0,
        matchup: "",
        pack: startPack,
        rounds: 0,
        visual: null,
      });
      console.log(`ERROR ${err?.message || err}`);
    }
  }

  const confidence = visualOn ? sceneConfidence(rows) : Math.round((rows.filter((r) => r.pass).length / Math.max(1, rows.length)) * 100);
  const passed = rows.filter((r) => r.pass).length;
  fs.writeFileSync(path.join(outDir, "report.html"), reportHtml(rows, { scene, visual: visualOn, target, confidence }));
  const slim = rows.map(({ svg: _svg, ...rest }) => rest);
  fs.writeFileSync(
    path.join(outDir, "results.json"),
    JSON.stringify({ scene, visual: visualOn, target, confidence, passed, total: rows.length, rows: slim }, null, 2)
  );
  console.log(`\n${visualOn ? `Visual confidence ${confidence}/100` : `${passed}/${rows.length} passed`}${target != null ? ` (target ${target})` : ""}`);
  console.log(`Report ${path.join(outDir, "report.html")}`);
  const missed = target != null ? confidence < target || passed < rows.length : passed < rows.length;
  if (missed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
