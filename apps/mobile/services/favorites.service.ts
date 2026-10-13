import api, { normalizeApiError } from './api';

export type FavoritesPayload = {
  sessions: any[];
  drills: any[];
  series: any[];
  counts: {
    sessions: number;
    drills: number;
    series: number;
    total: number;
  };
};

export async function getFavorites(): Promise<FavoritesPayload> {
  try {
    const response = await api.get<{ ok: boolean } & FavoritesPayload>('/favorites');
    return {
      sessions: response.data.sessions || [],
      drills: response.data.drills || [],
      series: response.data.series || [],
      counts: response.data.counts || { sessions: 0, drills: 0, series: 0, total: 0 },
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function toggleSessionFavorite(id: string, isFavorited: boolean): Promise<void> {
  try {
    if (isFavorited) {
      await api.delete(`/favorites/session/${id}`);
      return;
    }
    await api.post(`/favorites/session/${id}`);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function toggleDrillFavorite(id: string, isFavorited: boolean): Promise<void> {
  try {
    if (isFavorited) {
      await api.delete(`/favorites/drill/${id}`);
      return;
    }
    await api.post(`/favorites/drill/${id}`);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function toggleSeriesFavorite(id: string, isFavorited: boolean): Promise<void> {
  try {
    if (isFavorited) {
      await api.delete(`/favorites/series/${id}`);
      return;
    }
    await api.post(`/favorites/series/${id}`);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function checkFavorites(params: {
  sessionIds?: string[];
  drillIds?: string[];
  seriesIds?: string[];
}): Promise<{ sessions: Record<string, boolean>; drills: Record<string, boolean>; series: Record<string, boolean> }> {
  try {
    const response = await api.post<{
      ok: boolean;
      sessions: Record<string, boolean>;
      drills: Record<string, boolean>;
      series: Record<string, boolean>;
    }>('/favorites/check', params);
    return {
      sessions: response.data.sessions || {},
      drills: response.data.drills || {},
      series: response.data.series || {},
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}
