import {
  defaultFormationsForFormat,
  formatOutfieldPerSide,
  isWarmupPicture,
  parseFormationNums,
  resolveFieldFormat,
  type FieldFormat,
} from "../data/field-dimensions";
import type { SceneCard, ScenePicture } from "./scene-document";

export type SceneDrillLike = {
  title?: string | null;
  json?: unknown;
  drillType?: string | null;
  durationMin?: number | null;
  rpeMin?: number | null;
  rpeMax?: number | null;
  numbersMin?: number | null;
  numbersMax?: number | null;
  spaceConstraint?: string | null;
  formationUsed?: string | null;
  phase?: string | null;
  zone?: string | null;
  coachLevel?: string | null;
  goalsAvailable?: number | null;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function asFormat(value: unknown, playerCount: number): FieldFormat {
  const key = String(value || "").toUpperCase();
  if (key === "7V7" || key === "9V9" || key === "11V11") return key;
  return resolveFieldFormat(playerCount || 14);
}

function listText(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item : String(item?.text || item || ""))).filter(Boolean);
}

export function kitLineForGoals(goalsAvailable: number): string {
  if (goalsAvailable <= 0) return "Mini-goals / gates only. No full-size goal. No GK.";
  if (goalsAvailable === 1) {
    return "ONE full-size goal with GK + two mini-goals on the opposite end (no GK on the puggs).";
  }
  return "TWO full-size goals with GKs, one on each end (x 0 and 100, y 50). No mini-goals.";
}

export function formationFitsFormat(formation: string, format: FieldFormat): boolean {
  const nums = parseFormationNums(formation);
  if (!nums) return false;
  return nums.reduce((sum, n) => sum + n, 0) === formatOutfieldPerSide(format);
}

export function formationForPicture(raw: string, format: FieldFormat, side: "attacking" | "defending"): string {
  if (formationFitsFormat(raw, format)) return raw;
  return defaultFormationsForFormat(format)[side];
}

function setupContradictsKit(step: string, goalsAvailable: number): boolean {
  const text = step.toLowerCase();
  if (goalsAvailable >= 2) return /mini-?goal|pugg|no full-size gk/.test(text);
  if (goalsAvailable <= 0) return /\bfull-size goal|\bgoalkeeper\b|\bgk\b/.test(text);
  return false;
}

export function isWorkingGroupDrill(drillType: string | null | undefined): boolean {
  const type = String(drillType || "").toUpperCase().replace(/[-\s]/g, "");
  return type.includes("WARMUP") || type.includes("TECHNICAL");
}

export function namedSmallSided(text: string): string | null {
  const match = text.match(/\b(\d+\s*v\s*\d+)\b/i);
  return match ? match[1].replace(/\s+/g, "").toLowerCase() : null;
}

/**
 * A named NvN only counts as a genuine small-sided game when it's SMALLER than
 * a full side — "4v3" is a practice, "7v7" on a 7V7 pitch is just the field.
 */
export function smallSidedLabel(text: string, format: FieldFormat): string | null {
  const named = namedSmallSided(text);
  if (!named) return null;
  const bigger = Math.max(...named.split("v").map((n) => Number(n) || 0));
  return bigger > 0 && bigger < formatOutfieldPerSide(format) ? named : null;
}

/**
 * Pull an explicit per-side role list out of the setup text when the drill
 * author wrote one — "3 defenders in a 2-1 shape (1 LCB, 1 RCB, 1 CM)" or
 * "attackers: LC, RC, LM, ST". Returns null when nothing explicit is named
 * (common — then the scene model labels shirts itself).
 */
const ROLE_WORD_TO_CODE: Array<[RegExp, string]> = [
  [/goal\s*keeper|keeper/, "GK"],
  [/left\s*(centre|center|central)?\s*back/, "LB"],
  [/right\s*(centre|center|central)?\s*back/, "RB"],
  [/(centre|center|central)\s*back/, "CB"],
  [/full\s*back/, "FB"],
  [/left\s*wing\s*back/, "LWB"],
  [/right\s*wing\s*back/, "RWB"],
  [/defensive\s*mid\w*/, "DM"],
  [/attacking\s*mid\w*/, "AM"],
  [/left\s*mid\w*/, "LM"],
  [/right\s*mid\w*/, "RM"],
  [/(centre|center|central)\s*mid\w*/, "CM"],
  [/left\s*wing\w*|left\s*forward/, "LW"],
  [/right\s*wing\w*|right\s*forward/, "RW"],
  [/(centre|center|central)\s*forward/, "CF"],
  [/striker|target\s*(man|player|forward)/, "ST"],
  [/defender/, "CB"],
  [/midfield\w*/, "CM"],
  [/forward|attacker|winger/, "FW"],
];

