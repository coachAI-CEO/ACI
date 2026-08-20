import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

type Props = {
  diagram: any;
  height?: number;
};

function asPlayers(diagram: any): any[] {
  if (!diagram || typeof diagram !== 'object') return [];
  const frames = diagram?.sequence?.frames;
  if (Array.isArray(frames) && frames[0]?.players) return frames[0].players;
  if (Array.isArray(diagram.players)) return diagram.players;
  return [];
}

function asLines(diagram: any): any[] {
  if (!diagram || typeof diagram !== 'object') return [];
  const elements = Array.isArray(diagram.elements) ? diagram.elements : [];
  return elements.filter(
    (el: any) =>
      el?.type === 'line' ||
      el?.kind === 'line' ||
      (el?.from && el?.to) ||
      (el?.x1 != null && el?.x2 != null)
  );
}

export function BoardPreview({ diagram, height = 240 }: Props) {
  const players = asPlayers(diagram).slice(0, 30);
  const lines = asLines(diagram).slice(0, 40);

  return (
    <View style={[styles.wrap, { height }]}>
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
    backgroundColor: '#062816',
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
});
