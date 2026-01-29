"use client";

import { useState, useEffect, useCallback } from "react";
import DatePicker from "./DatePicker";
import TimePicker from "./TimePicker";

interface ConflictingEvent {
  id: string;
  title: string;
  scheduledDate: string;
  durationMin: number;
}

interface ScheduleSessionModalProps {
  sessionId: string;
  sessionTitle: string;
  sessionRefCode?: string | null;
  /** Duration in minutes for conflict detection (default 60) */
  sessionDurationMin?: number;
  onClose: () => void;
  onScheduled?: () => void;
}

export default function ScheduleSessionModal({
  sessionId,
  sessionTitle,
  sessionRefCode,
  sessionDurationMin = 60,
  onClose,
  onScheduled,
}: ScheduleSessionModalProps) {
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [location, setLocation] = useState("");
  const [teamName, setTeamName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictingEvents, setConflictingEvents] = useState<ConflictingEvent[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  // Check for overlapping events when date or time changes
  const checkConflicts = useCallback(async () => {
    if (!scheduledDate || !scheduledTime) {
      setConflictingEvents([]);
      return;
    }
    const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (isNaN(dateTime.getTime())) {
      setConflictingEvents([]);
      return;
    }
    const dayStart = new Date(scheduledDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledDate);
    dayEnd.setHours(23, 59, 59, 999);

    setCheckingConflicts(true);
    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!accessToken) {
        setConflictingEvents([]);
        return;
      }
      const params = new URLSearchParams({
        startDate: dayStart.toISOString(),
        endDate: dayEnd.toISOString(),
        includeCompleted: "true",
        includeCancelled: "false",
      });
      const res = await fetch(`/api/calendar/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        setConflictingEvents([]);
        return;
      }
      const data = await res.json();
      const events: Array<{
        id: string;
        scheduledDate: string;
        durationMin?: number | null;
        session?: { title?: string; durationMin?: number | null } | null;
      }> = data.events || [];

      const newStart = dateTime.getTime();
      const newEnd = newStart + sessionDurationMin * 60 * 1000;
      const conflicts: ConflictingEvent[] = [];

      for (const ev of events) {
        const existingStart = new Date(ev.scheduledDate).getTime();
        const dur = ev.durationMin ?? ev.session?.durationMin ?? 60;
        const existingEnd = existingStart + dur * 60 * 1000;
        if (newStart < existingEnd && newEnd > existingStart) {
          conflicts.push({
            id: ev.id,
            title: ev.session?.title ?? "Session",
            scheduledDate: ev.scheduledDate,
            durationMin: dur,
          });
        }
      }
      setConflictingEvents(conflicts);
    } catch {
      setConflictingEvents([]);
    } finally {
      setCheckingConflicts(false);
    }
  }, [scheduledDate, scheduledTime, sessionDurationMin]);

  useEffect(() => {
    checkConflicts();
  }, [checkConflicts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!accessToken) {
        setError("You must be logged in to schedule sessions");
        setLoading(false);
        return;
      }

      if (!scheduledDate || !scheduledTime) {
        setError("Please select both date and time");
        setLoading(false);
        return;
      }

      // Combine date and time into ISO string
      const dateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      if (isNaN(dateTime.getTime())) {
        setError("Invalid date or time");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          sessionId,
          scheduledDate: dateTime.toISOString(),
          location: location || undefined,
          teamName: teamName || undefined,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to schedule session");
      }

      if (onScheduled) {
        onScheduled();
      }
      onClose();
    } catch (e: any) {
      console.error("[SCHEDULE_MODAL] Error:", e);
      setError(e.message || "Failed to schedule session");
    } finally {
      setLoading(false);
    }
  };

  // Set default time to next hour
  const getDefaultTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    return now.toTimeString().slice(0, 5);
  };

  // Set default date to today
  const getDefaultDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative max-w-md w-full rounded-2xl border border-slate-700/70 bg-slate-900/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 mb-1">Schedule Session</h2>
            <p className="text-sm text-slate-400 truncate">{sessionTitle}</p>
            {sessionRefCode && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-xs font-mono border border-cyan-700/30">
                {sessionRefCode}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
              Date
            </label>
            <DatePicker
              value={scheduledDate || getDefaultDate()}
              onChange={setScheduledDate}
              min={getDefaultDate()}
              className="w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
              Time
            </label>
            <TimePicker
              value={scheduledTime || getDefaultTime()}
              onChange={setScheduledTime}
              className="w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
              Location (Optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Field 1, Main Facility"
              className="w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
              Team/Group (Optional)
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g., U12 Team A, Senior Squad"
              className="w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this session..."
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
            />
          </div>

          {checkingConflicts && (
            <p className="text-xs text-slate-500">Checking for conflicts...</p>
          )}
          {!checkingConflicts && conflictingEvents.length > 0 && (
            <div className="rounded-lg border border-amber-600/50 bg-amber-900/20 p-3 text-sm">
              <p className="font-medium text-amber-200 mb-2">
                You already have {conflictingEvents.length} session{conflictingEvents.length !== 1 ? "s" : ""} at this time:
              </p>
              <ul className="list-disc list-inside space-y-1 text-amber-200/90">
                {conflictingEvents.map((ev) => {
                  const time = new Date(ev.scheduledDate);
                  const timeStr = time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                  return (
                    <li key={ev.id}>
                      {timeStr} – {ev.title} ({ev.durationMin} min)
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-amber-200/70">
                You can still schedule this session, or pick a different time.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Scheduling..." : "Schedule Session"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
