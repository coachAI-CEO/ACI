export function humanizeLabel(value: string): string {
  if (!value) return 'All';
  return value
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatPlanLabel(plan?: string | null, status?: string | null): string {
  const planLabel = plan ? humanizeLabel(plan) : '—';
  if (!status || status.toUpperCase() === plan?.toUpperCase()) {
    return planLabel;
  }
  return `${planLabel} · ${humanizeLabel(status)}`;
}
