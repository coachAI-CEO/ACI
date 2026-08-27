import type { DrawerGoal, DrawerPlayer } from "../types/drawer";

function clamp(n: number, min = 4, max = 96): number {
  return Math.min(max, Math.max(min, n));
}

/** Scale a cluster so it sits as a small square around midfield. */
export function fitGroupInCenter<T extends { x: number; y: number }>(
  points: T[],
  targetSpan = 34
): T[] {
  if (points.length < 2) return points;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY, 8);
  const scale = targetSpan / span;
  return points.map((p) => ({
    ...p,
    x: clamp(50 + (p.x - cx) * scale),
    y: clamp(50 + (p.y - cy) * scale),
  }));
}

export function mapPoint(
  point: { x: number; y: number },
  from: { cx: number; cy: number; scale: number }
): { x: number; y: number } {
  return {
    x: clamp(50 + (point.x - from.cx) * from.scale),
    y: clamp(50 + (point.y - from.cy) * from.scale),
  };
}

export function groupFrame(points: Array<{ x: number; y: number }>, targetSpan = 34) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY, 8);
  return { cx, cy, scale: targetSpan / span };
}

/** Push overlapping shirts apart. Does not relayout formations. */
export function separatePlayers(players: DrawerPlayer[], minDist = 10): DrawerPlayer[] {
  const next = players.map((p) => ({ ...p, x: clamp(p.x), y: clamp(p.y) }));
  const rounds = 24;
  for (let round = 0; round < rounds; round++) {
    let moved = false;
    for (let i = 0; i < next.length; i++) {
      for (let j = i + 1; j < next.length; j++) {
        const dx = next[j].x - next[i].x;
        const dy = next[j].y - next[i].y;
        const dist = Math.hypot(dx, dy) || 0.01;
        if (dist >= minDist) continue;
        const push = (minDist - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        next[i].x = clamp(next[i].x - ux * push);
        next[i].y = clamp(next[i].y - uy * push);
        next[j].x = clamp(next[j].x + ux * push);
        next[j].y = clamp(next[j].y + uy * push);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return next;
}

function isKeeper(player: DrawerPlayer): boolean {
  return player.team === "gk" || /^GK$/i.test(player.role);
}

/** Sit each keeper on the goal line, centred in the posts. One keeper per full goal. */
export function snapKeepersToGoals(players: DrawerPlayer[], goals: DrawerGoal[]): DrawerPlayer[] {
  const posts = goals.filter((g) => g.type === "full");
  if (!posts.length) return players;
  const keepers = players.filter(isKeeper);
  if (!keepers.length) return players;

  const remaining = [...posts];
  const atGoal = new Map<string, DrawerGoal>();
  for (const keeper of [...keepers].sort((a, b) => a.x - b.x)) {
    if (!remaining.length) break;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dist = Math.hypot(keeper.x - remaining[i].x, keeper.y - remaining[i].y);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    atGoal.set(keeper.id, remaining[best]);
    remaining.splice(best, 1);
  }

  return players.map((player) => {
    const goal = atGoal.get(player.id);
    if (!goal) return player;
    const left = goal.x <= 50;
    return {
      ...player,
      team: "gk",
      role: "GK",
      x: left ? 4 : 96,
      y: goal.y,
    };
  });
}

/** Full goals on the left/right ends, vertically centred. Stops top/bottom nets (and rotated GKs in corners). */
export function pinGoalsToEnds(goals: DrawerGoal[]): DrawerGoal[] {
  const full = goals.filter((g) => g.type === "full");
  const rest = goals.filter((g) => g.type !== "full");
  const pinnedFull =
    full.length >= 2
      ? [
          { ...full[0], type: "full" as const, x: 0, y: 50 },
          { ...full[1], type: "full" as const, x: 100, y: 50 },
        ]
      : full.length === 1
        ? [{ ...full[0], type: "full" as const, x: full[0].x >= 50 ? 100 : 0, y: 50 }]
        : [];
  const pinnedRest = rest.map((g) => {
    if (g.type !== "mini") return g;
    if (g.x > 22 && g.x < 78) return g;
    return { ...g, x: g.x <= 50 ? 3 : 97, y: 50 };
  });
  return [...pinnedFull, ...pinnedRest];
}

const BACK_ROLES = /^(CB|LB|RB|LCB|RCB|SW)$/i;

function awayBacks(players: DrawerPlayer[]): DrawerPlayer[] {
  const away = players.filter((p) => p.team === "away");
  const named = away.filter((p) => BACK_ROLES.test(p.role));
  if (named.length >= 3) return named;
  return [...away].sort((a, b) => b.x - a.x).slice(0, Math.min(4, away.length));
}

/**
 * Red/away defend the right goal. Drop only the back line into their half.
 * Mids stay — a uniform pack-slide collapses the 4 into a blob on the strikers.
 */
export function dropBackLineToOwnHalf(players: DrawerPlayer[]): {
  players: DrawerPlayer[];
  shiftX: number;
  moved: DrawerPlayer[];
} {
  const backs = awayBacks(players);
  if (backs.length < 3) return { players, shiftX: 0, moved: [] };
  const meanX = backs.reduce((sum, p) => sum + p.x, 0) / backs.length;
  const target = 70;
  if (meanX >= 62) return { players, shiftX: 0, moved: [] };
  const shiftX = Math.min(18, target - meanX);
  const ids = new Set(backs.map((p) => p.id));
  return {
    shiftX,
    moved: backs,
    players: players.map((p) => (ids.has(p.id) ? { ...p, x: Math.min(85, p.x + shiftX) } : p)),
  };
}

/** Move a mark with shirts that we actually slid, not the whole red pack. */
export function shiftIfNearAway(
  point: { x: number; y: number },
  players: DrawerPlayer[],
  shiftX: number,
  maxDist = 12
): { x: number; y: number } {
  if (!shiftX || !players.length) return point;
  let best = Infinity;
  for (const p of players) {
    const dist = Math.hypot(p.x - point.x, p.y - point.y);
    if (dist < best) best = dist;
  }
  if (best > maxDist) return point;
  return { x: Math.min(92, point.x + shiftX), y: point.y };
}
