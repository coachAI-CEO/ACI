import type { DrawerParams, DrawerPlayer } from "../../types/drawer";
import type { ScenePicture } from "../../services/scene-document";
import type { ThesisIdea } from "./ideas";

export type CheckResult = { ok: boolean; issues: string[] };

export type SceneScores = {
  goals: CheckResult;
  keepers: CheckResult;
  roster: CheckResult;
  overlap: CheckResult;
  picture: CheckResult;
  spacing: CheckResult;
  horizontal: CheckResult;
  ball: CheckResult;
  arrowOrder: CheckResult;
  arrowDirection: CheckResult;
};

/** 2+ arrows must carry contiguous 1..N step numbers; a lone arrow carries none. */
function scoreArrowOrder(params: DrawerParams): CheckResult {
  const orders = params.arrows.map((a) => a.order);
  if (params.arrows.length < 2) {
    return check(orders.some((o) => typeof o === "number") ? ["a lone arrow was given a step badge"] : []);
  }
  const nums = orders.filter((o): o is number => typeof o === "number");
  if (nums.length !== params.arrows.length) {
    return check([`${params.arrows.length - nums.length} of ${params.arrows.length} arrows have no step number`]);
  }
  const sorted = [...nums].sort((a, b) => a - b);
  const contiguous = sorted.every((n, i) => n === i + 1);
  return check(contiguous ? [] : [`arrow steps are not 1..N (${sorted.join(",")})`]);
}

function scoreBall(params: DrawerParams): CheckResult {
  const issues: string[] = [];
  if (!params.ball) {
    issues.push("no ball on the pitch");
    return check(issues);
  }
  const first = params.arrows[0];
  if (first) {
    const d = Math.hypot(first.from.x - params.ball.x, first.from.y - params.ball.y);
    if (d > 8) issues.push(`ball is ${d.toFixed(0)} off the first arrow's start`);
  }
  return check(issues);
}

/**
 * What the painted picture is expected to show. Decoupled from ThesisIdea so
 * the stratified sampler (sample.ts) can score too — it derives an expectation
 * from a generated drill instead of a hand-written card.
 */
export type SceneExpectation = {
  picture?: ScenePicture;
  goalsAvailable: number;
  keepers: boolean;
  /** Rough outfield-per-side the card implies; roster tolerance is wide. */
  outfieldPerSide: number;
  coachLevel?: string;
  /** Technical/warmup: scene-document strips full goals and keepers. */
  workingGroup?: boolean;
  /** Raw arrow count the model emitted, before the painter dropped degenerates. */
  rawArrowCount?: number;
};

export function ideaExpectation(idea: ThesisIdea): SceneExpectation {
  return {
    picture: idea.picture,
    goalsAvailable: idea.goalsAvailable,
    keepers: idea.keepers,
    outfieldPerSide: idea.outfieldPerSide,
    coachLevel: idea.coachLevel,
    workingGroup: /WARMUP|TECHNICAL/i.test(idea.drillType),
  };
}

const BACK_ROLES = /^(CB|LB|RB|LCB|RCB|SW)$/i;

function check(issues: string[]): CheckResult {
  return { ok: issues.length === 0, issues };
}

function isKeeper(player: DrawerPlayer): boolean {
  return player.team === "gk" || /^GK$/i.test(player.role);
}

function minPairDist(players: DrawerPlayer[]): number {
  let min = Infinity;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      min = Math.min(min, Math.hypot(players[i].x - players[j].x, players[i].y - players[j].y));
    }
  }
  return min;
}

