import "../config/load-env";
import fs from "fs";
import path from "path";
import { generateText } from "../gemini";
import { buildDrillPrompt, type DrillPromptInput } from "../prompts/drill-optimized-v2";
import { sanitizeDrillOutput } from "../services/drill";
import { applyYouthGuards } from "../services/youth-guards";
import { postProcessDrill } from "../services/postprocess";
import { needsDiagramEnrichment, reenrichDiagramFromDrillJson } from "../services/diagram-enrichment";
import { enforceDiagramGoalAvailability } from "../services/diagram-goals";
import { drillToDrawerParams } from "../mappers/drill-to-drawer-params";
import { renderDeterministicDiagramSVG } from "../services/deterministic-drawer-svg";
import { applyGoalOverlay } from "../services/goal-overlay";
import { computeTokenRadius, coverageRatio, scaleFactorFromTokenRadius, shouldZoomOut, ZOOM_OUT_THRESHOLD, type FieldFormat } from "../data/field-dimensions";
import type { DrawerParams } from "../types/drawer";

/**
 * Diagram sandbox.
 *
 * Generates a stratified batch of drills through the CURRENT generation
 * pipeline (no DB writes, no QA pass), scores each diagram against a set of
 * cheap structural checks, renders every diagram with the deterministic
 * (non-AI) SVG renderer, and writes an HTML contact sheet + a results.json
 * for programmatic comparison later (e.g. against a formation-lookup
 * variant).
 *
 * Usage:
 *   pnpm --filter api sandbox:diagram -- --count 30 --concurrency 3
 */

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

type Args = {
  count: number;
  concurrency: number;
  seed: number;
  out?: string;
  /** Case-insensitive substring match against FORMAT_PROFILES labels --
   * when set, every sample uses only matching profile(s) instead of
   * cycling through all of them. For targeted checks (e.g. "did we ever
   * get a drill with neutrals") rather than broad-coverage batches. */
  profile?: string;
};

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function parseArgs(): Args {
  const count = Number(getArgValue("--count") || 30);
  const concurrency = Number(getArgValue("--concurrency") || 3);
  const seed = Number(getArgValue("--seed") || 0);
  const out = getArgValue("--out");
  const profile = getArgValue("--profile");
  return {
    count: Number.isFinite(count) && count > 0 ? count : 30,
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 3,
    seed: Number.isFinite(seed) ? seed : 0,
    out,
    profile,
  };
}

// ---------------------------------------------------------------------------
// Stratified sample matrix
//
// Content dimensions (game model, age, phase, drill type...) are varied
// freely -- they don't affect diagram geometry. Format/formation dimensions
// are the ones that actually stress the thing we're evaluating, so they're
// pinned to named profiles instead of drawn independently.
// ---------------------------------------------------------------------------

type FormatProfile = {
  label: string;
  numbersMin: number;
  numbersMax: number;
  formationAttacking: string;
  formationDefending: string;
  goalsAvailable: number;
  /** Explicit, not guessed -- see DrillPromptInput.fieldFormat. Small-sided/
   * rondo profiles that don't correspond to a real match format still need
   * some reference for the coverage-ratio zoom decision, so they use 7V7
   * (the smallest tier) as the floor, same as the old player-count guess
   * would have picked anyway. */
  fieldFormat: FieldFormat;
};

const FORMAT_PROFILES: FormatProfile[] = [
  { label: "unopposed/rondo (6-8)", numbersMin: 6, numbersMax: 8, formationAttacking: "3-1", formationDefending: "2-1", goalsAvailable: 0, fieldFormat: "7V7" },
  { label: "small-sided 4v4 (2 mini goals)", numbersMin: 8, numbersMax: 10, formationAttacking: "2-2", formationDefending: "2-2", goalsAvailable: 2, fieldFormat: "7V7" },
  { label: "7v7", numbersMin: 12, numbersMax: 14, formationAttacking: "2-3-1", formationDefending: "3-2-1", goalsAvailable: 1, fieldFormat: "7V7" },
  { label: "9v9", numbersMin: 16, numbersMax: 18, formationAttacking: "3-2-3", formationDefending: "3-3-2", goalsAvailable: 1, fieldFormat: "9V9" },
  { label: "11v11", numbersMin: 20, numbersMax: 22, formationAttacking: "4-3-3", formationDefending: "4-4-2", goalsAvailable: 1, fieldFormat: "11V11" },
  { label: "one full goal + 2 mini goals", numbersMin: 12, numbersMax: 14, formationAttacking: "2-3-1", formationDefending: "3-2-1", goalsAvailable: 1, fieldFormat: "7V7" },
  // Nothing in the generation schema tells the model WHEN to add neutral
  // (joker) players -- team="NEUTRAL" is a valid schema value but purely
  // optional, so none of the other profiles have produced one yet. The
  // formationAttacking field is free text handed straight to the model
  // ("Position ATT players per formationAttacking=..."), so spelling out
  // "+2 neutrals" there is a lightweight way to request them without a
  // schema change -- worth promoting to a real field if this proves
  // reliable across repeated runs.
  { label: "possession rondo w/ neutrals (4v4+2)", numbersMin: 10, numbersMax: 10, formationAttacking: "2-2 +2 neutral jokers who always play for the team in possession", formationDefending: "2-2", goalsAvailable: 0, fieldFormat: "7V7" },
];

const gameModels = ["POSSESSION", "PRESSING", "TRANSITION", "COACHAI", "ROCKLIN_FC"];
const ageGroups = ["U10", "U11", "U12", "U13", "U14", "U15"];
const phases = ["ATTACKING", "DEFENDING", "TRANSITION"];
const zones = ["DEFENSIVE_THIRD", "MIDDLE_THIRD", "ATTACKING_THIRD"];
const drillTypes = ["TECHNICAL", "TACTICAL", "CONDITIONED_GAME", "FULL_GAME"];
const playerLevels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const coachLevels = ["USSF_D", "USSF_C", "USSF_B_PLUS"];
const spaceConstraints = ["THIRD", "HALF", "FULL", "QUARTER"];
const durations = [60, 90];

function pick<T>(list: T[], seed: number): T {
  return list[((seed % list.length) + list.length) % list.length];
}

