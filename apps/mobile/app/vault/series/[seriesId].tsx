import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { describeApiError } from '../../../services/api';
import { getVaultSeries, type VaultSeries, type VaultSession } from '../../../services/vault.service';
import { humanizeLabel } from '../../../utils/format';

export default function VaultSeriesDetailScreen() {
  const { seriesId } = useLocalSearchParams<{ seriesId: string }>();

  const query = useQuery({
    queryKey: ['vault', 'series'],
    queryFn: getVaultSeries,
  });

  const series = useMemo(
    () => (query.data || []).find((entry: VaultSeries) => entry.seriesId === seriesId) || null,
    [query.data, seriesId]
  );

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (query.error || !series) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ErrorMessage message={describeApiError(query.error, 'Series not found.')} />
          <Button title="Back to vault" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const sessions = series.sessions || [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{sessions[0]?.title || 'Progressive series'}</Text>
        <Text style={styles.meta}>
          {series.seriesId} · {series.ageGroup || '--'} ·{' '}
          {series.gameModelId ? humanizeLabel(series.gameModelId) : '--'} · {sessions.length} sessions
        </Text>

        <View style={styles.list}>
          {sessions.map((session: VaultSession, idx: number) => (
            <Pressable
              key={session.id}
              accessibilityRole="button"
              accessibilityLabel={session.title || `Session ${idx + 1}`}
              onPress={() =>
                router.push({ pathname: '/vault/session/[sessionId]', params: { sessionId: session.id } })
              }
              style={styles.card}
            >
              <Text style={styles.cardTitle}>
                {idx + 1}. {session.title || 'Untitled session'}
              </Text>
              <Text style={styles.cardMeta}>
                {session.refCode || session.id} · {session.durationMin || '--'} min
              </Text>
            </Pressable>
          ))}
          {!sessions.length ? <Text style={styles.empty}>No sessions in this series.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  container: { gap: 12, padding: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  meta: { color: colors.muted },
  list: { gap: 10 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  cardMeta: { color: colors.muted, fontSize: 12 },
  empty: { color: colors.muted },
});
