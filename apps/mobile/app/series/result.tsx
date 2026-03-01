import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { useGenerateStore } from '../../stores/generate.store';

export default function SeriesResultScreen() {
  const series = useGenerateStore((s) => s.latestSeries) as any;
  const sessions = series?.sessions || [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{series?.title || 'Generated Series'}</Text>
        <Text style={styles.meta}>{sessions.length} sessions</Text>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Session Progression</Text>
          {sessions.length ? (
            sessions.map((item: any, idx: number) => (
              <Text key={`${item?.id || item?.title || 'session'}-${idx}`} style={styles.line}>
                {idx + 1}. {item?.title || `Session ${idx + 1}`}
              </Text>
            ))
          ) : (
            <Text style={styles.line}>No sessions found in response.</Text>
          )}
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
