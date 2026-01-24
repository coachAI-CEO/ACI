"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ConfirmModal from "@/components/ConfirmModal";
import WeeklySummaryModal from "@/components/WeeklySummaryModal";

type CalendarEvent = {
  id: string;
  sessionId: string;
  sessionRefCode: string | null;
  scheduledDate: string;
  durationMin: number;
  notes: string | null;
  location: string | null;
  teamName: string | null;
  completed: boolean;
  cancelled: boolean;
  session?: {
    id: string;
    title: string;
    ageGroup: string;
    durationMin: number | null;
  };
};

const gameModelLabel: Record<string, string> = {
  POSSESSION: "Possession",
  PRESSING: "Pressing",
  TRANSITION: "Transition",
  COACHAI: "Balanced",
};

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);

  // Get start and end of current month/week
  const getDateRange = useCallback(() => {
    if (viewMode === "month") {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      return { start, end };
    } else {
      // Week view - get start of week (Sunday)
      const start = new Date(currentDate);
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  }, [currentDate, viewMode]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!accessToken) {
        setError("You must be logged in to view your calendar");
        setLoading(false);
        return;
      }

      const { start, end } = getDateRange();
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        includeCompleted: "true",
        includeCancelled: "false",
      });

      const res = await fetch(`/api/calendar/events?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        let errorMessage = "Failed to load calendar events";
        try {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
          if (data.details && process.env.NODE_ENV === "development") {
            console.error("[CALENDAR] Error details:", data.details);
          }
        } catch (parseError) {
          // If response isn't JSON, use status text
          errorMessage = `${res.status} ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      setEvents(data.events || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Navigation
  const goToPrevious = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000));
    }
  };

  const goToNext = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Group events by date
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  events.forEach((event) => {
    const dateKey = new Date(event.scheduledDate).toISOString().split("T")[0];
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);
  });

  // Generate calendar days for month view
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

    const days: Date[] = [];
    const current = new Date(startDate);
    while (days.length < 42) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  // Generate week days for week view
  const getWeekDays = () => {
    const { start } = getDateRange();
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const formatWeekRange = () => {
    const { start, end } = getDateRange();
    const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${startStr} - ${endStr}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedEvent) return;

    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!accessToken) {
        alert("You must be logged in to delete calendar events");
        return;
      }

      const res = await fetch(`/api/calendar/events/${selectedEvent.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete calendar event");
      }

      // Remove from local state and reload
      setSelectedEvent(null);
      loadEvents();
    } catch (e: any) {
      console.error("[CALENDAR] Error deleting event:", e);
      alert(e.message || "Failed to delete calendar event");
    } finally {
      setDeleting(false);
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Training Calendar</h1>
            <p className="text-sm text-slate-400 mt-1">
              Schedule and manage your training sessions
            </p>
          </div>
          <Link
            href="/vault"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            Back to Vault
          </Link>
        </div>

        {/* View Controls */}
        <div className="flex items-center justify-between bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={goToPrevious}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              ←
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
            >
              Today
            </button>
            <button
              onClick={goToNext}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              →
            </button>
            <div className="text-lg font-semibold text-slate-200">
              {viewMode === "month" ? formatDate(currentDate) : formatWeekRange()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Calculate current week range (always use week view for summaries)
                const today = new Date(currentDate);
                const day = today.getDay();
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - day);
                weekStart.setHours(0, 0, 0, 0);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                weekEnd.setHours(23, 59, 59, 999);
                setShowWeeklySummary(true);
              }}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2"
              title="Generate weekly summary for parent communication"
            >
              📧 Weekly Summary
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                viewMode === "month"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                viewMode === "week"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              Week
            </button>
          </div>
        </div>

        {/* Calendar View */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading calendar...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">{error}</div>
        ) : viewMode === "month" ? (
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-slate-400 py-2">
                  {day}
                </div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-2">
              {getMonthDays().map((date, idx) => {
                const dateKey = date.toISOString().split("T")[0];
                const dayEvents = eventsByDate[dateKey] || [];
                const isCurrentMonthDay = isCurrentMonth(date);
                const isTodayDay = isToday(date);

                return (
                  <div
                    key={idx}
                    className={`min-h-[100px] rounded-lg border p-2 ${
                      isCurrentMonthDay
                        ? isTodayDay
                          ? "bg-emerald-900/20 border-emerald-500/50"
                          : "bg-slate-800/30 border-slate-700/50"
                        : "bg-slate-900/20 border-slate-800/30"
                    }`}
                  >
                    <div
                      className={`text-xs font-semibold mb-1 ${
                        isCurrentMonthDay ? "text-slate-200" : "text-slate-600"
                      } ${isTodayDay ? "text-emerald-400" : ""}`}
                    >
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`w-full text-left px-2 py-1 rounded text-[10px] truncate ${
                            event.cancelled
                              ? "bg-red-900/30 border border-red-700/50 text-red-300 line-through"
                              : event.completed
                              ? "bg-slate-700/50 border border-slate-600/50 text-slate-400"
                              : "bg-cyan-600/20 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-600/30"
                          }`}
                          title={event.session?.title || "Session"}
                        >
                          {formatTime(event.scheduledDate)} {event.session?.title || "Session"}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-slate-500 px-2">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            {/* Week view */}
            <div className="grid grid-cols-7 gap-4">
              {getWeekDays().map((date, idx) => {
                const dateKey = date.toISOString().split("T")[0];
                const dayEvents = eventsByDate[dateKey] || [];
                const isTodayDay = isToday(date);

                return (
                  <div key={idx} className="min-h-[400px]">
                    <div
                      className={`text-center mb-3 pb-2 border-b ${
                        isTodayDay
                          ? "border-emerald-500/50 text-emerald-400"
                          : "border-slate-700/50 text-slate-300"
                      }`}
                    >
                      <div className="text-xs text-slate-400">
                        {date.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div className={`text-lg font-semibold ${isTodayDay ? "text-emerald-400" : ""}`}>
                        {date.getDate()}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {dayEvents.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`w-full text-left p-2 rounded-lg border ${
                            event.cancelled
                              ? "bg-red-900/30 border-red-700/50 text-red-300 line-through"
                              : event.completed
                              ? "bg-slate-700/50 border-slate-600/50 text-slate-400"
                              : "bg-cyan-600/20 border-cyan-500/50 text-cyan-300 hover:bg-cyan-600/30"
                          }`}
                        >
                          <div className="text-xs font-semibold mb-1">
                            {formatTime(event.scheduledDate)}
                          </div>
                          <div className="text-xs truncate">
                            {event.session?.title || "Session"}
                          </div>
                          {event.location && (
                            <div className="text-[10px] text-slate-400 mt-1">
                              📍 {event.location}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Event Detail Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="relative max-w-2xl w-full rounded-2xl border border-slate-700/70 bg-slate-900/95 p-6 shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-100 mb-2">
                    {selectedEvent.session?.title || "Scheduled Session"}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div className="text-slate-300">
                      {new Date(selectedEvent.scheduledDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                    <div className="text-slate-400">•</div>
                    <div className="text-slate-300">{formatTime(selectedEvent.scheduledDate)}</div>
                    <div className="text-slate-400">•</div>
                    <div className="text-slate-300">{selectedEvent.durationMin} min</div>
                    {selectedEvent.sessionRefCode && (
                      <>
                        <div className="text-slate-400">•</div>
                        <span className="px-2 py-1 rounded bg-cyan-900/40 text-cyan-300 text-xs font-mono border border-cyan-700/30">
                          {selectedEvent.sessionRefCode}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {selectedEvent.session && (
                <div className="mb-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Age Group:</span>
                    <span className="text-slate-200">{selectedEvent.session.ageGroup}</span>
                  </div>
                </div>
              )}

              {selectedEvent.location && (
                <div className="mb-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Location</div>
                  <div className="text-sm text-slate-200">{selectedEvent.location}</div>
                </div>
              )}

              {selectedEvent.teamName && (
                <div className="mb-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Team</div>
                  <div className="text-sm text-slate-200">{selectedEvent.teamName}</div>
                </div>
              )}

              {selectedEvent.notes && (
                <div className="mb-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Notes</div>
                  <div className="text-sm text-slate-300 bg-slate-800/60 rounded-lg p-3">
                    {selectedEvent.notes}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-slate-700/50">
                <Link
                  href={`/demo/session?sessionId=${selectedEvent.sessionId}`}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  View Session →
                </Link>
                <button
                  onClick={handleDeleteEvent}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50"
                >
                  {deleting ? "Removing..." : "Remove from Calendar"}
                </button>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Remove from Calendar"
          message="Are you sure you want to remove this session from your calendar? This action cannot be undone."
          confirmText="Remove"
          cancelText="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          variant="danger"
        />

        {/* Weekly Summary Modal */}
        {showWeeklySummary && (
          <WeeklySummaryModal
            initialWeekStart={currentDate}
            onClose={() => setShowWeeklySummary(false)}
          />
        )}
      </div>
    </main>
  );
}
