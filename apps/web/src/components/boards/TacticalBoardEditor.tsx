"use client";

import * as React from "react";
import type {
  DiagramArea,
  DiagramArrow,
  DiagramLabel,
  DiagramPlayer,
  DiagramTeamCode,
  DiagramV1,
} from "@/types/diagram";
import type { BoardShareMode } from "@/lib/boards";
import {
  DEFAULT_FORMATIONS,
  FORMATIONS_BY_FORMAT,
  applyFormationToTeam,
  buildDefaultMatchDiagram,
  formationSize,
  playerCountOptions,
  type FormationId,
} from "@/lib/board-formations";
import {
  PITCH_FORMAT_OPTIONS,
  PITCH_SPECS,
  ballRadiusPx,
  layoutPitch,
  tokenRadiusPx,
  viewportFor,
  type PitchFormatId,
  type PitchLayout,
  type PitchMarkingSpec,
  type PitchViewport,
  type PitchZoom,
} from "@/lib/pitch-formats";
import ScaledPitchMarkings from "@/components/boards/ScaledPitchMarkings";
import BoardToolbar, {
  lineToolToArrow,
  type BoardTool,
} from "@/components/boards/BoardToolbar";
import {
  arrowHasHead,
  arrowPitchPolyline,
  buildPointRef,
  createLineArrow,
  curveBulgeSign,
  defaultCurveControl,
  eraseArrowAtIndex,
  findArrowIndexAtScreenPoint,
  flipCurveControl,
  polylineToPathD,
  resolveEndpoint,
  sampleQuadratic,
  shortenPolylineForTokens,
} from "@/lib/board-lines";
import type { LineGeometry } from "@/components/boards/BoardToolbar";

const WIDTH = 900;
const HEIGHT = 560;
const MARGIN = 28;
const UNDO_MAX = 50;
const MAX_BALLS = 8;

type Props = {
  diagram: DiagramV1;
  title: string;
  shareMode: BoardShareMode;
  canEdit: boolean;
  saving?: boolean;
  dirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onChange: (next: { diagram: DiagramV1; title: string; shareMode: BoardShareMode }) => void;
  onSave: () => void;
  onCopyLink?: () => void;
  onDelete?: () => void;
  statusMessage?: string | null;
};

type Selection =
  | { kind: "player"; id: string }
  | { kind: "ball"; index: number }
  | { kind: "arrow"; index: number }
  | null;

type DragTarget =
  | { kind: "player"; id: string; pointerId: number }
  | { kind: "ball"; index: number; pointerId: number }
  | { kind: "arrow-end"; index: number; end: "from" | "to"; pointerId: number }
  | {
      kind: "arrow-move";
      index: number;
      pointerId: number;
      startPos: { x: number; y: number };
      originFrom: { x: number; y: number };
      originTo: { x: number; y: number };
      originControl?: { x: number; y: number };
      originPath?: Array<{ x: number; y: number }>;
      undoRecorded?: boolean;
    };

type DrawDraft =
  | {
      mode: "line";
      from: { x: number; y: number; playerId?: string };
      to: { x: number; y: number; playerId?: string };
      meta: {
        type: DiagramArrow["type"];
        style: DiagramArrow["style"];
        weight: DiagramArrow["weight"];
        arrowhead: boolean;
        geometry: LineGeometry;
        curveBulge?: number;
      };
      path?: Array<{ x: number; y: number }>;
      control?: { x: number; y: number };
    }
  | {
      mode: "shape";
      shape: "rect" | "circle" | "spotlight";
      from: { x: number; y: number };
      to: { x: number; y: number };
    };

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function toScreen(
  p: { x: number; y: number },
  orientation: DiagramV1["pitch"]["orientation"],
  layout: PitchLayout,
  viewport: PitchViewport,
  spec: PitchMarkingSpec
) {
  const lengthYds = (clamp(p.y) / 100) * spec.lengthYards;
  const widthYds = (clamp(p.x) / 100) * spec.widthYards;
  const localLen = ((lengthYds - viewport.originLengthYds) / viewport.lengthYds) * 100;
  const localWid = ((widthYds - viewport.originWidthYds) / viewport.widthYds) * 100;

  if (orientation === "HORIZONTAL") {
    return {
      sx: layout.left + (localLen / 100) * layout.width,
      sy: layout.top + ((100 - localWid) / 100) * layout.height,
    };
  }
  return {
    sx: layout.left + (localWid / 100) * layout.width,
    sy: layout.top + (localLen / 100) * layout.height,
  };
}

function fromScreen(
  sx: number,
  sy: number,
  orientation: DiagramV1["pitch"]["orientation"],
  layout: PitchLayout,
  viewport: PitchViewport,
  spec: PitchMarkingSpec
) {
  const localLen = ((sx - layout.left) / layout.width) * 100;
  const localWidFromTop = ((sy - layout.top) / layout.height) * 100;

  if (orientation === "HORIZONTAL") {
    const lengthYds = viewport.originLengthYds + (localLen / 100) * viewport.lengthYds;
    const widthYds =
      viewport.originWidthYds + ((100 - localWidFromTop) / 100) * viewport.widthYds;
    return {
      x: clamp((widthYds / spec.widthYards) * 100),
      y: clamp((lengthYds / spec.lengthYards) * 100),
    };
  }

  const widthYds = viewport.originWidthYds + (localLen / 100) * viewport.widthYds;
  const lengthYds = viewport.originLengthYds + (localWidFromTop / 100) * viewport.lengthYds;
  return {
    x: clamp((widthYds / spec.widthYards) * 100),
    y: clamp((lengthYds / spec.lengthYards) * 100),
  };
}

function teamFill(team: DiagramTeamCode) {
  if (team === "ATT") return "#38bdf8";
  if (team === "DEF") return "#fb7185";
  return "#e5e7eb";
}

function arrowStroke(type: DiagramArrow["type"]) {
  if (type === "pass") return "#e5e7eb";
  if (type === "run") return "#22c55e";
  if (type === "press" || type === "cover") return "#f97316";
  return "#94a3b8";
}

function cloneDiagram(d: DiagramV1): DiagramV1 {
  return JSON.parse(JSON.stringify(d)) as DiagramV1;
}

function ensureArrays(d: DiagramV1): DiagramV1 {
  return {
    ...d,
    pitch: {
      variant: d.pitch?.variant || "FULL",
      orientation: d.pitch?.orientation || "HORIZONTAL",
      format: d.pitch?.format || "11V11",
      showZones: d.pitch?.showZones,
      zones: d.pitch?.zones,
    },
    players: Array.isArray(d.players) ? d.players : [],
    arrows: Array.isArray(d.arrows) ? d.arrows : [],
    areas: Array.isArray(d.areas) ? d.areas : [],
    labels: Array.isArray(d.labels) ? d.labels : [],
    balls: Array.isArray(d.balls) ? d.balls : [],
    goals: Array.isArray(d.goals) ? d.goals : [],
  };
}

