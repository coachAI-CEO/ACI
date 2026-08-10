import fs from "fs";
import path from "path";

/**
 * Turns the JSON dumps from run.ts into one self-contained HTML report --
 * comparison table + rendered output per model, grouped by scenario tab.
 * Picks the latest run per scenario found in the results directory, so the
 * usual flow is: run a few `sandbox:models` comparisons, then regenerate
 * this report to see them side by side instead of reading raw JSON.
 *
 * Usage:
 *   pnpm --filter api sandbox:models:report -- --out /path/to/report.html
 */

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

type StoredResult = {
  model: string;
  ok: boolean;
  text: string | null;
  error: string | null;
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estCostUsd: number | null;
  validation?: { ok: boolean; note?: string };
};

type StoredRun = {
  scenario: string;
  prompt: string;
  ranAt: string;
  results: StoredResult[];
};

function loadLatestRunPerScenario(resultsDir: string): StoredRun[] {
  if (!fs.existsSync(resultsDir)) return [];
  const files = fs.readdirSync(resultsDir).filter((f) => f.endsWith(".json"));
  const latestByScenario = new Map<string, { file: string; ts: number }>();
  for (const file of files) {
    const match = file.match(/^(.+)-(\d+)\.json$/);
    if (!match) continue;
    const [, scenario, tsStr] = match;
    const ts = Number(tsStr);
    const existing = latestByScenario.get(scenario);
    if (!existing || ts > existing.ts) latestByScenario.set(scenario, { file, ts });
  }
  return Array.from(latestByScenario.entries()).map(([, { file }]) =>
    JSON.parse(fs.readFileSync(path.join(resultsDir, file), "utf8"))
  );
}

