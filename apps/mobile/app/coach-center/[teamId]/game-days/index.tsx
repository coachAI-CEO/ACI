import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../../components/ui/Button';
import { ErrorMessage } from '../../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { colors } from '../../../../constants/colors';
import { describeApiError } from '../../../../services/api';
import { listGameDays } from '../../../../services/coach-center.service';

function formatDate(value?: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export default function GameDaysScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();

  const query = useQuery({
    queryKey: ['coach-center', 'game-days', teamId],
    queryFn: () => listGameDays(String(teamId)),
    enabled: Boolean(teamId),
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (query.error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ErrorMessage message={describeApiError(query.error)} />
          <Button title="Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const items = query.data || [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>Game days</Text>
        <Text style={styles.subtitle}>{items.length} packs</Text>

        {items.length ? (
          items.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.opponent || 'Match day'}</Text>
              <Text style={styles.meta}>
                {formatDate(item.matchDate)}
                {item.kickoffTime ? ` · ${item.kickoffTime}` : ''}
                {item.venue ? ` · ${item.venue}` : ''}
              </Text>
              {item.keyFocus ? <Text style={styles.body}>{item.keyFocus}</Text> : null}
              <Button
                title="Open"
                onPress={() =>
                  router.push({
                    pathname: '/coach-center/[teamId]/game-days/[gameDayId]',
                    params: { teamId: String(teamId), gameDayId: item.id },
                  })
                }
                variant="secondary"
              />
            </View>
          ))
        ) : (
          <Text style={styles.meta}>No game-day docs yet. Create them on the web.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  container: { gap: 12, padding: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  body: { color: colors.text, fontSize: 13, lineHeight: 18 },
  meta: { color: colors.muted, fontSize: 12 },
});
