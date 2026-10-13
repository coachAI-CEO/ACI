import api, { normalizeApiError } from './api';

export async function getDrillDiagramSvg(drillId: string): Promise<{ svg: string | null; cooldown?: boolean }> {
  try {
    const response = await api.get<{ svg: string | null; cooldown?: boolean }>(
      `/api/diagram-svg/${encodeURIComponent(drillId)}`
    );
    return {
      svg: response.data.svg || null,
      cooldown: Boolean(response.data.cooldown),
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function generateDrillDiagramSvg(
  drillId: string,
  options?: { force?: boolean; goalsAvailable?: number }
): Promise<{ svg: string | null }> {
  try {
    const response = await api.post<{ svg?: string; error?: string }>('/api/diagram-svg/generate', {
      drillId,
      force: options?.force === true,
      goalsAvailable: options?.goalsAvailable,
    });
    return { svg: response.data.svg || null };
  } catch (error) {
    throw normalizeApiError(error);
  }
}
