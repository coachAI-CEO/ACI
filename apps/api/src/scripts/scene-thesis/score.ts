import type { DrawerParams, DrawerPlayer } from "../../types/drawer";
import type { ThesisIdea } from "./ideas";

export type CheckResult = { ok: boolean; issues: string[] };

export type SceneScores = {
  goals: CheckResult;
  keepers: CheckResult;
  roster: CheckResult;
  overlap: CheckResult;
  picture: CheckResult;
};

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

function scoreGoals(params: DrawerParams, idea: ThesisIdea): CheckResult {
  const full = params.goals.filter((g) => g.type === "full");
  const issues: string[] = [];
  if (idea.picture === "rondo") {
    if (full.length) issues.push("rondo drew a full-size goal");
    return check(issues);
  }
  if (idea.goalsAvailable >= 2) {
    if (full.length < 2) issues.push(`wanted two full goals, drew ${full.length}`);
    const left = full.filter((g) => g.x <= 8);
    const right = full.filter((g) => g.x >= 92);
    if (full.length >= 2 && (!left.length || !right.length)) issues.push("full goals are not on the left and right ends");
    for (const g of full) {
      if (Math.abs(g.y - 50) > 12) issues.push("full goal is not vertically centred (y=50)");
    }
  } else if (idea.goalsAvailable === 1) {
    if (full.length !== 1) issues.push(`wanted one full goal, drew ${full.length}`);
  } else if (full.length) {
    issues.push("card has no full goal, picture drew one");
  }
  return check(issues);
}

function scoreKeepers(params: DrawerParams, idea: ThesisIdea): CheckResult {
  const gks = params.players.filter(isKeeper);
  const issues: string[] = [];
  if (!idea.keepers) {
    if (gks.length) issues.push("card has no GK, picture drew one");
    return check(issues);
  }
  if (gks.length < (idea.goalsAvailable >= 2 ? 2 : 1)) {
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

function scoreRoster(params: DrawerParams, idea: ThesisIdea): CheckResult {
  const want = idea.outfieldPerSide * 2 + (idea.keepers ? 2 : 0);
  const got = params.players.length;
  const issues: string[] = [];
  if (got < want - 3 || got > want + 4) {
    issues.push(`player count ${got} is not the practice (~${want} from the card)`);
  }
  const home = params.players.filter((p) => p.team === "home").length;
  const away = params.players.filter((p) => p.team === "away").length;
  if (idea.picture === "rondo") {
    if (home + away < 4) issues.push("rondo has too few shirts");
  } else if (idea.picture === "center") {
    if (home < 1 || away < 1) issues.push("1v1/channel is missing a colour");
  } else {
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

function scorePicture(params: DrawerParams, idea: ThesisIdea): CheckResult {
  const issues: string[] = [];
  const outfield = params.players.filter((p) => !isKeeper(p));
  if (outfield.length < 2) return check(issues);

  const xs = outfield.map((p) => p.x);
  const ys = outfield.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

  if (idea.picture === "rondo" || idea.picture === "center") {
    if (Math.abs(cx - 50) > 18 || Math.abs(cy - 50) > 18) {
      issues.push(`${idea.picture} is not in the middle of the pitch`);
    }
    if (span > 52) issues.push(`${idea.picture} is stretched across the pitch (span ${span.toFixed(0)})`);
  }

  if (idea.picture === "matchup") {
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
export function scoreScene(params: DrawerParams, idea: ThesisIdea): {
  pass: boolean;
  scores: SceneScores;
  issues: string[];
} {
  const scores: SceneScores = {
    goals: scoreGoals(params, idea),
    keepers: scoreKeepers(params, idea),
    roster: scoreRoster(params, idea),
    overlap: scoreOverlap(params),
    picture: scorePicture(params, idea),
  };
  const issues = Object.values(scores).flatMap((c) => c.issues);
  return { pass: issues.length === 0, scores, issues };
}

export function frozenConfidence(scores: SceneScores): number {
  const checks = Object.values(scores);
  const ok = checks.filter((c) => c.ok).length;
  return Math.round((ok / Math.max(1, checks.length)) * 100);
}
