import type { CalendarEvent } from '@aci/shared';
import api, { normalizeApiError } from './api';

export type CalendarEventItem = CalendarEvent & {
  id: string;
  sessionId?: string;
  scheduledDate?: string;
  durationMin?: number;
  notes?: string;
  location?: string;
  teamName?: string;
  completed?: boolean;
  cancelled?: boolean;
};

export async function getUpcomingEvents(limit = 2): Promise<CalendarEventItem[]> {
  try {
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(now.getDate() + 30);

    const response = await api.get<{ ok: boolean; events: CalendarEventItem[] }>('/calendar/events', {
      params: {
        startDate: now.toISOString(),
        endDate: in30Days.toISOString(),
      },
    });

    return (response.data.events || []).slice(0, limit);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function getCalendarEventsInRange(startDate: string, endDate: string): Promise<CalendarEventItem[]> {
  try {
    const response = await api.get<{ ok: boolean; events: CalendarEventItem[] }>('/calendar/events', {
      params: { startDate, endDate },
    });
    return response.data.events || [];
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/** Active (non-cancelled) calendar events — wide window for vault schedule badges. */
export async function getVaultCalendarEvents(): Promise<CalendarEventItem[]> {
  const start = new Date();
  start.setMonth(start.getMonth() - 2);
  const end = new Date();
  end.setMonth(end.getMonth() + 6);
  try {
    const response = await api.get<{ ok: boolean; events: CalendarEventItem[] }>('/calendar/events', {
      params: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        includeCancelled: false,
      },
    });
    return (response.data.events || []).filter((event) => !event.cancelled);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export function countEventsBySessionId(events: CalendarEventItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    if (!event.sessionId || event.cancelled) continue;
    counts[event.sessionId] = (counts[event.sessionId] || 0) + 1;
  }
  return counts;
}

export async function createCalendarEvent(payload: {
  sessionId: string;
  scheduledDate: string;
  durationMin?: number;
  notes?: string;
  location?: string;
  teamName?: string;
}): Promise<CalendarEventItem> {
  try {
    const response = await api.post<{ ok: boolean; event: CalendarEventItem }>('/calendar/events', payload);
    return response.data.event;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function updateCalendarEvent(
  eventId: string,
  payload: {
    scheduledDate?: string;
    durationMin?: number;
    notes?: string;
    location?: string;
    teamName?: string;
    completed?: boolean;
    cancelled?: boolean;
  }
): Promise<CalendarEventItem> {
  try {
    const response = await api.patch<{ ok: boolean; event: CalendarEventItem }>(
      `/calendar/events/${eventId}`,
      payload
    );
    return response.data.event;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  try {
    await api.delete(`/calendar/events/${eventId}`);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function getWeeklySummary(weekStart: string, weekEnd: string): Promise<{ summary: any; text: string }> {
  try {
    const response = await api.get<{ ok: boolean; summary: any; text: string }>('/calendar/weekly-summary', {
      params: { weekStart, weekEnd },
    });
    return { summary: response.data.summary, text: response.data.text };
  } catch (error) {
    throw normalizeApiError(error);
  }
}
