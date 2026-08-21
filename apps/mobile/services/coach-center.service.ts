import api, { normalizeApiError } from './api';

export type CoachCenterTeam = {
  id: string;
  name: string;
  ageGroup?: string | null;
  gameModelId?: string | null;
  gameModelLabel?: string | null;
  clubName?: string | null;
  playerLevel?: string | null;
  season?: {
    currentWeek?: {
      weekIndex?: number;
      theme?: string;
      focus?: string;
      phase?: string;
      zone?: string;
    } | null;
  } | null;
};

export type CoachCenterAccess = {
  canViewAllTeams: boolean;
  clubs: Array<{
    clubId: string;
    clubName: string;
    role: string;
    gameModelId?: string | null;
  }>;
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
  recommendations: Array<{
    id?: string;
    title?: string;
    refCode?: string;
    reason?: string;
    matchReason?: string;
    ageGroup?: string;
  }>;
};

export type CoachCenterWeekDay = {
  date: string;
  dayLabel: string;
  events: Array<{
    id: string;
    time: string;
    location?: string | null;
    completed?: boolean;
    forThisTeam?: boolean;
    session?: { id: string; title?: string | null; refCode?: string | null; durationMin?: number | null } | null;
  }>;
};

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

export type GameDayItem = {
  id: string;
  matchDate: string;
  opponent?: string | null;
  venue?: string | null;
  competition?: string | null;
  kickoffTime?: string | null;
  formation?: string | null;
  keyFocus?: string | null;
  attackingNotes?: string | null;
  defendingNotes?: string | null;
  setPieces?: string | null;
  recap?: MatchRecapLite | null;
};

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
