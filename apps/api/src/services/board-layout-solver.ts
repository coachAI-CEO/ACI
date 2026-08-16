import type { BoardElement } from './board-elements';
import {
  BOARD_PLACEMENTS,
  fitFormationToFormat,
  formatFromFormation,
  type BoardSymbolicDsl,
} from './board-symbolic-dsl';
import { build11v11FormationPlayers, type WebDiagramV1 } from './web-diagram-v1';

export const SOLVER_MIN_PLAYER_GAP = 8;

type Box = { x: number; y: number; width: number; height: number };
type Placement = (typeof BOARD_PLACEMENTS)[number];

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Pitch boxes in diagram % (y = goal-to-goal: 0 DEF/left, 100 ATT/right;
 * x = width: high x = top of screen).
 */
export function gridBox(intent: BoardSymbolicDsl['grid']['intent']): Box {
  switch (intent) {
    case 'half_att':
      return { x: 8, y: 50, width: 84, height: 46 };
    case 'half_def':
      return { x: 8, y: 4, width: 84, height: 46 };
    case 'third_left':
      return { x: 10, y: 2, width: 80, height: 31 };
    case 'third_middle':
      return { x: 12, y: 34, width: 76, height: 32 };
    case 'third_right':
      return { x: 10, y: 67, width: 80, height: 31 };
    case 'box_att':
      return { x: 28, y: 78, width: 44, height: 18 };
    case 'box_def':
      return { x: 28, y: 4, width: 44, height: 18 };
    case 'rondo':
      return { x: 28, y: 38, width: 44, height: 24 };
    case 'ssg_grid':
      return { x: 20, y: 28, width: 60, height: 44 };
    case 'full_pitch':
    default:
      return { x: 6, y: 4, width: 88, height: 92 };
  }
}

/** u = width (x), v = length (y) inside the grid box, 0–1. */
const GRID_UV: Partial<Record<Placement, { u: number; v: number }>> = {
  grid_nw: { u: 0.85, v: 0.12 },
  grid_n: { u: 0.85, v: 0.5 },
  grid_ne: { u: 0.85, v: 0.88 },
  grid_w: { u: 0.5, v: 0.12 },
  grid_c: { u: 0.5, v: 0.5 },
  grid_e: { u: 0.5, v: 0.88 },
  grid_sw: { u: 0.15, v: 0.12 },
  grid_s: { u: 0.15, v: 0.5 },
  grid_se: { u: 0.15, v: 0.88 },
  inside: { u: 0.5, v: 0.5 },
  own_gk: { u: 0.5, v: 0.94 },
  opp_gk: { u: 0.5, v: 0.06 },
};

function pointInBox(box: Box, u: number, v: number) {
  return {
    x: clamp(box.x + u * box.width),
    y: clamp(box.y + v * box.height),
  };
}

function pointOnEllipse(box: Box, index: number, total: number) {
  const n = Math.max(1, total);
  const ang = (2 * Math.PI * index) / n - Math.PI / 2;
  return {
    x: clamp(box.x + box.width / 2 + Math.cos(ang) * box.width * 0.42),
    y: clamp(box.y + box.height / 2 + Math.sin(ang) * box.height * 0.38),
  };
}

const INSIDE_DIAMOND: Array<{ u: number; v: number }> = [
  { u: 0.5, v: 0.32 },
  { u: 0.68, v: 0.5 },
  { u: 0.5, v: 0.68 },
  { u: 0.32, v: 0.5 },
  { u: 0.58, v: 0.4 },
  { u: 0.42, v: 0.6 },
];

function isGkShirt(p: WebDiagramV1['players'][number]) {
  return p.number === 1 || String(p.role || '').toUpperCase() === 'GK';
}

