import api, { normalizeApiError } from './api';
import type { GenerateFormState } from '../stores/generate.store';

export async function generateSession(form: GenerateFormState, generationId: string): Promise<any> {
  try {
    const response = await api.post('/ai/generate-session', {
      generationId,
      gameModelId: form.gameModelId,
      ageGroup: form.ageGroup,
      phase: form.phase,
      zone: form.zone,
      numbersMin: form.numbersMin,
      numbersMax: form.numbersMax,
      goalsAvailable: form.goalsAvailable,
      spaceConstraint: form.spaceConstraint,
      durationMin: form.durationMin,
      formationAttacking: form.formationAttacking,
      formationDefending: form.formationDefending,
      playerLevel: form.playerLevel,
      coachLevel: form.coachLevel,
      focus: form.phase,
    });

    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function cancelGeneration(generationId: string): Promise<void> {
  try {
    await api.post('/ai/cancel-generation', { generationId });
  } catch {
    // Best effort.
  }
}

export async function saveSessionToVault(sessionId: string): Promise<void> {
  try {
    await api.post(`/vault/sessions/${sessionId}/save`);
  } catch (error) {
    throw normalizeApiError(error);
  }
}
