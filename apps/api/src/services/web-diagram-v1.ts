/**
 * API-side tactical board services.
 *
 * The canonical `WebDiagramV1` type lives in `@aci/shared`. This file keeps
 * the API-specific normalize pipeline (`toWebDiagramV1`, formation presets,
 * session/board axis remap) — those are not pure data shapes and don't belong
 * in the shared package — but the types are re-exported from `@aci/shared`
 * so the rest of the API (`tactical-boards.ts`, Zod schema, tests) can keep
 * importing them from this file unchanged.
 */

import { mergePracticeElements, type BoardElement } from './board-elements';
import type {
  WebDiagramV1,
  WebDiagramTeam,
} from '@aci/shared';

// Re-export the canonical types under the names the rest of the API uses.
export type { WebDiagramV1, WebDiagramTeam } from '@aci/shared';
export type { BoardElement } from '@aci/shared';
export type WebDiagramElement = BoardElement;

/** Truly empty canvas (tests / reset). Prefer DEFAULT_MATCH_BOARD_DIAGRAM for seeded shapes. */
export const BLANK_BOARD_DIAGRAM: WebDiagramV1 = {
  pitch: { variant: 'HALF', orientation: 'HORIZONTAL', showZones: false },
  players: [],
  arrows: [],
  areas: [],
  labels: [],
};

/** Clear full pitch for “New” boards — goals only, no players/arrows. */
export const CLEAR_MATCH_BOARD_DIAGRAM: WebDiagramV1 = {
  pitch: { variant: 'FULL', orientation: 'HORIZONTAL', format: '11V11', showZones: false },
  players: [],
  balls: [],
  goals: [
    { id: 'goal-left', x: 50, y: 2, type: 'BIG', width: 16 },
    { id: 'goal-right', x: 50, y: 98, type: 'BIG', width: 16 },
  ],
  arrows: [],
  areas: [],
  labels: [],
};

type FormationSlot = { number: number; role: string; x: number; depth: number };

/** Relative depth 0 = own goal line, 1 = halfway. Mirrors tactic-board.net 11v11 presets. */
const FORMATION_4_4_2: FormationSlot[] = [
  { number: 1, role: 'GK', x: 50, depth: 0.06 },
  { number: 2, role: 'RB', x: 90, depth: 0.3 },
  { number: 4, role: 'CB', x: 66, depth: 0.14 },
  { number: 5, role: 'CB', x: 34, depth: 0.14 },
  { number: 3, role: 'LB', x: 10, depth: 0.3 },
  { number: 7, role: 'RM', x: 82, depth: 0.42 },
  { number: 8, role: 'CM', x: 62, depth: 0.4 },
  { number: 6, role: 'CM', x: 38, depth: 0.4 },
  { number: 11, role: 'LM', x: 18, depth: 0.42 },
  { number: 9, role: 'ST', x: 60, depth: 0.62 },
  { number: 10, role: 'ST', x: 40, depth: 0.62 },
];

const FORMATION_4_3_3: FormationSlot[] = [
  { number: 1, role: 'GK', x: 50, depth: 0.06 },
  { number: 2, role: 'RB', x: 90, depth: 0.3 },
  { number: 4, role: 'CB', x: 66, depth: 0.14 },
  { number: 5, role: 'CB', x: 34, depth: 0.14 },
  { number: 3, role: 'LB', x: 10, depth: 0.3 },
  { number: 6, role: 'CDM', x: 50, depth: 0.36 },
  { number: 8, role: 'CM', x: 32, depth: 0.4 },
  { number: 10, role: 'CM', x: 68, depth: 0.4 },
  { number: 7, role: 'RW', x: 80, depth: 0.6 },
  { number: 9, role: 'ST', x: 50, depth: 0.66 },
  { number: 11, role: 'LW', x: 20, depth: 0.6 },
];

const FORMATION_4_2_3_1: FormationSlot[] = [
  { number: 1, role: 'GK', x: 50, depth: 0.06 },
  { number: 2, role: 'RB', x: 90, depth: 0.3 },
  { number: 4, role: 'CB', x: 66, depth: 0.14 },
  { number: 5, role: 'CB', x: 34, depth: 0.14 },
  { number: 3, role: 'LB', x: 10, depth: 0.3 },
  { number: 6, role: 'CDM', x: 38, depth: 0.36 },
  { number: 8, role: 'CDM', x: 62, depth: 0.36 },
  { number: 7, role: 'RAM', x: 78, depth: 0.52 },
  { number: 10, role: 'CAM', x: 50, depth: 0.54 },
  { number: 11, role: 'LAM', x: 22, depth: 0.52 },
  { number: 9, role: 'ST', x: 50, depth: 0.68 },
];

