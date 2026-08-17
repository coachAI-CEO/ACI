import "../config/load-env";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import { enforcePracticeArea } from "../services/diagram-goals";
import { drillToDrawerParams } from "../mappers/drill-to-drawer-params";
import { generateDrillDiagramSvg, persistDrillDiagramSvg } from "../services/drill-diagram-svg";
import { FIRST_PASS_FIXTURES, type FirstPassFixture } from "./first-pass-diagrams/fixtures";
import { renderSvgPreview } from "./first-pass-diagrams/preview";
import { frozenConfidence, judgeDiagramVisual } from "./first-pass-diagrams/visual-qa";
import { scoreFirstPass } from "./first-pass-diagrams/score";
import { defaultFormationsForFormat, matchupWithKeepers, type FieldFormat } from "../data/field-dimensions";

process.env.DIAGRAM_SVG_ENGINE = "deterministic";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  const next = index === -1 ? undefined : process.argv[index + 1];
  if (!next || next.startsWith("--")) return undefined;
  return next;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fixtureForLive(args: {
  refCode: string;
  title: string;
  drillType: string;
  ageGroup: string;
  fieldFormat: string;
  spaceConstraint: string;
  numbersMin: number;
  numbersMax: number;
  goalsAvailable: number;
  formationAttacking: string;
  formationDefending: string;
  phase?: string;
  zone?: string;
}): FirstPassFixture {
  const expectedFullGoals = (args.goalsAvailable >= 2 ? 2 : args.goalsAvailable === 1 ? 1 : 0) as 0 | 1 | 2;
  const format = String(args.fieldFormat || "9V9").toUpperCase();
  const defending = /DEFENDING/i.test(String(args.phase));
  const templateId =
    expectedFullGoals === 1
      ? defending && format === "9V9"
        ? "D2"
        : format === "11V11"
          ? "B5"
          : format === "7V7"
            ? "B1"
            : "B3"
      : expectedFullGoals === 0
        ? "A4"
        : defending
          ? "D1"
          : "C3";
  const template = FIRST_PASS_FIXTURES.find((f) => f.id === templateId) || FIRST_PASS_FIXTURES.find((f) => f.id === "C3")!;
  return {
    ...template,
    id: args.refCode,
    label: `${args.title} (live ${args.refCode})`,
    expectedFullGoals,
    expectSpreadOnPitch: expectedFullGoals === 2 && /FULL/i.test(args.spaceConstraint),
    input: {
      ...template.input,
      drillType: args.drillType,
      ageGroup: args.ageGroup,
      fieldFormat: (args.fieldFormat as FirstPassFixture["input"]["fieldFormat"]) || "9V9",
      spaceConstraint: args.spaceConstraint,
      numbersMin: args.numbersMin,
      numbersMax: args.numbersMax,
      goalsAvailable: args.goalsAvailable,
      formationAttacking: args.formationAttacking,
      formationDefending: args.formationDefending,
      phase: args.phase || template.input.phase,
      zone: args.zone || template.input.zone,
    },
  };
}

