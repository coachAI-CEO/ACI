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

/**
 * Long-form weekday + date for calendar day headers, e.g.
 * "Monday, Aug 4".
 */
export function formatLongDayDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Compact day header for week-strip cells, e.g. "Mon 4".
 */
export function formatCompactDay(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  return `${weekday} ${date.getDate()}`;
}

/**
 * Month label for the month-view header, e.g. "August 2026".
 */
export function formatMonthLabel(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Week-range label, e.g. "Aug 4–10" or "Aug 28 – Sep 3".
 */
export function formatWeekRangeLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endDay = end.getDate();
  if (sameMonth) return `${startFmt}–${endDay}`;
  const endFmt = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startFmt} – ${endFmt}`;
}

/**
 * Event time, e.g. "5:30 PM".
 */
export function formatEventTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * "Mon Aug 4 · 5:30 PM" combo for row previews.
 */
export function formatDateTimeLine(value?: string | null): string {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/**
 * Resolve the best display title for a calendar event, falling back
 * across session title → team → location → "Training event".
 */
export function formatEventTitle(
  event: { session?: { title?: string } | null; title?: string; teamName?: string; location?: string }
): string {
  return event.session?.title || event.title || event.teamName || event.location || 'Training event';
}

export function formatPlanLabel(plan?: string | null, status?: string | null): string {
  const planLabel = plan ? humanizeLabel(plan) : '—';
  if (!status || status.toUpperCase() === plan?.toUpperCase()) {
    return planLabel;
  }
  return `${planLabel} · ${humanizeLabel(status)}`;
}
