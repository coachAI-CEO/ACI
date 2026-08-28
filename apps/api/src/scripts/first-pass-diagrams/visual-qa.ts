import fs from "fs";
import { generateMultimodalText } from "../../gemini";
import type { DrawerParams } from "../../types/drawer";
import { practiceSpaceYards, type FieldFormat } from "../../data/field-dimensions";
import type { FirstPassFixture } from "./fixtures";
import type { FirstPassScores } from "./score";

export type VisualVerdict = "pass" | "review" | "fail";

export type VisualQaResult = {
  confidence: number;
  verdict: VisualVerdict;
  issues: string[];
  summary: string;
};

/** Frozen + vision: the green pitch is framed around the tokens, not parked in a corner. */
export const VISUAL_FRAME_RULE =
  "The green pitch must be CENTERED on the players. Fail if tokens sit in one band of the grass with a vacant strip on the other sideline or end, or if the pitch rectangle is shifted in the card (uneven dark gutter). The field is always framed around the players.";

function parseJsonSafe(text: string): Record<string, unknown> | null {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first === -1 || last === -1) return null;
    return JSON.parse(cleaned.substring(first, last + 1));
  } catch {
    return null;
  }
}

function contractLines(fixture: FirstPassFixture, params: DrawerParams): string[] {
  const att = params.players.filter((p) => p.team === "home").length;
  const def = params.players.filter((p) => p.team === "away").length;
  const gk = params.players.filter((p) => p.team === "gk").length;
  const neu = params.players.filter((p) => p.team === "neutral").length;
  const full = params.goals.filter((g) => g.type === "full").length;
  const minis = params.goals.filter((g) => g.type === "mini" || g.type === "gate").length;
  const cap = practiceSpaceYards(
    (fixture.input.fieldFormat || "7V7") as FieldFormat,
    String(fixture.input.spaceConstraint || "FULL")
  );
  return [
    `Fixture: ${fixture.id} — ${fixture.label}`,
    `Format ${fixture.input.fieldFormat}, space ${fixture.input.spaceConstraint}, type ${fixture.input.drillType}.`,
    `Expected full goals: ${fixture.expectedFullGoals}. Legal player count is ${fixture.input.numbersMin}-${fixture.input.numbersMax} (field format ${fixture.input.fieldFormat} is the pitch, not a required 7+7 / 9+9 / 11+11 roster).`,
    `Compiler drew: ${att} attack, ${def} defend, ${gk} GK, ${neu} neutrals, ${full} full-size (WHITE net + penalty box), ${minis} mini-goals (ORANGE U on the endline).`,
    `Practice area on the picture: ${params.lengthYards}×${params.widthYards}yd. Legal ${fixture.input.fieldFormat} ${fixture.input.spaceConstraint} is ${cap.lengthYards}×${cap.widthYards}yd (full pitch width, sliced length).`,
    /DEFENDING/i.test(String(fixture.input.phase))
      ? "DEFENDING: the protected full-size goal stays on the RIGHT. A compact block in that half is correct. A high press toward the left is also correct. Fail if the picture flipped so we are defending the left net, or if this still reads as an attacking-third finishing pattern."
      : "ATTACKING: ATT's target stays on the RIGHT.",
    "An 11v11 third is 40×80, not 40×35. A 7v7 third is 22×45, not 35×25. Fail a match-format tactical/conditioned card whose yard labels are a small box.",
    "Equipment color: orange U = mini/pugg. White net with a 6-yard/18-yard box = full-size. Do not call an orange U a full-size goal even if crop made it large.",
    fixture.expectedFullGoals === 0
      ? /rondo/i.test(fixture.label)
        ? "This is a rondo: a possession box, NO goals, NO GK, NO finishing zone. That is the correct picture. Do not fail it for missing targets or neutrals."
        : "0-full: no GK. 4v4 / 4v4+neutrals = one orange mini on EACH end. Two orange Us on opposite ends is correct."
      : fixture.expectedFullGoals === 1
        ? "1-full: two orange minis on the opposite end from the white full-size net. TWO GKs is REQUIRED and CORRECT: one in the full-size net, one standing next to the puggs. Do not fail a pug-end GK."
        : "2-full: one white full-size goal each end, one GK each.",
  ];
}

