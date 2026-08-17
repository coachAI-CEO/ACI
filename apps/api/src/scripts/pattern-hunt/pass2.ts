import "../../config/load-env";
import fs from "fs";
import path from "path";
import { drillToDrawerParams } from "../../mappers/drill-to-drawer-params";
import { renderDeterministicDiagramSVG } from "../../services/deterministic-drawer-svg";
import { applyGoalOverlay } from "../../services/goal-overlay";
import { fitDiagramSvgViewBox } from "../../services/fit-diagram-viewbox";
import {
  computeTokenRadius,
  matchupWithKeepers,
  scaleFactorFromTokenRadius,
} from "../../data/field-dimensions";
import { generateDrillJson } from "../first-pass-diagrams/generate-drill";
import { renderSvgPreview } from "../first-pass-diagrams/preview";
import { frozenConfidence, judgeDiagramVisual, type VisualQaResult } from "../first-pass-diagrams/visual-qa";
import { scoreFirstPass } from "../first-pass-diagrams/score";
import { PASS2_IDS, PATTERN_HUNT_CELLS } from "./matrix";

process.env.DIAGRAM_SVG_ENGINE = "deterministic";

function tagFor(issue: string): string {
  if (/^FORM_LINES:/.test(issue)) return "FORM_LINES";
  if (/wrong side of their GK/.test(issue)) return "ROLE_SIDE";
  if (/GK token|full goal/.test(issue)) return "GK_CONTRACT";
  if (/mini-goal|pugg|opposite end/.test(issue)) return "MINI_END";
  if (/viewBox/.test(issue)) return "VIEWBOX";
  if (/Match Area/.test(issue)) return "MATCH_AREA";
  if (/practice |envelope|drew full /.test(issue)) return "SPACE_YD";
  if (/crushed|length cluster|one half/.test(issue)) return "SPREAD";
  if (/protected full goal/.test(issue)) return "NET_RIGHT";
  if (/sitting in the full-goal/.test(issue)) return "PHANTOM";
  if (/overlap/.test(issue)) return "OVERLAP";
  if (/all labeled/.test(issue)) return "LABEL_SCRAMBLE";
  if (/lone CB/.test(issue)) return "LONE_CB";
  if (/not centered/.test(issue)) return "FRAME";
  return "OTHER";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function compileSvg(drillLike: Record<string, unknown>): string {
  const params = drillToDrawerParams(drillLike as any);
  const scale = scaleFactorFromTokenRadius(
    computeTokenRadius(params.widthYards, params.lengthYards, params.fieldFormat, params.players.length)
  );
  return fitDiagramSvgViewBox(applyGoalOverlay(renderDeterministicDiagramSVG(params), params.goals, scale));
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  const next = index === -1 ? undefined : process.argv[index + 1];
  if (!next || next.startsWith("--")) return undefined;
  return next;
}

type Row = {
  id: string;
  scene: string;
  label: string;
  frozenPass: boolean;
  frozenScore: number;
  visualPass: boolean;
  issues: string[];
  tags: string[];
  matchup: string;
  formations: string;
  visual: VisualQaResult | null;
  durationMs: number;
  error: string | null;
};

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) return;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const only = (argValue("--only") || "")
    .split(",")
    .map((id) => id.trim().toUpperCase())
    .filter(Boolean);
  const wanted = new Set(only.length ? only : PASS2_IDS);
  const cells = PATTERN_HUNT_CELLS.filter((cell) => wanted.has(cell.id));
  const visualOn = !process.argv.includes("--no-visual");
  const recompile = process.argv.includes("--recompile");
  const outDir =
    argValue("--out") || path.join(__dirname, "..", "..", "..", "sandbox-output", "pattern-hunt-pass2");
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, "svg"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "json"), { recursive: true });
  const previewDir = path.join(outDir, "preview");

  console.log(`Pass 2: ${cells.map((c) => c.id).join(", ")}${recompile ? " · recompile saved JSON" : ""}`);
  console.log(`Output ${outDir}${visualOn ? " · visual QA on" : " · visual QA off"}`);

  const rows: Row[] = [];
  await pool(cells, 2, async (cell) => {
    const started = Date.now();
    process.stdout.write(`${cell.id} generate ... `);
    try {
      const savedJsonPath = path.join(outDir, "json", `${cell.id}.json`);
      const json = recompile
        ? JSON.parse(fs.readFileSync(savedJsonPath, "utf8"))
        : await generateDrillJson(cell, "base");
      json.phase = json.phase || cell.input.phase;
      json.zone = json.zone || cell.input.zone;
      const drillLike = {
        title: String(json.title || cell.label),
        json,
        drillType: cell.input.drillType,
        durationMin: 20,
        rpeMin: 4,
        rpeMax: 7,
        numbersMin: cell.input.numbersMin,
        numbersMax: cell.input.numbersMax,
        spaceConstraint: cell.input.spaceConstraint,
        formationUsed: cell.input.formationAttacking,
        phase: cell.input.phase,
        zone: cell.input.zone,
      };
      const params = drillToDrawerParams(drillLike as any);
      const svg = compileSvg(drillLike);
      const scored = scoreFirstPass({ json, params, svg, fixture: cell });
      fs.writeFileSync(path.join(outDir, "svg", `${cell.id}.svg`), svg);
      fs.writeFileSync(path.join(outDir, "json", `${cell.id}.json`), JSON.stringify(json, null, 2));

      let visual: VisualQaResult | null = null;
      if (visualOn) {
        const pngPath = renderSvgPreview(path.join(outDir, "svg", `${cell.id}.svg`), previewDir);
        if (pngPath) {
          visual = await judgeDiagramVisual({
            pngPath,
            fixture: cell,
            params,
            frozenIssues: scored.issues,
          });
        } else {
          visual = {
            confidence: frozenConfidence(scored.scores),
            verdict: scored.pass ? "review" : "fail",
            issues: ["could not render PNG preview"],
            summary: "No visual judge.",
          };
        }
      }

      const att = params.players.filter((p) => p.team === "home").length;
      const def = params.players.filter((p) => p.team === "away").length;
      const gk = params.players.filter((p) => p.team === "gk").length;
      const neu = params.players.filter((p) => p.team === "neutral").length;
      const visualPass = !visualOn || (visual != null && visual.verdict !== "fail" && visual.confidence >= 75);
      const tags = [...new Set([...scored.issues.map(tagFor), ...(visual?.issues || []).map(tagFor)])];
      rows.push({
        id: cell.id,
        scene: cell.scene,
        label: cell.label,
        frozenPass: scored.pass,
        frozenScore: frozenConfidence(scored.scores),
        visualPass,
        issues: [...scored.issues, ...(visual?.issues || [])],
        tags,
        matchup: matchupWithKeepers(att, def, gk, neu),
        formations: `${params.formationAttacking || "?"} vs ${params.formationDefending || "?"}`,
        visual,
        durationMs: Date.now() - started,
        error: null,
      });
      const vis = visual ? `${visual.verdict} ${visual.confidence}` : "no-visual";
      console.log(`${cell.id} frozen ${scored.pass ? "PASS" : "FAIL"} · ${vis}${scored.issues.length ? ` · ${scored.issues.join("; ")}` : ""}`);
    } catch (err: any) {
      rows.push({
        id: cell.id,
        scene: cell.scene,
        label: cell.label,
        frozenPass: false,
        frozenScore: 0,
        visualPass: false,
        issues: [],
        tags: ["ERROR"],
        matchup: "",
        formations: "",
        visual: null,
        durationMs: Date.now() - started,
        error: err?.message || String(err),
      });
      console.log(`${cell.id} ERROR ${err?.message || err}`);
    }
  });

  rows.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const resultsPath = path.join(outDir, "results.json");
  if (only.length && fs.existsSync(resultsPath)) {
    const prev = JSON.parse(fs.readFileSync(resultsPath, "utf8")) as { rows?: Row[] };
    const byId = new Map((prev.rows || []).map((row) => [row.id, row]));
    for (const row of rows) byId.set(row.id, row);
    rows.splice(0, rows.length, ...[...byId.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })));
  }
  const frozenOk = rows.filter((r) => r.frozenPass).length;
  const visualOk = rows.filter((r) => r.visualPass).length;
  const clusters = new Map<string, string[]>();
  for (const row of rows) {
    if (row.frozenPass && row.visualPass) continue;
    const keys = row.tags.length ? row.tags : ["OTHER"];
    for (const tag of keys) {
      const list = clusters.get(tag) || [];
      list.push(row.id);
      clusters.set(tag, list);
    }
  }
  const clusterRows = [...clusters.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([tag, ids]) => ({ tag, count: ids.length, ids }));

  fs.writeFileSync(
    path.join(outDir, "results.json"),
    JSON.stringify({ frozenOk, visualOk, total: rows.length, clusters: clusterRows, rows }, null, 2)
  );

  const failCards = rows
    .filter((r) => !r.frozenPass || !r.visualPass)
    .map((r) => {
      const svg = fs.existsSync(path.join(outDir, "svg", `${r.id}.svg`))
        ? fs.readFileSync(path.join(outDir, "svg", `${r.id}.svg`), "utf8")
        : "";
      const vis = r.visual
        ? `<p style="color:#cbd5e1">${escapeHtml(r.visual.verdict)} ${r.visual.confidence} — ${escapeHtml(r.visual.summary)}</p>`
        : "";
      return `<section style="margin:0 0 24px;padding:16px;border:1px solid #334155;border-radius:12px;background:#0f172a">
        <h2 style="margin:0 0 8px;font-size:16px">${escapeHtml(r.id)} — ${escapeHtml(r.label)}
          <span style="color:${r.frozenPass && r.visualPass ? "#4ade80" : "#f87171"};font-size:12px;margin-left:8px">${r.tags.join(" · ") || (r.frozenPass ? "visual" : "FAIL")}</span>
        </h2>
        <p style="color:#94a3b8;font-size:12px">${escapeHtml(r.matchup)} · ${escapeHtml(r.formations)} · frozen ${r.frozenPass ? "PASS" : "FAIL"} ${r.frozenScore}</p>
        ${r.error ? `<pre style="color:#fbbf24">${escapeHtml(r.error)}</pre>` : ""}
        ${vis}
        ${r.issues.length ? `<ul style="color:#fca5a5">${r.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : ""}
        ${svg}
      </section>`;
    })
    .join("\n");

  const clusterTable = clusterRows
    .map((c) => `<tr><td>${escapeHtml(c.tag)}</td><td>${c.count}</td><td>${escapeHtml(c.ids.join(", "))}</td></tr>`)
    .join("");

  fs.writeFileSync(
    path.join(outDir, "report.html"),
    `<!doctype html><html><head><meta charset="utf-8"><title>Pattern hunt Pass 2</title>
<style>body{font-family:Arial,sans-serif;background:#020617;color:#e2e8f0;padding:24px;max-width:1100px;margin:0 auto}
svg{width:100%;height:auto;display:block;background:#08111f;border-radius:12px}
table{border-collapse:collapse;width:100%;margin:12px 0 32px}
td,th{border:1px solid #334155;padding:8px;text-align:left}
th{color:#94a3b8}</style></head>
<body>
<h1>Pattern hunt — Pass 2 live generate</h1>
<p>Frozen ${frozenOk}/${rows.length} · visual ${visualOk}/${rows.length} · gemini-3.5-flash-lite JSON + deterministic SVG</p>
<h2>Clusters</h2>
<table><thead><tr><th>Tag</th><th>n</th><th>Cells</th></tr></thead><tbody>${clusterTable || "<tr><td colspan=3>none</td></tr>"}</tbody></table>
<h2>Failures / reviews</h2>
${failCards || "<p>All 40 passed frozen and visual.</p>"}
</body></html>`
  );

  console.log(`\nFrozen ${frozenOk}/${rows.length} · visual ${visualOk}/${rows.length}`);
  for (const cluster of clusterRows) {
    console.log(`  ${cluster.tag} ${cluster.count}: ${cluster.ids.join(", ")}`);
  }
  console.log(`Report ${path.join(outDir, "report.html")}`);
  if (frozenOk < rows.length || visualOk < rows.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
