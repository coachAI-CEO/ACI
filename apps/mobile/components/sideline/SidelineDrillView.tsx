import { memo, useMemo, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { StoredDrillDiagram } from '../diagram/StoredDrillDiagram';
import { fitSidelineDiagramSvg } from '../../utils/fit-sideline-diagram';
import type { SidelineDrill } from '../../utils/session-payload';

type Props = {
  drill: SidelineDrill;
};

function diagramIdentity(drill: SidelineDrill): string {
  return String(drill?.id || drill?.refCode || drill?.title || 'drill');
}

function diagramHeightForWidth(width: number, aspect: number): number {
  if (width <= 0) return 240;
  // Prefer filling width; keep a tall enough card for pitch readability.
  const raw = width / Math.max(aspect, 0.75);
  return Math.round(Math.min(300, Math.max(220, raw)));
}

export const SidelineDrillView = memo(function SidelineDrillView({ drill }: Props) {
  const coachingPoints = useMemo(() => (drill?.coachingPoints || []).slice(0, 4), [drill?.coachingPoints]);
  const setupSteps = useMemo(() => (drill?.setupSteps || []).slice(0, 3), [drill?.setupSteps]);
  const diagramKey = diagramIdentity(drill);
  const [diagramWidth, setDiagramWidth] = useState(0);

  const fitted = useMemo(() => {
    const raw = drill?.diagramSvg || null;
    if (!raw) return null;
    return fitSidelineDiagramSvg(raw);
  }, [drill?.diagramSvg]);

  const diagramHeight = fitted
    ? diagramHeightForWidth(diagramWidth, fitted.aspect)
    : 220;

  const onDiagramLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== diagramWidth) setDiagramWidth(next);
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} style={styles.scroll}>
      <Text style={styles.title} numberOfLines={2}>
        {drill?.title || 'Drill'}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {drill?.drillType || 'Practice'} · {drill?.durationMin || 10} min
        {drill?.phase ? ` · ${String(drill.phase).replaceAll('_', ' ')}` : ''}
      </Text>

      <View style={[styles.diagram, { height: diagramHeight }]} onLayout={onDiagramLayout}>
        {fitted ? (
          <View style={styles.diagramZoom}>
            <SvgXml key={`${diagramKey}-fit`} xml={fitted.svg} width="100%" height="100%" />
          </View>
        ) : (
          <StoredDrillDiagram
            key={diagramKey}
            drillId={drill?.id || drill?.refCode}
            height={diagramHeight}
            fallback={<Text style={styles.fallback}>Diagram unavailable offline</Text>}
          />
        )}
      </View>

      <View style={styles.points}>
        <Text style={styles.pointsLabel}>COACHING POINTS</Text>
        {coachingPoints.length ? (
          coachingPoints.map((point, idx) => (
            <Text key={`${idx}-${point}`} style={styles.point}>
              {idx + 1}. {point}
            </Text>
          ))
        ) : (
          <Text style={styles.point}>No coaching points available.</Text>
        )}
      </View>

      {setupSteps.length ? (
        <View style={styles.points}>
          <Text style={styles.pointsLabel}>SETUP</Text>
          {setupSteps.map((step, idx) => (
            <Text key={`${idx}-${step}`} style={styles.setup} numberOfLines={2}>
              {idx + 1}. {step}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
});

/** Parse neighbor SVGs off-screen so the next Next/Prev feels instant. */
export function SidelineDiagramWarmup({ drills, index }: { drills: SidelineDrill[]; index: number }) {
  const neighbors = useMemo(() => {
    return [index - 1, index + 1]
      .filter((i) => i >= 0 && i < drills.length)
      .map((i) => drills[i])
      .filter((drill): drill is SidelineDrill => Boolean(drill?.diagramSvg))
      .map((drill) => ({
        key: diagramIdentity(drill),
        svg: fitSidelineDiagramSvg(drill.diagramSvg!).svg,
      }));
  }, [drills, index]);

  if (!neighbors.length) return null;

  return (
    <View pointerEvents="none" style={styles.warmup}>
      {neighbors.map((item) => (
        <SvgXml key={`warm-${item.key}`} xml={item.svg} width={1} height={1} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  wrap: {
    gap: 8,
    paddingBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  meta: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
  diagram: {
    backgroundColor: '#0a0d10',
    borderColor: '#374151',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  diagramZoom: {
    flex: 1,
  },
  fallback: {
    color: '#6b7280',
    fontSize: 12,
    padding: 12,
  },
  points: {
    gap: 4,
  },
  pointsLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  point: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  setup: {
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 18,
  },
  warmup: {
    height: 0,
    overflow: 'hidden',
    position: 'absolute',
    width: 0,
  },
});
