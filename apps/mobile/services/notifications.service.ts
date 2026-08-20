import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  eventMap: 'notif:event-map-v1',
  weeklyId: 'notif:weekly-summary-id',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let channelReady = false;

export async function ensureNotificationChannel(): Promise<void> {
  if (channelReady || Platform.OS !== 'android') {
    channelReady = true;
    return;
  }

  await Notifications.setNotificationChannelAsync('session-reminders', {
    name: 'Session reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
  channelReady = true;
}

export async function requestNotificationPermission(): Promise<boolean> {
  await ensureNotificationChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

export async function getNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}

type EventMap = Record<string, string[]>;

async function readEventMap(): Promise<EventMap> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.eventMap);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as EventMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeEventMap(map: EventMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.eventMap, JSON.stringify(map));
}

export async function cancelNotifications(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
}

export async function cancelEventReminders(eventId: string): Promise<void> {
  const map = await readEventMap();
  const ids = map[eventId] || [];
  if (ids.length) {
    await cancelNotifications(ids);
  }
  delete map[eventId];
  await writeEventMap(map);
  await AsyncStorage.removeItem(`notif:event:${eventId}`);
}

export async function scheduleSessionReminders(event: {
  id: string;
  title: string;
  scheduledDate: string;
}): Promise<string[]> {
  await ensureNotificationChannel();
  await cancelEventReminders(event.id);

  const date = new Date(event.scheduledDate);
  if (Number.isNaN(date.getTime())) return [];

  const oneHourBefore = new Date(date.getTime() - 60 * 60 * 1000);
  const dayBefore = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  const identifiers: string[] = [];

  if (dayBefore.getTime() > Date.now()) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Session Reminder',
        body: `${event.title} is tomorrow.`,
        data: { eventId: event.id, kind: 'day_before' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: dayBefore,
        channelId: Platform.OS === 'android' ? 'session-reminders' : undefined,
      },
    });
    identifiers.push(id);
  }

  if (oneHourBefore.getTime() > Date.now()) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Session Reminder',
        body: `${event.title} starts in 1 hour.`,
        data: { eventId: event.id, kind: 'hour_before' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: oneHourBefore,
        channelId: Platform.OS === 'android' ? 'session-reminders' : undefined,
      },
    });
    identifiers.push(id);
  }

  const map = await readEventMap();
  map[event.id] = identifiers;
  await writeEventMap(map);
  await AsyncStorage.setItem(`notif:event:${event.id}`, JSON.stringify(identifiers));
  return identifiers;
}

export async function resyncSessionReminders(
  events: Array<{ id: string; title?: string; scheduledDate?: string; cancelled?: boolean; completed?: boolean }>,
  enabled: boolean
): Promise<number> {
  await ensureNotificationChannel();

  const map = await readEventMap();
  const keepIds = new Set(events.map((event) => event.id));

  // Cancel reminders for events that disappeared.
  for (const eventId of Object.keys(map)) {
    if (!keepIds.has(eventId) || !enabled) {
      await cancelEventReminders(eventId);
    }
  }

  if (!enabled) return 0;

  let scheduled = 0;
  for (const event of events) {
    if (!event.id || !event.scheduledDate || event.cancelled || event.completed) {
      await cancelEventReminders(event.id);
      continue;
    }
    const when = new Date(event.scheduledDate);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      await cancelEventReminders(event.id);
      continue;
    }
    const ids = await scheduleSessionReminders({
      id: event.id,
      title: event.title || 'Training Session',
      scheduledDate: event.scheduledDate,
    });
    if (ids.length) scheduled += 1;
  }

  return scheduled;
}

export async function scheduleWeeklySummaryReminder(enabled: boolean): Promise<void> {
  await ensureNotificationChannel();
  const existing = await AsyncStorage.getItem(STORAGE_KEYS.weeklyId);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => undefined);
    await AsyncStorage.removeItem(STORAGE_KEYS.weeklyId);
  }

  if (!enabled) return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Weekly training summary',
      body: 'Open Calendar to review this week’s plan.',
      data: { kind: 'weekly_summary' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2, // Monday (1 = Sunday in expo-notifications)
      hour: 8,
      minute: 0,
      channelId: Platform.OS === 'android' ? 'session-reminders' : undefined,
    },
  });
  await AsyncStorage.setItem(STORAGE_KEYS.weeklyId, id);
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(Math.max(0, count));
}
