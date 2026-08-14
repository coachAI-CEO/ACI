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

export const EMPTY_PHILOSOPHY: PhilosophyForm = {
  attackingOrganization: "",
  defensiveTransition: "",
  defensiveOrganization: "",
  attackingTransition: "",
};
