import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

type Props = {
  diagram: any;
  /** Optional frame override from diagram.sequence.frames[i] */
  frame?: any;
  height?: number;
};

function asPlayers(source: any): any[] {
  if (!source || typeof source !== 'object') return [];
  if (Array.isArray(source.players)) return source.players;
  return [];
}

function asLines(source: any): any[] {
  if (!source || typeof source !== 'object') return [];
  const elements = Array.isArray(source.elements) ? source.elements : [];
  const arrows = Array.isArray(source.arrows) ? source.arrows : [];
  const fromElements = elements.filter(
    (el: any) =>
      el?.type === 'line' ||
      el?.kind === 'line' ||
      (el?.from && el?.to) ||
      (el?.x1 != null && el?.x2 != null)
  );
  const fromArrows = arrows.map((arrow: any) => ({
    from: arrow?.from || { x: arrow?.x1, y: arrow?.y1 },
    to: arrow?.to || { x: arrow?.x2, y: arrow?.y2 },
  }));
  return [...fromElements, ...fromArrows];
}

function resolveSource(diagram: any, frame?: any): any {
  if (frame && typeof frame === 'object') return frame;
  if (!diagram || typeof diagram !== 'object') return {};
  const frames = diagram?.sequence?.frames;
  if (Array.isArray(frames) && frames[0]) return frames[0];
  return diagram;
}

export function BoardPreview({ diagram, frame, height = 240 }: Props) {
  const source = resolveSource(diagram, frame);
  const players = asPlayers(source).slice(0, 30);
  const lines = asLines(source).slice(0, 40);
  const width = Dimensions.get('window').width - 32;

  return (
    <View style={[styles.wrap, { height, width }]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 70">
        <Rect x={0} y={0} width={100} height={70} fill="#0a3d1f" />
        <Rect x={2} y={2} width={96} height={66} stroke="rgba(255,255,255,0.35)" strokeWidth={0.6} fill="none" />
        <Line x1={50} y1={2} x2={50} y2={68} stroke="rgba(255,255,255,0.25)" strokeWidth={0.5} />
        {lines.map((line: any, idx: number) => (
          <Line
            key={`l-${idx}`}
            x1={Number(line?.from?.x ?? line?.x1 ?? 10)}
            y1={Number(line?.from?.y ?? line?.y1 ?? 10)}
            x2={Number(line?.to?.x ?? line?.x2 ?? 90)}
            y2={Number(line?.to?.y ?? line?.y2 ?? 60)}
            stroke="#93c5fd"
            strokeWidth={0.7}
          />
        ))}
        {players.map((player: any, idx: number) => {
          const team = String(player?.team || '').toUpperCase();
          const fill = team === 'DEF' ? '#ef4444' : team === 'NEUTRAL' ? '#f59e0b' : '#22c55e';
          const cx = Number(player?.x || 50);
          const cy = Number(player?.y || 35);
          return <Circle key={`c-${idx}`} cx={cx} cy={cy} r={2.1} fill={fill} />;
        })}
        {players.map((player: any, idx: number) => {
          const label = String(player?.role || player?.label || player?.number || '').slice(0, 3);
          if (!label) return null;
          return (
            <SvgText
              key={`t-${idx}`}
              x={Number(player?.x || 50)}
              y={Number(player?.y || 35) + 1}
              fill="#ffffff"
              fontSize={2.4}
              fontWeight="700"
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    backgroundColor: '#062816',
    borderRadius: 12,
    overflow: 'hidden',
  },
});
