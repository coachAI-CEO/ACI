function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type SideScore = {
  frozenPass: boolean;
  frozenScore: number;
  frozenIssues: string[];
  visual?: {
    verdict: "pass" | "review" | "fail";
    confidence: number;
    issues: string[];
    summary: string;
  } | null;
};

export type ThesisRow = {
  id: string;
  title: string;
  why: string;
  card: string;
  note: string;
  compilerSvg: string;
  modelSvg: string | null;
  error?: string;
  compilerPlayers: number;
  modelPlayers: number;
  compilerScore?: SideScore;
  modelScore?: SideScore;
};

function verdictChip(score: SideScore | undefined): string {
  if (!score) return "";
  const visual = score.visual;
  const tag = visual
    ? `${visual.verdict.toUpperCase()} ${visual.confidence}`
    : score.frozenPass
      ? "FROZEN PASS"
      : "FROZEN FAIL";
  const tone = visual ? visual.verdict : score.frozenPass ? "pass" : "fail";
  const frozen = `frozen ${score.frozenScore}`;
  const issues = [
    ...(visual?.issues || []),
    ...(!visual ? score.frozenIssues : []),
  ];
  const summary = visual?.summary ? `<p class="summary">${escapeHtml(visual.summary)}</p>` : "";
  const extra = issues.length ? `<p class="issues">${escapeHtml(issues.slice(0, 4).join("; "))}</p>` : "";
  return `<p class="verdict ${tone}"><span>${escapeHtml(tag)}</span> ${escapeHtml(frozen)}</p>${summary}${extra}`;
}

export function thesisHtml(rows: ThesisRow[], meta: { outDir: string; model: string; visual: boolean }): string {
  const scored = rows.filter((r) => r.modelScore || r.compilerScore);
  const visualOn = meta.visual;
  const avg = (side: "compilerScore" | "modelScore") => {
    const vals = rows.map((r) => r[side]?.visual?.confidence).filter((n): n is number => typeof n === "number");
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };
  const compilerAvg = avg("compilerScore");
  const modelAvg = avg("modelScore");
  const lede = visualOn
    ? `Same painter both sides. Visual judge scores the PICTURE against the written card — not 11v11 formation lines. Right should beat left if the thesis holds.`
    : `Same SVG painter on both sides. Left is today's compiler. Right is the model writing object XY from the card. Frozen scene checks always run; pass --visual for the PNG judge.`;

  const cards = rows
    .map((row) => {
      const modelCell = row.modelSvg
        ? `<div class="svg">${row.modelSvg}</div>`
        : `<p class="warn">${escapeHtml(row.error || "Model path failed")}</p>`;
      return `<article class="card">
  <h2>${escapeHtml(row.title)}</h2>
  <p class="why">${escapeHtml(row.why)}</p>
  <pre class="card-text">${escapeHtml(row.card)}</pre>
  ${row.note ? `<p class="note"><span>On the figure</span> ${escapeHtml(row.note)}</p>` : ""}
  <div class="pair">
    <figure>
      <figcaption>Current compiler <span>${row.compilerPlayers} shirts</span></figcaption>
      <p class="hint">drillToDrawerParams → same SVG painter</p>
      ${verdictChip(row.compilerScore)}
      <div class="svg">${row.compilerSvg}</div>
    </figure>
    <figure>
      <figcaption>Model places objects <span>${row.modelPlayers || "—"} shirts</span></figcaption>
      <p class="hint">idea → ${escapeHtml(meta.model)} → same SVG painter (no compiler)</p>
      ${verdictChip(row.modelScore)}
      ${modelCell}
    </figure>
  </div>
</article>`;
    })
    .join("\n");

  const tally =
    compilerAvg != null && modelAvg != null
      ? `<p class="tally">Visual confidence · compiler <b>${compilerAvg}</b> · model XY <b>${modelAvg}</b> · ${scored.length} cards</p>`
      : scored.length
        ? `<p class="tally">Frozen scene checks on ${scored.length} cards. Visual judge off — rerun with --visual.</p>`
        : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="theme-color" content="#060a13"/>
  <title>Scene thesis — compiler vs model XY</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0; padding: 32px 24px 64px;
      background: #060a13; color: #e2e8f0;
      font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    }
    h1 { font-size: 22px; letter-spacing: -0.03em; margin: 0 0 8px; }
    h1 span { color: #34d399; }
    .lede { max-width: 68ch; color: #94a3b8; }
    .muted { color: #64748b; font-size: 13px; }
    .tally { color: #cbd5e1; margin: 12px 0 0; }
    .tally b { color: #6ee7b7; }
    .card {
      margin: 28px 0; padding: 20px 20px 24px;
      background: linear-gradient(180deg, #0a1118, #0a0f1a);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 20px;
    }
    h2 { font-size: 18px; margin: 0 0 6px; }
    .why { color: #94a3b8; margin: 0 0 12px; }
    .card-text {
      white-space: pre-wrap; margin: 0 0 16px; padding: 12px 14px;
      background: #08111f; border-radius: 12px; color: #cbd5e1; font-size: 13px;
    }
    .note { color: #6ee7b7; }
    .note span { color: #64748b; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; margin-right: 8px; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    figure { margin: 0; }
    figcaption { font-weight: 650; margin-bottom: 4px; display: flex; justify-content: space-between; gap: 8px; }
    figcaption span { color: #94a3b8; font-weight: 500; }
    .hint { color: #64748b; font-size: 12px; margin: 0 0 8px; }
    .verdict { font-size: 13px; font-weight: 700; margin: 0 0 6px; }
    .verdict span { margin-right: 8px; }
    .verdict.pass { color: #34d399; }
    .verdict.review { color: #fbbf24; }
    .verdict.fail { color: #f87171; }
    .summary { color: #cbd5e1; font-size: 12px; margin: 0 0 6px; }
    .issues { color: #fca5a5; font-size: 12px; margin: 0 0 8px; }
    .svg svg { width: 100%; height: auto; background: #08111f; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); }
    .warn { color: #fbbf24; }
    @media (max-width: 960px) { .pair { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>Tactical<span>Edge</span> scene thesis</h1>
  <p class="lede">${escapeHtml(lede)}</p>
  <p class="muted">Model ${escapeHtml(meta.model)} · ${escapeHtml(meta.outDir)}</p>
  ${tally}
  ${cards}
</body>
</html>`;
}
