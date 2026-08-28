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

export const BOARD_SEQUENCE_MAX_FRAMES = 8;
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
    return {
      ...diagram,
      sequence: { frames, activeFrameId },
    };
  }

  const frame = layersToFrame(extractFrameLayers(diagram), { title: "Frame 1" });
  return {
    ...diagram,
    sequence: { frames: [frame], activeFrameId: frame.id },
  };
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

/** Interpolate players/balls between two frame layer sets. Arrows/labels snap at t>=1 or use `to`. */
export function interpolateLayers(
  from: DiagramFrameLayers,
  to: DiagramFrameLayers,
  t: number
): DiagramFrameLayers {
  const u = Math.max(0, Math.min(1, t));
  if (u >= 1) return clone(to);
  if (u <= 0) return clone(from);

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
  const ballCount = Math.max(fromBalls.length, toBalls.length);
  const balls = [];
  for (let i = 0; i < ballCount; i++) {
    const a = fromBalls[i] || toBalls[i];
    const b = toBalls[i] || fromBalls[i];
    if (!a || !b) continue;
    balls.push({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });
  }

  // Snap annotations mid-way for readability
  const snap = u < 0.5 ? from : to;
  return {
    players,
    balls,
    arrows: clone(snap.arrows || []) as DiagramArrow[],
    areas: clone(snap.areas || []) as DiagramArea[],
    labels: clone(snap.labels || []) as DiagramLabel[],
    goals: clone(snap.goals || []),
    coach: snap.coach ? clone(snap.coach) : undefined,
    cones: snap.cones ? clone(snap.cones) : undefined,
    elements: snap.elements ? clone(snap.elements) : undefined,
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
