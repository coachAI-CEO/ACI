import { FIELD_SPECS, expectedOutfieldRoles, formatOutfieldPerSide, isCenterBackRole, playerClusterCentered, practiceSpaceYards, shouldLockPracticeArea, type FieldFormat } from "../../data/field-dimensions";
import type { DrawerParams } from "../../types/drawer";
import type { FirstPassFixture } from "./fixtures";

export type CheckResult = { ok: boolean; issues: string[] };

export type FirstPassScores = {
  schema: CheckResult;
  space: CheckResult;
  roster: CheckResult;
  gk: CheckResult;
  layout: CheckResult;
  picture: CheckResult;
  chrome: CheckResult;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function spaceYards(format: FieldFormat, spaceConstraint: string): { lengthYards: number; widthYards: number } {
  return practiceSpaceYards(format, spaceConstraint);
}

function scoreSchema(json: unknown): CheckResult {
  const diagram = asRecord(asRecord(json).diagram);
  const players = Array.isArray(diagram.players) ? diagram.players : [];
  const issues: string[] = [];
  if (players.length === 0) issues.push("diagram.players is empty");
  const org = asRecord(asRecord(json).organization);
  const area = asRecord(org.area);
  if (!Number.isFinite(Number(area.lengthYards)) || !Number.isFinite(Number(area.widthYards))) {
    issues.push("organization.area is missing lengthYards/widthYards");
  }
  return { ok: issues.length === 0, issues };
}

function fitsEnvelope(length: number, width: number, capL: number, capW: number): boolean {
  const long = Math.max(capL, capW) + 2;
  const areaCap = capL * capW * 1.25;
  return length <= long && width <= long && length * width <= areaCap;
}

function scoreSpace(json: unknown, fixture: FirstPassFixture): CheckResult {
  const cap = spaceYards(fixture.input.fieldFormat as FieldFormat, fixture.input.spaceConstraint);
  const spec = FIELD_SPECS[fixture.input.fieldFormat as FieldFormat];
  const area = asRecord(asRecord(asRecord(json).organization).area);
  const length = Number(area.lengthYards);
  const width = Number(area.widthYards);
  const issues: string[] = [];
  if (Number.isFinite(length) && Number.isFinite(width)) {
    if (!fitsEnvelope(length, width, cap.lengthYards, cap.widthYards)) {
      issues.push(
        `practice ${length}×${width}yd does not fit ${fixture.input.spaceConstraint} envelope ${cap.lengthYards}×${cap.widthYards}yd`
      );
    }
    if (
      shouldLockPracticeArea({
        drillType: fixture.input.drillType,
        goalsAvailable: fixture.input.goalsAvailable,
      }) &&
      width < cap.widthYards * 0.7
    ) {
      issues.push(
        `practice width ${width}yd is a box, not ${fixture.input.fieldFormat} ${fixture.input.spaceConstraint} (need ~${cap.widthYards}yd full width)`
      );
    }
    const space = String(fixture.input.spaceConstraint || "").toUpperCase();
    if (space !== "FULL" && length >= spec.lengthYards - 2 && width >= spec.widthYards - 2) {
      issues.push(`drew full ${spec.lengthYards}×${spec.widthYards} pitch for ${space} drill`);
    }
  }
  return { ok: issues.length === 0, issues };
}

function scoreRoster(params: DrawerParams, fixture: FirstPassFixture): CheckResult {
  const count = params.players.length;
  const issues: string[] = [];
  if (count < fixture.input.numbersMin - 1 || count > fixture.input.numbersMax + 1) {
    issues.push(`player count ${count} outside ${fixture.input.numbersMin}-${fixture.input.numbersMax}`);
  }
  const attackers = params.players.filter((p) => p.team === "home" || p.team === "gk").length;
  const defenders = params.players.filter((p) => p.team === "away").length;
  if (attackers === 0) issues.push("no attacking-team players");
  if (defenders === 0 && !fixture.allowUnopposed) issues.push("no defending-team players");
  return { ok: issues.length === 0, issues };
}

function expectedKeeperCount(fixture: FirstPassFixture): number {
  if (fixture.expectedFullGoals === 0) return 0;
  if (fixture.expectedFullGoals === 1) return 2;
  return fixture.expectedFullGoals;
}

function scoreGk(params: DrawerParams, fixture: FirstPassFixture): CheckResult {
  const fullGoals = params.goals.filter((g) => g.type === "full").length;
  const gkCount = params.players.filter((p) => p.team === "gk" || /^gk$/i.test(p.role)).length;
  const expectedGks = expectedKeeperCount(fixture);
  const issues: string[] = [];
  if (fullGoals !== fixture.expectedFullGoals) {
    issues.push(`expected ${fixture.expectedFullGoals} full goal(s), drew ${fullGoals}`);
  }
  if (gkCount !== expectedGks) {
    issues.push(`expected ${expectedGks} GK token(s), drew ${gkCount}`);
  }
  return { ok: issues.length === 0, issues };
}

function scoreLayout(params: DrawerParams, fixture: FirstPassFixture): CheckResult {
  const pts = params.players;
  const issues: string[] = [];
  if (pts.length >= 2) {
    let minDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        minDist = Math.min(minDist, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
      }
    }
    if (minDist < 4) issues.push(`players overlap (${minDist.toFixed(1)} on 0-100)`);
  }
  if (fixture.expectSpreadOnPitch && pts.length >= 6) {
    const ys = pts.map((p) => p.y);
    const spreadY = Math.max(...ys) - Math.min(...ys);
    if (spreadY < 40) issues.push(`players crushed into ${spreadY.toFixed(0)}% of pitch width (squash)`);
  }
  return { ok: issues.length === 0, issues };
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Picture checks Dale actually looks at. Frozen schema/GK counts can pass
 * while the card still shows a leftover CB in the net or both puggs on one end.
 */
export function scorePicture(params: DrawerParams, fixture: FirstPassFixture): CheckResult {
  const issues: string[] = [];
  const full = params.goals.filter((g) => g.type === "full");
  const minis = params.goals.filter((g) => g.type === "mini" || g.type === "gate");
  const gks = params.players.filter((p) => p.team === "gk" || /^gk$/i.test(p.role));
  const attack = params.players.filter((p) => p.team === "home");
  const defend = params.players.filter((p) => p.team === "away");
  const neutrals = params.players.filter((p) => p.team === "neutral");

  for (const goal of full) {
    const leftovers = params.players.filter((player) => {
      if (player.team === "gk" || /^gk$/i.test(player.role)) return false;
      return manhattan(player, goal) < 12;
    });
    for (const player of leftovers) {
      issues.push(`outfield ${player.role || player.id} sitting in the full-goal net`);
    }
  }

  const minisLeft = minis.filter((g) => g.x <= 22).length;
  const minisRight = minis.filter((g) => g.x >= 78).length;
  const drillType = String(fixture.input.drillType || "").toUpperCase();
  const boxDrill = /WARMUP|TECHNICAL/.test(drillType);
  const rondo = boxDrill && fixture.expectedFullGoals === 0 && neutrals.length === 0 && attack.length !== defend.length;

  if (fixture.expectedFullGoals === 0) {
    if (rondo) {
      if (minis.length > 0) issues.push("rondo drew mini-goals (looks like a finishing game)");
    } else if (boxDrill) {
      if (minisLeft < 1 || minisRight < 1) {
        issues.push("0-full even-sided drill needs one mini on each end, not two on one side");
      }
    }
  }

  if (fixture.expectedFullGoals === 1 && /TACTICAL|CONDITIONED_GAME|FULL_GAME/i.test(fixture.input.drillType)) {
    const want = formatOutfieldPerSide(fixture.input.fieldFormat as FieldFormat);
    if (attack.length !== want || defend.length !== want) {
      issues.push(
        `${fixture.input.fieldFormat} reads as ${attack.length}v${defend.length}+${gks.length}GK, expected ${want}v${want}+2GK`
      );
    }
    if (full.length === 1 && defend.length >= 3) {
      const boxOnRight = full[0].x >= 50;
      const inBox = defend.filter((player) => (boxOnRight ? player.x >= 78 : player.x <= 22));
      if (inBox.length >= defend.length - 1) issues.push("defending team all inside the box");
    }
  }

  if (fixture.expectedFullGoals === 1 && full.length === 1) {
    const fullOnRight = full[0].x >= 50;
    const minisOnFullEnd = fullOnRight ? minisRight : minisLeft;
    const minisOnOpposite = fullOnRight ? minisLeft : minisRight;
    if (minisOnOpposite < 2) issues.push("one-full-goal picture needs two minis on the opposite end");
    if (minisOnFullEnd > 0) issues.push("mini-goals share the full-goal end");
    const gkNearFull = gks.filter((gk) => manhattan(gk, full[0]) < 20);
    const gkNearMinis = gks.filter((gk) => (fullOnRight ? gk.x <= 22 : gk.x >= 78));
    if (gkNearFull.length < 1) issues.push("no GK on the full-size goal");
    if (gkNearMinis.length < 1) issues.push("no GK on the mini-goal end");
  }

  for (const [label, group] of [
    ["Attack", attack],
    ["Defend", defend],
  ] as const) {
    if (group.length < 4) continue;
    const roles = [...new Set(group.map((p) => String(p.role || "CB").toUpperCase().replace(/^[LR]/, "")))];
    if (roles.length === 1) issues.push(`${label} all labeled ${roles[0]}`);
  }

  if (fixture.expectedFullGoals > 0 && gks.length !== expectedKeeperCount(fixture)) {
    issues.push(`picture has ${gks.length} GK token(s), expected ${expectedKeeperCount(fixture)}`);
  }

  const widthCenter = playerClusterCentered(params.players, "y");
  if (!widthCenter.ok) {
    issues.push(
      `field not centered on players (width cluster at ${widthCenter.mid.toFixed(0)}, pitch center 50)`
    );
  }
  if (fixture.expectedFullGoals === 2) {
    const defendingOwnThird =
      /DEFENDING/i.test(String(fixture.input.phase)) &&
      /DEFENSIVE_THIRD/i.test(String(fixture.input.zone));
    if (!defendingOwnThird) {
      const lengthCenter = playerClusterCentered(params.players, "x");
      if (!lengthCenter.ok) {
        issues.push(
          `field not centered on players (length cluster at ${lengthCenter.mid.toFixed(0)}, pitch center 50)`
        );
      }
    }
    const protectedGoal = full.filter((goal) => goal.x >= 80);
    if (/DEFENDING/i.test(String(fixture.input.phase)) && protectedGoal.length < 1) {
      issues.push("DEFENDING picture lost the protected full goal on the right");
    }
  }

  for (const player of params.players) {
    if (player.team !== "home" && player.team !== "away") continue;
    const role = String(player.role || "").toUpperCase();
    const match = role.match(/^([LR])[A-Z]/);
    if (!match) continue;
    if (player.y >= 47 && player.y <= 53) continue;
    const isLeftRole = match[1] === "L";
    const wantsTop = player.team === "home" ? isLeftRole : !isLeftRole;
    if (player.y < 50 !== wantsTop) {
      issues.push(`${player.team === "home" ? "ATT" : "DEF"} ${role} is on the wrong side of their GK`);
    }
  }

  if (fixture.expectedFullGoals >= 1) {
    for (const [label, group] of [
      ["ATT", attack],
      ["DEF", defend],
    ] as const) {
      const cbs = group.filter((player) => isCenterBackRole(player.role));
      if (cbs.length === 1 && Math.abs(cbs[0].y - 50) > 8) {
        issues.push(`${label} lone CB is off-center (y=${cbs[0].y.toFixed(0)})`);
      }
    }
  }

  issues.push(...scoreFormationLines(params, fixture, attack, defend));

  return { ok: issues.length === 0, issues };
}

function sortedRoles(players: Array<{ role?: string }>): string {
  return [...players.map((player) => String(player.role || "").toUpperCase())].sort().join(",");
}

function scoreFormationLines(
  params: DrawerParams,
  fixture: FirstPassFixture,
  attack: DrawerParams["players"],
  defend: DrawerParams["players"]
): string[] {
  const issues: string[] = [];
  if (fixture.expectedFullGoals < 1) return issues;
  if (!/TACTICAL|CONDITIONED_GAME|FULL_GAME/i.test(String(fixture.input.drillType))) return issues;
  for (const [label, group, formation] of [
    ["ATT", attack, params.formationAttacking || fixture.input.formationAttacking],
    ["DEF", defend, params.formationDefending || fixture.input.formationDefending],
  ] as const) {
    const expected = expectedOutfieldRoles(String(formation || ""));
    if (!expected || group.length < 4) continue;
    const want = expected.slice(0, group.length);
    if (sortedRoles(group) !== want.slice().sort().join(",")) {
      issues.push(`FORM_LINES: ${label} ${sortedRoles(group) || "none"} expected ${want.slice().sort().join(",")}`);
    }
  }
  return issues;
}

function scoreChrome(svg: string): CheckResult {
  const issues: string[] = [];
  if (/Match Area/i.test(svg)) issues.push("Match Area overlay present");
  if (/\b(?:x|y)="[^"]*[+*/][^"]*"/.test(svg)) issues.push("formula attribute in SVG");
  const mint = svg.match(/<rect\b[^>]*fill="#10f0a0"[^>]*>/gi) || [];
  for (const tag of mint) {
    const width = Number(tag.match(/\bwidth="([\d.]+)"/)?.[1] || 0);
    if (width >= 180) issues.push("oversized mint zone overlay");
  }
  if (/viewBox="[\d.]+ [\d.]+/.test(svg) && !/viewBox="0 0 /.test(svg)) {
    issues.push("viewBox origin is not 0,0 (pitch will look shifted in the card)");
  }
  return { ok: issues.length === 0, issues };
}

export function scoreFirstPass(args: {
  json: unknown;
  params: DrawerParams;
  svg: string;
  fixture: FirstPassFixture;
}): { pass: boolean; scores: FirstPassScores; issues: string[] } {
  const scores: FirstPassScores = {
    schema: scoreSchema(args.json),
    space: scoreSpace(args.json, args.fixture),
    roster: scoreRoster(args.params, args.fixture),
    gk: scoreGk(args.params, args.fixture),
    layout: scoreLayout(args.params, args.fixture),
    picture: scorePicture(args.params, args.fixture),
    chrome: scoreChrome(args.svg),
  };
  const issues = Object.values(scores).flatMap((check) => check.issues);
  return { pass: issues.length === 0, scores, issues };
}
