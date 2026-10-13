import type { CalendarEvent } from '@aci/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CalendarToolbar } from '../../components/calendar/CalendarToolbar';
import { DayAgenda } from '../../components/calendar/DayAgenda';
import { MonthGrid } from '../../components/calendar/MonthGrid';
import { ScheduleSessionSheet } from '../../components/calendar/ScheduleSessionSheet';
import { WeekStrip } from '../../components/calendar/WeekStrip';
import { PickerSheet } from '../../components/ui/PickerSheet';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import {
  dayKey,
  shiftAnchor,
  startOfDay,
  useCalendarEvents,
  type CalendarViewMode,
} from '../../hooks/useCalendarEvents';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getWeeklySummary,
  updateCalendarEvent,
} from '../../services/calendar.service';
import {
  cancelEventReminders,
  requestNotificationPermission,
  scheduleSessionReminders,
} from '../../services/notifications.service';
import { getVaultSessions } from '../../services/vault.service';
import { useNotificationsStore } from '../../stores/notifications.store';
import { formatEventTitle, formatMonthLabel, formatWeekRangeLabel } from '../../utils/format';

function weekBounds(): { start: string; end: string } {
  const now = startOfDay();
  const diffToMonday = (now.getDay() + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function toolbarTitle(view: CalendarViewMode, anchor: Date, rangeStart: Date, rangeEnd: Date): string {
  if (view === 'month') return formatMonthLabel(anchor.toISOString());
  if (view === 'week') {
    const last = new Date(rangeEnd);
    last.setDate(last.getDate() - 1);
    return formatWeekRangeLabel(rangeStart, last);
  }
  if (dayKey(anchor) === dayKey(new Date())) return 'Next 30 days';
  return `From ${formatMonthLabel(anchor.toISOString()).split(' ')[0]} ${anchor.getDate()}`;
}

export default function CalendarTab() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const sessionRemindersEnabled = useNotificationsStore((s) => s.sessionRemindersEnabled);

  const [view, setView] = useState<CalendarViewMode>('month');
  const [anchor, setAnchor] = useState(() => startOfDay());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingSession, setPendingSession] = useState<{ id: string; title: string; durationMin?: number } | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAccess = Boolean(user?.features.canAccessCalendar);
  const todayKey = dayKey(new Date());

  const eventsQuery = useCalendarEvents({
    view,
    anchor,
    enabled: canAccess && isOnline,
  });

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
    queryFn: () => getVaultSessions({ limit: 25, offset: 0 }),
    enabled: canAccess && isOnline,
  });

  const sessionOptions = useMemo(
    () =>
      (recentSessionsQuery.data?.sessions || []).map((s) => ({
        value: s.id,
        label: s.title || 'Untitled session',
        sublabel: [s.refCode, s.ageGroup, s.durationMin ? `${s.durationMin} min` : null].filter(Boolean).join(' · '),
      })),
    [recentSessionsQuery.data]
  );

  const selectedDayEvents = useMemo(() => {
    if (!selectedDayKey) return [];
    return eventsQuery.eventsByDay.get(selectedDayKey) ?? [];
  }, [eventsQuery.eventsByDay, selectedDayKey]);

  if (!canAccess) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.gate}>
          <Text style={styles.pageTitle}>Calendar</Text>
          <Text style={styles.gateCopy}>Calendar is available on Coach Pro and up.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Settings to upgrade"
            onPress={() => router.push('/settings')}
            style={styles.upgradeLink}
          >
            <Text style={styles.upgradeLinkText}>Open Settings → Upgrade</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const onCreateConfirm = async (payload: { scheduledAt: Date; durationMin: number }) => {
    if (!pendingSession) return;
    if (!isOnline) {
      setError('Calendar scheduling requires an internet connection.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const isoDate = payload.scheduledAt.toISOString();
      const created = await createCalendarEvent({
        sessionId: pendingSession.id,
        scheduledDate: isoDate,
        durationMin: payload.durationMin,
        notes: pendingSession.title,
      });
      if (sessionRemindersEnabled) {
        const granted = await requestNotificationPermission();
        if (granted) {
          await scheduleSessionReminders({
            id: created.id,
            title: pendingSession.title || 'Training Session',
            scheduledDate: isoDate,
          });
        }
      }
      setPendingSession(null);
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
        Alert.alert('Offline', 'Calendar updates require an internet connection.');
        return;
      }
      await cancelEventReminders(eventId);
      await deleteCalendarEvent(eventId);
      eventsQuery.refetch().catch(() => undefined);
    } catch (err) {
      Alert.alert('Delete failed', (err as { message?: string }).message || 'Could not delete event.');
    }
  };

  const onToggleComplete = async (event: CalendarEvent) => {
    try {
      if (!isOnline) {
        Alert.alert('Offline', 'Calendar updates require an internet connection.');
        return;
      }
      await updateCalendarEvent(event.id, { completed: !event.completed });
      eventsQuery.refetch().catch(() => undefined);
    } catch (err) {
      Alert.alert('Update failed', (err as { message?: string }).message || 'Could not update event.');
    }
  };

  const onPressEvent = (event: CalendarEvent) => {
    const title = formatEventTitle(event);
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Close', style: 'cancel' },
    ];
    if (event.sessionId) {
      buttons.push({
        text: 'Start practice',
        onPress: () =>
          router.push({ pathname: '/sideline/[sessionId]', params: { sessionId: String(event.sessionId) } }),
      });
    }
    buttons.push({
      text: event.completed ? 'Mark incomplete' : 'Mark done',
      onPress: () => void onToggleComplete(event),
    });
    buttons.push({
      text: 'Delete',
      style: 'destructive',
      onPress: () => void onDelete(event.id),
    });
    Alert.alert(title, event.location || event.teamName || undefined, buttons);
  };

  const title = toolbarTitle(view, anchor, eventsQuery.range.start, eventsQuery.range.end);

  const header = (
    <View style={styles.header}>
      <CalendarToolbar
        title={title}
        view={view}
        onChangeView={(next) => {
          setView(next);
          setSelectedDayKey(null);
        }}
        onPrev={() => {
          setAnchor((current) => shiftAnchor(current, view, -1));
          setSelectedDayKey(null);
        }}
        onNext={() => {
          setAnchor((current) => shiftAnchor(current, view, 1));
          setSelectedDayKey(null);
        }}
        onToday={() => {
          setAnchor(startOfDay());
          setSelectedDayKey(dayKey(new Date()));
        }}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  const weeklySummary = user?.features.canGenerateWeeklySummaries ? (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>Weekly summary</Text>
      <Text style={styles.summaryText}>
        {weeklySummaryQuery.data?.text || 'No summary available for this week.'}
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safe}>
      {view === 'month' ? (
        <View style={styles.monthLayout}>
          {header}
          <View style={styles.monthGridWrap}>
            <MonthGrid
              rangeStart={eventsQuery.range.start}
              events={eventsQuery.data || []}
              anchorMonth={anchor.getMonth()}
              todayKey={todayKey}
              selectedKey={selectedDayKey}
              onPressDay={(date) => setSelectedDayKey(dayKey(date))}
            />
          </View>
          {selectedDayKey ? (
            <ScrollView style={styles.dayPeek} contentContainerStyle={styles.dayPeekContent}>
              <DayAgenda events={selectedDayEvents} todayKey={todayKey} onPressEvent={onPressEvent} />
            </ScrollView>
          ) : null}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={eventsQuery.isRefetching && !eventsQuery.isLoading}
              onRefresh={() => {
                eventsQuery.refetch().catch(() => undefined);
                weeklySummaryQuery.refetch().catch(() => undefined);
              }}
              tintColor={colors.primary}
            />
          }
        >
          {header}
          {view === 'week' ? (
            <WeekStrip
              weekStart={eventsQuery.range.start}
              eventsByDay={eventsQuery.eventsByDay}
              todayKey={todayKey}
              onPressEvent={onPressEvent}
            />
          ) : (
            <DayAgenda events={eventsQuery.data || []} todayKey={todayKey} onPressEvent={onPressEvent} />
          )}
          {weeklySummary}
        </ScrollView>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Schedule a session"
        accessibilityState={{ disabled: !isOnline }}
        disabled={!isOnline}
        onPress={() => {
          setError(null);
          setPickerOpen(true);
        }}
        style={({ pressed }) => [styles.fab, !isOnline ? styles.fabDisabled : null, pressed ? styles.fabPressed : null]}
      >
        <Text style={styles.fabGlyph}>+</Text>
      </Pressable>

      <PickerSheet
        visible={pickerOpen}
        title="Vault session"
        subTitle="Pick a session to put on the calendar."
        options={sessionOptions}
        onCancel={() => setPickerOpen(false)}
        onPick={(value) => {
          const session = (recentSessionsQuery.data?.sessions || []).find((s) => s.id === value);
          setPickerOpen(false);
          if (!session) return;
          setPendingSession({
            id: session.id,
            title: session.title || 'Training Session',
            durationMin: session.durationMin,
          });
        }}
      />

      <ScheduleSessionSheet
        visible={Boolean(pendingSession)}
        title={pendingSession ? `Schedule ${pendingSession.title}` : 'Schedule session'}
        durationMin={pendingSession?.durationMin}
        loading={isSubmitting}
        onCancel={() => setPendingSession(null)}
        onConfirm={(payload) => void onCreateConfirm(payload)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  monthLayout: {
    flex: 1,
    minHeight: 0,
  },
  monthGridWrap: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 6,
  },
  container: {
    gap: 10,
    paddingBottom: 88,
  },
  gate: {
    gap: 10,
    padding: 14,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  gateCopy: {
    color: colors.muted,
    fontSize: 14,
  },
  upgradeLink: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  upgradeLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    paddingHorizontal: 4,
  },
  dayPeek: {
    maxHeight: 220,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dayPeekContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingBottom: 80,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 8,
    padding: 12,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  summaryText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 26,
    bottom: 16,
    height: 52,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    width: 52,
  },
  fabDisabled: {
    backgroundColor: colors.surfaceAlt,
  },
  fabPressed: {
    opacity: 0.75,
  },
  fabGlyph: {
    color: '#062b1d',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
    marginTop: -2,
  },
});
