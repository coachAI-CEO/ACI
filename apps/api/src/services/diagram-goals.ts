import { isWarmupPicture, practiceSpaceYards, shouldLockPracticeArea, type FieldFormat } from "../data/field-dimensions";

type GoalAvailabilityInput = {
  goalsAvailable?: number | null;
  fieldFormat?: string | null;
  spaceConstraint?: string | null;
  drillType?: string | null;
};

function isGoalkeeper(player: any): boolean {
  const role = String(player?.role || "").toUpperCase();
  const team = String(player?.team || "").toUpperCase();
  return team === "GK" || player?.number === 1 || role === "GK" || role.includes("GOALKEEPER");
}

function isActiveGoalkeeper(player: any): boolean {
  const role = String(player?.role || "").toUpperCase();
  const team = String(player?.team || "").toUpperCase();
  return team === "GK" || role === "GK" || role.includes("GOALKEEPER");
}

export function isFullSizeGoal(goal: any): boolean {
  const type = String(goal?.type || "").toUpperCase();
  return type === "BIG" || type === "FULL" || type === "LARGE";
}

function isBigGoal(goal: any): boolean {
  return isFullSizeGoal(goal);
}

/** Mini/gate layouts never have a dedicated keeper. Relabel leftover GKs as outfield. */
export function demoteDiagramGoalkeepers(diagram: any) {
  if (!diagram || typeof diagram !== "object") return;
  const players = Array.isArray(diagram.players) ? diagram.players : [];
  for (const player of players) {
    if (!isGoalkeeper(player)) continue;
    const role = String(player.role || "").toUpperCase();
    player.role = role === "GK" || role.includes("GOALKEEPER") ? "CB" : player.role;
    if (String(player.team || "").toUpperCase() === "GK") player.team = "DEF";
    player.number = typeof player.number === "number" && player.number !== 1 ? player.number : undefined;
  }
  if (Array.isArray(diagram.teams)) {
    diagram.teams = diagram.teams.filter(
      (t: any) => String(t?.label || "").toUpperCase() !== "GK"
    );
  }
  discardPhantomKeepers(diagram, null);
}

/** Drop demoted keeper tokens that still sit on a net / endline (id att_gk, etc.). */
export function discardPhantomKeepers(diagram: any, keptGk: any = null) {
  if (!diagram || !Array.isArray(diagram.players)) return;
  const keptList = Array.isArray(keptGk) ? keptGk : keptGk ? [keptGk] : diagram.players.filter((player: any) => isActiveGoalkeeper(player));
  const keptGks = new Set(keptList);
  const bigs = (Array.isArray(diagram.goals) ? diagram.goals : []).filter(isBigGoal);
  const kept = diagram.players.filter((player: any) => {
    if (keptGks.has(player)) return true;
    const id = String(player?.id || "");
    if (/gk|goalkeeper/i.test(id)) return false;
    if (!isActiveGoalkeeper(player)) {
      for (const goal of bigs) {
        if (distanceToGoal(player, goal) < 12) return false;
      }
    }
    return true;
  });
  diagram.players.splice(0, diagram.players.length, ...kept);
}

const DEFAULT_OPPOSITE_MINIS = [
  { id: "MG-LEFT", type: "MINI", width: 5, x: 6, y: 50, facingAngle: 90, teamAttacks: "DEF" },
  { id: "MG-RIGHT", type: "MINI", width: 5, x: 94, y: 50, facingAngle: 270, teamAttacks: "ATT" },
];

function isMiniOrGate(goal: any): boolean {
  const t = String(goal?.type || "").toUpperCase();
  return t === "MINI" || t === "SMALL" || t === "GATE" || t === "PUGG";
}

/** 0 full goals still means the picture has something to score on. */
export function ensureOppositeMiniGoals(diagram: any) {
  if (!diagram || typeof diagram !== "object") return;
  if (!Array.isArray(diagram.goals)) diagram.goals = [];
  if (diagram.goals.some(isMiniOrGate)) return;
  diagram.goals.push(
    { ...DEFAULT_OPPOSITE_MINIS[0] },
    { ...DEFAULT_OPPOSITE_MINIS[1] }
  );
}

