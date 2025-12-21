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

export type PlayerLevel =
  | "BEGINNER"
  | "INTERMEDIATE"
  | "ADVANCED";

export type CoachLevel =
  | "GRASSROOTS"
  | "USSF_C"
  | "USSF_B_PLUS";

// Valid formations by format
export type Formation7v7 = "2-3-1" | "3-2-1";
export type Formation9v9 = "3-2-3" | "2-3-2-1" | "3-3-2";
export type Formation11v11 = "4-3-3" | "4-2-3-1" | "4-4-2" | "3-5-2";
export type FormationUsed = Formation7v7 | Formation9v9 | Formation11v11;

export interface OrganizationExtras {
  triggers?: string[];
  rotation?: string[];
  scoring?: string[];
  restarts?: string[];
  success?: string[];
}

// Keep this minimal for now: match the shape already used in web/src/types/diagram.ts
export interface DiagramV1 {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface Drill {
  id: string;

  // Core identifiers
  title: string;
  summary?: string;
  gameModelId: GameModelId;
  phase: PhaseId;
  zone: ZoneId;
  ageGroup: AgeGroupId;

  // Tactical & psych metadata
  principleIds: string[];
  psychThemeIds: string[];

  // Physical / conditioning
  energySystem: EnergySystem;
  rpeMin: number;
  rpeMax: number;

  // Session constraints
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
  
  // Formation & level metadata
  formationUsed: FormationUsed;
  playerLevel: PlayerLevel;
  coachLevel: CoachLevel;

  // GK-specific
  gkOptional: boolean;
  needGKFocus: boolean;
  gkFocus: string | null;

  // Primary content
  organization: string;
  organizationExtras?: OrganizationExtras;
  description: string;
  coachingPoints: string[];
  progressions: string[];
  scoringHints: string[];
  constraints: string[];
  equipment: string[];

  // Diagrams
  diagramV1: DiagramV1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diagram?: any;

  // Extra context
  psychThemeText?: string;

  // QA & system metadata
  qaScore: number;
  approved: boolean;
  createdAt: string;
  updatedAt: string;

  // raw JSON from the LLM, if we still persist it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json?: any;
}