function renderReport(runs: StoredRun[]): string {
  const dataJson = JSON.stringify(runs);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Model sandbox report</title>
<style>
  :root {
    --bg: #0a0d12;
    --panel: #12161ecc;
    --panel-solid: #12161e;
    --border: #2a3140;
    --text: #dbe2ec;
    --text-dim: #8b95a7;
    --text-faint: #5a6478;
    --accent: #f0a832;
    --accent-dim: #f0a83226;
    --good: #3ecf8e;
    --good-bg: #3ecf8e14;
    --bad: #f16565;
    --bad-bg: #f1656514;
    --mono: ui-monospace, "SF Mono", "Menlo", "Cascadia Mono", Consolas, monospace;
    --sans: ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  :root[data-theme="light"] {
    --bg: #f4f5f7;
    --panel: #ffffffcc;
    --panel-solid: #ffffff;
    --border: #d8dce3;
    --text: #1c2230;
    --text-dim: #5b6472;
    --text-faint: #8b95a7;
    --accent: #b5761c;
    --accent-dim: #f0a83220;
    --good: #1f9d68;
    --good-bg: #1f9d6814;
    --bad: #d1425a;
    --bad-bg: #d1425a14;
  }
  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) {
      --bg: #f4f5f7;
      --panel: #ffffffcc;
      --panel-solid: #ffffff;
      --border: #d8dce3;
      --text: #1c2230;
      --text-dim: #5b6472;
      --text-faint: #8b95a7;
      --accent: #b5761c;
      --accent-dim: #f0a83220;
      --good: #1f9d68;
      --good-bg: #1f9d6814;
      --bad: #d1425a;
      --bad-bg: #d1425a14;
    }
  }
  * { box-sizing: border-box; }
  body { background: var(--bg); margin: 0; }
  .page { font-family: var(--sans); color: var(--text); max-width: 1080px; margin: 0 auto; padding: 2rem 1.5rem 5rem; }
  .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin: 0 0 6px; }
  h1 { font-size: 24px; font-weight: 700; margin: 0 0 6px; text-wrap: balance; }
  .sub { color: var(--text-dim); font-size: 13.5px; margin: 0 0 24px; line-height: 1.6; }
  .tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--border); margin-bottom: 24px; overflow-x: auto; }
  .tab {
    font-family: var(--mono); font-size: 12.5px; font-weight: 600; color: var(--text-dim);
    background: none; border: none; padding: 9px 14px; cursor: pointer; border-bottom: 2px solid transparent;
    white-space: nowrap;
  }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab .count { color: var(--text-faint); font-weight: 400; }
  .panel { display: none; }
  .panel.active { display: block; }
  .meta-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
  .meta-pill { font-family: var(--mono); font-size: 11px; color: var(--text-dim); background: var(--accent-dim); border: 1px solid var(--border); padding: 4px 10px; border-radius: 999px; }
  table.compare { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-family: var(--mono); font-size: 12.5px; }
  table.compare th { text-align: left; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.04em; font-size: 10px; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  table.compare td { padding: 9px 10px; border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; }
  table.compare tr:last-child td { border-bottom: none; }
  .model-name { color: var(--text); font-weight: 600; }
  .pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .pill.good { color: var(--good); background: var(--good-bg); }
  .pill.bad { color: var(--bad); background: var(--bad-bg); }
  .cheapest { color: var(--good); font-weight: 700; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
  .card { border-radius: 14px; border: 1px solid var(--border); background: var(--panel); padding: 16px 18px; }
  .card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
  .card-head .name { font-family: var(--mono); font-size: 13px; font-weight: 700; }
  .card-head .cost { font-family: var(--mono); font-size: 12px; color: var(--text-dim); }
  .card .svg-wrap { border-radius: 8px; overflow: hidden; border: 1px solid var(--border); background: #0f2a17; }
  .card .svg-wrap svg { display: block; width: 100%; height: auto; }
  .card .desc-text { font-size: 13.5px; line-height: 1.65; color: #cbd5e1; margin: 0; }
  :root[data-theme="light"] .card .desc-text, @media (prefers-color-scheme: light) { }
  .card .drills { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .card .drills li { font-size: 12.5px; display: flex; gap: 8px; }
  .card .drills li .type { font-family: var(--mono); font-size: 10px; color: var(--accent); flex-shrink: 0; padding-top: 2px; }
  .card .err { color: var(--bad); font-size: 12.5px; font-family: var(--mono); }
  .card .note { margin-top: 10px; font-size: 11px; color: var(--text-faint); font-family: var(--mono); }
  .prompt-box { font-family: var(--mono); font-size: 11.5px; color: var(--text-faint); background: var(--panel-solid); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; max-height: 90px; overflow: auto; white-space: pre-wrap; margin-bottom: 20px; }
  .empty { color: var(--text-faint); font-size: 13.5px; padding: 40px 0; text-align: center; }
</style>
</head>
<body>
<div class="page">
  <p class="eyebrow">TacticalEdge &middot; model sandbox</p>
  <h1>Cheap-model head-to-head</h1>
  <p class="sub">Latest run per scenario, generated with <code>pnpm sandbox:models:report</code>. Each scenario runs the same real production prompt against every candidate model in parallel &mdash; latency, tokens, cost, and a scenario-specific validity check side by side.</p>
  <div class="tabs" id="tabs"></div>
  <div id="panels"></div>
</div>
<script>
const RUNS = ${dataJson};
const tabsEl = document.getElementById('tabs');
const panelsEl = document.getElementById('panels');

function fmtMs(ms) { return ms == null ? '\u2013' : (ms / 1000).toFixed(1) + 's'; }
function fmtCost(c) { return c == null ? '\u2013' : '$' + c.toFixed(5); }
function fmtTok(t) { return t == null ? '\u2013' : t.toLocaleString(); }

function renderContent(scenario, r) {
  if (!r.ok) return '<p class="err">' + (r.error || 'failed') + '</p>';
  const text = r.text || '';
  if (scenario === 'drawer') {
    const start = text.indexOf('<svg');
    const end = text.lastIndexOf('</svg>');
    if (start !== -1 && end !== -1) {
      return '<div class="svg-wrap">' + text.slice(start, end + 6) + '</div>';
    }
    return '<p class="err">no &lt;svg&gt; found in output</p>';
  }
  if (scenario === 'description') {
    let parsed = null;
    try {
      const cleaned = text.replace(/\`\`\`json\\n?/g, '').replace(/\`\`\`\\n?/g, '');
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
      parsed = JSON.parse(cleaned.slice(s, e + 1));
    } catch {}
    const desc = parsed && parsed.description ? parsed.description : text;
    return '<p class="desc-text">' + desc.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</p>';
  }
  if (scenario === 'session') {
    let parsed = null;
    try {
      const cleaned = text.replace(/\`\`\`json\\n?/g, '').replace(/\`\`\`\\n?/g, '');
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
      parsed = JSON.parse(cleaned.slice(s, e + 1));
    } catch {}
    if (parsed && Array.isArray(parsed.drills)) {
      const items = parsed.drills.map(d =>
        '<li><span class="type">' + (d.drillType || '').replace(/_/g,' ') + '</span><span>' + (d.title || '(untitled)') + '</span></li>'
      ).join('');
      return '<ul class="drills">' + items + '</ul>';
    }
    return '<p class="err">could not parse session JSON</p>';
  }
  return '<p class="desc-text">' + text.slice(0, 800).replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</p>';
}

RUNS.forEach((run, i) => {
  const tab = document.createElement('button');
  tab.className = 'tab' + (i === 0 ? ' active' : '');
  tab.innerHTML = run.scenario + ' <span class="count">(' + run.results.length + ')</span>';
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + i).classList.add('active');
  };
  tabsEl.appendChild(tab);

  const panel = document.createElement('div');
  panel.className = 'panel' + (i === 0 ? ' active' : '');
  panel.id = 'panel-' + i;

  const cheapest = run.results.filter(r => r.estCostUsd != null).sort((a,b) => a.estCostUsd - b.estCostUsd)[0];

  const metaRow = '<div class="meta-row">' +
    '<span class="meta-pill">ran ' + new Date(run.ranAt).toLocaleString() + '</span>' +
    '<span class="meta-pill">prompt ' + run.prompt.length.toLocaleString() + ' chars</span>' +
    '<span class="meta-pill">' + run.results.length + ' models</span>' +
    '</div>';

  const tableRows = run.results.map(r => {
    const validPill = r.validation
      ? '<span class="pill ' + (r.validation.ok ? 'good' : 'bad') + '">' + (r.validation.ok ? 'valid' : 'invalid') + '</span>'
      : (r.ok ? '<span class="pill good">ok</span>' : '<span class="pill bad">error</span>');
    const costClass = cheapest && r === cheapest ? ' class="cheapest"' : '';
    return '<tr>' +
      '<td class="model-name">' + r.model + '</td>' +
      '<td>' + fmtMs(r.durationMs) + '</td>' +
      '<td>' + fmtTok(r.promptTokens) + '</td>' +
      '<td>' + fmtTok(r.completionTokens) + '</td>' +
      '<td' + costClass + '>' + fmtCost(r.estCostUsd) + '</td>' +
      '<td>' + validPill + '</td>' +
      '<td>' + (r.validation && r.validation.note ? r.validation.note : (r.error || '\u2013')) + '</td>' +
      '</tr>';
  }).join('');

  const table = '<table class="compare"><thead><tr>' +
    '<th>Model</th><th>Latency</th><th>Prompt tok</th><th>Completion tok</th><th>Est. cost</th><th>Check</th><th>Note</th>' +
    '</tr></thead><tbody>' + tableRows + '</tbody></table>';

  const promptBox = '<div class="prompt-box">' + run.prompt.slice(0, 2000).replace(/&/g,'&amp;').replace(/</g,'&lt;') + (run.prompt.length > 2000 ? '\\n\u2026' : '') + '</div>';

  const cards = '<div class="cards">' + run.results.map(r =>
    '<div class="card">' +
      '<div class="card-head"><span class="name">' + r.model + '</span><span class="cost">' + fmtCost(r.estCostUsd) + '</span></div>' +
      renderContent(run.scenario, r) +
    '</div>'
  ).join('') + '</div>';

  panel.innerHTML = metaRow + table + promptBox + cards;
  panelsEl.appendChild(panel);
});

if (RUNS.length === 0) {
  panelsEl.innerHTML = '<p class="empty">No sandbox runs found. Run <code>pnpm sandbox:models -- --scenario session</code> first.</p>';
}
</script>
</body>
</html>`;
}

function main() {
  const resultsDir = getArgValue("--resultsDir") || path.join(process.cwd(), "src/scripts/model-sandbox/results");
  const outPath = getArgValue("--out") || path.join(resultsDir, "report.html");
  const runs = loadLatestRunPerScenario(resultsDir);
  fs.writeFileSync(outPath, renderReport(runs));
  console.log(`Report written to ${outPath} (${runs.length} scenario${runs.length === 1 ? "" : "s"})`);
}

main();
