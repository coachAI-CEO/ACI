type GoalAvailabilityInput = {
  goalsAvailable?: number | null;
};

function isGoalkeeper(player: any): boolean {
  const role = String(player?.role || "").toUpperCase();
  const team = String(player?.team || "").toUpperCase();
  return team === "GK" || player?.number === 1 || role === "GK" || role.includes("GOALKEEPER");
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

  const gks = players.filter(isGoalkeeper);
  // If the model never labeled ANY player as a goalkeeper for this drill,
  // there was nothing here to reposition -- the loop below only relabels
  // an EXISTING gk-marked player, so a roster with zero of them left the
  // real goal drawn on the field with nobody defending it. Fall back to
  // promoting whichever player is already closest to the goal, same
  // selection logic as when a GK candidate does exist, so a real goal
  // never ships without a keeper.
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
      // Previously this repositioned the GK next to the real goal but left
      // player.team unchanged -- normalizeGoalkeeperPositions (the very
      // next step in the pipeline) derives "which goal is this GK's own"
      // from player.team, so a stale team value made it recompute the
      // WRONG own-goal and drag the correctly-placed GK right back to the
      // mini-goal end that explicitly isn't supposed to have one. Setting
      // team here keeps the two functions agreeing on which side this
      // player is actually defending.
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
      if (Number(bigGoal.y ?? 50) < 20 && Number(player.y ?? 50) > 88) player.y = 82;
      if (Number(bigGoal.y ?? 50) > 80 && Number(player.y ?? 50) < 12) player.y = 18;
    }
  }
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
 * 0 full goals → no GKs. 1 full goal → one GK on that goal, extras become CB.
 * 2+ full goals → leave keepers alone.
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
  }
}

function parseGoalsAvailable(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function enforceDiagramGoalAvailability(drill: any, input: GoalAvailabilityInput) {
  if (!drill || !drill.diagram) return;
  const goalsAvailable =
    parseGoalsAvailable(drill?.goalsAvailable) ?? parseGoalsAvailable(input.goalsAvailable);

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
    drill.diagram.goals = goals.filter((g: any) => !isBigGoal(g));
    demoteDiagramGoalkeepers(drill.diagram);
    return;
  }

  if (goalsAvailable !== 1) {
    // Trust the goals the model actually drew. A 9v9 attacking-third
    // drill is often generated with goalsAvailable=2 but only one BIG
    // goal on the far line -- the extra GK then has nowhere to stand
    // and lands in the same net. A missing equipment flag (null) is the
    // same situation: do not treat it as 0 and strip a drawn full goal.
    // Count keepers from drawn full goals, not from the equipment flag.
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
  const normalizedGoalStep = "Use one full-size goal with one GK and two mini-goals on the opposite end; no GK defends the mini-goal side.";
  drill.organization.setupSteps = [
    normalizedGoalStep,
    ...setupSteps.filter((step: any) => !/\bgoals?\b|\bgks?\b|goalkeeper/i.test(String(step))),
  ];

  rewriteGoalText(drill);
  drill.goalsAvailable = 1;
  drill.goalMode = "LARGE";
}
