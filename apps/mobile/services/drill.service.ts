import api, { normalizeApiError } from './api';
import type { GenerateFormState } from '../stores/generate.store';

export async function generateDrill(form: GenerateFormState): Promise<any> {
  try {
    const response = await api.post('/ai/generate-drill', {
      gameModelId: form.gameModelId,
      ageGroup: form.ageGroup,
      phase: form.phase,
      zone: form.zone,
      numbersMin: form.numbersMin,
      numbersMax: form.numbersMax,
      goalsAvailable: form.goalsAvailable,
      spaceConstraint: form.spaceConstraint,
      durationMin: form.durationMin,
      formationUsed: form.formationUsed,
      playerLevel: form.playerLevel,
      coachLevel: form.coachLevel,
    });

    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}