export function ensureMinisOppositeFullGoal(diagram: any) {
  if (!diagram || typeof diagram !== "object") return;
  if (!Array.isArray(diagram.goals)) diagram.goals = [];
  if (diagram.goals.some(isMiniOrGate)) return;
  const big = diagram.goals.find(isBigGoal);
  if (!big) return;
  const normalized = { ...big, teamAttacks: Number(big.x ?? 50) >= 50 ? "ATT" : "DEF" };
  diagram.goals.push(...miniGoalsOpposite(normalized));
}

function normalizeBigGoal(goal: any, fallback: any) {
  return {
    id: goal?.id || fallback.id,
    type: "BIG",
    width: Number.isFinite(goal?.width) ? goal.width : 8,
    x: Number.isFinite(goal?.x) ? goal.x : fallback.x,
    y: Number.isFinite(goal?.y) ? goal.y : fallback.y,
    facingAngle: Number.isFinite(goal?.facingAngle) ? goal.facingAngle : fallback.facingAngle,
    teamAttacks: goal?.teamAttacks || fallback.teamAttacks,
  };
}

function miniGoalsOpposite(bigGoal: any) {
  const horizontal = Number(bigGoal.x ?? 50) < 20 || Number(bigGoal.x ?? 50) > 80;
  if (horizontal) {
    const miniX = Number(bigGoal.x ?? 50) < 50 ? 94 : 6;
    const facingAngle = miniX > 50 ? 270 : 90;
    return [
      { id: "MG1", type: "MINI", width: 5, x: miniX, y: 38, facingAngle, teamAttacks: bigGoal.teamAttacks === "ATT" ? "DEF" : "ATT" },
      { id: "MG2", type: "MINI", width: 5, x: miniX, y: 62, facingAngle, teamAttacks: bigGoal.teamAttacks === "ATT" ? "DEF" : "ATT" },
    ];
  }

  const miniY = Number(bigGoal.y ?? 50) < 50 ? 94 : 6;
  const facingAngle = miniY > 50 ? 0 : 180;
  return [
    { id: "MG1", type: "MINI", width: 5, x: 38, y: miniY, facingAngle, teamAttacks: bigGoal.teamAttacks === "ATT" ? "DEF" : "ATT" },
    { id: "MG2", type: "MINI", width: 5, x: 62, y: miniY, facingAngle, teamAttacks: bigGoal.teamAttacks === "ATT" ? "DEF" : "ATT" },
  ];
}

function distanceToGoal(player: any, goal: any): number {
  return Math.abs(Number(player?.x ?? 50) - Number(goal?.x ?? 50))
    + Math.abs(Number(player?.y ?? 50) - Number(goal?.y ?? 50));
}

