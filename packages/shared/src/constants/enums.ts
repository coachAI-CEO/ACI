export type CoachLevel = 'USSF_D' | 'USSF_C' | 'USSF_B_PLUS';

export type GameModelId =
  | 'POSSESSION'
  | 'PRESSING'
  | 'TRANSITION'
  | 'COACHAI'
  | 'ROCKLIN_FC';

export type PlayerLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export const COACH_LEVELS: CoachLevel[] = ['USSF_D', 'USSF_C', 'USSF_B_PLUS'];

export const GAME_MODEL_IDS: GameModelId[] = [
  'POSSESSION',
  'PRESSING',
  'TRANSITION',
  'COACHAI',
  'ROCKLIN_FC',
];

export const GAME_MODEL_OPTIONS: Array<{ value: GameModelId; label: string }> = [
  { value: 'POSSESSION', label: 'Possession' },
  { value: 'PRESSING', label: 'Pressing' },
  { value: 'TRANSITION', label: 'Transition' },
  { value: 'COACHAI', label: 'CoachAI' },
  { value: 'ROCKLIN_FC', label: 'Rocklin FC' },
];

export function getScopedGameModelOptions(enforcedGameModelId: string | null | undefined) {
  if (!enforcedGameModelId) return GAME_MODEL_OPTIONS;
  return GAME_MODEL_OPTIONS.filter((option) => option.value === enforcedGameModelId);
}

export function normalizeCoachLevel(raw: string | null | undefined): CoachLevel {
  const value = String(raw || '').trim().toUpperCase();
  if (value === 'USSF_D' || value === 'D' || value === 'GRASSROOTS') return 'USSF_D';
  if (value === 'USSF_B_PLUS' || value === 'B+' || value === 'USSF_B+') return 'USSF_B_PLUS';
  return 'USSF_C';
}
