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
}

export interface DiagramArea {
  label?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface DiagramLabel {
  text: string;
  x: number;
  y: number;
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
}