export function frozenConfidence(scores: FirstPassScores): number {
  const checks = Object.values(scores);
  const ok = checks.filter((c) => c.ok).length;
  return Math.round((ok / Math.max(1, checks.length)) * 100);
}

export async function judgePng(args: {
  pngPath: string;
  prompt: string;
  frozenIssues: string[];
}): Promise<VisualQaResult> {
  const png = fs.readFileSync(args.pngPath);
  const requested = process.env.GEMINI_QA_MODEL || process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash-lite";
  if (/gemini-3\.[56]-flash$/i.test(requested) && !/lite/i.test(requested)) {
    throw new Error(`Refusing banned non-lite QA model "${requested}". Use gemini-3.5-flash-lite.`);
  }
  const text = await generateMultimodalText(
    [
      { text: args.prompt },
      { inlineData: { mimeType: "image/png", data: png.toString("base64") } },
    ],
    { timeout: Number(process.env.VISUAL_QA_TIMEOUT_MS || 60000), model: requested }
  );
  const parsed = parseJsonSafe(text);
  if (!parsed) {
    return {
      confidence: args.frozenIssues.length ? 40 : 60,
      verdict: args.frozenIssues.length ? "fail" : "review",
      issues: ["visual judge returned non-JSON"],
      summary: text.slice(0, 180),
    };
  }
  const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
  const verdict: VisualVerdict =
    parsed.verdict === "pass" || parsed.verdict === "fail" || parsed.verdict === "review"
      ? parsed.verdict
      : confidence >= 80
        ? "pass"
        : confidence <= 55
          ? "fail"
          : "review";
  const issues = Array.isArray(parsed.issues) ? parsed.issues.map(String).filter(Boolean) : [];
  return {
    confidence,
    verdict,
    issues,
    summary: String(parsed.summary || ""),
  };
}

export async function judgeDiagramVisual(args: {
  pngPath: string;
  fixture: FirstPassFixture;
  params: DrawerParams;
  frozenIssues: string[];
}): Promise<VisualQaResult> {
  const prompt = [
    "You are a USSF-C soccer coach doing visual QA on a training diagram.",
    "Judge the PICTURE, not the JSON. Frozen schema can pass while the card is still wrong.",
    "",
    ...contractLines(args.fixture, args.params),
    args.frozenIssues.length ? `Compiler already flagged: ${args.frozenIssues.join("; ")}` : "Compiler flagged nothing.",
    "",
    "Score confidence 0-100 for 'a club coach would use this card as-is'.",
    "Roster: pass if total tokens sit in the legal player-count range above. Do not require a full 11v11 (22) or 9v9 (18) just because the field format says that.",
    "Fail (confidence <= 55) if: leftover outfield (blue/red) token standing in a WHITE full-size net; NO GK on the pug end of a one-full-goal game; two minis on one end when there is NO full goal on the other end; rondo drawn as a finishing 4v4 with minis; total tokens outside the legal player-count range; 11v11/9v9/7v7 tactical or conditioned card labeled with a 7v7 box (35×25, 40×35) instead of full pitch width; " +
      VISUAL_FRAME_RULE,
    VISUAL_FRAME_RULE,
    "PASS these: orange mini-goals (even if they look large); a rondo box with no goals; GK next to the mini-goals on a one-full-goal card; two minis on the SAME end when a white full-size goal is on the opposite end; 20 tokens on an 11v11 one-full card if both GKs are present.",
    "",
    "Return ONLY JSON: {\"confidence\": number, \"verdict\": \"pass\"|\"review\"|\"fail\", \"issues\": string[], \"summary\": string}",
    "verdict pass if confidence >= 80, review if 56-79, fail if <= 55.",
  ].join("\n");

  return judgePng({ pngPath: args.pngPath, prompt, frozenIssues: args.frozenIssues });
}

export function sceneConfidence(rows: Array<{ visual?: VisualQaResult | null }>): number {
  const scored = rows.map((r) => r.visual?.confidence).filter((n): n is number => typeof n === "number");
  if (!scored.length) return 0;
  return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
}