const FORMATION_3_5_2: FormationSlot[] = [
  { number: 1, role: 'GK', x: 50, depth: 0.06 },
  { number: 4, role: 'CB', x: 68, depth: 0.22 },
  { number: 5, role: 'CB', x: 50, depth: 0.2 },
  { number: 3, role: 'CB', x: 32, depth: 0.22 },
  { number: 2, role: 'RWB', x: 88, depth: 0.4 },
  { number: 8, role: 'CM', x: 65, depth: 0.4 },
  { number: 6, role: 'CDM', x: 50, depth: 0.36 },
  { number: 7, role: 'CM', x: 35, depth: 0.4 },
  { number: 11, role: 'LWB', x: 12, depth: 0.4 },
  { number: 9, role: 'ST', x: 58, depth: 0.64 },
  { number: 10, role: 'ST', x: 42, depth: 0.64 },
];

const FORMATION_2_3_1: FormationSlot[] = [
  { number: 1, role: 'GK', x: 50, depth: 0.08 },
  { number: 2, role: 'RB', x: 72, depth: 0.28 },
  { number: 3, role: 'LB', x: 28, depth: 0.28 },
  { number: 6, role: 'CM', x: 50, depth: 0.42 },
  { number: 7, role: 'RM', x: 78, depth: 0.48 },
  { number: 11, role: 'LM', x: 22, depth: 0.48 },
  { number: 9, role: 'ST', x: 50, depth: 0.68 },
];

const FORMATION_3_2_1: FormationSlot[] = [
  { number: 1, role: 'GK', x: 50, depth: 0.08 },
  { number: 4, role: 'CB', x: 50, depth: 0.26 },
  { number: 2, role: 'RB', x: 78, depth: 0.3 },
  { number: 3, role: 'LB', x: 22, depth: 0.3 },
  { number: 6, role: 'CM', x: 38, depth: 0.48 },
  { number: 8, role: 'CM', x: 62, depth: 0.48 },
  { number: 9, role: 'ST', x: 50, depth: 0.68 },
];

const FORMATION_3_2_3: FormationSlot[] = [
  { number: 1, role: 'GK', x: 50, depth: 0.07 },
  { number: 4, role: 'CB', x: 50, depth: 0.24 },
  { number: 2, role: 'RB', x: 78, depth: 0.28 },
  { number: 3, role: 'LB', x: 22, depth: 0.28 },
  { number: 6, role: 'CM', x: 38, depth: 0.44 },
  { number: 8, role: 'CM', x: 62, depth: 0.44 },
  { number: 7, role: 'RW', x: 82, depth: 0.62 },
  { number: 9, role: 'ST', x: 50, depth: 0.68 },
  { number: 11, role: 'LW', x: 18, depth: 0.62 },
];

const FORMATION_2_3_2_1: FormationSlot[] = [
  { number: 1, role: 'GK', x: 50, depth: 0.07 },
  { number: 4, role: 'CB', x: 62, depth: 0.26 },
  { number: 5, role: 'CB', x: 38, depth: 0.26 },
  { number: 6, role: 'CDM', x: 50, depth: 0.4 },
  { number: 8, role: 'CM', x: 68, depth: 0.46 },
  { number: 10, role: 'CM', x: 32, depth: 0.46 },
  { number: 7, role: 'RAM', x: 65, depth: 0.6 },
  { number: 11, role: 'LAM', x: 35, depth: 0.6 },
  { number: 9, role: 'ST', x: 50, depth: 0.7 },
];

const FORMATION_3_3_2: FormationSlot[] = [
  { number: 1, role: 'GK', x: 50, depth: 0.07 },
  { number: 4, role: 'CB', x: 50, depth: 0.24 },
  { number: 2, role: 'RB', x: 78, depth: 0.28 },
  { number: 3, role: 'LB', x: 22, depth: 0.28 },
  { number: 6, role: 'CDM', x: 50, depth: 0.4 },
  { number: 8, role: 'CM', x: 68, depth: 0.48 },
  { number: 10, role: 'CM', x: 32, depth: 0.48 },
  { number: 9, role: 'ST', x: 60, depth: 0.66 },
  { number: 11, role: 'ST', x: 40, depth: 0.66 },
];

