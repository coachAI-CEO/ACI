import { StyleSheet, Text, View } from 'react-native';

type Props = {
  drill: any;
};

export function SidelineDrillView({ drill }: Props) {
  const coachingPoints = Array.isArray(drill?.coachingPoints) ? drill.coachingPoints.slice(0, 3) : [];

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{drill?.title || 'Drill'}</Text>
      <Text style={styles.meta}>{drill?.drillType || 'Practice'} · {drill?.durationMin || drill?.duration || 10} min</Text>

      <View style={styles.points}>
        <Text style={styles.pointsLabel}>COACHING POINTS</Text>
        {coachingPoints.length ? (
          coachingPoints.map((point: unknown, idx: number) => (
            <Text key={`${idx}-${point}`} style={styles.point}>{idx + 1}. {String(point)}</Text>
          ))
        ) : (
          <Text style={styles.point}>No coaching points available.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
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
});
