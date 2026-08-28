/**
 * Shared player-spacing helpers for the tactical board.
 *
 * Pure functions on `DiagramPlayer` / `DiagramV1` (canonical types from
 * `@aci/shared/types/tactical-board`). No DOM, no React, no I/O. Safe to
 * import from the web editor, the API, and the future mobile editor.
 *
 * Previously lived at `apps/web/src/lib/board-player-spacing.ts`; that
 * file is now a thin re-export.
 */

import type {
  WebDiagramPlayer,
  WebDiagramSequenceFrame,
  WebDiagramV1,
} from "../types/tactical-board";

// Local type aliases for readability within this module.
type DiagramPlayer = WebDiagramPlayer;
type DiagramSequenceFrame = WebDiagramSequenceFrame;
type DiagramV1 = WebDiagramV1;

/** Same-team token gap. Compact 11v11 press cannot use 8% of the pitch. */
export const MIN_PLAYER_GAP = 3.5;
export const OPPOSITE_TEAM_GAP = 2;

type PlayerLike = Pick<DiagramPlayer, "x" | "y" | "team"> & {
  number?: number;
  role?: string;
};

function clamp01to100(n: number) {
  return Math.max(0, Math.min(100, n));
}

function isGkPlayer(p: PlayerLike) {
  return p.number === 1 || String(p.role || "").toUpperCase() === "GK";
}

function pairGap(a: PlayerLike, b: PlayerLike, minGap: number) {
  const opposite =
    Boolean(a.team && b.team && a.team !== b.team && a.team !== "NEUTRAL" && b.team !== "NEUTRAL");
  return opposite ? OPPOSITE_TEAM_GAP : minGap;
}

export function playersNeedSpacing(
  players: PlayerLike[] | undefined,
  minGap = MIN_PLAYER_GAP
): boolean {
  const list = players || [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const gap = pairGap(list[i], list[j], minGap);
      if (Math.hypot(list[j].x - list[i].x, list[j].y - list[i].y) < gap) {
        return true;
      }
    }
  }
  return false;
}

export function diagramPlayersNeedUnstack(diagram: DiagramV1, minGap = MIN_PLAYER_GAP): boolean {
  if (playersNeedSpacing(diagram.players, minGap)) return true;
  return (diagram.sequence?.frames || []).some((f) => playersNeedSpacing(f.players, minGap));
}

function coordsKey(players: PlayerLike[] | undefined) {
  return (players || []).map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join("|");
}

export function diagramPlayerCoordsEqual(a: DiagramV1, b: DiagramV1): boolean {
  if (coordsKey(a.players) !== coordsKey(b.players)) return false;
  const af = a.sequence?.frames || [];
  const bf = b.sequence?.frames || [];
  if (af.length !== bf.length) return false;
  return af.every((f, i) => coordsKey(f.players) === coordsKey(bf[i]?.players));
}

export function separateOverlappingPlayers<T extends PlayerLike>(
  players: T[],
  minGap = MIN_PLAYER_GAP,
  opts?: { preserveY?: boolean; /** When true, opposite teams use `minGap` too (no marking stacks). */ uniformGap?: boolean }
): T[] {
  const next = players.map((p) => ({ ...p }));
  const n = next.length;
  const preserveY = opts?.preserveY ?? n >= 18;
  const gapFor = (a: PlayerLike, b: PlayerLike) =>
    opts?.uniformGap ? minGap : pairGap(a, b, minGap);
  for (let pass = 0; pass < 24; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = next[i];
        const b = next[j];
        const target = gapFor(a, b) + 0.05;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= target) continue;
        let aPush = 0.5;
        let bPush = 0.5;
        if (isGkPlayer(a) && !isGkPlayer(b)) {
          aPush = 0;
          bPush = 1;
        } else if (isGkPlayer(b) && !isGkPlayer(a)) {
          aPush = 1;
          bPush = 0;
        }
        if (preserveY) {
          const neededAbsDx = Math.sqrt(Math.max(0, target * target - dy * dy));
          const extra = neededAbsDx - Math.abs(dx) + 0.05;
          const dir = Math.abs(dx) < 0.04 ? (i % 2 === 0 ? 1 : -1) : dx >= 0 ? 1 : -1;
          next[i] = { ...a, x: clamp01to100(a.x - dir * extra * aPush) };
          next[j] = { ...b, x: clamp01to100(b.x + dir * extra * bPush) };
        } else {
          let ux = dx;
          let uy = dy;
          let mag = d;
          if (mag < 0.08) {
            const ang = (((i * 13 + j * 17) % 360) * Math.PI) / 180;
            ux = Math.cos(ang);
            uy = Math.sin(ang);
            mag = 0.08;
          }
          const nx = ux / mag;
          const ny = uy / mag;
          const need = target - mag;
          next[i] = {
            ...a,
            x: clamp01to100(a.x - nx * need * aPush),
            y: clamp01to100(a.y - ny * need * aPush),
          };
          next[j] = {
            ...b,
            x: clamp01to100(b.x + nx * need * bPush),
            y: clamp01to100(b.y + ny * need * bPush),
          };
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
  return next;
}

export function unstackDiagramPlayers(diagram: DiagramV1): DiagramV1 {
  const players = separateOverlappingPlayers(diagram.players || []);
  const frames = diagram.sequence?.frames?.map((f: DiagramSequenceFrame) => ({
    ...f,
    players: separateOverlappingPlayers(f.players || []),
  }));
  return {
    ...diagram,
    players,
    sequence: frames
      ? {
          frames,
          activeFrameId:
            frames.find((f) => f.id === diagram.sequence?.activeFrameId)?.id || frames[0].id,
        }
      : diagram.sequence,
  };
}
