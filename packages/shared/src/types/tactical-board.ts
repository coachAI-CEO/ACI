/**
 * Canonical WebDiagramV1 type for the tactical board.
 *
 * Owned by @aci/shared so the mobile app, the web app, and the API can
 * consume the same shape. This is the type the API Zod schema validates
 * (`apps/api/src/services/board-diagram-schema.ts`) and the type that gets
 * sent over the wire in `/api/boards/...` payloads.
 *
 * The web editor (`apps/web/src/components/boards/TacticalBoardEditor.tsx`)
 * and the API normalizer (`apps/api/src/services/web-diagram-v1.ts`) both
 * derive their shape from this file.
 *
 * Coordinate system: 0–100 normalized. The webapp's `pitch.orientation`
 * defines which axis maps to which (HORIZONTAL → x is length, y is width;
 * VERTICAL → x is width, y is length). All client rendering must respect
 * `pitch.orientation`. The mobile editor renders VERTICAL only.
 *
 * Last updated when the type was hoisted out of `apps/api/src/services/web-diagram-v1.ts`.
 * Keep field names + types in sync with the API Zod schema.
 */

export type WebDiagramTeam = 'ATT' | 'DEF' | 'NEUTRAL';

/** Allowed practice kit kinds. Matches the Zod schema. */
export const BOARD_ELEMENT_KINDS = ['mini-goal', 'cone', 'mannequin', 'pole'] as const;
export type WebDiagramElementKind = (typeof BOARD_ELEMENT_KINDS)[number];
export type BoardElementKind = WebDiagramElementKind;

/** A practice-kit item: mini-goal, cone, mannequin, or pole. */
export interface BoardElement {
  id: string;
  kind: WebDiagramElementKind;
  /** 0–100 normalized. */
  x: number;
  /** 0–100 normalized. */
  y: number;
  /** Degrees; 0 = facing +y (right on the board). */
  rotation?: number;
  color?: string;
  width?: number;
}

export type WebDiagramElement = BoardElement;

export type WebDiagramArrowType = 'pass' | 'run' | 'press' | 'cover' | 'transition';
export type WebDiagramArrowStyle = 'solid' | 'dashed' | 'dotted';
export type WebDiagramArrowWeight = 'normal' | 'bold';

/**
 * Reference to a point on the pitch. Either a playerId anchor (snap to a
 * player's current position) or an absolute { x, y } in 0–100 coords.
 * Both can be present (the player anchor wins if the player exists).
 */
export interface WebDiagramPointRef {
  playerId?: string;
  x?: number;
  y?: number;
}

export interface WebDiagramArrow {
  from: WebDiagramPointRef;
  to: WebDiagramPointRef;
  type: WebDiagramArrowType;
  style: WebDiagramArrowStyle;
  weight: WebDiagramArrowWeight;
  /**
   * Explicit arrowhead; when omitted, the renderer infers from type
   * (transition = no arrowhead by default).
   */
  arrowhead?: boolean;
  /** Quadratic curve control point (0–100). Used for run lines. */
  control?: { x: number; y: number };
  /** Freehand polyline (0–100). from/to remain endpoints. */
  path?: Array<{ x: number; y: number }>;
  /** 1-based pass/run order for combination filmstrips. */
  order?: number;
}

export interface WebDiagramPlayer {
  id: string;
  number?: number;
  team: WebDiagramTeam;
  role?: string;
  /** 0–100 normalized. */
  x: number;
  /** 0–100 normalized. */
  y: number;
  relativePosition?: string;
  /** Degrees; 0 = facing +y (right on the board). */
  facingAngle?: number;
  labelStyle?: 'number-only' | 'number-and-role';
}

export interface WebDiagramGoal {
  id: string;
  x: number;
  y: number;
  width?: number;
  type?: string;
}

export interface WebDiagramCoach {
  x: number;
  y: number;
  label?: string;
  note?: string;
}

export interface WebDiagramArea {
  label?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** rect = zone box; circle = outlined oval; spotlight = soft radial highlight */
  shape?: 'rect' | 'circle' | 'spotlight';
}

export interface WebDiagramLabel {
  text: string;
  x: number;
  y: number;
}

export interface WebDiagramBall {
  x: number;
  y: number;
}

export interface WebDiagramCone {
  x: number;
  y: number;
  color?: string;
}

export interface WebDiagramZones {
  leftWide?: boolean;
  leftHalfSpace?: boolean;
  centralChannel?: boolean;
  rightHalfSpace?: boolean;
  rightWide?: boolean;
}

export interface WebDiagramPitch {
  variant: 'FULL' | 'HALF' | 'THIRD';
  orientation: 'HORIZONTAL' | 'VERTICAL';
  /** Age-group field size; determines markings + zoom scale. */
  format?: '7V7' | '9V9' | '11V11';
  showZones?: boolean;
  /** Dashed lines at 1/3 and 2/3 of pitch length. */
  showThirds?: boolean;
  zones?: WebDiagramZones;
}

/** Layers on a single frame (or the root diagram when there's no sequence). */
export interface WebDiagramFrameLayers {
  players: WebDiagramPlayer[];
  arrows: WebDiagramArrow[];
  areas: WebDiagramArea[];
  labels: WebDiagramLabel[];
  balls?: WebDiagramBall[];
  goals?: WebDiagramGoal[];
  coach?: WebDiagramCoach;
  cones?: WebDiagramCone[];
  elements?: BoardElement[];
}

export interface WebDiagramSequenceFrame extends WebDiagramFrameLayers {
  id: string;
  title?: string;
  note?: string;
  /** Hold time before advancing during Play (default ~1600). */
  durationMs?: number;
}

export interface WebDiagramSequence {
  activeFrameId: string;
  frames: WebDiagramSequenceFrame[];
}

/**
 * Canonical tactical board diagram. Sent over the wire as JSON.
 * Validated by the API Zod schema (`apps/api/src/services/board-diagram-schema.ts`).
 */
export interface WebDiagramV1 {
  pitch: WebDiagramPitch;
  players: WebDiagramPlayer[];
  goals?: WebDiagramGoal[];
  coach?: WebDiagramCoach;
  balls?: WebDiagramBall[];
  cones?: WebDiagramCone[];
  elements?: BoardElement[];
  arrows: WebDiagramArrow[];
  areas: WebDiagramArea[];
  labels: WebDiagramLabel[];
  /** Multi-step play sequence; root layers mirror the active frame. */
  sequence?: WebDiagramSequence;
}

/** Strict 0–100 clamp for incoming payloads. */
export function clamp01to100(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}
