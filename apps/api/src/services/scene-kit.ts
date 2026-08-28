import { isWarmupPicture } from "../data/field-dimensions";
import type { DrawerGoal, DrawerPlayer } from "../types/drawer";
import { snapKeepersToGoals } from "./scene-space";
import type { WebDiagramV1 } from "./web-diagram-v1";

/**
 * The card's kit intent, carried explicitly so sceneToDrawerParams can
 * reconcile the painted picture against it.
 */
export type SceneKitSpec = {
  /** FULL-size goals with a GK. <= 0 means mini-goals/gates only, no keeper. */
  goalsAvailable?: number;
  drillType?: string;
  /** Card names a target for the DEFENDING team (counter gate, dribble line). */
  defensiveTarget?: boolean;
};

function isKeeper(p: DrawerPlayer): boolean {
  return p.team === "gk" || /^GK$/i.test(p.role);
}

// ---------------------------------------------------------------------------
// Role sides — a role's L/R prefix is that team's own left/right facing its
// attack, and the teams face opposite ways. home attacks right: home L* top,
// R* bottom. away is mirrored. The scene model gets away's L/R backwards
// constantly.
// ---------------------------------------------------------------------------

function roleSide(role: string): "L" | "R" | null {
  const m = /^([LR])[A-Z]/i.exec(role || "");
  return m ? (m[1].toUpperCase() as "L" | "R") : null;
}

export function fixRoleSides(players: DrawerPlayer[]): DrawerPlayer[] {
  return players.map((p) => {
    if (isKeeper(p)) return p;
    const side = roleSide(p.role);
    if (!side) return p;
    const wantBottom = p.team === "away" ? side === "L" : side === "R";
    const isBottom = p.y > 50;
    if (wantBottom === isBottom || Math.abs(p.y - 50) < 8) return p;
    return { ...p, y: Math.min(100, Math.max(0, 100 - p.y)) };
  });
}

// ---------------------------------------------------------------------------
// Roster re-label — the small model honors a 4-role roster but not a 10-role
// one, and paraphrases either. When the card carries an explicit roster and
// the shirt count matches, assign each label to the same-team shirt whose
// position best fits that label's meaning. Keeps the model's x/y.
// ---------------------------------------------------------------------------

/** Rough vertical line of a role: 0 GK, 1 back, 2 holding, 3 mid, 4 AM, 5 front. */
function lineRank(label: string): number {
  const u = label.toUpperCase();
  if (/^GK/.test(u)) return 0;
  if (/(WB|LB|RB|CB|B|SW)$/.test(u)) return 1;
  if (/DM$/.test(u)) return 2;
  if (/(AM|CAM)$/.test(u)) return 4;
  if (/(W|WNG|F|FW|CF|ST|LF|RF)$/.test(u)) return 5;
  return 3;
}
function sideRank(label: string): number {
  const u = label.toUpperCase();
  return /^L[A-Z]/.test(u) ? 0 : /^R[A-Z]/.test(u) ? 2 : 1;
}

function assign(shirt: DrawerPlayer, label: string): void {
  shirt.role = label;
  shirt.label = label;
}

function relabelTeam(shirts: DrawerPlayer[], labels: string[], team: "home" | "away"): void {
  if (labels.length < 2 || labels.length !== shirts.length) return;
  const home = team === "home";
  const wideLabels = labels.filter((l) => sideRank(l) !== 1);
  const midLabels = labels.filter((l) => sideRank(l) === 1);

  // Wide shirts = the ones furthest off the centre line.
  const byWidth = [...shirts].sort((a, b) => Math.abs(b.y - 50) - Math.abs(a.y - 50));
  const wideShirts = byWidth.slice(0, wideLabels.length);
  const midShirts = byWidth.slice(wideLabels.length);

  // Wide: sort labels L→R, shirts by y; home L is low y, away is mirrored.
  wideLabels.sort((a, b) => sideRank(a) - sideRank(b));
  wideShirts.sort((a, b) => a.y - b.y);
  wideLabels.forEach((l, i) => assign(wideShirts[home ? i : wideLabels.length - 1 - i], l));

  // Mid: sort labels back→front, shirts by depth (home forward = high x).
  midLabels.sort((a, b) => lineRank(a) - lineRank(b));
  midShirts.sort((a, b) => (home ? a.x - b.x : b.x - a.x));
  midLabels.forEach((l, i) => assign(midShirts[i], l));
}

export function relabelFromRoster(
  players: DrawerPlayer[],
  roster: { home?: string[]; away?: string[] } | null | undefined
): DrawerPlayer[] {
  if (!roster) return players;
  const next = players.map((p) => ({ ...p }));
  relabelTeam(
    next.filter((p) => p.team === "home"),
    roster.home || [],
    "home"
  );
  relabelTeam(
    next.filter((p) => p.team === "away"),
    roster.away || [],
    "away"
  );
  return next;
}

// ---------------------------------------------------------------------------
// Arrow ownership — the model sometimes starts a forward pass into a team's
// attacking third from an OPPONENT shirt (e.g. a red DM makes the blue
// build-up pass). When the geometry is unambiguous, rebind the arrow's
// origin to the nearest shirt of the team the pass actually belongs to.
// ---------------------------------------------------------------------------

type RawArrow = NonNullable<WebDiagramV1["arrows"]>[number];

