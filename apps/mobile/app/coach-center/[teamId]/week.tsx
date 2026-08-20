import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { describeApiError } from '../../../services/api';
import { getTeamWeekCalendar, mondayUtcIso } from '../../../services/coach-center.service';

function shiftWeek(iso: string, deltaWeeks: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaWeeks * 7);
  return date.toISOString().slice(0, 10);
}

export default function CoachCenterWeekScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const [weekStart, setWeekStart] = useState(mondayUtcIso());

  const query = useQuery({
    queryKey: ['coach-center', 'week', teamId, weekStart],
    queryFn: () => getTeamWeekCalendar(String(teamId), weekStart),
    enabled: Boolean(teamId),
  });

  const title = useMemo(() => `Week of ${weekStart}`, [weekStart]);

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
          <ErrorMessage message={describeApiError(query.error)} />
          <Button title="Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
      >
        <Text style={styles.title}>{query.data.team.name}</Text>
        <Text style={styles.subtitle}>{title}</Text>

        <View style={styles.navRow}>
          <Button title="Prev" onPress={() => setWeekStart((value) => shiftWeek(value, -1))} variant="secondary" />
          <Button title="This week" onPress={() => setWeekStart(mondayUtcIso())} variant="secondary" />
          <Button title="Next" onPress={() => setWeekStart((value) => shiftWeek(value, 1))} variant="secondary" />
        </View>

        {query.data.days.map((day) => (
          <View key={day.date} style={styles.card}>
            <Text style={styles.cardTitle}>
              {day.dayLabel} · {day.date}
            </Text>
            {day.events.length ? (
              day.events.map((event) => (
                <View key={event.id} style={styles.row}>
                  <Text style={styles.body}>
                    {event.time} · {event.session?.title || 'Training'}
                    {event.forThisTeam ? '' : ' (other team)'}
                  </Text>
                  {event.location ? <Text style={styles.meta}>{event.location}</Text> : null}
                  {event.session?.id ? (
                    <Text
                      style={styles.link}
                      onPress={() =>
                        router.push({
                          pathname: '/sideline/[sessionId]',
                          params: { sessionId: event.session!.id },
                        })
                      }
                    >
                      Start practice
                    </Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text style={styles.meta}>No events</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  container: { gap: 12, padding: 16, paddingBottom: 28 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.muted },
  navRow: { flexDirection: 'row', gap: 8 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  body: { color: colors.text, fontSize: 14 },
  meta: { color: colors.muted, fontSize: 12 },
  row: { gap: 4 },
  link: { color: colors.primary, fontWeight: '600' },
});