function roleToken(raw: string): string | null {
  const s = raw
    .trim()
    .replace(/^\d+\s*(x\s*)?/i, "")
    .replace(/\s+players?$/i, "")
    .replace(/\d+$/, "") // "DM1"/"DM2" → "DM"
    .trim();
  if (/^[A-Z]{1,4}$/.test(s) || /^#\d+$/.test(s)) return s;
  const lower = s.toLowerCase();
  for (const [re, code] of ROLE_WORD_TO_CODE) if (re.test(lower)) return code;
  return null;
}

function extractRoleList(segment: string): string[] {
  return segment
    .split(/[,/]|\band\b/i)
    .map(roleToken)
    .filter((s): s is string => s !== null);
}

export function namedRoster(setup: string[], description: string): { home: string[]; away: string[] } | null {
  const text = `${setup.join(". ")}. ${description}`;
  const grab = (side: string): string[] => {
    // "3 defenders in a 2-1 shape (1 LCB, 1 RCB, 1 CM)" — parenthesised/colon list
    const bracketed = text.match(new RegExp(`${side}\\w*[^.]*?[(:]([^).]+)[).]`, "i"));
    if (bracketed) {
      const got = extractRoleList(bracketed[1]);
      if (got.length >= 2) return got;
    }
    // "...in a 3-1 formation with roles LM, CM, RM, and ST" — no brackets
    const phrased = text.match(
      new RegExp(`${side}\\w*[^.]*?\\b(?:roles?|labell?ed|positions?)\\b[:\\s]+([A-Za-z0-9,/\\s]+?)[.;]`, "i")
    );
    return phrased ? extractRoleList(phrased[1]) : [];
  };
  const home = grab("attack");
  const away = grab("defend");
  if (home.length < 2 && away.length < 2) return null;
  if (!rosterLooksSane(home) || !rosterLooksSane(away)) return null;
  // Teams swapped: the "attacking" list is all backs and the "defending" list
  // is all forwards. The drill model does this; don't propagate it.
  const allBacks = (a: string[]) => a.length >= 2 && a.every((s) => /(WB|LB|RB|CB|B|SW)$/i.test(s));
  const allFwds = (a: string[]) => a.length >= 2 && a.every((s) => /(W|F|FW|CF|ST)$/i.test(s));
  if (allBacks(home) && allFwds(away)) return null;
  return { home, away };
}

/** A usable roster: no repeated role on one side, no absurd length. */
function rosterLooksSane(side: string[]): boolean {
  if (side.length === 0) return true;
  if (side.length > 11) return false;
  return new Set(side.map((s) => s.toUpperCase())).size === side.length;
}

/**
 * Is this a sub-squad picture (a 4v3 in a channel, a rondo, a positional game)
 * rather than a full-team match slice? When true, buildSceneCard drops the
 * "Formations: ATT … / DEF …" line — that line carries a full-team shape that
 * contradicts the setup text's explicit small-sided count and makes the scene
 * model over-populate.
 */
export function isSubSquadPicture(args: {
  setup: string[];
  description: string;
  rawFormationAttacking: string;
  numbersMax: number;
  spaceConstraint: string;
  fieldFormat: FieldFormat;
}): boolean {
  const text = `${args.setup.join(" ")} ${args.description}`;
  const outPerSide = formatOutfieldPerSide(args.fieldFormat);

  // A named NvN only means sub-squad when it's SMALLER than a full side
  // ("4v3", "5v2") — "9v9" on a 9V9 pitch is the full game.
  if (smallSidedLabel(text, args.fieldFormat)) return true;
  if (/\b(THIRD|QUARTER)\b/i.test(args.spaceConstraint)) return true;
  // The drill's own formation doesn't fill the format → not a full-team picture.
  const nums = parseFormationNums(args.rawFormationAttacking);
  if (nums && nums.reduce((a, b) => a + b, 0) < outPerSide) return true;

  // Player count is well below a full match for this format.
  return args.numbersMax > 0 && args.numbersMax <= outPerSide * 2 - 4;
}

/**
 * Backstop: if the assembled card's formation line implies a roster that
 * contradicts its own "About N players" line by more than 2, strip the
 * formation line. Same idea as setupContradictsKit, applied to counts.
 */
export function reconcileCardCounts(card: string): string {
  const lines = card.split("\n");
  const formIdx = lines.findIndex((l) => l.startsWith("Formations: ATT "));
  const aboutLine = lines.find((l) => /About\s+\d+/.test(l));
  if (formIdx < 0 || !aboutLine) return card;

  const aboutMax = Math.max(
    0,
    ...[...aboutLine.matchAll(/\b(\d+)\b/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 40)
  );
  const sides = lines[formIdx].match(/ATT\s+([\d-]+)\s*\/\s*DEF\s+([\d-]+)/);
  if (!sides || aboutMax <= 0) return card;

  const outfield = (f: string) => (parseFormationNums(f) || []).reduce((a, b) => a + b, 0);
  const hasGk = /full-size goal/i.test(card) && !/No full-size goal/i.test(card);
  const implied = outfield(sides[1]) + outfield(sides[2]) + (hasGk ? 2 : 0);
  if (implied - aboutMax > 2) {
    lines.splice(formIdx, 1);
    return lines.join("\n");
  }
  return card;
}

/** Squad size is not the picture. Technical/warmup draw one working group. */
export function workingGroupPictureLine(args: {
  drillType: string;
  squad: number;
  setup: string[];
  description: string;
}): string {
  const text = `${args.setup.join(" ")} ${args.description}`;
  const named = namedSmallSided(text);
  if (named && !/two (groups|grids)|side-by-side/i.test(text)) {
    return `Draw the named ${named} only — not a ${args.squad}-player leftover.`;
  }
  const groupOf = text.match(/groups? of (\d+)/i);
  const n = groupOf ? Number(groupOf[1]) : 9;
  const grid = text.match(/(\d+)\s*x\s*(\d+)\s*yard/i);
  const gridNote = grid ? ` One grid is ${grid[1]}x${grid[2]} yards.` : "";
  if (/two .{0,40}grids|side-by-side|two groups/i.test(text)) {
    return `Draw ONE working group (~${n} shirts) on ONE grid.${gridNote} The second group is identical — do not draw both, and do not dump a 9v9.`;
  }
  return `Draw ONE working group (~8 shirts), not the whole squad of ${args.squad}.`;
}

/**
 * Conservative picture tag. Only when the card is explicit — press-as-a-unit is
 * not a switch.
 *
 * `rondo` and `center` mean "small keep-away / channel in the middle, no goals".
 * A drill that carries a real full goal (goalsAvailable >= 1) is NOT that
 * picture no matter what the title says — the model generator writes titles
 * like "Defensive Third Transition Rondo" for a drill whose card demands a
 * goal + GK, and the bare keyword must not win that fight. (twoTeamGame alone
 * is not enough: plenty of rondo / possession work is tagged TACTICAL.)
 */
export function inferScenePicture(
  card: string,
  drillType: string,
  opts?: { goalsAvailable?: number; twoTeamGame?: boolean }
): ScenePicture | undefined {
  const text = `${drillType} ${card}`.toLowerCase();
  const hasRealGoal = Number(opts?.goalsAvailable) >= 1;
  if (!hasRealGoal) {
    if (/\brondo\b/.test(text) || (isWarmupPicture(drillType) && /\b(4v1|5v2|4v2)\b/.test(text))) return "rondo";
    if (/\b1v1\b/.test(text) || /\b2v1\b/.test(text) || (/\b3v2\b/.test(text) && /channel|mini/.test(text))) return "center";
  }
  if (/switch (the )?point of attack|weak-?side/.test(text)) return "matchup";
  return undefined;
}

/** Practice card for the scene model. Never include json.diagram coordinates. */
export function buildSceneCard(drill: SceneDrillLike): SceneCard {
  const json = asRecord(drill.json);
  const organization = asRecord(json.organization);
  const area = asRecord(organization.area);
  const drillType = String(drill.drillType || json.drillType || "TECHNICAL");
  const nMin = Number(drill.numbersMin ?? json.numbersMin ?? asRecord(json.numbers).min ?? 8);
  const nMax = Number(drill.numbersMax ?? json.numbersMax ?? asRecord(json.numbers).max ?? nMin);
  const workingGroup = isWorkingGroupDrill(drillType);
  let goalsAvailable = Number(drill.goalsAvailable ?? json.goalsAvailable ?? 0);
  if (workingGroup) goalsAvailable = 0;
  const spaceConstraint = String(drill.spaceConstraint || json.spaceConstraint || area.spaceConstraint || "FULL");
  const fieldFormat = asFormat(json.fieldFormat || area.format, workingGroup ? 10 : nMax);
  const coachLevel = String(drill.coachLevel || json.coachLevel || "USSF_D");
  const ageGroup = String(json.ageGroup || "");
  const description = String(json.description || json.primaryCoachingPicture || "").trim();
  const points = listText(json.coachingPoints);
  const rawSetup = Array.isArray(json.setupSteps) && json.setupSteps.length > 0 ? json.setupSteps : organization.setupSteps;
  const setup = listText(rawSetup).filter((step) => !setupContradictsKit(step, goalsAvailable));
  const title = String(drill.title || json.title || "Drill");
  const zone = String(drill.zone || json.zone || "MIDDLE_THIRD");
  const rawFormationAttacking = String(
    json.formationAttacking || organization.formationAttacking || drill.formationUsed || ""
  );
  const attacking = workingGroup ? "" : formationForPicture(rawFormationAttacking, fieldFormat, "attacking");
  const defending = workingGroup
    ? ""
    : formationForPicture(
        String(json.formationDefending || organization.formationDefending || ""),
        fieldFormat,
        "defending"
      );
  const subSquad =
    !workingGroup &&
    isSubSquadPicture({ setup, description, rawFormationAttacking, numbersMax: nMax, spaceConstraint, fieldFormat });
  const roster = workingGroup ? null : namedRoster(setup, description);
  const rosterLine =
    roster && (roster.home.length >= 2 || roster.away.length >= 2)
      ? `ROSTER — draw exactly these shirts, label each verbatim, add no others:${
          roster.home.length ? ` home ${roster.home.join(", ")}.` : ""
        }${roster.away.length ? ` away ${roster.away.join(", ")}.` : ""}`
      : "";

  const card = [
    `${coachLevel} DIAGRAM. ${drillType}${ageGroup ? ` ${ageGroup}` : ""}. ${title}.`,
    description,
    points.length ? `Coaching points: ${points.slice(0, 6).join("; ")}.` : "",
    setup.length ? `Setup: ${setup.slice(0, 6).join("; ")}.` : "",
    workingGroup
      ? `${workingGroupPictureLine({ drillType, squad: nMax, setup, description })} ${kitLineForGoals(0)}`
      : `Pitch ${fieldFormat}, space ${spaceConstraint}. About ${nMin}-${nMax} players. ${kitLineForGoals(
          Number.isFinite(goalsAvailable) ? goalsAvailable : 0
        )}`,
    workingGroup
      ? "No match formation. A passing circuit is three short lines (start → link → target) toward mini-goals. Not two teams facing for a game."
      : subSquad
        ? `${
            smallSidedLabel(`${setup.join(" ")} ${description}`, fieldFormat) ??
            `~${Math.max(2, Math.ceil(nMax / 2))}v${Math.max(2, Math.floor(nMax / 2))}`
          } in the ${zone.toLowerCase().replace(/_/g, " ")} — the pitch is ${fieldFormat} scale but this is a SMALL-SIDED practice, not a full ${fieldFormat}. Draw only the players the setup names, about ${nMin}-${nMax} total.`
        : `Formations: ATT ${attacking} / DEF ${defending}. ${fieldFormat} outfield shape — not an 11v11 leftover.`,
    rosterLine,
    /CONDITIONED_GAME|FULL_GAME|TACTICAL|SSG/i.test(drillType)
      ? "This is a two-team GAME picture: two shapes facing each other. Teach the topic with arrows and short labels. Do not outline a third of the pitch with cones."
      : "Draw THIS practice. Named actions and named shirts are law. Do not dump a generic 11v11.",
  ]
    .filter(Boolean)
    .join("\n");

  const finalCard = reconcileCardCounts(card);
  const resolvedGoalsAvailable = Number.isFinite(goalsAvailable) ? goalsAvailable : 0;
  const twoTeamGame = !workingGroup && /CONDITIONED_GAME|FULL_GAME|TACTICAL|SSG/i.test(drillType);

  return {
    title,
    card: finalCard,
    drillType,
    fieldFormat,
    spaceConstraint,
    goalsAvailable: resolvedGoalsAvailable,
    roster: roster && (roster.home.length >= 2 || roster.away.length >= 2) ? roster : undefined,
    twoTeamGame,
    formationAttacking: subSquad ? "" : attacking,
    formationDefending: subSquad ? "" : defending,
    coachLevel,
    picture: inferScenePicture(finalCard, drillType, {
      goalsAvailable: resolvedGoalsAvailable,
      twoTeamGame,
    }),
    phase: String(drill.phase || json.phase || "ATTACKING"),
    zone,
    gameModelId: String(json.gameModelId || "POSSESSION"),
    durationMin: Number(drill.durationMin ?? json.durationMin ?? 12) || 12,
    rpeMin: Number(drill.rpeMin ?? 4) || 4,
    rpeMax: Number(drill.rpeMax ?? 6) || 6,
  };
}
