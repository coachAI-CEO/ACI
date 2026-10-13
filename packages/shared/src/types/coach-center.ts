// Coach Center shared types — consumed by both mobile and web.
//
// Where the two clients differ, the richer type is kept and the narrower
// client type is made an alias.  The narrower fields are always optional
// so a client reading only what it needs stays valid.
//
// Source of truth for the API shape is apps/api/src/services/coach-center.ts
// and apps/api/src/routes-coach-center.ts.

// ─── Recap ───────────────────────────────────────────────────────────────────────

/** Web-only rich recap shape. Used by GameDayItem.recap on web; not sent to mobile. */
export type MatchRecap = {
  type: 'MATCH_RECAP';
  usScore: number;
  themScore: number;
  caption: string;
  headline: string;
  summary: string;
  location: string;
  opponentLabel: string;
  pillars: RecapPair[];
  stats: Record<string, RecapStatEntry>;
  takeaways: RecapPair[];
  nextUp: string[];
  proudOf: string;
  keepBuilding: string;
  meaning: RecapPair[];
};

export type RecapPair = { title: string; body: string };
export type RecapStatEntry = { value: string; label: string };

/** Mobile-compatible recap shape — subset of MatchRecap stored in GameDayItem.recap. */
export type MatchRecapLite = {
  type?: string;
  usScore?: number;
  themScore?: number;
  headline?: string;
  summary?: string;
  caption?: string;
  location?: string;
  opponentLabel?: string;
  proudOf?: string;
  keepBuilding?: string;
  nextUp?: string[];
};

// ─── Team calendar ────────────────────────────────────────────────────────────
//
// Renamed from `CalendarEvent` / `CalendarSessionRef` (which already exist in
// types/calendar.ts for the user's calendar view) so the two surfaces don't
// collide in the shared index.

export type CoachCenterCalendarEvent = {
  id: string;
  time: string;
  location: string | null;
  completed: boolean;
  forThisTeam: boolean;
  session: CoachCenterSessionRef | null;
};

export type CoachCenterSessionRef = {
  id: string;
  title: string | null;
  refCode: string | null;
  durationMin: number | null;
};

/** One day in the team calendar. */
export type CalendarDay = {
  date: string;
  dayLabel: string;
  events: CoachCenterCalendarEvent[];
};

// ─── Curriculum ────────────────────────────────────────────────────────────

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

// ─── Team ──────────────────────────────────────────────────────────────────

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

/**
 * Full team summary returned by the overview endpoint.
 * The mobile `CoachCenterTeam` type is a partial alias of this.
 */
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

// ─── Coach Center access ─────────────────────────────────────────────────────

export type ClubOption = {
  clubId: string;
  clubName: string;
  role?: string;
  gameModelId?: string;
};

// ─── Recommendations ────────────────────────────────────────────────────────

export type Recommendation = {
  id: string;
  title: string;
  refCode: string | null;
  ageGroup: string;
  durationMin: number | null;
  matchReason: string;
  /** Web URL to the vault session. Mobile ignores this and uses `id` directly. */
  href: string;
};

// ─── Game Day ─────────────────────────────────────────────────────────────

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
  recap: MatchRecap | null;
};

// ─── Chat ─────────────────────────────────────────────────────────────────

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};
