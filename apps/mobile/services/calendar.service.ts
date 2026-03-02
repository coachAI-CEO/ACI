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