const FORMATIONS_11: Record<string, FormationSlot[]> = {
  '4-4-2': FORMATION_4_4_2,
  '4-3-3': FORMATION_4_3_3,
  '4-2-3-1': FORMATION_4_2_3_1,
  '3-5-2': FORMATION_3_5_2,
  '2-3-1': FORMATION_2_3_1,
  '3-2-1': FORMATION_3_2_1,
  '3-2-3': FORMATION_3_2_3,
  '2-3-2-1': FORMATION_2_3_2_1,
  '3-3-2': FORMATION_3_3_2,
};

function clampPitch(n: number) {
  return Math.max(2, Math.min(98, n));
}

/** depth 0 = own goal, 1 = high into opposition half (natural match shape). */
function yFromDepth(side: 'home' | 'away', depth: number) {
  const fromOwnGoal = 5 + depth * 85;
  return side === 'home' ? clampPitch(100 - fromOwnGoal) : clampPitch(fromOwnGoal);
}

function formationPlayers(
  slots: FormationSlot[],
  team: WebDiagramTeam,
  side: 'home' | 'away'
): WebDiagramV1['players'] {
  return slots.map((slot, i) => ({
    id: `${side}-${slot.number}-${i}`,
    number: slot.number,
    team,
    role: slot.role,
    // Mirror lateral for away (L→R) so right-sided roles stay on the team's right.
    x: clampPitch(side === 'away' ? 100 - slot.x : slot.x),
    y: yFromDepth(side, slot.depth),
    labelStyle: 'number-only' as const,
  }));
}

/** Build 11v11 roster for a named formation (ATT=home, DEF=away). */
export function build11v11FormationPlayers(
  formation: string,
  team: 'ATT' | 'DEF'
): WebDiagramV1['players'] {
  const slots = FORMATIONS_11[formation];
  if (!slots) return [];
  return formationPlayers(slots, team, team === 'ATT' ? 'home' : 'away');
}

const DEFAULT_FORMATIONS_FOR_FORMAT: Record<
  '7V7' | '9V9' | '11V11',
  { att: string; def: string }
> = {
  '7V7': { att: '2-3-1', def: '3-2-1' },
  '9V9': { att: '3-2-3', def: '2-3-2-1' },
  '11V11': { att: '4-3-3', def: '4-2-3-1' },
};

/** Blank-board seed for a format band. Us = ATT, own goal RIGHT. */
export function defaultMatchBoardDiagram(
  format: '7V7' | '9V9' | '11V11' = '11V11'
): WebDiagramV1 {
  const { att, def } = DEFAULT_FORMATIONS_FOR_FORMAT[format] || DEFAULT_FORMATIONS_FOR_FORMAT['11V11'];
  return {
    pitch: { variant: 'FULL', orientation: 'HORIZONTAL', format, showZones: false },
    players: [
      ...build11v11FormationPlayers(att, 'ATT'),
      ...build11v11FormationPlayers(def, 'DEF'),
    ],
    balls: [{ x: 50, y: 50 }],
    goals: [
      { id: 'goal-left', x: 50, y: 2, type: 'BIG', width: 16 },
      { id: 'goal-right', x: 50, y: 98, type: 'BIG', width: 16 },
    ],
    arrows: [],
    areas: [],
    labels: [],
  };
}

/**
 * Default new-board seed:
 * FULL horizontal pitch, home ATT 4-3-3 (right) vs away DEF 4-2-3-1 (left), ball centre, both goals.
 */
export const DEFAULT_MATCH_BOARD_DIAGRAM: WebDiagramV1 = defaultMatchBoardDiagram('11V11');

