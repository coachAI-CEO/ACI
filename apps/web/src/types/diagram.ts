export type DiagramTeamCode = "ATT" | "DEF" | "NEUTRAL";

export interface DiagramPitchZones {
  leftWide?: boolean;
  leftHalfSpace?: boolean;
  centralChannel?: boolean;
  rightHalfSpace?: boolean;
  rightWide?: boolean;
}

export interface DiagramPitch {
  variant: "FULL" | "HALF" | "THIRD";
  orientation: "HORIZONTAL" | "VERTICAL";
  /** Age-group field size; markings/zoom scale from this. */
  format?: "7V7" | "9V9" | "11V11";
  showZones?: boolean;
  zones?: DiagramPitchZones;
}

export interface DiagramGoal {
  id: string;
  x: number;
  y: number;
  width?: number;
  type?: "BIG" | "SMALL" | string;
}

export interface DiagramPlayer {
  id: string;
  number?: number;
  team: DiagramTeamCode;
  role?: string;
  x: number; // 0–100
  y: number; // 0–100
  relativePosition?: string;
  facingAngle?: number; // degrees, 0 = up
  labelStyle?: "number-only" | "number-and-role";
}

export interface DiagramCoach {
  x: number;
  y: number;
  label?: string;
  note?: string;
}

export interface DiagramPointRef {
  playerId?: string;
  x?: number;
  y?: number;
}

export type DiagramArrowType = "pass" | "run" | "press" | "cover" | "transition";
export type DiagramArrowStyle = "solid" | "dashed" | "dotted";
export type DiagramArrowWeight = "normal" | "bold";

export interface DiagramArrow {
  from: DiagramPointRef;
  to: DiagramPointRef;
  type: DiagramArrowType;
  style: DiagramArrowStyle;
  weight: DiagramArrowWeight;
  /** Explicit arrowhead; when omitted, inferred from type (transition = none). */
  arrowhead?: boolean;
  /** Quadratic curve control point in pitch coords (0–100). */
  control?: { x: number; y: number };
  /** Freehand polyline in pitch coords; from/to remain endpoints. */
  path?: Array<{ x: number; y: number }>;
}

export interface DiagramArea {
  label?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** rect = zone box; circle = outlined oval; spotlight = soft radial highlight */
  shape?: "rect" | "circle" | "spotlight";
}

export interface DiagramLabel {
  text: string;
  x: number;
  y: number;
}

/** Mutable board layers stored per sequence frame (pitch stays on root). */
export type DiagramFrameLayers = {
  players: DiagramPlayer[];
  arrows: DiagramArrow[];
  areas: DiagramArea[];
  labels: DiagramLabel[];
  balls?: Array<{ x: number; y: number }>;
  goals?: DiagramGoal[];
  coach?: DiagramCoach;
  cones?: Array<{ x: number; y: number; color?: string }>;
};

export interface DiagramSequenceFrame extends DiagramFrameLayers {
  id: string;
  title?: string;
  note?: string;
  /** Hold time before advancing during Play (default ~1600). */
  durationMs?: number;
}

export interface DiagramSequence {
  frames: DiagramSequenceFrame[];
  activeFrameId: string;
}

export interface DiagramV1 {
  pitch: DiagramPitch;
  players: DiagramPlayer[];
  goals?: DiagramGoal[];
  coach?: DiagramCoach;
  balls?: any[];
  cones?: any[];
  arrows: DiagramArrow[];
  areas: DiagramArea[];
  labels: DiagramLabel[];
  /** Multi-step play sequence; root layers mirror the active frame. */
  sequence?: DiagramSequence;
}
