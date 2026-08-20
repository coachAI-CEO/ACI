export function countEventsForTodayAndTomorrow(events: Array<{ scheduledDate?: string; startAt?: string; date?: string }>, now: Date): number {
  const endOfTomorrow = new Date(now);
  endOfTomorrow.setDate(now.getDate() + 1);
  endOfTomorrow.setHours(23, 59, 59, 999);

  return events.filter((event) => {
    const raw = event.scheduledDate || event.startAt || event.date;
    const date = new Date(raw || '');
    if (Number.isNaN(date.getTime())) return false;
    return date >= now && date <= endOfTomorrow;
  }).length;
}
