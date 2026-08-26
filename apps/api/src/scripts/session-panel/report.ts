import type { SampleRun } from "./types";

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function verdictClass(v: string | null | undefined): string {
  if (v === "proud") return "proud";
  if (v === "review") return "review";
  return "fail";
}

function mean(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function fmtScore(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function scoreClass(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  if (n < 3) return "lo";
  if (n >= 4) return "hi";
  return "mid";
}

function votes(run: SampleRun): string {
  if (!run.agents.length) return "—";
  return run.agents
    .map((a) => (a.wouldRun === "yes" ? "Y" : a.wouldRun === "rewrite" ? "R" : "N"))
    .join(" ");
}

function lensLine(run: SampleRun): { topic: number | null; quality: number | null; variety: number | null } {
  const varieties = run.agents.map((a) => a.variety).filter((n): n is number => n != null && Number.isFinite(n));
  return {
    topic: mean(run.agents.map((a) => a.topicTaught).filter((n) => Number.isFinite(n))),
    quality: mean(run.agents.map((a) => a.trainingQuality).filter((n) => Number.isFinite(n))),
    variety: varieties.length ? mean(varieties) : null,
  };
}

function tokLabel(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function buildPanelReportHtml(
  runs: SampleRun[],
  meta: { generateModel: string; judgeModel: string; cells: string; book?: { lessons: Array<{ id: string; status: string; rule: string; helped: number; failed: number; scope: Record<string, string | undefined> }> } }
): string {
  const counts = { proud: 0, review: 0, fail: 0 };
  for (const r of runs) counts[r.panel?.verdict || "fail"] += 1;
  const tok = runs.map((r) => r.judgeInputTokensApprox).filter((n): n is number => n != null);
  const tokAvg = mean(tok);

  const matrixRows = runs
    .map((run) => {
      const v = run.panel?.verdict || "fail";
      const { topic, quality, variety } = lensLine(run);
      const gateN = run.gates?.ok ? "pass" : `${run.gates?.issues.length ?? "—"}`;
      return `<tr class="${verdictClass(v)}">
        <td><a href="#${esc(run.fixtureId)}">${esc(run.label)}</a></td>
        <td class="${scoreClass(topic)}">${fmtScore(topic)}</td>
        <td class="${scoreClass(quality)}">${fmtScore(quality)}</td>
        <td class="${scoreClass(variety)}">${fmtScore(variety)}</td>
        <td class="votes">${esc(votes(run))}</td>
        <td>${esc(String(gateN))}</td>
        <td><span class="pill ${verdictClass(v)}">${esc(v).toUpperCase()}${run.panel?.disagreement ? " split" : ""}</span></td>
      </tr>`;
    })
    .join("");

  const cards = runs
    .map((run) => {
      const v = run.panel?.verdict || "fail";
      const { topic, quality, variety } = lensLine(run);
      const agents = run.agents
        .map((a) => {
          const extra = Object.entries(a.scores)
            .filter(([k]) => k !== "topicTaught" && k !== "trainingQuality" && k !== "variety")
            .map(([k, val]) => `<span>${esc(k)} <b class="${scoreClass(val)}">${fmtScore(val)}</b></span>`)
            .join("");
          const quotes = a.evidence
            .slice(0, 3)
            .map((e) => `<li><q>${esc(e.quote)}</q> <span class="muted">${esc(e.drillTitle)}${e.why ? " — " + esc(e.why) : ""}</span></li>`)
            .join("");
          return `<div class="agent">
            <div class="agent-head">
              <strong>${esc(a.agentName.replace("Youth Development Director", "Development").replace("USSF Coaching School Instructor", "Instructor").replace("Pitchside Session Designer", "Designer"))}</strong>
              <span class="would ${a.wouldRun}">${esc(a.wouldRun)}${a.wouldRunOverridden ? "*" : ""}</span>
            </div>
            <div class="hero-mini">
              <span>topic <b class="${scoreClass(a.topicTaught)}">${fmtScore(a.topicTaught)}</b></span>
              <span>quality <b class="${scoreClass(a.trainingQuality)}">${fmtScore(a.trainingQuality)}</b></span>
              ${a.variety != null ? `<span>variety <b class="${scoreClass(a.variety)}">${fmtScore(a.variety)}</b></span>` : ""}
            </div>
            <div class="lens">${extra}</div>
            ${a.parseError ? `<div class="warn">${esc(a.parseError)}</div>` : ""}
            ${a.notes ? `<p class="notes">${esc(a.notes)}</p>` : ""}
            ${quotes ? `<ul class="quotes">${quotes}</ul>` : ""}
          </div>`;
        })
        .join("");

      const gates = (run.gates?.issues || [])
        .map((i) => `<li><code>${esc(i.code)}</code> ${esc(i.detail)}</li>`)
        .join("");

      const drills = (run.packet?.drills || [])
        .map((d) => `${d.drillType} ${d.duration ?? "?"}m — ${d.title}`)
        .join(" · ");

      return `<section class="card ${verdictClass(v)}" id="${esc(run.fixtureId)}">
        <header>
          <div>
            <h2>${esc(run.label)}</h2>
            <p class="title">${esc(run.title || "")}</p>
            <div class="meta">${esc(run.fixtureId)} · ${run.latencyMs == null ? "" : `${(run.latencyMs / 1000).toFixed(0)}s gen`} · judges ${tokLabel(run.judgeInputTokensApprox)} tok in</div>
          </div>
          <div class="hero">
            <div><div class="n ${scoreClass(topic)}">${fmtScore(topic)}</div><div class="l">topic</div></div>
            <div><div class="n ${scoreClass(quality)}">${fmtScore(quality)}</div><div class="l">quality</div></div>
            <div><div class="n ${scoreClass(variety)}">${fmtScore(variety)}</div><div class="l">variety</div></div>
            <span class="pill ${verdictClass(v)}">${esc(v).toUpperCase()}</span>
          </div>
        </header>
        ${run.error ? `<div class="warn">${esc(run.error)}</div>` : ""}
        ${run.panel?.reasons?.length && v !== "proud" ? `<p class="reasons">${esc(run.panel.reasons.join(" · "))}</p>` : ""}
        ${drills ? `<p class="skeleton">${esc(drills)}</p>` : ""}
        ${gates ? `<details class="gates ${run.gates?.ok ? "" : "bad"}"><summary>Gates ${run.gates?.ok ? "pass" : run.gates?.issues.length + " fail"}</summary><ul>${gates}</ul></details>` : ""}
        <div class="agents">${agents || "<p class='muted'>Judges skipped (gates only)</p>"}</div>
      </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Session panel</title>
<style>
  :root { --bg:#0b0f14; --card:#10151b; --line:#1c2530; --text:#e6edf3; --muted:#7d8b99; --hi:#5eead4; --mid:#fbbf24; --lo:#fb7185; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 28px 32px 96px; }
  h1 { font-size: 20px; font-weight: 650; margin: 0 0 4px; letter-spacing: -0.02em; }
  h2 { font-size: 15px; font-weight: 650; margin: 0; }
  .banner { color: var(--muted); font-size: 12px; margin-bottom: 20px; line-height: 1.5; }
  .tally { display: flex; gap: 16px; margin-top: 8px; font-weight: 700; font-size: 13px; }
  .tally .proud { color: var(--hi); } .tally .review { color: var(--mid); } .tally .fail { color: var(--lo); }
  table.matrix { width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0 28px; }
  table.matrix th { text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; padding: 8px 10px; border-bottom: 1px solid var(--line); }
  table.matrix td { padding: 10px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  table.matrix a { color: var(--text); text-decoration: none; }
  table.matrix a:hover { color: var(--hi); }
  .votes { font-variant-numeric: tabular-nums; letter-spacing: 0.12em; font-size: 12px; color: var(--muted); }
  .pill { font-size: 10px; font-weight: 800; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 4px; }
  .pill.proud { background: #134e4a; color: var(--hi); }
  .pill.review { background: #713f12; color: #fde68a; }
  .pill.fail { background: #7f1d1d; color: #fecaca; }
  .card { border: 1px solid var(--line); border-radius: 8px; padding: 16px 18px; margin-top: 14px; background: var(--card); }
  .card.fail { border-color: #3f1d1d; }
  .card.proud { border-color: #1a3d3a; }
  header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  .hero { display: flex; align-items: center; gap: 16px; }
  .hero .n { font-size: 28px; font-weight: 650; font-variant-numeric: tabular-nums; line-height: 1; letter-spacing: -0.03em; }
  .hero .l { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }
  .hi { color: var(--hi); } .mid { color: var(--mid); } .lo { color: var(--lo); }
  .meta, .muted, .reasons, .skeleton { color: var(--muted); font-size: 12px; }
  .title { font-size: 13px; margin: 4px 0 0; color: #c9d4de; }
  .warn { color: #fb923c; font-weight: 600; font-size: 12px; }
  .skeleton { margin: 8px 0 0; }
  .agents { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
  @media (max-width: 900px) { .agents { grid-template-columns: 1fr; } header { flex-direction: column; } }
  .agent { background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; }
  .agent-head { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin-bottom: 6px; }
  .would { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
  .would.yes { color: var(--hi); } .would.rewrite { color: var(--mid); } .would.no { color: var(--lo); }
  .hero-mini, .lens { display: flex; flex-wrap: wrap; gap: 8px 12px; font-size: 11px; color: var(--muted); margin-bottom: 6px; }
  .notes { font-size: 12px; line-height: 1.45; color: #c9d4de; margin: 0 0 8px; }
  .quotes { margin: 0; padding-left: 16px; font-size: 11px; color: var(--muted); }
  .quotes q { color: #c9d4de; }
  details { margin-top: 8px; font-size: 12px; }
  summary { cursor: pointer; color: var(--hi); }
  details.bad summary { color: var(--lo); }
</style>
</head>
<body>
  <h1>Session panel</h1>
  <div class="banner">
    Generate ${esc(meta.generateModel)} · judges ${esc(meta.judgeModel)} · ${esc(meta.cells)}
    ${tokAvg != null ? ` · ~${tokLabel(tokAvg)} tok in / sample (3 judges, clipped card)` : ""}
    <div class="tally">
      <span class="proud">${counts.proud} proud</span>
      <span class="review">${counts.review} review</span>
      <span class="fail">${counts.fail} fail</span>
    </div>
  </div>
  <table class="matrix">
    <thead><tr><th>Cell</th><th>Topic</th><th>Quality</th><th>Variety</th><th>Votes</th><th>Gates</th><th></th></tr></thead>
    <tbody>${matrixRows}</tbody>
  </table>
  ${cards}
  ${meta.book?.lessons?.length ? `<h2 style="margin-top:36px;font-size:15px">Playbook</h2>
  <p class="muted">Active rules go into the next generate. Proposed wait for --apply. Paused after 3 fails with no help.</p>
  <table class="matrix">
    <thead><tr><th>Status</th><th>↑/↓</th><th>Rule</th></tr></thead>
    <tbody>${meta.book.lessons
      .map(
        (l) => `<tr>
      <td><span class="pill ${l.status === "active" ? "proud" : l.status === "proposed" ? "review" : "fail"}">${esc(l.status)}</span></td>
      <td class="votes">${l.helped}/${l.failed}</td>
      <td>${esc(l.rule)} <span class="muted">${esc(l.id)}</span></td>
    </tr>`
      )
      .join("")}</tbody>
  </table>` : ""}
</body>
</html>`;
}
