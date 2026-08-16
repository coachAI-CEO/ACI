import type { DiagramPlayer, DiagramSequenceFrame, DiagramV1 } from "@/types/diagram";

/** Pitch units between shirt centers — tokens are ~3 units across. */
export const MIN_PLAYER_GAP = 8;

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

export function playersNeedSpacing(
  players: PlayerLike[] | undefined,
  minGap = MIN_PLAYER_GAP
): boolean {
  const list = players || [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (Math.hypot(list[j].x - list[i].x, list[j].y - list[i].y) < minGap) {
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
  minGap = MIN_PLAYER_GAP
): T[] {
  const next = players.map((p) => ({ ...p }));
  const n = next.length;
  for (let pass = 0; pass < 10; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = next[i];
        const b = next[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= minGap) continue;
        if (d < 0.08) {
          const ang = (((i * 13 + j * 17) % 360) * Math.PI) / 180;
          const opposite =
            a.team &&
            b.team &&
            a.team !== b.team &&
            a.team !== "NEUTRAL" &&
            b.team !== "NEUTRAL";
          if (opposite) {
            dx = Math.cos(ang) >= 0 ? 1 : -1;
            dy = 0;
          } else {
            dx = Math.cos(ang);
            dy = Math.sin(ang);
          }
          d = 0.08;
        }
        const ux = dx / d;
        const uy = dy / d;
        const need = minGap - d;
        const aGk = isGkPlayer(a);
        const bGk = isGkPlayer(b);
        let aPush = need / 2;
        let bPush = need / 2;
        if (aGk && !bGk) {
          aPush = 0;
          bPush = need;
        } else if (bGk && !aGk) {
          aPush = need;
          bPush = 0;
        }
        next[i] = {
          ...a,
          x: clamp01to100(a.x - ux * aPush),
          y: clamp01to100(a.y - uy * aPush),
        };
        next[j] = {
          ...b,
          x: clamp01to100(b.x + ux * bPush),
          y: clamp01to100(b.y + uy * bPush),
        };
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
