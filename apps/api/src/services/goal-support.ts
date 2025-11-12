export function deriveGoalsSupported(json: any): number[] {
  const m = String(json?.goalMode || '').toUpperCase();
  if (m === 'LARGE') return [1];
  if (m === 'MINI2') return [2];
  return [];
}
