import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Input } from '../../components/ui/Input';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventsInRange,
  getWeeklySummary,
} from '../../services/calendar.service';
import {
  cancelNotifications,
  requestNotificationPermission,
  scheduleSessionReminders,
  setBadgeCount,
} from '../../services/notifications.service';
import { getVaultSessions } from '../../services/vault.service';
import { useNotificationsStore } from '../../stores/notifications.store';
import { countEventsForTodayAndTomorrow } from '../../utils/calendar-badge';

function formatDate(value: string | undefined): string {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function weekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export default function CalendarTab() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const sessionRemindersEnabled = useNotificationsStore((s) => s.sessionRemindersEnabled);

  const [sessionId, setSessionId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 16));
  const [durationMin, setDurationMin] = useState('60');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setBadgeCount(0).catch(() => undefined);
  }, []);

  const range = useMemo(() => {
    const now = new Date();
    const in30 = new Date();
    in30.setDate(now.getDate() + 30);
    return { start: now.toISOString(), end: in30.toISOString() };
  }, []);

  const eventsQuery = useQuery({
    queryKey: ['calendar', 'events', range.start, range.end],
    queryFn: () => getCalendarEventsInRange(range.start, range.end),
    enabled: Boolean(user?.features.canAccessCalendar) && isOnline,
  });

  useEffect(() => {
    const events = eventsQuery.data || [];
    const count = countEventsForTodayAndTomorrow(events, new Date());

    setBadgeCount(count).catch(() => undefined);
  }, [eventsQuery.data]);

  const weeklySummaryQuery = useQuery({
    queryKey: ['calendar', 'weeklySummary'],
    queryFn: () => {
      const week = weekBounds();
      return getWeeklySummary(week.start, week.end);
    },
    enabled: Boolean(user?.features.canGenerateWeeklySummaries) && isOnline,
  });

  const recentSessionsQuery = useQuery({
    queryKey: ['calendar', 'recentSessions'],
    queryFn: () => getVaultSessions({ limit: 5, offset: 0 }),
    enabled: Boolean(user?.features.canAccessCalendar) && isOnline,
  });

  if (!user?.features.canAccessCalendar) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.block}>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>Your plan does not include calendar access.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onPickRecentSession = () => {
    const first = recentSessionsQuery.data?.sessions?.[0];
    if (!first?.id) {
      setError('No recent session found in vault.');
      return;
    }
    setSessionId(first.id);
    setError(null);
  };

  const onCreateEvent = async () => {
    setError(null);
    if (!isOnline) {
      setError('Calendar scheduling requires an internet connection.');
      return;
    }
    if (!sessionId.trim()) {
      setError('Session ID is required.');
      return;
    }

    const normalizedDate = scheduledDate.includes('T') ? scheduledDate : `${scheduledDate}T16:00`;
    const isoDate = new Date(normalizedDate).toISOString();

    setIsSubmitting(true);
    try {
      const created = await createCalendarEvent({
        sessionId: sessionId.trim(),
        scheduledDate: isoDate,
        durationMin: Number(durationMin) || undefined,
        notes: notes || undefined,
      });
      if (sessionRemindersEnabled) {
        const granted = await requestNotificationPermission();
        if (granted) {
          const ids = await scheduleSessionReminders({
            id: created.id,
            title: 'Training Session',
            scheduledDate: isoDate,
          });
          await AsyncStorage.setItem(`notif:event:${created.id}`, JSON.stringify(ids));
        }
      }
      setNotes('');
      eventsQuery.refetch().catch(() => undefined);
    } catch (err) {
      setError((err as { message?: string }).message || 'Could not create event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDelete = async (eventId: string) => {
    try {
      if (!isOnline) {
        setError('Calendar updates require an internet connection.');
        return;
      }
      const stored = await AsyncStorage.getItem(`notif:event:${eventId}`);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        if (Array.isArray(ids) && ids.length) {
          await cancelNotifications(ids);
        }
        await AsyncStorage.removeItem(`notif:event:${eventId}`);
      }
      await deleteCalendarEvent(eventId);
      eventsQuery.refetch().catch(() => undefined);
    } catch (err) {
      Alert.alert('Delete failed', (err as { message?: string }).message || 'Could not delete event.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.subtitle}>
          {isOnline
            ? 'Schedule sessions and view upcoming training.'
            : 'Calendar updates require an internet connection.'}
        </Text>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Create Event</Text>
          <Input label="Session ID" value={sessionId} onChangeText={setSessionId} placeholder="Paste vault session ID" />
          <Button title="Use Most Recent Vault Session" onPress={onPickRecentSession} variant="secondary" />
          <Input
            label="Scheduled Date (ISO/local)"
            value={scheduledDate}
            onChangeText={setScheduledDate}
            placeholder="2026-03-10T16:00"
          />
          <Input label="Duration (minutes)" value={durationMin} onChangeText={setDurationMin} placeholder="60" />
          <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" />
          {error ? <ErrorMessage message={error} /> : null}
          <Button title="Schedule" onPress={() => void onCreateEvent()} loading={isSubmitting} />
        </View>

        {user.features.canGenerateWeeklySummaries ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Weekly Summary</Text>
            <Text style={styles.summaryText}>{weeklySummaryQuery.data?.text || 'No summary available for this week.'}</Text>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Upcoming Events</Text>
          {(eventsQuery.data || []).map((event: any) => (
            <View key={event.id} style={styles.eventRow}>
              <View style={styles.eventMeta}>
                <Text style={styles.eventTitle}>{event.teamName || event.location || 'Training Event'}</Text>
                <Text style={styles.eventTime}>{formatDate(event.scheduledDate || event.startAt || event.date)}</Text>
                {event.sessionId ? (
                  <Text
                    style={styles.startPractice}
                    onPress={() => router.push({ pathname: '/sideline/[sessionId]', params: { sessionId: String(event.sessionId) } })}
                  >
                    Start Practice
                  </Text>
                ) : null}
              </View>
              <Text style={styles.deleteLink} onPress={() => void onDelete(event.id)}>
                Delete
              </Text>
            </View>
          ))}
          {!eventsQuery.data?.length ? <Text style={styles.empty}>No upcoming events.</Text> : null}
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
    padding: 14,
    paddingBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
  },
  block: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  blockTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryText: {
    color: colors.text,
    lineHeight: 20,
  },
  eventRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  eventMeta: {
    flex: 1,
    paddingRight: 10,
  },
  eventTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  eventTime: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  deleteLink: {
    color: colors.danger,
    fontWeight: '600',
  },
  startPractice: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  empty: {
    color: colors.muted,
  },
});
