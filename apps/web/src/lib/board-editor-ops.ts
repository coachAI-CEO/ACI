import type { DiagramPlayer, DiagramTeamCode, DiagramV1 } from "../types/diagram";

export const BOARD_SNAP_STEP = 2;
export const BOARD_NUDGE_STEP = 1;
export const BOARD_NUDGE_SHIFT = 4;
export const BOARD_NOTE_MAX = 500;
export const BOARD_STAMP_STORAGE_KEY = "aci-board-stamps-v1";

export type BoardStamp = {
  id: string;
  name: string;
  players: Array<{
    dx: number;
    dy: number;
    team: DiagramTeamCode;
    number?: number;
    role?: string;
  }>;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function snapCoord(n: number, enabled: boolean, step = BOARD_SNAP_STEP) {
  if (!enabled) return clamp(n);
  return clamp(Math.round(n / step) * step);
}

export function nextPlayerNumber(players: DiagramPlayer[]) {
  const used = new Set(players.map((p) => p.number).filter((n): n is number => typeof n === "number"));
  for (let n = 1; n <= 99; n++) {
    if (!used.has(n)) return n;
  }
  return 99;
}

export function duplicatePlayers(diagram: DiagramV1, ids: string[], offset = 3): DiagramV1 {
  const selected = diagram.players.filter((p) => ids.includes(p.id));
  if (!selected.length) return diagram;
  let players = [...diagram.players];
  const created: DiagramPlayer[] = [];
  for (const p of selected) {
    const copy: DiagramPlayer = {
      ...p,
      id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      x: clamp(p.x + offset),
      y: clamp(p.y + offset),
      number: nextPlayerNumber([...players, ...created]),
    };
    created.push(copy);
  }
  players = [...players, ...created];
  return { ...diagram, players };
}

export function flipPlayersHorizontal(diagram: DiagramV1, ids: string[]): DiagramV1 {
  const selected = diagram.players.filter((p) => ids.includes(p.id));
  if (!selected.length) return diagram;
  const cx = selected.reduce((s, p) => s + p.x, 0) / selected.length;
  return {
    ...diagram,
    players: diagram.players.map((p) =>
      ids.includes(p.id) ? { ...p, x: clamp(2 * cx - p.x) } : p
    ),
  };
}

export function nudgePlayers(
  diagram: DiagramV1,
  ids: string[],
  dx: number,
  dy: number,
  snap: boolean
): DiagramV1 {
  if (!ids.length) return diagram;
  return {
    ...diagram,
    players: diagram.players.map((p) =>
      ids.includes(p.id)
        ? { ...p, x: snapCoord(p.x + dx, snap), y: snapCoord(p.y + dy, snap) }
        : p
    ),
  };
}

export function assignPlayerGroup(diagram: DiagramV1, ids: string[], group: string | undefined): DiagramV1 {
  if (!ids.length) return diagram;
  return {
    ...diagram,
    players: diagram.players.map((p) => (ids.includes(p.id) ? { ...p, group } : p)),
  };
}

export function bringPlayersToFront(diagram: DiagramV1, ids: string[]): DiagramV1 {
  if (!ids.length) return diagram;
  const keep = diagram.players.filter((p) => !ids.includes(p.id));
  const move = diagram.players.filter((p) => ids.includes(p.id));
  return { ...diagram, players: [...keep, ...move] };
}

export function sendPlayersToBack(diagram: DiagramV1, ids: string[]): DiagramV1 {
  if (!ids.length) return diagram;
  const keep = diagram.players.filter((p) => !ids.includes(p.id));
  const move = diagram.players.filter((p) => ids.includes(p.id));
  return { ...diagram, players: [...move, ...keep] };
}

export function stampFromPlayers(players: DiagramPlayer[], name: string): BoardStamp | null {
  if (players.length < 2) return null;
  const cx = players.reduce((s, p) => s + p.x, 0) / players.length;
  const cy = players.reduce((s, p) => s + p.y, 0) / players.length;
  return {
    id: `st-${Date.now().toString(36)}`,
    name: name.slice(0, 40),
    players: players.map((p) => ({
      dx: p.x - cx,
      dy: p.y - cy,
      team: p.team,
      number: p.number,
      role: p.role,
    })),
  };
}

export function loadBoardStamps(): BoardStamp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BOARD_STAMP_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBoardStamp(stamp: BoardStamp) {
  const next = [...loadBoardStamps().filter((s) => s.id !== stamp.id), stamp].slice(-12);
  window.localStorage.setItem(BOARD_STAMP_STORAGE_KEY, JSON.stringify(next));
}

export function placeBoardStamp(diagram: DiagramV1, stamp: BoardStamp, at = { x: 50, y: 50 }): DiagramV1 {
  let players = [...diagram.players];
  const created: DiagramPlayer[] = [];
  for (const p of stamp.players) {
    if (players.length + created.length >= 30) break;
    created.push({
      id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      team: p.team,
      number: nextPlayerNumber([...players, ...created]),
      role: p.role,
      x: clamp(at.x + p.dx),
      y: clamp(at.y + p.dy),
    });
  }
  return { ...diagram, players: [...players, ...created] };
}
