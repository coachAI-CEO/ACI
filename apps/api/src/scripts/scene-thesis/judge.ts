import fs from "fs";
import path from "path";
import type { DrawerParams } from "../../types/drawer";
import { judgePng, type VisualQaResult } from "../first-pass-diagrams/visual-qa";
import { renderSvgPreview } from "../first-pass-diagrams/preview";
import type { ThesisIdea } from "./ideas";
import { countByTeam } from "./compiler";

function facts(idea: ThesisIdea, params: DrawerParams): string[] {
  const counts = countByTeam(params.players);
  const att = params.players.filter((p) => p.team === "home").length;
  const def = params.players.filter((p) => p.team === "away").length;
  const gk = params.players.filter((p) => p.team === "gk").length;
  const full = params.goals.filter((g) => g.type === "full").length;
  const minis = params.goals.filter((g) => g.type === "mini" || g.type === "gate").length;
  const picture = idea.picture || "open";
  return [
    `Card id: ${idea.id} — ${idea.title}`,
    `Practice picture type: ${picture}.`,
    `License / diagram density: ${idea.coachLevel || "USSF_D"}.`,
    `Card asked for ~${idea.outfieldPerSide}v${idea.outfieldPerSide}${idea.keepers ? " + GKs" : ""}, field format ${idea.fieldFormat} is the pitch size not a required roster.`,
    `Painter drew: ${att} blue, ${def} red, ${gk} GK (${counts.total} shirts), ${full} full goals, ${minis} minis, ${params.lengthYards}×${params.widthYards}yd.`,
    idea.picture === "rondo"
      ? "RONDO: one ring in the MIDDLE. Fail two wing games, a finishing 4v4, or a full match dump."
      : idea.picture === "center"
        ? "CHANNEL / 1v1: a short picture in the MIDDLE. Fail 11v11 or two teams of five."
        : idea.picture === "matchup"
          ? "MATCHUP / switch: two teams facing. Red back line in THEIR half (between the ball and their GK), with recognizable shape — a line of four, not a clump. Mids may step. Fail a high line on the halfway AND fail a blob of overlapping reds."
          : "Draw THIS practice. Fail a generic 11v11 dump when the card is small-sided.",
    "GKs sit on the goal line, centred in the posts. Full goals left and right, y=50. Fail GKs in corners or an outfield shirt in a white net.",
    "Do not require 11v11 / 9v9 / 7v7 roster just because the field format says that. Do not fail orange minis for looking large. Do not fail missing formation-role completeness.",
  ];
}

export function sceneVisualPrompt(idea: ThesisIdea, params: DrawerParams, frozenIssues: string[]): string {
  return [
    "You are a USSF-C soccer coach doing visual QA on a TacticalEdge TRAINING diagram.",
    "The painter is dumb — it only draws what was placed. Judge whether the PICTURE shows the written practice.",
    "",
    "WRITTEN CARD:",
    idea.card,
    "",
    ...facts(idea, params),
    frozenIssues.length ? `Frozen checks already flagged: ${frozenIssues.join("; ")}` : "Frozen checks flagged nothing.",
    "",
    "Score confidence 0-100 for 'a club coach would use this card as-is to run THIS practice tomorrow'.",
    "The card's ONE concept must be visible as a picture a coach could point at. Shirts + goals + a pass are not enough.",
    "Switch of play: a long pass or run to the FAR flank, ball-side cluster vs weak-side target. Fail a centre-channel sequence into a striker with a finish.",
    "Press as a unit: several press arrows that converge on the ball. Fail two neat columns.",
    "Compactness between lines: two horizontal lines close together. Fail one vertical file of reds.",
    "Fail (confidence <= 55) if: the picture is a different practice than the card; shirts dumped as two 11v11 columns; rondo on the wings; GKs off the posts; defending team has no shape (overlapping blob); switch of play with a high line on the halfway; leftover outfield token in a full-size net.",
    "PASS a small-sided, readable picture that matches the card even if it is not a full match and even if arrows are a little busy.",
    "",
    "Return ONLY JSON: {\"confidence\": number, \"verdict\": \"pass\"|\"review\"|\"fail\", \"issues\": string[], \"summary\": string}",
    "verdict pass if confidence >= 80, review if 56-79, fail if <= 55.",
  ].join("\n");
}

export async function judgeSceneVisual(args: {
  svg: string;
  idea: ThesisIdea;
  params: DrawerParams;
  outDir: string;
  tag: "compiler" | "model";
  frozenIssues: string[];
}): Promise<VisualQaResult> {
  const svgPath = path.join(args.outDir, `${args.idea.id}.${args.tag}.svg`);
  fs.writeFileSync(svgPath, args.svg);
  const previewDir = path.join(args.outDir, "preview");
  const pngPath = renderSvgPreview(svgPath, previewDir);
  if (!pngPath) {
    return {
      confidence: args.frozenIssues.length ? 40 : 60,
      verdict: args.frozenIssues.length ? "fail" : "review",
      issues: ["could not render PNG preview (qlmanage)"],
      summary: "Fell back to frozen checks; no visual judge.",
    };
  }
  return judgePng({
    pngPath,
    prompt: sceneVisualPrompt(args.idea, args.params, args.frozenIssues),
    frozenIssues: args.frozenIssues,
  });
}