async function main() {
  const refCode = argValue("--ref") || "D-PVG7";
  const persist = !process.argv.includes("--no-persist");
  const drill = await prisma.drill.findFirst({ where: { refCode } });
  if (!drill) {
    console.error(`Drill ${refCode} not found`);
    process.exit(1);
  }

  const json = JSON.parse(JSON.stringify(drill.json || {}));
  const fieldFormat = String(json.fieldFormat || json.organization?.area?.format || "9V9").toUpperCase();
  const spaceConstraint = String(drill.spaceConstraint || json.spaceConstraint || "FULL").toUpperCase();
  const goalsOverride = argValue("--goals");
  const goalsAvailable = Number.isFinite(Number(goalsOverride))
    ? Number(goalsOverride)
    : Number.isFinite(Number(drill.goalsAvailable))
      ? Number(drill.goalsAvailable)
      : Number(json.goalsAvailable ?? 2);
  json.goalsAvailable = goalsAvailable;
  json.spaceConstraint = spaceConstraint;
  json.fieldFormat = fieldFormat;
  json.drillType = drill.drillType || json.drillType;
  const formatDefaults = defaultFormationsForFormat(
    fieldFormat === "7V7" || fieldFormat === "11V11" ? (fieldFormat as FieldFormat) : "9V9"
  );
  json.formationAttacking = String(
    json.formationAttacking || json.organization?.formationAttacking || drill.formationUsed || formatDefaults.attacking
  );
  json.formationDefending = String(
    json.formationDefending || json.organization?.formationDefending || formatDefaults.defending
  );
  enforcePracticeArea(json, {
    goalsAvailable,
    spaceConstraint,
    fieldFormat,
    drillType: drill.drillType,
  });

  const fixture = fixtureForLive({
    refCode,
    title: drill.title,
    drillType: String(drill.drillType || json.drillType || "CONDITIONED_GAME"),
    ageGroup: drill.ageGroup || "U12",
    fieldFormat,
    spaceConstraint,
    numbersMin: drill.numbersMin ?? json.numbersMin ?? 16,
    numbersMax: drill.numbersMax ?? json.numbersMax ?? 18,
    goalsAvailable,
    formationAttacking: String(json.formationAttacking || json.organization?.formationAttacking || ""),
    formationDefending: String(json.formationDefending || json.organization?.formationDefending || ""),
    phase: String(drill.phase || json.phase || ""),
    zone: String(drill.zone || json.zone || ""),
  });

  const outDir = path.join(__dirname, "..", "..", "sandbox-output", `live-${refCode}`);
  fs.mkdirSync(outDir, { recursive: true });
  if (drill.diagramSvg) {
    fs.writeFileSync(path.join(outDir, "before.svg"), drill.diagramSvg);
  }

  const result = await generateDrillDiagramSvg({
    title: drill.title,
    json,
    drillType: drill.drillType,
    durationMin: drill.durationMin,
    rpeMin: drill.rpeMin,
    rpeMax: drill.rpeMax,
    numbersMin: drill.numbersMin,
    numbersMax: drill.numbersMax,
    spaceConstraint,
    formationUsed: drill.formationUsed,
    phase: drill.phase,
    zone: drill.zone,
  });
  const params = drillToDrawerParams({
    title: drill.title,
    json,
    drillType: drill.drillType,
    durationMin: drill.durationMin,
    rpeMin: drill.rpeMin,
    rpeMax: drill.rpeMax,
    numbersMin: drill.numbersMin,
    numbersMax: drill.numbersMax,
    spaceConstraint,
    formationUsed: drill.formationUsed,
    phase: drill.phase,
    zone: drill.zone,
  });
  const scored = scoreFirstPass({ json, params, svg: result.svg, fixture });
  fs.writeFileSync(path.join(outDir, "after.svg"), result.svg);
  fs.writeFileSync(path.join(outDir, "drill.json"), JSON.stringify(json, null, 2));

  const previewDir = path.join(outDir, "preview");
  const afterPng = renderSvgPreview(path.join(outDir, "after.svg"), previewDir);
  const beforePng = fs.existsSync(path.join(outDir, "before.svg"))
    ? renderSvgPreview(path.join(outDir, "before.svg"), previewDir)
    : null;
  const visual = afterPng
    ? await judgeDiagramVisual({
        pngPath: afterPng,
        fixture,
        params,
        frozenIssues: scored.issues,
      })
    : null;

  if (persist && drill.refCode) {
    await persistDrillDiagramSvg(drill.refCode, result);
    if (goalsOverride != null && Number.isFinite(Number(goalsOverride))) {
      await prisma.drill.update({
        where: { refCode: drill.refCode },
        data: {
          goalsAvailable,
          goalMode: goalsAvailable === 1 ? "LARGE" : goalsAvailable >= 2 ? "MINI2" : null,
        },
      });
    }
  }

  const att = params.players.filter((p) => p.team === "home").length;
  const def = params.players.filter((p) => p.team === "away").length;
  const gk = params.players.filter((p) => p.team === "gk").length;
  const neu = params.players.filter((p) => p.team === "neutral").length;
  const full = params.goals.filter((g) => g.type === "full").length;
  const minis = params.goals.filter((g) => g.type === "mini" || g.type === "gate").length;
  const matchup = matchupWithKeepers(att, def, gk, neu);
  const summary = {
    refCode,
    title: drill.title,
    persist,
    previousModel: drill.diagramSvgModel,
    newModel: result.model,
    drillType: drill.drillType,
    fieldFormat,
    spaceConstraint,
    goalsAvailable,
    areaYards: `${params.lengthYards}×${params.widthYards}`,
    matchup,
    players: { att, def, gk, neu, total: params.players.length },
    goals: { full, minis },
    frozenPass: scored.pass,
    frozenScore: frozenConfidence(scored.scores),
    frozenIssues: scored.issues,
    visual,
  };
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    path.join(outDir, "report.html"),
    `<!doctype html><html><head><meta charset="utf-8"><title>Live ${escapeHtml(refCode)}</title>
<style>body{font-family:Arial,sans-serif;background:#020617;color:#e2e8f0;padding:24px;max-width:1100px;margin:0 auto}
svg{width:100%;height:auto;display:block;background:#08111f;border-radius:12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.issues{color:#fca5a5}</style></head>
<body>
<h1>Live ${escapeHtml(refCode)} — ${escapeHtml(drill.title)}</h1>
<p>${escapeHtml(matchup)} · ${params.lengthYards}×${params.widthYards}yd · ${fieldFormat} ${spaceConstraint} · ${full} full / ${minis} mini · engine ${escapeHtml(result.model)}</p>
<p>Previous drawer: ${escapeHtml(String(drill.diagramSvgModel || "unknown"))}${persist ? " · persisted to Drill.diagramSvg" : " · not persisted"}</p>
<p>Frozen ${scored.pass ? "PASS" : "FAIL"} ${frozenConfidence(scored.scores)}/100${scored.issues.length ? ` — ${escapeHtml(scored.issues.join("; "))}` : ""}</p>
${visual ? `<p>Visual ${escapeHtml(visual.verdict)} ${visual.confidence}/100 — ${escapeHtml(visual.summary)}</p>
${visual.issues.length ? `<ul class="issues">${visual.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : ""}` : ""}
<div class="grid">
  <section><h2>Before (stored)</h2>${drill.diagramSvg || "<p>none</p>"}</section>
  <section><h2>After (deterministic)</h2>${result.svg}</section>
</div>
</body></html>`
  );

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report ${path.join(outDir, "report.html")}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
