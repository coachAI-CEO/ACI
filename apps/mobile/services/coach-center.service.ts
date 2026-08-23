import api, { normalizeApiError } from './api';
import type {
  ClubOption,
  Recommendation,
  ChatMessage,
  CalendarDay as SharedCalendarDay,
  GameDayItem as SharedGameDayItem,
  MatchRecapLite,
  TeamSeason,
  CurriculumWeek,
} from '@aci/shared';

// ─── Mobile aliases ───────────────────────────────────────────────────────────
//
// Mobile's screens only consume a subset of the shared types. Each alias
// picks the fields the screens actually read, so a screen that ignores
// `season.weeks` etc. is still valid against the API response.
//
// Source of truth: packages/shared/src/types/coach-center.ts.

/** Subset of TeamSummary used by the mobile Coach Center screens. */
export type CoachCenterTeam = {
  id: string;
  name: string;
  ageGroup?: string | null;
  gameModelId?: string | null;
  gameModelLabel?: string | null;
  clubName?: string | null;
  playerLevel?: string | null;
  coachLevel?: string | null;
  generateHref?: string;
  notes?: string | null;
  season?: TeamSeason | null;
};

export type CoachCenterAccess = {
  canViewAllTeams: boolean;
  clubs: Array<ClubOption & { role: string }>;
  teams: CoachCenterTeam[];
};

export type CoachCenterOverview = {
  team: CoachCenterTeam;
  upcoming: Array<{
    id: string;
    scheduledDate: string;
    location?: string | null;
    completed?: boolean;
    session?: { id: string; title?: string | null; refCode?: string | null; durationMin?: number | null } | null;
  }>;
  recent: Array<{
    id: string;
    scheduledDate: string;
    location?: string | null;
    session?: { id: string; title?: string | null; refCode?: string | null } | null;
  }>;
  nextMatch?: {
    id: string;
    matchDate: string;
    opponent?: string | null;
    venue?: string | null;
    keyFocus?: string | null;
  } | null;
  recommendations: Recommendation[];
};

/** Alias of the shared CalendarDay — the mobile's screens read the same fields. */
export type CoachCenterWeekDay = SharedCalendarDay;

/** Alias of the shared GameDayItem, with mobile's narrower recap shape. */
export type GameDayItem = Omit<SharedGameDayItem, 'recap'> & {
  recap?: MatchRecapLite | null;
};

export type { MatchRecapLite, ChatMessage, CurriculumWeek };

export async function getCoachCenterAccess(): Promise<CoachCenterAccess> {
  try {
    const response = await api.get<{ ok: boolean } & CoachCenterAccess>('/coach-center/access');
    return {
      canViewAllTeams: Boolean(response.data.canViewAllTeams),
      clubs: response.data.clubs || [],
      teams: response.data.teams || [],
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function getTeamOverview(teamId: string): Promise<CoachCenterOverview> {
  try {
    const response = await api.get<{ ok: boolean } & CoachCenterOverview>(
      `/coach-center/teams/${encodeURIComponent(teamId)}/overview`
    );
    return {
      team: response.data.team,
      upcoming: response.data.upcoming || [],
      recent: response.data.recent || [],
      nextMatch: response.data.nextMatch || null,
      recommendations: response.data.recommendations || [],
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/**
 * Vault recommendations that match a particular week of the team's curriculum.
 * Used by the Curriculum detail screen to surface sessions that fit the
 * week's phase/zone/theme.
 */
export async function getRecommendationsForWeek(
  teamId: string,
  weekIndex: number
): Promise<Recommendation[]> {
  try {
    const response = await api.get<{ ok: boolean; recommendations: Recommendation[] }>(
      `/coach-center/teams/${encodeURIComponent(teamId)}/recommendations`,
      { params: { weekIndex } }
    );
    return response.data.recommendations || [];
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function getTeamWeekCalendar(
  teamId: string,
  weekStart: string
): Promise<{ weekStart: string; days: CoachCenterWeekDay[]; team: CoachCenterTeam }> {
  try {
    const response = await api.get<{
      ok: boolean;
      weekStart: string;
      days: CoachCenterWeekDay[];
      team: CoachCenterTeam;
    }>(`/coach-center/teams/${encodeURIComponent(teamId)}/calendar`, {
      params: { weekStart },
    });
    return {
      weekStart: response.data.weekStart,
      days: response.data.days || [],
      team: response.data.team,
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function listGameDays(teamId: string): Promise<GameDayItem[]> {
  try {
    const response = await api.get<{ ok: boolean; items: GameDayItem[] }>(
      `/coach-center/teams/${encodeURIComponent(teamId)}/game-days`
    );
    return response.data.items || [];
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function downloadGameDayPdf(teamId: string, gameDayId: string): Promise<ArrayBuffer> {
  try {
    const response = await api.get<ArrayBuffer>(
      `/coach-center/teams/${encodeURIComponent(teamId)}/game-days/${encodeURIComponent(gameDayId)}/pdf`,
      { responseType: 'arraybuffer' }
    );
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function updateGameDay(
  teamId: string,
  gameDayId: string,
  payload: {
    opponent?: string;
    venue?: string;
    keyFocus?: string;
    recap?: MatchRecapLite;
  }
): Promise<GameDayItem> {
  try {
    const response = await api.patch<{ ok: boolean; item: GameDayItem }>(
      `/coach-center/teams/${encodeURIComponent(teamId)}/game-days/${encodeURIComponent(gameDayId)}`,
      payload
    );
    return response.data.item;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/** Monday (UTC) ISO date for the week containing `from`. */
export function mondayUtcIso(from = new Date()): string {
  const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}
