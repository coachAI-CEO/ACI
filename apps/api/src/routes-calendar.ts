import express from "express";
import { prisma } from "./prisma";
import { authenticate, AuthRequest, requireFeature } from "./middleware/auth";

// IMPORTANT: Calendar routes are accessible to ALL authenticated users (COACH, ADMIN, CLUB, etc.)
// They do NOT require admin privileges - any authenticated user can schedule sessions
import {
  createCalendarEvent,
  getCalendarEvents,
  getCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventsByDate,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "./services/calendar";
import {
  generateWeeklySummary,
  formatWeeklySummaryAsText,
} from "./services/weekly-summary";
import { generateWeeklySummaryPdf } from "./services/pdf-export";

const r = express.Router();

// All routes require authentication (accessible to all authenticated users: COACH, ADMIN, CLUB, etc.)
// Note: Calendar is NOT restricted to admin users - any authenticated user can schedule sessions
r.use((req, res, next) => {
  console.log(`[CALENDAR_ROUTER] ${req.method} ${req.path} - Using authenticate middleware (NOT requireAdmin)`);
  next();
});
r.use(authenticate);

/**
 * POST /calendar/events
 * Create a new calendar event (schedule a session)
 */
r.post("/calendar/events", requireFeature('canAccessCalendar'), async (req: AuthRequest, res) => {
  try {
    console.log(`[CALENDAR] POST /calendar/events - User ID: ${req.userId}, Role: ${req.userRole}, Admin Role: ${req.user?.adminRole || 'none'}`);
    
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const {
      sessionId,
      scheduledDate,
      durationMin,
      notes,
      location,
      teamName,
    } = req.body;

    if (!sessionId || !scheduledDate) {
      return res.status(400).json({
        ok: false,
        error: "sessionId and scheduledDate are required",
      });
    }

    const input: CreateCalendarEventInput = {
      sessionId,
      scheduledDate: new Date(scheduledDate),
      durationMin: durationMin ? Number(durationMin) : undefined,
      notes: notes ? String(notes) : undefined,
      location: location ? String(location) : undefined,
      teamName: teamName ? String(teamName) : undefined,
    };

    const event = await createCalendarEvent(req.userId, input);

    return res.json({
      ok: true,
      event,
    });
  } catch (error: any) {
    console.error("[CALENDAR] Error creating event:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to create calendar event",
    });
  }
});

/**
 * GET /calendar/events
 * Get calendar events for the authenticated user
 * Query params: startDate, endDate, includeCompleted, includeCancelled
 */
r.get("/calendar/events", requireFeature('canAccessCalendar'), async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const {
      startDate,
      endDate,
      includeCompleted,
      includeCancelled,
      groupByDate,
    } = req.query;

    const options: {
      startDate?: Date;
      endDate?: Date;
      includeCompleted?: boolean;
      includeCancelled?: boolean;
    } = {};

    if (startDate) {
      const parsedStart = new Date(startDate as string);
      if (isNaN(parsedStart.getTime())) {
        return res.status(400).json({
          ok: false,
          error: `Invalid startDate format: ${startDate}`,
        });
      }
      options.startDate = parsedStart;
    }
    if (endDate) {
      const parsedEnd = new Date(endDate as string);
      if (isNaN(parsedEnd.getTime())) {
        return res.status(400).json({
          ok: false,
          error: `Invalid endDate format: ${endDate}`,
        });
      }
      options.endDate = parsedEnd;
    }
    if (includeCompleted !== undefined) {
      options.includeCompleted = includeCompleted === "true";
    }
    if (includeCancelled !== undefined) {
      options.includeCancelled = includeCancelled === "true";
    }

    if (groupByDate === "true" && options.startDate && options.endDate) {
      // Return grouped by date
      const grouped = await getCalendarEventsByDate(
        req.userId,
        options.startDate,
        options.endDate
      );
      return res.json({
        ok: true,
        eventsByDate: grouped,
      });
    }

    const events = await getCalendarEvents(req.userId, options);

    return res.json({
      ok: true,
      events,
    });
  } catch (error: any) {
    console.error("[CALENDAR] Error fetching events:", error);
    console.error("[CALENDAR] Error stack:", error.stack);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to fetch calendar events",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

/**
 * GET /calendar/events/:eventId
 * Get a specific calendar event
 */
r.get("/calendar/events/:eventId", async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const { eventId } = req.params;

    const event = await getCalendarEvent(eventId, req.userId);

    if (!event) {
      return res.status(404).json({ ok: false, error: "Calendar event not found" });
    }

    // Fetch full session details
    const session = await prisma.session.findUnique({
      where: { id: event.sessionId },
    });

    return res.json({
      ok: true,
      event: {
        ...event,
        session,
      },
    });
  } catch (error: any) {
    console.error("[CALENDAR] Error fetching event:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to fetch calendar event",
    });
  }
});