function normalizeSingleGoalPlayers(diagram: any, bigGoal: any) {
  const players = Array.isArray(diagram.players) ? diagram.players : [];
  if (!players.length) return;

  if (!Array.isArray(diagram.goals)) diagram.goals = [];

  const gks = players.filter(isGoalkeeper);
  const candidates = gks.length > 0 ? gks : players;
  const defendingTeam = String(bigGoal.teamAttacks || "").toUpperCase() === "ATT" ? "DEF" : "ATT";
  const keep =
    candidates.length > 0
      ? [...candidates].sort((a, b) => {
          const byDistance = distanceToGoal(a, bigGoal) - distanceToGoal(b, bigGoal);
          if (byDistance !== 0) return byDistance;
          const aDef = String(a.team || "").toUpperCase() === defendingTeam ? 0 : 1;
          const bDef = String(b.team || "").toUpperCase() === defendingTeam ? 0 : 1;
          return aDef - bDef;
        })[0]
      : null;

  for (const player of players) {
    if (player === keep) {
      player.role = "GK";
      player.number = 1;
      player.team = defendingTeam;
      player.x = Number(bigGoal.x ?? 50) < 50 ? Math.max(6, Number(bigGoal.x ?? 6) + 3) : Math.min(94, Number(bigGoal.x ?? 94) - 3);
      player.y = Number.isFinite(bigGoal.y) ? bigGoal.y : 50;
      continue;
    }

    if (isGoalkeeper(player)) {
      const role = String(player.role || "").toUpperCase();
      player.number = typeof player.number === "number" && player.number !== 1 ? player.number : undefined;
      player.role = role === "GK" || role.includes("GOALKEEPER") ? "CB" : player.role;
      if (String(player.team || "").toUpperCase() === "GK") player.team = "DEF";
      if (Number(bigGoal.x ?? 50) < 20 && Number(player.x ?? 50) > 88) player.x = 82;
      if (Number(bigGoal.x ?? 50) > 80 && Number(player.x ?? 50) < 12) player.x = 18;
      if (distanceToGoal(player, bigGoal) < 16) {
        player.x = Number(bigGoal.x ?? 50) >= 50 ? 22 : 78;
        player.y = Number.isFinite(Number(player.y)) ? Number(player.y) : 50;
      }
    }
  }
  discardPhantomKeepers(diagram, keep);
}

function rewriteGoalText(value: any): any {
  if (typeof value === "string") {
    return value
      .replace(/\btwo full[-\s]?size goals\b/gi, "one full-size goal and two mini-goals")
      .replace(/\bfull[-\s]?size goals\b/gi, "one full-size goal and two mini-goals")
      .replace(/\b2 full[-\s]?size goals\b/gi, "one full-size goal and two mini-goals")
      .replace(/\bwith GKs\b/gi, "with one GK in the full-size goal")
      .replace(/\bthrough GKs\b/gi, "through the GK or mini-goal restarts")
      .replace(/\bthrough GK[s]?\b/gi, "through the GK or mini-goal restarts");
  }
  if (Array.isArray(value)) return value.map(rewriteGoalText);
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) value[key] = rewriteGoalText(value[key]);
  }
  return value;
}

/**
 * Keepers follow drawn full-size goals, not the equipment flag.
 * 0 full goals → no GKs. 1 full goal + opposite minis → GK only on the
 * full-size net (mini-goals are outfield restarts, no dedicated keeper).
 * 2+ full goals → one GK per full goal.
 */
export function limitKeepersToDrawnFullGoals(diagram: any) {
  if (!diagram || typeof diagram !== "object") return;
  const goals = Array.isArray(diagram.goals) ? diagram.goals : [];
  const bigs = goals.filter(isBigGoal);
  if (bigs.length === 0) {
    demoteDiagramGoalkeepers(diagram);
    return;
  }
  if (bigs.length === 1) {
    const bigGoal = { ...bigs[0] };
    bigGoal.teamAttacks = Number(bigGoal.x ?? 50) >= 50 ? "ATT" : "DEF";
    normalizeSingleGoalPlayers(diagram, bigGoal);
    return;
  }
  normalizeTwoGoalPlayers(diagram, bigs);
}

function replaceArray(target: any[], next: any[]) {
  target.splice(0, target.length, ...next);
}

function oppositeFullGoal(existing: any) {
  const x = Number(existing?.x ?? 94);
  const right = x >= 50;
  return {
    id: right ? "G-LEFT" : "G-RIGHT",
    type: "BIG",
    width: Number.isFinite(Number(existing?.width)) ? Number(existing.width) : 8,
    x: right ? 6 : 94,
    y: 50,
    facingAngle: right ? 90 : 270,
    teamAttacks: right ? "DEF" : "ATT",
  };
}

