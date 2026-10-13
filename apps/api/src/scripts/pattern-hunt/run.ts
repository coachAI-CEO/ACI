import "../../config/load-env";
import fs from "fs";
import path from "path";
import { drillToDrawerParams } from "../../mappers/drill-to-drawer-params";
import { renderDeterministicDiagramSVG } from "../../services/deterministic-drawer-svg";
import { applyGoalOverlay } from "../../services/goal-overlay";
import { fitDiagramSvgViewBox } from "../../services/fit-diagram-viewbox";
import { computeTokenRadius, matchupWithKeepers, scaleFactorFromTokenRadius } from "../../data/field-dimensions";
import { enforcePracticeArea } from "../../services/diagram-goals";
import { scoreFirstPass } from "../first-pass-diagrams/score";
import { PATTERN_HUNT_CELLS } from "./matrix";
import { canonicalJson } from "./canonical-json";

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

async function main() {
  const only = (process.argv.find((a, i, all) => all[i - 1] === "--only") || "")
    .split(",")
    .map((id) => id.trim().toUpperCase())
    .filter(Boolean);
  const coachOverride = process.argv.find((a, i, all) => all[i - 1] === "--coachLevel") || "";
  const cells = only.length ? PATTERN_HUNT_CELLS.filter((c) => only.includes(c.id)) : PATTERN_HUNT_CELLS;
  const outDir =
    (process.argv.find((a, i, all) => all[i - 1] === "--out") as string | undefined) ||
    path.join(__dirname, "..", "..", "..", "sandbox-output", "pattern-hunt");
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, "svg"), { recursive: true });

  const rows: Array<{
    id: string;
    scene: string;
    label: string;
    pass: boolean;
    issues: string[];
    tags: string[];
    matchup: string;
    formations: string;
    fault: string;
    durationMs: number;
    error: string | null;
  }> = [];

  for (const cell of cells) {
    const started = Date.now();
    process.stdout.write(`${cell.id} ... `);
    try {
      const json = canonicalJson(cell);
      enforcePracticeArea(json, {
        goalsAvailable: cell.input.goalsAvailable,
        spaceConstraint: cell.input.spaceConstraint,
        fieldFormat: cell.input.fieldFormat,
        drillType: cell.input.drillType,
      });
      const drillLike = {
        title: cell.label,
        json,
        drillType: cell.input.drillType,
        durationMin: 20,
        rpeMin: 4,
        rpeMax: 7,
        numbersMin: cell.input.numbersMin,
        numbersMax: cell.input.numbersMax,
        spaceConstraint: cell.input.spaceConstraint,
        formationUsed: cell.fault === "empty-formation" ? cell.input.formationAttacking : undefined,
        phase: cell.input.phase,
        zone: cell.input.zone,
        coachLevel: coachOverride || cell.input.coachLevel,
      };
      const params = drillToDrawerParams(drillLike as any);
      const svg = compileSvg(drillLike);
      const scored = scoreFirstPass({ json, params, svg, fixture: cell });
      fs.writeFileSync(path.join(outDir, "svg", `${cell.id}.svg`), svg);
      const att = params.players.filter((p) => p.team === "home").length;
      const def = params.players.filter((p) => p.team === "away").length;
      const gk = params.players.filter((p) => p.team === "gk").length;
      const neu = params.players.filter((p) => p.team === "neutral").length;
      const tags = [...new Set(scored.issues.map(tagFor))];
      rows.push({
        id: cell.id,
        scene: cell.scene,
        label: cell.label,
        pass: scored.pass,
        issues: scored.issues,
        tags,
        matchup: matchupWithKeepers(att, def, gk, neu),
        formations: `${params.formationAttacking || "?"} vs ${params.formationDefending || "?"}`,
        fault: cell.fault || "",
        durationMs: Date.now() - started,
        error: null,
      });
      console.log(scored.pass ? "PASS" : `FAIL ${tags.join(",")}`);
      if (!scored.pass) console.log(`    ${scored.issues.join("; ")}`);
    } catch (err: any) {
      rows.push({
        id: cell.id,
        scene: cell.scene,
        label: cell.label,
        pass: false,
        issues: [],
        tags: ["ERROR"],
        matchup: "",
        formations: "",
        fault: cell.fault || "",
        durationMs: Date.now() - started,
        error: err?.message || String(err),
      });
      console.log(`ERROR ${err?.message || err}`);
    }
  }

  const passed = rows.filter((r) => r.pass).length;
  const clusters = new Map<string, string[]>();
  for (const row of rows) {
    if (row.pass) continue;
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
    JSON.stringify({ passed, total: rows.length, clusters: clusterRows, rows }, null, 2)
  );

  function card(r: (typeof rows)[number]): string {
    const svg = fs.existsSync(path.join(outDir, "svg", `${r.id}.svg`))
      ? fs.readFileSync(path.join(outDir, "svg", `${r.id}.svg`), "utf8")
      : "";
    const status = r.pass ? "PASS" : r.tags.join(" · ") || "FAIL";
    const color = r.pass ? "#4ade80" : "#f87171";
    return `<section id="${escapeHtml(r.id)}" style="margin:0 0 24px;padding:16px;border:1px solid #334155;border-radius:12px;background:#0f172a">
        <h2 style="margin:0 0 8px;font-size:16px">${escapeHtml(r.id)} — ${escapeHtml(r.label)}
          <span style="color:${color};font-size:12px;margin-left:8px">${escapeHtml(status)}</span>
        </h2>
        <p style="color:#94a3b8;font-size:12px">${escapeHtml(r.matchup)} · ${escapeHtml(r.formations)}${r.fault ? ` · fault ${escapeHtml(r.fault)}` : ""}</p>
        ${r.error ? `<pre style="color:#fbbf24">${escapeHtml(r.error)}</pre>` : ""}
        ${r.issues.length ? `<ul style="color:#fca5a5">${r.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : ""}
        ${svg}
      </section>`;
  }

  const fails = rows.filter((r) => !r.pass);
  const failCards = fails.map(card).join("\n");
  const allCards = rows.map(card).join("\n");
  const nav = rows
    .map((r) => `<a href="#${escapeHtml(r.id)}" style="color:${r.pass ? "#93c5fd" : "#fca5a5"}">${escapeHtml(r.id)}</a>`)
    .join("");

  const clusterTable = clusterRows
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.tag)}</td><td>${c.count}</td><td>${escapeHtml(c.ids.join(", "))}</td></tr>`
    )
    .join("");

  fs.writeFileSync(
    path.join(outDir, "report.html"),
    `<!doctype html><html><head><meta charset="utf-8"><title>Pattern hunt Pass 1</title>