/**
 * PATCH /calendar/events/:eventId
 * Update a calendar event
 */
r.patch("/calendar/events/:eventId", requireFeature('canAccessCalendar'), async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const { eventId } = req.params;
    const {
      scheduledDate,
      durationMin,
      notes,
      location,
      teamName,
      completed,
      cancelled,
    } = req.body;

    const input: UpdateCalendarEventInput = {};

    if (scheduledDate !== undefined) {
      input.scheduledDate = new Date(scheduledDate);
    }
    if (durationMin !== undefined) {
      input.durationMin = Number(durationMin);
    }
    if (notes !== undefined) {
      input.notes = notes ? String(notes) : undefined;
    }
    if (location !== undefined) {
      input.location = location ? String(location) : undefined;
    }
    if (teamName !== undefined) {
      input.teamName = teamName ? String(teamName) : undefined;
    }
    if (completed !== undefined) {
      input.completed = Boolean(completed);
    }
    if (cancelled !== undefined) {
      input.cancelled = Boolean(cancelled);
    }

    const event = await updateCalendarEvent(eventId, req.userId, input);

    return res.json({
      ok: true,
      event,
    });
  } catch (error: any) {
    console.error("[CALENDAR] Error updating event:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to update calendar event",
    });
  }
});

/**
 * DELETE /calendar/events/:eventId
 * Delete a calendar event
 */
r.delete("/calendar/events/:eventId", requireFeature('canAccessCalendar'), async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const { eventId } = req.params;

    await deleteCalendarEvent(eventId, req.userId);

    return res.json({
      ok: true,
    });
  } catch (error: any) {
    console.error("[CALENDAR] Error deleting event:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to delete calendar event",
    });
  }
});

/**
 * GET /calendar/weekly-summary
 * Generate a weekly summary of scheduled sessions for parent communication
 * Query params: weekStart (ISO date string), weekEnd (ISO date string)
 */
r.get("/calendar/weekly-summary", requireFeature('canGenerateWeeklySummaries'), async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const { weekStart, weekEnd, format } = req.query;

    if (!weekStart || !weekEnd) {
      return res.status(400).json({
        ok: false,
        error: "weekStart and weekEnd query parameters are required (ISO date strings)",
      });
    }

    const startDate = new Date(weekStart as string);
    const endDate = new Date(weekEnd as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        ok: false,
        error: "Invalid date format. Use ISO date strings (YYYY-MM-DD)",
      });
    }

    const summary = await generateWeeklySummary({
      userId: req.userId,
      weekStart: startDate,
      weekEnd: endDate,
    });

    // If PDF format requested
    if (format === "pdf") {
      const pdfBuffer = await generateWeeklySummaryPdf(summary);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="weekly-summary-${weekStart}-${weekEnd}.pdf"`
      );
      return res.send(pdfBuffer);
    }

    // Return JSON summary
    return res.json({
      ok: true,
      summary,
      text: formatWeeklySummaryAsText(summary),
    });
  } catch (error: any) {
    console.error("[CALENDAR] Error generating weekly summary:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to generate weekly summary",
    });
  }
});

export default r;
