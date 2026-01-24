import express from "express";
import { prisma } from "./prisma";
import { authenticate, AuthRequest } from "./middleware/auth";
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

const r = express.Router();

// All routes require authentication
r.use(authenticate);

/**
 * POST /calendar/events
 * Create a new calendar event (schedule a session)
 */
r.post("/calendar/events", async (req: AuthRequest, res) => {
  try {
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
r.get("/calendar/events", async (req: AuthRequest, res) => {
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
      options.startDate = new Date(startDate as string);
    }
    if (endDate) {
      options.endDate = new Date(endDate as string);
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
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to fetch calendar events",
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
r.patch("/calendar/events/:eventId", async (req: AuthRequest, res) => {
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
r.delete("/calendar/events/:eventId", async (req: AuthRequest, res) => {
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

export default r;