function buildInput(seed: number, profilePool: FormatProfile[] = FORMAT_PROFILES): { input: DrillPromptInput; profileLabel: string } {
  const profile = pick(profilePool, seed);
  const input: DrillPromptInput = {
    gameModelId: pick(gameModels, seed + 1),
    ageGroup: pick(ageGroups, seed + 2),
    phase: pick(phases, seed + 3),
    zone: pick(zones, seed + 4),
    drillType: pick(drillTypes, seed + 5),
    numbersMin: profile.numbersMin,
    numbersMax: profile.numbersMax,
    goalsAvailable: profile.goalsAvailable,
    fieldFormat: profile.fieldFormat,
    spaceConstraint: pick(spaceConstraints, seed + 6),
    durationMin: pick(durations, seed + 7),
    formationAttacking: profile.formationAttacking,
    formationDefending: profile.formationDefending,
    playerLevel: pick(playerLevels, seed + 8),
    coachLevel: pick(coachLevels, seed + 9),
  };
  return { input, profileLabel: profile.label };
}

// ---------------------------------------------------------------------------
// Lightweight generation pipeline (no DB writes, no QA pass)
// ---------------------------------------------------------------------------

function parseJsonSafe(text: string): any {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return null;
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

async function generateDrillForSandbox(input: DrillPromptInput): Promise<{ raw: any; processed: any; sanitizerWarnings: string[] }> {
  const prompt = buildDrillPrompt(input);
  const model = process.env.GEMINI_DRILL_MODEL || process.env.GEMINI_GENERATION_MODEL;
  const text = await generateText(prompt, {
    timeout: Number(process.env.SANDBOX_GEN_TIMEOUT_MS || 45000),
    retries: Number(process.env.GEMINI_MAX_RETRIES ?? 1),
    model,
  });

  const parsed = parseJsonSafe(text);
  if (!parsed) throw new Error("Model returned non-JSON drill output");

  // Same sanitizer production runs: forbidden-key cleanup, orientation
  // inference/correction, and goal.teamAttacks alignment against player
  // centroids. Keeping this in the loop means the sandbox measures exactly
  // what real users see, not a rawer/unpatched version of it.
  const { drill, warnings: sanitizerWarnings } = sanitizeDrillOutput(parsed);

  applyYouthGuards(drill, input);

  let processed: any = {};
  try {
    processed = postProcessDrill({ json: drill }, input);
  } catch (err: any) {
    console.error(`  [postprocess error] ${err?.message || err}`);
  }

  try {
    if (needsDiagramEnrichment(drill?.diagram)) {
      const reenriched = await reenrichDiagramFromDrillJson(drill);
      if (reenriched) {
        drill.diagram = reenriched;
        if (processed?.json) processed.json.diagram = reenriched;
      }
    }
  } catch (err: any) {
    console.error(`  [diagram enrichment error] ${err?.message || err}`);
  }

  enforceDiagramGoalAvailability(drill, input);
  if (processed?.json) enforceDiagramGoalAvailability(processed.json, input);

  return { raw: drill, processed, sanitizerWarnings };
}

function buildDrillLike(json: any, processed: any, input: DrillPromptInput) {
  return {
    title: processed?.title || json.title || "Untitled",
    json,
    drillType: input.drillType,
    durationMin: processed?.durationMin ?? input.durationMin ?? 20,
    rpeMin: processed?.rpeMin ?? 4,
    rpeMax: processed?.rpeMax ?? 7,
    numbersMin: processed?.numbersMin ?? input.numbersMin,
    numbersMax: processed?.numbersMax ?? input.numbersMax,
  };
}

// ---------------------------------------------------------------------------
// Scorers -- pure code, no LLM. Each returns { ok, issues, ...details }.
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function extractSetupText(json: any): string {
  const org = asRecord(json.organization);
  const steps = Array.isArray(org.setupSteps) ? org.setupSteps.join(" ") : "";
  const description = typeof json.description === "string" ? json.description : "";
  return `${description} ${steps}`;
}

/**
 * Extract player-count mentions from free text, split into:
 *  - total: mentions clearly scoped to the whole group ("divide the 7 ...
 *    players", "7 total players", "all 7 players")
 *  - attackers / defenders: mentions scoped to one team ("4 attackers",
 *    "attacking team of 4 players", "4 attacking players")
 *
 * A bare "N players" with no attack/defend/divide/total anchor is NOT
 * assumed to be the grand total -- text commonly says "attacking team of 4
 * players" and "defending team of 3 players" in the same paragraph, and
 * those are subgroup counts that are expected to sum to the total, not
 * equal it individually.
 *
 * `\b` is required immediately before every `\d+` so a token like "U12"
 * (age group, e.g. "the 7 U12 players") can never have its embedded digits
 * misread as a separate count -- "U" and "1" are both word characters, so
 * there is no boundary between them and `\b\d` cannot match there.
 */
function extractMentionedPlayerCounts(text: string): { total: number[]; attackers: number[]; defenders: number[] } {
  const total = new Set<number>();
  const attackers = new Set<number>();
  const defenders = new Set<number>();

  const totalPatterns = [
    /\bdivide(?:\s+the)?\s+(\d+)\b/gi,
    /\b(\d+)\s+total\s+players?\b/gi,
    /\ball\s+(\d+)\s+players?\b/gi,
  ];
  for (const re of totalPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n < 30) total.add(n);
    }
  }

  // Negative lookahead on "defending" excludes phrases like "1 defending
  // goalkeeper" -- that's a GK count, not a defender-count mention, but
  // "defending" alone (no trailing "goalkeeper"/"gk") is still a valid
  // scoped mention ("1 defending player").
  const scopedPatterns: Array<[RegExp, Set<number>]> = [
    [/\battack(?:ing)?\s+team\s+of\s+(\d+)\b/gi, attackers],
    [/\b(\d+)\s+attack(?:ers|ing)\b/gi, attackers],
    [/\bdefend(?:ing)?\s+team\s+of\s+(\d+)\b/gi, defenders],
    [/\b(\d+)\s+defend(?:ers|ing)\b(?!\s+(?:goalkeepers?|gks?)\b)/gi, defenders],
  ];
  for (const [re, bucket] of scopedPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n < 30) bucket.add(n);
    }
  }

  return { total: [...total], attackers: [...attackers], defenders: [...defenders] };
}