function pickTwoOpposite(bigs: any[]): any[] {
  const sorted = [...bigs].sort((a, b) => Number(a?.x ?? 50) - Number(b?.x ?? 50));
  const left = normalizeBigGoal(sorted[0], { id: "G-LEFT", x: 6, y: 50, facingAngle: 90, teamAttacks: "DEF" });
  const right = normalizeBigGoal(sorted[sorted.length - 1], { id: "G-RIGHT", x: 94, y: 50, facingAngle: 270, teamAttacks: "ATT" });
  left.x = Math.min(Number(left.x ?? 6), 20);
  left.teamAttacks = "DEF";
  right.x = Math.max(Number(right.x ?? 94), 80);
  right.teamAttacks = "ATT";
  if (left.id === right.id) right.id = "G-RIGHT";
  return [left, right];
}

/** goalsAvailable=2 means two full-size goals with a GK each, not two puggs. */
export function ensureTwoFullGoalsAndKeepers(diagram: any) {
  if (!diagram || typeof diagram !== "object") return;
  if (!Array.isArray(diagram.goals)) diagram.goals = [];
  if (!Array.isArray(diagram.players)) diagram.players = [];
  const minis = diagram.goals.filter((g: any) => !isBigGoal(g));
  const bigs = diagram.goals.filter(isBigGoal);
  const pair =
    bigs.length >= 2
      ? pickTwoOpposite(bigs)
      : bigs.length === 1
        ? [normalizeBigGoal(bigs[0], { id: "G1", x: 94, y: 50, facingAngle: 270, teamAttacks: "ATT" }), oppositeFullGoal(bigs[0])]
        : [
            { id: "G-LEFT", type: "BIG", width: 8, x: 6, y: 50, facingAngle: 90, teamAttacks: "DEF" },
            { id: "G-RIGHT", type: "BIG", width: 8, x: 94, y: 50, facingAngle: 270, teamAttacks: "ATT" },
          ];
  pair[0].teamAttacks = Number(pair[0].x ?? 6) >= 50 ? "ATT" : "DEF";
  pair[1].teamAttacks = Number(pair[1].x ?? 94) >= 50 ? "ATT" : "DEF";
  replaceArray(diagram.goals, [...pair, ...minis]);
  normalizeTwoGoalPlayers(diagram, pair);
}

function normalizeTwoGoalPlayers(diagram: any, bigs: any[]) {
  const players = Array.isArray(diagram.players) ? diagram.players : [];
  if (!players.length || bigs.length < 2) return;
  const left = [...bigs].sort((a, b) => Number(a?.x ?? 50) - Number(b?.x ?? 50))[0];
  const right = [...bigs].sort((a, b) => Number(b?.x ?? 50) - Number(a?.x ?? 50))[0];
  const used = new Set<any>();
  for (const goal of [left, right]) {
    const defendingTeam = String(goal.teamAttacks || "").toUpperCase() === "ATT" ? "DEF" : "ATT";
    const candidates = players.filter((p: any) => !used.has(p));
    const gks = candidates.filter(isGoalkeeper);
    const pool = gks.length > 0 ? gks : candidates;
    const keep =
      [...pool].sort((a, b) => {
        const byDistance = distanceToGoal(a, goal) - distanceToGoal(b, goal);
        if (byDistance !== 0) return byDistance;
        const aDef = String(a.team || "").toUpperCase() === defendingTeam ? 0 : 1;
        const bDef = String(b.team || "").toUpperCase() === defendingTeam ? 0 : 1;
        return aDef - bDef;
      })[0] || null;
    if (!keep) continue;
    used.add(keep);
    keep.role = "GK";
    keep.number = 1;
    keep.team = defendingTeam;
    keep.x = Number(goal.x ?? 50) < 50 ? Math.max(6, Number(goal.x ?? 6) + 3) : Math.min(94, Number(goal.x ?? 94) - 3);
    keep.y = Number.isFinite(Number(goal.y)) ? Number(goal.y) : 50;
  }
  for (const player of players) {
    if (used.has(player) || !isGoalkeeper(player)) continue;
    const role = String(player.role || "").toUpperCase();
    player.role = role === "GK" || role.includes("GOALKEEPER") ? "CB" : player.role;
    if (String(player.team || "").toUpperCase() === "GK") player.team = "DEF";
    player.number = typeof player.number === "number" && player.number !== 1 ? player.number : undefined;
  }
  discardPhantomKeepers(diagram, [...used]);
}