function nextPlayerNumber(players: DiagramPlayer[]) {
  const used = new Set(players.map((p) => p.number).filter((n): n is number => typeof n === "number"));
  for (let n = 1; n <= 99; n++) {
    if (!used.has(n)) return n;
  }
  return players.length + 1;
}

function resolvePoint(
  ref: { playerId?: string; x?: number; y?: number },
  players: DiagramPlayer[],
  orientation: DiagramV1["pitch"]["orientation"],
  layout: PitchLayout,
  viewport: PitchViewport,
  spec: PitchMarkingSpec
) {
  if (ref.playerId) {
    const p = players.find((pl) => pl.id === ref.playerId);
    if (p) return toScreen(p, orientation, layout, viewport, spec);
  }
  if (typeof ref.x === "number" && typeof ref.y === "number") {
    return toScreen({ x: ref.x, y: ref.y }, orientation, layout, viewport, spec);
  }
  return null;
}

function dist(a: { sx: number; sy: number }, b: { sx: number; sy: number }) {
  const dx = a.sx - b.sx;
  const dy = a.sy - b.sy;
  return Math.sqrt(dx * dx + dy * dy);
}

function findNearestPlayer(
  sx: number,
  sy: number,
  players: DiagramPlayer[],
  orientation: DiagramV1["pitch"]["orientation"],
  layout: PitchLayout,
  viewport: PitchViewport,
  spec: PitchMarkingSpec,
  hitR: number
) {
  let best: { id: string; d: number } | null = null;
  for (const p of players) {
    const s = toScreen(p, orientation, layout, viewport, spec);
    const d = dist(s, { sx, sy });
    if (d <= hitR * 1.35 && (!best || d < best.d)) best = { id: p.id, d };
  }
  return best?.id || null;
}

function normalizeArea(from: { x: number; y: number }, to: { x: number; y: number }): DiagramArea {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const width = Math.abs(to.x - from.x);
  const height = Math.abs(to.y - from.y);
  return { x, y, width, height };
}

