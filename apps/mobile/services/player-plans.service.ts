import api, { normalizeApiError } from './api';

export type PlayerPlanSummary = {
  id: string;
  refCode: string | null;
  title: string | null;
  ageGroup?: string | null;
  playerLevel?: string | null;
  durationMin?: number | null;
  sourceType?: string | null;
  sourceRefCode?: string | null;
  createdAt?: string;
};

export type PlayerPlanDetail = PlayerPlanSummary & {
  json?: any;
  plan?: any;
};

export async function listPlayerPlans(params?: {
  sourceType?: 'SESSION' | 'SERIES';
  page?: number;
  limit?: number;
}): Promise<{ plans: PlayerPlanSummary[]; total: number }> {
  try {
    const response = await api.get<{
      ok: boolean;
      plans: PlayerPlanSummary[];
      pagination?: { total?: number };
    }>('/player-plans', { params });
    return {
      plans: response.data.plans || [],
      total: response.data.pagination?.total || response.data.plans?.length || 0,
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function getPlayerPlan(planId: string): Promise<PlayerPlanDetail> {
  try {
    const response = await api.get<{ ok: boolean; plan: PlayerPlanDetail }>(`/player-plans/${planId}`);
    return response.data.plan;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function createPlayerPlanFromSession(
  sessionId: string,
  payload?: { durationMin?: 30 | 45; focus?: string; playerLevel?: string; sourceRefCode?: string }
): Promise<{ id: string; refCode: string; plan: any }> {
  try {
    const response = await api.post<{ ok: boolean; id: string; refCode: string; plan: any }>(
      `/player-plans/from-session/${encodeURIComponent(sessionId)}`,
      payload || {}
    );
    return {
      id: response.data.id,
      refCode: response.data.refCode,
      plan: response.data.plan,
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function createPlayerPlanFromSeries(
  seriesId: string,
  payload?: { durationMin?: 30 | 45; focus?: string; playerLevel?: string; sessionNumbers?: number[] }
): Promise<{ id: string; refCode: string; plan: any }> {
  try {
    const response = await api.post<{ ok: boolean; id: string; refCode: string; plan: any }>(
      `/player-plans/from-series/${encodeURIComponent(seriesId)}`,
      payload || {}
    );
    return {
      id: response.data.id,
      refCode: response.data.refCode,
      plan: response.data.plan,
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function deletePlayerPlan(planId: string): Promise<void> {
  try {
    await api.delete(`/player-plans/${planId}`);
  } catch (error) {
    throw normalizeApiError(error);
  }
}
