import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  updateCalendarEvent,
} from '../../services/calendar.service';
import {
  cancelEventReminders,
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
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
  const [scheduledAt, setScheduledAt] = useState(() => {
    const next = new Date();
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next;
  });
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [showTimePicker, setShowTimePicker] = useState(Platform.OS === 'ios');
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
      setError('Pick a vault session before scheduling.');
      return;
    }

    const isoDate = scheduledAt.toISOString();

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
          await scheduleSessionReminders({
            id: created.id,
            title: 'Training Session',
            scheduledDate: isoDate,
          });
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
      await cancelEventReminders(eventId);
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
          <Text style={styles.blockTitle}>Create event</Text>
          <Input
            label="Vault session"
            value={sessionId}
            onChangeText={setSessionId}
            placeholder="Session ID from vault"
          />
          <Button title="Use most recent vault session" onPress={onPickRecentSession} variant="secondary" />

          <Text style={styles.fieldLabel}>Date & time</Text>
          <Text style={styles.schedulePreview} accessibilityLabel={`Scheduled for ${formatDate(scheduledAt.toISOString())}`}>
            {formatDate(scheduledAt.toISOString())}
          </Text>

          {Platform.OS === 'android' ? (
            <View style={styles.pickerActions}>
              <Button title="Pick date" onPress={() => setShowDatePicker(true)} variant="secondary" />
              <Button title="Pick time" onPress={() => setShowTimePicker(true)} variant="secondary" />
            </View>
          ) : null}

          {showDatePicker ? (
            <DateTimePicker
              value={scheduledAt}
              mode="date"
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
              onChange={(_, date) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (!date) return;
                setScheduledAt((current) => {
                  const next = new Date(current);
                  next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                  return next;
                });
              }}
            />
          ) : null}

          {showTimePicker || Platform.OS === 'ios' ? (
            <DateTimePicker
              value={scheduledAt}
              mode="time"
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
              onChange={(_, date) => {
                if (Platform.OS === 'android') setShowTimePicker(false);
                if (!date) return;
                setScheduledAt((current) => {
                  const next = new Date(current);
                  next.setHours(date.getHours(), date.getMinutes(), 0, 0);
                  return next;
                });
              }}
            />
          ) : null}

          <Input label="Duration (minutes)" value={durationMin} onChangeText={setDurationMin} placeholder="60" />
          <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" />
          {error ? <ErrorMessage message={error} /> : null}
          <Button title="Schedule" onPress={() => void onCreateEvent()} loading={isSubmitting} />
        </View>

        {user.features.canGenerateWeeklySummaries ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Weekly summary</Text>
            <Text style={styles.summaryText}>{weeklySummaryQuery.data?.text || 'No summary available for this week.'}</Text>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Upcoming events</Text>
          {(eventsQuery.data || []).map((event: any) => (
            <View key={event.id} style={styles.eventRow}>
              <View style={styles.eventMeta}>
                <Text style={styles.eventTitle}>{event.teamName || event.location || 'Training event'}</Text>
                <Text style={styles.eventTime}>{formatDate(event.scheduledDate || event.startAt || event.date)}</Text>
                <Text style={styles.eventTime}>{event.completed ? 'Completed' : 'Scheduled'}</Text>
                {event.sessionId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start practice"
                    onPress={() =>
                      router.push({ pathname: '/sideline/[sessionId]', params: { sessionId: String(event.sessionId) } })
                    }
                    style={styles.linkPress}
                  >
                    <Text style={styles.startPractice}>Start practice</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={event.completed ? 'Mark incomplete' : 'Mark complete'}
                  onPress={() =>
                    void updateCalendarEvent(event.id, { completed: !event.completed })
                      .then(() => eventsQuery.refetch())
                      .catch((err) =>
                        Alert.alert('Update failed', (err as { message?: string }).message || 'Could not update event.')
                      )
                  }
                  style={styles.linkPress}
                >
                  <Text style={styles.startPractice}>{event.completed ? 'Mark incomplete' : 'Mark complete'}</Text>
                </Pressable>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Delete event" onPress={() => void onDelete(event.id)}>
                <Text style={styles.deleteLink}>Delete</Text>
              </Pressable>
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
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  schedulePreview: {
    color: colors.muted,
    fontSize: 15,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: 8,
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
    minHeight: 44,
    paddingTop: 12,
  },
  startPractice: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  linkPress: {
    marginTop: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  empty: {
    color: colors.muted,
  },
});