/** Compact defending block (ATT, high y) vs attackers (DEF, lower y) — not a vertical queue. */
function layoutSsgPlayers(
  players: WebDiagramV1['players'],
  box: Box
): WebDiagramV1['players'] {
  const att = players.filter((p) => p.team === 'ATT');
  const def = players.filter((p) => p.team === 'DEF');
  if (att.length + def.length < 6) return players;
  const placed = new Map<string, WebDiagramV1['players'][number]>();
  const put = (p: WebDiagramV1['players'][number], u: number, v: number) => {
    const pt = pointInBox(box, u, v);
    placed.set(p.id, { ...p, x: pt.x, y: pt.y });
  };
  const line = (list: WebDiagramV1['players'], v: number, u0: number, u1: number) => {
    list.forEach((p, i) => {
      const t = list.length <= 1 ? 0.5 : i / (list.length - 1);
      put(p, u0 + (u1 - u0) * t, v);
    });
  };
  const attGk = att.filter(isGkShirt);
  const attOut = att.filter((p) => !isGkShirt(p));
  attGk.forEach((p) => put(p, 0.5, 0.92));
  const backN = Math.min(4, Math.max(2, Math.ceil(attOut.length * 0.55)));
  line(attOut.slice(0, backN), 0.78, 0.18, 0.82);
  line(attOut.slice(backN), 0.64, 0.28, 0.72);
  const defGk = def.filter(isGkShirt);
  const defOut = def.filter((p) => !isGkShirt(p));
  defGk.forEach((p) => put(p, 0.5, 0.08));
  const seven = defOut.find((p) => p.number === 7);
  const eleven = defOut.find((p) => p.number === 11);
  const nine = defOut.find((p) => p.number === 9);
  const used = new Set<string>();
  if (seven) {
    put(seven, 0.18, 0.42);
    used.add(seven.id);
  }
  if (eleven) {
    put(eleven, 0.82, 0.42);
    used.add(eleven.id);
  }
  if (nine) {
    put(nine, 0.5, 0.5);
    used.add(nine.id);
  }
  line(
    defOut.filter((p) => !used.has(p.id)),
    0.28,
    0.25,
    0.75
  );
  return players.map((p) => placed.get(p.id) || p);
}

/** 5v5 increasing-pressure grid: possession diamond inside, waiters on four corners. */
function layoutPressureGridPlayers(
  players: WebDiagramV1['players'],
  box: Box
): WebDiagramV1['players'] {
  const att = players.filter((p) => p.team === 'ATT' && !isGkShirt(p));
  const def = players.filter((p) => p.team === 'DEF' && !isGkShirt(p));
  if (att.length < 4 || def.length < 4) return players;
  const placed = new Map<string, WebDiagramV1['players'][number]>();
  const put = (p: WebDiagramV1['players'][number], u: number, v: number) => {
    const pt = pointInBox(box, u, v);
    placed.set(p.id, { ...p, x: pt.x, y: pt.y });
  };
  const attCenter = att.find((p) => p.number === 7) || att[0];
  const attRest = att.filter((p) => p.id !== attCenter.id);
  put(attCenter, 0.5, 0.5);
  const diamond = [
    { u: 0.5, v: 0.36 },
    { u: 0.66, v: 0.5 },
    { u: 0.5, v: 0.64 },
    { u: 0.34, v: 0.5 },
  ];
  attRest.forEach((p, i) => put(p, diamond[i % diamond.length].u, diamond[i % diamond.length].v));
  const hunter =
    def.find((p) => p.number === 7) ||
    def.find((p) => p.relativePosition === 'inside') ||
    def[0];
  const waiters = def.filter((p) => p.id !== hunter.id);
  put(hunter, 0.58, 0.38);
  const corners = [
    { u: 0.12, v: 0.12 },
    { u: 0.12, v: 0.88 },
    { u: 0.88, v: 0.12 },
    { u: 0.88, v: 0.88 },
  ];
  waiters.forEach((p, i) => put(p, corners[i % corners.length].u, corners[i % corners.length].v));
  return players.map((p) => placed.get(p.id) || p);
}

function miniGoalCountOf(dsl: BoardSymbolicDsl): number {
  return (dsl.equipment || [])
    .filter((e) => e.kind === 'mini-goal')
    .reduce((n, e) => n + Math.max(1, e.quantity || 1), 0);
}

