export type VaultDrillLite = {
  id: string;
  refCode: string;
  title: string;
  ageGroup?: string;
  gameModelId?: string;
  phase?: string;
  zone?: string;
  durationMin?: number;
};

export type DrillDeriveSessionLike = {
  id: string;
  ageGroup?: string;
  gameModelId?: string;
  phase?: string;
  zone?: string;
  json?: {
    drills?: Array<Record<string, unknown>>;
  };
};

export function deriveDrillsFromSessions(sessions: DrillDeriveSessionLike[]): VaultDrillLite[] {
  const byCode = new Map<string, VaultDrillLite>();

  for (const session of sessions) {
    const drills = session?.json?.drills;
    if (!Array.isArray(drills)) {
      continue;
    }

    for (const drill of drills) {
      const refCode = String((drill as any)?.refCode || '').trim();
      if (!refCode) {
        continue;
      }
      if (byCode.has(refCode)) {
        continue;
      }

      byCode.set(refCode, {
        id: String((drill as any)?.id || refCode),
        refCode,
        title: String((drill as any)?.title || 'Untitled Drill'),
        ageGroup: session.ageGroup,
        gameModelId: session.gameModelId,
        phase: (drill as any)?.phase || session.phase,
        zone: (drill as any)?.zone || session.zone,
        durationMin: Number((drill as any)?.durationMin || 0) || undefined,
      });
    }
  }

  return Array.from(byCode.values());
}
