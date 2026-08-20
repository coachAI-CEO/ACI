import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { describeApiError } from '../../../services/api';
import { getTeamOverview } from '../../../services/coach-center.service';

function formatWhen(value?: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function CoachCenterTeamScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();

  const query = useQuery({
    queryKey: ['coach-center', 'overview', teamId],
    queryFn: () => getTeamOverview(String(teamId)),
    enabled: Boolean(teamId),
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (query.error || !query.data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ErrorMessage message={describeApiError(query.error, 'Could not load team.')} />
          <Button title="Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const { team, upcoming, nextMatch, recommendations } = query.data;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>{team.name}</Text>
        <Text style={styles.subtitle}>
          {team.ageGroup || '--'} · {team.gameModelLabel || team.gameModelId || '--'}
          {team.clubName ? ` · ${team.clubName}` : ''}
        </Text>

        {team.season?.currentWeek ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>This week</Text>
            <Text style={styles.body}>
              Week {team.season.currentWeek.weekIndex}: {team.season.currentWeek.theme || 'Theme TBD'}
            </Text>
            {team.season.currentWeek.focus ? <Text style={styles.meta}>{team.season.currentWeek.focus}</Text> : null}
          </View>
        ) : null}

        {nextMatch ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Next match</Text>
            <Text style={styles.body}>
              {nextMatch.opponent || 'Opponent TBD'} · {formatWhen(nextMatch.matchDate)}
            </Text>
            {nextMatch.venue ? <Text style={styles.meta}>{nextMatch.venue}</Text> : null}
            {nextMatch.keyFocus ? <Text style={styles.meta}>{nextMatch.keyFocus}</Text> : null}
            <Button
              title="Open game days"
              onPress={() =>
                router.push({ pathname: '/coach-center/[teamId]/game-days', params: { teamId: String(teamId) } })
              }
              variant="secondary"
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upcoming sessions</Text>
          {upcoming.length ? (
            upcoming.map((event) => (
              <View key={event.id} style={styles.row}>
                <Text style={styles.body}>{event.session?.title || 'Training'}</Text>
                <Text style={styles.meta}>{formatWhen(event.scheduledDate)}</Text>
                {event.session?.id ? (
                  <Text
                    style={styles.link}
                    onPress={() =>
                      router.push({ pathname: '/sideline/[sessionId]', params: { sessionId: event.session!.id } })
                    }
                  >
                    Start practice
                  </Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.meta}>No upcoming sessions in the next two weeks.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recommended next sessions</Text>
          {recommendations.length ? (
            recommendations.map((item, idx) => (
              <View key={`${item.id || item.refCode || idx}`} style={styles.row}>
                <Text style={styles.body}>{item.title || item.refCode || 'Session'}</Text>
                {item.reason || item.matchReason ? (
                  <Text style={styles.meta}>{item.reason || item.matchReason}</Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.meta}>No recommendations yet.</Text>
          )}
        </View>

        <Button
          title="This week calendar"
          onPress={() => router.push({ pathname: '/coach-center/[teamId]/week', params: { teamId: String(teamId) } })}
        />
        <Button
          title="Game days"
          onPress={() =>
            router.push({ pathname: '/coach-center/[teamId]/game-days', params: { teamId: String(teamId) } })
          }
          variant="secondary"
        />
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
  body: { color: colors.text, fontSize: 14 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  row: { gap: 4, paddingVertical: 4 },
  link: { color: colors.primary, fontWeight: '600' },
});
