"use client";

import * as React from "react";
import type {
  DiagramArea,
  DiagramArrow,
  DiagramElement,
  DiagramElementKind,
  DiagramLabel,
  DiagramPlayer,
  DiagramTeamCode,
  DiagramV1,
} from "@/types/diagram";
import type { BoardShareMode } from "@/lib/boards";
import { placeSetupPhaseLocally } from "@/lib/apply-setup-phase";
import {
  DEFAULT_FORMATIONS,
  FORMATIONS_BY_FORMAT,
  applyFormationToTeam,
  buildDefaultMatchDiagram,
  type FormationId,
} from "@/lib/board-formations";
import {
  BOARD_SETUP_CHANNELS,
  BOARD_SETUP_PHASES,
  BOARD_SETUP_ZONES,
  hasFullSetup,
  subjectForPhase,
  type BoardSetupChannel,
  type BoardSetupChannelOrNone,
  type BoardSetupPhase,
  type BoardSetupPhaseOrNone,
  type BoardSetupZone,
  type BoardSetupZoneOrNone,
} from "@/lib/board-phase-setup";
import {
  BOARD_SEQUENCE_DEFAULT_DURATION_MS,
  BOARD_SEQUENCE_TWEEN_MS,
  applyFrameLayers,
  deleteActiveFrame,
  duplicateActiveFrame,
  ensureSequence,
  extractFrameLayers,
  getActiveFrameIndex,
  interpolateLayers,
  selectFrame,
  syncActiveFrame,
} from "@/lib/board-sequence";
import type { DiagramFrameLayers } from "@/types/diagram";
import BoardSequenceBar from "@/components/boards/BoardSequenceBar";
import {
  PITCH_FORMAT_OPTIONS,
  PITCH_SPECS,
  ballRadiusPx,
  layoutPitch,
  tokenRadiusPx,
  pitchChromeLabel,
  viewportFor,
  type PitchFormatId,
  type PitchLayout,
  type PitchMarkingSpec,
  type PitchViewport,
  type PitchZoom,
} from "@/lib/pitch-formats";
import ScaledPitchMarkings from "@/components/boards/ScaledPitchMarkings";
import BoardToolbar, {
  elementToolKind,
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
import {
  BOARD_ELEMENT_MAX,
  conesFromElements,
  facingRotation,
  mergePracticeElements,
} from "@/lib/board-elements";
import {
  diagramPlayerCoordsEqual,
  diagramPlayersNeedUnstack,
  separateOverlappingPlayers,
  unstackDiagramPlayers,
} from "@/lib/board-player-spacing";

const WIDTH = 900;
const HEIGHT = 560;
const MARGIN = 28;
const UNDO_MAX = 50;
const MAX_BALLS = 8;

type Props = {
  boardId: string;
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
  onNewBoard?: () => void;
  creatingBoard?: boolean;
  statusMessage?: string | null;
  onEmphasisChange?: (next: {
    phase: BoardSetupPhaseOrNone;
    zone: BoardSetupZoneOrNone;
    channel: BoardSetupChannelOrNone;
    attFormation: FormationId;
  }) => void;
};

type Selection =
  | { kind: "player"; id: string }
  | { kind: "ball"; index: number }
  | { kind: "arrow"; index: number }
  | { kind: "label"; index: number }
  | { kind: "area"; index: number }
  | { kind: "element"; id: string }
  | null;

type DragTarget =
  | { kind: "player"; id: string; pointerId: number }
  | { kind: "ball"; index: number; pointerId: number }
  | { kind: "label"; index: number; pointerId: number }
  | { kind: "element"; id: string; pointerId: number }
  | {
      kind: "area";
      index: number;
      pointerId: number;
      startPos: { x: number; y: number };
      origin: { x: number; y: number; width: number; height: number };
      undoRecorded?: boolean;
    }
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
    }
  | {
      mode: "element";
      kind: DiagramElementKind;
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
  if (team === "ATT") return "#38bdf8"; // blue — us / home
  if (team === "DEF") return "#fb7185"; // red — them / away
  return "#f59e0b"; // amber floaters — distinct from ATT blue / DEF red
}

function elementHitRadius(kind: DiagramElementKind, tokenR: number) {
  if (kind === "mini-goal") return Math.max(16, tokenR * 1.6);
  if (kind === "mannequin") return Math.max(12, tokenR * 1.2);
  return Math.max(10, tokenR);
}

function BoardElementMark({
  el,
  selected,
  angle,
}: {
  el: DiagramElement;
  selected: boolean;
  angle: number;
}) {
  const stroke = selected ? "#fbbf24" : "#0f172a";
  if (el.kind === "cone") {
    const fill = el.color && /^#/.test(el.color) ? el.color : "#f59e0b";
    return (
      <g>
        <polygon points="0,-9 7,8 -7,8" fill={fill} stroke={stroke} strokeWidth={selected ? 2 : 1.25} />
        <rect x={-3.5} y={7} width={7} height={2} rx={0.5} fill="#b45309" />
      </g>
    );
  }
  if (el.kind === "pole") {
    return (
      <g>
        <line x1={0} y1={-11} x2={0} y2={11} stroke={selected ? "#fbbf24" : "#e2e8f0"} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={0} cy={-12} r={3.2} fill="#f8fafc" stroke={stroke} strokeWidth={1.25} />
      </g>
    );
  }
  if (el.kind === "mannequin") {
    return (
      <g>
        <circle cx={0} cy={-8} r={4} fill="#94a3b8" stroke={stroke} strokeWidth={selected ? 2 : 1.25} />
        <rect x={-4.5} y={-3} width={9} height={14} rx={3} fill="#64748b" stroke={stroke} strokeWidth={selected ? 2 : 1.25} />
      </g>
    );
  }
  // mini-goal: U opening to +x, rotated so 0° faces +y / right
  return (
    <g transform={`rotate(${angle})`}>
      <path
        d="M 10 -9 L -9 -9 L -9 9 L 10 9"
        fill="none"
        stroke={selected ? "#fbbf24" : "#4ade80"}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M -9 -9 h 4 M -9 9 h 4" stroke={selected ? "#fbbf24" : "#86efac"} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
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
  const elements = mergePracticeElements(d);
  const players = separateOverlappingPlayers(Array.isArray(d.players) ? d.players : []);
  return unstackDiagramPlayers(
    ensureSequence({
      ...d,
      pitch: {
        variant: d.pitch?.variant || "FULL",
        orientation: d.pitch?.orientation || "HORIZONTAL",
        format: d.pitch?.format || "11V11",
        showZones: d.pitch?.showZones,
        showThirds: d.pitch?.showThirds,
        zones: d.pitch?.zones,
      },
      players,
      arrows: Array.isArray(d.arrows) ? d.arrows : [],
      areas: Array.isArray(d.areas) ? d.areas : [],
      labels: Array.isArray(d.labels) ? d.labels : [],
      balls: Array.isArray(d.balls) ? d.balls : [],
      goals: Array.isArray(d.goals) ? d.goals : [],
      elements,
      cones: conesFromElements(elements),
    })
  );
}

/** Caption chip sits just above the label anchor so text doesn't cover the zone. */
const LABEL_CHIP_DY = -18;
const LABEL_CHIP_MAX_W = 360;
const LABEL_CHIP_MAX_CHARS = 200;

function wrapLabelLines(text: string, maxCharsPerLine = 48, maxLines = 5): string[] {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LABEL_CHIP_MAX_CHARS);
  if (!clean) return [""];
  const words = clean.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxCharsPerLine && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) {
        const rest = words.slice(i).join(" ");
        lines.push(
          rest.length <= maxCharsPerLine
            ? rest
            : `${rest.slice(0, maxCharsPerLine - 1)}…`
        );
        return lines;
      }
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