function clamp01to100(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

function mapPitchFormat(raw: unknown): WebDiagramV1['pitch']['format'] | undefined {
  const v = String(raw || '').toUpperCase().replace(/\s+/g, '');
  if (v === '7V7') return '7V7';
  if (v === '9V9') return '9V9';
  if (v === '11V11') return '11V11';
  return undefined;
}

function mapPitchVariant(raw: unknown): WebDiagramV1['pitch']['variant'] {
  const v = String(raw || '').toUpperCase();
  if (v === 'FULL') return 'FULL';
  if (v === 'THIRD') return 'THIRD';
  // QUARTER / CUSTOM / unknown → HALF (nearest renderable when not FULL/THIRD/HALF)
  if (v === 'HALF') return 'HALF';
  if (v === 'QUARTER' || v === 'CUSTOM') return 'HALF';
  return 'HALF';
}

function mapTeam(raw: unknown): WebDiagramTeam {
  const t = String(raw || '').toUpperCase();
  // Board vocab: ATT / DEF / NEUTRAL. Scene vocab: home / away / gk / neutral.
  if (t === 'ATT' || t === 'ATTACK' || t === 'HOME' || t === 'BLUE') return 'ATT';
  if (t === 'DEF' || t === 'DEFEND' || t === 'DEFENSE' || t === 'AWAY' || t === 'RED' || t === 'GK') return 'DEF';
  return 'NEUTRAL';
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function mapPointRef(raw: any): { playerId?: string; x?: number; y?: number } {
  if (typeof raw === 'string' && raw.trim()) {
    return { playerId: raw.trim() };
  }
  if (!raw || typeof raw !== 'object') return {};
  const playerId =
    typeof raw.playerId === 'string'
      ? raw.playerId
      : typeof raw.id === 'string'
        ? raw.id
        : typeof raw.player === 'string'
          ? raw.player
          : undefined;
  return {
    ...(playerId ? { playerId } : {}),
    ...(isFiniteNumber(raw.x) ? { x: clamp01to100(raw.x) } : {}),
    ...(isFiniteNumber(raw.y) ? { y: clamp01to100(raw.y) } : {}),
  };
}

/**
 * Map API DiagramV1 (or already-web-ish JSON) into the web store shape.
 * Keeps THIRD; coerces QUARTER/CUSTOM → HALF.
 */
export function toWebDiagramV1(input: unknown): WebDiagramV1 | null {
  if (!input || typeof input !== 'object') return null;
  const src = input as any;

  const pitchSrc = src.pitch && typeof src.pitch === 'object' ? src.pitch : {};
  const orientation =
    String(pitchSrc.orientation || '').toUpperCase() === 'VERTICAL' ? 'VERTICAL' : 'HORIZONTAL';

  const playersRaw = Array.isArray(src.players)
    ? src.players
    : Array.isArray(src.startingPositions)
      ? src.startingPositions
      : [];

  const players: WebDiagramV1['players'] = [];
  for (const p of playersRaw) {
    if (!p || typeof p !== 'object') continue;
    if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y)) continue;
    const id = String(p.id || '').trim() || `p-${players.length + 1}`;
    players.push({
      id,
      number: typeof p.number === 'number' ? p.number : undefined,
      team: mapTeam(p.team),
      role: typeof p.role === 'string' ? p.role : typeof p.label === 'string' ? p.label : undefined,
      x: clamp01to100(p.x),
      y: clamp01to100(p.y),
      relativePosition: typeof p.relativePosition === 'string' ? p.relativePosition : undefined,
      facingAngle: typeof p.facingAngle === 'number' ? p.facingAngle : undefined,
      labelStyle:
        p.labelStyle === 'number-only' || p.labelStyle === 'number-and-role'
          ? p.labelStyle
          : undefined,
    });
  }

  const arrowsRaw = Array.isArray(src.arrows) ? src.arrows : [];
  const arrows: WebDiagramV1['arrows'] = arrowsRaw
    .filter((a: any) => a && typeof a === 'object')
    .map((a: any) => {
      const type =
        a.type === 'pass' ||
        a.type === 'run' ||
        a.type === 'press' ||
        a.type === 'cover' ||
        a.type === 'transition' ||
        a.type === 'movement'
          ? a.type === 'movement'
            ? 'run'
            : a.type
          : 'pass';
      const style =
        a.style === 'dotted' || a.style === 'dashed' || a.style === 'solid' ? a.style : 'solid';
      const weight = a.weight === 'bold' ? 'bold' : 'normal';
      const from = mapPointRef(a.from ?? a.fromPlayer ?? { playerId: a.fromPlayerId, x: a.x1, y: a.y1 });
      const to = mapPointRef(a.to ?? a.toPlayer ?? { playerId: a.toPlayerId, x: a.x2, y: a.y2 });
      const hasFrom = Boolean(from.playerId) || (typeof from.x === 'number' && typeof from.y === 'number');
      const hasTo = Boolean(to.playerId) || (typeof to.x === 'number' && typeof to.y === 'number');
      if (!hasFrom || !hasTo) return null;
      const arrowhead = typeof a.arrowhead === 'boolean' ? a.arrowhead : true;
      const control =
        a.control &&
        typeof a.control === 'object' &&
        isFiniteNumber(a.control.x) &&
        isFiniteNumber(a.control.y)
          ? { x: clamp01to100(a.control.x), y: clamp01to100(a.control.y) }
          : undefined;
      const pathRaw = Array.isArray(a.path) ? a.path : [];
      const path = pathRaw
        .filter(
          (p: any) => p && typeof p === 'object' && isFiniteNumber(p.x) && isFiniteNumber(p.y)
        )
        .slice(0, 100)
        .map((p: any) => ({ x: clamp01to100(p.x), y: clamp01to100(p.y) }));
      return {
        from,
        to,
        type,
        style,
        weight,
        arrowhead,
        ...(control ? { control } : {}),
        ...(path.length >= 2 ? { path } : {}),
        ...(typeof a.order === 'number' && Number.isFinite(a.order)
          ? { order: Math.max(1, Math.min(12, Math.round(a.order))) }
          : {}),
      };
    })
    .filter(Boolean) as WebDiagramV1['arrows'];

  const areasRaw = Array.isArray(src.areas)
    ? src.areas
    : Array.isArray(src.safeZones)
      ? src.safeZones
      : Array.isArray(src.zones)
        ? src.zones
        : [];
  const areas: WebDiagramV1['areas'] = areasRaw
    .filter((a: any) => a && typeof a === 'object')
    .map((a: any) => ({
      label: typeof a.label === 'string' ? a.label : undefined,
      x: isFiniteNumber(a.x) ? clamp01to100(a.x) : undefined,
      y: isFiniteNumber(a.y) ? clamp01to100(a.y) : undefined,
      width: isFiniteNumber(a.width) ? a.width : undefined,
      height: isFiniteNumber(a.height) ? a.height : undefined,
      shape:
        a.shape === 'circle' || a.shape === 'rect' || a.shape === 'spotlight'
          ? a.shape
          : undefined,
    }));

  const labelsRaw = Array.isArray(src.labels) ? src.labels : [];
  const labels: WebDiagramV1['labels'] = labelsRaw
    .filter(
      (l: any) =>
        l &&
        typeof l === 'object' &&
        typeof l.text === 'string' &&
        isFiniteNumber(l.x) &&
        isFiniteNumber(l.y)
    )
    .map((l: any) => ({
      text: String(l.text),
      x: clamp01to100(l.x),
      y: clamp01to100(l.y),
    }));

  let coach: WebDiagramV1['coach'] | undefined;
  if (src.coach && typeof src.coach === 'object' && isFiniteNumber(src.coach.x) && isFiniteNumber(src.coach.y)) {
    coach = {
      x: clamp01to100(src.coach.x),
      y: clamp01to100(src.coach.y),
      label: typeof src.coach.label === 'string' ? src.coach.label : undefined,
      note: typeof src.coach.note === 'string' ? src.coach.note : undefined,
    };
  }

  const goals = Array.isArray(src.goals)
    ? src.goals
        .filter((g: any) => g && isFiniteNumber(g.x) && isFiniteNumber(g.y))
        .map((g: any, i: number) => ({
          id: String(g.id || `goal-${i + 1}`),
          x: clamp01to100(g.x),
          y: clamp01to100(g.y),
          width: isFiniteNumber(g.width) ? g.width : undefined,
          type: typeof g.type === 'string' ? g.type : undefined,
        }))
    : undefined;

  const balls = Array.isArray(src.balls)
    ? src.balls
        .filter((b: any) => b && isFiniteNumber(b.x) && isFiniteNumber(b.y))
        .map((b: any) => ({ x: clamp01to100(b.x), y: clamp01to100(b.y) }))
    : undefined;

  const cones = Array.isArray(src.cones)
    ? src.cones
        .filter((c: any) => c && isFiniteNumber(c.x) && isFiniteNumber(c.y))
        .map((c: any) => ({
          x: clamp01to100(c.x),
          y: clamp01to100(c.y),
          color: typeof c.color === 'string' ? c.color : undefined,
        }))
    : undefined;

  const root: WebDiagramV1 = {
    pitch: {
      variant: mapPitchVariant(pitchSrc.variant || src.pitch),
      orientation,
      format: mapPitchFormat(pitchSrc.format),
      showZones: typeof pitchSrc.showZones === 'boolean' ? pitchSrc.showZones : undefined,
      showThirds: typeof pitchSrc.showThirds === 'boolean' ? pitchSrc.showThirds : undefined,
      zones:
        pitchSrc.zones && typeof pitchSrc.zones === 'object'
          ? {
              leftWide: pitchSrc.zones.leftWide,
              leftHalfSpace: pitchSrc.zones.leftHalfSpace,
              centralChannel: pitchSrc.zones.centralChannel,
              rightHalfSpace: pitchSrc.zones.rightHalfSpace,
              rightWide: pitchSrc.zones.rightWide,
            }
          : undefined,
    },
    players,
    goals: goals && goals.length ? goals : undefined,
    coach,
    balls: balls && balls.length ? balls : undefined,
    cones: cones && cones.length ? cones : undefined,
    elements: (() => {
      const els = mergePracticeElements({ elements: src.elements, cones, goals });
      return els.length ? els : undefined;
    })(),
    arrows,
    areas,
    labels,
  };

  const sequence = normalizeSequence(src.sequence, root);
  if (sequence) {
    const active =
      sequence.frames.find((f) => f.id === sequence.activeFrameId) || sequence.frames[0];
    return {
      ...root,
      players: active.players,
      arrows: active.arrows,
      areas: active.areas,
      labels: active.labels,
      balls: active.balls,
      goals: active.goals,
      coach: active.coach,
      cones: active.cones,
      elements: active.elements,
      sequence,
    };
  }

  return root;
}