function scoreGoals(params: DrawerParams, exp: SceneExpectation): CheckResult {
  const full = params.goals.filter((g) => g.type === "full");
  const issues: string[] = [];
  if (exp.workingGroup) {
    if (full.length) issues.push(`working-group picture drew ${full.length} full goal(s) (should be stripped)`);
    return check(issues);
  }
  if (exp.picture === "rondo") {
    if (full.length) issues.push("rondo drew a full-size goal");
    return check(issues);
  }
  if (exp.goalsAvailable >= 2) {
    if (full.length < 2) issues.push(`wanted two full goals, drew ${full.length}`);
    const left = full.filter((g) => g.x <= 8);
    const right = full.filter((g) => g.x >= 92);
    if (full.length >= 2 && (!left.length || !right.length)) issues.push("full goals are not on the left and right ends");
    for (const g of full) {
      if (Math.abs(g.y - 50) > 12) issues.push("full goal is not vertically centred (y=50)");
    }
  } else if (exp.goalsAvailable === 1) {
    if (full.length !== 1) issues.push(`wanted one full goal, drew ${full.length}`);
  } else if (full.length) {
    issues.push("card has no full goal, picture drew one");
  }
  return check(issues);
}

function scoreKeepers(params: DrawerParams, exp: SceneExpectation): CheckResult {
  const gks = params.players.filter(isKeeper);
  const issues: string[] = [];
  const wantKeepers = exp.keepers && !exp.workingGroup && exp.goalsAvailable >= 1;
  if (!wantKeepers) {
    if (gks.length) issues.push(`no GK expected, picture drew ${gks.length}`);
    return check(issues);
  }
  if (gks.length < (exp.goalsAvailable >= 2 ? 2 : 1)) {
    issues.push(`wanted keepers on the posts, drew ${gks.length}`);
  }
  const full = params.goals.filter((g) => g.type === "full");
  for (const gk of gks) {
    const onLine = gk.x <= 8 || gk.x >= 92;
    if (!onLine) issues.push(`GK ${gk.id} is off the goal line (x=${gk.x.toFixed(0)})`);
    if (full.length && Math.abs(gk.y - 50) > 14) issues.push(`GK ${gk.id} is not centred in the posts`);
  }
  const leftover = params.players.filter((p) => !isKeeper(p) && (p.x <= 6 || p.x >= 94) && Math.abs(p.y - 50) < 10);
  for (const p of leftover) issues.push(`outfield ${p.role || p.id} sitting in a net`);
  return check(issues);
}

function scoreRoster(params: DrawerParams, exp: SceneExpectation): CheckResult {
  const want = exp.outfieldPerSide * 2 + (exp.keepers && !exp.workingGroup ? 2 : 0);
  const got = params.players.length;
  const issues: string[] = [];
  if (got < 2) issues.push("almost no shirts on the pitch");
  if (want > 0 && (got < want - 3 || got > want + 3)) {
    issues.push(`player count ${got} is not the practice (~${want} from the card)`);
  }
  // Hard ceiling for an open two-team match picture: never more than a full
  // roster for this format plus a small margin.
  if (!exp.workingGroup && !exp.picture && want > 0 && got > want + 4) {
    issues.push(`match picture drew ${got} shirts — over the full roster (~${want}) for this card`);
  }
  const home = params.players.filter((p) => p.team === "home").length;
  const away = params.players.filter((p) => p.team === "away").length;
  if (exp.picture === "rondo") {
    if (home + away < 4) issues.push("rondo has too few shirts");
  } else if (exp.picture === "center") {
    if (home < 1 || away < 1) issues.push("1v1/channel is missing a colour");
  } else if (!exp.workingGroup) {
    if (home < 2) issues.push("no attacking team");
    if (away < 2) issues.push("no defending team");
  }
  return check(issues);
}

function scoreOverlap(params: DrawerParams): CheckResult {
  const outfield = params.players.filter((p) => !isKeeper(p));
  if (outfield.length < 2) return check([]);
  const min = minPairDist(outfield);
  if (min < 4.5) return check([`shirts overlap (${min.toFixed(1)} on 0-100)`]);
  return check([]);
}