function avgX(players: DrawerPlayer[]): number {
  return players.length ? players.reduce((s, p) => s + p.x, 0) / players.length : 50;
}

export function reassignArrowOwners(arrows: RawArrow[], players: DrawerPlayer[]): RawArrow[] {
  const home = players.filter((p) => p.team === "home");
  const away = players.filter((p) => p.team === "away");
  if (home.length < 1 || away.length < 1) return arrows;
  const homeAttacksRight = avgX(home) < avgX(away);
  const byId = new Map(players.map((p) => [p.id, p]));

  const targetX = (ref: RawArrow["to"] | RawArrow["from"]): number | null => {
    if (ref && "playerId" in ref && ref.playerId && byId.has(ref.playerId)) return byId.get(ref.playerId)!.x;
    const x = Number((ref as { x?: number })?.x);
    return Number.isFinite(x) ? x : null;
  };

  return arrows.map((a) => {
    const type = String(a.type || "").toLowerCase();
    // pass + run are directional advancement; press/cover/transition are not.
    if (type !== "pass" && type !== "run" && type !== "movement") return a;
    const fromId = a.from && "playerId" in a.from ? a.from.playerId : undefined;
    const fp = fromId ? byId.get(fromId) : undefined;
    if (!fp || (fp.team !== "home" && fp.team !== "away")) return a;
    const tx = targetX(a.to);
    const fx = targetX(a.from);
    if (tx == null || fx == null) return a;
    const dx = tx - fx;
    if (Math.abs(dx) < 15) return a;

    // Does this pass/run drive toward the goal fp's own team DEFENDS, and land
    // right on top of it? That's only sensible if fp is really the OTHER
    // team — a shirt driving the ball into its own net area.
    const fpAttacksRight = (fp.team === "home") === homeAttacksRight;
    const towardOwnGoal = fpAttacksRight ? dx < 0 : dx > 0;
    const deepInOwnEnd = fpAttacksRight ? tx <= 25 : tx >= 75;
    if (!towardOwnGoal || !deepInOwnEnd) return a;

    const owner: DrawerPlayer["team"] = fp.team === "home" ? "away" : "home";
    // Rebind to the closest owner shirt near the arrow start (<= 18 units).
    const pool = (owner === "home" ? home : away)
      .map((p) => ({ p, d: Math.hypot(p.x - fp.x, p.y - fp.y) }))
      .filter((c) => c.d <= 18)
      .sort((c1, c2) => c1.d - c2.d);
    if (!pool.length) return a;
    return { ...a, from: { playerId: pool[0].p.id } };
  });
}

// ---------------------------------------------------------------------------
// Kit reconciliation — scene-path equivalent of enforceDiagramGoalAvailability.
// Deterministic and idempotent.
// ---------------------------------------------------------------------------

/** GK the card didn't ask for → an outfield defender on the near half. */
function demoteToOutfield(p: DrawerPlayer): DrawerPlayer {
  return { ...p, team: p.x < 50 ? "home" : "away", role: "CB" };
}

export function enforceSceneKit(
  players: DrawerPlayer[],
  goals: DrawerGoal[],
  spec: SceneKitSpec
): { players: DrawerPlayer[]; goals: DrawerGoal[] } {
  const drillType = String(spec.drillType || "");
  const noFullGoals =
    (typeof spec.goalsAvailable === "number" && spec.goalsAvailable <= 0) ||
    isWarmupPicture(drillType) ||
    /TECHNICAL/i.test(drillType);

  let outGoals = noFullGoals ? goals.filter((g) => g.type !== "full") : [...goals];
  const fullPosts = outGoals.filter((g) => g.type === "full");

  let outPlayers: DrawerPlayer[];
  if (fullPosts.length === 0) {
    outPlayers = players.map((p) => (isKeeper(p) ? demoteToOutfield(p) : p));
  } else {
    outPlayers = snapKeepersToGoals(players, outGoals);
    const keepers = outPlayers.filter(isKeeper);
    // Too many keepers → demote the ones not parked on a post (x 4 / 96).
    if (keepers.length > fullPosts.length) {
      outPlayers = outPlayers.map((p) =>
        isKeeper(p) && p.x !== 4 && p.x !== 96 ? demoteToOutfield(p) : p
      );
    }
    // Too few → a full goal with no keeper. Add one on its line.
    for (const post of fullPosts) {
      const gkX = post.x <= 50 ? 4 : 96;
      const covered = outPlayers.some((p) => isKeeper(p) && Math.abs(p.x - gkX) < 8);
      if (!covered) {
        outPlayers = [
          ...outPlayers,
          { id: `GK-${gkX}`, team: "gk", role: "GK", x: gkX, y: post.y, number: 1 },
        ];
      }
    }
  }

  // Two-team game: BOTH ends need something to score into. If one end is bare,
  // add a counter-gate there so the picture reads as a two-way game.
  if (spec.defensiveTarget) {
    const hasLeft = outGoals.some((g) => g.x <= 30);
    const hasRight = outGoals.some((g) => g.x >= 70);
    if (hasRight && !hasLeft) {
      outGoals = [...outGoals, { id: "DG-L", type: "gate", x: 3, y: 50, width: 6 }];
    } else if (hasLeft && !hasRight) {
      outGoals = [...outGoals, { id: "DG-R", type: "gate", x: 97, y: 50, width: 6 }];
    }
  }

  return { players: outPlayers, goals: outGoals };
}
