import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { CalendarEvent } from '@aci/shared';
import { getCalendarEventsInRange } from '../services/calendar.service';

export type CalendarViewMode = 'day' | 'month' | 'week';

export type CalendarRange = {
  start: Date;
  end: Date;
};

export type UseCalendarEventsOptions = {
  view: CalendarViewMode;
  /** The anchor date (the day the user is looking at / the month containing). */
  anchor: Date;
  enabled?: boolean;
};

export function startOfDay(d = new Date()): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function shiftAnchor(anchor: Date, view: CalendarViewMode, direction: -1 | 1): Date {
  const next = new Date(anchor);
  if (view === 'month') {
    next.setMonth(next.getMonth() + direction);
    return startOfDay(next);
  }
  next.setDate(next.getDate() + direction * 7);
  return startOfDay(next);
}

/**
 * Returns the ISO range window to fetch for the given view + anchor.
 *
 * - month  : 6 weeks centred on the month containing `anchor`
 *            (covers spillover days in the 42-cell grid).
 * - week   : Mon → Sun week containing `anchor`.
 * - day    : 30-day agenda starting at `anchor` (the Day tab).
 */
export function rangeForView(view: CalendarViewMode, anchor: Date): CalendarRange {
  const start = startOfDay(anchor);

  if (view === 'day') {
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    return { start, end };
  }

  if (view === 'week') {
    const dow = start.getDay();
    const diffToMonday = (dow + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  // month — back up to the Sunday on/before the 1st, then walk forward
  // 42 days (6 rows × 7 days) so the grid is always full.
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  start.setTime(first.getTime());
  const dow = start.getDay();
  start.setDate(start.getDate() - dow); // Sunday on/before the 1st
  const end = new Date(start);
  end.setDate(end.getDate() + 42);
  return { start, end };
}

/**
 * Calendar events for the given view + anchor, range-cached via
 * `react-query` so adjacent ranges share the same fetch (the
 * month-view neighbour prefetch lands in the same key as the week
 * view of that neighbour).
 *
 * Disabled when the user lacks `canAccessCalendar` or is offline;
 * callers should pair this with an offline-cache fallback (Phase G).
 */
export function useCalendarEvents({ view, anchor, enabled = true }: UseCalendarEventsOptions) {
  const anchorKey = dayKey(anchor);
  const range = useMemo(() => rangeForView(view, anchor), [view, anchorKey]);

  const query = useQuery<CalendarEvent[]>({
    queryKey: ['calendar', 'events', range.start.toISOString(), range.end.toISOString()],
    queryFn: () => getCalendarEventsInRange(range.start.toISOString(), range.end.toISOString()),
    enabled,
    staleTime: 60_000,
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (!query.data) return map;
    for (const event of query.data) {
      const when = event.scheduledDate || event.startAt || event.date;
      if (!when) continue;
      const d = new Date(when);
      if (Number.isNaN(d.getTime())) continue;
      const key = dayKey(d);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const aT = new Date(a.scheduledDate || a.startAt || a.date || 0).getTime();
        const bT = new Date(b.scheduledDate || b.startAt || b.date || 0).getTime();
        return aT - bT;
      });
    }
    return map;
  }, [query.data]);

  return { ...query, range, eventsByDay };
}

/** Stable `YYYY-MM-DD` key in local time, suitable for Map lookups. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}