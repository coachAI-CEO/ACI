import type {
  DiagramArea,
  DiagramArrow,
  DiagramFrameLayers,
  DiagramLabel,
  DiagramSequenceFrame,
  DiagramV1,
} from "../types/diagram";

export function newObjectId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function takeId(prefix: string, index: number, used: Set<string>, existing?: string, inherit?: string) {
  const candidates = [existing, inherit, `${prefix}-${index}`].filter(
    (v): v is string => Boolean(v && v.trim())
  );
  for (const c of candidates) {
    const id = c.trim().slice(0, 64);
    if (!used.has(id)) {
      used.add(id);
      return id;
    }
  }
  let id = newObjectId(prefix);
  while (used.has(id)) id = newObjectId(prefix);
  used.add(id);
  return id;
}

type MaybeId<T extends { id: string }> = Omit<T, "id"> & { id?: string };

function stampArrows(items: MaybeId<DiagramArrow>[], inherit?: string[]): DiagramArrow[] {
  const used = new Set<string>();
  return (items || []).map((item, i) => ({
    ...item,
    id: takeId("a", i, used, item.id, inherit?.[i]),
  }));
}

function stampAreas(items: MaybeId<DiagramArea>[], inherit?: string[]): DiagramArea[] {
  const used = new Set<string>();
  return (items || []).map((item, i) => ({
    ...item,
    id: takeId("z", i, used, item.id, inherit?.[i]),
  }));
}

function stampLabels(items: MaybeId<DiagramLabel>[], inherit?: string[]): DiagramLabel[] {
  const used = new Set<string>();
  return (items || []).map((item, i) => ({
    ...item,
    id: takeId("l", i, used, item.id, inherit?.[i]),
  }));
}

function stampBalls(
  items: Array<{ id?: string; x: number; y: number }> | undefined,
  inherit?: string[]
): Array<{ id: string; x: number; y: number }> | undefined {
  if (!items?.length) return items as Array<{ id: string; x: number; y: number }> | undefined;
  const used = new Set<string>();
  return items.map((item, i) => ({
    ...item,
    id: takeId("b", i, used, item.id, inherit?.[i]),
  }));
}

function stampElements<T extends { id?: string }>(items: T[] | undefined, inherit?: string[]) {
  if (!items?.length) return items;
  const used = new Set<string>();
  return items.map((item, i) => ({
    ...item,
    id: takeId("el", i, used, item.id, inherit?.[i]),
  }));
}

function stampGoals<T extends { id?: string }>(items: T[] | undefined, inherit?: string[]) {
  if (!items?.length) return items;
  const used = new Set<string>();
  return items.map((item, i) => ({
    ...item,
    id: takeId("goal", i, used, item.id, inherit?.[i]),
  }));
}

export function ensureLayerObjectIds(
  layers: DiagramFrameLayers,
  inherit?: Partial<Record<"arrows" | "areas" | "labels" | "balls" | "elements" | "goals", string[]>>
): DiagramFrameLayers {
  return {
    ...layers,
    arrows: stampArrows(layers.arrows || [], inherit?.arrows),
    areas: stampAreas(layers.areas || [], inherit?.areas),
    labels: stampLabels(layers.labels || [], inherit?.labels),
    balls: stampBalls(layers.balls, inherit?.balls),
    elements: stampElements(layers.elements, inherit?.elements),
    goals: stampGoals(layers.goals, inherit?.goals),
  };
}

function inheritFrom(layers: DiagramFrameLayers) {
  return {
    arrows: (layers.arrows || []).map((a) => a.id).filter((id): id is string => Boolean(id)),
    areas: (layers.areas || []).map((a) => a.id).filter((id): id is string => Boolean(id)),
    labels: (layers.labels || []).map((l) => l.id).filter((id): id is string => Boolean(id)),
    balls: (layers.balls || []).map((b) => b.id).filter((id): id is string => Boolean(id)),
    elements: (layers.elements || []).map((e) => e.id).filter((id): id is string => Boolean(id)),
    goals: (layers.goals || []).map((g) => g.id).filter((id): id is string => Boolean(id)),
  };
}

/** Stamp missing ids. Across frames, a missing id inherits the same slot from frame 0 so Play can match. */
export function ensureDiagramObjectIds(diagram: DiagramV1): DiagramV1 {
  const root = ensureLayerObjectIds(diagram);
  const frames = diagram.sequence?.frames;
  if (!frames?.length) {
    return { ...diagram, ...root };
  }

  const stamped: DiagramSequenceFrame[] = [];
  for (let i = 0; i < frames.length; i++) {
    const inherit = i === 0 ? inheritFrom(root) : inheritFrom(stamped[0]);
    stamped.push({
      ...frames[i],
      ...ensureLayerObjectIds(frames[i], inherit),
      id: frames[i].id,
      title: frames[i].title,
      note: frames[i].note,
      durationMs: frames[i].durationMs,
    });
  }

  const active =
    stamped.find((f) => f.id === diagram.sequence?.activeFrameId) || stamped[0];
  const live = ensureLayerObjectIds(root, inheritFrom(active));

  return {
    ...diagram,
    ...live,
    sequence: {
      ...diagram.sequence!,
      frames: stamped,
    },
  };
}