const BOARD_SEQUENCE_MAX_FRAMES = 8;

function layersFromDiagram(d: WebDiagramV1): Omit<
  NonNullable<WebDiagramV1['sequence']>['frames'][number],
  'id' | 'title' | 'note' | 'durationMs'
> {
  return {
    players: d.players,
    arrows: d.arrows,
    areas: d.areas,
    labels: d.labels,
    balls: d.balls,
    goals: d.goals,
    coach: d.coach,
    cones: d.cones,
    elements: d.elements,
  };
}

function normalizeFrameLayers(raw: any): ReturnType<typeof layersFromDiagram> | null {
  if (!raw || typeof raw !== 'object') return null;
  // Re-enter without sequence to reuse player/arrow normalization.
  const nested = toWebDiagramV1({
    pitch: { variant: 'FULL', orientation: 'HORIZONTAL' },
    players: raw.players,
    arrows: raw.arrows,
    areas: raw.areas,
    labels: raw.labels,
    balls: raw.balls,
    goals: raw.goals,
    coach: raw.coach,
    cones: raw.cones,
    elements: raw.elements,
  });
  if (!nested) return null;
  return layersFromDiagram(nested);
}

function normalizeSequence(
  raw: unknown,
  fallbackRoot: WebDiagramV1
): WebDiagramV1['sequence'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as any;
  const framesRaw = Array.isArray(src.frames) ? src.frames : [];
  if (!framesRaw.length) return undefined;

  const frames: NonNullable<WebDiagramV1['sequence']>['frames'] = [];
  for (const f of framesRaw.slice(0, BOARD_SEQUENCE_MAX_FRAMES)) {
    if (!f || typeof f !== 'object') continue;
    const layers = normalizeFrameLayers(f);
    if (!layers) continue;
    const id = String(f.id || '').trim() || `f-${frames.length + 1}`;
    frames.push({
      id,
      title: typeof f.title === 'string' ? f.title.slice(0, 80) : undefined,
      note: typeof f.note === 'string' ? f.note.slice(0, 300) : undefined,
      durationMs:
        typeof f.durationMs === 'number' && Number.isFinite(f.durationMs)
          ? Math.max(400, Math.min(12000, Math.round(f.durationMs)))
          : undefined,
      ...layers,
    });
  }

  if (!frames.length) {
    // Persist a single frame so clients round-trip cleanly when sequence was malformed.
    frames.push({
      id: 'f-1',
      title: 'Frame 1',
      durationMs: 1600,
      ...layersFromDiagram(fallbackRoot),
    });
  }

  const activeFrameId =
    frames.find((f) => f.id === String(src.activeFrameId || ''))?.id || frames[0].id;

  return { activeFrameId, frames };
}

