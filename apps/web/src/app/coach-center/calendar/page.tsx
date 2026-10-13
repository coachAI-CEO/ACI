"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCoachCenter } from "../_lib/CoachCenterContext";
import type { CalendarDay } from "../_lib/types";
import { authHeaders, mondayWeekStartIso, shiftWeek } from "../_lib/utils";

export default function CoachCenterCalendarPage() {
  const { selectedTeam, selectedTeamId, access } = useCoachCenter();
  const [weekStart, setWeekStart] = useState(mondayWeekStartIso());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (teamId: string, week: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coach-center/teams/${teamId}/calendar?weekStart=${week}`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) setDays(data.days || []);
      else setDays([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedTeamId) void load(selectedTeamId, weekStart);
  }, [access, selectedTeamId, weekStart, load]);

  if (!selectedTeam) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900 p-8 text-center">
        <h1 className="text-lg font-semibold text-white">Calendar needs a team</h1>
        <Link href="/coach-center/team" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white">
          Create your team
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Calendar</h1>
          <p className="mt-1 text-sm text-slate-400">
            Your training week for {selectedTeam.name}. Team sessions are highlighted.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300"
            onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
          >
            Previous
          </button>
          <button
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300"
            onClick={() => setWeekStart(mondayWeekStartIso())}
          >
            This week
          </button>
          <button
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300"
            onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
          >
            Next
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Week of {weekStart}
        {loading ? " · loading…" : ""}
      </p>

      <div className="grid gap-2 md:grid-cols-7">
        {days.map((day) => (
          <div key={day.date} className="min-h-[160px] rounded-2xl border border-slate-700/50 bg-slate-800/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {day.dayLabel}
            </p>
            <p className="text-xs text-slate-400">{day.date.slice(5)}</p>
            <div className="mt-2 space-y-2">
              {day.events.length === 0 ? (
                <p className="text-[11px] text-slate-600">Open</p>
              ) : (
                day.events.map((event) => (
                  <div
                    key={event.id}
                    className={`rounded-lg border px-2 py-1.5 text-xs ${
                      event.forThisTeam
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-100"
                        : "border-slate-700 bg-slate-900/50 text-slate-300"
                    }`}
                  >
                    <p className="font-medium">{event.session?.title || "Session"}</p>
                    <p className="text-[10px] opacity-70">
                      {event.time}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={selectedTeam.generateHref}
          className="inline-flex min-h-11 items-center rounded-md bg-sky-600 px-3 text-sm font-medium text-white"
        >
          Plan this week&apos;s session
        </Link>
        <Link
          href="/calendar"
          className="inline-flex min-h-11 items-center rounded-md border border-slate-600 px-3 text-sm text-slate-200"
        >
          Open full calendar
        </Link>
      </div>
    </div>
  );
}
