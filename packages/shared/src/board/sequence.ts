/**
 * Shared sequence-timeline helpers for the tactical board.
 *
 * Pure functions on `DiagramV1` (canonical types from
 * `@aci/shared/types/tactical-board`). No DOM, no React, no I/O. Safe to
 * import from the web editor, the API, and the future mobile editor.
 *
 * Previously lived at `apps/web/src/lib/board-sequence.ts`; that file is
 * now a thin re-export.
 */

import type {
  WebDiagramArrow,
  WebDiagramArea,
  WebDiagramFrameLayers,
  WebDiagramLabel,
  WebDiagramPlayer,
  WebDiagramSequence,
  WebDiagramSequenceFrame,
  WebDiagramV1,
} from "../types/tactical-board";

// Local type aliases for readability within this module.
type DiagramArrow = WebDiagramArrow;
type DiagramArea = WebDiagramArea;
type DiagramFrameLayers = WebDiagramFrameLayers;
type DiagramLabel = WebDiagramLabel;
type DiagramPlayer = WebDiagramPlayer;
type DiagramSequence = WebDiagramSequence;
type DiagramSequenceFrame = WebDiagramSequenceFrame;
type DiagramV1 = WebDiagramV1;

import { ensureDiagramObjectIds } from "./ids";

export const BOARD_SEQUENCE_MAX_FRAMES = 12;
export const BOARD_SEQUENCE_DEFAULT_DURATION_MS = 1600;
export const BOARD_SEQUENCE_TWEEN_MS = 420;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function newFrameId() {
  return `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function extractFrameLayers(diagram: DiagramV1 | DiagramFrameLayers): DiagramFrameLayers {
  return {
    players: clone(diagram.players || []),
    arrows: clone(diagram.arrows || []),
    areas: clone(diagram.areas || []),
    labels: clone(diagram.labels || []),
    balls: clone(diagram.balls || []),
    goals: clone(diagram.goals || []),
    coach: diagram.coach ? clone(diagram.coach) : undefined,
    cones: diagram.cones ? clone(diagram.cones) : undefined,
    elements: diagram.elements ? clone(diagram.elements) : undefined,
  };
}

export function applyFrameLayers(diagram: DiagramV1, layers: DiagramFrameLayers): DiagramV1 {
  return {
    ...diagram,
    players: clone(layers.players || []),
    arrows: clone(layers.arrows || []),
    areas: clone(layers.areas || []),
    labels: clone(layers.labels || []),
    balls: clone(layers.balls || []),
    goals: clone(layers.goals || []),
    coach: layers.coach ? clone(layers.coach) : undefined,
    cones: layers.cones ? clone(layers.cones) : undefined,
    elements: layers.elements ? clone(layers.elements) : undefined,
  };
}

export function layersToFrame(
  layers: DiagramFrameLayers,
  meta?: Partial<Pick<DiagramSequenceFrame, "id" | "title" | "note" | "durationMs">>
): DiagramSequenceFrame {
  const cloned = clone(layers);
  return {
    players: cloned.players || [],
    arrows: cloned.arrows || [],
    areas: cloned.areas || [],
    labels: cloned.labels || [],
    balls: cloned.balls,
    goals: cloned.goals,
    coach: cloned.coach,
    cones: cloned.cones,
    elements: cloned.elements,
    id: meta?.id || newFrameId(),
    title: meta?.title,
    note: meta?.note,
    durationMs: meta?.durationMs ?? BOARD_SEQUENCE_DEFAULT_DURATION_MS,
  };
}

export function ensureSequence(diagram: DiagramV1): DiagramV1 {
  const existing = diagram.sequence;
  if (existing?.frames?.length) {
    const frames = existing.frames.slice(0, BOARD_SEQUENCE_MAX_FRAMES);
    const activeFrameId =
      frames.find((f) => f.id === existing.activeFrameId)?.id || frames[0].id;
    // Do not clobber root layers — they are the live working copy of the active frame.
    return ensureDiagramObjectIds({
      ...diagram,
      sequence: { frames, activeFrameId },
    });
  }

  const frame = layersToFrame(extractFrameLayers(diagram), { title: "Frame 1" });
  return ensureDiagramObjectIds({
    ...diagram,
    sequence: { frames: [frame], activeFrameId: frame.id },
  });
}

export function syncActiveFrame(diagram: DiagramV1): DiagramV1 {
  const withSeq = ensureSequence(diagram);
  const frames = withSeq.sequence!.frames.map((f) =>
    f.id === withSeq.sequence!.activeFrameId
      ? {
          ...f,
          ...extractFrameLayers(withSeq),
          id: f.id,
          title: f.title,
          note: f.note,
          durationMs: f.durationMs ?? BOARD_SEQUENCE_DEFAULT_DURATION_MS,
        }
      : f
  );
  return { ...withSeq, sequence: { ...withSeq.sequence!, frames } };
}

export function getActiveFrameIndex(diagram: DiagramV1): number {
  const seq = ensureSequence(diagram).sequence!;
  const idx = seq.frames.findIndex((f) => f.id === seq.activeFrameId);
  return idx >= 0 ? idx : 0;
}

export function selectFrame(diagram: DiagramV1, frameId: string): DiagramV1 {
  const synced = syncActiveFrame(diagram);
  const frame = synced.sequence!.frames.find((f) => f.id === frameId);
  if (!frame) return synced;
  return applyFrameLayers(
    { ...synced, sequence: { ...synced.sequence!, activeFrameId: frameId } },
    frame
  );
}

export function selectFrameByIndex(diagram: DiagramV1, index: number): DiagramV1 {
  const synced = syncActiveFrame(diagram);
  const frames = synced.sequence!.frames;
  const clamped = Math.max(0, Math.min(frames.length - 1, index));
  return selectFrame(synced, frames[clamped].id);
}

export function duplicateActiveFrame(diagram: DiagramV1): DiagramV1 {
  const synced = syncActiveFrame(diagram);
  const seq = synced.sequence!;
  if (seq.frames.length >= BOARD_SEQUENCE_MAX_FRAMES) return synced;
  const idx = getActiveFrameIndex(synced);
  const source = seq.frames[idx];
  const copy = layersToFrame(source, {
    title: source.title ? `${source.title} (copy)` : `Frame ${seq.frames.length + 1}`,
    note: source.note,
    durationMs: source.durationMs,
  });
  const frames = [...seq.frames.slice(0, idx + 1), copy, ...seq.frames.slice(idx + 1)];
  return applyFrameLayers(
    { ...synced, sequence: { frames, activeFrameId: copy.id } },
    copy
  );
}

export function deleteActiveFrame(diagram: DiagramV1): DiagramV1 {
  const synced = syncActiveFrame(diagram);
  const seq = synced.sequence!;
  if (seq.frames.length <= 1) return synced;
  const idx = getActiveFrameIndex(synced);
  const frames = seq.frames.filter((_, i) => i !== idx);
  const nextIdx = Math.min(idx, frames.length - 1);
  const next = frames[nextIdx];
  return applyFrameLayers(
    { ...synced, sequence: { frames, activeFrameId: next.id } },
    next
  );
}

export function updateActiveFrameMeta(
  diagram: DiagramV1,
  patch: Partial<Pick<DiagramSequenceFrame, "title" | "note" | "durationMs">>
): DiagramV1 {
  const synced = syncActiveFrame(diagram);
  const frames = synced.sequence!.frames.map((f) =>
    f.id === synced.sequence!.activeFrameId ? { ...f, ...patch } : f
  );
  return { ...synced, sequence: { ...synced.sequence!, frames } };
}

export function renameFramesSequentially(diagram: DiagramV1): DiagramV1 {
  const synced = syncActiveFrame(diagram);
  const frames = synced.sequence!.frames.map((f, i) => ({
    ...f,
    title: f.title?.trim() ? f.title : `Frame ${i + 1}`,
  }));
  return { ...synced, sequence: { ...synced.sequence!, frames } };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerpPoint(
  a: { x?: number; y?: number } | undefined,
  b: { x?: number; y?: number } | undefined,
  t: number
): { x: number; y: number } | undefined {
  if (!a || typeof a.x !== "number" || typeof a.y !== "number") {
    return b && typeof b.x === "number" && typeof b.y === "number" ? { x: b.x, y: b.y } : undefined;
  }
  if (!b || typeof b.x !== "number" || typeof b.y !== "number") return { x: a.x, y: a.y };
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function interpolateArrow(from: DiagramArrow, to: DiagramArrow | undefined, t: number): DiagramArrow {
  if (!to) return clone(from);
  const linked = Boolean(from.from.playerId || from.to.playerId || to.from.playerId || to.to.playerId);
  if (linked) {
    // Keep from-frame refs so player-linked arrows ride interpolated shirts (rails).
    return clone(from);
  }
  return {
    ...to,
    id: from.id || to.id,
    from: lerpPoint(from.from, to.from, t) || to.from,
    to: lerpPoint(from.to, to.to, t) || to.to,
    control: from.control || to.control ? lerpPoint(from.control, to.control, t) : undefined,
    path:
      from.path && to.path && from.path.length === to.path.length
        ? from.path.map((p, i) => lerpPoint(p, to.path![i], t) || p)
        : from.path,
  };
}

/** Interpolate players/balls between two frame layer sets. Linked arrows ride shirts. */
export function interpolateLayers(
  from: DiagramFrameLayers,
  to: DiagramFrameLayers,
  t: number
): DiagramFrameLayers {
  const raw = Math.max(0, Math.min(1, t));
  const u = easeInOut(raw);
  if (raw >= 1) return clone(to);
  if (raw <= 0) return clone(from);

  const toPlayersById = new Map(to.players.map((p) => [p.id, p]));
  const players: DiagramPlayer[] = from.players.map((p) => {
    const dest = toPlayersById.get(p.id);
    if (!dest) return { ...p };
    return {
      ...dest,
      x: lerp(p.x, dest.x, u),
      y: lerp(p.y, dest.y, u),
    };
  });
  // Appear players that only exist on `to`
  for (const p of to.players) {
    if (!from.players.some((f) => f.id === p.id)) players.push({ ...p });
  }

  const fromBalls = from.balls || [];
  const toBalls = to.balls || [];
  const toBallsById = new Map(toBalls.filter((b) => b.id).map((b) => [b.id, b]));
  const seenBalls = new Set<string>();
  const balls = fromBalls.map((a, i) => {
    const dest = (a.id && toBallsById.get(a.id)) || toBalls[i];
    if (a.id) seenBalls.add(a.id);
    if (!dest) return { ...a };
    return {
      ...dest,
      id: a.id || dest.id,
      x: lerp(a.x, dest.x, u),
      y: lerp(a.y, dest.y, u),
    };
  });
  for (const b of toBalls) {
    if (b.id && !seenBalls.has(b.id) && !fromBalls.some((a) => a.id === b.id)) {
      balls.push({ ...b });
    }
  }

  const fromArrows = from.arrows || [];
  const toArrows = to.arrows || [];
  const toArrowsById = new Map(toArrows.filter((a) => a.id).map((a) => [a.id, a]));
  const seenArrows = new Set<string>();
  const arrows: DiagramArrow[] = fromArrows.map((a, i) => {
    if (a.id) seenArrows.add(a.id);
    return interpolateArrow(a, (a.id && toArrowsById.get(a.id)) || toArrows[i], u);
  });
  for (const a of toArrows) {
    if (a.id && !seenArrows.has(a.id) && !fromArrows.some((f) => f.id === a.id)) {
      arrows.push(clone(a));
    }
  }

  const fromAreas = from.areas || [];
  const toAreas = to.areas || [];
  const toAreasById = new Map(toAreas.filter((a) => a.id).map((a) => [a.id, a]));
  const seenAreas = new Set<string>();
  const areas: DiagramArea[] = fromAreas.map((a, i) => {
    const dest = (a.id && toAreasById.get(a.id)) || toAreas[i];
    if (a.id) seenAreas.add(a.id);
    if (!dest) return clone(a);
    if (typeof a.x !== "number" || typeof dest.x !== "number") return u < 0.5 ? clone(a) : clone(dest);
    return {
      ...dest,
      id: a.id || dest.id,
      x: lerp(a.x, dest.x, u),
      y: lerp(a.y ?? 0, dest.y ?? 0, u),
      width: lerp(a.width ?? dest.width ?? 10, dest.width ?? a.width ?? 10, u),
      height: lerp(a.height ?? dest.height ?? 10, dest.height ?? a.height ?? 10, u),
    };
  });
  for (const a of toAreas) {
    if (a.id && !seenAreas.has(a.id) && !fromAreas.some((f) => f.id === a.id)) areas.push(clone(a));
  }

  const fromLabels = from.labels || [];
  const toLabels = to.labels || [];
  const toLabelsById = new Map(toLabels.filter((l) => l.id).map((l) => [l.id, l]));
  const seenLabels = new Set<string>();
  const labels: DiagramLabel[] = fromLabels.map((a, i) => {
    const dest = (a.id && toLabelsById.get(a.id)) || toLabels[i];
    if (a.id) seenLabels.add(a.id);
    if (!dest) return { ...a };
    return {
      ...dest,
      id: a.id || dest.id,
      x: lerp(a.x, dest.x, u),
      y: lerp(a.y, dest.y, u),
    };
  });
  for (const l of toLabels) {
    if (l.id && !seenLabels.has(l.id) && !fromLabels.some((f) => f.id === l.id)) labels.push({ ...l });
  }

  const fromEls = from.elements || [];
  const toEls = to.elements || [];
  const toElsById = new Map(toEls.map((e) => [e.id, e]));
  const seenEls = new Set<string>();
  const elements = fromEls.map((a) => {
    seenEls.add(a.id);
    const dest = toElsById.get(a.id);
    if (!dest) return { ...a };
    return {
      ...dest,
      x: lerp(a.x, dest.x, u),
      y: lerp(a.y, dest.y, u),
    };
  });
  for (const e of toEls) {
    if (!seenEls.has(e.id)) elements.push({ ...e });
  }

  return {
    players,
    balls,
    arrows,
    areas,
    labels,
    goals: clone((u < 0.5 ? from : to).goals || []),
    coach: (u < 0.5 ? from : to).coach ? clone((u < 0.5 ? from : to).coach) : undefined,
    cones: (u < 0.5 ? from : to).cones ? clone((u < 0.5 ? from : to).cones) : undefined,
    elements,
  };
}

export function getSequenceSummary(diagram: DiagramV1): {
  frameCount: number;
  activeIndex: number;
  activeTitle: string;
  activeNote?: string;
  frames: DiagramSequenceFrame[];
} {
  const d = ensureSequence(diagram);
  const idx = getActiveFrameIndex(d);
  const frames = d.sequence!.frames;
  const active = frames[idx];
  return {
    frameCount: frames.length,
    activeIndex: idx,
    activeTitle: active.title || `Frame ${idx + 1}`,
    activeNote: active.note,
    frames,
  };
}
