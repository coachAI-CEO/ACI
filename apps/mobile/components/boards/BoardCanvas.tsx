import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {
  PITCH_SPECS,
  arrowHasHead,
  arrowPitchPolyline,
  conesFromElements,
  defaultCurveControl,
  diagramVisibleBand,
  mergePracticeElements,
  separateOverlappingPlayers,
  viewBoxForBand,
  viewDeltaToDiagram,
  viewPctToDiagram,
  type PitchFormatId,
  type PitchZoom,
  type WebDiagramArrow,
  type WebDiagramArea,
  type WebDiagramBall,
  type WebDiagramElement,
  type WebDiagramFrameLayers,
  type WebDiagramLabel,
  type WebDiagramPlayer,
  type WebDiagramV1,
} from '@aci/shared';
import { colors } from '../../constants/colors';
import {
  ARROW_STROKE_WIDTH,
  FREEHAND_MAX_POINTS,
  FREEHAND_SAMPLE_DIST,
  HORIZONTAL_DIAGRAM_TRANSFORM,
  LINE_STROKE,
  PITCH_FILL,
  TOKEN_RADIUS_PCT,
  TOKEN_STROKE,
  arrowDashArray,
  arrowHeadPoints,
  arrowStroke,
  defaultRunControl,
  lineMetaFromKind,
  shaftEndBeforeHead,
  stretchAspect,
  teamFill,
  teamNumberFill,
  tokenRadiusY,
  type LineDrawKind,
} from './boardTheme';
import type { KitDrawKind } from './KitTypePicker';
import type { ShapeDrawKind } from './ShapeTypePicker';

type Orientation = 'HORIZONTAL' | 'VERTICAL';
export type Tool = 'move' | 'player' | 'arrow' | 'ball' | 'shape' | 'label' | 'kit' | 'erase';
type Team = 'ATT' | 'DEF' | 'NEUTRAL';

type Props = {
  diagram: WebDiagramV1;
  format: PitchFormatId;
  orientation: Orientation;
  zoom: PitchZoom;
  tool: Tool;
  team: Team;
  /** Pass / Run / Press / web line types for new arrows. */
  arrowKind: LineDrawKind;
  /** Spotlight / circle / rect for new areas. */
  shapeKind: ShapeDrawKind;
  /** Cone / mini-goal / mannequin / pole. */
  kitKind: KitDrawKind;
  /** When false, ATT tokens are hidden (still in diagram). */
  showAtt?: boolean;
  /** When false, DEF tokens are hidden (still in diagram). */
  showDef?: boolean;
  /** Composite selected-entity key — `player:<idx>`, `arrow:<idx>`, or `label:<idx>`. */
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  /** Detail-popover callback when a player is selected. */
  onPlayerEdit?: (index: number) => void;
  /** Open label text editor after place / long-press. */
  onLabelEdit?: (index: number) => void;
  onDiagramChange: (next: WebDiagramV1) => void;
};

const HIT_RADIUS_PCT = 4;
/** Grab radius for arrow endpoints (slightly larger than shaft hit). */
const ARROW_END_HIT_PCT = 5.5;
/** Centers must stay at least one token diameter apart (no stacking). */
const PLAYER_GAP = TOKEN_RADIUS_PCT * 2 + 0.5;
const ARROW_MIN_LEN = 2.5;

type DragState =
  | { type: 'player' | 'label' | 'ball'; key: string; startX: number; startY: number }
  | {
      type: 'area';
      key: string;
      index: number;
      originX: number;
      originY: number;
    }
  | {
      type: 'element';
      key: string;
      index: number;
      originX: number;
      originY: number;
    }
  | {
      type: 'arrow-move';
      key: string;
      index: number;
      originFrom: { x: number; y: number };
      originTo: { x: number; y: number };
      originControl?: { x: number; y: number };
      originPath?: { x: number; y: number }[];
    }
  | {
      type: 'arrow-end';
      key: string;
      index: number;
      end: 'from' | 'to';
    };
const HISTORY_LIMIT = 50;

/**
 * Interactive tactical board canvas.
 *
 * Layered on top of a read-only `<Svg>` renderer (same chrome + sprites
 * used in `BoardPreview`). The canvas adds:
 *   - Pan (single-finger) + Pinch (two-finger) + Tap gesture composition.
 *   - Tap-to-select: closest player / arrow / label within 3.5%.
 *   - Tool-aware: tapping empty space while a tool is active drops a new
 *     entity. Tap a player to cycle selection. Long-tap a player opens a
 *     detail popover.
 *   - Pinch zoom 0.5x – 2.5x applied as a transform over the SVG.
 *
 * The local diagram is the source of truth while in edit mode; `commit`
 * pushes it back up to the editor's history (undo/redo).
 */
