import type { VaultSessionListItem } from '@aci/shared';
import api, { normalizeApiError } from './api';
import { deriveDrillsFromSessions } from '../utils/vault-derive';
import type { VaultDrillLite } from '../utils/vault-derive';

export type VaultSession = VaultSessionListItem & {
  gameModelId?: string;
  phase?: string;
  zone?: string;
  durationMin?: number;
  savedToVault?: boolean;
  json?: any;
  favoriteCount?: number;
};

export type VaultSeries = {
  seriesId: string;
  sessions: VaultSession[];
  totalSessions: number;
  gameModelId?: string;
  ageGroup?: string;
  favoriteCount?: number;
};

export async function getRecentVaultSessions(limit = 3): Promise<VaultSession[]> {
  try {
    const response = await api.get<{ ok: boolean; sessions: VaultSession[] }>('/vault/sessions', {
      params: { limit, offset: 0 },
    });
    return response.data.sessions || [];
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function getVaultSessions(params: {
  limit?: number;
  offset?: number;
  ageGroup?: string;
  gameModelId?: string;
  phase?: string;
  zone?: string;
}): Promise<{ sessions: VaultSession[]; total: number }> {
  try {
    const response = await api.get<{ ok: boolean; sessions: VaultSession[]; total: number }>('/vault/sessions', {
      params,
    });
    return {
      sessions: response.data.sessions || [],
      total: response.data.total || 0,
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function searchVaultSessions(payload: {
  query: string;
  params?: { ageGroup?: string; gameModelId?: string; phase?: string; zone?: string };
  limit?: number;
}): Promise<VaultSession[]> {
  try {
    const response = await api.post<{ ok: boolean; results: Array<{ session: VaultSession }> }>('/vault/sessions/search', payload);
    return (response.data.results || []).map((entry) => entry.session);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function getVaultSeries(): Promise<VaultSeries[]> {
  try {
    const response = await api.get<{ ok: boolean; series: VaultSeries[] }>('/vault/series');
    return response.data.series || [];
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function lookupRefCode(refCode: string): Promise<{ type: string; data: any } | null> {
  try {
    const response = await api.get<{ ok: boolean; type: string; data: any }>(`/vault/lookup/${encodeURIComponent(refCode)}`);
    return { type: response.data.type, data: response.data.data };
  } catch (error) {
    const normalized = normalizeApiError(error);
    if (normalized.status === 404) {
      return null;
    }
    throw normalized;
  }
}

export type { VaultDrillLite };
export { deriveDrillsFromSessions };