export default function TacticalBoardEditor({
  diagram: diagramProp,
  title,
  shareMode,
  canEdit,
  saving,
  dirty,
  onDirtyChange,
  onChange,
  onSave,
  onCopyLink,
  onDelete,
  statusMessage,
}: Props) {
  const [diagram, setDiagram] = React.useState(() => ensureArrays(cloneDiagram(diagramProp)));
  const diagramRef = React.useRef(diagram);
  diagramRef.current = diagram;
  const [selection, setSelection] = React.useState<Selection>(null);
  const [tool, setTool] = React.useState<BoardTool>("select");
  const [addTeam, setAddTeam] = React.useState<DiagramTeamCode>("ATT");
  const format = (diagram.pitch?.format || "11V11") as PitchFormatId;
  const [homeFormation, setHomeFormation] = React.useState<FormationId>(
    () => DEFAULT_FORMATIONS[format].home
  );
  const [awayFormation, setAwayFormation] = React.useState<FormationId>(
    () => DEFAULT_FORMATIONS[format].away
  );
  /** Per-side player cap; "all" = full formation. */
  const [playersPerSide, setPlayersPerSide] = React.useState<number | "all">("all");
  const undoStack = React.useRef<DiagramV1[]>([]);
  const skipPropSync = React.useRef(false);
  const dragRef = React.useRef<DragTarget | null>(null);
  const pendingPos = React.useRef<{ kind: "player" | "ball"; idOrIndex: string | number; x: number; y: number } | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [draft, setDraft] = React.useState<DrawDraft | null>(null);
  const draftRef = React.useRef<DrawDraft | null>(null);
  draftRef.current = draft;

  React.useEffect(() => {
    if (skipPropSync.current) {
      skipPropSync.current = false;
      return;
    }
    if (dirty) return;
    setDiagram(ensureArrays(cloneDiagram(diagramProp)));
  }, [diagramProp, dirty]);

  const orientation = diagram.pitch?.orientation || "HORIZONTAL";
  const pitchVariant = (diagram.pitch?.variant || "FULL") as PitchZoom;
  const viewport = viewportFor(format, pitchVariant);
  const layout = layoutPitch(WIDTH, HEIGHT, MARGIN, viewport);
  const hitR = tokenRadiusPx(layout, PITCH_SPECS[format].lengthYards);
  const ballR = ballRadiusPx(hitR);
  const formationOptions = FORMATIONS_BY_FORMAT[format];
  const spec = PITCH_SPECS[format];

  const pushUndo = React.useCallback((prev: DiagramV1) => {
    undoStack.current.push(cloneDiagram(prev));
    if (undoStack.current.length > UNDO_MAX) undoStack.current.shift();
  }, []);

  const commitDiagram = React.useCallback(
    (next: DiagramV1, opts?: { recordUndo?: boolean; from?: DiagramV1 }) => {
      if (!canEdit) return;
      if (opts?.recordUndo !== false) {
        pushUndo(opts?.from ?? diagram);
      }
      const normalized = ensureArrays(next);
      skipPropSync.current = true;
      setDiagram(normalized);
      onDirtyChange(true);
      onChange({ diagram: normalized, title, shareMode });
    },
    [canEdit, diagram, onChange, onDirtyChange, pushUndo, shareMode, title]
  );

  const undo = React.useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    skipPropSync.current = true;
    setDiagram(ensureArrays(prev));
    onDirtyChange(true);
    onChange({ diagram: ensureArrays(prev), title, shareMode });
  }, [onChange, onDirtyChange, shareMode, title]);

  React.useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
      }
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
      if ((e.key === "Backspace" || e.key === "Delete") && tool === "select" && selection) {
        e.preventDefault();
        if (selection.kind === "player") {
          const id = selection.id;
          commitDiagram({
            ...diagram,
            players: diagram.players.filter((p) => p.id !== id),
            arrows: diagram.arrows.filter((a) => a.from.playerId !== id && a.to.playerId !== id),
          });
        } else if (selection.kind === "arrow") {
          commitDiagram({
            ...diagram,
            arrows: eraseArrowAtIndex(diagram.arrows, selection.index),
          });
        } else if (selection.kind === "ball") {
          commitDiagram({
            ...diagram,
            balls: (diagram.balls || []).filter((_, j) => j !== selection.index),
          });
        }
        setSelection(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit, commitDiagram, diagram, onSave, selection, tool, undo]);

  React.useEffect(() => {
    if (!canEdit || !dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [canEdit, dirty]);

  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { sx: 0, sy: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { sx: 0, sy: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { sx: local.x, sy: local.y };
  };

  const flushDrag = () => {
    rafRef.current = null;
    const pending = pendingPos.current;
    if (!pending) return;
    pendingPos.current = null;
    const prev = diagramRef.current;
    let next: DiagramV1;
    if (pending.kind === "player") {
      next = {
        ...prev,
        players: prev.players.map((p) =>
          p.id === pending.idOrIndex ? { ...p, x: pending.x, y: pending.y } : p
        ),
      };
    } else {
      const balls = [...(prev.balls || [])];
      const idx = pending.idOrIndex as number;
      if (!balls[idx]) return;
      balls[idx] = { x: pending.x, y: pending.y };
      next = { ...prev, balls };
    }
    diagramRef.current = next;
    skipPropSync.current = true;
    setDiagram(next);
    onDirtyChange(true);
    onChange({ diagram: next, title, shareMode });
  };

  const applyArrowLive = (
    index: number,
    from: DiagramArrow["from"],
    to: DiagramArrow["to"],
    extras?: Partial<Pick<DiagramArrow, "control" | "path">>
  ) => {
    const prev = diagramRef.current;
    const next: DiagramV1 = {
      ...prev,
      arrows: prev.arrows.map((a, i) => (i === index ? { ...a, from, to, ...extras } : a)),
    };
    diagramRef.current = next;
    skipPropSync.current = true;
    setDiagram(next);
    onDirtyChange(true);
    onChange({ diagram: next, title, shareMode });
  };

  const eraseAt = (sx: number, sy: number) => {
    const hit = Math.max(12, hitR * 1.5);
    const screenOf = (p: { x: number; y: number }) =>
      toScreen(p, orientation, layout, viewport, spec);

    // Lines first — erase individual arrows by clicking anywhere along the stroke
    const arrowIdx = findArrowIndexAtScreenPoint(
      diagram.arrows,
      diagram.players,
      sx,
      sy,
      screenOf,
      hit
    );
    if (arrowIdx >= 0) {
      commitDiagram({
        ...diagram,
        arrows: eraseArrowAtIndex(diagram.arrows, arrowIdx),
      });
      return;
    }

    // labels
    for (let i = 0; i < (diagram.labels || []).length; i++) {
      const l = diagram.labels[i];
      const s = toScreen(l, orientation, layout, viewport, spec);
      if (dist(s, { sx, sy }) <= hit * 1.2) {
        commitDiagram({
          ...diagram,
          labels: diagram.labels.filter((_, j) => j !== i),
        });
        return;
      }
    }
    // areas
    for (let i = 0; i < (diagram.areas || []).length; i++) {
      const area = diagram.areas[i];
      if (typeof area.x !== "number" || typeof area.y !== "number") continue;
      const w = area.width ?? 10;
      const h = area.height ?? 10;
      const c = toScreen({ x: area.x + w / 2, y: area.y + h / 2 }, orientation, layout, viewport, spec);
      if (dist(c, { sx, sy }) <= Math.max(hit, 18)) {
        commitDiagram({
          ...diagram,
          areas: diagram.areas.filter((_, j) => j !== i),
        });
        return;
      }
    }
    // balls
    for (let i = 0; i < (diagram.balls || []).length; i++) {
      const b = diagram.balls![i];
      const s = toScreen(b, orientation, layout, viewport, spec);
      if (dist(s, { sx, sy }) <= ballR * 1.6) {
        commitDiagram({
          ...diagram,
          balls: (diagram.balls || []).filter((_, j) => j !== i),
        });
        return;
      }
    }
    // players last
    for (const p of diagram.players) {
      const s = toScreen(p, orientation, layout, viewport, spec);
      if (dist(s, { sx, sy }) <= hit) {
        commitDiagram({
          ...diagram,
          players: diagram.players.filter((x) => x.id !== p.id),
          arrows: diagram.arrows.filter((a) => a.from.playerId !== p.id && a.to.playerId !== p.id),
        });
        return;
      }
    }
  };

  const startLineDraft = (
    e: React.PointerEvent,
    from: { x: number; y: number; playerId?: string },
    meta: NonNullable<ReturnType<typeof lineToolToArrow>>
  ) => {
    const next: DrawDraft = {
      mode: "line",
      from,
      to: { ...from },
      meta,
      path: meta.geometry === "freehand" ? [{ x: from.x, y: from.y }] : undefined,
      control:
        meta.geometry === "curve"
          ? defaultCurveControl(from, from, meta.curveBulge ?? 0.28)
          : undefined,
    };
    draftRef.current = next;
    setDraft(next);
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPlayerPointerDown = (e: React.PointerEvent, id: string) => {
    if (!canEdit) return;
    e.stopPropagation();
    e.preventDefault();

    const player = diagram.players.find((p) => p.id === id);
    if (!player) return;

    if (tool === "eraser") {
      // Prefer erasing a line that ends on this player if click is near a stroke
      const { sx, sy } = clientToSvg(e.clientX, e.clientY);
      eraseAt(sx, sy);
      return;
    }

    const lineMeta = lineToolToArrow(tool);
    if (lineMeta) {
      startLineDraft(e, { x: player.x, y: player.y, playerId: id }, lineMeta);
      return;
    }

    if (tool !== "select") return;

    setSelection({ kind: "player", id });
    pushUndo(diagram);
    dragRef.current = { kind: "player", id, pointerId: e.pointerId };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onBallPointerDown = (e: React.PointerEvent, index: number) => {
    if (!canEdit) return;
    e.stopPropagation();
    e.preventDefault();

    if (tool === "eraser") {
      commitDiagram({
        ...diagram,
        balls: (diagram.balls || []).filter((_, j) => j !== index),
      });
      return;
    }

    if (tool !== "select") return;

    setSelection({ kind: "ball", index });
    pushUndo(diagram);
    dragRef.current = { kind: "ball", index, pointerId: e.pointerId };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onSvgPointerMove = (e: React.PointerEvent) => {
    const { sx, sy } = clientToSvg(e.clientX, e.clientY);
    const pos = fromScreen(sx, sy, orientation, layout, viewport, spec);

    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      if (drag.kind === "player") {
        pendingPos.current = { kind: "player", idOrIndex: drag.id, x: pos.x, y: pos.y };
        if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushDrag);
        return;
      }
      if (drag.kind === "ball") {
        pendingPos.current = { kind: "ball", idOrIndex: drag.index, x: pos.x, y: pos.y };
        if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushDrag);
        return;
      }
      if (drag.kind === "arrow-end") {
        const arrow = diagramRef.current.arrows[drag.index];
        if (!arrow) return;
        const near = findNearestPlayer(
          sx,
          sy,
          diagramRef.current.players,
          orientation,
          layout,
          viewport,
          spec,
          hitR * 1.75
        );
        const ref = buildPointRef(near, pos.x, pos.y);
        const nextFrom = drag.end === "from" ? ref : arrow.from;
        const nextTo = drag.end === "to" ? ref : arrow.to;
        const extras: Partial<Pick<DiagramArrow, "control" | "path">> = {};
        if (arrow.control) {
          const fromPt = resolveEndpoint(nextFrom, diagramRef.current.players) || pos;
          const toPt = resolveEndpoint(nextTo, diagramRef.current.players) || pos;
          const sign = curveBulgeSign(fromPt, toPt, arrow.control);
          extras.control = defaultCurveControl(
            drag.end === "from" ? pos : fromPt,
            drag.end === "to" ? pos : toPt,
            0.28 * sign
          );
        }
        applyArrowLive(drag.index, nextFrom, nextTo, extras);
        return;
      }
      if (drag.kind === "arrow-move") {
        const dx = pos.x - drag.startPos.x;
        const dy = pos.y - drag.startPos.y;
        if (Math.hypot(dx, dy) < 0.4) return;
        if (!drag.undoRecorded) {
          pushUndo(diagramRef.current);
          drag.undoRecorded = true;
        }
        const extras: Partial<Pick<DiagramArrow, "control" | "path">> = {};
        if (drag.originControl) {
          extras.control = {
            x: clamp(drag.originControl.x + dx),
            y: clamp(drag.originControl.y + dy),
          };
        }
        if (drag.originPath) {
          extras.path = drag.originPath.map((p) => ({
            x: clamp(p.x + dx),
            y: clamp(p.y + dy),
          }));
        }
        applyArrowLive(
          drag.index,
          { x: clamp(drag.originFrom.x + dx), y: clamp(drag.originFrom.y + dy) },
          { x: clamp(drag.originTo.x + dx), y: clamp(drag.originTo.y + dy) },
          extras
        );
        return;
      }
    }

    const d = draftRef.current;
    if (!d) return;
    const near = findNearestPlayer(
      sx,
      sy,
      diagram.players,
      orientation,
      layout,
      viewport,
      spec,
      hitR * 1.75
    );
    if (d.mode === "line") {
      if (d.meta.geometry === "freehand") {
        const prevPath = d.path || [{ x: d.from.x, y: d.from.y }];
        const last = prevPath[prevPath.length - 1];
        const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
        const path =
          dist >= 1.2 && prevPath.length < 100 ? [...prevPath, { x: pos.x, y: pos.y }] : prevPath;
        const next: DrawDraft = {
          ...d,
          to: { x: pos.x, y: pos.y, playerId: near || undefined },
          path,
        };
        draftRef.current = next;
        setDraft(next);
      } else if (d.meta.geometry === "curve") {
        const to = { x: pos.x, y: pos.y, playerId: near || undefined };
        const next: DrawDraft = {
          ...d,
          to,
          control: defaultCurveControl(d.from, to, d.meta.curveBulge ?? 0.28),
        };
        draftRef.current = next;
        setDraft(next);
      } else {
        const next: DrawDraft = {
          ...d,
          to: { x: pos.x, y: pos.y, playerId: near || undefined },
        };
        draftRef.current = next;
        setDraft(next);
      }
    } else {
      const next: DrawDraft = { ...d, to: pos };
      draftRef.current = next;
      setDraft(next);
    }
  };

  const finishDraft = () => {
    const d = draftRef.current;
    setDraft(null);
    draftRef.current = null;
    if (!d) return;

    const current = diagramRef.current;

    if (d.mode === "line") {
      if ((current.arrows || []).length >= 40) return;
      // Resolve sticky coords from live player positions when linked
      let fromX = d.from.x;
      let fromY = d.from.y;
      let toX = d.to.x;
      let toY = d.to.y;
      if (d.from.playerId) {
        const p = current.players.find((pl) => pl.id === d.from.playerId);
        if (p) {
          fromX = p.x;
          fromY = p.y;
        }
      }
      if (d.to.playerId) {
        const p = current.players.find((pl) => pl.id === d.to.playerId);
        if (p) {
          toX = p.x;
          toY = p.y;
        }
      }
      const arrow = createLineArrow({
        fromPlayerId: d.from.playerId,
        toPlayerId: d.to.playerId,
        fromX,
        fromY,
        toX,
        toY,
        type: d.meta.type,
        style: d.meta.style,
        weight: d.meta.weight,
        arrowhead: d.meta.arrowhead,
        control:
          d.meta.geometry === "curve"
            ? d.control ||
              defaultCurveControl({ x: fromX, y: fromY }, { x: toX, y: toY }, d.meta.curveBulge ?? 0.28)
            : undefined,
        path:
          d.meta.geometry === "freehand"
            ? [...(d.path || []), { x: toX, y: toY }].slice(0, 100)
            : undefined,
      });
      if (!arrow) return;
      commitDiagram({
        ...current,
        arrows: [...current.arrows, arrow],
      });
      return;
    }

    const area = normalizeArea(d.from, d.to);
    if ((area.width ?? 0) < 1.5 && (area.height ?? 0) < 1.5) return;
    if ((current.areas || []).length >= 20) return;
    commitDiagram({
      ...current,
      areas: [...(current.areas || []), { ...area, shape: d.shape }],
    });
  };

  const onSvgPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      if (drag.kind === "player" || drag.kind === "ball") {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          flushDrag();
        }
      }
      dragRef.current = null;
      return;
    }
    if (draftRef.current) finishDraft();
  };

  const beginArrowEndDrag = (e: React.PointerEvent, index: number, end: "from" | "to") => {
    e.stopPropagation();
    e.preventDefault();
    if (!canEdit || tool !== "select") return;
    setSelection({ kind: "arrow", index });
    pushUndo(diagramRef.current);
    dragRef.current = { kind: "arrow-end", index, end, pointerId: e.pointerId };
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const beginArrowMoveDrag = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canEdit || tool !== "select") return;
    const arrow = diagramRef.current.arrows[index];
    if (!arrow) return;
    const from = resolveEndpoint(arrow.from, diagramRef.current.players);
    const to = resolveEndpoint(arrow.to, diagramRef.current.players);
    if (!from || !to) return;
    const { sx, sy } = clientToSvg(e.clientX, e.clientY);
    const pos = fromScreen(sx, sy, orientation, layout, viewport, spec);
    setSelection({ kind: "arrow", index });
    dragRef.current = {
      kind: "arrow-move",
      index,
      pointerId: e.pointerId,
      startPos: pos,
      originFrom: { x: from.x, y: from.y },
      originTo: { x: to.x, y: to.y },
      originControl: arrow.control ? { ...arrow.control } : undefined,
      originPath: arrow.path ? arrow.path.map((p) => ({ ...p })) : undefined,
      undoRecorded: false,
    };
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPitchPointerDown = (e: React.PointerEvent) => {
    if (!canEdit) return;
    const { sx, sy } = clientToSvg(e.clientX, e.clientY);
    const pos = fromScreen(sx, sy, orientation, layout, viewport, spec);

    if (tool === "eraser") {
      eraseAt(sx, sy);
      return;
    }

    if (tool === "add-player") {
      if (diagram.players.length >= 30) return;
      const id = `p-${Date.now().toString(36)}`;
      const player: DiagramPlayer = {
        id,
        number: nextPlayerNumber(diagram.players),
        team: addTeam,
        role: "",
        x: pos.x,
        y: pos.y,
      };
      commitDiagram({ ...diagram, players: [...diagram.players, player] });
      setSelection({ kind: "player", id });
      setTool("select");
      return;
    }

    if (tool === "ball") {
      if ((diagram.balls || []).length >= MAX_BALLS) return;
      commitDiagram({
        ...diagram,
        balls: [...(diagram.balls || []), { x: pos.x, y: pos.y }],
      });
      setTool("select");
      return;
    }

    if (tool === "label") {
      if (diagram.labels.length >= 20) return;
      const text = window.prompt("Label text");
      if (!text?.trim()) return;
      const label: DiagramLabel = { text: text.trim().slice(0, 200), x: pos.x, y: pos.y };
      commitDiagram({ ...diagram, labels: [...diagram.labels, label] });
      setTool("select");
      return;
    }

    const lineMeta = lineToolToArrow(tool);
    if (lineMeta) {
      const near = findNearestPlayer(
        sx,
        sy,
        diagram.players,
        orientation,
        layout,
        viewport,
        spec,
        hitR * 1.75
      );
      startLineDraft(
        e,
        { x: pos.x, y: pos.y, playerId: near || undefined },
        lineMeta
      );
      return;
    }

    if (tool === "shape-rect" || tool === "shape-circle" || tool === "shape-spotlight") {
      const next: DrawDraft = {
        mode: "shape",
        shape:
          tool === "shape-rect" ? "rect" : tool === "shape-spotlight" ? "spotlight" : "circle",
        from: pos,
        to: pos,
      };
      draftRef.current = next;
      setDraft(next);
      svgRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }

    if (tool === "select") {
      setSelection(null);
    }
  };

  const setPitchVariant = (variant: PitchZoom) => {
    const nextPitch = {
      ...diagram.pitch,
      variant,
      orientation: "HORIZONTAL" as const,
      format,
    };
    if (playersPerSide === "all") {
      commitDiagram({ ...diagram, pitch: nextPitch });
      return;
    }
    const visibleY = visibleYFor(format, variant);
    const opts = { limit: playersPerSide, visibleY };
    let next: DiagramV1 = { ...diagram, pitch: nextPitch };
    next = applyFormationToTeam(next, "DEF", awayFormation, "away", opts);
    next = applyFormationToTeam(next, "ATT", homeFormation, "home", opts);
    commitDiagram(next);
  };

  const setPitchFormat = (nextFormat: PitchFormatId) => {
    const defaults = DEFAULT_FORMATIONS[nextFormat];
    setHomeFormation(defaults.home);
    setAwayFormation(defaults.away);
    setPlayersPerSide("all");
    commitDiagram(buildDefaultMatchDiagram(nextFormat));
  };

  const visibleYFor = (fmt: PitchFormatId, zoom: PitchZoom) => {
    const s = PITCH_SPECS[fmt];
    const vp = viewportFor(fmt, zoom);
    return {
      min: (vp.originLengthYds / s.lengthYards) * 100,
      max: ((vp.originLengthYds + vp.lengthYds) / s.lengthYards) * 100,
    };
  };

  const formationOpts = (visibleY?: { min: number; max: number }) => {
    const y = visibleY || visibleYFor(format, pitchVariant);
    return playersPerSide === "all" ? { visibleY: y } : { limit: playersPerSide, visibleY: y };
  };

  const applyHomeFormation = (id: FormationId) => {
    setHomeFormation(id);
    commitDiagram(applyFormationToTeam(diagram, "ATT", id, "home", formationOpts()));
  };

  const applyAwayFormation = (id: FormationId) => {
    setAwayFormation(id);
    commitDiagram(applyFormationToTeam(diagram, "DEF", id, "away", formationOpts()));
  };

  const setPlayersPerSideAndApply = (next: number | "all") => {
    setPlayersPerSide(next);
    const opts =
      next === "all"
        ? { visibleY: visibleYFor(format, pitchVariant) }
        : { limit: next, visibleY: visibleYFor(format, pitchVariant) };
    let d = applyFormationToTeam(diagram, "DEF", awayFormation, "away", opts);
    d = applyFormationToTeam(d, "ATT", homeFormation, "home", opts);
    commitDiagram(d);
  };

  const resetMatchSetup = () => {
    const defaults = DEFAULT_FORMATIONS[format];
    setHomeFormation(defaults.home);
    setAwayFormation(defaults.away);
    setPlayersPerSide("all");
    commitDiagram(buildDefaultMatchDiagram(format));
  };

  const selectedPlayer =
    selection?.kind === "player"
      ? diagram.players.find((p) => p.id === selection.id) || null
      : null;
  const selectedArrow =
    selection?.kind === "arrow" ? diagram.arrows[selection.index] || null : null;

  const renderArea = (area: DiagramArea, i: number, preview = false) => {
    if (typeof area.x !== "number" || typeof area.y !== "number") return null;
    const w = area.width ?? 0;
    const h = area.height ?? 0;
    const a = toScreen({ x: area.x, y: area.y }, orientation, layout, viewport, spec);
    const b = toScreen({ x: area.x + w, y: area.y + h }, orientation, layout, viewport, spec);
    const x = Math.min(a.sx, b.sx);
    const y = Math.min(a.sy, b.sy);
    const rw = Math.abs(b.sx - a.sx);
    const rh = Math.abs(b.sy - a.sy);
    const stroke = preview ? "#fbbf24" : "#fde68a";
    if (area.shape === "spotlight") {
      const gradId = `spotlight-grad-${i < 0 ? "draft" : i}`;
      const cx = x + rw / 2;
      const cy = y + rh / 2;
      const rx = rw / 2;
      const ry = rh / 2;
      return (
        <g key={`area-${i}`} className="pointer-events-none">
          <defs>
            <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff7c2" stopOpacity={preview ? 0.55 : 0.7} />
              <stop offset="45%" stopColor="#fde68a" stopOpacity={preview ? 0.28 : 0.38} />
              <stop offset="100%" stopColor="#fde68a" stopOpacity={0} />
            </radialGradient>
          </defs>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${gradId})`} />
          {preview ? (
            <ellipse
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill="none"
              stroke={stroke}
              strokeWidth={1.25}
              strokeDasharray="4 4"
              opacity={0.7}
            />
          ) : null}
        </g>
      );
    }
    if (area.shape === "circle") {
      return (
        <ellipse
          key={`area-${i}`}
          cx={x + rw / 2}
          cy={y + rh / 2}
          rx={rw / 2}
          ry={rh / 2}
          fill="rgba(253, 230, 138, 0.12)"
          stroke={stroke}
          strokeWidth={1.75}
          strokeDasharray={preview ? "4 4" : undefined}
          className="pointer-events-none"
        />
      );
    }
    return (
      <rect
        key={`area-${i}`}
        x={x}
        y={y}
        width={rw}
        height={rh}
        fill="rgba(253, 230, 138, 0.1)"
        stroke={stroke}
        strokeWidth={1.75}
        strokeDasharray={preview ? "4 4" : undefined}
        className="pointer-events-none"
      />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={title}
          disabled={!canEdit}
          onChange={(e) => {
            onDirtyChange(true);
            onChange({ diagram, title: e.target.value.slice(0, 120), shareMode });
          }}
          className="min-h-11 flex-1 min-w-[12rem] rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white/90 outline-none focus:border-emerald-500/40 disabled:opacity-60"
          placeholder="Board title"
        />
        {canEdit ? (
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="min-h-11 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 text-sm font-semibold text-emerald-100 disabled:opacity-40"
          >
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        ) : (
          <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-slate-400">
            View only
          </span>
        )}
        {onCopyLink ? (
          <button
            type="button"
            onClick={onCopyLink}
            className="min-h-11 rounded-xl border border-white/15 px-3 text-xs text-slate-300 hover:bg-white/5"
          >
            Copy link
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="min-h-11 rounded-xl border border-rose-500/30 px-3 text-xs text-rose-200 hover:bg-rose-500/10"
          >
            Delete
          </button>
        ) : null}
        <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-slate-300">
          <span>Share</span>
          <select
            value={shareMode}
            disabled={!canEdit}
            onChange={(e) => {
              onDirtyChange(true);
              onChange({
                diagram,
                title,
                shareMode: e.target.value as BoardShareMode,
              });
            }}
            className="bg-transparent outline-none disabled:opacity-50"
          >
            <option value="PRIVATE">Private</option>
            <option value="CLUB">Club</option>
          </select>
        </label>
      </div>

      {canEdit ? (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#07111f]/90 p-2 backdrop-blur">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Board
              </span>
              <div className="flex items-center gap-1.5">
                {PITCH_FORMAT_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setPitchFormat(f.id)}
                    title={`${f.ages} · ${PITCH_SPECS[f.id].lengthYards}×${PITCH_SPECS[f.id].widthYards} yds`}
                    className={`flex h-10 items-center rounded-lg border px-3 text-[12px] font-medium transition ${
                      format === f.id
                        ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                        : "border-white/10 bg-black/30 text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Zoom
              </span>
              <div className="flex items-center gap-1.5">
                {(["FULL", "HALF", "THIRD"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPitchVariant(v)}
                    className={`flex h-10 items-center rounded-lg border px-3 text-[12px] font-medium transition ${
                      pitchVariant === v
                        ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                        : "border-white/10 bg-black/30 text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {v === "FULL" ? "Full" : v === "HALF" ? "Half" : "Third"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Players
              </span>
              <select
                value={playersPerSide === "all" ? "all" : String(playersPerSide)}
                onChange={(e) => {
                  const v = e.target.value;
                  setPlayersPerSideAndApply(v === "all" ? "all" : Number(v));
                }}
                className="h-10 rounded-lg border border-white/10 bg-black/40 px-2 text-[12px] text-slate-200"
                title="Players per side (All = full formation). Reduce when zooming."
              >
                {playerCountOptions(format).map((opt) => {
                  const allCount = Math.max(
                    formationSize(homeFormation),
                    formationSize(awayFormation)
                  );
                  if (opt === "all") {
                    return (
                      <option key="all" value="all">
                        All ({allCount})
                      </option>
                    );
                  }
                  return (
                    <option key={opt} value={String(opt)}>
                      {opt} / side
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Formations
              </span>
              <div className="flex items-center gap-1.5">
                <label className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-500/30 bg-black/40 px-2 text-[12px] text-rose-100">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-300/80">
                    DEF
                  </span>
                  <select
                    value={
                      formationOptions.some((o) => o.id === awayFormation)
                        ? awayFormation
                        : formationOptions[0].id
                    }
                    onChange={(e) => applyAwayFormation(e.target.value as FormationId)}
                    className="bg-transparent outline-none"
                  >
                    {formationOptions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex h-10 items-center gap-1.5 rounded-lg border border-sky-500/30 bg-black/40 px-2 text-[12px] text-sky-100">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-300/80">
                    ATT
                  </span>
                  <select
                    value={
                      formationOptions.some((o) => o.id === homeFormation)
                        ? homeFormation
                        : formationOptions[0].id
                    }
                    onChange={(e) => applyHomeFormation(e.target.value as FormationId)}
                    className="bg-transparent outline-none"
                  >
                    {formationOptions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                View
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={resetMatchSetup}
                  className="flex h-10 items-center rounded-lg border border-white/10 bg-black/30 px-3 text-[12px] text-slate-300 hover:bg-white/5 hover:text-white"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const hasBall = (diagram.balls || []).length > 0;
                    commitDiagram({
                      ...diagram,
                      balls: hasBall ? [] : [{ x: 50, y: 50 }],
                    });
                    if (hasBall && selection?.kind === "ball") setSelection(null);
                  }}
                  title={(diagram.balls || []).length > 0 ? "Remove ball" : "Add ball at centre"}
                  className={`flex h-10 items-center rounded-lg border px-3 text-[12px] font-medium transition ${
                    (diagram.balls || []).length > 0
                      ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                      : "border-white/10 bg-black/30 text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  Ball
                </button>
                <button
                  type="button"
                  onClick={() => {
                    commitDiagram({
                      ...diagram,
                      pitch: {
                        ...diagram.pitch,
                        showZones: !diagram.pitch.showZones,
                      },
                    });
                  }}
                  title="Toggle five-lane field segregation"
                  className={`flex h-10 items-center rounded-lg border px-3 text-[12px] font-medium transition ${
                    diagram.pitch.showZones
                      ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                      : "border-white/10 bg-black/30 text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  Lanes
                </button>
              </div>
            </div>

            <div className="ml-auto self-end pb-2 text-[10px] text-slate-500">
              {spec.lengthYards}×{spec.widthYards} yds · {spec.ages}
            </div>
          </div>
        </div>
      ) : null}

      {statusMessage ? <p className="text-xs text-slate-400">{statusMessage}</p> : null}

      <BoardToolbar
        tool={tool}
        onToolChange={(t) => {
          setTool(t);
          setDraft(null);
          draftRef.current = null;
        }}
        addTeam={addTeam}
        onAddTeamChange={setAddTeam}
        onUndo={undo}
        disabled={!canEdit}
      />

      <div className="overflow-auto rounded-2xl border border-white/10 bg-[#06261c] p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="mx-auto h-auto w-full max-w-5xl touch-none select-none"
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerLeave={onSvgPointerUp}
          onPointerDown={onPitchPointerDown}
        >
          <ScaledPitchMarkings
            format={format}
            orientation={orientation}
            layout={layout}
            viewport={viewport}
            showLanes={!!diagram.pitch.showZones}
          />

          <defs>
            <marker id="arrowHead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#e5e7eb" />
            </marker>
            <marker id="arrowHeadRun" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#22c55e" />
            </marker>
            <marker id="arrowHeadPress" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#f97316" />
            </marker>
          </defs>

          {(diagram.areas || []).map((area, i) => renderArea(area, i))}

          {(diagram.labels || []).map((l, i) => {
            const s = toScreen(l, orientation, layout, viewport, spec);
            return (
              <text
                key={`lbl-${i}`}
                x={s.sx}
                y={s.sy}
                fill="#f8fafc"
                fontSize={Math.max(11, hitR * 0.95)}
                textAnchor="middle"
                className="pointer-events-none"
              >
                {l.text}
              </text>
            );
          })}

          {(diagram.arrows || []).map((a, i) => {
            const from = resolvePoint(a.from, diagram.players, orientation, layout, viewport, spec);
            const to = resolvePoint(a.to, diagram.players, orientation, layout, viewport, spec);
            if (!from || !to) return null;
            const fromPad = a.from.playerId ? hitR + 2 : 0;
            const toPad = a.to.playerId ? hitR + 6 : arrowHasHead(a) ? 4 : 0;
            const pitchPoly = arrowPitchPolyline(a, diagram.players);
            if (!pitchPoly || pitchPoly.length < 2) return null;
            const screenPoly = pitchPoly.map((p) =>
              toScreen(p, orientation, layout, viewport, spec)
            );
            const trimmedPts = shortenPolylineForTokens(
              screenPoly.map((p) => ({ x: p.sx, y: p.sy })),
              fromPad,
              toPad
            );
            if (!trimmedPts) return null;
            const pathD = polylineToPathD(trimmedPts);
            const isSelected = selection?.kind === "arrow" && selection.index === i;
            const marker = arrowHasHead(a)
              ? a.type === "run"
                ? "url(#arrowHeadRun)"
                : a.type === "press" || a.type === "cover"
                  ? "url(#arrowHeadPress)"
                  : "url(#arrowHead)"
              : undefined;
            const canHit = canEdit && (tool === "select" || tool === "eraser");
            const ends = {
              x1: trimmedPts[0].x,
              y1: trimmedPts[0].y,
              x2: trimmedPts[trimmedPts.length - 1].x,
              y2: trimmedPts[trimmedPts.length - 1].y,
            };
            return (
              <g key={`arr-${i}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  className={canHit ? (tool === "select" ? "cursor-move" : "cursor-pointer") : "pointer-events-none"}
                  onPointerDown={
                    canHit
                      ? (ev) => {
                          if (tool === "eraser") {
                            ev.stopPropagation();
                            ev.preventDefault();
                            commitDiagram({
                              ...diagram,
                              arrows: eraseArrowAtIndex(diagram.arrows, i),
                            });
                            if (selection?.kind === "arrow" && selection.index === i) {
                              setSelection(null);
                            }
                            return;
                          }
                          beginArrowMoveDrag(ev, i);
                        }
                      : undefined
                  }
                />
                {isSelected ? (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={(a.weight === "bold" ? 2.75 : 2) + 4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.45}
                    className="pointer-events-none"
                  />
                ) : null}
                <path
                  d={pathD}
                  fill="none"
                  stroke={isSelected ? "#fde68a" : arrowStroke(a.type)}
                  strokeWidth={a.weight === "bold" ? 2.75 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={
                    a.style === "dashed" ? "6 6" : a.style === "dotted" ? "2 6" : undefined
                  }
                  markerEnd={marker}
                  className="pointer-events-none"
                />
                {isSelected && canEdit && tool === "select" ? (
                  <>
                    <circle
                      cx={ends.x1}
                      cy={ends.y1}
                      r={7}
                      fill="#fbbf24"
                      stroke="#0f172a"
                      strokeWidth={1.5}
                      className="cursor-nwse-resize"
                      onPointerDown={(ev) => beginArrowEndDrag(ev, i, "from")}
                    />
                    <circle
                      cx={ends.x2}
                      cy={ends.y2}
                      r={7}
                      fill="#fbbf24"
                      stroke="#0f172a"
                      strokeWidth={1.5}
                      className="cursor-nwse-resize"
                      onPointerDown={(ev) => beginArrowEndDrag(ev, i, "to")}
                    />
                  </>
                ) : null}
              </g>
            );
          })}

          {draft?.mode === "line"
            ? (() => {
                const from = toScreen(draft.from, orientation, layout, viewport, spec);
                const to = toScreen(draft.to, orientation, layout, viewport, spec);
                const fromPad = draft.from.playerId ? hitR + 2 : 0;
                const toPad = draft.to.playerId ? hitR + 6 : draft.meta.arrowhead ? 4 : 0;
                let screenPts: Array<{ x: number; y: number }>;
                if (draft.meta.geometry === "freehand" && draft.path && draft.path.length >= 2) {
                  screenPts = draft.path.map((p) => {
                    const s = toScreen(p, orientation, layout, viewport, spec);
                    return { x: s.sx, y: s.sy };
                  });
                  const end = toScreen(draft.to, orientation, layout, viewport, spec);
                  screenPts = [...screenPts, { x: end.sx, y: end.sy }];
                } else if (draft.meta.geometry === "curve" && draft.control) {
                  const c = toScreen(draft.control, orientation, layout, viewport, spec);
                  screenPts = sampleQuadratic(
                    { x: from.sx, y: from.sy },
                    { x: c.sx, y: c.sy },
                    { x: to.sx, y: to.sy },
                    20
                  );
                } else {
                  screenPts = [
                    { x: from.sx, y: from.sy },
                    { x: to.sx, y: to.sy },
                  ];
                }
                const trimmed = shortenPolylineForTokens(screenPts, fromPad, toPad);
                if (!trimmed) return null;
                const pathD = polylineToPathD(trimmed);
                const marker = draft.meta.arrowhead
                  ? draft.meta.type === "run"
                    ? "url(#arrowHeadRun)"
                    : draft.meta.type === "press"
                      ? "url(#arrowHeadPress)"
                      : "url(#arrowHead)"
                  : undefined;
                return (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={arrowStroke(draft.meta.type)}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={draft.meta.style === "dashed" ? "6 6" : undefined}
                    markerEnd={marker}
                    opacity={0.85}
                    className="pointer-events-none"
                  />
                );
              })()
            : null}

          {draft?.mode === "shape"
            ? renderArea(
                { ...normalizeArea(draft.from, draft.to), shape: draft.shape },
                -1,
                true
              )
            : null}

          {(diagram.balls || []).map((b, i) => {
            const s = toScreen(b, orientation, layout, viewport, spec);
            const selected = selection?.kind === "ball" && selection.index === i;
            return (
              <g
                key={`ball-${i}`}
                transform={`translate(${s.sx},${s.sy})`}
                onPointerDown={(e) => onBallPointerDown(e, i)}
                style={{ cursor: canEdit ? "grab" : "default" }}
              >
                <circle
                  r={ballR}
                  fill="#f8fafc"
                  stroke={selected ? "#fbbf24" : "#0f172a"}
                  strokeWidth={selected ? 2.5 : 1.5}
                />
                <circle r={ballR * 0.35} fill="none" stroke="#0f172a" strokeWidth={1} opacity={0.35} />
                <path
                  d={`M ${-ballR * 0.7} 0 Q 0 ${-ballR * 0.5} ${ballR * 0.7} 0`}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth={1}
                  opacity={0.35}
                  className="pointer-events-none"
                />
              </g>
            );
          })}

          {diagram.players.map((p) => {
            const s = toScreen(p, orientation, layout, viewport, spec);
            if (
              s.sx < layout.left - hitR ||
              s.sx > layout.left + layout.width + hitR ||
              s.sy < layout.top - hitR ||
              s.sy > layout.top + layout.height + hitR
            ) {
              return null;
            }
            const isSelected = selection?.kind === "player" && selection.id === p.id;
            return (
              <g
                key={p.id}
                transform={`translate(${s.sx},${s.sy})`}
                onPointerDown={(e) => onPlayerPointerDown(e, p.id)}
                style={{ cursor: canEdit ? "grab" : "default" }}
              >
                <circle
                  r={hitR}
                  fill={teamFill(p.team)}
                  stroke={isSelected ? "#fbbf24" : "#0f172a"}
                  strokeWidth={isSelected ? 2.5 : 1.75}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.max(9, hitR * 0.9)}
                  fontWeight={700}
                  fill="#0f172a"
                  className="pointer-events-none"
                >
                  {p.number ?? ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {canEdit && selectedPlayer ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
          <span className="font-medium text-white/80">Selected #{selectedPlayer.number ?? "?"}</span>
          <label className="inline-flex items-center gap-1">
            Team
            <select
              value={selectedPlayer.team}
              onChange={(e) => {
                const team = e.target.value as DiagramTeamCode;
                commitDiagram({
                  ...diagram,
                  players: diagram.players.map((p) =>
                    p.id === selectedPlayer.id ? { ...p, team } : p
                  ),
                });
              }}
              className="rounded border border-white/10 bg-black/40 px-2 py-1"
            >
              <option value="ATT">ATT</option>
              <option value="DEF">DEF</option>
              <option value="NEUTRAL">NEUTRAL</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              commitDiagram({
                ...diagram,
                players: diagram.players.filter((p) => p.id !== selectedPlayer.id),
                arrows: diagram.arrows.filter(
                  (a) =>
                    a.from.playerId !== selectedPlayer.id && a.to.playerId !== selectedPlayer.id
                ),
              });
              setSelection(null);
            }}
            className="min-h-10 rounded-lg border border-rose-500/30 px-3 text-rose-200 hover:bg-rose-500/10"
          >
            Remove
          </button>
        </div>
      ) : null}

      {canEdit && selectedArrow && selection?.kind === "arrow" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-slate-300">
          <span className="font-medium text-amber-100/90">
            Selected line · {selectedArrow.type}
            {selectedArrow.from.playerId || selectedArrow.to.playerId ? " · linked" : " · free"}
          </span>
          <span className="text-slate-500">Drag line to move · drag handles to resize</span>
          <label className="inline-flex items-center gap-1">
            Type
            <select
              value={selectedArrow.type}
              onChange={(e) => {
                const type = e.target.value as DiagramArrow["type"];
                const style: DiagramArrow["style"] =
                  type === "run" ? "dashed" : selectedArrow.style === "dashed" ? "solid" : selectedArrow.style;
                const weight: DiagramArrow["weight"] =
                  type === "press" || type === "cover" ? "bold" : "normal";
                commitDiagram({
                  ...diagram,
                  arrows: diagram.arrows.map((a, i) =>
                    i === selection.index ? { ...a, type, style, weight } : a
                  ),
                });
              }}
              className="rounded border border-white/10 bg-black/40 px-2 py-1"
            >
              <option value="pass">Pass</option>
              <option value="run">Run</option>
              <option value="press">Press</option>
              <option value="transition">Line</option>
            </select>
          </label>
          {selectedArrow.control ? (
            <button
              type="button"
              onClick={() => {
                const from = resolveEndpoint(selectedArrow.from, diagram.players);
                const to = resolveEndpoint(selectedArrow.to, diagram.players);
                if (!from || !to || !selectedArrow.control) return;
                const control = flipCurveControl(from, to, selectedArrow.control);
                commitDiagram({
                  ...diagram,
                  arrows: diagram.arrows.map((a, i) =>
                    i === selection.index ? { ...a, control } : a
                  ),
                });
              }}
              className="min-h-10 rounded-lg border border-white/10 px-3 text-slate-200 hover:bg-white/5"
            >
              Flip curve
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              commitDiagram({
                ...diagram,
                arrows: eraseArrowAtIndex(diagram.arrows, selection.index),
              });
              setSelection(null);
            }}
            className="min-h-10 rounded-lg border border-rose-500/30 px-3 text-rose-200 hover:bg-rose-500/10"
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}
