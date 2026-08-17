import type { FirstPassFixture } from "./fixtures";
import { practiceSpaceYards, type FieldFormat } from "../../data/field-dimensions";

export const PROMPT_PACK_NAMES = ["base", "scene-lock", "dale-qa"] as const;
export type PromptPackName = (typeof PROMPT_PACK_NAMES)[number];

export function extraPromptForPack(pack: PromptPackName, fixture: FirstPassFixture): string {
  if (pack === "base") return "";
  if (pack === "scene-lock") return sceneLock(fixture);
  return daleQa(fixture);
}

function sceneLock(fixture: FirstPassFixture): string {
  const g = fixture.expectedFullGoals;
  const format = String(fixture.input.fieldFormat || "").replace("V", "v");
  const n = `${fixture.input.numbersMin}-${fixture.input.numbersMax} players`;
  const area = practiceSpaceYards(
    (fixture.input.fieldFormat || "7V7") as FieldFormat,
    String(fixture.input.spaceConstraint || "FULL")
  );
  const yards = `${area.lengthYards}×${area.widthYards} yards (full ${format} width, ${String(fixture.input.spaceConstraint || "").toLowerCase()} length)`;
  if (g === 0) {
    return [
      "VISUAL CONTRACT:",
      `- ${fixture.label}. Draw ${n} on a ${format} ${String(fixture.input.spaceConstraint || "").toLowerCase()}.`,
      "- No full-size goal and no GK token.",
      String(fixture.input.formationAttacking || "").includes("neutral")
        ? "- 4v4+neutrals: one mini-goal on EACH end, neutrals on the touchlines."
        : /rondo/i.test(fixture.label)
          ? "- This is a rondo: possession around a box, no mini-goals, no finishing zone."
          : "- 4v4 to two mini-goals means one pug on each end, not two on the same endline.",
    ].join("\n");
  }
  if (g === 1) {
    return [
      "VISUAL CONTRACT:",
      `- ${fixture.label}. This is a ${format} picture (${n}) on ${yards}.`,
      "- Exactly one full-size goal. Two mini-goals on the OPPOSITE end, 8-10 yards apart.",
      "- TWO green GK tokens: one in the full-size goal, one on the mini-goal end for restarts.",
      "- Never stand both GKs in the same net. Never demote the pug-end GK to a blue/red CB.",
      `- Outfield + GKs must still read as ${format} (each GK counts for their side). Not a 6v6 leftover and not a 7v6.`,
    ].join("\n");
  }
  return [
    "VISUAL CONTRACT:",
    `- ${fixture.label}. Two opposite full-size goals, one GK in each, on ${yards}.`,
    "- Spread players across the pitch. Do not park everyone in one third.",
    /DEFENDING/i.test(String(fixture.input.phase))
      ? "- DEFENDING: DEF's own goal stays on the RIGHT (x>=80). Compactness toward that net is correct. Do not flip the field."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function daleQa(fixture: FirstPassFixture): string {
  return [
    sceneLock(fixture),
    "",
    "FAILURES A USSF-C COACH ALREADY REJECTED — do not repeat them:",
    "- Extra red CB because a leftover GK was relabelled instead of moved.",
    "- Title 4v4 drawn as 4v5; title 6-8 players drawn as a 4v4 finishing third.",
    "- Two mini-goals stacked on one end when the drill plays both ways.",
    "- Mini-goals drawn as L-brackets on the corners instead of mouths facing into the field.",
    "- 11v11 to one full goal with no GK next to the puggs (that reads 10v10).",
    "- 11v11 third labeled 40×35 — that is a 7v7 box. 11v11 third is 40×80.",
    "- Blue CB standing in the full-size box next to the real GK.",
  ].join("\n");
}