function swapXY<T extends { x?: number; y?: number }>(p: T): T {
  if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y)) return p;
  return { ...p, x: p.y, y: p.x };
}

export function formatFromAgeGroup(ageGroup?: string | null): WebDiagramV1['pitch']['format'] | undefined {
  const age = Number(String(ageGroup || '').replace(/^U/i, ''));
  if (!Number.isFinite(age) || age <= 0) return undefined;
  if (age <= 10) return '7V7';
  if (age <= 12) return '9V9';
  return '11V11';
}

function remapLayersToBoardAxes(d: {
  players: WebDiagramV1['players'];
  arrows: WebDiagramV1['arrows'];
  areas: WebDiagramV1['areas'];
  labels: WebDiagramV1['labels'];
  balls?: WebDiagramV1['balls'];
  goals?: WebDiagramV1['goals'];
  coach?: WebDiagramV1['coach'];
  cones?: WebDiagramV1['cones'];
  elements?: WebDiagramV1['elements'];
}) {
  const swapPoint = (pt: { playerId?: string; x?: number; y?: number }) => {
    if (isFiniteNumber(pt.x) && isFiniteNumber(pt.y)) return { ...pt, x: pt.y, y: pt.x };
    return pt;
  };
  return {
    players: d.players.map((p) => swapXY(p)),
    arrows: d.arrows.map((a) => ({
      ...a,
      from: swapPoint(a.from),
      to: swapPoint(a.to),
      ...(a.control ? { control: swapXY(a.control) } : {}),
      ...(a.path ? { path: a.path.map((p) => swapXY(p)) } : {}),
    })),
    areas: d.areas.map((a) => {
      const swapped = swapXY(a);
      if (isFiniteNumber(a.width) && isFiniteNumber(a.height)) {
        return { ...swapped, width: a.height, height: a.width };
      }
      return swapped;
    }),
    labels: d.labels.map((l) => swapXY(l)),
    balls: d.balls?.map((b) => swapXY(b)),
    goals: d.goals?.map((g) => swapXY(g)),
    coach: d.coach ? swapXY(d.coach) : undefined,
    cones: d.cones?.map((c) => swapXY(c)),
    elements: d.elements?.map((el) => swapXY(el)),
  };
}

