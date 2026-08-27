export type SidelineDrill = {
  id?: string;
  refCode?: string;
  title?: string;
  drillType?: string;
  durationMin?: number;
  phase?: string;
  zone?: string;
  description?: string;
  coachingPoints: string[];
  progressions: string[];
  setupSteps: string[];
  diagramSvg?: string | null;
  diagram?: any;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        return String(record.text || record.point || record.title || record.description || '').trim();
      }
      return String(item || '').trim();
    })
    .filter(Boolean);
}

export function extractSessionDrills(session: unknown): SidelineDrill[] {
  const root = asRecord(session);
  const json = asRecord(root.json);
  const candidates = [root.drills, json.drills, json.session?.drills, root.session?.drills];

  let rawDrills: any[] = [];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) {
      rawDrills = candidate;
      break;
    }
  }

  return rawDrills.map((drill, index) => {
    const item = asRecord(drill);
    const nested = asRecord(item.json);
    const organization = asRecord(item.organization || nested.organization);
    const coachingPoints = asList(
      item.coachingPoints || nested.coachingPoints || item.keyCoachingPoints || nested.keyCoachingPoints
    );
    const progressions = asList(item.progressions || nested.progressions);
    const setupSteps = asList(
      organization.setupSteps || item.setupSteps || nested.setupSteps || item.organizationSteps
    );

    return {
      id: item.id ? String(item.id) : undefined,
      refCode: item.refCode ? String(item.refCode) : undefined,
      title: String(item.title || nested.title || `Drill ${index + 1}`),
      drillType: String(item.drillType || nested.drillType || item.type || 'Practice'),
      durationMin: Number(item.durationMin || item.duration || nested.durationMin || nested.duration || 10) || 10,
      phase: item.phase || nested.phase ? String(item.phase || nested.phase) : undefined,
      zone: item.zone || nested.zone ? String(item.zone || nested.zone) : undefined,
      description: item.description || nested.description ? String(item.description || nested.description) : undefined,
      coachingPoints: coachingPoints.slice(0, 5),
      progressions: progressions.slice(0, 5),
      setupSteps: setupSteps.slice(0, 6),
      diagramSvg: (item.diagramSvg || nested.diagramSvg || null) as string | null,
      diagram: item.diagram || nested.diagram || null,
    };
  });
}

export function sessionHasUsableDrills(session: unknown): boolean {
  return extractSessionDrills(session).length > 0;
}

export function getSessionDisplayRef(session: unknown): string {
  const root = asRecord(session);
  return String(root.refCode || root.id || 'SESSION');
}
