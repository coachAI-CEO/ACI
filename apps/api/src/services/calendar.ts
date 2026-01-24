import { prisma } from "../prisma";

export interface CreateCalendarEventInput {
  sessionId: string;
  scheduledDate: Date;
  durationMin?: number;
  notes?: string;
  location?: string;
  teamName?: string;
}

export interface UpdateCalendarEventInput {
  scheduledDate?: Date;
  durationMin?: number;
  notes?: string;
  location?: string;
  teamName?: string;
  completed?: boolean;
  cancelled?: boolean;
}

/**
 * Create a calendar event (schedule a session)
 */
export async function createCalendarEvent(
  userId: string,
  input: CreateCalendarEventInput
): Promise<any> {
  // Verify session exists
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    select: { id: true, refCode: true, title: true, durationMin: true },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Create calendar event
  const event = await prisma.calendarEvent.create({
    data: {
      userId,
      sessionId: input.sessionId,
      sessionRefCode: session.refCode,
      scheduledDate: input.scheduledDate,
      durationMin: input.durationMin || session.durationMin || 60,
      notes: input.notes,
      location: input.location,
      teamName: input.teamName,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return event;
}

/**
 * Get calendar events for a user within a date range
 */
export async function getCalendarEvents(
  userId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    includeCompleted?: boolean;
    includeCancelled?: boolean;
  } = {}
): Promise<any[]> {
  const {
    startDate,
    endDate,
    includeCompleted = true,
    includeCancelled = false,
  } = options;

  const where: any = {
    userId,
  };

  // Date range filter
  if (startDate || endDate) {
    where.scheduledDate = {};
    if (startDate) {
      where.scheduledDate.gte = startDate;
    }
    if (endDate) {
      where.scheduledDate.lte = endDate;
    }
  }

  // Status filters
  if (!includeCompleted) {
    where.completed = false;
  }
  if (!includeCancelled) {
    where.cancelled = false;
  }

  try {
    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: { scheduledDate: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Fetch session details for each event
    const eventsWithSessions = await Promise.all(
      events.map(async (event) => {
        try {
          const session = await prisma.session.findUnique({
            where: { id: event.sessionId },
            select: {
              id: true,
              title: true,
              ageGroup: true,
              durationMin: true,
              gameModelId: true,
              refCode: true,
            },
          });
          return {
            ...event,
            session: session || null,
          };
        } catch (err: any) {
          console.error(`[CALENDAR] Error fetching session ${event.sessionId}:`, err);
          // Return event without session if session fetch fails
          return {
            ...event,
            session: null,
          };
        }
      })
    );

    return eventsWithSessions;
  } catch (error: any) {
    console.error("[CALENDAR] Error in getCalendarEvents:", error);
    throw error;
  }
}

/**
 * Get a single calendar event by ID
 */
export async function getCalendarEvent(
  eventId: string,
  userId: string
): Promise<any | null> {
  const event = await prisma.calendarEvent.findFirst({
    where: {
      id: eventId,
      userId, // Ensure user can only access their own events
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return event;
}

/**
 * Update a calendar event
 */
export async function updateCalendarEvent(
  eventId: string,
  userId: string,
  input: UpdateCalendarEventInput
): Promise<any> {
  // Verify ownership
  const existing = await prisma.calendarEvent.findFirst({
    where: {
      id: eventId,
      userId,
    },
  });

  if (!existing) {
    throw new Error("Calendar event not found or access denied");
  }

  const event = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: input,
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return event;
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  eventId: string,
  userId: string
): Promise<void> {
  // Verify ownership
  const existing = await prisma.calendarEvent.findFirst({
    where: {
      id: eventId,
      userId,
    },
  });

  if (!existing) {
    throw new Error("Calendar event not found or access denied");
  }

  await prisma.calendarEvent.delete({
    where: { id: eventId },
  });
}

/**
 * Get calendar events grouped by date for easy calendar display
 */
export async function getCalendarEventsByDate(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Record<string, any[]>> {
  const events = await getCalendarEvents(userId, {
    startDate,
    endDate,
    includeCancelled: false,
  });

  // Group by date (YYYY-MM-DD)
  const grouped: Record<string, any[]> = {};

  events.forEach((event) => {
    const dateKey = event.scheduledDate.toISOString().split("T")[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(event);
  });

  return grouped;
}
