import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import { useNotificationsStore } from '../stores/notifications.store';
import { getCalendarEventsInRange } from '../services/calendar.service';
import {
  ensureNotificationChannel,
  getNotificationPermission,
  resyncSessionReminders,
  scheduleWeeklySummaryReminder,
  setBadgeCount,
} from '../services/notifications.service';
import { countEventsForTodayAndTomorrow } from '../utils/calendar-badge';

/**
 * On login / reconnect / toggle changes, rebuild local reminder schedule
 * from upcoming calendar events so reminders stay reliable across restarts.
 */
export function useReminderSync() {
  const { user, isAuthenticated } = useAuth();
  const { isOnline } = useNetworkStatus();
  const sessionRemindersEnabled = useNotificationsStore((s) => s.sessionRemindersEnabled);
  const weeklySummaryEnabled = useNotificationsStore((s) => s.weeklySummaryEnabled);
  const syncing = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.features?.canAccessCalendar || !isOnline) return;

    let cancelled = false;

    const run = async () => {
      if (syncing.current) return;
      syncing.current = true;
      try {
        await ensureNotificationChannel();
        const granted = await getNotificationPermission();
        if (!granted) {
          await scheduleWeeklySummaryReminder(false);
          await setBadgeCount(0);
          return;
        }

        const now = new Date();
        const in30 = new Date();
        in30.setDate(now.getDate() + 30);
        const events = await getCalendarEventsInRange(now.toISOString(), in30.toISOString());
        if (cancelled) return;

        await resyncSessionReminders(
          events.map((event) => ({
            id: event.id,
            title: event.teamName || event.location || 'Training Session',
            scheduledDate: event.scheduledDate,
            cancelled: event.cancelled,
            completed: event.completed,
          })),
          sessionRemindersEnabled
        );

        await scheduleWeeklySummaryReminder(weeklySummaryEnabled);
        await setBadgeCount(countEventsForTodayAndTomorrow(events, new Date()));
      } catch {
        // Best-effort sync; calendar/network failures should not crash the shell.
      } finally {
        syncing.current = false;
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    user?.features?.canAccessCalendar,
    isOnline,
    sessionRemindersEnabled,
    weeklySummaryEnabled,
  ]);
}
