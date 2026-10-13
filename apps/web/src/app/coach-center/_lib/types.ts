import type { MatchRecap } from "./match-recap";

export type ClubOption = {
  clubId: string;
  clubName: string;
  role?: string;
  gameModelId?: string;
};

export type WeekSessionIdea = {
  slot: string;
  title: string;
  detail: string;
};

export type WeekKnowledge = {
  audienceLabel: string;
  format: string;
  why: string;
  constraints: string[];
  ideas: WeekSessionIdea[];
};

export type CurriculumWeek = {
  id: string;
  weekIndex: number;
  theme: string;
  moment: string;
  phase: string;
  zone: string | null;
  focus: string | null;
  notes: string | null;
  generateHref?: string;
  knowledge?: WeekKnowledge;
};

export type TeamSeason = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  phase: string;
  currentWeekIndex: number;
  weeks: CurriculumWeek[];
  currentWeek: CurriculumWeek | null;
};

export type TeamSummary = {
  id: string;
  name: string;
  ageGroup: string;
  clubId: string | null;
  clubName: string | null;
  gameModelId: string;
  gameModelLabel: string;
  seasonLabel: string | null;
  notes: string | null;
  playerLevelOverride: string | null;
  band: string;
  audienceSource: string;
  coachLevel: string;
  playerLevel: string;
  generateHref: string;
  coaches: Array<{ userId: string; name: string; role: string }>;
  season: TeamSeason | null;
};

export type CalendarDay = {
  date: string;
  dayLabel: string;
  events: Array<{
    id: string;
    time: string;
    location: string | null;
    completed: boolean;
    forThisTeam: boolean;
    session: { id: string; title: string; refCode: string | null; durationMin: number | null } | null;
  }>;
};

export type Recommendation = {
  id: string;
  title: string;
  refCode: string | null;
  ageGroup: string;
  durationMin: number | null;
  matchReason: string;
  href: string;
};

export type GameDayItem = {
  id: string;
  matchDate: string;
  opponent: string | null;
  venue: string | null;
  competition: string | null;
  kickoffTime: string | null;
  formation: string | null;
  keyFocus: string | null;
  attackingNotes: string | null;
  defendingNotes: string | null;
  setPieces: string | null;
  recap?: MatchRecap | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};
