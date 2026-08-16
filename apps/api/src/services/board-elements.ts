export const BOARD_ELEMENT_KINDS = ['mini-goal', 'cone', 'mannequin', 'pole'] as const;
export type BoardElementKind = (typeof BOARD_ELEMENT_KINDS)[number];

export type BoardElement = {
  id: string;
  kind: BoardElementKind;
  x: number;
  y: number;
  rotation?: number;
  color?: string;
  width?: number;
};

export const BOARD_ELEMENT_MAX = 40;

function clamp01to100(n: number) {
  return Math.max(0, Math.min(100, n));
}

export function parseBoardElementKind(raw: unknown): BoardElementKind | null {
  const t = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_ ]+/g, '-');
  if (t === 'mini-goal' || t === 'minigoal' || t === 'small-goal' || t === 'small' || t === 'gate') {
    return 'mini-goal';
  }
  if (t === 'cone' || t === 'marker' || t === 'disc') return 'cone';
  if (t === 'mannequin' || t === 'dummy' || t === 'manequin') return 'mannequin';
  if (t === 'pole' || t === 'stick' || t === 'flag' || t === 'pole-marker') return 'pole';
  return null;
}

function isMiniGoalType(type: unknown): boolean {
  return /^(small|mini|mini-?goal|gate)$/i.test(String(type || ''));
}

function pushElement(out: BoardElement[], seen: Set<string>, el: BoardElement): boolean {
  if (out.length >= BOARD_ELEMENT_MAX) return false;
  const key = `${el.kind}:${Math.round(el.x * 10)}:${Math.round(el.y * 10)}`;
  if (seen.has(el.id) || seen.has(key)) return true;
  seen.add(el.id);
  seen.add(key);
  out.push(el);
  return true;
}

/** Fold AI/legacy cones + SMALL goals into the drawable elements layer. */
export function mergePracticeElements(input: {
  elements?: unknown;
  cones?: unknown;
  goals?: unknown;
}): BoardElement[] {
  const out: BoardElement[] = [];
  const seen = new Set<string>();

  const rawElements = Array.isArray(input.elements) ? input.elements : [];
  for (const e of rawElements) {
    if (!e || typeof e !== 'object') continue;
    const row = e as Record<string, unknown>;
    const kind = parseBoardElementKind(row.kind ?? row.type);
    if (!kind || typeof row.x !== 'number' || typeof row.y !== 'number') continue;
    const rotation = typeof row.rotation === 'number' && Number.isFinite(row.rotation)
      ? ((row.rotation % 360) + 360) % 360
      : undefined;
    if (
      !pushElement(out, seen, {
        id: String(row.id || `el-${out.length + 1}`).slice(0, 64),
        kind,
        x: clamp01to100(row.x),
        y: clamp01to100(row.y),
        rotation,
        color: typeof row.color === 'string' ? row.color.slice(0, 32) : undefined,
        width: typeof row.width === 'number' && Number.isFinite(row.width) ? row.width : undefined,
      })
    ) {
      return out;
    }
  }

  const cones = Array.isArray(input.cones) ? input.cones : [];
  for (const c of cones) {
    if (!c || typeof c !== 'object') continue;
    const row = c as Record<string, unknown>;
    if (typeof row.x !== 'number' || typeof row.y !== 'number') continue;
    if (
      !pushElement(out, seen, {
        id: String(row.id || `cone-${out.length + 1}`).slice(0, 64),
        kind: 'cone',
        x: clamp01to100(row.x),
        y: clamp01to100(row.y),
        color: typeof row.color === 'string' ? row.color.slice(0, 32) : undefined,
      })
    ) {
      return out;
    }
  }

  const goals = Array.isArray(input.goals) ? input.goals : [];
  for (const g of goals) {
    if (!g || typeof g !== 'object') continue;
    const row = g as Record<string, unknown>;
    if (!isMiniGoalType(row.type) || typeof row.x !== 'number' || typeof row.y !== 'number') continue;
    if (
      !pushElement(out, seen, {
        id: String(row.id || `mini-${out.length + 1}`).slice(0, 64),
        kind: 'mini-goal',
        x: clamp01to100(row.x),
        y: clamp01to100(row.y),
        width: typeof row.width === 'number' && Number.isFinite(row.width) ? row.width : undefined,
      })
    ) {
      return out;
    }
  }

  return out;
}

export function conesFromElements(elements: BoardElement[] | undefined) {
  return (elements || [])
    .filter((e) => e.kind === 'cone')
    .map((e) => ({ x: e.x, y: e.y, color: e.color }));
}