function looksLikePressureGrid(players: WebDiagramV1['players'], dsl: BoardSymbolicDsl): boolean {
  const gks = players.filter(isGkShirt);
  const att = players.filter((p) => p.team === 'ATT' && !isGkShirt(p));
  const def = players.filter((p) => p.team === 'DEF' && !isGkShirt(p));
  if (gks.length) return false;
  if (att.length < 4 || att.length > 6 || def.length < 4 || def.length > 6) return false;
  const mixed = (dsl.entities || []).some(
    (e) =>
      e.team === 'DEF' &&
      (e.relative_position === 'perimeter' ||
        e.relative_position === 'grid_nw' ||
        e.relative_position === 'grid_ne' ||
        e.relative_position === 'grid_se' ||
        e.relative_position === 'grid_sw')
  );
  return miniGoalCountOf(dsl) >= 4 || mixed || (att.length === 5 && def.length === 5);
}

function innerGridBox(box: Box): Box {
  return {
    x: box.x + box.width * 0.25,
    y: box.y + box.height * 0.25,
    width: box.width * 0.5,
    height: box.height * 0.5,
  };
}

function layoutRondoPlayers(
  players: WebDiagramV1['players'],
  box: Box
): WebDiagramV1['players'] {
  if (players.length < 3) return players;
  const inside = players.filter((p) => p.team === 'DEF');
  const ring = players.filter((p) => p.team !== 'DEF');
  const outer = ring.length ? ring : players.slice(0, Math.ceil(players.length * 0.6));
  const inner = ring.length ? inside : players.slice(outer.length);
  return players.map((p) => {
    const oi = outer.findIndex((x) => x.id === p.id);
    if (oi >= 0) {
      const pt = pointOnEllipse(box, oi, outer.length);
      return { ...p, x: pt.x, y: pt.y };
    }
    const ii = inner.findIndex((x) => x.id === p.id);
    if (ii >= 0) {
      const slot = INSIDE_DIAMOND[ii % INSIDE_DIAMOND.length];
      const jitter = Math.floor(ii / INSIDE_DIAMOND.length);
      return {
        ...p,
        x: clamp(box.x + (slot.u + jitter * 0.06) * box.width),
        y: clamp(box.y + (slot.v + (jitter % 2) * 0.06) * box.height),
      };
    }
    return p;
  });
}

/** Pinks / floaters sit on the short ends of the box (top/bottom on screen = extreme x). */
function pinRondoNeutralsToShortEnds(
  players: WebDiagramV1['players'],
  box: Box
): WebDiagramV1['players'] {
  const neus = players.filter((p) => p.team === 'NEUTRAL');
  if (neus.length < 2) return players;
  const cy = box.y + box.height / 2;
  return players.map((p) => {
    if (p.team !== 'NEUTRAL') return p;
    const i = neus.findIndex((x) => x.id === p.id);
    if (i === 0) return { ...p, x: clamp(box.x + Math.min(8, box.width * 0.18)), y: cy };
    if (i === 1) return { ...p, x: clamp(box.x + box.width - Math.min(8, box.width * 0.18)), y: cy };
    return p;
  });
}

/** 4v4+2 (and 3v3+2) extras are floaters, not extra blues. */
function markRondoNeutrals(
  players: WebDiagramV1['players']
): WebDiagramV1['players'] {
  if (players.some((p) => p.team === 'NEUTRAL')) return players;
  const att = players.filter((p) => p.team === 'ATT');
  const def = players.filter((p) => p.team === 'DEF');
  if (def.length >= 3 && att.length === def.length + 2) {
    const extraIds = new Set(att.slice(-2).map((p) => p.id));
    return players.map((p) => (extraIds.has(p.id) ? { ...p, team: 'NEUTRAL' as const } : p));
  }
  return players;
}

function shouldPullCurrentToIntent(dsl: BoardSymbolicDsl): boolean {
  const intent = dsl.grid.intent;
  return intent !== 'full_pitch' && intent !== 'rondo' && intent !== 'ssg_grid';
}

function isGk(p: { number?: number; role?: string }) {
  return p.number === 1 || String(p.role || '').toUpperCase() === 'GK';
}

