import api, { normalizeApiError } from './api';
import type { GenerateFormState } from '../stores/generate.store';

export async function generateSeries(form: GenerateFormState): Promise<any> {
  try {
    const response = await api.post('/ai/generate-progressive-series', {
      baseInput: {
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
      },
      numberOfSessions: form.numberOfSessions,
    });

    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}
