import api, { normalizeApiError } from './api';
import type { CoachLevel, GameModelId, PlayerLevel } from '@aci/shared';

export type VideoAnalysisContextInput = {
  ageGroup: string;
  playerLevel: PlayerLevel;
  coachLevel: CoachLevel;
  formationUsed: string;
  gameModelId: GameModelId;
  phase: 'ATTACKING' | 'DEFENDING' | 'TRANSITION';
  zone: 'DEFENSIVE_THIRD' | 'MIDDLE_THIRD' | 'ATTACKING_THIRD';
  focusTeamColor: 'blue' | 'red' | 'white' | 'black' | 'yellow' | 'green';
  opponentTeamColor: 'blue' | 'red' | 'white' | 'black' | 'yellow' | 'green';
  fileUri?: string;
  dryRun?: boolean;
};

export async function runVideoAnalysis(input: VideoAnalysisContextInput): Promise<any> {
  try {
    const response = await api.post('/ai/video-analysis/run', input);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function saveVideoAnalysis(payload: {
  title?: string;
  ageGroup: string;
  playerLevel: string;
  coachLevel: string;
  gameModelId: string;
  phase: string;
  zone: string;
  focusTeamColor: string;
  opponentTeamColor: string;
  sourceFileUri?: string;
  fileUriUsed?: string;
  model?: string;
  analysis: any;
  context?: Record<string, unknown>;
}): Promise<any> {
  try {
    const response = await api.post('/vault/video-analysis/save', payload);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function listVideoAnalyses(limit = 20): Promise<any[]> {
  try {
    const response = await api.get<{ ok: boolean; items: any[] }>('/vault/video-analysis', {
      params: { limit },
    });
    return response.data.items || [];
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function deleteVideoAnalysis(id: string): Promise<void> {
  try {
    await api.delete(`/vault/video-analysis/${id}`);
  } catch (error) {
    throw normalizeApiError(error);
  }
}
