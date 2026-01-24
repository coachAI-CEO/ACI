"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import DatePicker from "./DatePicker";
import TimePicker from "./TimePicker";

interface SeriesSession {
  id: string;
  title: string;
  refCode?: string | null;
}

interface ScheduleSeriesModalProps {
  seriesId: string;
  seriesTitle: string;
  sessions: SeriesSession[];
  onClose: () => void;
  onScheduled?: () => void;
}

export default function ScheduleSeriesModal({
  seriesId,
  seriesTitle,
  sessions,
  onClose,
  onScheduled,
}: ScheduleSeriesModalProps) {
  // State for each session's scheduling
  const [sessionSchedules, setSessionSchedules] = useState<Map<string, {
    date: string;
    time: string;
  }>>(new Map());

  const [location, setLocation] = useState("");
  const [teamName, setTeamName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize default dates/times for each session on mount
  useEffect(() => {
    // Only initialize if schedules are empty
    if (sessionSchedules.size > 0) return;
    
    const initialSchedules = new Map<string, { date: string; time: string }>();
    
    sessions.forEach((session, index) => {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + index); // Each session is scheduled one day after the previous
      const dateStr = defaultDate.toISOString().split("T")[0];
      
      const defaultTime = new Date();
      defaultTime.setHours(defaultTime.getHours() + 1, 0, 0, 0);
      const timeStr = defaultTime.toTimeString().slice(0, 5);

      initialSchedules.set(session.id, { date: dateStr, time: timeStr });
    });

    setSessionSchedules(initialSchedules);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

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

      // Validate all sessions have date and time
      const missingSchedules: string[] = [];
      sessions.forEach((session) => {
        const schedule = sessionSchedules.get(session.id);
        if (!schedule || !schedule.date || !schedule.time) {
          missingSchedules.push(session.title || `Session ${sessions.indexOf(session) + 1}`);
        }
      });

      if (missingSchedules.length > 0) {
        setError(`Please select date and time for: ${missingSchedules.join(", ")}`);
        setLoading(false);
        return;
      }

      // Schedule all sessions
      const schedulePromises = sessions.map(async (session) => {
        const schedule = sessionSchedules.get(session.id)!;
        const dateTime = new Date(`${schedule.date}T${schedule.time}`);
        
        if (isNaN(dateTime.getTime())) {
          throw new Error(`Invalid date or time for ${session.title}`);
        }

        const res = await fetch("/api/calendar/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            sessionId: session.id,
            scheduledDate: dateTime.toISOString(),
            location: location || undefined,
            teamName: teamName || undefined,
            notes: notes || undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Failed to schedule ${session.title}`);
        }

        return data;
      });

      await Promise.all(schedulePromises);

      if (onScheduled) {
        onScheduled();
      }
      onClose();
    } catch (e: any) {
      console.error("[SCHEDULE_SERIES_MODAL] Error:", e);
      setError(e.message || "Failed to schedule sessions");
    } finally {
      setLoading(false);
    }
  };

  const updateSessionSchedule = useCallback((sessionId: string, field: "date" | "time", value: string) => {
    setSessionSchedules((prev) => {
      const next = new Map(prev);
      const current = next.get(sessionId) || { date: "", time: "" };
      // Only update if value actually changed
      if (current[field] === value) {
        return prev; // Return previous state to prevent unnecessary re-render
      }
      next.set(sessionId, { ...current, [field]: value });
      return next;
    });
  }, []);

  // Set default date to today (memoized to prevent recalculation)
  const defaultDate = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  // Set default time to next hour (memoized to prevent recalculation)
  const defaultTime = useMemo(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    return now.toTimeString().slice(0, 5);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative max-w-2xl w-full rounded-2xl border border-slate-700/70 bg-slate-900/95 p-6 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 mb-1">Schedule Series</h2>
            <p className="text-sm text-slate-400 truncate">{seriesTitle}</p>
            <p className="text-xs text-slate-500 mt-1">{sessions.length} session{sessions.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Session scheduling fields */}
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {sessions.map((session, index) => {
              const schedule = sessionSchedules.get(session.id) || { date: "", time: "" };
              
              return (
                <div
                  key={session.id}
                  className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-slate-200 mb-1">
                        Session {index + 1}: {session.title}
                      </h3>
                      {session.refCode && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-xs font-mono border border-cyan-700/30">
                          {session.refCode}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
                        Date
                      </label>
                      <DatePicker
                        value={schedule.date || defaultDate}
                        onChange={(value) => {
                          updateSessionSchedule(session.id, "date", value);
                        }}
                        min={defaultDate}
                        className="w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
                        Time
                      </label>
                      <TimePicker
                        value={schedule.time || defaultTime}
                        onChange={(value) => {
                          updateSessionSchedule(session.id, "time", value);
                        }}
                        className="w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                        required
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Common fields */}
          <div className="space-y-4 border-t border-slate-700/50 pt-4">
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
                placeholder="Add any notes for these sessions..."
                rows={3}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
              />
            </div>
          </div>

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
              {loading ? `Scheduling ${sessions.length} session${sessions.length !== 1 ? "s" : ""}...` : `Schedule All ${sessions.length} Session${sessions.length !== 1 ? "s" : ""}`}
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
