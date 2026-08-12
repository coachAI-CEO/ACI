/**
 * Web DiagramV1 (canonical store for TacticalBoard) + mapping from API normalizer output.
 */

export type WebDiagramTeam = 'ATT' | 'DEF' | 'NEUTRAL';

export type WebDiagramV1 = {
  pitch: {
    variant: 'FULL' | 'HALF' | 'THIRD';
    orientation: 'HORIZONTAL' | 'VERTICAL';
    format?: '7V7' | '9V9' | '11V11';
    showZones?: boolean;
    zones?: {
      leftWide?: boolean;
      leftHalfSpace?: boolean;
      centralChannel?: boolean;
      rightHalfSpace?: boolean;
      rightWide?: boolean;
    };
  };
  players: Array<{
    id: string;
    number?: number;
    team: WebDiagramTeam;
    role?: string;
    x: number;
    y: number;
    relativePosition?: string;
    facingAngle?: number;
    labelStyle?: 'number-only' | 'number-and-role';
  }>;
  goals?: Array<{
    id: string;
    x: number;
    y: number;
    width?: number;
    type?: string;
  }>;
  coach?: {
    x: number;
    y: number;
    label?: string;
    note?: string;
  };
  balls?: Array<{ x: number; y: number }>;
  cones?: Array<{ x: number; y: number; color?: string }>;
  arrows: Array<{
    from: { playerId?: string; x?: number; y?: number };
    to: { playerId?: string; x?: number; y?: number };
    type: 'pass' | 'run' | 'press' | 'cover' | 'transition';
    style: 'solid' | 'dashed' | 'dotted';
    weight: 'normal' | 'bold';
  }>;
  areas: Array<{
    label?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    shape?: 'rect' | 'circle';
  }>;
  labels: Array<{ text: string; x: number; y: number }>;
};

/** Truly empty canvas (tests / reset). Prefer DEFAULT_MATCH_BOARD_DIAGRAM for new boards. */
export const BLANK_BOARD_DIAGRAM: WebDiagramV1 = {
  pitch: { variant: 'HALF', orientation: 'HORIZONTAL', showZones: false },
  players: [],
  arrows: [],
  areas: [],
  labels: [],
};

type FormationSlot = { number: number; role: string; x: number; depth: number };

/** Relative depth 0 = own goal line, 1 = halfway. Mirrors tactic-board.net 11v11 presets. */
const FORMATION_4_4_2: FormationSlot[] = [
  { number: 1, role: 'GK', x: 50, depth: 0.06 },
  { number: 2, role: 'RB', x: 82, depth: 0.22 },
  { number: 5, role: 'CB', x: 62, depth: 0.2 },
  { number: 6, role: 'CB', x: 38, depth: 0.2 },
  { number: 3, role: 'LB', x: 18, depth: 0.22 },
  { number: 7, role: 'RM', x: 82, depth: 0.42 },
  { number: 8, role: 'CM', x: 62, depth: 0.4 },
  { number: 4, role: 'CM', x: 38, depth: 0.4 },
  { number: 11, role: 'LM', x: 18, depth: 0.42 },
  { number: 9, role: 'ST', x: 60, depth: 0.62 },
  { number: 10, role: 'ST', x: 40, depth: 0.62 },
];

const FORMATION_4_3_3: FormationSlot[] = [
  { number: 1, role: 'GK', x: 50, depth: 0.06 },
  { number: 2, role: 'RB', x: 82, depth: 0.22 },
  { number: 5, role: 'CB', x: 62, depth: 0.2 },
  { number: 6, role: 'CB', x: 38, depth: 0.2 },
  { number: 3, role: 'LB', x: 18, depth: 0.22 },
  { number: 8, role: 'CM', x: 50, depth: 0.36 },
  { number: 4, role: 'CM', x: 32, depth: 0.4 },
  { number: 10, role: 'CM', x: 68, depth: 0.4 },
  { number: 7, role: 'RW', x: 80, depth: 0.6 },
  { number: 9, role: 'ST', x: 50, depth: 0.66 },
  { number: 11, role: 'LW', x: 20, depth: 0.6 },
];

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
    x: clampPitch(slot.x),
    y: yFromDepth(side, slot.depth),
    labelStyle: 'number-only' as const,
  }));
}

/**
 * Default new-board seed:
 * FULL horizontal pitch, home ATT 4-4-2 (right) vs away DEF 4-3-3 (left), ball centre, both goals.
 */
export const DEFAULT_MATCH_BOARD_DIAGRAM: WebDiagramV1 = {
  pitch: { variant: 'FULL', orientation: 'HORIZONTAL', format: '11V11', showZones: false },
  players: [
    ...formationPlayers(FORMATION_4_4_2, 'ATT', 'home'),
    ...formationPlayers(FORMATION_4_3_3, 'DEF', 'away'),
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
  if (t === 'ATT' || t === 'ATTACK') return 'ATT';
  if (t === 'DEF' || t === 'DEFEND' || t === 'DEFENSE') return 'DEF';
  return 'NEUTRAL';
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
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
        a.type === 'transition'
          ? a.type
          : 'run';
      const style =
        a.style === 'dotted' || a.style === 'dashed' || a.style === 'solid' ? a.style : 'solid';
      const weight = a.weight === 'bold' ? 'bold' : 'normal';
      const from =
        a.from && typeof a.from === 'object'
          ? {
              playerId: typeof a.from.playerId === 'string' ? a.from.playerId : undefined,
              x: isFiniteNumber(a.from.x) ? clamp01to100(a.from.x) : undefined,
              y: isFiniteNumber(a.from.y) ? clamp01to100(a.from.y) : undefined,
            }
          : {};
      const to =
        a.to && typeof a.to === 'object'
          ? {
              playerId: typeof a.to.playerId === 'string' ? a.to.playerId : undefined,
              x: isFiniteNumber(a.to.x) ? clamp01to100(a.to.x) : undefined,
              y: isFiniteNumber(a.to.y) ? clamp01to100(a.to.y) : undefined,
            }
          : {};
      return { from, to, type, style, weight };
    });

  const areasRaw = Array.isArray(src.areas)
    ? src.areas
    : Array.isArray(src.safeZones)
      ? src.safeZones
      : [];
  const areas: WebDiagramV1['areas'] = areasRaw
    .filter((a: any) => a && typeof a === 'object')
    .map((a: any) => ({
      label: typeof a.label === 'string' ? a.label : undefined,
      x: isFiniteNumber(a.x) ? clamp01to100(a.x) : undefined,
      y: isFiniteNumber(a.y) ? clamp01to100(a.y) : undefined,
      width: isFiniteNumber(a.width) ? a.width : undefined,
      height: isFiniteNumber(a.height) ? a.height : undefined,
      shape: a.shape === 'circle' || a.shape === 'rect' ? a.shape : undefined,
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

  return {
    pitch: {
      variant: mapPitchVariant(pitchSrc.variant || src.pitch),
      orientation,
      format: mapPitchFormat(pitchSrc.format),
      showZones: typeof pitchSrc.showZones === 'boolean' ? pitchSrc.showZones : undefined,
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
    arrows,
    areas,
    labels,
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
