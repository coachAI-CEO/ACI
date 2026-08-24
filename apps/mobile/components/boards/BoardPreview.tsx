import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
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
import type {
  WebDiagramArrow,
  WebDiagramBall,
  WebDiagramCone,
  WebDiagramElement,
  WebDiagramFrameLayers,
  WebDiagramGoal,
  WebDiagramPlayer,
  WebDiagramV1,
} from '@aci/shared';
import { PITCH_SPECS } from '@aci/shared';
import { formatFromBoard } from '../../utils/board-format';
import { colors } from '../../constants/colors';

type Orientation = 'HORIZONTAL' | 'VERTICAL';
type Zoom = 'FULL' | 'HALF' | 'THIRD';

type Props = {
  diagram: WebDiagramV1 | null | undefined;
  /** Override the frame inside the sequence. If omitted, the root layers are used. */
  frame?: Partial<WebDiagramFrameLayers> & {
    id?: string;
    title?: string;
    note?: string;
    durationMs?: number;
  } | null;
  /** Override orientation; otherwise reads from `diagram.pitch.orientation`. */
  orientation?: Orientation;
  /** Override zoom; defaults to FULL. */
  zoom?: Zoom;
  /** Show thirds overlay (independent of 7v7 build-out lines). */
  showThirds?: boolean;
  /** Total rendered height in points; width fills the parent. */
  height?: number;
  /** Hide chrome label (the bottom-right "Full"/"Half"/"Rondo"). */
  hideChromeLabel?: boolean;
};

const TOKEN_RADIUS_PCT = 3;

/**
 * Read-only tactical board renderer. Mounts the pitch chrome + diagram
 * layers (areas, cones, elements, goals, balls, players, arrows, coach,
 * labels) into a single SVG so they share the same viewBox / transform.
 *
 * Coordinate convention: 0–100 normalized against the length axis
 * (HORIZONTAL = goal-to-goal across, VERTICAL = top-to-bottom). For
 * VERTICAL the inner groups are rotated -90° around the center so the
 * length axis runs top-to-bottom on the rendered surface.
 */
