import { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {
  PITCH_SPECS,
  type PitchFormatId,
  type PitchZoom,
  type WebDiagramArrow,
  type WebDiagramArea,
  type WebDiagramBall,
  type WebDiagramCone,
  type WebDiagramElement,
  type WebDiagramFrameLayers,
  type WebDiagramLabel,
  type WebDiagramPlayer,
  type WebDiagramV1,
} from '@aci/shared';
import { colors } from '../../constants/colors';

type Orientation = 'HORIZONTAL' | 'VERTICAL';
export type Tool = 'move' | 'player' | 'arrow' | 'shape' | 'label' | 'erase';
type Team = 'ATT' | 'DEF' | 'NEUTRAL';

type Props = {
  diagram: WebDiagramV1;
  format: PitchFormatId;
  orientation: Orientation;
  zoom: PitchZoom;
  tool: Tool;
  team: Team;
  /** Composite selected-entity key — `player:<idx>`, `arrow:<idx>`, or `label:<idx>`. */
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  /** Detail-popover callback when a player is selected. */
  onPlayerEdit?: (index: number) => void;
  onDiagramChange: (next: WebDiagramV1) => void;
};

const TOKEN_RADIUS_PCT = 3;
const HIT_RADIUS_PCT = 3.5;
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
export function BoardCanvas({
  diagram,
  format,
  orientation,
  zoom,
  tool,
  team,
  selectedKey,
  onSelect,
  onPlayerEdit,
  onDiagramChange,
}: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [draftArrow, setDraftArrow] = useState<{ fromX: number; fromY: number; toX: number; toY: number } | null>(null);
  const dragRef = useRef<{ key: string; type: 'player' | 'label'; startX: number; startY: number } | null>(null);

  const layers = useMemo<WebDiagramFrameLayers>(() => resolveLayers(diagram), [diagram]);

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

  const handleTap = useCallback(
    (px: number, py: number) => {
      const hit = findHit(layers, px, py, HIT_RADIUS_PCT);
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
        commit({ ...diagram, players: [...players, newPlayer] });
        onSelect(`player:${players.length}`);
        return;
      }
      if (tool === 'label') {
        const labels = diagram.labels || [];
        const newLabel: WebDiagramLabel = { x: px, y: py, text: 'Label' };
        commit({ ...diagram, labels: [...labels, newLabel] });
        onSelect(`label:${labels.length}`);
        return;
      }
      if (tool === 'arrow') {
        if (!draftArrow) {
          setDraftArrow({ fromX: px, fromY: py, toX: px, toY: py });
          return;
        }
        const newArrow: WebDiagramArrow = {
          from: { x: draftArrow.fromX, y: draftArrow.fromY },
          to: { x: px, y: py },
          type: 'pass',
          style: 'solid',
          weight: 'normal',
        };
        commit({ ...diagram, arrows: [...(diagram.arrows || []), newArrow] });
        setDraftArrow(null);
        return;
      }
      if (tool === 'shape') {
        const areas = diagram.areas || [];
        const newArea: WebDiagramArea = { x: px, y: py, width: 16, height: 16, shape: 'spotlight' };
        commit({ ...diagram, areas: [...areas, newArea] });
        return;
      }
      // move tool
      onSelect(hit ? `${hit.kind}:${hit.index}` : null);
    },
    [tool, team, draftArrow, diagram, layers, commit, onSelect]
  );

  const handlePanStart = useCallback(
    (px: number, py: number) => {
      if (tool !== 'move') return;
      const hit = findHit(layers, px, py, HIT_RADIUS_PCT);
      if (!hit || (hit.kind !== 'player' && hit.kind !== 'label')) return;
      dragRef.current = { key: `${hit.kind}:${hit.index}`, type: hit.kind, startX: px, startY: py };
      onSelect(`${hit.kind}:${hit.index}`);
    },
    [tool, layers, onSelect]
  );

  const handlePanMove = useCallback(
    (dpx: number, dpy: number) => {
      if (tool !== 'move' || !dragRef.current) return;
      const idx = indexFromKey(dragRef.current.key);
      if (idx == null) return;
      if (dragRef.current.type === 'player') {
        commit({
          ...diagram,
          players: (diagram.players || []).map((p, i) =>
            i === idx ? { ...p, x: clamp(p.x + dpx, 0, 100), y: clamp(p.y + dpy, 0, 100) } : p
          ),
        });
      } else {
        commit({
          ...diagram,
          labels: (diagram.labels || []).map((l, i) =>
            i === idx ? { ...l, x: clamp(l.x + dpx, 0, 100), y: clamp(l.y + dpy, 0, 100) } : l
          ),
        });
      }
    },
    [tool, diagram, commit]
  );

  const handlePanEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handlePinch = useCallback((s: number) => {
    setScale(Math.max(0.5, Math.min(2.5, s)));
  }, []);

  // ─── Gestures ──────────────────────────────────────────────────────
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(500)
        .onEnd((event) => {
          const vw = size.w / scale;
          const vh = size.h / scale;
          const px = (event.x / vw) * 100;
          const py = (event.y / vh) * 100;
          if (px < 0 || px > 100 || py < 0 || py > 100) return;
          runOnJS(handleTap)(px, py);
        }),
    [size, scale, handleTap]
  );

  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(450)
        .onEnd((event) => {
          const vw = size.w / scale;
          const vh = size.h / scale;
          const px = (event.x / vw) * 100;
          const py = (event.y / vh) * 100;
          runOnJS(handleLongPress)(px, py);
        }),
    [size, scale, layers, onPlayerEdit]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(2)
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
          const dpx = (event.translationX / vw) * 100;
          const dpy = (event.translationY / vh) * 100;
          runOnJS(handlePanMove)(dpx, dpy);
        })
        .onEnd(() => runOnJS(handlePanEnd)()),
    [size, scale, handlePanStart, handlePanMove, handlePanEnd]
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

  function handleLongPress(px: number, py: number) {
    const hit = findHit(layers, px, py, HIT_RADIUS_PCT);
    if (hit?.kind === 'player') onPlayerEdit?.(hit.index);
  }

  const containerStyle =
    orientation === 'VERTICAL'
      ? ({ transform: [{ rotate: '-90deg' }, { translateX: -100 }] } as any)
      : undefined;

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <GestureDetector gesture={composed}>
        <View style={styles.canvas} onLayout={onLayout}>
          {size.w > 0 && size.h > 0 ? (
            <View
              style={[
                styles.scale,
                {
                  width: size.w * 0.9,
                  height: size.h * 0.9,
                  transform: [{ scale }],
                },
              ]}
            >
              <Svg
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
              >
                <Defs>
                  <RadialGradient id="spotlightGrad" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="#fbbf24" stopOpacity={0.45} />
                    <Stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <G transform={containerStyle}>
                  <PitchMarkings format={format} zoom={zoom} zones={diagram.pitch?.zones} />
                  {(layers.areas || []).map((a, i) => (
                    <AreaLayer key={`area-${i}`} area={a} selected={selectedKey === `area:${i}`} />
                  ))}
                  {(layers.cones || []).map((c, i) => <Cone key={`cone-${i}`} cone={c} />)}
                  {(layers.elements || []).map((el, i) => (
                    <ElementToken key={`el-${i}`} element={el} />
                  ))}
                  {(layers.goals || []).map((g, i) => <Goal key={`goal-${i}`} goal={g} />)}
                  {(layers.balls || []).map((b, i) => <Ball key={`ball-${i}`} ball={b} />)}
                  {(layers.players || []).map((p, i) => (
                    <PlayerToken
                      key={`p-${p.id || i}`}
                      player={p}
                      selected={selectedKey === `player:${i}`}
                    />
                  ))}
                  {(layers.arrows || []).map((a, i) => (
                    <Arrow
                      key={`arrow-${i}`}
                      arrow={a}
                      layers={layers}
                      selected={selectedKey === `arrow:${i}`}
                    />
                  ))}
                  {layers.coach ? <Coach coach={layers.coach} /> : null}
                </G>
                {(layers.labels || []).map((l, i) => (
                  <SvgText
                    key={`label-${i}`}
                    x={l.x}
                    y={l.y}
                    fontSize={3}
                    fill={colors.text}
                    textAnchor="middle"
                  >
                    {l.text}
                  </SvgText>
                ))}
                {draftArrow ? (
                  <Line
                    x1={draftArrow.fromX}
                    y1={draftArrow.fromY}
                    x2={draftArrow.toX}
                    y2={draftArrow.toY}
                    stroke="#22c55e"
                    strokeWidth={0.7}
                    strokeDasharray="2,2"
                  />
                ) : null}
              </Svg>
            </View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

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

type Hit = { kind: 'player' | 'arrow' | 'label' | 'area'; index: number };

function findHit(layers: WebDiagramFrameLayers, px: number, py: number, radius: number): Hit | null {
  (layers.players || []).forEach((p, i) => {
    if (dist(p.x, p.y, px, py) <= radius) return { kind: 'player', index: i } as Hit;
  });
  for (let i = 0; i < (layers.players || []).length; i++) {
    const p = (layers.players || [])[i];
    if (dist(p.x, p.y, px, py) <= radius) return { kind: 'player', index: i };
  }
  for (let i = 0; i < (layers.arrows || []).length; i++) {
    const a = (layers.arrows || [])[i];
    const from = resolvePoint(a.from, layers);
    const to = resolvePoint(a.to, layers);
    if (from && to && pointToSegment(px, py, from.x, from.y, to.x, to.y) <= radius) {
      return { kind: 'arrow', index: i };
    }
  }
  for (let i = 0; i < (layers.labels || []).length; i++) {
    const l = (layers.labels || [])[i];
    if (dist(l.x, l.y, px, py) <= radius) return { kind: 'label', index: i };
  }
  return null;
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
  if (diagram.sequence?.frames?.length) {
    const activeId = diagram.sequence.activeFrameId;
    const active = activeId ? diagram.sequence.frames.find((f) => f.id === activeId) : diagram.sequence.frames[0];
    if (active) {
      return {
        players: active.players || [],
        arrows: active.arrows || [],
        areas: active.areas || [],
        labels: active.labels || [],
        balls: active.balls,
        goals: active.goals,
        coach: active.coach,
        cones: active.cones,
        elements: active.elements,
      };
    }
  }
  return {
    players: diagram.players || [],
    arrows: diagram.arrows || [],
    areas: diagram.areas || [],
    labels: diagram.labels || [],
    balls: diagram.balls,
    goals: diagram.goals,
    coach: diagram.coach,
    cones: diagram.cones,
    elements: diagram.elements,
  };
}

function PitchMarkings({
  format,
  zoom,
  zones,
}: {
  format: PitchFormatId;
  zoom: PitchZoom;
  zones?: WebDiagramV1['pitch']['zones'];
}) {
  const spec = PITCH_SPECS[format];
  const widthYds = spec.widthYards;
  const lenToPct = (l: number) => (l / spec.lengthYards) * 100;
  const widToPct = (w: number) => (w / widthYds) * 100;
  const halfW = widToPct(widthYds / 2);
  const midLen = lenToPct(spec.lengthYards / 2);
  const ccRadius = (spec.centerCircleRadiusYds / spec.lengthYards) * 100;
  const third1 = lenToPct(spec.lengthYards / 3);
  const third2 = lenToPct((2 * spec.lengthYards) / 3);
  const drawThirds = !!spec.buildOutLines;

  const zoneStrips = zones
    ? [
        { x: 0, w: 10, show: !!zones.leftWide },
        { x: 10, w: 15, show: !!zones.leftHalfSpace },
        { x: 25, w: 50, show: !!zones.centralChannel },
        { x: 75, w: 15, show: !!zones.rightHalfSpace },
        { x: 90, w: 10, show: !!zones.rightWide },
      ].filter((s) => s.show)
    : [];

  void zoom;

  return (
    <>
      <Rect x={0} y={0} width={100} height={100} fill="#0d5e2c" />
      {zoneStrips.map((s, i) => (
        <Rect key={`zone-${i}`} x={s.x} y={0} width={s.w} height={100} fill="#ffffff" opacity={0.06} />
      ))}
      <Line x1={0} y1={0} x2={100} y2={0} stroke="#ffffff" strokeWidth={0.4} />
      <Line x1={0} y1={100} x2={100} y2={100} stroke="#ffffff" strokeWidth={0.4} />
      <Line x1={0} y1={0} x2={0} y2={100} stroke="#ffffff" strokeWidth={0.4} />
      <Line x1={100} y1={0} x2={100} y2={100} stroke="#ffffff" strokeWidth={0.4} />
      <Line x1={midLen} y1={0} x2={midLen} y2={100} stroke="#ffffff" strokeWidth={0.3} />
      <Circle cx={midLen} cy={50} r={ccRadius} fill="none" stroke="#ffffff" strokeWidth={0.3} />
      <Circle cx={midLen} cy={50} r={0.4} fill="#ffffff" />
      <PenRect side="AWAY" spec={spec} widthYds={widthYds} />
      <PenRect side="HOME" spec={spec} widthYds={widthYds} />
      <GoalRect side="AWAY" spec={spec} widthYds={widthYds} />
      <GoalRect side="HOME" spec={spec} widthYds={widthYds} />
      <Rect x={-0.6} y={halfW - 1.5} width={0.6} height={3} fill="#ffffff" opacity={0.85} />
      <Rect x={100} y={halfW - 1.5} width={0.6} height={3} fill="#ffffff" opacity={0.85} />
      {drawThirds ? (
        <>
          <Line x1={third1} y1={0} x2={third1} y2={100} stroke="#ffffff" strokeWidth={0.2} strokeDasharray="1,1" />
          <Line x1={third2} y1={0} x2={third2} y2={100} stroke="#ffffff" strokeWidth={0.2} strokeDasharray="1,1" />
        </>
      ) : null}
    </>
  );
}

function PenRect({ side, spec, widthYds }: { side: 'AWAY' | 'HOME'; spec: (typeof PITCH_SPECS)[PitchFormatId]; widthYds: number }) {
  const depth = spec.penaltyDepthYds;
  const lenToPct = (l: number) => (l / spec.lengthYards) * 100;
  const widToPct = (w: number) => (w / widthYds) * 100;
  const x = side === 'AWAY' ? 0 : lenToPct(spec.lengthYards - depth);
  const w = lenToPct(depth);
  const y = widToPct(widthYds / 2 - spec.penaltyWidthYds / 2);
  const h = widToPct(spec.penaltyWidthYds);
  const spotX = side === 'AWAY' ? lenToPct(spec.penaltySpotYds) : lenToPct(spec.lengthYards - spec.penaltySpotYds);
  return (
    <>
      <Rect x={x} y={y} width={w} height={h} fill="none" stroke="#ffffff" strokeWidth={0.3} />
      <Circle cx={spotX} cy={50} r={0.4} fill="#ffffff" />
    </>
  );
}

function GoalRect({ side, spec, widthYds }: { side: 'AWAY' | 'HOME'; spec: (typeof PITCH_SPECS)[PitchFormatId]; widthYds: number }) {
  const depth = spec.goalAreaDepthYds;
  const lenToPct = (l: number) => (l / spec.lengthYards) * 100;
  const widToPct = (w: number) => (w / widthYds) * 100;
  const x = side === 'AWAY' ? 0 : lenToPct(spec.lengthYards - depth);
  const w = lenToPct(depth);
  const y = widToPct(widthYds / 2 - spec.goalAreaWidthYds / 2);
  const h = widToPct(spec.goalAreaWidthYds);
  return <Rect x={x} y={y} width={w} height={h} fill="none" stroke="#ffffff" strokeWidth={0.25} />;
}

function PlayerToken({ player, selected }: { player: WebDiagramPlayer; selected: boolean }) {
  const teamFill = player.team === 'ATT' ? '#3b82f6' : player.team === 'DEF' ? '#f97316' : '#94a3b8';
  const r = TOKEN_RADIUS_PCT;
  return (
    <G>
      {selected ? (
        <Circle cx={player.x} cy={player.y} r={r + 1.6} fill="none" stroke="#fbbf24" strokeWidth={0.5} strokeDasharray="1,1" />
      ) : null}
      <Circle cx={player.x} cy={player.y} r={r} fill={teamFill} stroke="#ffffff" strokeWidth={0.5} />
      {typeof player.number === 'number' ? (
        <SvgText
          x={player.x}
          y={player.y + 1}
          fontSize={r * 0.9}
          fill="#ffffff"
          fontWeight="700"
          textAnchor="middle"
        >
          {player.number}
        </SvgText>
      ) : null}
    </G>
  );
}

function Arrow({ arrow, layers, selected }: { arrow: WebDiagramArrow; layers: WebDiagramFrameLayers; selected: boolean }) {
  const from = resolvePoint(arrow.from, layers);
  const to = resolvePoint(arrow.to, layers);
  if (!from || !to) return null;
  const color =
    arrow.type === 'pass'
      ? '#22c55e'
      : arrow.type === 'run'
        ? '#3b82f6'
        : arrow.type === 'press'
          ? '#ef4444'
          : arrow.type === 'cover'
            ? '#a855f7'
            : '#fb923c';
  const stroke = arrow.weight === 'bold' ? 1.2 : 0.7;
  return (
    <Path
      d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
      fill="none"
      stroke={color}
      strokeWidth={selected ? stroke + 0.4 : stroke}
      strokeLinecap="round"
    />
  );
}

function Ball({ ball }: { ball: WebDiagramBall }) {
  return <Circle cx={ball.x} cy={ball.y} r={1.4} fill="#ffffff" stroke="#111827" strokeWidth={0.3} />;
}

function Goal({ goal }: { goal: NonNullable<WebDiagramV1['goals']>[number] }) {
  if (!goal) return null;
  const w = (goal.width ?? 5) * 1.5;
  return (
    <Rect x={goal.x - w / 2} y={goal.y - w / 4} width={w} height={w / 2} fill="none" stroke="#ffffff" strokeWidth={0.4} />
  );
}

function Cone({ cone }: { cone: WebDiagramCone }) {
  return <Circle cx={cone.x} cy={cone.y} r={1.2} fill={cone.color || '#fb923c'} stroke="#ffffff" strokeWidth={0.3} />;
}

function ElementToken({ element }: { element: WebDiagramElement }) {
  if (element.kind === 'mini-goal') {
    return <Rect x={element.x - 2.5} y={element.y - 0.8} width={5} height={1.6} fill="#facc15" stroke="#ffffff" strokeWidth={0.3} />;
  }
  if (element.kind === 'mannequin') return <Circle cx={element.x} cy={element.y} r={1.6} fill="#e5e7eb" stroke="#111827" strokeWidth={0.3} />;
  if (element.kind === 'pole') return <Circle cx={element.x} cy={element.y} r={1.0} fill="#f97316" stroke="#ffffff" strokeWidth={0.3} />;
  return <Circle cx={element.x} cy={element.y} r={1.4} fill={element.color || '#fb923c'} stroke="#ffffff" strokeWidth={0.3} />;
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
  wrap: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
  canvas: { backgroundColor: '#0d5e2c', borderRadius: 12, flex: 1, overflow: 'hidden' },
  scale: { alignSelf: 'center' },
});
