import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { StoredDrillDiagram } from '../diagram/StoredDrillDiagram';
import type { SidelineDrill } from '../../utils/session-payload';

type Props = {
  drill: SidelineDrill;
};

export function SidelineDrillView({ drill }: Props) {
  const coachingPoints = (drill?.coachingPoints || []).slice(0, 3);
  const setupSteps = (drill?.setupSteps || []).slice(0, 3);

  return (
    <ScrollView contentContainerStyle={styles.wrap} style={styles.scroll}>
      <Text style={styles.title}>{drill?.title || 'Drill'}</Text>
      <Text style={styles.meta}>
        {drill?.drillType || 'Practice'} · {drill?.durationMin || 10} min
        {drill?.phase ? ` · ${String(drill.phase).replaceAll('_', ' ')}` : ''}
      </Text>

      <View style={styles.diagram}>
        {drill?.diagramSvg ? (
          <SvgXml xml={drill.diagramSvg} width="100%" height="100%" />
        ) : (
          <StoredDrillDiagram
            drillId={drill?.id || drill?.refCode}
            height={180}
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
            <Text key={`${idx}-${step}`} style={styles.setup}>
              {idx + 1}. {step}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  wrap: {
    gap: 12,
    paddingBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
  },
  meta: {
    color: '#9ca3af',
    fontSize: 18,
  },
  diagram: {
    backgroundColor: '#0a0d10',
    borderColor: '#374151',
    borderRadius: 10,
    borderWidth: 1,
    height: 180,
    overflow: 'hidden',
  },
  fallback: {
    color: '#6b7280',
    fontSize: 13,
    padding: 12,
  },
  points: {
    gap: 8,
  },
  pointsLabel: {
    color: '#9ca3af',
    fontSize: 11,
    letterSpacing: 1,
  },
  point: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 28,
  },
  setup: {
    color: '#d1d5db',
    fontSize: 16,
    lineHeight: 22,
  },
});