function parseGoalsAvailable(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Session equipment is not "every drill is a two-goal match slice." Returns
 * null (not 0) when neither the request nor the drill states goalsAvailable
 * and the drillType doesn't force a clamp -- null means "unknown," which
 * enforceDiagramGoalAvailability treats as "trust whatever the diagram
 * already drew" (limitKeepersToDrawnFullGoals), not "strip every goal."
 * Collapsing unknown to 0 here previously discarded a drawn full-size goal
 * whenever goalsAvailable wasn't explicitly set.
 */
export function resolveDiagramGoalsAvailable(drill: any, input: GoalAvailabilityInput): number | null {
  const drillType = String(drill?.drillType || input.drillType || "").toUpperCase();
  if (isWarmupPicture(drillType)) return 0;
  const sessionGoals = parseGoalsAvailable(input.goalsAvailable) ?? parseGoalsAvailable(drill?.goalsAvailable);
  if (drillType === "TECHNICAL") return 0;
  if (drillType === "TACTICAL") return sessionGoals === null ? null : Math.min(sessionGoals, 1);
  return sessionGoals;
}

export function enforcePracticeArea(drill: any, input: GoalAvailabilityInput) {
  if (!drill || typeof drill !== "object") return;
  const format = String(input.fieldFormat || drill.fieldFormat || "").toUpperCase() as FieldFormat;
  const space = String(input.spaceConstraint || drill.spaceConstraint || drill.diagram?.pitch?.variant || "");
  const drillType = String(input.drillType || drill.drillType || "");
  const goalsAvailable =
    parseGoalsAvailable(input.goalsAvailable) ?? parseGoalsAvailable(drill?.goalsAvailable);
  if (format !== "7V7" && format !== "9V9" && format !== "11V11") return;
  if (!space) return;
  if (!shouldLockPracticeArea({ drillType, goalsAvailable })) return;
  const cap = practiceSpaceYards(format, space);
  if (!drill.organization || typeof drill.organization !== "object") drill.organization = {};
  const area =
    drill.organization.area && typeof drill.organization.area === "object" ? drill.organization.area : {};
  area.lengthYards = cap.lengthYards;
  area.widthYards = cap.widthYards;
  drill.organization.area = area;
  drill.spaceConstraint = String(space).toUpperCase();
  drill.fieldFormat = format;
}

export function enforceDiagramGoalAvailability(drill: any, input: GoalAvailabilityInput) {
  if (!drill) return;
  const goalsAvailable = resolveDiagramGoalsAvailable(drill, input);
  // Do NOT pass the drillType-clamped `goalsAvailable` to enforcePracticeArea --
  // resolveDiagramGoalsAvailable forces 0 for TECHNICAL/WARMUP regardless of
  // the coach's real equipment, but the practice-area size lock is about how
  // much FIELD the coach actually has, not whether THIS drill draws a goal.
  // Passing the clamped value here previously silently disabled the
  // TECHNICAL size lock (shouldLockPracticeArea requires goalsAvailable>=1)
  // even when the session genuinely had a goal available. Let
  // enforcePracticeArea read the real input/drill goalsAvailable itself.
  enforcePracticeArea(drill, { ...input, drillType: drill?.drillType ?? input.drillType });
  if (!drill.diagram) return;
  const warmup = isWarmupPicture(input.drillType || drill?.drillType);

  // goalsAvailable counts FULL-SIZE goals with a GK specifically -- it does
  // NOT mean "no goals at all." goalsAvailable=0 still allows mini-goals
  // (common, cheap equipment most coaches have regardless), it just rules
  // out a BIG/full-size goal and a dedicated GK. Strip only the big goal
  // deterministically (prompt-only isn't reliable enough on its own, same
  // reasoning as every other LOCK here); leave any mini-goals untouched.
  // Always demote keepers when no full-size goal remains -- the model
  // often still emits GK tokens in front of puggs even when it already
  // drew mini-only goals (no BIG to strip).
  if (goalsAvailable === 0) {
    const goals = Array.isArray(drill.diagram.goals) ? drill.diagram.goals : [];
    drill.diagram.goals = goals.filter((g: any) => {
      const t = String(g?.type || "").toUpperCase();
      return t === "MINI" || t === "SMALL" || t === "GATE" || t === "PUGG";
    });
    ensureOppositeMiniGoals(drill.diagram);
    demoteDiagramGoalkeepers(drill.diagram);
    drill.goalsAvailable = 0;
    drill.goalMode = "NONE";
    return;
  }

  if (goalsAvailable === 2) {
    ensureTwoFullGoalsAndKeepers(drill.diagram);
    drill.goalsAvailable = 2;
    drill.goalMode = "FULL2";
    drill.organization = drill.organization && typeof drill.organization === "object" ? drill.organization : {};
    const setupSteps = Array.isArray(drill.organization.setupSteps) ? drill.organization.setupSteps : [];
    const kept = setupSteps.filter(
      (step: any) => !/mini-?goal|pugg|no full-size gk/i.test(String(step))
    );
    const hasFullGoalStep = kept.some((step: any) => /full-size goal|full size goal/i.test(String(step)));
    drill.organization.setupSteps = hasFullGoalStep
      ? kept
      : ["Place a full-size goal with a GK on each end line.", ...kept];
    return;
  }

  if (goalsAvailable !== 1) {
    // Missing equipment flag: count keepers from drawn full goals, do not
    // invent a second net. Explicit 2 is handled above.
    limitKeepersToDrawnFullGoals(drill.diagram);
    return;
  }

  const diagram = drill.diagram;
  const existingGoals = Array.isArray(diagram.goals) ? diagram.goals : [];
  const existingBig = existingGoals.find(isBigGoal);
  // Fixed direction convention: DEF defends the left edge, ATT attacks the
  // right edge. Fallback matches it directly.
  const fallbackBig = { id: "G1", type: "BIG", width: 8, x: 94, y: 50, facingAngle: 270, teamAttacks: "ATT" };
  const bigGoal = normalizeBigGoal(existingBig, fallbackBig);
  // Don't trust the model's teamAttacks label here -- sandbox data showed
  // single-full-goal drills getting this backwards as often as two-goal
  // ones did before the same fix was applied there. Force it from the
  // goal's actual resolved x position instead (same rule, same reason as
  // the ensureDiagramVisuals correction in services/drill.ts).
  bigGoal.teamAttacks = Number(bigGoal.x ?? 50) >= 50 ? "ATT" : "DEF";
  const minis = miniGoalsOpposite(bigGoal);
  diagram.goals = [bigGoal, ...minis];
  diagram.miniGoals = 2;
  normalizeSingleGoalPlayers(diagram, bigGoal);

  // Filter the model's own goal-related setup steps out BEFORE rewriteGoalText
  // runs -- rewriteGoalText normalizes any phrasing ("two full-size goals",
  // "with GKs", etc.) into a singular "one full-size goal..." form, which
  // then no longer matches a plural-only filter regex applied afterward.
  // That ordering bug let every original goal-related step survive, each
  // reworded into a near-duplicate of the line below. Filter first, on the
  // model's original wording, with a regex broad enough to catch singular
  // forms too ("goal", "GK") -- not just the plural phrases.
  drill.organization = drill.organization && typeof drill.organization === "object" ? drill.organization : {};
  const setupSteps = Array.isArray(drill.organization.setupSteps) ? drill.organization.setupSteps : [];
  const normalizedGoalStep = "Use one full-size goal with a GK and two mini-goals on the opposite end for restarts (no GK at the mini-goals).";
  drill.organization.setupSteps = [
    normalizedGoalStep,
    ...setupSteps.filter((step: any) => !/\bgoals?\b|\bgks?\b|goalkeeper/i.test(String(step))),
  ];

  rewriteGoalText(drill);
  drill.goalsAvailable = 1;
  drill.goalMode = "FULL1";
}