function labelChipMetrics(text: string, fontSize: number) {
  const lines = wrapLabelLines(text);
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const w = Math.min(LABEL_CHIP_MAX_W, Math.max(72, longest * fontSize * 0.56 + 18));
  const lineH = fontSize + 3;
  const h = Math.max(fontSize + 12, lines.length * lineH + 10);
  return { w, h, lines, lineH };
}

function pointInAreaPitch(pos: { x: number; y: number }, area: DiagramArea): boolean {
  if (typeof area.x !== "number" || typeof area.y !== "number") return false;
  const w = area.width ?? 0;
  const h = area.height ?? 0;
  return pos.x >= area.x && pos.x <= area.x + w && pos.y >= area.y && pos.y <= area.y + h;
}

/** Place caption just outside the top of a highlight (toward the top touchline). */
function captionOutsideArea(area: DiagramArea): { x: number; y: number } {
  const w = area.width ?? 10;
  const h = area.height ?? 10;
  const ax = area.x ?? 50;
  const ay = area.y ?? 50;
  return {
    x: clamp(ax + w + 4),
    y: clamp(ay + h / 2),
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
  boardId,
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
  onNewBoard,
  creatingBoard,
  statusMessage,
  onEmphasisChange,
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
  const [setupPhase, setSetupPhase] = React.useState<BoardSetupPhaseOrNone>("");
  const [setupZone, setSetupZone] = React.useState<BoardSetupZoneOrNone>("");
  const [setupChannel, setSetupChannel] = React.useState<BoardSetupChannelOrNone>("");
  const [showAtt, setShowAtt] = React.useState(true);

  React.useEffect(() => {
    onEmphasisChange?.({
      phase: setupPhase,
      zone: setupZone,
      channel: setupChannel,
      attFormation: homeFormation,
    });
  }, [setupPhase, setupZone, setupChannel, homeFormation, onEmphasisChange]);
  const [showDef, setShowDef] = React.useState(true);
  const setupAppliedRef = React.useRef(false);
  const unstackPassRef = React.useRef(0);
  const emptySeededForBoardRef = React.useRef<string | null>(null);
  const undoStack = React.useRef<DiagramV1[]>([]);
  const skipPropSync = React.useRef(false);
  const dragRef = React.useRef<DragTarget | null>(null);
  const pendingPos = React.useRef<{
    kind: "player" | "ball" | "label" | "element";
    idOrIndex: string | number;
    x: number;
    y: number;
  } | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [draft, setDraft] = React.useState<DrawDraft | null>(null);
  const draftRef = React.useRef<DrawDraft | null>(null);
  draftRef.current = draft;
  const [setupOpen, setSetupOpen] = React.useState(false);
  const setupRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!setupOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!setupRef.current?.contains(e.target as Node)) setSetupOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [setupOpen]);
  const [playing, setPlaying] = React.useState(false);
  const [playPreview, setPlayPreview] = React.useState<DiagramFrameLayers | null>(null);
  const playGenRef = React.useRef(0);
  const playTimerRef = React.useRef<number | null>(null);
  const playingRef = React.useRef(false);
  playingRef.current = playing;

  const haltPlayback = React.useCallback(() => {
    playGenRef.current += 1;
    if (playTimerRef.current != null) {
      window.clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
    setPlaying(false);
    setPlayPreview(null);
  }, []);

  const stopPlayback = React.useCallback(() => {
    const wasPlaying = playingRef.current;
    haltPlayback();
    if (wasPlaying) {
      skipPropSync.current = true;
      onChange({ diagram: diagramRef.current, title, shareMode });
    }
  }, [haltPlayback, onChange, shareMode, title]);

  React.useEffect(() => {
    return () => {
      playGenRef.current += 1;
      if (playTimerRef.current != null) window.clearTimeout(playTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (skipPropSync.current) {
      skipPropSync.current = false;
      return;
    }
    // Always accept external diagram updates (e.g. Tactical Edge AI apply).
    // Local edits set skipPropSync before notifying the parent so we don't loop.
    haltPlayback();
    setDiagram(ensureArrays(cloneDiagram(diagramProp)));
  }, [diagramProp, haltPlayback]);

  // Never leave two shirts on the same spot (AI apply, load, or a drop onto another player).
  // One pass only — compact 11v11 cannot satisfy a large gap; looping here froze Setup for seconds.
  React.useEffect(() => {
    if (playingRef.current) return;
    if (dragRef.current) return;
    if (!diagramPlayersNeedUnstack(diagram)) {
      unstackPassRef.current = 0;
      return;
    }
    if (unstackPassRef.current >= 1) return;
    const next = unstackDiagramPlayers(diagram);
    if (diagramPlayerCoordsEqual(diagram, next)) {
      unstackPassRef.current = 0;
      return;
    }
    unstackPassRef.current += 1;
    skipPropSync.current = true;
    setDiagram(next);
    onDirtyChange(true);
    onChange({ diagram: next, title, shareMode });
  }, [diagram, onChange, onDirtyChange, shareMode, title]);

  // Older clear boards → place natural formations once per board open.
  React.useEffect(() => {
    if (!canEdit) return;
    if (emptySeededForBoardRef.current === boardId) return;
    if ((diagram.players || []).length > 0) {
      emptySeededForBoardRef.current = boardId;
      return;
    }
    emptySeededForBoardRef.current = boardId;
    const seeded = buildDefaultMatchDiagram(format);
    const defaults = DEFAULT_FORMATIONS[format];
    setHomeFormation(defaults.home);
    setAwayFormation(defaults.away);
    skipPropSync.current = true;
    setDiagram(seeded);
    onDirtyChange(true);
    onChange({ diagram: seeded, title, shareMode });
    // Intentionally omit onChange/title/shareMode — seed once per boardId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, canEdit, diagram.players?.length, format]);

  const orientation = diagram.pitch?.orientation || "HORIZONTAL";
  const pitchVariant = (diagram.pitch?.variant || "FULL") as PitchZoom;
  const viewport = viewportFor(format, pitchVariant);
  const layout = layoutPitch(WIDTH, HEIGHT, MARGIN, viewport);
  const hitR = tokenRadiusPx(layout, PITCH_SPECS[format].lengthYards);
  const ballR = ballRadiusPx(hitR);
  const formationOptions = FORMATIONS_BY_FORMAT[format];
  const spec = PITCH_SPECS[format];
  const viewDiagram = React.useMemo(() => {
    const base = playPreview ? applyFrameLayers(diagram, playPreview) : diagram;
    if (showAtt && showDef) return base;
    return {
      ...base,
      players: (base.players || []).filter((p) => {
        if (p.team === "ATT") return showAtt;
        if (p.team === "DEF") return showDef;
        return true;
      }),
    };
  }, [diagram, playPreview, showAtt, showDef]);

  const pushUndo = React.useCallback((prev: DiagramV1) => {
    undoStack.current.push(cloneDiagram(prev));
    if (undoStack.current.length > UNDO_MAX) undoStack.current.shift();
  }, []);

  const commitDiagram = React.useCallback(
    (next: DiagramV1, opts?: { recordUndo?: boolean; from?: DiagramV1 }) => {
      if (!canEdit) return;
      stopPlayback();
      if (opts?.recordUndo !== false) {
        pushUndo(opts?.from ?? diagram);
      }
      const normalized = syncActiveFrame(ensureArrays(next));
      skipPropSync.current = true;
      setDiagram(normalized);
      onDirtyChange(true);
      onChange({ diagram: normalized, title, shareMode });
    },
    [canEdit, diagram, onChange, onDirtyChange, pushUndo, shareMode, stopPlayback, title]
  );

  const commitSequenceOp = React.useCallback(
    (next: DiagramV1) => {
      stopPlayback();
      const normalized = ensureArrays(next);
      if (canEdit) {
        pushUndo(diagram);
        onDirtyChange(true);
      }
      skipPropSync.current = true;
      setDiagram(normalized);
      onChange({ diagram: normalized, title, shareMode });
    },
    [canEdit, diagram, onChange, onDirtyChange, pushUndo, shareMode, stopPlayback, title]
  );

  const runPlayback = React.useCallback(async () => {
    const gen = ++playGenRef.current;
    const base = syncActiveFrame(ensureArrays(diagramRef.current));
    const frames = base.sequence?.frames || [];
    if (frames.length < 2) {
      setPlaying(false);
      return;
    }
    setPlaying(true);
    let idx = getActiveFrameIndex(base);

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        playTimerRef.current = window.setTimeout(() => {
          playTimerRef.current = null;
          resolve();
        }, ms);
      });

    while (playGenRef.current === gen) {
      const from = frames[idx];
      const nextIdx = (idx + 1) % frames.length;
      const to = frames[nextIdx];
      const hold = Math.max(
        BOARD_SEQUENCE_TWEEN_MS + 200,
        from.durationMs ?? BOARD_SEQUENCE_DEFAULT_DURATION_MS
      );
      const holdBefore = Math.max(120, hold - BOARD_SEQUENCE_TWEEN_MS);

      setPlayPreview(extractFrameLayers(from));
      // Keep active frame in sync for scrubber highlight (without dirtying)
      const selected = selectFrame(base, from.id);
      skipPropSync.current = true;
      setDiagram(selected);
      diagramRef.current = selected;

      await sleep(holdBefore);
      if (playGenRef.current !== gen) break;

      const tweenStart = performance.now();
      await new Promise<void>((resolve) => {
        const step = (now: number) => {
          if (playGenRef.current !== gen) {
            resolve();
            return;
          }
          const t = Math.min(1, (now - tweenStart) / BOARD_SEQUENCE_TWEEN_MS);
          setPlayPreview(interpolateLayers(from, to, t));
          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(step);
      });

      if (playGenRef.current !== gen) break;
      idx = nextIdx;
      const advanced = selectFrame(diagramRef.current, to.id);
      skipPropSync.current = true;
      setDiagram(advanced);
      diagramRef.current = advanced;
      setPlayPreview(extractFrameLayers(to));
    }
  }, []);

  const onPlayToggle = React.useCallback(() => {
    if (playing) {
      stopPlayback();
      return;
    }
    void runPlayback();
  }, [playing, runPlayback, stopPlayback]);

  const undo = React.useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    stopPlayback();
    skipPropSync.current = true;
    setDiagram(ensureArrays(prev));
    onDirtyChange(true);
    onChange({ diagram: ensureArrays(prev), title, shareMode });
  }, [onChange, onDirtyChange, shareMode, stopPlayback, title]);

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
        // Don't steal delete while editing label text in an input
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
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
        } else if (selection.kind === "label") {
          commitDiagram({
            ...diagram,
            labels: (diagram.labels || []).filter((_, j) => j !== selection.index),
          });
        } else if (selection.kind === "area") {
          commitDiagram({
            ...diagram,
            areas: (diagram.areas || []).filter((_, j) => j !== selection.index),
          });
        } else if (selection.kind === "element") {
          const elements = (diagram.elements || []).filter((el) => el.id !== selection.id);
          commitDiagram({
            ...diagram,
            elements,
            cones: conesFromElements(elements),
          });
        }
        setSelection(null);
      }
      if (e.key.toLowerCase() === "r" && tool === "select" && selection?.kind === "element") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        const elements = (diagram.elements || []).map((el) =>
          el.id === selection.id
            ? { ...el, rotation: (((el.rotation ?? 0) + 90) % 360 + 360) % 360 }
            : el
        );
        commitDiagram({ ...diagram, elements, cones: conesFromElements(elements) });
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
    } else if (pending.kind === "label") {
      const labels = [...(prev.labels || [])];
      const idx = pending.idOrIndex as number;
      if (!labels[idx]) return;
      labels[idx] = { ...labels[idx], x: pending.x, y: pending.y };
      next = { ...prev, labels };
    } else if (pending.kind === "element") {
      const id = String(pending.idOrIndex);
      const elements = (prev.elements || []).map((el) =>
        el.id === id ? { ...el, x: pending.x, y: pending.y } : el
      );
      next = { ...prev, elements, cones: conesFromElements(elements) };
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

  const applyAreaLive = (
    index: number,
    patch: Partial<Pick<NonNullable<DiagramV1["areas"]>[number], "x" | "y" | "width" | "height">>
  ) => {
    const prev = diagramRef.current;
    const areas = [...(prev.areas || [])];
    if (!areas[index]) return;
    areas[index] = { ...areas[index], ...patch };
    const next: DiagramV1 = { ...prev, areas };
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

  const hitTestLabelChip = (label: DiagramLabel, sx: number, sy: number, pad = 0) => {
    const s = toScreen(label, orientation, layout, viewport, spec);
    const fontSize = Math.max(11, hitR * 0.95);
    const { w, h } = labelChipMetrics(label.text || "", fontSize);
    const cx = s.sx;
    const cy = s.sy + LABEL_CHIP_DY;
    return (
      sx >= cx - w / 2 - pad &&
      sx <= cx + w / 2 + pad &&
      sy >= cy - h / 2 - pad &&
      sy <= cy + h / 2 + pad
    );
  };

  const eraseAt = (sx: number, sy: number) => {
    const hit = Math.max(12, hitR * 1.5);
    const screenOf = (p: { x: number; y: number }) =>
      toScreen(p, orientation, layout, viewport, spec);
    const pitchPos = fromScreen(sx, sy, orientation, layout, viewport, spec);

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

    // labels (chip hit box)
    for (let i = (diagram.labels || []).length - 1; i >= 0; i--) {
      if (hitTestLabelChip(diagram.labels[i], sx, sy, 4)) {
        commitDiagram({
          ...diagram,
          labels: diagram.labels.filter((_, j) => j !== i),
        });
        if (selection?.kind === "label" && selection.index === i) setSelection(null);
        return;
      }
    }
    // practice elements
    for (let i = (diagram.elements || []).length - 1; i >= 0; i--) {
      const el = diagram.elements![i];
      const s = toScreen(el, orientation, layout, viewport, spec);
      if (dist(s, { sx, sy }) <= elementHitRadius(el.kind, hitR) * 1.35) {
        const elements = (diagram.elements || []).filter((_, j) => j !== i);
        commitDiagram({ ...diagram, elements, cones: conesFromElements(elements) });
        if (selection?.kind === "element" && selection.id === el.id) setSelection(null);
        return;
      }
    }
    // areas (full zone)
    for (let i = (diagram.areas || []).length - 1; i >= 0; i--) {
      const area = diagram.areas[i];
      if (!pointInAreaPitch(pitchPos, area)) continue;
      commitDiagram({
        ...diagram,
        areas: diagram.areas.filter((_, j) => j !== i),
      });
      if (selection?.kind === "area" && selection.index === i) setSelection(null);
      return;
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

  const onLabelPointerDown = (e: React.PointerEvent, index: number) => {
    if (!canEdit) return;
    e.stopPropagation();
    e.preventDefault();

    if (tool === "eraser") {
      commitDiagram({
        ...diagram,
        labels: (diagram.labels || []).filter((_, j) => j !== index),
      });
      if (selection?.kind === "label" && selection.index === index) setSelection(null);
      return;
    }

    if (tool !== "select") return;

    setSelection({ kind: "label", index });
    pushUndo(diagram);
    dragRef.current = { kind: "label", index, pointerId: e.pointerId };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onElementPointerDown = (e: React.PointerEvent, id: string) => {
    if (!canEdit) return;
    e.stopPropagation();
    e.preventDefault();
    if (tool === "eraser") {
      const elements = (diagram.elements || []).filter((el) => el.id !== id);
      commitDiagram({ ...diagram, elements, cones: conesFromElements(elements) });
      if (selection?.kind === "element" && selection.id === id) setSelection(null);
      return;
    }
    if (tool !== "select") return;
    setSelection({ kind: "element", id });
    pushUndo(diagram);
    dragRef.current = { kind: "element", id, pointerId: e.pointerId };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onAreaPointerDown = (e: React.PointerEvent, index: number) => {
    if (!canEdit) return;
    e.stopPropagation();
    e.preventDefault();

    const area = diagram.areas[index];
    if (!area || typeof area.x !== "number" || typeof area.y !== "number") return;

    if (tool === "eraser") {
      commitDiagram({
        ...diagram,
        areas: (diagram.areas || []).filter((_, j) => j !== index),
      });
      if (selection?.kind === "area" && selection.index === index) setSelection(null);
      return;
    }

    if (tool !== "select") return;

    const { sx, sy } = clientToSvg(e.clientX, e.clientY);
    const pos = fromScreen(sx, sy, orientation, layout, viewport, spec);
    setSelection({ kind: "area", index });
    dragRef.current = {
      kind: "area",
      index,
      pointerId: e.pointerId,
      startPos: pos,
      origin: {
        x: area.x,
        y: area.y,
        width: area.width ?? 10,
        height: area.height ?? 10,
      },
      undoRecorded: false,
    };
    svgRef.current?.setPointerCapture?.(e.pointerId);
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
      if (drag.kind === "label") {
        pendingPos.current = { kind: "label", idOrIndex: drag.index, x: pos.x, y: pos.y };
        if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushDrag);
        return;
      }
      if (drag.kind === "element") {
        pendingPos.current = { kind: "element", idOrIndex: drag.id, x: pos.x, y: pos.y };
        if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushDrag);
        return;
      }
      if (drag.kind === "area") {
        const dx = pos.x - drag.startPos.x;
        const dy = pos.y - drag.startPos.y;
        if (Math.hypot(dx, dy) < 0.35) return;
        if (!drag.undoRecorded) {
          pushUndo(diagramRef.current);
          drag.undoRecorded = true;
        }
        applyAreaLive(drag.index, {
          x: clamp(drag.origin.x + dx),
          y: clamp(drag.origin.y + dy),
          width: drag.origin.width,
          height: drag.origin.height,
        });
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

    if (d.mode === "element") {
      if ((current.elements || []).length >= BOARD_ELEMENT_MAX) return;
      const el: DiagramElement = {
        id: `el-${Date.now().toString(36)}`,
        kind: d.kind,
        x: d.from.x,
        y: d.from.y,
        rotation: d.kind === "mini-goal" ? facingRotation(d.from, d.to) : undefined,
      };
      const elements = [...(current.elements || []), el];
      commitDiagram({ ...current, elements, cones: conesFromElements(elements) });
      setSelection({ kind: "element", id: el.id });
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
      if (drag.kind === "player" || drag.kind === "ball" || drag.kind === "label" || drag.kind === "element") {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          flushDrag();
        }
        if (drag.kind === "player" && diagramPlayersNeedUnstack(diagramRef.current)) {
          const next = unstackDiagramPlayers(diagramRef.current);
          diagramRef.current = next;
          skipPropSync.current = true;
          setDiagram(next);
          onDirtyChange(true);
          onChange({ diagram: next, title, shareMode });
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
      // Prefer parking new labels just outside any highlight under the click
      let x = pos.x;
      let y = pos.y;
      const under = (diagram.areas || []).find((a) => pointInAreaPitch(pos, a));
      if (under) {
        const out = captionOutsideArea(under);
        x = out.x;
        y = out.y;
      }
      const label: DiagramLabel = { text: text.trim().slice(0, 200), x, y };
      const nextLabels = [...diagram.labels, label];
      commitDiagram({ ...diagram, labels: nextLabels });
      setSelection({ kind: "label", index: nextLabels.length - 1 });
      setTool("select");
      return;
    }

    const placeKind = elementToolKind(tool);
    if (placeKind) {
      const next: DrawDraft = { mode: "element", kind: placeKind, from: pos, to: pos };
      draftRef.current = next;
      setDraft(next);
      svgRef.current?.setPointerCapture?.(e.pointerId);
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
      // Hit labels / areas when clicking empty pitch (players/arrows have their own handlers)
      for (let i = (diagram.labels || []).length - 1; i >= 0; i--) {
        if (hitTestLabelChip(diagram.labels[i], sx, sy, 2)) {
          setSelection({ kind: "label", index: i });
          pushUndo(diagram);
          dragRef.current = { kind: "label", index: i, pointerId: e.pointerId };
          svgRef.current?.setPointerCapture?.(e.pointerId);
          return;
        }
      }
      for (let i = (diagram.elements || []).length - 1; i >= 0; i--) {
        const el = diagram.elements![i];
        const s = toScreen(el, orientation, layout, viewport, spec);
        if (dist(s, { sx, sy }) > elementHitRadius(el.kind, hitR) * 1.35) continue;
        setSelection({ kind: "element", id: el.id });
        pushUndo(diagram);
        dragRef.current = { kind: "element", id: el.id, pointerId: e.pointerId };
        svgRef.current?.setPointerCapture?.(e.pointerId);
        return;
      }
      for (let i = (diagram.areas || []).length - 1; i >= 0; i--) {
        const area = diagram.areas[i];
        if (!pointInAreaPitch(pos, area) || typeof area.x !== "number" || typeof area.y !== "number") {
          continue;
        }
        setSelection({ kind: "area", index: i });
        dragRef.current = {
          kind: "area",
          index: i,
          pointerId: e.pointerId,
          startPos: pos,
          origin: {
            x: area.x,
            y: area.y,
            width: area.width ?? 10,
            height: area.height ?? 10,
          },
          undoRecorded: false,
        };
        svgRef.current?.setPointerCapture?.(e.pointerId);
        return;
      }
      setSelection(null);
    }
  };

  const setPitchFormat = (nextFormat: PitchFormatId) => {
    const defaults = DEFAULT_FORMATIONS[nextFormat];
    setHomeFormation(defaults.home);
    setAwayFormation(defaults.away);
    setShowAtt(true);
    setShowDef(true);
    commitDiagram(buildDefaultMatchDiagram(nextFormat));
  };

  const applyHomeFormation = (id: FormationId) => {
    setHomeFormation(id);
    const next = ensureArrays(applyFormationToTeam(diagram, "ATT", id, "home"));
    if (hasFullSetup(setupPhase, setupZone, setupChannel)) {
      // Keep phase/zone/channel chassis — update roster then re-place
      skipPropSync.current = true;
      setDiagram(next);
      diagramRef.current = next;
      applyPhaseShape(setupPhase, setupZone, setupChannel, showAtt, showDef, {
        att: id,
        def: awayFormation,
      });
    } else {
      commitDiagram(next);
    }
  };

  const applyAwayFormation = (id: FormationId) => {
    setAwayFormation(id);
    const next = ensureArrays(applyFormationToTeam(diagram, "DEF", id, "away"));
    if (hasFullSetup(setupPhase, setupZone, setupChannel)) {
      skipPropSync.current = true;
      setDiagram(next);
      diagramRef.current = next;
      applyPhaseShape(setupPhase, setupZone, setupChannel, showAtt, showDef, {
        att: homeFormation,
        def: id,
      });
    } else {
      commitDiagram(next);
    }
  };

  const resetMatchSetup = () => {
    const defaults = DEFAULT_FORMATIONS[format];
    setHomeFormation(defaults.home);
    setAwayFormation(defaults.away);
    setSetupPhase("");
    setSetupZone("");
    setSetupChannel("");
    setShowAtt(true);
    setShowDef(true);
    setupAppliedRef.current = false;
    commitDiagram(buildDefaultMatchDiagram(format));
  };

  const clearPhaseOverlay = () => {
    const defaults = DEFAULT_FORMATIONS[format];
    setupAppliedRef.current = false;
    commitDiagram(
      buildDefaultMatchDiagram(
        format,
        homeFormation || defaults.home,
        awayFormation || defaults.away
      )
    );
  };

  const applyPhaseShape = (
    phase: BoardSetupPhaseOrNone = setupPhase,
    zone: BoardSetupZoneOrNone = setupZone,
    channel: BoardSetupChannelOrNone = setupChannel,
    attVisible = showAtt,
    defVisible = showDef,
    formations?: { att?: FormationId; def?: FormationId }
  ) => {
    if (!hasFullSetup(phase, zone, channel)) {
      if (setupAppliedRef.current || (!phase && !zone && !channel)) {
        clearPhaseOverlay();
      }
      return;
    }
    const subject = subjectForPhase(phase);
    const opposition =
      subject === "DEF" ? attVisible : subject === "ATT" ? defVisible : attVisible && defVisible;
    const snapshot = diagramRef.current;
    const placed = placeSetupPhaseLocally(snapshot, {
      phase,
      zone: zone as BoardSetupZone,
      channel: channel as BoardSetupChannel,
      attFormation: formations?.att ?? homeFormation,
      defFormation: formations?.def ?? awayFormation,
      showOpposition: opposition,
    });
    setupAppliedRef.current = true;
    commitDiagram(placed);
  };

  const selectedPlayer =
    selection?.kind === "player"
      ? diagram.players.find((p) => p.id === selection.id) || null
      : null;
  const selectedArrow =
    selection?.kind === "arrow" ? diagram.arrows[selection.index] || null : null;
  const selectedLabel =
    selection?.kind === "label" ? diagram.labels[selection.index] || null : null;
  const selectedArea =
    selection?.kind === "area" ? diagram.areas[selection.index] || null : null;

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
    const canHit = canEdit && !playing && !preview && (tool === "select" || tool === "eraser");
    const hitProps = canHit
      ? {
          className: tool === "select" ? "cursor-move" : "cursor-pointer",
          onPointerDown: (ev: React.PointerEvent) => onAreaPointerDown(ev, i),
        }
      : { className: "pointer-events-none" as const };
    const isSelected = !playing && !preview && selection?.kind === "area" && selection.index === i;
    const stroke = preview ? "#fbbf24" : isSelected ? "#fbbf24" : "#fde68a";
    const strokeW = isSelected ? 2.5 : 1.75;
    if (area.shape === "spotlight") {
      const gradId = `spotlight-grad-${i < 0 ? "draft" : i}`;
      const cx = x + rw / 2;
      const cy = y + rh / 2;
      const rx = rw / 2;
      const ry = rh / 2;
      return (
        <g key={`area-${i}`}>
          <defs>
            <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff7c2" stopOpacity={preview ? 0.55 : 0.7} />
              <stop offset="45%" stopColor="#fde68a" stopOpacity={preview ? 0.28 : 0.38} />
              <stop offset="100%" stopColor="#fde68a" stopOpacity={0} />
            </radialGradient>
          </defs>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${gradId})`} {...hitProps} />
          {preview || isSelected ? (
            <ellipse
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeW}
              strokeDasharray={preview ? "4 4" : undefined}
              opacity={0.85}
              className="pointer-events-none"
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
          strokeWidth={strokeW}
          strokeDasharray={preview ? "4 4" : undefined}
          {...hitProps}
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
        strokeWidth={strokeW}
        strokeDasharray={preview ? "4 4" : undefined}
        {...hitProps}
      />
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2" ref={setupRef}>
      {/* Slim top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={title}
          disabled={!canEdit}
          onChange={(e) => {
            onDirtyChange(true);
            onChange({ diagram, title: e.target.value.slice(0, 120), shareMode });
          }}
          className="h-9 min-w-[10rem] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white/90 outline-none focus:border-emerald-500/40 disabled:opacity-60"
          placeholder="Board title"
        />
        <span className="hidden h-9 items-center rounded-lg border border-white/10 bg-black/25 px-2.5 text-[11px] font-medium text-slate-400 sm:inline-flex">
          {format} ·{" "}
          {pitchChromeLabel(pitchVariant, viewDiagram.areas?.[0]?.label, {
            playerCount: viewDiagram.players?.length,
            hasMiniGoals: (viewDiagram.elements || []).some((e) => e.kind === "mini-goal"),
          })}
        </span>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setSetupOpen((v) => !v)}
            className={`h-9 rounded-lg border px-3 text-[12px] font-medium transition ${
              setupOpen
                ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                : "border-white/10 bg-black/30 text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            Setup{setupOpen ? " ▲" : " ▾"}
          </button>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="h-9 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 text-[12px] font-semibold text-emerald-100 disabled:opacity-40"
          >
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        ) : (
          <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-slate-400">
            View only
          </span>
        )}
        {onNewBoard ? (
          <button
            type="button"
            onClick={onNewBoard}
            disabled={Boolean(creatingBoard)}
            className="h-9 rounded-lg border border-white/15 bg-black/30 px-3 text-[12px] font-medium text-slate-200 hover:bg-white/5 hover:text-white disabled:opacity-40"
          >
            {creatingBoard ? "Creating…" : "New"}
          </button>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            onClick={resetMatchSetup}
            className="h-9 rounded-lg border border-white/15 bg-black/30 px-3 text-[12px] font-medium text-slate-200 hover:bg-white/5 hover:text-white"
            title="Reset to a blank 11v11 match setup"
          >
            Reset
          </button>
        ) : null}
        {onCopyLink ? (
          <button
            type="button"
            onClick={onCopyLink}
            className="h-9 rounded-lg border border-white/15 px-2.5 text-[11px] text-slate-300 hover:bg-white/5"
          >
            Copy link
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="h-9 rounded-lg border border-rose-500/30 px-2.5 text-[11px] text-rose-200 hover:bg-rose-500/10"
          >
            Delete
          </button>
        ) : null}
        <label className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[11px] text-slate-300">
          <span className="text-slate-500">Share</span>
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

      {canEdit && setupOpen ? (
        <div className="rounded-xl border border-white/10 bg-[#0b1220] px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2 text-[11px] text-slate-200">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                Board
              </span>
              <select
                value={format}
                onChange={(e) => setPitchFormat(e.target.value as PitchFormatId)}
                title={`${spec.ages} · ${spec.lengthYards}×${spec.widthYards} yds`}
                className="bg-transparent outline-none"
              >
                {PITCH_FORMAT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex h-8 items-center gap-1 rounded-md border border-rose-500/30 bg-black/40 px-2 text-[11px] text-rose-100">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-rose-300/80">
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
                title={
                  formationOptions.find((o) => o.id === awayFormation)?.hint ||
                  "Away / DEF formation"
                }
              >
                {formationOptions.map((f) => (
                  <option key={f.id} value={f.id} title={f.hint}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                role="switch"
                aria-checked={showDef}
                onClick={() => {
                  const next = !showDef;
                  setShowDef(next);
                  if (hasFullSetup(setupPhase, setupZone, setupChannel)) {
                    applyPhaseShape(setupPhase, setupZone, setupChannel, showAtt, next);
                  }
                }}
                title={showDef ? "Hide DEF" : "Show DEF"}
                className={`ml-0.5 rounded px-1.5 text-[9px] font-semibold uppercase tracking-wide transition disabled:opacity-50 ${
                  showDef ? "bg-rose-500/30 text-rose-100" : "bg-white/5 text-slate-500"
                }`}
              >
                {showDef ? "On" : "Off"}
              </button>
            </label>

            <label className="inline-flex h-8 items-center gap-1 rounded-md border border-sky-500/30 bg-black/40 px-2 text-[11px] text-sky-100">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-sky-300/80">
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
                title={
                  formationOptions.find((o) => o.id === homeFormation)?.hint ||
                  "Home / ATT formation"
                }
              >
                {formationOptions.map((f) => (
                  <option key={f.id} value={f.id} title={f.hint}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                role="switch"
                aria-checked={showAtt}
                onClick={() => {
                  const next = !showAtt;
                  setShowAtt(next);
                  if (hasFullSetup(setupPhase, setupZone, setupChannel)) {
                    applyPhaseShape(setupPhase, setupZone, setupChannel, next, showDef);
                  }
                }}
                title={showAtt ? "Hide ATT" : "Show ATT"}
                className={`ml-0.5 rounded px-1.5 text-[9px] font-semibold uppercase tracking-wide transition disabled:opacity-50 ${
                  showAtt ? "bg-sky-500/30 text-sky-100" : "bg-white/5 text-slate-500"
                }`}
              >
                {showAtt ? "On" : "Off"}
              </button>
            </label>

            <span className="hidden h-5 w-px shrink-0 bg-white/10 sm:block" aria-hidden />

            <label
              className={`inline-flex h-8 items-center gap-1 rounded-md border bg-black/40 px-2 text-[11px] ${
                subjectForPhase(setupPhase) === "DEF"
                  ? "border-rose-500/40 text-rose-100"
                  : subjectForPhase(setupPhase) === "ATT"
                    ? "border-sky-500/40 text-sky-100"
                    : "border-white/10 text-slate-200"
              }`}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                Phase
              </span>
              <select
                value={setupPhase}
                onChange={(e) => {
                  const v = e.target.value as BoardSetupPhaseOrNone;
                  setSetupPhase(v);
                  applyPhaseShape(v, setupZone, setupChannel);
                }}
                className="bg-transparent outline-none disabled:opacity-50"
                title="Pick a phase to place the subject team (optional)"
              >
                <option value="">None</option>
                {BOARD_SETUP_PHASES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {subjectForPhase(setupPhase) ? (
                <span
                  className={`rounded px-1 text-[9px] font-semibold uppercase tracking-wide ${
                    subjectForPhase(setupPhase) === "DEF"
                      ? "bg-rose-500/25 text-rose-200"
                      : "bg-sky-500/25 text-sky-200"
                  }`}
                >
                  {subjectForPhase(setupPhase) === "DEF" ? "Red" : "Blue"}
                </span>
              ) : null}
            </label>

            <label className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2 text-[11px] text-slate-200">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                Zone
              </span>
              <select
                value={setupZone}
                onChange={(e) => {
                  const v = e.target.value as BoardSetupZoneOrNone;
                  setSetupZone(v);
                  applyPhaseShape(setupPhase, v, setupChannel);
                }}
                className="bg-transparent outline-none disabled:opacity-50"
                title="Third of the pitch (required with Phase + Channel)"
              >
                <option value="">None</option>
                {BOARD_SETUP_ZONES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2 text-[11px] text-slate-200">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                Channel
              </span>
              <select
                value={setupChannel}
                onChange={(e) => {
                  const v = e.target.value as BoardSetupChannelOrNone;
                  setSetupChannel(v);
                  applyPhaseShape(setupPhase, setupZone, v);
                }}
                className="bg-transparent outline-none disabled:opacity-50"
                title="Channel (required with Phase + Zone)"
              >
                <option value="">None</option>
                {BOARD_SETUP_CHANNELS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <span className="hidden h-5 w-px shrink-0 bg-white/10 sm:block" aria-hidden />

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
              className={`flex h-8 shrink-0 items-center rounded-md border px-2 text-[11px] font-medium transition ${
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
              className={`flex h-8 shrink-0 items-center rounded-md border px-2 text-[11px] font-medium transition ${
                diagram.pitch.showZones
                  ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                  : "border-white/10 bg-black/30 text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              Lanes
            </button>
            <button
              type="button"
              onClick={() => {
                commitDiagram({
                  ...diagram,
                  pitch: {
                    ...diagram.pitch,
                    showThirds: !diagram.pitch.showThirds,
                  },
                });
              }}
              title="Toggle defensive / middle / attacking third lines"
              className={`flex h-8 shrink-0 items-center rounded-md border px-2 text-[11px] font-medium transition ${
                diagram.pitch.showThirds
                  ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                  : "border-white/10 bg-black/30 text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              Thirds
            </button>

            <span className="ml-auto text-[10px] text-slate-500">
              {spec.lengthYards}×{spec.widthYards} · {spec.ages}
            </span>
          </div>
        </div>
      ) : null}
      </div>

      {statusMessage ? <p className="text-xs text-slate-400">{statusMessage}</p> : null}

      <div className="flex items-start gap-2">
        {canEdit ? (
          <BoardToolbar
            variant="rail"
            tool={tool}
            onToolChange={(t) => {
              setTool(t);
              setDraft(null);
              draftRef.current = null;
            }}
            addTeam={addTeam}
            onAddTeamChange={setAddTeam}
            onUndo={undo}
            disabled={playing}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="overflow-auto rounded-2xl border border-white/10 bg-[#06261c] p-2">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="mx-auto h-auto w-full max-w-5xl touch-none select-none"
              onPointerMove={playing ? undefined : onSvgPointerMove}
              onPointerUp={playing ? undefined : onSvgPointerUp}
              onPointerLeave={playing ? undefined : onSvgPointerUp}
              onPointerDown={playing ? undefined : onPitchPointerDown}
            >
          <ScaledPitchMarkings
            format={format}
            orientation={orientation}
            layout={layout}
            viewport={viewport}
            showLanes={!!diagram.pitch.showZones}
            showThirds={!!diagram.pitch.showThirds}
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

          {(viewDiagram.areas || []).map((area, i) => renderArea(area, i))}

          {(viewDiagram.elements || []).map((el) => {
            const s = toScreen(el, orientation, layout, viewport, spec);
            const rot = ((el.rotation ?? 0) * Math.PI) / 180;
            const ahead = toScreen(
              { x: el.x + Math.sin(rot) * 2, y: el.y + Math.cos(rot) * 2 },
              orientation,
              layout,
              viewport,
              spec
            );
            const angle = (Math.atan2(ahead.sy - s.sy, ahead.sx - s.sx) * 180) / Math.PI;
            const selected = !playing && selection?.kind === "element" && selection.id === el.id;
            const canHit = canEdit && !playing && (tool === "select" || tool === "eraser");
            return (
              <g
                key={el.id}
                transform={`translate(${s.sx},${s.sy})`}
                onPointerDown={canHit ? (ev) => onElementPointerDown(ev, el.id) : undefined}
                style={{ cursor: canHit ? (tool === "select" ? "grab" : "pointer") : "default" }}
              >
                <BoardElementMark el={el} selected={selected} angle={angle} />
              </g>
            );
          })}

          {/* labels rendered later (after players) so chips stay readable */}

          {(viewDiagram.arrows || []).map((a, i) => {
            const from = resolvePoint(a.from, viewDiagram.players, orientation, layout, viewport, spec);
            const to = resolvePoint(a.to, viewDiagram.players, orientation, layout, viewport, spec);
            if (!from || !to) return null;
            const fromPad = a.from.playerId ? hitR + 2 : 0;
            const toPad = a.to.playerId ? hitR + 6 : arrowHasHead(a) ? 4 : 0;
            const pitchPoly = arrowPitchPolyline(a, viewDiagram.players);
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
            const isSelected = !playing && selection?.kind === "arrow" && selection.index === i;
            const marker = arrowHasHead(a)
              ? a.type === "run"
                ? "url(#arrowHeadRun)"
                : a.type === "press" || a.type === "cover"
                  ? "url(#arrowHeadPress)"
                  : "url(#arrowHead)"
              : undefined;
            const canHit = canEdit && !playing && (tool === "select" || tool === "eraser");
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
                {typeof a.order === "number" ? (
                  <g className="pointer-events-none">
                    <circle
                      cx={trimmedPts[Math.floor(trimmedPts.length / 2)].x}
                      cy={trimmedPts[Math.floor(trimmedPts.length / 2)].y}
                      r={8}
                      fill="#0f172a"
                      stroke={isSelected ? "#fde68a" : "#fbbf24"}
                      strokeWidth={1.25}
                    />
                    <text
                      x={trimmedPts[Math.floor(trimmedPts.length / 2)].x}
                      y={trimmedPts[Math.floor(trimmedPts.length / 2)].y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#fde68a"
                      fontSize={10}
                      fontWeight={700}
                    >
                      {a.order}
                    </text>
                  </g>
                ) : null}
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

          {draft?.mode === "element"
            ? (() => {
                const s = toScreen(draft.from, orientation, layout, viewport, spec);
                const rot = facingRotation(draft.from, draft.to);
                const rad = (rot * Math.PI) / 180;
                const ahead = toScreen(
                  { x: draft.from.x + Math.sin(rad) * 2, y: draft.from.y + Math.cos(rad) * 2 },
                  orientation,
                  layout,
                  viewport,
                  spec
                );
                const angle = (Math.atan2(ahead.sy - s.sy, ahead.sx - s.sx) * 180) / Math.PI;
                return (
                  <g
                    transform={`translate(${s.sx},${s.sy})`}
                    opacity={0.85}
                    className="pointer-events-none"
                  >
                    <BoardElementMark
                      el={{
                        id: "draft",
                        kind: draft.kind,
                        x: draft.from.x,
                        y: draft.from.y,
                        rotation: rot,
                      }}
                      selected={false}
                      angle={angle}
                    />
                  </g>
                );
              })()
            : null}

          {(viewDiagram.balls || []).map((b, i) => {
            const s = toScreen(b, orientation, layout, viewport, spec);
            const selected = !playing && selection?.kind === "ball" && selection.index === i;
            return (
              <g
                key={`ball-${i}`}
                transform={`translate(${s.sx},${s.sy})`}
                onPointerDown={playing ? undefined : (e) => onBallPointerDown(e, i)}
                style={{ cursor: canEdit && !playing ? "grab" : "default" }}
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

          {viewDiagram.players.map((p) => {
            const s = toScreen(p, orientation, layout, viewport, spec);
            if (
              s.sx < layout.left - hitR ||
              s.sx > layout.left + layout.width + hitR ||
              s.sy < layout.top - hitR ||
              s.sy > layout.top + layout.height + hitR
            ) {
              return null;
            }
            const isSelected = !playing && selection?.kind === "player" && selection.id === p.id;
            return (
              <g
                key={p.id}
                transform={`translate(${s.sx},${s.sy})`}
                onPointerDown={playing ? undefined : (e) => onPlayerPointerDown(e, p.id)}
                style={{ cursor: canEdit && !playing ? "grab" : "default" }}
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
                  {p.number === 1 || String(p.role || "").toUpperCase() === "GK"
                    ? "GK"
                    : (p.number ?? "")}
                </text>
              </g>
            );
          })}

          {(viewDiagram.labels || []).map((l, i) => {
            const s = toScreen(l, orientation, layout, viewport, spec);
            const fontSize = Math.max(10, hitR * 0.85);
            const { w, h, lines, lineH } = labelChipMetrics(l.text || "", fontSize);
            const cx = s.sx;
            const cy = s.sy + LABEL_CHIP_DY;
            const isSelected = !playing && selection?.kind === "label" && selection.index === i;
            const canHit = canEdit && !playing && (tool === "select" || tool === "eraser");
            const textStartY = -((lines.length - 1) * lineH) / 2;
            return (
              <g
                key={`lbl-${i}`}
                transform={`translate(${cx}, ${cy})`}
                className={canHit ? (tool === "select" ? "cursor-move" : "cursor-pointer") : "pointer-events-none"}
                onPointerDown={canHit ? (ev) => onLabelPointerDown(ev, i) : undefined}
              >
                <rect
                  x={-w / 2}
                  y={-h / 2}
                  width={w}
                  height={h}
                  rx={6}
                  ry={6}
                  fill="rgba(15, 23, 42, 0.88)"
                  stroke={isSelected ? "#fbbf24" : "rgba(248, 250, 252, 0.25)"}
                  strokeWidth={isSelected ? 2 : 1}
                />
                <text
                  textAnchor="middle"
                  fontSize={fontSize}
                  fill="#f8fafc"
                  className="pointer-events-none"
                >
                  {lines.map((line, li) => (
                    <tspan key={li} x={0} y={textStartY + li * lineH} dominantBaseline="middle">
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <BoardSequenceBar
        diagram={diagram}
        canEdit={canEdit}
        playing={playing}
        onPlayToggle={onPlayToggle}
        onSelectFrame={(frameId) => {
          commitSequenceOp(selectFrame(diagram, frameId));
          setSelection(null);
        }}
        onDuplicate={() => {
          commitSequenceOp(duplicateActiveFrame(diagram));
          setSelection(null);
        }}
        onDelete={() => {
          commitSequenceOp(deleteActiveFrame(diagram));
          setSelection(null);
        }}
      />

      <p className="px-1 text-[10px] text-slate-500">
        <span className="mr-3 inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />
          Blue = ATT (us) · own goal RIGHT
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-400" />
          Red = DEF (them) · own goal LEFT
        </span>
      </p>

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

      {canEdit && selectedLabel && selection?.kind === "label" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-xs text-slate-300">
          <span className="font-medium text-sky-100/90">Caption</span>
          <input
            value={selectedLabel.text}
            onChange={(e) => {
              const text = e.target.value.slice(0, 200);
              commitDiagram(
                {
                  ...diagram,
                  labels: diagram.labels.map((l, i) =>
                    i === selection.index ? { ...l, text } : l
                  ),
                },
                { recordUndo: false }
              );
            }}
            className="min-h-10 min-w-[14rem] flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm text-white/90 outline-none focus:border-sky-500/40"
            placeholder="Caption text"
          />
          <button
            type="button"
            onClick={() => {
              const under = (diagram.areas || []).find((a) =>
                pointInAreaPitch(selectedLabel, a)
              );
              if (!under) return;
              const out = captionOutsideArea(under);
              commitDiagram({
                ...diagram,
                labels: diagram.labels.map((l, i) =>
                  i === selection.index ? { ...l, x: out.x, y: out.y } : l
                ),
              });
            }}
            className="min-h-10 rounded-lg border border-white/10 px-3 text-slate-200 hover:bg-white/5"
            title="Move caption outside overlapping highlight"
          >
            Park outside highlight
          </button>
          <button
            type="button"
            onClick={() => {
              commitDiagram({
                ...diagram,
                labels: diagram.labels.filter((_, j) => j !== selection.index),
              });
              setSelection(null);
            }}
            className="min-h-10 rounded-lg border border-rose-500/30 px-3 text-rose-200 hover:bg-rose-500/10"
          >
            Remove
          </button>
        </div>
      ) : null}

      {canEdit && selectedArea && selection?.kind === "area" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-slate-300">
          <span className="font-medium text-amber-100/90">
            Highlight · {selectedArea.shape || "rect"}
          </span>
          <span className="text-slate-500">Drag to move</span>
          <button
            type="button"
            onClick={() => {
              commitDiagram({
                ...diagram,
                areas: diagram.areas.filter((_, j) => j !== selection.index),
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
      </div>
    </div>
  );
}
