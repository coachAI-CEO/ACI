export type AttentionItem = {
  id: string;
  ruleId: string;
  severity: string;
  coachUserId: string;
  coachName: string;
  title: string;
  detail: string;
  weekStart: string;
  action: { type: "assign" | "calendar" | "none" };
};

export type AttentionSummary = {
  coachesManaged: number;
  activeCoaches: number;
  emptyWeekCount: number;
  weeklyAiSessions: number;
};

export type CoachUsageRow = {
  userId: string;
  name: string;
  roleLabel: string;
  runs: number;
  lastActiveLabel: string;
  status: string;
};

export type UsageSummary = {
  coachesManaged: number;
  activeCoaches: number;
  inactiveThisWeek: number;
  weeklyAiSessions: number;
};

export type CalendarCoach = {
  userId: string;
  name: string;
  roleLabel: string;
};

export type CalendarCellEvent = {
  eventId: string;
  title: string;
  code: string;
  time: string;
  isCoverage?: boolean;
};

export type CalendarDay = {
  date: string;
  dayLabel: string;
  cells: Record<string, CalendarCellEvent[]>;
};

export type VaultSessionOption = {
  id: string;
  refCode: string | null;
  title: string;
  ageGroup: string;
  durationMin: number | null;
};

export type PhilosophyForm = {
  attackingOrganization: string;
  defensiveTransition: string;
  defensiveOrganization: string;
  attackingTransition: string;
};

export type ClubOption = {
  clubId: string;
  clubName: string;
  role?: string;
};

export type AgeGroupMaturityRow = {
  ageGroup: string;
  note: string;
  isCustom: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ReadinessCeilingRow = {
  ageGroup: string;
  ceiling: "FOUNDATIONAL" | "DEVELOPING" | "ADVANCED";
  isCustom: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type CoachAdherenceRow = {
  userId: string;
  name: string;
  email: string | null;
  teams: Array<{ teamId: string; teamName: string; assigned: number; matched: number }>;
  assigned: number;
  matched: number;
  rate: number | null;
};

export type TeamListRow = {
  id: string;
  name: string;
  ageGroup: string;
};

export type SubprincipleOption = {
  id: string;
  trigger: string;
  response: string;
  antiPattern: string | null;
  readiness: "FOUNDATIONAL" | "DEVELOPING" | "ADVANCED";
  order: number;
};

export type PrincipleWithSubprinciples = {
  id: string;
  moment: string;
  statement: string;
  order: number;
  subprinciples: SubprincipleOption[];
};

export type TrainingPriorityRow = {
  id: string;
  weekStart: string;
  rationale: string;
  status: "ACTIVE" | "RESOLVED";
  outcome: "RARELY" | "SOMETIMES" | "CONSISTENTLY" | null;
  outcomeNotes: string | null;
  subprinciple: {
    id: string;
    trigger: string;
    response: string;
    readiness: "FOUNDATIONAL" | "DEVELOPING" | "ADVANCED";
    principle: { moment: string; statement: string };
  };
};

export type GeneratedDrillResult = {
  intent: { tacticalProblem: string; mustBeAvailable: string; mustBeAvoided: string };
  drill: {
    title: string;
    drillType: string;
    organization: {
      area: { lengthYards: number; widthYards: number };
      setupSteps: string[];
      rotation: string;
      restarts: string;
      scoring: string;
    };
    constraints: string[];
    coachingPoints: string[];
  };
  qa: {
    pass: boolean;
    principleAlignment?: { contradicted: boolean; contradictingConstraint: string | null; explanation: string };
  };
};

export const EMPTY_PHILOSOPHY: PhilosophyForm = {
  attackingOrganization: "",
  defensiveTransition: "",
  defensiveOrganization: "",
  attackingTransition: "",
};