function scoreCountConsistency(json: any, params: DrawerParams) {
  const diagramCount = params.players.length;
  const onField = asRecord(json.numbersOnField);
  const attackersOnField = Number(onField.attackersOnField);
  const defendersOnField = Number(onField.defendersOnField);

  // Prefer the model's own explicit total -- it's unambiguous. Reconstructing
  // the total from attackersOnField + defendersOnField + neutralsOnField
  // requires guessing whether the GK is already folded into one of those
  // numbers or needs to be added separately via gkForAttack/gkForDefend, and
  // the model is NOT consistent about which convention it uses from drill to
  // drill -- confirmed false positive: one drill's defendersOnField already
  // included the GK ("7 defenders (including GK)"), so adding +1 more for
  // gkForDefend=true double-counted it and flagged a correct diagram as
  // wrong. totalPlayersOnField is a required schema field and doesn't have
  // this ambiguity, so trust it directly whenever it's present.
  const declaredTotal = Number(onField.totalPlayersOnField);
  let onFieldTotal: number | null;
  if (Number.isFinite(declaredTotal)) {
    onFieldTotal = declaredTotal;
  } else {
    const onFieldParts = ["attackersOnField", "defendersOnField", "neutralsOnField"]
      .map((k) => Number(onField[k]))
      .filter((n) => Number.isFinite(n));
    const gkExtra = (onField.gkForAttack === true ? 1 : 0) + (onField.gkForDefend === true ? 1 : 0);
    onFieldTotal = onFieldParts.length ? onFieldParts.reduce((a, b) => a + b, 0) + gkExtra : null;
  }
  const numbers = asRecord(json.numbers);
  const declaredMin = Number(numbers.min);
  const declaredMax = Number(numbers.max);
  const textCounts = extractMentionedPlayerCounts(extractSetupText(json));

  const issues: string[] = [];
  if (diagramCount === 0) issues.push("diagram.players is empty");
  if (onFieldTotal != null && onFieldTotal !== diagramCount) {
    issues.push(`numbersOnField totals ${onFieldTotal} but diagram has ${diagramCount} players`);
  }
  if (Number.isFinite(declaredMin) && Number.isFinite(declaredMax) && diagramCount > 0) {
    if (diagramCount < declaredMin - 1 || diagramCount > declaredMax + 1) {
      issues.push(`diagram player count ${diagramCount} falls outside declared numbers ${declaredMin}-${declaredMax}`);
    }
  }
  if (textCounts.total.length && diagramCount > 0 && !textCounts.total.includes(diagramCount)) {
    issues.push(`setup text says the total is [${textCounts.total.join(", ")}] but diagram has ${diagramCount}`);
  }
  // Same GK-inclusion ambiguity as the total above, at the per-team level --
  // and it cuts both ways: sometimes prose says "10 defenders ... and 1
  // goalkeeper" (GK separate) while numbersOnField.defendersOnField folds
  // the GK in (11); other times prose says "9 defenders" already counting
  // the GK while numbersOnField.defendersOnField excludes it (8). The model
  // isn't consistent about which convention it uses from drill to drill, so
  // accept the field's own value plus or minus one GK.
  const attackersTextMatch = (n: number) => n === attackersOnField || (onField.gkForAttack === true && Math.abs(n - attackersOnField) === 1);
  const defendersTextMatch = (n: number) => n === defendersOnField || (onField.gkForDefend === true && Math.abs(n - defendersOnField) === 1);
  if (textCounts.attackers.length && Number.isFinite(attackersOnField) && !textCounts.attackers.some(attackersTextMatch)) {
    issues.push(`setup text mentions [${textCounts.attackers.join(", ")}] attacker(s) but numbersOnField says ${attackersOnField}`);
  }
  if (textCounts.defenders.length && Number.isFinite(defendersOnField) && !textCounts.defenders.some(defendersTextMatch)) {
    issues.push(`setup text mentions [${textCounts.defenders.join(", ")}] defender(s) but numbersOnField says ${defendersOnField}`);
  }

  return { ok: issues.length === 0, diagramCount, onFieldTotal, declaredMin, declaredMax, textCounts, issues };
}

function scoreSpacing(params: DrawerParams) {
  const pts = params.players;
  const issues: string[] = [];
  let minDist: number | null = null;

  if (pts.length >= 2) {
    minDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < minDist) minDist = d;
      }
    }
    if (minDist < 4) issues.push(`two players are only ${minDist.toFixed(1)} units apart (overlap risk on an 0-100 scale)`);

    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const spreadX = Math.max(...xs) - Math.min(...xs);
    const spreadY = Math.max(...ys) - Math.min(...ys);
    if (spreadX < 5 && spreadY < 5) issues.push("all players are clustered at a single point");
  }

  return { ok: issues.length === 0, minDistance: minDist != null && Number.isFinite(minDist) ? Number(minDist.toFixed(1)) : null, issues };
}

/**
 * Catches the "arrow references an unmatched playerId" bug: the mapper now
 * drops degenerate (near-zero-length) arrows rather than rendering an
 * invisible line, but a drop should still be visible here -- a coach
 * looking at a 4-arrow diagram when the model wrote 8 deserves to know why.
 */
function scoreArrows(json: any, params: DrawerParams) {
  const diagram = asRecord(json.diagram);
  const rawCount = Array.isArray(diagram.arrows) ? diagram.arrows.length : 0;
  const renderedCount = params.arrows.length;
  const droppedCount = Math.max(0, rawCount - renderedCount);
  const issues: string[] = [];
  if (droppedCount > 0) {
    issues.push(
      `${droppedCount} of ${rawCount} arrow(s) were dropped as degenerate (zero-length after resolving from/to) -- likely a playerId that didn't match diagram.players`
    );
  }
  return { ok: issues.length === 0, rawCount, renderedCount, droppedCount, issues };
}