<style>body{font-family:Arial,sans-serif;background:#020617;color:#e2e8f0;padding:24px;max-width:1100px;margin:0 auto}
svg{width:100%;height:auto;display:block;background:#08111f;border-radius:12px}
table{border-collapse:collapse;width:100%;margin:12px 0 32px}
td,th{border:1px solid #334155;padding:8px;text-align:left}
th{color:#94a3b8}
nav{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 28px}
nav a{font-size:13px;text-decoration:none;border:1px solid #334155;padding:4px 8px;border-radius:8px}</style></head>
<body>
<h1>Pattern hunt — Pass 1 compiler only${coachOverride ? ` · ${escapeHtml(coachOverride)}` : ""}</h1>
<p>${passed}/${rows.length} frozen pass · ${rows.length - passed} fail · no session LLM · ${new Date().toISOString().slice(0, 10)}${coachOverride ? ` · coachLevel ${escapeHtml(coachOverride)}` : ""}</p>
<nav>${nav}</nav>
<h2>Clusters</h2>
<table><thead><tr><th>Tag</th><th>n</th><th>Cells</th></tr></thead><tbody>${clusterTable || "<tr><td colspan=3>none</td></tr>"}</tbody></table>
<h2>Failures</h2>
${failCards || "<p>All cells passed frozen checks.</p>"}
<h2>All cells</h2>
${allCards}
</body></html>`
  );

  console.log(`\n${passed}/${rows.length} passed`);
  for (const cluster of clusterRows) {
    console.log(`  ${cluster.tag} ${cluster.count}: ${cluster.ids.join(", ")}`);
  }
  console.log(`Report ${path.join(outDir, "report.html")}`);
  if (passed < rows.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
