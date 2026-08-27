import api, { normalizeApiError } from './api';

function toArrayBuffer(data: ArrayBuffer | string): ArrayBuffer {
  if (typeof data === 'string') {
    // Axios sometimes returns binary as latin1 string depending on transform.
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i += 1) bytes[i] = data.charCodeAt(i) & 0xff;
    return bytes.buffer;
  }
  return data;
}

export async function exportSessionPdf(session: Record<string, unknown>, format: 'full' | 'compact' = 'full'): Promise<ArrayBuffer> {
  try {
    const response = await api.post<ArrayBuffer>(
      '/ai/export-session-pdf',
      { session, format },
      { responseType: 'arraybuffer' }
    );
    return toArrayBuffer(response.data);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function exportDrillPdf(drill: Record<string, unknown>): Promise<ArrayBuffer> {
  try {
    const response = await api.post<ArrayBuffer>('/ai/export-drill-pdf', { drill }, { responseType: 'arraybuffer' });
    return toArrayBuffer(response.data);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function exportPlayerPlanPdf(planId: string, plan?: Record<string, unknown>): Promise<ArrayBuffer> {
  try {
    const response = await api.post<ArrayBuffer>(
      `/player-plans/${encodeURIComponent(planId)}/export-pdf`,
      plan ? { plan } : {},
      { responseType: 'arraybuffer' }
    );
    return toArrayBuffer(response.data);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/** Build a PDF-friendly session payload from vault or generate result shapes. */
export function sessionPayloadForPdf(session: any): Record<string, unknown> {
  const json = session?.json && typeof session.json === 'object' ? session.json : {};
  return {
    ...json,
    ...session,
    id: session?.id,
    title: session?.title || json.title,
    drills: session?.drills || json.drills || [],
    objectives: session?.objectives || json.objectives,
    coachingTheme: session?.coachingTheme || json.coachingTheme,
    ageGroup: session?.ageGroup || json.ageGroup,
    gameModelId: session?.gameModelId || json.gameModelId,
    durationMin: session?.durationMin || json.durationMin,
    refCode: session?.refCode || json.refCode,
  };
}