function BoardPreviewInner({
  diagram,
  frame,
  orientation,
  zoom,
  showThirds,
  height = 240,
  hideChromeLabel,
}: Props) {
  const layers = useMemo<WebDiagramFrameLayers>(() => resolveLayers(diagram, frame), [diagram, frame]);

  const format = formatFromBoard({ ageGroup: null, diagram });
  const orient: Orientation = orientation ?? diagram?.pitch?.orientation ?? 'HORIZONTAL';
  const z: Zoom = zoom ?? 'FULL';
  const thirds = showThirds ?? !!diagram?.pitch?.showThirds;
  const zones = diagram?.pitch?.zones;

  const containerTransform =
    orient === 'VERTICAL' ? [{ rotate: '-90' }, { translateX: '-100' }] : undefined;

  const chromeLabel = hideChromeLabel
    ? null
    : z === 'FULL'
      ? format
      : z === 'HALF'
        ? `${format} · Half`
        : `${format} · Third`;

  return (
    <View style={[styles.wrap, { height, width: '100%' }]} pointerEvents="none">
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

        <G transform={containerTransform as any}>
          <PitchMarkings format={format} zoom={z} showThirds={thirds} zones={zones} />

          {/* Areas (under players/arrows). */}
          {(layers.areas || []).map((a, i) => (
            <AreaLayer key={`area-${i}`} area={a} />
          ))}

          {/* Cones + elements. */}
          {(layers.cones || []).map((c, i) => (
            <Cone key={`cone-${i}`} cone={c} />
          ))}
          {(layers.elements || []).map((el, i) => (
            <ElementToken key={`element-${i}`} element={el} />
          ))}

          {/* Goals. */}
          {(layers.goals || []).map((g, i) => (
            <Goal key={`goal-${i}`} goal={g} />
          ))}

          {/* Balls. */}
          {(layers.balls || []).map((b, i) => (
            <Ball key={`ball-${i}`} ball={b} />
          ))}

          {/* Players. */}
          {(layers.players || []).map((p, i) => (
            <PlayerToken key={p.id || `player-${i}`} player={p} />
          ))}

          {/* Arrows (on top of players so a run-line into a player still shows). */}
          {(layers.arrows || []).map((a, i) => (
            <Arrow key={`arrow-${i}`} arrow={a} layers={layers} />
          ))}

          {/* Coach marker on top. */}
          {layers.coach ? <Coach coach={layers.coach} /> : null}
        </G>

        {/* Labels (always upright). */}
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

        {/* Chrome label — drawn upright, outside the rotated group. */}
        {chromeLabel ? (
          <SvgText x={98} y={97} fontSize={3} fill={colors.muted} textAnchor="end">
            {chromeLabel}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

/**
 * Memoized read-only preview. Re-renders only when the inputs that affect
 * the rendered SVG change (diagram, frame, orientation, zoom, etc.).
 * The callers in `[id].tsx` already pass primitives so shallow-compare
 * is sufficient. Keeping this in place avoids heavy SVG re-renders when,
 * for example, the AI sheet toggles its `visible` flag above the screen.
 */
export const BoardPreview = memo(BoardPreviewInner);

// ─── Pitch markings (inline, share the same <Svg> as the layers above) ───

function PitchMarkings({
  format,
  zoom,
  showThirds,
  zones,
}: {
  format: '7V7' | '9V9' | '11V11';
  zoom: Zoom;
  showThirds: boolean;
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
  const drawThirds = showThirds || spec.buildOutLines;

  const zoneStrips = zones
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
      <PenaltyBox side="AWAY" spec={spec} widthYds={widthYds} />
      <PenaltyBox side="HOME" spec={spec} widthYds={widthYds} />
      <GoalArea side="AWAY" spec={spec} widthYds={widthYds} />
      <GoalArea side="HOME" spec={spec} widthYds={widthYds} />
      {/* Goal posts. */}
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

function PenaltyBox({
  side,
  spec,
  widthYds,
}: {
  side: 'AWAY' | 'HOME';
  spec: (typeof PITCH_SPECS)['7V7' | '9V9' | '11V11'];
  widthYds: number;
}) {
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

function GoalArea({
  side,
  spec,
  widthYds,
}: {
  side: 'AWAY' | 'HOME';
  spec: (typeof PITCH_SPECS)['7V7' | '9V9' | '11V11'];
  widthYds: number;
}) {
  const depth = spec.goalAreaDepthYds;
  const lenToPct = (l: number) => (l / spec.lengthYards) * 100;
  const widToPct = (w: number) => (w / widthYds) * 100;
  const x = side === 'AWAY' ? 0 : lenToPct(spec.lengthYards - depth);
  const w = lenToPct(depth);
  const y = widToPct(widthYds / 2 - spec.goalAreaWidthYds / 2);
  const h = widToPct(spec.goalAreaWidthYds);
  return <Rect x={x} y={y} width={w} height={h} fill="none" stroke="#ffffff" strokeWidth={0.25} />;
}

// ─── Layer renderers ──────────────────────────────────────────────────────

function resolveLayers(
  diagram: WebDiagramV1 | null | undefined,
  frame: Props['frame']
): WebDiagramFrameLayers {
  if (
    frame &&
    (frame.players || frame.arrows || frame.areas || frame.labels || frame.balls || frame.goals || frame.coach || frame.cones || frame.elements)
  ) {
    return {
      players: frame.players || diagram?.players || [],
      arrows: frame.arrows || diagram?.arrows || [],
      areas: frame.areas || diagram?.areas || [],
      labels: frame.labels || diagram?.labels || [],
      balls: frame.balls || diagram?.balls,
      goals: frame.goals || diagram?.goals,
      coach: frame.coach || diagram?.coach,
      cones: frame.cones || diagram?.cones,
      elements: frame.elements || diagram?.elements,
    };
  }
  if (diagram?.sequence?.frames?.length) {
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
    players: diagram?.players || [],
    arrows: diagram?.arrows || [],
    areas: diagram?.areas || [],
    labels: diagram?.labels || [],
    balls: diagram?.balls,
    goals: diagram?.goals,
    coach: diagram?.coach,
    cones: diagram?.cones,
    elements: diagram?.elements,
  };
}

function PlayerToken({ player }: { player: WebDiagramPlayer }) {
  const teamFill =
    player.team === 'ATT' ? '#3b82f6' : player.team === 'DEF' ? '#f97316' : '#94a3b8';
  const r = TOKEN_RADIUS_PCT;
  const showRole = player.labelStyle === 'number-and-role' && player.role;
  return (
    <G>
      {showRole ? (
        <Circle cx={player.x} cy={player.y} r={r + 1.2} fill="none" stroke={teamFill} strokeWidth={0.4} />
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
      {showRole && player.role ? (
        <SvgText
          x={player.x}
          y={player.y + r + 3}
          fontSize={2.2}
          fill="#ffffff"
          fontWeight="600"
          textAnchor="middle"
        >
          {player.role}
        </SvgText>
      ) : null}
    </G>
  );
}

function Arrow({ arrow, layers }: { arrow: WebDiagramArrow; layers: WebDiagramFrameLayers }) {
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
  const dash = arrow.style === 'dashed' ? '2,1' : arrow.style === 'dotted' ? '0.5,1' : undefined;
  const stroke = arrow.weight === 'bold' ? 0.8 : 0.5;

  if (arrow.control) {
    const d = `M ${from.x} ${from.y} Q ${arrow.control.x} ${arrow.control.y} ${to.x} ${to.y}`;
    return <Path d={d} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={dash} strokeLinecap="round" />;
  }
  const path = arrow.path && arrow.path.length > 1
    ? `M ${from.x} ${from.y} ${arrow.path.map((p) => `L ${p.x} ${p.y}`).join(' ')}`
    : `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  return <Path d={path} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={dash} strokeLinecap="round" />;
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

function Ball({ ball }: { ball: WebDiagramBall }) {
  return <Circle cx={ball.x} cy={ball.y} r={1.4} fill="#ffffff" stroke="#111827" strokeWidth={0.3} />;
}

function Goal({ goal }: { goal: WebDiagramGoal }) {
  const w = (goal.width ?? 5) * 1.5;
  return (
    <Rect
      x={goal.x - w / 2}
      y={goal.y - w / 4}
      width={w}
      height={w / 2}
      fill="none"
      stroke="#ffffff"
      strokeWidth={0.4}
    />
  );
}

function Cone({ cone }: { cone: WebDiagramCone }) {
  return <Circle cx={cone.x} cy={cone.y} r={1.2} fill={cone.color || '#fb923c'} stroke="#ffffff" strokeWidth={0.3} />;
}

function ElementToken({ element }: { element: WebDiagramElement }) {
  if (element.kind === 'mini-goal') {
    return (
      <Rect
        x={element.x - 2.5}
        y={element.y - 0.8}
        width={5}
        height={1.6}
        fill="#facc15"
        stroke="#ffffff"
        strokeWidth={0.3}
      />
    );
  }
  if (element.kind === 'mannequin') {
    return <Circle cx={element.x} cy={element.y} r={1.6} fill="#e5e7eb" stroke="#111827" strokeWidth={0.3} />;
  }
  if (element.kind === 'pole') {
    return <Circle cx={element.x} cy={element.y} r={1.0} fill="#f97316" stroke="#ffffff" strokeWidth={0.3} />;
  }
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
      {coach.label ? (
        <SvgText x={coach.x} y={coach.y + 6} fontSize={2.2} fill="#111827" fontWeight="700" textAnchor="middle">
          {coach.label}
        </SvgText>
      ) : null}
    </G>
  );
}

function AreaLayer({ area }: { area: WebDiagramV1['areas'][number] }) {
  if (!area) return null;
  if (area.shape === 'circle') {
    const cx = area.x ?? 50;
    const cy = area.y ?? 50;
    const rx = (area.width ?? 20) / 2;
    return <Circle cx={cx} cy={cy} r={rx} fill="none" stroke="#fbbf24" strokeWidth={0.5} />;
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
  return <Rect x={x} y={y} width={w} height={h} fill="none" stroke="#fbbf24" strokeWidth={0.5} strokeDasharray="2,1" />;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#0d5e2c',
    borderRadius: 8,
    overflow: 'hidden',
  },
});