function BoardCanvasInner({
  diagram,
  format,
  orientation,
  zoom,
  tool,
  team,
  arrowKind,
  shapeKind,
  kitKind,
  showAtt = true,
  showDef = true,
  selectedKey,
  onSelect,
  onPlayerEdit,
  onLabelEdit,
  onDiagramChange,
}: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [draftArrow, setDraftArrow] = useState<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    path?: { x: number; y: number }[];
    control?: { x: number; y: number };
  } | null>(null);
  const draftArrowRef = useRef(draftArrow);
  draftArrowRef.current = draftArrow;
  const playersRef = useRef(diagram.players || []);
  playersRef.current = diagram.players || [];
  const dragRef = useRef<DragState | null>(null);
  const arrowKindRef = useRef(arrowKind);
  arrowKindRef.current = arrowKind;

  const layers = useMemo<WebDiagramFrameLayers>(() => resolveLayers(diagram), [diagram]);
  const visibleBand = useMemo(() => diagramVisibleBand(format, zoom), [format, zoom]);
  const svgViewBox = useMemo(
    () => viewBoxForBand(visibleBand, orientation),
    [visibleBand, orientation]
  );

  // Unstack overlapping tokens once when the editor canvas mounts.
  const didInitUnstack = useRef(false);
  useEffect(() => {
    if (didInitUnstack.current) return;
    didInitUnstack.current = true;
    const players = diagram.players || [];
    let stacked = false;
    for (let i = 0; i < players.length && !stacked; i++) {
      for (let j = i + 1; j < players.length; j++) {
        if (dist(players[i].x, players[i].y, players[j].x, players[j].y) < PLAYER_GAP) {
          stacked = true;
          break;
        }
      }
    }
    if (!stacked) return;
    onDiagramChange({
      ...diagram,
      players: separateOverlappingPlayers(players, PLAYER_GAP, {
        preserveY: false,
        uniformGap: true,
      }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only unstack
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  // ─── Handlers that run on JS thread ────────────────────────────────
  const commit = useCallback(
    (next: WebDiagramV1) => {
      onDiagramChange(next);
    },
    [onDiagramChange]
  );

  const commitPlayers = useCallback(
    (players: WebDiagramPlayer[]) => {
      commit({
        ...diagram,
        players: separateOverlappingPlayers(players, PLAYER_GAP, {
          preserveY: false,
          uniformGap: true,
        }),
      });
    },
    [commit, diagram]
  );

  const handleTap = useCallback(
    (vx: number, vy: number) => {
      // Arrow is press→drag→release (pan). Ignore taps so they don't steal the gesture.
      if (tool === 'arrow') return;
      const { x: px, y: py } = viewPctToDiagram(vx, vy, visibleBand, orientation);
      const hit = findHit(layers, px, py, HIT_RADIUS_PCT, showAtt, showDef);
      if (tool === 'erase') {
        if (!hit) return;
        commit(eraseByHit(diagram, hit));
        onSelect(null);
        return;
      }
      if (tool === 'player') {
        const players = diagram.players || [];
        const newPlayer: WebDiagramPlayer = {
          id: nextPlayerId(players),
          x: px,
          y: py,
          team,
          labelStyle: 'number-only',
          number: nextPlayerNumber(players, team),
        };
        commitPlayers([...players, newPlayer]);
        onSelect(`player:${players.length}`);
        return;
      }
      if (tool === 'label') {
        const labels = diagram.labels || [];
        const newLabel: WebDiagramLabel = { x: px, y: py, text: 'Label' };
        commit({ ...diagram, labels: [...labels, newLabel] });
        onSelect(`label:${labels.length}`);
        onLabelEdit?.(labels.length);
        return;
      }
      if (tool === 'ball') {
        commit({ ...diagram, balls: [{ x: px, y: py }] });
        return;
      }
      if (tool === 'shape') {
        const areas = diagram.areas || [];
        const newArea = makeArea(px, py, shapeKind);
        commit({ ...diagram, areas: [...areas, newArea] });
        onSelect(`area:${areas.length}`);
        return;
      }
      if (tool === 'kit') {
        const elements = diagram.elements || [];
        if (elements.length >= 40) return;
        const el = makeKitElement(px, py, kitKind, elements);
        const nextElements = [...elements, el];
        commit({
          ...diagram,
          elements: nextElements,
          cones: conesFromElements(nextElements),
        });
        onSelect(`element:${elements.length}`);
        return;
      }
      onSelect(hit ? `${hit.kind}:${hit.index}` : null);
    },
    [
      tool,
      team,
      diagram,
      layers,
      commit,
      commitPlayers,
      onSelect,
      onLabelEdit,
      orientation,
      shapeKind,
      kitKind,
      showAtt,
      showDef,
      visibleBand,
    ]
  );

  const handlePanStart = useCallback(
    (vx: number, vy: number) => {
      const { x: px, y: py } = viewPctToDiagram(vx, vy, visibleBand, orientation);
      if (tool === 'arrow') {
        const meta = lineMetaFromKind(arrowKindRef.current, { x: px, y: py }, { x: px, y: py });
        setDraftArrow({
          fromX: px,
          fromY: py,
          toX: px,
          toY: py,
          path: meta.geometry === 'freehand' ? [{ x: px, y: py }] : undefined,
          control: meta.geometry === 'curve' ? meta.control : undefined,
        });
        return;
      }
      if (tool !== 'move') return;

      // Prefer arrow endpoints when the pointer is near a tip.
      const endHit = findArrowEndHit(layers, px, py, ARROW_END_HIT_PCT);
      if (endHit) {
        dragRef.current = {
          type: 'arrow-end',
          key: `arrow:${endHit.index}`,
          index: endHit.index,
          end: endHit.end,
        };
        onSelect(`arrow:${endHit.index}`);
        return;
      }

      const hit = findHit(layers, px, py, HIT_RADIUS_PCT, showAtt, showDef);
      if (!hit) return;

      if (hit.kind === 'arrow') {
        const arrow = (layers.arrows || [])[hit.index];
        const from = arrow ? resolvePoint(arrow.from, layers) : null;
        const to = arrow ? resolvePoint(arrow.to, layers) : null;
        if (!arrow || !from || !to) return;
        dragRef.current = {
          type: 'arrow-move',
          key: `arrow:${hit.index}`,
          index: hit.index,
          originFrom: { ...from },
          originTo: { ...to },
          originControl: arrow.control ? { ...arrow.control } : undefined,
          originPath: arrow.path ? arrow.path.map((p) => ({ ...p })) : undefined,
        };
        onSelect(`arrow:${hit.index}`);
        return;
      }

      if (hit.kind === 'area') {
        const area = (layers.areas || [])[hit.index];
        if (!area) return;
        dragRef.current = {
          type: 'area',
          key: `area:${hit.index}`,
          index: hit.index,
          originX: area.x ?? px,
          originY: area.y ?? py,
        };
        onSelect(`area:${hit.index}`);
        return;
      }

      if (hit.kind === 'element') {
        const el = (layers.elements || [])[hit.index];
        if (!el) return;
        dragRef.current = {
          type: 'element',
          key: `element:${hit.index}`,
          index: hit.index,
          originX: el.x,
          originY: el.y,
        };
        onSelect(`element:${hit.index}`);
        return;
      }

      if (hit.kind !== 'player' && hit.kind !== 'label' && hit.kind !== 'ball') return;
      dragRef.current = { key: `${hit.kind}:${hit.index}`, type: hit.kind, startX: px, startY: py };
      onSelect(`${hit.kind}:${hit.index}`);
    },
    [tool, layers, onSelect, orientation, showAtt, showDef, visibleBand]
  );

  const handlePanMove = useCallback(
    (vx: number, vy: number, dvx: number, dvy: number) => {
      if (tool === 'arrow') {
        const { x, y } = viewPctToDiagram(vx, vy, visibleBand, orientation);
        const kind = arrowKindRef.current;
        const meta = lineMetaFromKind(kind);
        setDraftArrow((d) => {
          if (!d) return d;
          const to = { x, y };
          const from = { x: d.fromX, y: d.fromY };
          if (meta.geometry === 'freehand') {
            const prevPath = d.path || [{ x: from.x, y: from.y }];
            const last = prevPath[prevPath.length - 1];
            const step = Math.hypot(x - last.x, y - last.y);
            const path =
              step >= FREEHAND_SAMPLE_DIST && prevPath.length < FREEHAND_MAX_POINTS
                ? [...prevPath, to]
                : prevPath;
            return { ...d, toX: x, toY: y, path };
          }
          if (meta.geometry === 'curve') {
            return {
              ...d,
              toX: x,
              toY: y,
              control: defaultCurveControl(from, to, meta.curveBulge ?? 0.28),
            };
          }
          if (kind === 'run') {
            return { ...d, toX: x, toY: y, control: defaultRunControl(from, to) };
          }
          return { ...d, toX: x, toY: y, control: undefined };
        });
        return;
      }
      if (tool !== 'move' || !dragRef.current) return;
      const { dx: dpx, dy: dpy } = viewDeltaToDiagram(dvx, dvy, visibleBand, orientation);
      const drag = dragRef.current;

      if (drag.type === 'area') {
        commit({
          ...diagram,
          areas: (diagram.areas || []).map((a, i) =>
            i === drag.index
              ? {
                  ...a,
                  x: clamp(drag.originX + dpx, 0, 100),
                  y: clamp(drag.originY + dpy, 0, 100),
                }
              : a
          ),
        });
        return;
      }

      if (drag.type === 'element') {
        const merged = mergePracticeElements({
          elements: diagram.elements,
          cones: diagram.cones,
          goals: diagram.goals,
        });
        const elements = merged.map((el, i) =>
          i === drag.index
            ? {
                ...el,
                x: clamp(drag.originX + dpx, 0, 100),
                y: clamp(drag.originY + dpy, 0, 100),
              }
            : el
        );
        commit({
          ...diagram,
          elements,
          cones: conesFromElements(elements),
        });
        return;
      }

      if (drag.type === 'arrow-move') {
        const dx = dpx;
        const dy = dpy;
        commit({
          ...diagram,
          arrows: (diagram.arrows || []).map((a, i) => {
            if (i !== drag.index) return a;
            return {
              ...a,
              from: {
                x: clamp(drag.originFrom.x + dx, 0, 100),
                y: clamp(drag.originFrom.y + dy, 0, 100),
              },
              to: {
                x: clamp(drag.originTo.x + dx, 0, 100),
                y: clamp(drag.originTo.y + dy, 0, 100),
              },
              ...(drag.originControl
                ? {
                    control: {
                      x: clamp(drag.originControl.x + dx, 0, 100),
                      y: clamp(drag.originControl.y + dy, 0, 100),
                    },
                  }
                : {}),
              ...(drag.originPath
                ? {
                    path: drag.originPath.map((p) => ({
                      x: clamp(p.x + dx, 0, 100),
                      y: clamp(p.y + dy, 0, 100),
                    })),
                  }
                : {}),
            };
          }),
        });
        return;
      }

      if (drag.type === 'arrow-end') {
        const { x, y } = viewPctToDiagram(vx, vy, visibleBand, orientation);
        const nextX = clamp(x, 0, 100);
        const nextY = clamp(y, 0, 100);
        commit({
          ...diagram,
          arrows: (diagram.arrows || []).map((a, i) => {
            if (i !== drag.index) return a;
            const fromPt = resolvePoint(a.from, layers) || { x: nextX, y: nextY };
            const toPt = resolvePoint(a.to, layers) || { x: nextX, y: nextY };
            const nextFrom = drag.end === 'from' ? { x: nextX, y: nextY } : { x: fromPt.x, y: fromPt.y };
            const nextTo = drag.end === 'to' ? { x: nextX, y: nextY } : { x: toPt.x, y: toPt.y };
            const next: WebDiagramArrow = {
              ...a,
              from: nextFrom,
              to: nextTo,
              path: undefined,
            };
            if (a.control) {
              // Preserve bulge side when recomputing control for the new chord.
              const fromPt = resolvePoint(a.from, layers) || nextFrom;
              const toPt = resolvePoint(a.to, layers) || nextTo;
              const sign =
                (toPt.x - fromPt.x) * (a.control.y - fromPt.y) -
                  (toPt.y - fromPt.y) * (a.control.x - fromPt.x) >=
                0
                  ? 1
                  : -1;
              next.control = defaultCurveControl(nextFrom, nextTo, 0.28 * sign);
            } else {
              next.control = undefined;
            }
            return next;
          }),
        });
        return;
      }

      const idx = indexFromKey(drag.key);
      if (idx == null) return;
      if (drag.type === 'player') {
        // Apply total translation against pan-start coords (not cumulative per frame).
        const players = (diagram.players || []).map((p, i) =>
          i === idx
            ? {
                ...p,
                x: clamp(drag.startX + dpx, 0, 100),
                y: clamp(drag.startY + dpy, 0, 100),
              }
            : p
        );
        playersRef.current = players;
        commit({ ...diagram, players });
      } else if (drag.type === 'ball') {
        commit({
          ...diagram,
          balls: (diagram.balls || []).map((b, i) =>
            i === idx
              ? {
                  x: clamp(drag.startX + dpx, 0, 100),
                  y: clamp(drag.startY + dpy, 0, 100),
                }
              : b
          ),
        });
      } else {
        commit({
          ...diagram,
          labels: (diagram.labels || []).map((l, i) =>
            i === idx
              ? {
                  ...l,
                  x: clamp(drag.startX + dpx, 0, 100),
                  y: clamp(drag.startY + dpy, 0, 100),
                }
              : l
          ),
        });
      }
    },
    [tool, diagram, layers, commit, orientation, visibleBand]
  );

  const handlePanEnd = useCallback(() => {
    const draft = draftArrowRef.current;
    if (tool === 'arrow' && draft) {
      const from = { x: draft.fromX, y: draft.fromY };
      const to = { x: draft.toX, y: draft.toY };
      const kind = arrowKindRef.current;
      const meta = lineMetaFromKind(kind, from, to);
      const pathLen =
        draft.path && draft.path.length > 1
          ? draft.path.reduce((acc, p, i, arr) => {
              if (i === 0) return 0;
              return acc + dist(arr[i - 1].x, arr[i - 1].y, p.x, p.y);
            }, 0)
          : dist(from.x, from.y, to.x, to.y);
      if (pathLen >= ARROW_MIN_LEN) {
        const newArrow: WebDiagramArrow = {
          from,
          to,
          type: meta.type,
          style: meta.style,
          weight: meta.weight,
          arrowhead: meta.arrowhead,
        };
        if (meta.geometry === 'freehand') {
          newArrow.path = [...(draft.path || [from]), to].slice(0, FREEHAND_MAX_POINTS);
        } else if (draft.control || meta.control) {
          newArrow.control = draft.control || meta.control;
        }
        commit({ ...diagram, arrows: [...(diagram.arrows || []), newArrow] });
      }
      setDraftArrow(null);
    } else if (tool === 'move' && dragRef.current?.type === 'player') {
      commitPlayers(playersRef.current);
    }
    dragRef.current = null;
  }, [tool, diagram, commit, commitPlayers]);

  const handlePinch = useCallback((s: number) => {
    setScale(Math.max(0.5, Math.min(2.5, s)));
  }, []);

  // ─── Gestures ──────────────────────────────────────────────────────
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(tool !== 'arrow')
        .maxDuration(500)
        .onEnd((event) => {
          const vw = size.w / scale;
          const vh = size.h / scale;
          const px = (event.x / vw) * 100;
          const py = (event.y / vh) * 100;
          if (px < 0 || px > 100 || py < 0 || py > 100) return;
          runOnJS(handleTap)(px, py);
        }),
    [size, scale, handleTap, tool]
  );

  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(tool === 'move')
        .minDuration(450)
        .onEnd((event) => {
          const vw = size.w / scale;
          const vh = size.h / scale;
          const px = (event.x / vw) * 100;
          const py = (event.y / vh) * 100;
          runOnJS(handleLongPress)(px, py);
        }),
    [size, scale, tool, orientation]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(tool === 'arrow' ? 1 : 2)
        .onStart((event) => {
          const vw = size.w / scale;
          const vh = size.h / scale;
          const px = (event.x / vw) * 100;
          const py = (event.y / vh) * 100;
          runOnJS(handlePanStart)(px, py);
        })
        .onUpdate((event) => {
          const vw = size.w / scale;
          const vh = size.h / scale;
          const px = (event.x / vw) * 100;
          const py = (event.y / vh) * 100;
          const dpx = (event.translationX / vw) * 100;
          const dpy = (event.translationY / vh) * 100;
          runOnJS(handlePanMove)(px, py, dpx, dpy);
        })
        .onEnd(() => runOnJS(handlePanEnd)()),
    [size, scale, tool, handlePanStart, handlePanMove, handlePanEnd]
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch().onUpdate((event) => runOnJS(handlePinch)(event.scale)),
    [handlePinch]
  );

  const composed = useMemo(
    () => Gesture.Simultaneous(longPress, tap, pan, pinch),
    [longPress, tap, pan, pinch]
  );

  function handleLongPress(vx: number, vy: number) {
    const { x: px, y: py } = viewPctToDiagram(vx, vy, visibleBand, orientation);
    const hit = findHit(layers, px, py, HIT_RADIUS_PCT, showAtt, showDef);
    if (hit?.kind === 'player') onPlayerEdit?.(hit.index);
    if (hit?.kind === 'label') onLabelEdit?.(hit.index);
    if (hit?.kind === 'element') {
      const el = (layers.elements || [])[hit.index];
      if (!el || el.kind !== 'mini-goal') return;
      const merged = mergePracticeElements({
        elements: diagram.elements,
        cones: diagram.cones,
        goals: diagram.goals,
      });
      const elements = merged.map((cur, i) =>
        i === hit.index
          ? { ...cur, rotation: (((cur.rotation || 0) + 90) % 360 + 360) % 360 }
          : cur
      );
      commit({ ...diagram, elements, cones: conesFromElements(elements) });
      onSelect(`element:${hit.index}`);
    }
  }

  // Diagram space is always x=width, y=length. VERTICAL shows 1:1;
  // HORIZONTAL remaps via SVG matrix so length runs left→right.
  const diagramTransform =
    orientation === 'HORIZONTAL' ? HORIZONTAL_DIAGRAM_TRANSFORM : undefined;

  const playersSorted = useMemo(() => {
    const list = layers.players || [];
    return list
      .map((p, index) => ({ p, index }))
      .filter(({ p }) => {
        if (p.team === 'ATT') return showAtt;
        if (p.team === 'DEF') return showDef;
        return true;
      })
      .sort((a, b) => teamDrawOrder(a.p.team) - teamDrawOrder(b.p.team));
  }, [layers.players, showAtt, showDef]);

  // Drop in-progress arrow if the user switches tools mid-draw.
  useEffect(() => {
    if (tool !== 'arrow' && draftArrow) setDraftArrow(null);
  }, [tool, draftArrow]);

  const rx = TOKEN_RADIUS_PCT;
  const ry = tokenRadiusY(rx, size.w, size.h, orientation);
  const aspect = stretchAspect(size.w, size.h, orientation);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <GestureDetector gesture={composed}>
        <View style={[styles.canvas, { backgroundColor: PITCH_FILL }]} onLayout={onLayout}>
          {size.w > 0 && size.h > 0 ? (
            <View
              style={[
                styles.scale,
                {
                  width: size.w,
                  height: size.h,
                  transform: [{ scale }],
                },
              ]}
            >
              {/* Stretch to fill — mock fills the canvas with grass (no side bands). */}
              <Svg width="100%" height="100%" viewBox={svgViewBox} preserveAspectRatio="none">
                <Defs>
                  <RadialGradient id="spotlightGrad" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="#fbbf24" stopOpacity={0.45} />
                    <Stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <G transform={diagramTransform}>
                  <PitchMarkings
                    format={format}
                    zoom={zoom}
                    showThirds={!!diagram.pitch?.showThirds}
                    showLanes={!!diagram.pitch?.showZones}
                    zones={diagram.pitch?.zones}
                  />
                  {(layers.areas || []).map((a, i) => (
                    <AreaLayer key={`area-${i}`} area={a} selected={selectedKey === `area:${i}`} />
                  ))}
                  {(layers.elements || []).map((el, i) => (
                    <ElementToken
                      key={`el-${el.id || i}`}
                      element={el}
                      selected={selectedKey === `element:${i}`}
                    />
                  ))}
                  {(layers.goals || []).map((g, i) => <Goal key={`goal-${i}`} goal={g} />)}
                  {(layers.balls || []).map((b, i) => (
                    <Ball
                      key={`ball-${i}`}
                      ball={b}
                      canvasW={size.w}
                      canvasH={size.h}
                      orientation={orientation}
                    />
                  ))}
                  {playersSorted.map(({ p, index }) => (
                    <PlayerToken
                      key={`p-${p.id || index}`}
                      player={p}
                      selected={selectedKey === `player:${index}`}
                      rx={rx}
                      ry={ry}
                      orientation={orientation}
                    />
                  ))}
                  {(layers.arrows || []).map((a, i) => (
                    <Arrow
                      key={`arrow-${i}`}
                      arrow={a}
                      layers={layers}
                      selected={selectedKey === `arrow:${i}`}
                      aspect={aspect}
                    />
                  ))}
                  {layers.coach ? <Coach coach={layers.coach} /> : null}
                  {(layers.labels || []).map((l, i) => (
                    <LabelMark
                      key={`label-${i}`}
                      label={l}
                      selected={selectedKey === `label:${i}`}
                    />
                  ))}
                  {draftArrow ? (
                    <DraftArrow
                      draft={draftArrow}
                      kind={arrowKind}
                      aspect={aspect}
                    />
                  ) : null}
                </G>
              </Svg>
            </View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

/**
 * Memoized editor canvas. The parent (`/boards/[id]/edit`) already wraps
 * `commit`, `setTool`, `setTeam` etc. in `useCallback`, so shallow
 * equality on props is enough to skip the SVG re-render when unrelated
 * state (like the AI sheet) flips above it.
 */
export const BoardCanvas = memo(BoardCanvasInner);

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function nextPlayerId(players: WebDiagramPlayer[]): string {
  let n = players.length + 1;
  while (players.some((p) => p.id === `p${n}`)) n++;
  return `p${n}`;
}

function nextPlayerNumber(players: WebDiagramPlayer[], team: Team): number {
  const onTeam = players.filter((p) => p.team === team).length;
  return ((onTeam % 11) + 1) || 1;
}

type Hit = { kind: 'player' | 'arrow' | 'label' | 'area' | 'ball' | 'element'; index: number };

function findHit(
  layers: WebDiagramFrameLayers,
  px: number,
  py: number,
  radius: number,
  showAtt = true,
  showDef = true
): Hit | null {
  for (let i = 0; i < (layers.players || []).length; i++) {
    const p = (layers.players || [])[i];
    if (p.team === 'ATT' && !showAtt) continue;
    if (p.team === 'DEF' && !showDef) continue;
    if (dist(p.x, p.y, px, py) <= radius) return { kind: 'player', index: i };
  }
  for (let i = 0; i < (layers.arrows || []).length; i++) {
    const a = (layers.arrows || [])[i];
    const poly = arrowPitchPolyline(a, layers.players || []);
    if (poly && poly.length >= 2) {
      let best = Infinity;
      for (let s = 0; s < poly.length - 1; s++) {
        best = Math.min(
          best,
          pointToSegment(px, py, poly[s].x, poly[s].y, poly[s + 1].x, poly[s + 1].y)
        );
      }
      if (best <= radius) return { kind: 'arrow', index: i };
      continue;
    }
    const from = resolvePoint(a.from, layers);
    const to = resolvePoint(a.to, layers);
    if (from && to && pointToSegment(px, py, from.x, from.y, to.x, to.y) <= radius) {
      return { kind: 'arrow', index: i };
    }
  }
  for (let i = (layers.elements || []).length - 1; i >= 0; i--) {
    const el = (layers.elements || [])[i];
    if (dist(el.x, el.y, px, py) <= kitHitRadius(el.kind)) return { kind: 'element', index: i };
  }
  for (let i = 0; i < (layers.labels || []).length; i++) {
    const l = (layers.labels || [])[i];
    if (dist(l.x, l.y, px, py) <= radius) return { kind: 'label', index: i };
  }
  for (let i = 0; i < (layers.balls || []).length; i++) {
    const b = (layers.balls || [])[i];
    if (dist(b.x, b.y, px, py) <= radius) return { kind: 'ball', index: i };
  }
  for (let i = (layers.areas || []).length - 1; i >= 0; i--) {
    const area = (layers.areas || [])[i];
    if (pointInArea(px, py, area)) return { kind: 'area', index: i };
  }
  return null;
}

/** Prefer the nearest arrow tip within radius (for endpoint drag). */
function findArrowEndHit(
  layers: WebDiagramFrameLayers,
  px: number,
  py: number,
  radius: number
): { index: number; end: 'from' | 'to' } | null {
  let best: { index: number; end: 'from' | 'to'; d: number } | null = null;
  for (let i = 0; i < (layers.arrows || []).length; i++) {
    const a = (layers.arrows || [])[i];
    const from = resolvePoint(a.from, layers);
    const to = resolvePoint(a.to, layers);
    if (!from || !to) continue;
    const dFrom = dist(from.x, from.y, px, py);
    const dTo = dist(to.x, to.y, px, py);
    if (dFrom <= radius && (!best || dFrom < best.d)) best = { index: i, end: 'from', d: dFrom };
    if (dTo <= radius && (!best || dTo < best.d)) best = { index: i, end: 'to', d: dTo };
  }
  return best ? { index: best.index, end: best.end } : null;
}

function eraseByHit(d: WebDiagramV1, hit: Hit): WebDiagramV1 {
  if (hit.kind === 'player') {
    return { ...d, players: (d.players || []).filter((_, i) => i !== hit.index) };
  }
  if (hit.kind === 'arrow') {
    return { ...d, arrows: (d.arrows || []).filter((_, i) => i !== hit.index) };
  }
  if (hit.kind === 'label') {
    return { ...d, labels: (d.labels || []).filter((_, i) => i !== hit.index) };
  }
  if (hit.kind === 'area') {
    return { ...d, areas: (d.areas || []).filter((_, i) => i !== hit.index) };
  }
  if (hit.kind === 'ball') {
    return { ...d, balls: (d.balls || []).filter((_, i) => i !== hit.index) };
  }
  if (hit.kind === 'element') {
    const merged = mergePracticeElements({
      elements: d.elements,
      cones: d.cones,
      goals: d.goals,
    });
    const elements = merged.filter((_, i) => i !== hit.index);
    return { ...d, elements, cones: conesFromElements(elements) };
  }
  return d;
}

function indexFromKey(key: string): number | null {
  const idx = key.indexOf(':');
  if (idx < 0) return null;
  const n = Number(key.slice(idx + 1));
  return Number.isFinite(n) ? n : null;
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function pointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(px, py, ax, ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return dist(px, py, ax + t * dx, ay + t * dy);
}

function resolvePoint(
  ref: WebDiagramArrow['from'],
  layers: WebDiagramFrameLayers
): { x: number; y: number } | null {
  if (ref.playerId) {
    const p = (layers.players || []).find((x) => x.id === ref.playerId);
    if (p) return { x: p.x, y: p.y };
  }
  if (ref.x != null && ref.y != null) return { x: ref.x, y: ref.y };
  return null;
}

function resolveLayers(diagram: WebDiagramV1): WebDiagramFrameLayers {
  // Root layers are the live working copy of the active frame
  // (`syncActiveFrame` writes them back into sequence on save / frame switch).
  const elements = mergePracticeElements({
    elements: diagram.elements,
    cones: diagram.cones,
    goals: diagram.goals,
  });
  return {
    players: diagram.players || [],
    arrows: diagram.arrows || [],
    areas: diagram.areas || [],
    labels: diagram.labels || [],
    balls: diagram.balls,
    goals: diagram.goals,
    coach: diagram.coach,
    cones: conesFromElements(elements),
    elements,
  };
}

function teamDrawOrder(team: WebDiagramPlayer['team']): number {
  // ATT under DEF so marking pairs read as red-over-green like the mock.
  if (team === 'ATT') return 0;
  if (team === 'NEUTRAL') return 1;
  return 2;
}

function PitchMarkings({
  format,
  zoom: _zoom,
  showThirds = false,
  showLanes = false,
  zones,
}: {
  format: PitchFormatId;
  zoom: PitchZoom;
  showThirds?: boolean;
  showLanes?: boolean;
  zones?: WebDiagramV1['pitch']['zones'];
}) {
  // Diagram space: x = width, y = length. Goals at top (y=0, AWAY/DEF) and
  // bottom (y=100, HOME/ATT) — matches web VERTICAL + the interactive mock.
  const spec = PITCH_SPECS[format];
  const widthYds = spec.widthYards;
  const lenToPct = (l: number) => (l / spec.lengthYards) * 100;
  const widToPct = (w: number) => (w / widthYds) * 100;
  const halfW = widToPct(widthYds / 2);
  const midLen = lenToPct(spec.lengthYards / 2);
  const ccRadius = (spec.centerCircleRadiusYds / spec.lengthYards) * 100;
  const third1 = lenToPct(spec.lengthYards / 3);
  const third2 = lenToPct((2 * spec.lengthYards) / 3);
  const drawThirds = showThirds || !!spec.buildOutLines;

  const zoneStrips = showLanes
    ? [
        { x: 0, w: 10 },
        { x: 10, w: 15 },
        { x: 25, w: 50 },
        { x: 75, w: 15 },
        { x: 90, w: 10 },
      ]
    : zones
      ? [
          { x: 0, w: 10, show: !!zones.leftWide },
          { x: 10, w: 15, show: !!zones.leftHalfSpace },
          { x: 25, w: 50, show: !!zones.centralChannel },
          { x: 75, w: 15, show: !!zones.rightHalfSpace },
          { x: 90, w: 10, show: !!zones.rightWide },
        ].filter((s) => s.show)
      : [];

  return (
    <>
      <Rect x={0} y={0} width={100} height={100} fill={PITCH_FILL} />
      {zoneStrips.map((s, i) => (
        <Rect key={`zone-${i}`} x={s.x} y={0} width={s.w} height={100} fill="#ffffff" opacity={0.06} />
      ))}
      <Line x1={0} y1={0} x2={100} y2={0} stroke={LINE_STROKE} strokeWidth={0.45} />
      <Line x1={0} y1={100} x2={100} y2={100} stroke={LINE_STROKE} strokeWidth={0.45} />
      <Line x1={0} y1={0} x2={0} y2={100} stroke={LINE_STROKE} strokeWidth={0.45} />
      <Line x1={100} y1={0} x2={100} y2={100} stroke={LINE_STROKE} strokeWidth={0.45} />
      <Line x1={0} y1={midLen} x2={100} y2={midLen} stroke={LINE_STROKE} strokeWidth={0.35} />
      <Circle cx={50} cy={midLen} r={ccRadius} fill="none" stroke={LINE_STROKE} strokeWidth={0.35} />
      <Circle cx={50} cy={midLen} r={0.4} fill="#ffffff" opacity={0.85} />
      <PenRect side="AWAY" spec={spec} widthYds={widthYds} />
      <PenRect side="HOME" spec={spec} widthYds={widthYds} />
      <GoalRect side="AWAY" spec={spec} widthYds={widthYds} />
      <GoalRect side="HOME" spec={spec} widthYds={widthYds} />
      <Rect x={halfW - 1.5} y={-0.6} width={3} height={0.6} fill="#ffffff" opacity={0.85} />
      <Rect x={halfW - 1.5} y={100} width={3} height={0.6} fill="#ffffff" opacity={0.85} />
      {drawThirds ? (
        <>
          <Line x1={0} y1={third1} x2={100} y2={third1} stroke={LINE_STROKE} strokeWidth={0.2} strokeDasharray="1,1" />
          <Line x1={0} y1={third2} x2={100} y2={third2} stroke={LINE_STROKE} strokeWidth={0.2} strokeDasharray="1,1" />
        </>
      ) : null}
    </>
  );
}

function PenRect({ side, spec, widthYds }: { side: 'AWAY' | 'HOME'; spec: (typeof PITCH_SPECS)[PitchFormatId]; widthYds: number }) {
  const depth = spec.penaltyDepthYds;
  const lenToPct = (l: number) => (l / spec.lengthYards) * 100;
  const widToPct = (w: number) => (w / widthYds) * 100;
  const y = side === 'AWAY' ? 0 : lenToPct(spec.lengthYards - depth);
  const h = lenToPct(depth);
  const x = widToPct(widthYds / 2 - spec.penaltyWidthYds / 2);
  const w = widToPct(spec.penaltyWidthYds);
  const spotY = side === 'AWAY' ? lenToPct(spec.penaltySpotYds) : lenToPct(spec.lengthYards - spec.penaltySpotYds);
  return (
    <>
      <Rect x={x} y={y} width={w} height={h} fill="none" stroke={LINE_STROKE} strokeWidth={0.35} />
      <Circle cx={50} cy={spotY} r={0.4} fill="#ffffff" opacity={0.85} />
    </>
  );
}

function GoalRect({ side, spec, widthYds }: { side: 'AWAY' | 'HOME'; spec: (typeof PITCH_SPECS)[PitchFormatId]; widthYds: number }) {
  const depth = spec.goalAreaDepthYds;
  const lenToPct = (l: number) => (l / spec.lengthYards) * 100;
  const widToPct = (w: number) => (w / widthYds) * 100;
  const y = side === 'AWAY' ? 0 : lenToPct(spec.lengthYards - depth);
  const h = lenToPct(depth);
  const x = widToPct(widthYds / 2 - spec.goalAreaWidthYds / 2);
  const w = widToPct(spec.goalAreaWidthYds);
  return <Rect x={x} y={y} width={w} height={h} fill="none" stroke={LINE_STROKE} strokeWidth={0.28} />;
}

function PlayerToken({
  player,
  selected,
  rx,
  ry,
  orientation = 'VERTICAL',
}: {
  player: WebDiagramPlayer;
  selected: boolean;
  rx: number;
  ry: number;
  orientation?: Orientation;
}) {
  const fill = teamFill(player.team);
  const numFill = teamNumberFill(player.team);
  // Parent HORIZONTAL matrix rotates glyphs; counter-rotate so jersey # stays upright.
  const numTransform =
    orientation === 'HORIZONTAL'
      ? `rotate(90 ${player.x} ${player.y})`
      : undefined;
  return (
    <G>
      {selected ? (
        <Ellipse
          cx={player.x}
          cy={player.y}
          rx={rx + 1.4}
          ry={ry + 1.4 * (ry / rx)}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={0.45}
          strokeDasharray="1,1"
        />
      ) : null}
      <Ellipse
        cx={player.x}
        cy={player.y}
        rx={rx}
        ry={ry}
        fill={fill}
        stroke={TOKEN_STROKE}
        strokeWidth={0.4}
      />
      {typeof player.number === 'number' ? (
        <SvgText
          x={player.x}
          y={player.y + Math.min(rx, ry) * 0.35}
          fontSize={Math.min(rx, ry) * 1.05}
          fill={numFill}
          fontWeight="700"
          textAnchor="middle"
          transform={numTransform}
        >
          {player.number}
        </SvgText>
      ) : null}
    </G>
  );
}

function DraftArrow({
  draft,
  kind,
  aspect,
}: {
  draft: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    path?: { x: number; y: number }[];
    control?: { x: number; y: number };
  };
  kind: LineDrawKind;
  aspect: number;
}) {
  const meta = lineMetaFromKind(kind, { x: draft.fromX, y: draft.fromY }, { x: draft.toX, y: draft.toY });
  const color = arrowStroke(meta.type);
  const dash = arrowDashArray(meta);
  const from = { x: draft.fromX, y: draft.fromY };
  const to = { x: draft.toX, y: draft.toY };
  const showHead = meta.arrowhead === true;
  const control = draft.control || meta.control;
  const headFrom = control || (draft.path && draft.path.length > 0 ? draft.path[draft.path.length - 1] : from);
  const shaftEnd = showHead ? shaftEndBeforeHead(headFrom, to) : to;

  let pathD: string;
  if (meta.geometry === 'freehand' && draft.path && draft.path.length > 1) {
    pathD = `M ${draft.path.map((p) => `${p.x} ${p.y}`).join(' L ')} L ${shaftEnd.x} ${shaftEnd.y}`;
  } else if (control) {
    pathD = `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${shaftEnd.x} ${shaftEnd.y}`;
  } else {
    pathD = `M ${from.x} ${from.y} L ${shaftEnd.x} ${shaftEnd.y}`;
  }

  return (
    <G>
      <Path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={ARROW_STROKE_WIDTH}
        strokeDasharray={dash}
        strokeLinecap="round"
        opacity={0.9}
      />
      {showHead ? (
        <Polygon
          points={arrowHeadPoints(headFrom.x, headFrom.y, to.x, to.y, undefined, aspect)}
          fill={color}
        />
      ) : null}
    </G>
  );
}

function Arrow({
  arrow,
  layers,
  selected,
  aspect,
}: {
  arrow: WebDiagramArrow;
  layers: WebDiagramFrameLayers;
  selected: boolean;
  aspect: number;
}) {
  const from = resolvePoint(arrow.from, layers);
  const to = resolvePoint(arrow.to, layers);
  if (!from || !to) return null;

  const color = arrowStroke(arrow.type);
  const dash = arrowDashArray(arrow);
  const stroke = arrow.weight === 'bold' ? ARROW_STROKE_WIDTH + 0.35 : ARROW_STROKE_WIDTH;
  const showHead = arrowHasHead(arrow);

  let headFrom = from;
  const tip = to;

  if (arrow.path && arrow.path.length > 1) {
    headFrom = arrow.path[arrow.path.length - 1] || from;
  } else if (arrow.control) {
    headFrom = arrow.control;
  }

  const shaftEnd = showHead ? shaftEndBeforeHead(headFrom, tip) : tip;

  let pathD: string;
  if (arrow.path && arrow.path.length > 1) {
    pathD = `M ${from.x} ${from.y} ${arrow.path.map((p) => `L ${p.x} ${p.y}`).join(' ')} L ${shaftEnd.x} ${shaftEnd.y}`;
  } else if (arrow.control) {
    pathD = `M ${from.x} ${from.y} Q ${arrow.control.x} ${arrow.control.y} ${shaftEnd.x} ${shaftEnd.y}`;
  } else {
    pathD = `M ${from.x} ${from.y} L ${shaftEnd.x} ${shaftEnd.y}`;
  }

  return (
    <G>
      <Path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={selected ? stroke + 0.4 : stroke}
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showHead ? (
        <Polygon
          points={arrowHeadPoints(headFrom.x, headFrom.y, tip.x, tip.y, undefined, aspect)}
          fill={color}
          stroke={color}
          strokeWidth={0.2}
        />
      ) : null}
      {selected ? (
        <>
          <Ellipse
            cx={from.x}
            cy={from.y}
            rx={1.8}
            ry={1.8 * (aspect > 0 ? aspect : 1)}
            fill="#0b1220"
            stroke="#fbbf24"
            strokeWidth={0.55}
          />
          <Ellipse
            cx={to.x}
            cy={to.y}
            rx={1.8}
            ry={1.8 * (aspect > 0 ? aspect : 1)}
            fill="#0b1220"
            stroke="#fbbf24"
            strokeWidth={0.55}
          />
        </>
      ) : null}
    </G>
  );
}

function Ball({
  ball,
  canvasW,
  canvasH,
  orientation = 'VERTICAL',
}: {
  ball: WebDiagramBall;
  canvasW: number;
  canvasH: number;
  orientation?: Orientation;
}) {
  const rx = 1.4;
  const ry = tokenRadiusY(rx, canvasW, canvasH, orientation);
  return (
    <Ellipse
      cx={ball.x}
      cy={ball.y}
      rx={rx}
      ry={ry}
      fill="#f9fafb"
      stroke={TOKEN_STROKE}
      strokeWidth={0.25}
    />
  );
}

function Goal({ goal }: { goal: NonNullable<WebDiagramV1['goals']>[number] }) {
  if (!goal) return null;
  const w = (goal.width ?? 5) * 1.5;
  return (
    <Rect x={goal.x - w / 2} y={goal.y - w / 4} width={w} height={w / 2} fill="none" stroke="#ffffff" strokeWidth={0.4} />
  );
}

function kitHitRadius(kind: WebDiagramElement['kind']): number {
  if (kind === 'mini-goal') return 5;
  if (kind === 'mannequin') return 4;
  if (kind === 'pole') return 3.2;
  return 3.5;
}

function makeKitElement(
  px: number,
  py: number,
  kind: KitDrawKind,
  existing: WebDiagramElement[]
): WebDiagramElement {
  let n = existing.length + 1;
  while (existing.some((e) => e.id === `el-${n}`)) n++;
  const base: WebDiagramElement = {
    id: `el-${n}`,
    kind,
    x: clamp(px, 0, 100),
    y: clamp(py, 0, 100),
  };
  if (kind === 'cone') return { ...base, color: '#fb923c' };
  if (kind === 'pole') return { ...base, color: '#f97316' };
  if (kind === 'mini-goal') return { ...base, rotation: 0, width: 5 };
  return base;
}

function ElementToken({
  element,
  selected,
}: {
  element: WebDiagramElement;
  selected?: boolean;
}) {
  const stroke = selected ? '#fbbf24' : '#ffffff';
  const strokeW = selected ? 0.55 : 0.3;
  if (element.kind === 'mini-goal') {
    const rot = element.rotation || 0;
    return (
      <G transform={`rotate(${rot} ${element.x} ${element.y})`}>
        <Path
          d={`M ${element.x - 2.6} ${element.y - 1.4} L ${element.x - 2.6} ${element.y + 1.4} L ${element.x + 2.2} ${element.y + 1.4} L ${element.x + 2.2} ${element.y - 1.4}`}
          fill="none"
          stroke={selected ? '#fbbf24' : '#facc15'}
          strokeWidth={selected ? 0.7 : 0.45}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    );
  }
  if (element.kind === 'mannequin') {
    return (
      <Circle
        cx={element.x}
        cy={element.y}
        r={1.6}
        fill="#e5e7eb"
        stroke={selected ? '#fbbf24' : '#111827'}
        strokeWidth={strokeW}
      />
    );
  }
  if (element.kind === 'pole') {
    return (
      <Circle
        cx={element.x}
        cy={element.y}
        r={1.0}
        fill={element.color || '#f97316'}
        stroke={stroke}
        strokeWidth={strokeW}
      />
    );
  }
  return (
    <Circle
      cx={element.x}
      cy={element.y}
      r={1.4}
      fill={element.color || '#fb923c'}
      stroke={stroke}
      strokeWidth={strokeW}
    />
  );
}

function Coach({ coach }: { coach: WebDiagramV1['coach'] }) {
  if (!coach) return null;
  return (
    <G>
      <Circle cx={coach.x} cy={coach.y} r={2.4} fill="#111827" stroke="#ffffff" strokeWidth={0.4} />
      <SvgText x={coach.x} y={coach.y + 1} fontSize={2.5} fill="#ffffff" fontWeight="800" textAnchor="middle">
        C
      </SvgText>
    </G>
  );
}

function makeArea(px: number, py: number, kind: ShapeDrawKind): WebDiagramArea {
  if (kind === 'rect') {
    const width = 20;
    const height = 14;
    return {
      x: clamp(px - width / 2, 0, 100 - width),
      y: clamp(py - height / 2, 0, 100 - height),
      width,
      height,
      shape: 'rect',
    };
  }
  const width = kind === 'spotlight' ? 28 : 18;
  return { x: px, y: py, width, height: width, shape: kind };
}

function pointInArea(px: number, py: number, area: WebDiagramArea): boolean {
  const shape = area.shape || 'rect';
  if (shape === 'circle' || shape === 'spotlight') {
    const cx = area.x ?? 50;
    const cy = area.y ?? 50;
    const r = (area.width ?? 20) / 2;
    return dist(px, py, cx, cy) <= r;
  }
  const x = area.x ?? 0;
  const y = area.y ?? 0;
  const w = area.width ?? 20;
  const h = area.height ?? 20;
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

function LabelMark({ label, selected }: { label: WebDiagramLabel; selected: boolean }) {
  const raw = label.text || 'Label';
  const lines = wrapLabelLines(raw, 26);
  const longest = lines.reduce((m, s) => Math.max(m, s.length), 0);
  const approxW = Math.min(42, Math.max(12, longest * 1.55 + 4));
  const lineH = 3.2;
  const padY = 1.4;
  const boxH = lines.length * lineH + padY * 2;
  const top = label.y - boxH / 2;
  return (
    <G>
      <Rect
        x={label.x - approxW / 2}
        y={top}
        width={approxW}
        height={boxH}
        rx={1.2}
        fill={selected ? 'rgba(251,191,36,0.28)' : 'rgba(11,18,32,0.78)'}
        stroke={selected ? '#fbbf24' : 'rgba(255,255,255,0.25)'}
        strokeWidth={0.4}
      />
      {lines.map((line, i) => (
        <SvgText
          key={`ln-${i}`}
          x={label.x}
          y={top + padY + (i + 0.75) * lineH}
          fontSize={2.4}
          fill="#f8fafc"
          fontWeight="700"
          textAnchor="middle"
        >
          {line}
        </SvgText>
      ))}
    </G>
  );
}

/** Soft-wrap long coaching captions so chips stay readable. */
function wrapLabelLines(text: string, maxChars: number): string[] {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return ['Label'];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    if (w.length > maxChars) {
      // Hard-split very long tokens
      let rest = w;
      while (rest.length > maxChars) {
        lines.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      cur = rest;
    } else {
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function AreaLayer({ area, selected }: { area: WebDiagramV1['areas'][number]; selected: boolean }) {
  if (!area) return null;
  if (area.shape === 'circle') {
    const cx = area.x ?? 50;
    const cy = area.y ?? 50;
    const rx = (area.width ?? 20) / 2;
    return <Circle cx={cx} cy={cy} r={rx} fill="none" stroke={selected ? '#fbbf24' : '#fbbf24'} strokeWidth={selected ? 0.9 : 0.5} />;
  }
  if (area.shape === 'spotlight') {
    const cx = area.x ?? 50;
    const cy = area.y ?? 50;
    const rx = (area.width ?? 30) / 2;
    return <Circle cx={cx} cy={cy} r={rx} fill="url(#spotlightGrad)" />;
  }
  const x = area.x ?? 0;
  const y = area.y ?? 0;
  const w = area.width ?? 20;
  const h = area.height ?? 20;
  return <Rect x={x} y={y} width={w} height={h} fill="none" stroke="#fbbf24" strokeWidth={selected ? 0.9 : 0.5} strokeDasharray="2,1" />;
}

const styles = StyleSheet.create({
  // Edge-to-edge like the mock — no side gutters or inset card.
  wrap: { flex: 1 },
  canvas: { flex: 1, overflow: 'hidden' },
  scale: { alignSelf: 'center' },
});
