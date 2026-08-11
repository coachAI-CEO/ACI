import { generateText, setMetricsContext, clearMetricsContext } from '../gemini';
import {
  buildClubPhilosophyAssistPrompt,
  PhilosophyAssistMode,
  PhilosophyStageKey,
} from '../prompts/club-philosophy-assist';
import { getClubPhilosophy } from './club-philosophy';

const MAX_OUT = 3500;

export async function assistClubPhilosophyStage(input: {
  clubId: string;
  stageKey: PhilosophyStageKey;
  mode: PhilosophyAssistMode;
  currentText: string;
  notes?: string | null;
  otherStages?: Partial<Record<PhilosophyStageKey, string | null>>;
}): Promise<{ text: string; clubName: string; gameModelId: string }> {
  const club = await getClubPhilosophy(input.clubId);
  if (!club) {
    throw new Error('Club not found');
  }

  const prompt = buildClubPhilosophyAssistPrompt({
    mode: input.mode,
    stageKey: input.stageKey,
    gameModelId: club.gameModelId,
    clubName: club.clubName,
    currentText: input.currentText,
    notes: input.notes,
    otherStages: {
      attackingOrganization:
        input.otherStages?.attackingOrganization ?? club.philosophy.attackingOrganization,
      defensiveTransition:
        input.otherStages?.defensiveTransition ?? club.philosophy.defensiveTransition,
      defensiveOrganization:
        input.otherStages?.defensiveOrganization ?? club.philosophy.defensiveOrganization,
      attackingTransition:
        input.otherStages?.attackingTransition ?? club.philosophy.attackingTransition,
      [input.stageKey]: input.currentText || club.philosophy[input.stageKey],
    },
  });

  setMetricsContext({
    operationType: 'club_philosophy_assist',
    artifactId: input.clubId,
    gameModelId: club.gameModelId,
  });

  try {
    const raw = await generateText(prompt, { timeout: 45000, retries: 0 });
    const text = cleanAssistOutput(raw);
    if (!text) {
      throw new Error('AI assistant returned empty text');
    }
    return {
      text: text.slice(0, MAX_OUT),
      clubName: club.clubName,
      gameModelId: club.gameModelId,
    };
  } finally {
    clearMetricsContext();
  }
}

function cleanAssistOutput(raw: string): string {
  let text = String(raw || '').trim();
  if (!text) return '';
  // Strip accidental fenced blocks / leading labels.
  text = text.replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/i, '');
  text = text.replace(/^["']|["']$/g, '');
  return text.trim();
}
