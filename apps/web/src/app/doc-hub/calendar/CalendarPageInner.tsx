"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDocHub } from "../_lib/DocHubContext";
import type {
  CalendarCoach,
  CalendarDay,
  CoachUsageRow,
  VaultSessionOption,
} from "../_lib/types";
import {
  authHeaders,
  btnPrimary,
  btnQuiet,
  btnSecondary,
  mondayWeekStartIso,
  shiftWeek,
} from "../_lib/utils";

function scheduledDateForAssignDay(dayLabel: string, week: string): string {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const idx = Math.max(0, labels.indexOf(dayLabel));
  const [y, m, d] = week.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + idx, 17, 0, 0, 0));
  return dt.toISOString();
}

export default function CalendarPageInner() {
  const { access, selectedClubId } = useDocHub();
  const searchParams = useSearchParams();
  const [weekStart, setWeekStart] = useState(mondayWeekStartIso);
  const [calendarCoachFilter, setCalendarCoachFilter] = useState("");
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarCoaches, setCalendarCoaches] = useState<CalendarCoach[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [usageRows, setUsageRows] = useState<CoachUsageRow[]>([]);
  const [vaultSessions, setVaultSessions] = useState<VaultSessionOption[]>([]);
  const [assignDay, setAssignDay] = useState("Mon");
  const [assignSessionId, setAssignSessionId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [reassignEventId, setReassignEventId] = useState<string | null>(null);
  const [reassignToCoachId, setReassignToCoachId] = useState("");

  useEffect(() => {
    const coach = searchParams.get("coach");
    const action = searchParams.get("action");
    if (coach) setCalendarCoachFilter(coach);
    if (action === "assign" && coach) {
      setAssignMessage("Assign a vault session to the selected coach.");
    }
  }, [searchParams]);

  const loadUsage = useCallback(async (clubId: string) => {
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/coaches/usage?days=7`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) return;
      setUsageRows(
        (data.coaches || []).map(
          (c: {
            userId: string;
            name: string;
            roleLabel: string;
            runs: number;
            lastActiveLabel: string;
            status: string;
          }) => ({
            userId: c.userId,
            name: c.name,
            roleLabel: c.roleLabel,
            runs: c.runs,
            lastActiveLabel: c.lastActiveLabel,
            status: c.status,
          })
        )
      );
    } catch {
      setUsageRows([]);
    }
  }, []);

  const loadCalendar = useCallback(async (clubId: string, week: string, coachUserId: string) => {
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const qs = new URLSearchParams({ weekStart: week });
      if (coachUserId) qs.set("coachUserId", coachUserId);
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/calendar/week?${qs}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load weekly calendar");
      setCalendarCoaches(data.coaches || []);
      setCalendarDays(data.days || []);
      if (data.weekStart && data.weekStart !== week) setWeekStart(data.weekStart);
    } catch (e: any) {
      setCalendarError(e?.message || "Failed to load weekly calendar");
      setCalendarCoaches([]);
      setCalendarDays([]);
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  const loadVaultSessions = useCallback(async (clubId: string) => {
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/vault/sessions?limit=100`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) return;
      const sessions: VaultSessionOption[] = (data.sessions || []).map(
        (s: VaultSessionOption) => ({
          id: s.id,
          refCode: s.refCode,
          title: s.title,
          ageGroup: s.ageGroup,
          durationMin: s.durationMin,
        })
      );
      setVaultSessions(sessions);
      setAssignSessionId((prev) => prev || sessions[0]?.id || "");
    } catch {
      setVaultSessions([]);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) {
      void loadUsage(selectedClubId);
      void loadVaultSessions(selectedClubId);
    }
  }, [access, selectedClubId, loadUsage, loadVaultSessions]);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) {
      void loadCalendar(selectedClubId, weekStart, calendarCoachFilter);
    }
  }, [access, selectedClubId, weekStart, calendarCoachFilter, loadCalendar]);

  async function handleAddToCoach() {
    if (!selectedClubId || !calendarCoachFilter || !assignSessionId) {
      setAssignMessage("Select a coach, day, and vault session first.");
      return;
    }
    setAssignBusy(true);
    setAssignMessage(null);
    setCalendarError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${selectedClubId}/calendar/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          coachUserId: calendarCoachFilter,
          sessionId: assignSessionId,
          scheduledDate: scheduledDateForAssignDay(assignDay, weekStart),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            (data?.error === "DAY_CONFLICT"
              ? "Coach already has a session that day"
              : "Assign failed")
        );
      }
      setAssignMessage("Session added to coach calendar.");
      await loadCalendar(selectedClubId, weekStart, calendarCoachFilter);
    } catch (e: any) {
      setCalendarError(e?.message || "Assign failed");
    } finally {
      setAssignBusy(false);
    }
  }

  async function handleAutoPopulate() {
    if (!selectedClubId || !calendarCoachFilter) {
      setAssignMessage("Select a coach first to auto-populate their week.");
      return;
    }
    setAssignBusy(true);
    setAssignMessage(null);
    setCalendarError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${selectedClubId}/calendar/auto-populate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          coachUserId: calendarCoachFilter,
          weekStart,
          defaultTime: "17:00",
          skipDaysWithEvents: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || data?.error || "Auto-populate failed");
      }
      const created = data.created?.length || 0;
      const skipped = data.skipped?.length || 0;
      setAssignMessage(`Auto-populated ${created} day(s); skipped ${skipped}.`);
      await loadCalendar(selectedClubId, weekStart, calendarCoachFilter);
    } catch (e: any) {
      setCalendarError(e?.message || "Auto-populate failed");
    } finally {
      setAssignBusy(false);
    }
  }

  async function handleReassign() {
    if (!selectedClubId || !reassignEventId || !reassignToCoachId) return;
    setAssignBusy(true);
    setCalendarError(null);
    setAssignMessage(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${selectedClubId}/calendar/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          eventId: reassignEventId,
          toCoachUserId: reassignToCoachId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || data?.error || "Reassign failed");
      }
      setAssignMessage("Session reassigned to substitute coach.");
      setReassignEventId(null);
      setReassignToCoachId("");
      await loadCalendar(selectedClubId, weekStart, calendarCoachFilter);
    } catch (e: any) {
      setCalendarError(e?.message || "Reassign failed");
    } finally {
      setAssignBusy(false);
    }
  }

  const coachOptions = usageRows.length > 0 ? usageRows : calendarCoaches;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Calendar</h1>
          <p className="mt-1 text-sm text-slate-400">
            Week of {weekStart}
            {calendarDays.length ? ` – ${calendarDays[calendarDays.length - 1]?.date}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnQuiet} onClick={() => setWeekStart((w) => shiftWeek(w, -1))}>
            Prev week
          </button>
          <button type="button" className={btnQuiet} onClick={() => setWeekStart(mondayWeekStartIso())}>
            This week
          </button>
          <button type="button" className={btnQuiet} onClick={() => setWeekStart((w) => shiftWeek(w, 1))}>
            Next week
          </button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        <select
          className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
          value={calendarCoachFilter}
          onChange={(e) => setCalendarCoachFilter(e.target.value)}
        >
          <option value="">All coaches (view)</option>
          {coachOptions.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
          value={assignDay}
          onChange={(e) => setAssignDay(e.target.value)}
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
          value={assignSessionId}
          onChange={(e) => setAssignSessionId(e.target.value)}
        >
          <option value="">Select Vault session</option>
          {vaultSessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
              {s.refCode ? ` (${s.refCode})` : ""} · {s.ageGroup}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={btnSecondary}
          disabled={assignBusy || !calendarCoachFilter || !assignSessionId}
          onClick={() => void handleAddToCoach()}
        >
          {assignBusy ? "Working…" : "Add to Coach"}
        </button>
        <button
          type="button"
          className={btnPrimary}
          disabled={assignBusy || !calendarCoachFilter}
          onClick={() => void handleAutoPopulate()}
        >
          Auto Populate Week
        </button>
      </div>

      {assignMessage ? <p className="text-sm text-emerald-300">{assignMessage}</p> : null}

      {reassignEventId ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3">
          <span className="text-sm text-slate-300">Reassign selected session to:</span>
          <select
            className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200"
            value={reassignToCoachId}
            onChange={(e) => setReassignToCoachId(e.target.value)}
          >
            <option value="">Select substitute coach</option>
            {coachOptions.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={btnPrimary}
            disabled={assignBusy || !reassignToCoachId}
            onClick={() => void handleReassign()}
          >
            Confirm reassign
          </button>
          <button
            type="button"
            className={btnQuiet}
            onClick={() => {
              setReassignEventId(null);
              setReassignToCoachId("");
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60">
        {calendarLoading ? (
          <p className="p-5 text-sm text-slate-400">Loading weekly calendar…</p>
        ) : calendarError ? (
          <p className="p-5 text-sm text-rose-300">{calendarError}</p>
        ) : calendarCoaches.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No coaches to show for this club/filter.</p>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-2 pr-3 font-medium">Day</th>
                  {calendarCoaches.map((coach) => (
                    <th key={coach.userId} className="py-2 pr-3 font-medium last:pr-0">
                      {coach.name}
                      {coach.roleLabel ? (
                        <span className="block text-xs font-normal text-slate-500">
                          {coach.roleLabel}
                        </span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendarDays
                  .filter((day) => ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(day.dayLabel))
                  .map((day) => (
                    <tr key={day.date} className="border-b border-slate-900/80 align-top">
                      <td className="py-2.5 pr-3 text-slate-200">
                        <div>{day.dayLabel}</div>
                        <div className="text-xs text-slate-500">{day.date.slice(5)}</div>
                      </td>
                      {calendarCoaches.map((coach) => {
                        const events = day.cells?.[coach.userId] || [];
                        return (
                          <td key={coach.userId} className="py-2.5 pr-3 text-slate-300 last:pr-0">
                            {events.length === 0 ? (
                              <span className="text-slate-500">—</span>
                            ) : (
                              <div className="space-y-2">
                                {events.map((ev) => (
                                  <div key={ev.eventId} className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span>{ev.title}</span>
                                      {ev.isCoverage ? (
                                        <span className="rounded border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                                          Coverage
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      {ev.code} · {ev.time}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs text-cyan-300 hover:underline"
                                      onClick={() => {
                                        setReassignEventId(ev.eventId);
                                        setReassignToCoachId("");
                                        setAssignMessage(null);
                                      }}
                                    >
                                      Reassign
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
