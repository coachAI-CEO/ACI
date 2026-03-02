import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

export async function scheduleSessionReminders(event: {
  id: string;
  title: string;
  scheduledDate: string;
}): Promise<string[]> {
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
      },
    });
    identifiers.push(id);
  }

  return identifiers;
}

export async function cancelNotifications(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(Math.max(0, count));
}