function demoteRondoKeepers(players: WebDiagramV1['players']): WebDiagramV1['players'] {
  const used = new Set(
    players.map((p) => p.number).filter((n): n is number => typeof n === 'number' && n !== 1)
  );
  let n = 2;
  const take = () => {
    while (used.has(n)) n += 1;
    used.add(n);
    return n;
  };
  return players.map((p) => {
    if (p.number !== 1 && String(p.role || '').toUpperCase() !== 'GK') return p;
    return {
      ...p,
      number: take(),
      role: p.team === 'NEUTRAL' ? 'N' : 'CM',
      labelStyle: 'number-only' as const,
    };
  });
}

export function separateOverlappingPlayers<
  T extends { x: number; y: number; number?: number; role?: string; team?: string },
>(players: T[], minGap = SOLVER_MIN_PLAYER_GAP): T[] {
  const next = players.map((p) => ({ ...p }));
  const n = next.length;
  const target = minGap + 0.05;
  for (let pass = 0; pass < 24; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = next[i];
        const b = next[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= target) continue;
        if (d < 0.08) {
          const ang = (((i * 13 + j * 17) % 360) * Math.PI) / 180;
          const opposite =
            a.team &&
            b.team &&
            a.team !== b.team &&
            a.team !== 'NEUTRAL' &&
            b.team !== 'NEUTRAL';
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
        const need = target - d;
        let aPush = need / 2;
        let bPush = need / 2;
        if (isGk(a) && !isGk(b)) {
          aPush = 0;
          bPush = need;
        } else if (isGk(b) && !isGk(a)) {
          aPush = need;
          bPush = 0;
        }
        next[i] = { ...a, x: clamp(a.x - ux * aPush), y: clamp(a.y - uy * aPush) };
        next[j] = { ...b, x: clamp(b.x + ux * bPush), y: clamp(b.y + uy * bPush) };
        moved = true;
      }
    }
    if (!moved) break;
  }
  return next;
}

export function overlappingPairs(
  players: Array<{ id?: string; team?: string; number?: number; x: number; y: number }>,
  minGap = SOLVER_MIN_PLAYER_GAP
) {
  const pairs: Array<{ a: string; b: string; dist: number }> = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const dist = Math.hypot(players[j].x - players[i].x, players[j].y - players[i].y);
      if (dist < minGap) {
        const label = (p: (typeof players)[number]) => {
          const n = p.number ?? p.id ?? '?';
          return `${p.team || '?'}${n}`;
        };
        pairs.push({ a: label(players[i]), b: label(players[j]), dist });
      }
    }
  }
  return pairs;
}

function resolvePlayerId(
  players: WebDiagramV1['players'],
  ref: string
): string | undefined {
  const hit = players.find((p) => p.id === ref);
  if (hit) return hit.id;
  const m = /^(att|def)-(\d+)$/i.exec(ref.trim());
  if (!m) return ref;
  const team = m[1].toUpperCase() === 'ATT' ? 'ATT' : 'DEF';
  const number = Number(m[2]);
  return players.find((p) => p.team === team && p.number === number)?.id;
}

function placeFromToken(
  box: Box,
  token: Placement,
  index: number,
  total: number,
  team: 'ATT' | 'DEF' | 'NEUTRAL'
): { x: number; y: number } {
  if (token === 'own_line') {
    const u = total <= 1 ? 0.5 : 0.22 + (index / Math.max(1, total - 1)) * 0.56;
    const v = team === 'DEF' ? 0.22 : 0.78;
    return pointInBox(box, u, v);
  }
  if (token === 'perimeter') {
    return pointOnEllipse(box, index, total);
  }
  if (token === 'own_gk') {
    return team === 'DEF' ? { x: 50, y: 6 } : { x: 50, y: 94 };
  }
  if (token === 'opp_gk') {
    return team === 'ATT' ? { x: 50, y: 6 } : { x: 50, y: 94 };
  }
  const uv = GRID_UV[token];
  if (uv) {
    const pt = pointInBox(box, uv.u, uv.v);
    if (token === 'inside') {
      pt.x = clamp(pt.x + (index - (total - 1) / 2) * Math.max(5, SOLVER_MIN_PLAYER_GAP));
    }
    return pt;
  }
  return pointInBox(box, 0.5, 0.5);
}

