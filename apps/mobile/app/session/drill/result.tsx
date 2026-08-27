import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../constants/colors';
import { useGenerateStore } from '../../../stores/generate.store';

export default function DrillResultScreen() {
  const drill = useGenerateStore((s) => s.latestDrill) as any;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{drill?.title || 'Generated Drill'}</Text>
        <Text style={styles.meta}>{drill?.ageGroup || '--'} · {drill?.phase || '--'} · {drill?.zone || '--'}</Text>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Coaching Points</Text>
          {(drill?.coachingPoints || []).slice(0, 5).map((point: string, idx: number) => (
            <Text key={`${point}-${idx}`} style={styles.line}>{idx + 1}. {point}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    gap: 12,
    padding: 16,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
  },
  block: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  blockTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  line: {
    color: colors.text,
    fontSize: 14,
  },
});