function scoreGoals(json: any, params: DrawerParams, processed: any) {
  const goalMode = String(processed?.goalMode || json.goalMode || "").toUpperCase();
  const goalsAvailable = Number(processed?.goalsAvailable ?? json.goalsAvailable ?? 0);
  const goals = params.goals;
  const fullGoals = goals.filter((g) => g.type === "full").length;
  const miniGoals = goals.filter((g) => g.type !== "full").length;
  const gkCount = params.players.filter((p) => p.team === "gk").length;

  const issues: string[] = [];
  if (goalsAvailable > 0 && goals.length === 0) issues.push("goalsAvailable > 0 but no goals present in diagram");
  if (goalMode === "LARGE" && fullGoals < 1) issues.push("goalMode LARGE but no full-size goal drawn");
  if (goalMode === "MINI2" && miniGoals < 2) issues.push("goalMode MINI2 but fewer than 2 mini/gate goals drawn");
  if (goalMode === "LARGE" && fullGoals >= 1 && params.players.length >= 12 && gkCount === 0) {
    issues.push("full-goal format with 12+ players but no player labelled GK");
  }

  return { ok: issues.length === 0, goalMode, goalsAvailable, fullGoals, miniGoals, gkCount, issues };
}

function scoreTeamPresence(params: DrawerParams) {
  const attackers = params.players.filter((p) => p.team === "home" || p.team === "gk").length;
  const defenders = params.players.filter((p) => p.team === "away").length;
  const issues: string[] = [];
  if (attackers === 0) issues.push("no attacking-team players");
  if (defenders === 0 && params.players.length > 0) issues.push("no defending-team players (may be intentional for an unopposed drill)");
  return { ok: attackers > 0, attackers, defenders, issues };
}

/**
 * Orientation / attack-direction sanity.
 *
 * Reads the raw (post-sanitizer) diagram, not the mapped DrawerParams,
 * because DrawerParams drops goal.teamAttacks. Two independent checks:
 *
 * 1. Does declared pitch.orientation actually match where the goals/players
 *    sit? (Re-derives orientation with the same heuristic the production
 *    sanitizer uses to auto-correct it, then compares -- this catches cases
 *    where that heuristic's own fallback logic produced a meaningless
 *    default, e.g. mixed-axis goals or too few players to infer from.)
 * 2. After applying the same top/bottom -> left/right rotation the
 *    deterministic renderer applies, is the attacking team's centroid
 *    actually closer to the goal it attacks than the defending team's
 *    centroid is? This is the "is the team facing the right way" check.
 */
function scoreOrientation(json: any, params: DrawerParams) {
  const diagram = asRecord(json.diagram);
  const pitch = asRecord(diagram.pitch);
  const declaredOrientation = String(pitch.orientation || "").toUpperCase() || null;
  const rawGoals: any[] = Array.isArray(diagram.goals) ? diagram.goals : [];
  const rawPlayers: any[] = Array.isArray(diagram.players) ? diagram.players : [];

  const issues: string[] = [];

  const hasLeftRight = rawGoals.some((g) => Number(g?.x) <= 20 || Number(g?.x) >= 80);
  const hasTopBottom = rawGoals.some((g) => Number(g?.y) <= 20 || Number(g?.y) >= 80);
  let inferredOrientation: "HORIZONTAL" | "VERTICAL" | null = null;
  if (hasLeftRight && !hasTopBottom) inferredOrientation = "HORIZONTAL";
  else if (hasTopBottom && !hasLeftRight) inferredOrientation = "VERTICAL";
  else if (rawPlayers.length >= 2) {
    const xs = rawPlayers.map((p) => Number(p?.x)).filter((n) => Number.isFinite(n));
    const ys = rawPlayers.map((p) => Number(p?.y)).filter((n) => Number.isFinite(n));
    const rangeX = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
    const rangeY = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
    // The rendered field panel is landscape (688x382, ~1.8x wider than
    // tall -- see deterministic-drawer-svg.ts/gemini-drawer-prompt.ts).
    // Comparing raw PERCENT ranges directly ignored that: a raw spread
    // with rangeY only slightly bigger than rangeX still renders wider
    // than tall once mapped onto that wide field, so it was flagging
    // genuinely horizontal-looking diagrams as "vertically shaped."
    // Weight both ranges by the field's actual pixel dimensions before
    // comparing, so this matches what the render actually looks like.
    const pxRangeX = rangeX * 688;
    const pxRangeY = rangeY * 382;
    inferredOrientation = pxRangeY > pxRangeX ? "VERTICAL" : "HORIZONTAL";
  }
  if (inferredOrientation && declaredOrientation && inferredOrientation !== declaredOrientation) {
    issues.push(`pitch.orientation is "${declaredOrientation}" but the goal/player layout looks ${inferredOrientation}`);
  }

  // Hard rule: the diagram must always be horizontal, never vertical.
  // Goal-based drills get auto-rotated to horizontal at render time
  // (deterministic-drawer-svg.ts keys off goal position), but goal-less
  // zone/target drills have nothing to trigger that rotation -- a
  // vertically-shaped layout there renders vertical with no safety net.
  // So this must be checked here, not assumed fixed downstream.
  if (declaredOrientation === "VERTICAL") {
    issues.push(`pitch.orientation is declared "VERTICAL" -- the diagram must always be HORIZONTAL, never vertical`);
  }
  if (inferredOrientation === "VERTICAL") {
    issues.push(`the actual goal/player layout is vertically shaped -- the diagram must always be HORIZONTAL, never vertical`);
  }

  // Matches deterministic-drawer-svg.ts's rotateVerticalData condition exactly.
  const rotate =
    rawGoals.some((g) => Number(g?.y) <= 15 || Number(g?.y) >= 85) &&
    !rawGoals.some((g) => Number(g?.x) <= 15 || Number(g?.x) >= 85);
  const orient = (x: number, y: number) => (rotate ? { x: 100 - y, y: x } : { x, y });

  const attGoal = rawGoals.find((g) => String(g?.teamAttacks || "").toUpperCase() === "ATT");
  const attPlayers = rawPlayers.filter((p) => String(p?.team || "").toUpperCase() === "ATT");
  const defPlayers = rawPlayers.filter((p) => String(p?.team || "").toUpperCase() === "DEF");

  // NOT enforced: "ATT centroid should be closer to its target than DEF's
  // centroid" looks like a clean backwards-detector but isn't -- a
  // legitimate high press puts DEF's players ahead of (closer to the goal
  // than) ATT's, and this flagged several genuinely-correct diagrams as
  // "backwards" in sandbox testing (e.g. DEF pushed up to x=80-82 pressing
  // ATT, correctly labeled goal at x=93 -- not mirrored, just a high block).
  // Distances are still computed and reported for visibility, just not
  // used to fail the check or trigger any auto-correction.
  let attackDirectionChecked = false;
  let attCentroidDist: number | null = null;
  let defCentroidDist: number | null = null;
  if (attGoal && attPlayers.length && defPlayers.length) {
    attackDirectionChecked = true;
    const attGoalPt = orient(Number(attGoal.x ?? 50), Number(attGoal.y ?? 50));
    const centroid = (players: any[]) => {
      const pts = players.map((p) => orient(Number(p.x ?? 50), Number(p.y ?? 50)));
      return {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      };
    };
    const attCentroid = centroid(attPlayers);
    const defCentroid = centroid(defPlayers);
    attCentroidDist = Math.hypot(attCentroid.x - attGoalPt.x, attCentroid.y - attGoalPt.y);
    defCentroidDist = Math.hypot(defCentroid.x - attGoalPt.x, defCentroid.y - attGoalPt.y);
  }

  // Honesty flag: "ok: true" with nothing actually checked (no goals to
  // infer orientation from, no ATT/DEF goal pair to test attack direction
  // against -- e.g. zone-target drills with no goals at all) is
  // indistinguishable from a verified pass unless callers also look at
  // `applicable`. Treat non-applicable as non-blocking (not a fail) but
  // never let it silently count as a verified pass in the summary/report.
  const applicable = (declaredOrientation !== null && inferredOrientation !== null) || attackDirectionChecked;

  return {
    ok: issues.length === 0,
    applicable,
    declaredOrientation,
    inferredOrientation,
    attackDirectionChecked,
    attCentroidDist,
    defCentroidDist,
    issues,
  };
}

