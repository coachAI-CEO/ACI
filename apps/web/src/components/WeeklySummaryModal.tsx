"use client";

import { useState, useEffect } from "react";
import DatePicker from "./DatePicker";

interface WeeklySummaryModalProps {
  initialWeekStart?: Date;
  initialWeekEnd?: Date;
  onClose: () => void;
}

interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  events: Array<{
    id: string;
    sessionId: string;
    sessionRefCode: string | null;
    scheduledDate: string;
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
  }>;
  totalSessions: number;
  totalMinutes: number;
  ageGroups: string[];
  gameModels: string[];
  aiSummary?: string; // AI-generated parent communication summary
}

const gameModelLabel: Record<string, string> = {
  POSSESSION: "Possession",
  PRESSING: "Pressing",
  TRANSITION: "Transition",
  COACHAI: "Balanced",
};

export default function WeeklySummaryModal({
  initialWeekStart,
  initialWeekEnd,
  onClose,
}: WeeklySummaryModalProps) {
  // Calculate initial week (Sunday to Saturday)
  const getWeekRange = (date: Date) => {
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - day); // Go back to Sunday
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Go forward to Saturday
    weekEnd.setHours(23, 59, 59, 999);
    return { weekStart, weekEnd };
  };

  const initialDate = initialWeekStart || new Date();
  const initialRange = getWeekRange(initialDate);
  
  const [selectedDate, setSelectedDate] = useState<string>(
    initialRange.weekStart.toISOString().split("T")[0]
  );
  const [weekStart, setWeekStart] = useState<Date>(initialRange.weekStart);
  const [weekEnd, setWeekEnd] = useState<Date>(initialRange.weekEnd);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Update week range when selected date changes
  useEffect(() => {
    if (selectedDate) {
      const date = new Date(selectedDate);
      const range = getWeekRange(date);
      setWeekStart(range.weekStart);
      setWeekEnd(range.weekEnd);
    }
  }, [selectedDate]);

  // Load summary when week range changes
  useEffect(() => {
    if (weekStart && weekEnd) {
      loadSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, weekEnd]);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!accessToken) {
        setError("You must be logged in to generate summaries");
        setLoading(false);
        return;
      }

      const weekStartStr = weekStart.toISOString().split("T")[0];
      const weekEndStr = weekEnd.toISOString().split("T")[0];

      // Add timeout for AI generation (can take up to 90s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 95000); // 95 second timeout

      let res: Response;
      try {
        res = await fetch(
          `/api/calendar/weekly-summary?weekStart=${weekStartStr}&weekEnd=${weekEndStr}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === "AbortError") {
          throw new Error("Request timeout. AI generation is taking longer than expected. Please try again.");
        }
        // Check for network/connection errors
        if (fetchError.message?.includes("fetch failed") || fetchError.message?.includes("Failed to fetch")) {
          throw new Error("Unable to connect to the backend server. Please ensure the API server is running on port 4000.");
        }
        throw new Error(fetchError.message || "Failed to connect to server");
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate summary");
      }

      setSummary(data.summary);
      setText(data.text || "");
    } catch (e: any) {
      console.error("[WEEKLY_SUMMARY] Error:", e);
      setError(e.message || "Failed to load weekly summary");
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);

    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!accessToken) {
        setError("You must be logged in to export PDF");
        setExportingPdf(false);
        return;
      }

      const weekStartStr = weekStart.toISOString().split("T")[0];
      const weekEndStr = weekEnd.toISOString().split("T")[0];

      const res = await fetch(
        `/api/calendar/weekly-summary?weekStart=${weekStartStr}&weekEnd=${weekEndStr}&format=pdf`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to export PDF");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `weekly-summary-${weekStartStr}-${weekEndStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      console.error("[WEEKLY_SUMMARY] PDF export error:", e);
      setError(e.message || "Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleCopyText = () => {
    // Include AI summary if available, otherwise use the formatted text
    const textToCopy = summary?.aiSummary || text;
    navigator.clipboard.writeText(textToCopy);
    // You could add a toast notification here
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

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
        className="relative max-w-4xl w-full rounded-2xl border border-slate-700/70 bg-slate-900/95 shadow-2xl my-8 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 p-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-100 mb-1">Weekly Training Summary</h2>
              <p className="text-sm text-slate-400 mb-3">
                {formatDate(weekStart.toISOString())} - {formatDate(weekEnd.toISOString())}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-xs text-slate-400 uppercase tracking-wide whitespace-nowrap">
                  Select Week:
                </label>
                <DatePicker
                  value={selectedDate}
                  onChange={(value) => {
                    setSelectedDate(value);
                    setLoading(true); // Show loading when week changes
                  }}
                  className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                />
                <span className="text-xs text-slate-500">
                  (Select any date in the week)
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500 flex-shrink-0"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {loading && (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              <p className="mt-4 text-slate-400">Generating AI summary...</p>
              <p className="mt-2 text-xs text-slate-500">This may take a moment</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-700/50 bg-red-900/20 p-4 text-sm text-red-300 mb-4">
              {error}
            </div>
          )}

        {!loading && !error && summary && (
          <>
            {/* AI-Generated Summary */}
            {summary.aiSummary && (
              <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-5 mb-4">
                <h3 className="text-sm font-semibold text-emerald-300 mb-3 flex items-center gap-2">
                  <span>✨</span>
                  <span>Parent Communication Summary</span>
                </h3>
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {summary.aiSummary}
                  </div>
                </div>
              </div>
            )}

            {/* Summary Statistics */}
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-4 mb-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Total Sessions</div>
                  <div className="text-lg font-bold text-slate-100">{summary.totalSessions}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Total Time</div>
                  <div className="text-lg font-bold text-slate-100">
                    {Math.floor(summary.totalMinutes / 60)}h {summary.totalMinutes % 60}m
                  </div>
                </div>
                {summary.ageGroups.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Age Groups</div>
                    <div className="text-sm font-semibold text-slate-200">{summary.ageGroups.join(", ")}</div>
                  </div>
                )}
                {summary.gameModels.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Focus Areas</div>
                    <div className="text-sm font-semibold text-slate-200">
                      {summary.gameModels.map((gm) => gameModelLabel[gm] || gm).join(", ")}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Events by Day */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {(() => {
                // Group events by date
                const eventsByDate: Record<string, typeof summary.events> = {};
                summary.events.forEach((event) => {
                  const dateKey = new Date(event.scheduledDate).toISOString().split("T")[0];
                  if (!eventsByDate[dateKey]) {
                    eventsByDate[dateKey] = [];
                  }
                  eventsByDate[dateKey].push(event);
                });

                return Object.keys(eventsByDate)
                  .sort()
                  .map((dateKey) => {
                    const dayEvents = eventsByDate[dateKey];
                    return (
                      <div
                        key={dateKey}
                        className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-4"
                      >
                        <h3 className="text-sm font-semibold text-slate-200 mb-3">
                          {formatDate(dateKey)}
                        </h3>
                        <div className="space-y-3">
                          {dayEvents.map((event) => (
                            <div
                              key={event.id}
                              className="border-l-2 border-emerald-500/50 pl-3 py-2"
                            >
                              <div className="font-semibold text-slate-100 text-sm mb-1">
                                {event.session?.title || "Untitled Session"}
                              </div>
                              <div className="text-xs text-slate-400 space-y-0.5">
                                <div>Time: {formatTime(event.scheduledDate)}</div>
                                <div>Duration: {event.durationMin} minutes</div>
                                {event.location && <div>Location: {event.location}</div>}
                                {event.teamName && <div>Team: {event.teamName}</div>}
                                {event.session?.ageGroup && (
                                  <div>Age Group: {event.session.ageGroup}</div>
                                )}
                                {event.notes && (
                                  <div className="text-slate-500 italic">Notes: {event.notes}</div>
                                )}
                                {event.sessionRefCode && (
                                  <div className="text-slate-500">Ref: {event.sessionRefCode}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 mt-4 border-t border-slate-700/50">
              <button
                onClick={handleCopyText}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                📋 Copy Text
              </button>
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingPdf ? "Exporting PDF..." : "📄 Export PDF"}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
