import { prisma } from "../prisma";

export interface WeeklySummaryInput {
  userId: string;
  weekStart: Date; // Start of the week (typically Sunday or Monday)
  weekEnd: Date; // End of the week
}

export interface WeeklySummaryEvent {
  id: string;
  sessionId: string;
  sessionRefCode: string | null;
  scheduledDate: Date;
  durationMin: number;
  location: string | null;
  teamName: string | null;
  notes: string | null;
  session: {
    id: string;
    title: string;
    ageGroup: string;
    gameModelId: string;
    durationMin: number | null;
  } | null;
}

export interface WeeklySummary {
  weekStart: Date;
  weekEnd: Date;
  events: WeeklySummaryEvent[];
  totalSessions: number;
  totalMinutes: number;
  ageGroups: string[];
  gameModels: string[];
}

/**
 * Generate a weekly summary of scheduled calendar events
 */
export async function generateWeeklySummary(
  input: WeeklySummaryInput
): Promise<WeeklySummary> {
  const { userId, weekStart, weekEnd } = input;

  // Get all calendar events for the week
  const events = await prisma.calendarEvent.findMany({
    where: {
      userId,
      scheduledDate: {
        gte: weekStart,
        lte: weekEnd,
      },
      cancelled: false,
    },
    orderBy: {
      scheduledDate: "asc",
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

  // Fetch session details for each event
  const eventsWithSessions = await Promise.all(
    events.map(async (event) => {
      const session = await prisma.session.findUnique({
        where: { id: event.sessionId },
        select: {
          id: true,
          title: true,
          ageGroup: true,
          gameModelId: true,
          durationMin: true,
        },
      });

      return {
        id: event.id,
        sessionId: event.sessionId,
        sessionRefCode: event.sessionRefCode,
        scheduledDate: event.scheduledDate,
        durationMin: event.durationMin,
        location: event.location,
        teamName: event.teamName,
        notes: event.notes,
        session: session || null,
      };
    })
  );

  // Calculate summary statistics
  const totalSessions = eventsWithSessions.length;
  const totalMinutes = eventsWithSessions.reduce(
    (sum, event) => sum + (event.durationMin || 0),
    0
  );

  const ageGroups = Array.from(
    new Set(
      eventsWithSessions
        .map((e) => e.session?.ageGroup)
        .filter((ag): ag is string => !!ag)
    )
  ).sort();

  const gameModels = Array.from(
    new Set(
      eventsWithSessions
        .map((e) => e.session?.gameModelId)
        .filter((gm): gm is string => !!gm)
    )
  ).sort();

  return {
    weekStart,
    weekEnd,
    events: eventsWithSessions,
    totalSessions,
    totalMinutes,
    ageGroups,
    gameModels,
  };
}

/**
 * Format weekly summary as a parent-friendly text summary
 */
export function formatWeeklySummaryAsText(summary: WeeklySummary): string {
  const { weekStart, weekEnd, events, totalSessions, totalMinutes, ageGroups, gameModels } = summary;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  let text = `Weekly Training Schedule Summary\n`;
  text += `Week of ${formatDate(weekStart)} - ${formatDate(weekEnd)}\n\n`;
  text += `Total Sessions: ${totalSessions}\n`;
  text += `Total Training Time: ${Math.round(totalMinutes / 60)} hours ${totalMinutes % 60} minutes\n\n`;

  if (ageGroups.length > 0) {
    text += `Age Groups: ${ageGroups.join(", ")}\n`;
  }
  if (gameModels.length > 0) {
    const gameModelLabels: Record<string, string> = {
      POSSESSION: "Possession",
      PRESSING: "Pressing",
      TRANSITION: "Transition",
      COACHAI: "Balanced",
    };
    text += `Focus Areas: ${gameModels.map((gm) => gameModelLabels[gm] || gm).join(", ")}\n`;
  }

  text += `\n---\n\n`;

  // Group events by date
  const eventsByDate: Record<string, typeof events> = {};
  events.forEach((event) => {
    const dateKey = event.scheduledDate.toISOString().split("T")[0];
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);
  });

  // Format each day
  Object.keys(eventsByDate)
    .sort()
    .forEach((dateKey) => {
      const dayEvents = eventsByDate[dateKey];
      const date = new Date(dateKey);
      text += `${formatDate(date)}\n`;
      text += `${"=".repeat(50)}\n\n`;

      dayEvents.forEach((event) => {
        text += `Session: ${event.session?.title || "Untitled Session"}\n`;
        text += `Time: ${formatTime(event.scheduledDate)}\n`;
        text += `Duration: ${event.durationMin} minutes\n`;

        if (event.location) {
          text += `Location: ${event.location}\n`;
        }
        if (event.teamName) {
          text += `Team: ${event.teamName}\n`;
        }
        if (event.session?.ageGroup) {
          text += `Age Group: ${event.session.ageGroup}\n`;
        }
        if (event.notes) {
          text += `Notes: ${event.notes}\n`;
        }
        if (event.sessionRefCode) {
          text += `Reference: ${event.sessionRefCode}\n`;
        }

        text += `\n`;
      });

      text += `\n`;
    });

  return text;
}
