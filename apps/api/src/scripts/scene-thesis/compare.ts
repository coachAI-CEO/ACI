/**
 * Thesis lab: same TE SVG painter, two placement sources.
 *
 *   pnpm --filter api sandbox:scene-thesis
 *   pnpm --filter api sandbox:scene-thesis -- --set new --visual
 *
 * Left: drillToDrawerParams (current generate picture path).
 * Right: written card → Flash Lite → object XY, painted without the compiler.
 * Frozen scene checks always run. --visual PNG-judges both sides against the card.
 */
import "../../config/load-env";
import fs from "fs";
import path from "path";
import { generateText } from "../../gemini";
import { applyGoalOverlay } from "../../services/goal-overlay";
import { fitDiagramSvgViewBox } from "../../services/fit-diagram-viewbox";
import { computeTokenRadius, scaleFactorFromTokenRadius } from "../../data/field-dimensions";
import { renderDeterministicDiagramSVG } from "../../services/deterministic-drawer-svg";
import type { DrawerParams } from "../../types/drawer";
import { compilerParams, countByTeam } from "./compiler";
import { THESIS_IDEAS, type ThesisIdea } from "./ideas";
import { judgeSceneVisual } from "./judge";
import { thesisHtml, type SideScore, type ThesisRow } from "./report";
import { extractScene, promptFor, sceneToDrawerParams } from "./scene";
import { frozenConfidence, scoreScene } from "./score";
import { pinGoalsToEnds, snapKeepersToGoals } from "./space";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  const next = index === -1 ? undefined : process.argv[index + 1];
  if (!next || next.startsWith("--")) return undefined;
  return next;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function paint(params: DrawerParams): string {
  const goals = pinGoalsToEnds(params.goals);
  const snapped = { ...params, goals, players: snapKeepersToGoals(params.players, goals) };
  const tokenRadius =
    typeof snapped.lockTokenRadius === "number" && snapped.lockTokenRadius > 0
      ? snapped.lockTokenRadius
      : computeTokenRadius(snapped.widthYards, snapped.lengthYards, snapped.fieldFormat, snapped.players.length);
  const scale = scaleFactorFromTokenRadius(tokenRadius);
  return fitDiagramSvgViewBox(applyGoalOverlay(renderDeterministicDiagramSVG(snapped), snapped.goals, scale));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sideScore(params: DrawerParams, idea: ThesisIdea): SideScore {
  const frozen = scoreScene(params, idea);
  return {
    frozenPass: frozen.pass,
    frozenScore: frozenConfidence(frozen.scores),
    frozenIssues: frozen.issues,
    visual: null,
  };
}

async function main() {
  const only = argValue("--only");
  const fromDir = argValue("--from-dir");
  const set = argValue("--set");
  const visualOn = hasFlag("--visual") && !hasFlag("--no-visual");
  const onlyIds = (only || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  let ideas = onlyIds.length ? THESIS_IDEAS.filter((idea) => onlyIds.includes(idea.id)) : THESIS_IDEAS;
  if (set === "dense" || set === "c-bplus") {
    ideas = ideas.filter((idea) => idea.coachLevel === "USSF_C" || idea.coachLevel === "USSF_B_PLUS");
  }
  if (set === "new") {
    ideas = THESIS_IDEAS.filter((idea) => idea.batch === "new");
    if (onlyIds.length) ideas = ideas.filter((idea) => onlyIds.includes(idea.id));
  }
  if (!ideas.length) throw new Error(only ? `No idea named ${only}` : "No ideas");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(__dirname, "../../../sandbox-output", `scene-thesis-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });
  const model = process.env.GEMINI_MODEL_PRIMARY || "gemini-3.5-flash-lite";
  const rows: ThesisRow[] = [];
  console.log(visualOn ? "Visual judge on (lite PNG QA vs the card)" : "Visual judge off — frozen scene checks only. Pass --visual.");

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    console.log(`[${i + 1}/${ideas.length}] ${idea.id}…`);
    const compiler = compilerParams(idea);
    const compilerSvg = paint(compiler);
    const compilerScore = sideScore(compiler, idea);
    const row: ThesisRow = {
      id: idea.id,
      title: idea.title,
      why: idea.why,
      card: idea.card,
      note: "",
      compilerSvg,
      modelSvg: null,
      compilerPlayers: countByTeam(compiler.players).total,
      modelPlayers: 0,
      compilerScore,
    };
    try {
      let raw = "";
      let scene;
      if (fromDir) {
        const saved = path.resolve(fromDir, `${idea.id}.model.json`);
        if (!fs.existsSync(saved)) throw new Error(`missing ${saved}`);
        scene = extractScene(fs.readFileSync(saved, "utf8"));
        raw = fs.readFileSync(saved, "utf8");
      } else {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            raw = await generateText(promptFor(idea), {
              responseMimeType: "application/json",
              maxOutputTokens: 8192,
              timeout: 60000,
            });
            scene = extractScene(raw);
            break;
          } catch (err) {
            if (attempt === 1) throw err;
            console.warn(`  retry ${idea.id}:`, err instanceof Error ? err.message : err);
            await sleep(600);
          }
        }
      }
      if (!scene) throw new Error("no scene");
      fs.writeFileSync(path.join(outDir, `${idea.id}.raw.txt`), raw);
      const modelParams = sceneToDrawerParams(idea, scene);
      fs.writeFileSync(path.join(outDir, `${idea.id}.model.json`), JSON.stringify(scene, null, 2));
      row.modelSvg = paint(modelParams);
      row.modelPlayers = countByTeam(modelParams.players).total;
      row.note = String(scene.note || "");
      row.modelScore = sideScore(modelParams, idea);

      if (visualOn) {
        row.compilerScore!.visual = await judgeSceneVisual({
          svg: row.compilerSvg,
          idea,
          params: compiler,
          outDir,
          tag: "compiler",
          frozenIssues: row.compilerScore!.frozenIssues,
        });
        await sleep(400);
        row.modelScore.visual = await judgeSceneVisual({
          svg: row.modelSvg,
          idea,
          params: modelParams,
          outDir,
          tag: "model",
          frozenIssues: row.modelScore.frozenIssues,
        });
        console.log(
          `  compiler ${row.compilerPlayers} frozen ${row.compilerScore!.frozenScore} visual ${row.compilerScore!.visual.verdict} ${row.compilerScore!.visual.confidence}` +
            ` · model ${row.modelPlayers} frozen ${row.modelScore.frozenScore} visual ${row.modelScore.visual.verdict} ${row.modelScore.visual.confidence}`
        );
      } else {
        console.log(
          `  compiler ${row.compilerPlayers} frozen ${row.compilerScore!.frozenScore}` +
            ` · model ${row.modelPlayers} frozen ${row.modelScore.frozenScore}` +
            (row.modelScore.frozenIssues.length ? ` (${row.modelScore.frozenIssues.join("; ")})` : "")
        );
      }
    } catch (err) {
      row.error = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL ${idea.id}:`, row.error);
    }
    rows.push(row);
    if (!fromDir && i < ideas.length - 1) await sleep(800);
  }

  const html = thesisHtml(rows, { outDir, model, visual: visualOn });
  const htmlPath = path.join(outDir, "compare.html");
  fs.writeFileSync(htmlPath, html);
  const slim = rows.map(({ compilerSvg: _c, modelSvg: _m, ...rest }) => rest);
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ model, visual: visualOn, outDir, rows: slim }, null, 2));
  console.log(`Open ${htmlPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
