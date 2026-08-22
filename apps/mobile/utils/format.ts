export function humanizeLabel(value: string): string {
  if (!value) return 'All';
  return value
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const GAME_MODEL_LABELS: Record<string, string> = {
  POSSESSION: 'Possession',
  PRESSING: 'Pressing',
  TRANSITION: 'Transition',
  COACHAI: 'Balanced model',
  ROCKLIN_FC: 'Rocklin FC',
};

const PHASE_LABELS: Record<string, string> = {
  ATTACKING: 'Attacking',
  DEFENDING: 'Defending',
  TRANSITION: 'Transition',
  TRANSITION_TO_ATTACK: 'Transition to Attack',
  TRANSITION_TO_DEFEND: 'Transition to Defend',
};

const ZONE_LABELS: Record<string, string> = {
  DEFENSIVE_THIRD: 'Defensive Third',
  MIDDLE_THIRD: 'Middle Third',
  ATTACKING_THIRD: 'Attacking Third',
};

const PLAYER_LEVEL_LABELS: Record<string, string> = {
  BEGINNER: 'Beginner',
  DEVELOPING: 'Developing',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  ELITE: 'Elite',
};

const COACH_LEVEL_LABELS: Record<string, string> = {
  USSF_D: 'USSF D',
  GRASSROOTS: 'USSF D',
  USSF_C: 'USSF C',
  USSF_B_PLUS: 'USSF B+',
};

export function formatGameModelLabel(value?: string | null): string {
  if (!value) return '—';
  return GAME_MODEL_LABELS[value] || humanizeLabel(value);
}

export function formatPhaseLabel(value?: string | null): string {
  if (!value) return '';
  return PHASE_LABELS[value] || humanizeLabel(value);
}

export function formatZoneLabel(value?: string | null): string {
  if (!value) return '';
  return ZONE_LABELS[value] || humanizeLabel(value);
}

export function formatPlayerLevelLabel(value?: string | null): string {
  if (!value) return '';
  return PLAYER_LEVEL_LABELS[value] || humanizeLabel(value);
}

export function formatCoachLevelLabel(value?: string | null): string {
  if (!value) return '';
  return COACH_LEVEL_LABELS[value] || humanizeLabel(value);
}

export function formatShortDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatPlanLabel(plan?: string | null, status?: string | null): string {
  const planLabel = plan ? humanizeLabel(plan) : '—';
  if (!status || status.toUpperCase() === plan?.toUpperCase()) {
    return planLabel;
  }
  return `${planLabel} · ${humanizeLabel(status)}`;
}