/** Cluster / degenerate-layout guard, separate from pairwise overlap. */
function scoreSpacing(params: DrawerParams, exp: SceneExpectation): CheckResult {
  const pts = params.players;
  if (pts.length < 3) return check([]);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadY = Math.max(...ys) - Math.min(...ys);
  const issues: string[] = [];
  if (spreadX < 6 && spreadY < 6) issues.push("all players collapsed onto one point");
  // A full two-team match picture should use most of the length.
  if (!exp.workingGroup && !exp.picture && exp.goalsAvailable >= 1 && spreadX < 30) {
    issues.push(`match picture only spans x=${spreadX.toFixed(0)} — teams share the same third`);
  }
  return check(issues);
}

/** The rendered pitch is landscape; the layout must read wider than tall. */
function scoreHorizontal(params: DrawerParams): CheckResult {
  const anchors = [
    ...params.players.map((p) => ({ x: p.x, y: p.y })),
    ...params.goals.map((g) => ({ x: g.x, y: g.y })),
  ];
  if (anchors.length < 3) return check([]);
  const xs = anchors.map((a) => a.x);
  const ys = anchors.map((a) => a.y);
  const rangeX = Math.max(...xs) - Math.min(...xs);
  const rangeY = Math.max(...ys) - Math.min(...ys);
  // Field panel is ~1.8x wider than tall — weight before comparing.
  if (rangeY * 382 > rangeX * 688 * 1.15) {
    return check([`layout is taller than wide (x-range ${rangeX.toFixed(0)}, y-range ${rangeY.toFixed(0)}) — must be horizontal`]);
  }
  return check([]);
}

function scoreArrows(params: DrawerParams, exp: SceneExpectation): CheckResult {
  if (typeof exp.rawArrowCount !== "number") return check([]);
  const dropped = Math.max(0, exp.rawArrowCount - params.arrows.length);
  if (dropped > 0) {
    return check([`${dropped} of ${exp.rawArrowCount} arrows dropped as degenerate (unmatched endpoint)`]);
  }
  return check([]);
}

function scorePicture(params: DrawerParams, exp: SceneExpectation): CheckResult {
  const issues: string[] = [];
  const outfield = params.players.filter((p) => !isKeeper(p));
  if (outfield.length < 2) return check(issues);

  const xs = outfield.map((p) => p.x);
  const ys = outfield.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

  if (exp.picture === "rondo" || exp.picture === "center") {
    if (Math.abs(cx - 50) > 18 || Math.abs(cy - 50) > 18) {
      issues.push(`${exp.picture} is not in the middle of the pitch`);
    }
    if (span > 52) issues.push(`${exp.picture} is stretched across the pitch (span ${span.toFixed(0)})`);
  }

  if (exp.picture === "matchup") {
    const away = params.players.filter((p) => p.team === "away");
    const named = away.filter((p) => BACK_ROLES.test(p.role));
    const backs = named.length >= 3 ? named : [...away].sort((a, b) => b.x - a.x).slice(0, Math.min(4, away.length));
    if (backs.length >= 3) {
      const meanX = backs.reduce((sum, p) => sum + p.x, 0) / backs.length;
      if (meanX < 56) issues.push(`back line too high (mean x=${meanX.toFixed(0)}, halfway is 50)`);
      const ySpan = Math.max(...backs.map((p) => p.y)) - Math.min(...backs.map((p) => p.y));
      if (ySpan < 22) issues.push(`back line has no shape (vertical span ${ySpan.toFixed(0)})`);
    }
    const home = params.players.filter((p) => p.team === "home");
    if (home.length >= 3 && away.length >= 3) {
      const homeX = home.reduce((s, p) => s + p.x, 0) / home.length;
      const awayX = away.reduce((s, p) => s + p.x, 0) / away.length;
      if (Math.abs(homeX - awayX) < 8) issues.push("both teams share the same spine");
      const homeSpan = Math.max(...home.map((p) => p.x)) - Math.min(...home.map((p) => p.x));
      if (homeSpan < 28) issues.push("attack has no width (no far-side target)");
    }
  }

  return check(issues);
}