/**
 * Checks the fixed, absolute direction convention in drill-optimized-v2.ts's
 * getPhaseGuidance(): the diagram is always horizontal, and DEF's own
 * goal/protected target (== what ATT attacks, same location) always sits
 * on the RIGHT edge (x>=80) -- never inferred, never chosen per-drill,
 * never flipped, regardless of phase.
 *
 * This deliberately does NOT check average player position (ATT vs DEF
 * x). An earlier version did, but that assumes a low-block DEF shape --
 * a high-pressing DEF in a DEFENDING-phase drill legitimately sits ahead
 * of or level with ATT, so "DEF must always be at higher/lower x than
 * ATT" isn't actually a fixed tactical truth. Where the goal/target sits
 * IS always fixed, so that's the only thing checked here.
 */
function scorePhaseDirection(json: any, input: DrillPromptInput) {
  const diagram = asRecord(json.diagram);
  const rawGoals: any[] = Array.isArray(diagram.goals) ? diagram.goals : [];

  const issues: string[] = [];
  let applicable = false;

  // attGoal = the goal with teamAttacks="ATT" = the goal ATT shoots at = DEF's
  // own goal (DEF defends it) -- fixed on the right. "defGoal" = the goal
  // with teamAttacks="DEF" = ATT's own goal (only relevant in real two-goal
  // formats) -- fixed on the left, the opposite end of the same pitch.
  const attGoal = rawGoals.find((g) => String(g?.teamAttacks || "").toUpperCase() === "ATT");
  const defGoal = rawGoals.find((g) => String(g?.teamAttacks || "").toUpperCase() === "DEF");
  if (attGoal) {
    applicable = true;
    const x = Number(attGoal.x ?? 50);
    if (x < 80) issues.push(`the goal ATT attacks (DEF's own goal) sits at x=${x} -- it must sit near the RIGHT edge (x>=80)`);
  }
  if (defGoal) {
    applicable = true;
    const x = Number(defGoal.x ?? 50);
    if (x > 20) issues.push(`the goal DEF attacks (ATT's own goal) sits at x=${x} -- it must sit near the LEFT edge (x<=20)`);
  }

  const goalsAvailable = Number(json.goalsAvailable ?? input.goalsAvailable ?? 0);
  const zones = [
    ...(Array.isArray(diagram.zones) ? diagram.zones : []),
    ...(Array.isArray(diagram.safeZones) ? diagram.safeZones : []),
  ];
  // "Counter Target Zone" is where DEF counters to after winning the ball --
  // that's correctly near ATT's own goal (x near 0), not x>=80. Only an
  // ATT-owned target zone (no "counter" framing) is guaranteed to sit on
  // the right; a counter target's side depends on which team just won the
  // ball, which this scorer has no way to know, so it's excluded rather
  // than guessed at (same reasoning as the removed attack-direction check).
  const targetZones = zones.filter(
    (z) => /target/i.test(String(z?.label || "")) && !/counter/i.test(String(z?.label || ""))
  );
  let targetZoneChecked = false;
  if (goalsAvailable === 0 && targetZones.length) {
    targetZoneChecked = true;
    applicable = true;
    for (const zone of targetZones) {
      const zoneX = Number(zone.x ?? 50);
      if (zoneX < 80) {
        issues.push(`target zone "${zone.label}" sits at x=${zoneX} -- ATT's target must sit near the RIGHT edge (x>=80), never mid-field, the left edge, or a top/bottom band`);
      }
    }
  }

  return { ok: issues.length === 0, applicable, targetZoneChecked, issues };
}

/**
 * Checks the POSITION SIDE LOCK rule in drill-optimized-v2.ts: a role's
 * Left/Right prefix is relative to that TEAM's own facing direction, not
 * the page, and the two teams face opposite ways -- ATT faces right, DEF
 * faces left (mirrored). Getting DEF's L/R backwards (e.g. DEF's "LB"
 * drawn in the page's top half instead of bottom) was a real, confirmed
 * defect found by inspecting a rendered diagram, not a hypothetical.
 */
