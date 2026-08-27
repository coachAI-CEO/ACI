import type { FieldFormat } from "../data/field-dimensions";

export interface DrawerParams {
  title: string;
  drillType: string;
  format: string;
  /** Real match format (7v7/9v9/11v11) this drill is scaled to -- explicit
   * from generation input when available, otherwise guessed from player
   * count as a fallback for older stored drills. */
  fieldFormat: FieldFormat;
  phase: string;
  zone: string;
  gameModelId: string;
  formationAttacking: string;
  formationDefending: string;
  durationMin: number;
  rpeMin: number;
  rpeMax: number;
  widthYards: number;
  lengthYards: number;
  players: DrawerPlayer[];
  goals: DrawerGoal[];
  arrows: DrawerArrow[];
  zones: DrawerZone[];
  annotations: DrawerAnnotation[];
  coachingPoints: string[];
  primaryCoachingPicture: string;
  coach: DrawerCoach | null;
  /** One-goal attacking/defending third stretched to fill the field box.
   * Skip match halfway line / center circle -- those describe a full pitch. */
  hideMatchPitchMarkings?: boolean;
  /** When set, skip area-based token scaling and use this radius (px). */
  lockTokenRadius?: number;
}

export interface DrawerCoach {
  x: number;
  y: number;
  label: string;
}

export interface DrawerPlayer {
  id: string;
  number: number;
  team: "home" | "away" | "neutral" | "gk";
  role: string;
  x: number;
  y: number;
  label?: string;
}

export interface DrawerGoal {
  id: string;
  x: number;
  y: number;
  width: number;
  type: "full" | "mini" | "gate";
}

export interface DrawerArrow {
  id: string;
  /** isCoach: true means this endpoint should render wherever the coach
   * marker actually is (see resolveCoachPoint in the renderers), not at
   * a raw x/y -- the coach marker gets projected outside the field
   * boundary, so an arrow using its raw declared position would visibly
   * disconnect from the marker. */
  from: { x: number; y: number; isCoach?: boolean };
  to: { x: number; y: number; isCoach?: boolean };
  type: "pass" | "run" | "press" | "movement" | "counter" | "delivery" | "finish";
  label?: string;
}

export interface DrawerZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  team?: string;
  color?: string;
}

export interface DrawerAnnotation {
  id: string;
  text: string;
  x: number;
  y: number;
  color?: string;
}

export type DrawerResult =
  | { ok: true; svg: string }
  | { ok: false; reason: DrawerFailReason; raw?: string };

export type DrawerFailReason =
  | "invalid_output"
  | "too_short"
  | "too_large"
  | "xml_error"
  | "unsafe_svg"
  | "model_error";
