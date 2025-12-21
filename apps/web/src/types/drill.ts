import type { DiagramV1 } from "./diagram";

export type GameModelId = "COACHAI" | "POSSESSION" | "PRESSING" | "TRANSITION";

export type PhaseId =
  | "ATTACKING"
  | "DEFENDING"
  | "TRANSITION_ATTACK"
  | "TRANSITION_DEFEND";

export type ZoneId =
  | "DEFENSIVE_THIRD"
  | "MIDDLE_THIRD"
  | "ATTACKING_THIRD";

export type AgeGroupId =
  | "U8"
  | "U9"
  | "U10"
  | "U11"
  | "U12"
  | "U13"
  | "U14"
  | "U15"
  | "U16"
  | "U17"
  | "U18";

export type SpaceConstraintId =
  | "FULL"
  | "HALF"
  | "THIRD"
  | "QUARTER"
  | "CUSTOM";

export type EnergySystem = "ATP-PC" | "Anaerobic" | "Aerobic";

export type PlayerLevelId =
  | "BEGINNER"
  | "BEGINNER_INTERMEDIATE"
  | "INTERMEDIATE"
  | "ADVANCED";

export type CoachLevelId =
  | "GRASSROOTS"
  | "D_LICENSE"
  | "C_LICENSE"
  | "B_LICENSE"
  | "A_LICENSE";

export interface OrganizationExtras {
  triggers?: string[];
  rotation?: string[];
  scoring?: string[];
  restarts?: string[];
  success?: string[];
}

export interface Drill {
  id: string;
  title: string;
  summary?: string;
  gameModelId: GameModelId;
  phase: PhaseId;
  zone: ZoneId;
  ageGroup: AgeGroupId;
  principleIds: string[];
  psychThemeIds: string[];
  energySystem: EnergySystem;
  rpeMin: number;
  rpeMax: number;
  durationMin: number;
  numbersMin: number;
  numbersMax: number;
  spaceConstraint: SpaceConstraintId;
  goalsAvailable: number;
  goalMode:
    | "NONE"
    | "MINI1"
    | "MINI2"
    | "FULL1"
    | "FULL2";
  gkOptional: boolean;
  needGKFocus: boolean;
  gkFocus: string | null;
  organization: string;
  organizationExtras?: OrganizationExtras;
  description: string;
  coachingPoints: string[];
  progressions: string[];
  scoringHints: string[];
  constraints: string[];
  equipment: string[];
  diagramV1: DiagramV1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diagram?: any;
  playerLevel?: PlayerLevelId;
  coachLevel?: CoachLevelId;
  psychThemeText?: string;
  qaScore: number;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json?: any;
}