function scoreRoleSide(json: any) {
  const diagram = asRecord(json.diagram);
  const rawPlayers: any[] = Array.isArray(diagram.players) ? diagram.players : [];

  const issues: string[] = [];
  let checked = 0;

  for (const p of rawPlayers) {
    const team = String(p?.team || "").toUpperCase();
    if (team !== "ATT" && team !== "DEF") continue;
    const role = String(p?.role || "").toUpperCase();
    const match = role.match(/^([LR])[A-Z]/);
    if (!match) continue;

    const roleSide: "LEFT" | "RIGHT" = match[1] === "L" ? "LEFT" : "RIGHT";
    const y = Number(p?.y ?? 50);
    if (y >= 40 && y <= 60) continue; // too central to judge reliably

    const pageSide: "TOP" | "BOTTOM" = y < 50 ? "TOP" : "BOTTOM";
    // ATT faces right: left->top, right->bottom. DEF faces left (mirrored): left->bottom, right->top.
    const expectedPageSide: "TOP" | "BOTTOM" =
      team === "ATT" ? (roleSide === "LEFT" ? "TOP" : "BOTTOM") : roleSide === "LEFT" ? "BOTTOM" : "TOP";

    checked++;
    if (pageSide !== expectedPageSide) {
      issues.push(
        `${team} role="${p.role}" (${roleSide}-side for that team) is at y=${y} (${pageSide.toLowerCase()} half) -- should be in the ${expectedPageSide.toLowerCase()} half given ${team}'s facing direction`
      );
    }
  }

  return { ok: issues.length === 0, applicable: checked > 0, checked, issues };
}