function placeEquipment(
  equipment: BoardSymbolicDsl['equipment'],
  box: Box
): BoardElement[] {
  const out: BoardElement[] = [];
  let n = 0;
  let centralMini = 0;
  const centralUv = [
    { u: 0.44, v: 0.44 },
    { u: 0.56, v: 0.44 },
    { u: 0.44, v: 0.56 },
    { u: 0.56, v: 0.56 },
  ];
  for (const item of equipment) {
    for (let q = 0; q < item.quantity; q++) {
      n += 1;
      const central = item.kind === 'mini-goal' && item.placement === 'grid_c';
      const uv = central ? centralUv[centralMini++ % centralUv.length] : null;
      const pt = uv ? pointInBox(box, uv.u, uv.v) : placeFromToken(box, item.placement, q, item.quantity, 'NEUTRAL');
      out.push({
        id: `el-${item.kind}-${n}`,
        kind: item.kind,
        x: pt.x,
        y: pt.y,
        rotation:
          item.kind === 'mini-goal'
            ? item.placement === 'grid_n' || item.placement === 'grid_ne' || item.placement === 'grid_nw'
              ? 90
              : item.placement === 'grid_s' || item.placement === 'grid_se' || item.placement === 'grid_sw'
                ? 270
                : item.placement.includes('e') || item.placement === 'grid_e'
                  ? 0
                  : 180
            : undefined,
      });
    }
  }
  return out;
}

function findByRef(players: WebDiagramV1['players'], ref: string) {
  const id = resolvePlayerId(players, ref);
  return players.find((p) => p.id === id);
}

function applyMove(
  player: WebDiagramV1['players'][number],
  to: string,
  players: WebDiagramV1['players'],
  box: Box,
  ball: { x: number; y: number } | undefined,
  index: number,
  total: number
): { x: number; y: number } {
  if (to === 'keep') return { x: player.x, y: player.y };
  if (to === 'toward_ball' && ball) {
    return {
      x: clamp(player.x * 0.35 + ball.x * 0.65),
      y: clamp(player.y * 0.35 + ball.y * 0.65),
    };
  }
  const press = /^press:(.+)$/i.exec(to);
  if (press) {
    const target = findByRef(players, press[1]);
    if (target) {
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const d = Math.hypot(dx, dy) || 1;
      const stop = Math.max(SOLVER_MIN_PLAYER_GAP, d * 0.35);
      const t = Math.max(0, (d - stop) / d);
      return { x: clamp(player.x + dx * t), y: clamp(player.y + dy * t) };
    }
  }
  if ((BOARD_PLACEMENTS as readonly string[]).includes(to)) {
    return placeFromToken(box, to as Placement, index, total, player.team);
  }
  return { x: player.x, y: player.y };
}

function resolveSeed(
  dsl: BoardSymbolicDsl,
  current?: WebDiagramV1
): NonNullable<BoardSymbolicDsl['seed']> {
  if (dsl.seed === 'current') {
    if (
      (dsl.activity === 'rondo' || dsl.activity === 'technical_exercise') &&
      (dsl.entities?.length || 0) > 0 &&
      (current?.players?.length || 0) >= 14
    ) {
      return 'blank';
    }
    return current?.players?.length ? 'current' : 'blank';
  }
  if (dsl.seed === 'blank') return 'blank';
  if (dsl.seed === 'formation') return 'formation';
  if (dsl.activity === 'rondo' || dsl.activity === 'technical_exercise') return 'blank';
  if ((dsl.entities?.length || 0) > 0 && dsl.entities.length <= 12) return 'blank';
  if (dsl.grid.attFormation || dsl.grid.defFormation) return 'formation';
  if (current?.players?.length) return 'current';
  return 'blank';
}

function pullOutfieldTowardBox(
  players: WebDiagramV1['players'],
  box: Box,
  intent: BoardSymbolicDsl['grid']['intent']
): WebDiagramV1['players'] {
  if (intent === 'full_pitch' || !players.length) return players;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return players.map((p) => {
    if (isGk(p)) return p;
    return {
      ...p,
      x: clamp(p.x * 0.4 + cx * 0.6),
      y: clamp(p.y * 0.35 + cy * 0.65),
    };
  });
}