/**
 * Session JSON uses x = length (goals left/right). The board store uses
 * y = length. FORK must swap or players land in the width axis and HALF/THIRD
 * zoom crops them off the pitch.
 */
export function remapSessionDiagramToBoard(
  diagram: WebDiagramV1,
  ageGroup?: string | null
): WebDiagramV1 {
  const layers = remapLayersToBoardAxes(diagram);
  const sequence = diagram.sequence
    ? {
        ...diagram.sequence,
        frames: diagram.sequence.frames.map((frame) => ({
          ...frame,
          ...remapLayersToBoardAxes(frame),
        })),
      }
    : undefined;

  return {
    ...diagram,
    ...layers,
    pitch: {
      ...diagram.pitch,
      // Session 0–100 is the drill canvas, not a crop of a full 11v11 pitch.
      variant: 'FULL',
      orientation: 'HORIZONTAL',
      format: diagram.pitch.format || formatFromAgeGroup(ageGroup),
    },
    ...(sequence ? { sequence } : {}),
  };
}

/** True when diagram is missing players or has no arrows (candidates for vault enrich). */
export function isDiagramThinForFork(diagram: unknown): boolean {
  if (!diagram || typeof diagram !== 'object') return true;
  const d = diagram as any;
  const players = Array.isArray(d.players)
    ? d.players
    : Array.isArray(d.startingPositions)
      ? d.startingPositions
      : [];
  const hasPlayer = players.some((p: any) => p && isFiniteNumber(p.x) && isFiniteNumber(p.y));
  if (!hasPlayer) return true;
  const arrows = Array.isArray(d.arrows) ? d.arrows.length : 0;
  return arrows === 0;
}

export function extractRawDiagramFromDrill(drill: any): unknown {
  if (!drill || typeof drill !== 'object') return null;
  return (
    drill.diagramV1 ||
    drill.diagram ||
    drill.json?.diagramV1 ||
    drill.json?.diagram ||
    null
  );
}