// ---------------------------------------------------------------------------
// Concurrency-limited runner
// ---------------------------------------------------------------------------

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function next(): Promise<void> {
    const i = cursor++;
    if (i >= items.length) return;
    results[i] = await worker(items[i], i);
    return next();
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Record type + report rendering
// ---------------------------------------------------------------------------

type DrillDetails = {
  description: string;
  setupSteps: string[];
  coachingPoints: string[];
  rotation: string;
  numbersOnField: Record<string, unknown>;
  numbers: { min: number | null; max: number | null };
  formationAttacking: string;
  formationDefending: string;
  goalMode: string;
  players: Array<{ team: string; role: string; label?: string; x: number; y: number }>;
  fieldFormat: string;
  coverageRatio: number;
  zoomOut: boolean;
};

type SandboxRecord = {
  idx: number;
  profileLabel: string;
  input: DrillPromptInput;
  title: string | null;
  format: string | null;
  pass: boolean;
  scores: {
    countConsistency: ReturnType<typeof scoreCountConsistency>;
    spacing: ReturnType<typeof scoreSpacing>;
    arrows: ReturnType<typeof scoreArrows>;
    goals: ReturnType<typeof scoreGoals>;
    orientation: ReturnType<typeof scoreOrientation>;
    phaseDirection: ReturnType<typeof scorePhaseDirection>;
    roleSide: ReturnType<typeof scoreRoleSide>;
    teamPresence: ReturnType<typeof scoreTeamPresence>;
  } | null;
  sanitizerWarnings: string[];
  details: DrillDetails | null;
  svg: string | null;
  durationMs: number;
  error: string | null;
};

function buildDrillDetails(json: any, params: DrawerParams, input: DrillPromptInput): DrillDetails {
  const org = asRecord(json.organization);
  const numbers = asRecord(json.numbers);
  const onField = asRecord(json.numbersOnField);
  const fieldFormat = params.fieldFormat;
  const ratio = coverageRatio(params.widthYards, params.lengthYards, fieldFormat);
  return {
    description: typeof json.description === "string" ? json.description : "",
    setupSteps: Array.isArray(org.setupSteps) ? org.setupSteps.map(String) : [],
    coachingPoints: Array.isArray(json.coachingPoints) ? json.coachingPoints.map(String) : [],
    rotation: typeof org.rotation === "string" ? org.rotation : "",
    numbersOnField: asRecord(json.numbersOnField),
    numbers: {
      min: Number.isFinite(Number(numbers.min)) ? Number(numbers.min) : null,
      max: Number.isFinite(Number(numbers.max)) ? Number(numbers.max) : null,
    },
    formationAttacking: input.formationAttacking,
    formationDefending: input.formationDefending,
    goalMode: String(json.goalMode || ""),
    players: params.players.map((p) => ({ team: p.team, role: p.role, label: p.label, x: p.x, y: p.y })),
    fieldFormat,
    coverageRatio: ratio,
    zoomOut: shouldZoomOut(params.widthYards, params.lengthYards, fieldFormat),
  };
}

function badge(ok: boolean, label: string, applicable: boolean = true): string {
  if (!applicable) {
    return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#94a3b8;background:rgba(148,163,184,0.12);border:1px solid #64748b;margin:2px 4px 2px 0;">N/A ${label}</span>`;
  }
  const color = ok ? "#16a34a" : "#dc2626";
  const bg = ok ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.15)";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:${color};background:${bg};border:1px solid ${color};margin:2px 4px 2px 0;">${ok ? "PASS" : "FAIL"} ${label}</span>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildReportHtml(records: SandboxRecord[]): string {
  const total = records.length;
  const errored = records.filter((r) => r.error).length;
  const passed = records.filter((r) => !r.error && r.pass).length;
  const failed = total - errored - passed;

  const cards = records
    .map((r) => {
      if (r.error) {
        return `<div class="card card-error">
          <div class="card-head"><h3>#${r.idx} — ${escapeHtml(r.profileLabel)}</h3><span class="tag tag-error">ERROR</span></div>
          <pre class="error-text">${escapeHtml(r.error)}</pre>
          <pre class="input-dump">${escapeHtml(JSON.stringify(r.input, null, 2))}</pre>
        </div>`;
      }

      const s = r.scores!;
      const badges = [
        badge(s.countConsistency.ok, "counts"),
        badge(s.spacing.ok, "spacing"),
        badge(s.arrows.ok, "arrows"),
        badge(s.goals.ok, "goals"),
        badge(s.orientation.ok, "orientation", s.orientation.applicable),
        badge(s.phaseDirection.ok, "phase-dir", s.phaseDirection.applicable),
        badge(s.roleSide.ok, "role-side", s.roleSide.applicable),
        badge(s.teamPresence.ok, "teams"),
      ].join("");
      const allIssues = [
        ...s.countConsistency.issues,
        ...s.phaseDirection.issues,
        ...s.roleSide.issues,
        ...s.spacing.issues,
        ...s.arrows.issues,
        ...s.goals.issues,
        ...s.orientation.issues,
        ...s.teamPresence.issues,
      ];
      const issuesHtml = allIssues.length
        ? `<ul class="issues">${allIssues.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
        : `<p class="no-issues">No issues detected by the automatic checks.</p>`;

      const d = r.details;
      const detailsHtml = d
        ? `<details class="drill-details">
            <summary>Drill details (compare against the drawing)</summary>
            <div class="detail-section">
              <h4>Description</h4>
              <p>${escapeHtml(d.description || "(none)")}</p>
            </div>
            <div class="detail-section">
              <h4>Setup steps</h4>
              ${d.setupSteps.length ? `<ol>${d.setupSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>` : "<p>(none)</p>"}
            </div>
            ${d.rotation ? `<div class="detail-section"><h4>Rotation</h4><p>${escapeHtml(d.rotation)}</p></div>` : ""}
            <div class="detail-section">
              <h4>Coaching points</h4>
              ${d.coachingPoints.length ? `<ul>${d.coachingPoints.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : "<p>(none)</p>"}
            </div>
            <div class="detail-section">
              <h4>Declared numbers</h4>
              <p>numbers: ${d.numbers.min ?? "?"}-${d.numbers.max ?? "?"} &nbsp;·&nbsp; numbersOnField: ${escapeHtml(JSON.stringify(d.numbersOnField))} &nbsp;·&nbsp; goalMode: ${escapeHtml(d.goalMode || "?")}</p>
              <p>formation: ATT ${escapeHtml(d.formationAttacking)} vs DEF ${escapeHtml(d.formationDefending)}</p>
            </div>
            <div class="detail-section">
              <h4>Field coverage (not yet rendered -- informational only)</h4>
              <p>nearest real format: ${escapeHtml(d.fieldFormat)} &nbsp;·&nbsp; practice area covers ${(d.coverageRatio * 100).toFixed(0)}% of a real ${escapeHtml(d.fieldFormat)} pitch &nbsp;·&nbsp; ${d.zoomOut ? `would ZOOM OUT (below ${(ZOOM_OUT_THRESHOLD * 100).toFixed(0)}% threshold)` : "would zoom in (fills most of the real pitch)"}</p>
            </div>
            <div class="detail-section">
              <h4>Diagram players (${d.players.length})</h4>
              <table class="player-table">
                <thead><tr><th>team</th><th>role/label</th><th>x</th><th>y</th></tr></thead>
                <tbody>${d.players
                  .map((p) => `<tr><td>${escapeHtml(p.team)}</td><td>${escapeHtml(p.label || p.role || "")}</td><td>${p.x}</td><td>${p.y}</td></tr>`)
                  .join("")}</tbody>
              </table>
            </div>
            ${r.sanitizerWarnings.length
              ? `<div class="detail-section"><h4>Auto-corrections applied (production sanitizer)</h4><ul>${r.sanitizerWarnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>`
              : `<div class="detail-section"><h4>Auto-corrections applied (production sanitizer)</h4><p>(none -- the model got orientation/goal-side right on its own)</p></div>`}
          </details>`
        : "";

      return `<div class="card ${r.pass ? "card-pass" : "card-fail"}">
        <div class="card-head">
          <h3>#${r.idx} — ${escapeHtml(r.title || "Untitled")}</h3>
          <span class="tag ${r.pass ? "tag-pass" : "tag-fail"}">${r.pass ? "PASS" : "FAIL"}</span>
        </div>
        <div class="meta">${escapeHtml(r.profileLabel)} · ${escapeHtml(r.format || "")} · ${escapeHtml(r.input.gameModelId)} · ${escapeHtml(r.input.phase)} · ${escapeHtml(r.input.zone)} · ${escapeHtml(r.input.ageGroup)} · ${r.durationMs}ms</div>
        <div class="badges">${badges}</div>
        <div class="svg-wrap">${r.svg}</div>
        ${issuesHtml}
        ${detailsHtml}
      </div>`;
    })
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Diagram sandbox report</title>
<style>
  body { background:#0b1220; color:#e2e8f0; font-family:Arial, sans-serif; margin:0; padding:24px; }
  h1 { font-size:20px; margin:0 0 4px; }
  .summary { color:#94a3b8; margin-bottom:20px; }
  .summary b { color:#e2e8f0; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(420px, 1fr)); gap:16px; }
  .card { background:#111a2c; border-radius:10px; padding:14px; border:1px solid rgba(255,255,255,0.08); overflow-x:auto; }
  .card-pass { border-color:rgba(22,163,74,0.4); }
  .card-fail { border-color:rgba(220,38,38,0.4); }
  .card-error { border-color:rgba(234,179,8,0.5); }
  .card-head { display:flex; justify-content:space-between; align-items:center; gap:8px; }
  .card-head h3 { font-size:14px; margin:0; }
  .tag { font-size:11px; font-weight:800; padding:2px 8px; border-radius:6px; }
  .tag-pass { background:rgba(22,163,74,0.2); color:#4ade80; }
  .tag-fail { background:rgba(220,38,38,0.2); color:#f87171; }
  .tag-error { background:rgba(234,179,8,0.2); color:#facc15; }
  .meta { color:#94a3b8; font-size:12px; margin:6px 0; }
  .badges { margin-bottom:8px; }
  .svg-wrap svg { width:100%; height:auto; display:block; border-radius:6px; }
  .issues { margin:8px 0 0; padding-left:18px; color:#fca5a5; font-size:12px; }
  .no-issues { color:#4ade80; font-size:12px; margin:8px 0 0; }
  .error-text { color:#fca5a5; font-size:12px; white-space:pre-wrap; }
  .input-dump { color:#64748b; font-size:11px; white-space:pre-wrap; max-height:160px; overflow:auto; }
  .drill-details { margin-top:10px; border-top:1px solid rgba(255,255,255,0.08); padding-top:8px; }
  .drill-details summary { cursor:pointer; font-size:12px; color:#93c5fd; font-weight:700; }
  .detail-section { margin:10px 0; }
  .detail-section h4 { font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#64748b; margin:0 0 4px; }
  .detail-section p, .detail-section li { font-size:12.5px; color:#cbd5e1; line-height:1.5; }
  .detail-section ol, .detail-section ul { margin:0; padding-left:18px; }
  .player-table { width:100%; border-collapse:collapse; font-size:11.5px; }
  .player-table th, .player-table td { text-align:left; padding:3px 6px; border-bottom:1px solid rgba(255,255,255,0.06); color:#cbd5e1; }
  .player-table th { color:#64748b; font-weight:700; }
</style>
</head>
<body>
  <h1>Diagram sandbox report</h1>
  <div class="summary"><b>${total}</b> samples · <b style="color:#4ade80">${passed} pass</b> · <b style="color:#f87171">${failed} fail</b> · <b style="color:#facc15">${errored} error</b></div>
  <div class="grid">
    ${cards}
  </div>
</body>
</html>`;
}

function printSummary(records: SandboxRecord[]) {
  const total = records.length;
  const errored = records.filter((r) => r.error);
  const scored = records.filter((r) => !r.error && r.scores);
  const passed = scored.filter((r) => r.pass);

  console.log("\n=== Diagram sandbox summary ===");
  console.log(`Total samples: ${total}`);
  console.log(`Errored:       ${errored.length}`);
  console.log(`Passed:        ${passed.length}/${scored.length}`);

  const byCheck: Record<string, { ok: number; total: number; notApplicable: number }> = {
    countConsistency: { ok: 0, total: 0, notApplicable: 0 },
    spacing: { ok: 0, total: 0, notApplicable: 0 },
    arrows: { ok: 0, total: 0, notApplicable: 0 },
    goals: { ok: 0, total: 0, notApplicable: 0 },
    orientation: { ok: 0, total: 0, notApplicable: 0 },
    phaseDirection: { ok: 0, total: 0, notApplicable: 0 },
    roleSide: { ok: 0, total: 0, notApplicable: 0 },
    teamPresence: { ok: 0, total: 0, notApplicable: 0 },
  };
  // Checks that can legitimately have nothing to verify (e.g. no goals to
  // infer orientation from) report `applicable: false` instead of a
  // meaningless "ok: true" -- exclude those from the pass-rate denominator
  // entirely rather than let them inflate it.
  for (const r of scored) {
    for (const key of Object.keys(byCheck)) {
      const check = (r.scores as any)[key];
      if (check.applicable === false) {
        byCheck[key].notApplicable++;
        continue;
      }
      byCheck[key].total++;
      if (check.ok) byCheck[key].ok++;
    }
  }
  console.log("\nPer-check pass rate:");
  for (const [key, { ok, total: t, notApplicable }] of Object.entries(byCheck)) {
    const naNote = notApplicable ? ` (+${notApplicable} N/A, not counted)` : "";
    console.log(`  ${key.padEnd(18)} ${ok}/${t}${naNote}`);
  }

  if (errored.length) {
    console.log("\nErrors:");
    for (const r of errored) {
      console.log(`  #${r.idx} (${r.profileLabel}): ${r.error}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main() {
  const args = parseArgs();
  let profilePool = FORMAT_PROFILES;
  if (args.profile) {
    const needle = args.profile.toLowerCase();
    const matched = FORMAT_PROFILES.filter((p) => p.label.toLowerCase().includes(needle));
    if (matched.length === 0) {
      console.error(`No FORMAT_PROFILES label matches "${args.profile}". Available: ${FORMAT_PROFILES.map((p) => p.label).join(", ")}`);
      process.exit(1);
    }
    profilePool = matched;
    console.log(`Filtered to profile(s): ${matched.map((p) => p.label).join(", ")}`);
  }
  const samples = Array.from({ length: args.count }, (_, i) => buildInput(args.seed + i, profilePool));
  const outDir = args.out || path.join(__dirname, "..", "..", "sandbox-output", timestamp());
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Diagram sandbox: generating ${samples.length} drills (concurrency=${args.concurrency})`);
  console.log(`Output: ${outDir}\n`);

  let done = 0;
  const records = await runWithConcurrency(samples, args.concurrency, async ({ input, profileLabel }, idx) => {
    const startedAt = Date.now();
    try {
      const { raw, processed, sanitizerWarnings } = await generateDrillForSandbox(input);
      const json = processed?.json || raw;
      const drillLike = buildDrillLike(json, processed, input);
      const params = drillToDrawerParams(drillLike as any);
      // Production applies the goal overlay as a separate step after
      // rendering (routes/diagram-svg.ts) -- the deterministic renderer
      // never draws goals on its own. Match that exactly, or every report
      // silently omits goals regardless of what the goals scorer says.
      const scaleFactor = scaleFactorFromTokenRadius(
        computeTokenRadius(params.widthYards, params.lengthYards, params.fieldFormat, params.players.length)
      );
      const svg = applyGoalOverlay(renderDeterministicDiagramSVG(params), params.goals, scaleFactor);

      const scores = {
        countConsistency: scoreCountConsistency(json, params),
        spacing: scoreSpacing(params),
        arrows: scoreArrows(json, params),
        goals: scoreGoals(json, params, processed),
        orientation: scoreOrientation(json, params),
        phaseDirection: scorePhaseDirection(json, input),
        roleSide: scoreRoleSide(json),
        teamPresence: scoreTeamPresence(params),
      };
      const pass =
        scores.countConsistency.ok &&
        scores.spacing.ok &&
        scores.arrows.ok &&
        scores.goals.ok &&
        scores.orientation.ok &&
        scores.phaseDirection.ok &&
        scores.roleSide.ok;

      done++;
      process.stdout.write(`\r  ${done}/${samples.length} generated`);

      const record: SandboxRecord = {
        idx,
        profileLabel,
        input,
        title: drillLike.title,
        format: params.format || null,
        pass,
        scores,
        sanitizerWarnings,
        details: buildDrillDetails(json, params, input),
        svg,
        durationMs: Date.now() - startedAt,
        error: null,
      };
      return record;
    } catch (err: any) {
      done++;
      process.stdout.write(`\r  ${done}/${samples.length} generated`);
      const record: SandboxRecord = {
        idx,
        profileLabel,
        input,
        title: null,
        format: null,
        pass: false,
        scores: null,
        sanitizerWarnings: [],
        details: null,
        svg: null,
        durationMs: Date.now() - startedAt,
        error: err?.message || String(err),
      };
      return record;
    }
  });

  console.log("\n\nWriting report...");
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(records, null, 2));
  fs.writeFileSync(path.join(outDir, "report.html"), buildReportHtml(records));

  printSummary(records);
  console.log(`\nOpen: ${path.join(outDir, "report.html")}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Sandbox run failed:", err);
    process.exit(1);
  });