function allowFormationSeed(dsl: BoardSymbolicDsl) {
  return dsl.activity === 'match_scenario' || dsl.activity === 'scrimmage';
}

function formatFromRoster(current?: WebDiagramV1): '7V7' | '9V9' | '11V11' | undefined {
  const n = current?.players?.length || 0;
  if (n === 14) return '7V7';
  if (n === 18) return '9V9';
  if (n === 22) return '11V11';
  return current?.pitch?.format;
}

function resolvePitchFormat(dsl: BoardSymbolicDsl, current?: WebDiagramV1): '7V7' | '9V9' | '11V11' {
  return (
    dsl.grid.format ||
    current?.pitch?.format ||
    formatFromRoster(current) ||
    formatFromFormation(dsl.grid.attFormation) ||
    formatFromFormation(dsl.grid.defFormation) ||
    '11V11'
  );
}

function shirtCap(dsl: BoardSymbolicDsl): number | undefined {
  if (dsl.activity === 'rondo') return 12;
  if (dsl.activity === 'technical_exercise') return 16;
  if (dsl.grid.intent === 'ssg_grid') return 18;
  const format = resolvePitchFormat(dsl);
  if (format === '7V7') return 16;
  if (format === '9V9') return 20;
  return undefined;
}

export function unstackDiagram(diagram: WebDiagramV1): WebDiagramV1 {
  const players = separateOverlappingPlayers(diagram.players || []);
  const frames = diagram.sequence?.frames?.map((f) => ({
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

export function boardInvariantErrors(
  diagram: WebDiagramV1,
  dsl?: BoardSymbolicDsl
): string[] {
  const errs: string[] = [];
  const pairs = overlappingPairs(diagram.players || []);
  if (pairs.length) errs.push(`overlap:${pairs.slice(0, 3).map((p) => `${p.a}/${p.b}`).join(',')}`);
  const att = (diagram.players || []).find(
    (p) => p.team === 'ATT' && (p.number === 1 || String(p.role || '').toUpperCase() === 'GK')
  );
  const def = (diagram.players || []).find(
    (p) => p.team === 'DEF' && (p.number === 1 || String(p.role || '').toUpperCase() === 'GK')
  );
  if (att && def && att.y <= def.y) errs.push('gk-orientation');
  if (dsl) {
    const cap = shirtCap(dsl);
    if (cap && (diagram.players || []).length > cap) {
      errs.push(`upsample:${diagram.players.length}>${cap}`);
    }
  }
  return errs;
}

export function enforceBoardInvariants(diagram: WebDiagramV1, dsl?: BoardSymbolicDsl): WebDiagramV1 {
  let next = unstackDiagram(diagram);
  for (let i = 0; i < 3; i++) {
    if (!overlappingPairs(next.players || []).length) break;
    next = unstackDiagram(next);
  }
  return next;
}

/**
 * Symbolic DSL → WebDiagramV1. Geometry is deterministic. No model x/y.
 */
export function solveBoardLayout(
  dsl: BoardSymbolicDsl,
  current?: WebDiagramV1
): WebDiagramV1 {
  const box = gridBox(dsl.grid.intent);
  const seed = resolveSeed(dsl, current);
  const ball = current?.balls?.[0] || {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
  let players: WebDiagramV1['players'] = [];

  if (seed === 'current' && current?.players?.length) {
    players = current.players.map((p) => ({ ...p }));
    const moves = dsl.moves || [];
    players = players.map((p, i) => {
      const mv = moves.find((m) => m.id === p.id || resolvePlayerId(players, m.id) === p.id);
      if (!mv) return p;
      const pt = applyMove(p, mv.to, players, box, ball, i, players.length);
      return { ...p, x: pt.x, y: pt.y };
    });
  } else if (seed === 'formation' && allowFormationSeed(dsl)) {
    const format = resolvePitchFormat(dsl, current);
    const fallback =
      format === '7V7'
        ? { att: '2-3-1', def: '3-2-1' }
        : format === '9V9'
          ? { att: '3-2-3', def: '2-3-2-1' }
          : { att: '4-3-3', def: '4-2-3-1' };
    const att = fitFormationToFormat(dsl.grid.attFormation, format, 'att') || fallback.att;
    const def = fitFormationToFormat(dsl.grid.defFormation, format, 'def') || fallback.def;
    players = [
      ...build11v11FormationPlayers(att, 'ATT'),
      ...build11v11FormationPlayers(def, 'DEF'),
    ];
  }

  if (!players.length) {
    const list = dsl.entities || [];
    players = list.map((e, i) => {
      const line = list.filter((x) => x.relative_position === e.relative_position);
      const idx = line.findIndex((x) => x.id === e.id);
      const pt = placeFromToken(box, e.relative_position, idx < 0 ? i : idx, line.length, e.team);
      return {
        id: e.id,
        number: e.number,
        team: e.team,
        role: e.role,
        x: pt.x,
        y: pt.y,
        relativePosition: e.relative_position,
        labelStyle: 'number-only' as const,
      };
    });
  } else if (seed === 'formation' || (seed === 'current' && shouldPullCurrentToIntent(dsl))) {
    players = pullOutfieldTowardBox(players, box, dsl.grid.intent);
  }

  if (dsl.activity === 'rondo' || dsl.grid.intent === 'rondo') {
    players = demoteRondoKeepers(
      pinRondoNeutralsToShortEnds(markRondoNeutrals(layoutRondoPlayers(players, box)), box)
    );
  } else if (
    (dsl.grid.intent === 'ssg_grid' || dsl.activity === 'technical_exercise') &&
    players.length <= 16 &&
    dsl.seed !== 'current'
  ) {
    players = looksLikePressureGrid(players, dsl)
      ? layoutPressureGridPlayers(players, box)
      : layoutSsgPlayers(players, box);
  }

  players = separateOverlappingPlayers(players);

  const arrows: WebDiagramV1['arrows'] = (dsl.actions || []).map((a) => ({
    from: { playerId: resolvePlayerId(players, a.from_id) },
    to: { playerId: resolvePlayerId(players, a.to_id) },
    type: a.type,
    style: a.type === 'run' || a.type === 'press' ? 'dashed' : 'solid',
    weight: 'normal' as const,
  }));

  // Freeze / seed=current must keep live kit. Re-placing from history
  // ("four mini-goals" + "central 10×10") clustered 32-P6 side Us.
  const elements =
    seed === 'current'
      ? current?.elements || []
      : (dsl.equipment || []).length > 0
        ? placeEquipment(dsl.equipment || [], box)
        : [];
  const format = resolvePitchFormat(dsl, current);
  const keepLiveArea =
    seed === 'current' &&
    (current?.areas || []).length > 0 &&
    !shouldPullCurrentToIntent(dsl);

  const pressureGrid = looksLikePressureGrid(players, dsl);
  const inner = innerGridBox(box);
  const solved: WebDiagramV1 = {
    pitch: {
      variant: 'FULL',
      orientation: 'HORIZONTAL',
      format,
      showZones: false,
    },
    players,
    arrows,
    areas: keepLiveArea
      ? current!.areas
      : dsl.grid.intent === 'full_pitch' || dsl.activity === 'match_scenario'
        ? []
        : [
            {
              label: dsl.grid.intent,
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              shape: 'rect',
            },
            ...(pressureGrid
              ? [
                  {
                    label: 'inner',
                    x: inner.x,
                    y: inner.y,
                    width: inner.width,
                    height: inner.height,
                    shape: 'rect' as const,
                  },
                ]
              : []),
          ],
    labels: [],
    balls: [{ x: ball.x, y: ball.y }],
    goals: current?.goals?.length
      ? current.goals
      : [
          { id: 'goal-left', x: 50, y: 2, type: 'BIG', width: 16 },
          { id: 'goal-right', x: 50, y: 98, type: 'BIG', width: 16 },
        ],
    elements,
  };
  return enforceBoardInvariants(solved, dsl);
}