/** Frozen scene checks. No 11v11 formation-line contract — the card is law. */
export function scoreScene(
  params: DrawerParams,
  exp: SceneExpectation
): {
  pass: boolean;
  scores: SceneScores;
  issues: string[];
} {
  const scores: SceneScores = {
    goals: scoreGoals(params, exp),
    keepers: scoreKeepers(params, exp),
    roster: scoreRoster(params, exp),
    overlap: scoreOverlap(params),
    picture: scorePicture(params, exp),
    spacing: scoreSpacing(params, exp),
    horizontal: scoreHorizontal(params),
    ball: scoreBall(params),
    arrowOrder: scoreArrowOrder(params),
    arrowDirection: scoreArrowDirection(params),
  };
  const arrows = scoreArrows(params, exp);
  const issues = [...Object.values(scores).flatMap((c) => c.issues), ...arrows.issues];
  return { pass: issues.length === 0, scores, issues };
}

/**
 * Sequence sanity: 2-3 frames, each frame keeps the full roster (carry-forward
 * worked), each frame has exactly one ball, and the ball moves across frames
 * (a static ball across a "mechanism" sequence means the frames are cosmetic).
 */
export function scoreSequence(frames: DrawerParams[]): CheckResult {
  const issues: string[] = [];
  if (frames.length < 2) return check(issues);
  if (frames.length > 3) issues.push(`${frames.length} frames — cap is 3`);
  const counts = frames.map((f) => f.players.length);
  if (Math.max(...counts) - Math.min(...counts) > 1) {
    issues.push(`roster jumps across frames (${counts.join("→")}) — carry-forward failed`);
  }
  for (let i = 0; i < frames.length; i++) {
    if (!frames[i].ball) issues.push(`frame ${i} has no ball`);
  }
  const balls = frames.map((f) => f.ball).filter(Boolean) as Array<{ x: number; y: number }>;
  if (balls.length >= 2) {
    const moved = balls.some((b, i) => i > 0 && Math.hypot(b.x - balls[0].x, b.y - balls[0].y) > 4);
    if (!moved) issues.push("ball never moves across the sequence");
  }
  return check(issues);
}

/**
 * A forward pass/run that advances toward one goal but starts from a shirt of
 * the team defending that goal — e.g. a red DM making the blue build-up pass.
 * Nearest shirt to the arrow tail is taken as the owner.
 */
function scoreArrowDirection(params: DrawerParams): CheckResult {
  const home = params.players.filter((p) => p.team === "home");
  const away = params.players.filter((p) => p.team === "away");
  if (home.length < 2 || away.length < 2 || params.arrows.length === 0) return check([]);
  const avg = (ps: DrawerPlayer[]) => ps.reduce((s, p) => s + p.x, 0) / ps.length;
  const homeAttacksRight = avg(home) < avg(away);
  const issues: string[] = [];

  for (const a of params.arrows) {
    if (a.type !== "pass" && a.type !== "run") continue;
    const dx = a.to.x - a.from.x;
    if (Math.abs(dx) < 15) continue;
    // nearest shirt to the tail is the presumed owner
    let near: DrawerPlayer | null = null;
    let best = 12;
    for (const p of params.players) {
      const d = Math.hypot(p.x - a.from.x, p.y - a.from.y);
      if (d < best) {
        best = d;
        near = p;
      }
    }
    if (!near || (near.team !== "home" && near.team !== "away")) continue;
    const nearAttacksRight = (near.team === "home") === homeAttacksRight;
    const towardOwnGoal = nearAttacksRight ? dx < 0 : dx > 0;
    const deepInOwnEnd = nearAttacksRight ? a.to.x <= 25 : a.to.x >= 75;
    if (towardOwnGoal && deepInOwnEnd) {
      issues.push(
        `step ${a.order ?? "?"} (${a.type}) drives into ${near.team === "home" ? "away" : "home"}'s attacking end but starts from a ${near.team} shirt (${near.role})`
      );
    }
  }
  return check(issues);
}

export function frozenConfidence(scores: SceneScores): number {
  const checks = Object.values(scores);
  const ok = checks.filter((c) => c.ok).length;
  return Math.round((ok / Math.max(1, checks.length)) * 100);
}
