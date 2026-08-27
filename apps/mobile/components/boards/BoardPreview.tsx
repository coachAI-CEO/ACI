import { memo, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
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
import {
  PITCH_SPECS,
  arrowHasHead,
  diagramVisibleBand,
  viewBoxForBand,
  zoomFromPitchVariant,
} from '@aci/shared';
import { formatFromBoard } from '../../utils/board-format';
import { colors } from '../../constants/colors';
import {
  ARROW_STROKE_WIDTH,
  HORIZONTAL_DIAGRAM_TRANSFORM,
  LINE_STROKE,
  PITCH_FILL,
  TOKEN_RADIUS_PCT,
  TOKEN_STROKE,
  arrowDashArray,
  arrowHeadPoints,
  arrowStroke,
  shaftEndBeforeHead,
  stretchAspect,
  teamFill,
  teamNumberFill,
  tokenRadiusY,
} from './boardTheme';

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

/**
 * Read-only tactical board renderer.
 *
 * Diagram space is always x=width, y=length (ATT attacks toward y=0).
 * VERTICAL renders 1:1; HORIZONTAL applies an SVG matrix remap.
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
  const [layoutW, setLayoutW] = useState(0);

  const format = formatFromBoard({ ageGroup: null, diagram });
  const orient: Orientation = orientation ?? diagram?.pitch?.orientation ?? 'VERTICAL';
  const z: Zoom = zoom ?? zoomFromPitchVariant(diagram?.pitch?.variant);
  const thirds = showThirds ?? !!diagram?.pitch?.showThirds;
  const showLanes = !!diagram?.pitch?.showZones;
  const zones = diagram?.pitch?.zones;

  const svgViewBox = useMemo(
    () => viewBoxForBand(diagramVisibleBand(format, z), orient),
    [format, z, orient]
  );
  const visibleBand = useMemo(() => diagramVisibleBand(format, z), [format, z]);

  const diagramTransform =
    orient === 'HORIZONTAL' ? HORIZONTAL_DIAGRAM_TRANSFORM : undefined;

  const playersSorted = useMemo(() => {
    const list = layers.players || [];
    return list
      .map((p, index) => ({ p, index }))
      .sort((a, b) => teamDrawOrder(a.p.team) - teamDrawOrder(b.p.team));
  }, [layers.players]);

  const chromeLabel = hideChromeLabel
    ? null
    : z === 'FULL'
      ? format
      : z === 'HALF'
        ? `${format} · Half`
        : `${format} · Third`;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== layoutW) setLayoutW(w);
  };

  const rx = TOKEN_RADIUS_PCT;
  const ry = tokenRadiusY(rx, layoutW || height, height, orient);
  const aspect = stretchAspect(layoutW || height, height, orient);

  return (
    <View
      style={[styles.wrap, { height, width: '100%', backgroundColor: PITCH_FILL }]}
      pointerEvents="none"
      onLayout={onLayout}
    >
      <Svg width="100%" height="100%" viewBox={svgViewBox} preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="spotlightGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#fbbf24" stopOpacity={0.45} />
            <Stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <G transform={diagramTransform}>
          <PitchMarkings format={format} zoom={z} showThirds={thirds} showLanes={showLanes} zones={zones} />

          {(layers.areas || []).map((a, i) => (
            <AreaLayer key={`area-${i}`} area={a} />
          ))}

          {(layers.cones || []).map((c, i) => (
            <Cone key={`cone-${i}`} cone={c} />
          ))}
          {(layers.elements || []).map((el, i) => (
            <ElementToken key={`element-${i}`} element={el} />
          ))}

          {(layers.goals || []).map((g, i) => (
            <Goal key={`goal-${i}`} goal={g} />
          ))}

          {(layers.balls || []).map((b, i) => (
            <Ball
              key={`ball-${i}`}
              ball={b}
              canvasW={layoutW || height}
              canvasH={height}
              orientation={orient}
            />
          ))}

          {playersSorted.map(({ p, index }) => (
            <PlayerToken key={p.id || `player-${index}`} player={p} rx={rx} ry={ry} />
          ))}

          {(layers.arrows || []).map((a, i) => (
            <Arrow
              key={`arrow-${i}`}
              arrow={a}
              layers={layers}
              aspect={aspect}
            />
          ))}

          {layers.coach ? <Coach coach={layers.coach} /> : null}

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

          {chromeLabel ? (
            <SvgText
              x={visibleBand.xMax - 2}
              y={visibleBand.yMax - 3}
              fontSize={3}
              fill={colors.muted}
              textAnchor="end"
            >
              {chromeLabel}
            </SvgText>
          ) : null}
        </G>
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

function teamDrawOrder(team: WebDiagramPlayer['team']): number {
  if (team === 'ATT') return 0;
  if (team === 'NEUTRAL') return 1;
  return 2;
}

// ─── Pitch markings (inline, share the same <Svg> as the layers above) ───

function PitchMarkings({
  format,
  zoom: _zoom,
  showThirds,
  showLanes = false,
  zones,
}: {
  format: '7V7' | '9V9' | '11V11';
  zoom: Zoom;
  showThirds: boolean;
  showLanes?: boolean;
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
      <PenaltyBox side="AWAY" spec={spec} widthYds={widthYds} />
      <PenaltyBox side="HOME" spec={spec} widthYds={widthYds} />
      <GoalArea side="AWAY" spec={spec} widthYds={widthYds} />
      <GoalArea side="HOME" spec={spec} widthYds={widthYds} />
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
  const y = side === 'AWAY' ? 0 : lenToPct(spec.lengthYards - depth);
  const h = lenToPct(depth);
  const x = widToPct(widthYds / 2 - spec.goalAreaWidthYds / 2);
  const w = widToPct(spec.goalAreaWidthYds);
  return <Rect x={x} y={y} width={w} height={h} fill="none" stroke={LINE_STROKE} strokeWidth={0.28} />;
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
  // Prefer root — live working copy of the active frame.
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

function PlayerToken({
  player,
  rx,
  ry,
}: {
  player: WebDiagramPlayer;
  rx: number;
  ry: number;
}) {
  const fill = teamFill(player.team);
  const numFill = teamNumberFill(player.team);
  const showRole = player.labelStyle === 'number-and-role' && player.role;
  return (
    <G>
      {showRole ? (
        <Ellipse
          cx={player.x}
          cy={player.y}
          rx={rx + 1.2}
          ry={ry + 1.2 * (ry / rx)}
          fill="none"
          stroke={fill}
          strokeWidth={0.35}
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
          y={player.y + ry * 0.35}
          fontSize={Math.min(rx, ry) * 1.05}
          fill={numFill}
          fontWeight="700"
          textAnchor="middle"
        >
          {player.number}
        </SvgText>
      ) : null}
      {showRole && player.role ? (
        <SvgText
          x={player.x}
          y={player.y + ry + 3}
          fontSize={2.2}
          fill="#e2e8f0"
          fontWeight="600"
          textAnchor="middle"
        >
          {player.role}
        </SvgText>
      ) : null}
    </G>
  );
}

function Arrow({
  arrow,
  layers,
  aspect,
}: {
  arrow: WebDiagramArrow;
  layers: WebDiagramFrameLayers;
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
        strokeWidth={stroke}
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
    </G>
  );
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
    backgroundColor: PITCH_FILL,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
