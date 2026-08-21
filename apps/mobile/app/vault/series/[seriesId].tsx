import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { describeApiError } from '../../../services/api';
import { createCalendarEvent, countEventsBySessionId, getVaultCalendarEvents } from '../../../services/calendar.service';
import { getVaultSeries, type VaultSeries, type VaultSession } from '../../../services/vault.service';
import { formatGameModelLabel, formatPhaseLabel, formatZoneLabel } from '../../../utils/format';

function seriesDisplayTitle(series: VaultSeries): string {
  const first = series.sessions?.[0];
  if (first?.title) {
    const stripped = first.title
      .replace(/^(Session\s*\d+:?\s*-?\s*)/i, '')
      .replace(/^(Wk\.?\s*\d+:?\s*-?\s*)/i, '')
      .replace(/^(Week\s*\d+:?\s*-?\s*)/i, '')
      .replace(/\s*-\s*Part\s*\d+\s*$/i, '')
      .replace(/\s*\(\s*Part\s*\d+\s*\)\s*$/i, '')
      .trim();
    if (stripped) return stripped;
  }
  const age = series.ageGroup || first?.ageGroup;
  const model = formatGameModelLabel(series.gameModelId || first?.gameModelId);
  return age ? `${model} series (${age})` : `${model} series`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function nextWeekdayAt(start: Date, weekday: number, hour: number, minute: number): Date {
  const d = new Date(start);
  d.setHours(hour, minute, 0, 0);
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export default function VaultSeriesDetailScreen() {
  const { seriesId } = useLocalSearchParams<{ seriesId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSummary, setScheduleSummary] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['vault', 'series'],
    queryFn: getVaultSeries,
  });

  const calendarQuery = useQuery({
    queryKey: ['vault', 'calendar-counts'],
    queryFn: getVaultCalendarEvents,
    enabled: Boolean(user?.features?.canAccessCalendar),
    staleTime: 60_000,
  });

  const series = useMemo(
    () => (query.data || []).find((entry: VaultSeries) => entry.seriesId === seriesId) || null,
    [query.data, seriesId]
  );

  const sessionCalendarCounts = useMemo(
    () => countEventsBySessionId(calendarQuery.data || []),
    [calendarQuery.data]
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
  const first = sessions[0];
  const scheduledParts = sessions.filter((session) => (sessionCalendarCounts[session.id] || 0) > 0).length;
  const unscheduledParts = sessions.filter((session) => (sessionCalendarCounts[session.id] || 0) === 0);

  const onScheduleAll = async () => {
    if (!unscheduledParts.length) return;
    setScheduling(true);
    setScheduleError(null);
    setScheduleSummary(null);
    try {
      const now = new Date();
      const start = nextWeekdayAt(now, 3, 18, 0); // next Wednesday 6pm local
      let created = 0;
      for (let i = 0; i < unscheduledParts.length; i++) {
        const when = new Date(start);
        when.setDate(start.getDate() + i * 7);
        await createCalendarEvent({
          sessionId: unscheduledParts[i].id,
          scheduledDate: when.toISOString(),
          durationMin: Number(unscheduledParts[i].durationMin) || 60,
        });
        created += 1;
      }
      setScheduleSummary(
        `Scheduled ${created} session${created === 1 ? '' : 's'} on consecutive ${WEEKDAYS[3]}s at 6:00 PM.`
      );
      await queryClient.invalidateQueries({ queryKey: ['vault', 'calendar-counts'] });
    } catch (err) {
      setScheduleError(describeApiError(err, 'Could not schedule the series.'));
    } finally {
      setScheduling(false);
    }
  };

  const onScheduleOne = (session: VaultSession) => {
    Alert.alert(
      'Schedule session?',
      `Open the session detail to pick a date and time for “${session.title || 'Untitled session'}”.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open session',
          onPress: () =>
            router.push({ pathname: '/vault/session/[sessionId]', params: { sessionId: session.id } }),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title} numberOfLines={3}>
          {seriesDisplayTitle(series) || 'Untitled series'}
        </Text>
        <Text style={styles.meta}>
          {first?.refCode || series.seriesId} · {formatGameModelLabel(series.gameModelId || first?.gameModelId)} ·{' '}
          {sessions.length} sessions
          {first?.phase ? ` · ${formatPhaseLabel(first.phase)}` : ''}
          {first?.zone ? ` · ${formatZoneLabel(first.zone)}` : ''}
        </Text>

        {scheduledParts > 0 ? (
          <View style={styles.calendarBanner}>
            <Text style={styles.calendarBannerTitle}>On your calendar</Text>
            <Text style={styles.calendarBannerMeta}>
              {scheduledParts} of {sessions.length} sessions already scheduled
            </Text>
          </View>
        ) : null}

        {user?.features?.canAccessCalendar && unscheduledParts.length > 0 ? (
          <View style={styles.scheduleAllWrap}>
            <Button
              title={`Schedule all ${unscheduledParts.length} unscheduled`}
              onPress={() => void onScheduleAll()}
              loading={scheduling}
            />
            <Text style={styles.scheduleAllHint}>Weekly on {WEEKDAYS[3]}s at 6:00 PM, starting next {WEEKDAYS[3]}.</Text>
          </View>
        ) : null}

        {scheduleError ? <ErrorMessage message={scheduleError} /> : null}
        {scheduleSummary ? <Text style={styles.status}>{scheduleSummary}</Text> : null}

        <View style={styles.list}>
          {sessions.map((session: VaultSession, idx: number) => {
            const count = sessionCalendarCounts[session.id] || 0;
            return (
              <Pressable
                key={session.id}
                accessibilityRole="button"
                accessibilityLabel={session.title || `Session ${idx + 1}`}
                onPress={() =>
                  router.push({ pathname: '/vault/session/[sessionId]', params: { sessionId: session.id } })
                }
                onLongPress={() => onScheduleOne(session)}
                style={styles.card}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>
                    {idx + 1}. {session.title || 'Untitled session'}
                  </Text>
                  {count > 0 ? (
                    <View style={styles.onCalPill}>
                      <Text style={styles.onCalPillText}>On calendar</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardMeta}>
                  {session.refCode || session.id} · {session.durationMin || '--'} min
                  {count > 0 ? ` · ${count} scheduled` : ''}
                </Text>
              </Pressable>
            );
          })}
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
  calendarBanner: {
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderColor: 'rgba(59,130,246,0.4)',
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  calendarBannerTitle: { color: '#93c5fd', fontSize: 14, fontWeight: '800' },
  calendarBannerMeta: { color: '#bfdbfe', fontSize: 12, fontWeight: '600' },
  scheduleAllWrap: { gap: 4 },
  scheduleAllHint: { color: colors.muted, fontSize: 12, fontStyle: 'italic' },
  status: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  list: { gap: 10 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  cardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardTitle: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '600' },
  cardMeta: { color: colors.muted, fontSize: 12 },
  onCalPill: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderColor: 'rgba(59,130,246,0.45)',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  onCalPillText: { color: '#93c5fd', fontSize: 10, fontWeight: '700' },
  empty: { color: colors.muted },
});
