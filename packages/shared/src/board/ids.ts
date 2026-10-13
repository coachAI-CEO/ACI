/**
 * Stable object ids for tactical-board diagrams.
 *
 * Pure functions, no DOM. Every arrow, area, label, ball, element and goal gets
 * an id so the editor can select/delete it and Play can match the same object
 * across sequence frames. Ids already present are kept.
 *
 * Previously `apps/web/src/lib/board-ids.ts`; that file is now a thin re-export.
 * The functions are generic so a caller that types its diagram with required ids
 * (the web editor) gets that same type back.
 */

import type { WebDiagramFrameLayers, WebDiagramSequenceFrame, WebDiagramV1 } from '../types/tactical-board';

type Layers = WebDiagramFrameLayers;
type WithOptionalId = { id?: string };

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

function stamp<T extends WithOptionalId>(
  prefix: string,
  items: T[] | undefined,
  inherit?: string[]
): Array<T & { id: string }> | undefined {
  if (!items?.length) return items as Array<T & { id: string }> | undefined;
  const used = new Set<string>();
  return items.map((item, i) => ({
    ...item,
    id: takeId(prefix, i, used, item.id, inherit?.[i]),
  }));
}

export type LayerIdInherit = Partial<
  Record<'arrows' | 'areas' | 'labels' | 'balls' | 'elements' | 'goals', string[]>
>;

export function ensureLayerObjectIds<T extends Layers>(layers: T, inherit?: LayerIdInherit): T {
  const l = layers as Layers & { elements?: WithOptionalId[]; goals?: WithOptionalId[] };
  return {
    ...layers,
    arrows: stamp('a', l.arrows || [], inherit?.arrows) ?? [],
    areas: stamp('z', l.areas || [], inherit?.areas) ?? [],
    labels: stamp('l', l.labels || [], inherit?.labels) ?? [],
    balls: stamp('b', l.balls, inherit?.balls),
    elements: stamp('el', l.elements, inherit?.elements),
    goals: stamp('goal', l.goals, inherit?.goals),
  } as T;
}

function idsOf(items: WithOptionalId[] | undefined): string[] {
  return (items || []).map((x) => x.id).filter((id): id is string => Boolean(id));
}

function inheritFrom(layers: Layers): LayerIdInherit {
  const l = layers as Layers & { elements?: WithOptionalId[]; goals?: WithOptionalId[] };
  return {
    arrows: idsOf(l.arrows),
    areas: idsOf(l.areas),
    labels: idsOf(l.labels),
    balls: idsOf(l.balls),
    elements: idsOf(l.elements),
    goals: idsOf(l.goals),
  };
}

/** Stamp missing ids. Across frames, a missing id inherits the same slot from frame 0 so Play can match. */
export function ensureDiagramObjectIds<T extends WebDiagramV1>(diagram: T): T {
  const root = ensureLayerObjectIds(diagram as unknown as Layers);
  const frames = diagram.sequence?.frames;
  if (!frames?.length) {
    return { ...diagram, ...root } as T;
  }

  const stamped: WebDiagramSequenceFrame[] = [];
  for (let i = 0; i < frames.length; i++) {
    const inherit = i === 0 ? inheritFrom(root) : inheritFrom(stamped[0]);
    stamped.push({
      ...frames[i],
      ...ensureLayerObjectIds(frames[i] as unknown as Layers, inherit),
      id: frames[i].id,
      title: frames[i].title,
      note: frames[i].note,
      durationMs: frames[i].durationMs,
    });
  }

  const active = stamped.find((f) => f.id === diagram.sequence?.activeFrameId) || stamped[0];
  const live = ensureLayerObjectIds(root, inheritFrom(active as unknown as Layers));

  return {
    ...diagram,
    ...live,
    sequence: {
      ...diagram.sequence!,
      frames: stamped,
    },
  } as T;
}
