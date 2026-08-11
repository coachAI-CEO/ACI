"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { canAccessDocHub, readStoredUser } from "@/lib/doc-hub-access";

type AttentionItem = {
  id: string;
  ruleId: string;
  severity: string;
  coachUserId: string;
  coachName: string;
  title: string;
  detail: string;
  weekStart: string;
  action: { type: "assign" | "calendar" | "none" };
};

type AttentionSummary = {
  coachesManaged: number;
  activeCoaches: number;
  emptyWeekCount: number;
  weeklyAiSessions: number;
};
type CoachUsageRow = {
  userId: string;
  name: string;
  roleLabel: string;
  runs: number;
  lastActiveLabel: string;
  status: string;
};

type CalendarCoach = {
  userId: string;
  name: string;
  roleLabel: string;
};

type CalendarCellEvent = {
  eventId: string;
  title: string;
  code: string;
  time: string;
  isCoverage?: boolean;
};

type CalendarDay = {
  date: string;
  dayLabel: string;
  cells: Record<string, CalendarCellEvent[]>;
};

type VaultSessionOption = {
  id: string;
  refCode: string | null;
  title: string;
  ageGroup: string;
  durationMin: number | null;
};

type UsageSummary = {
  coachesManaged: number;
  activeCoaches: number;
  inactiveThisWeek: number;
  weeklyAiSessions: number;
};

function mondayWeekStartIso(d = new Date()): string {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + offset);
  return utc.toISOString().slice(0, 10);
}

function shiftWeek(weekStart: string, deltaWeeks: number): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaWeeks * 7);
  return dt.toISOString().slice(0, 10);
}

type PhilosophyForm = {
  attackingOrganization: string;
  defensiveTransition: string;
  defensiveOrganization: string;
  attackingTransition: string;
};

const EMPTY_PHILOSOPHY: PhilosophyForm = {
  attackingOrganization: "",
  defensiveTransition: "",
  defensiveOrganization: "",
  attackingTransition: "",
};

type ClubOption = { clubId: string; clubName: string; role?: string };

function statusPill(status: string) {
  if (status === "heavy") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (status === "active") return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
  if (status === "low") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-rose-500/15 text-rose-300 border-rose-400/30";
}

function severityPill(severity: string) {
  if (severity === "high") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  if (severity === "medium") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
}

const btnSecondary =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-600 bg-transparent px-3 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-40";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-600 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40";
const btnQuiet =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-700 bg-transparent px-3 text-sm text-slate-300";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function DocHubPage() {
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [clubOptions, setClubOptions] = useState<ClubOption[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [canEditPhilosophy, setCanEditPhilosophy] = useState(false);
  const [philosophy, setPhilosophy] = useState<PhilosophyForm>(EMPTY_PHILOSOPHY);
  const [gameModelId, setGameModelId] = useState<string>("");
  const [clubName, setClubName] = useState<string>("");
  const [philosophyUpdatedAt, setPhilosophyUpdatedAt] = useState<string | null>(null);
  const [philosophyLoading, setPhilosophyLoading] = useState(false);
  const [philosophySaving, setPhilosophySaving] = useState(false);
  const [philosophyMessage, setPhilosophyMessage] = useState<string | null>(null);
  const [philosophyError, setPhilosophyError] = useState<string | null>(null);

  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageRows, setUsageRows] = useState<CoachUsageRow[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);

  const [weekStart, setWeekStart] = useState(mondayWeekStartIso);
  const [calendarCoachFilter, setCalendarCoachFilter] = useState("");
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarCoaches, setCalendarCoaches] = useState<CalendarCoach[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [vaultSessions, setVaultSessions] = useState<VaultSessionOption[]>([]);
  const [assignDay, setAssignDay] = useState("Mon");
  const [assignSessionId, setAssignSessionId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [reassignEventId, setReassignEventId] = useState<string | null>(null);
  const [reassignToCoachId, setReassignToCoachId] = useState("");
  const [attentionLoading, setAttentionLoading] = useState(false);
  const [attentionError, setAttentionError] = useState<string | null>(null);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [attentionSummary, setAttentionSummary] = useState<AttentionSummary | null>(null);
  const [attentionWarning, setAttentionWarning] = useState<string | null>(null);
  const [laterOpen, setLaterOpen] = useState(false);
  const calendarSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const applyUser = (user: unknown) => {
      if (cancelled) return;
      setAccess(canAccessDocHub(user as any) ? "allowed" : "denied");
    };

    applyUser(readStoredUser());

    const token = localStorage.getItem("accessToken");
    if (!token) {
      setAccess("denied");
      return;
    }

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (data?.ok && data.user) {
          try {
            const existing = readStoredUser() || {};
            localStorage.setItem("user", JSON.stringify({ ...existing, ...data.user }));
            window.dispatchEvent(new Event("userLogin"));
          } catch {
            /* ignore storage errors */
          }
          applyUser(data.user);
        }
      })
      .catch(() => {
        /* keep localStorage decision */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (access !== "allowed") return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/doc-hub/access", { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok || !data?.ok || cancelled) return;

        setCanEditPhilosophy(Boolean(data.canEditPhilosophy));

        const fromMemberships: ClubOption[] = (data.memberships || []).map(
          (m: { clubId: string; clubName: string; role: string }) => ({
            clubId: m.clubId,
            clubName: m.clubName,
            role: m.role,
          })
        );
        const fromPreview: ClubOption[] = (data.previewClubs || []).map(
          (c: { id: string; name: string }) => ({
            clubId: c.id,
            clubName: c.name,
            role: "SUPER_ADMIN",
          })
        );
        const options = fromMemberships.length > 0 ? fromMemberships : fromPreview;
        setClubOptions(options);
        if (options[0]?.clubId) {
          setSelectedClubId((prev) => prev || options[0].clubId);
        }
      } catch {
        if (!cancelled) setPhilosophyError("Could not load DOC Hub club access.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [access]);

  const loadPhilosophy = useCallback(async (clubId: string) => {
    if (!clubId) return;
    setPhilosophyLoading(true);
    setPhilosophyError(null);
    setPhilosophyMessage(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/philosophy`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load club philosophy");
      }
      setClubName(data.clubName || "");
      setGameModelId(data.gameModelId || "");
      setPhilosophyUpdatedAt(data.philosophyUpdatedAt || null);
      setPhilosophy({
        attackingOrganization: data.philosophy?.attackingOrganization || "",
        defensiveTransition: data.philosophy?.defensiveTransition || "",
        defensiveOrganization: data.philosophy?.defensiveOrganization || "",
        attackingTransition: data.philosophy?.attackingTransition || "",
      });
    } catch (e: any) {
      setPhilosophyError(e?.message || "Failed to load club philosophy");
    } finally {
      setPhilosophyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) {
      void loadPhilosophy(selectedClubId);
    }
  }, [access, selectedClubId, loadPhilosophy]);

  const loadUsage = useCallback(async (clubId: string) => {
    if (!clubId) return;
    setUsageLoading(true);
    setUsageError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/coaches/usage?days=7`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load coach usage");
      }
      setUsageSummary(data.summary || null);
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
    } catch (e: any) {
      setUsageError(e?.message || "Failed to load coach usage");
      setUsageRows([]);
      setUsageSummary(null);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  const loadCalendar = useCallback(async (clubId: string, week: string, coachUserId: string) => {
    if (!clubId) return;
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const qs = new URLSearchParams({ weekStart: week });
      if (coachUserId) qs.set("coachUserId", coachUserId);
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/calendar/week?${qs}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load weekly calendar");
      }
      setCalendarCoaches(data.coaches || []);
      setCalendarDays(data.days || []);
      if (data.weekStart && data.weekStart !== week) {
        setWeekStart(data.weekStart);
      }
    } catch (e: any) {
      setCalendarError(e?.message || "Failed to load weekly calendar");
      setCalendarCoaches([]);
      setCalendarDays([]);
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) {
      void loadUsage(selectedClubId);
    }
  }, [access, selectedClubId, loadUsage]);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) {
      void loadCalendar(selectedClubId, weekStart, calendarCoachFilter);
    }
  }, [access, selectedClubId, weekStart, calendarCoachFilter, loadCalendar]);

  const loadVaultSessions = useCallback(async (clubId: string) => {
    if (!clubId) return;
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
      void loadVaultSessions(selectedClubId);
    }
  }, [access, selectedClubId, loadVaultSessions]);

  const loadAttention = useCallback(async (clubId: string, week: string) => {
    if (!clubId) return;
    setAttentionLoading(true);
    setAttentionError(null);
    try {
      const qs = new URLSearchParams({ weekStart: week });
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/attention?${qs}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load club attention");
      }
      setAttentionItems(data.items || []);
      setAttentionSummary(data.summary || null);
      setAttentionWarning(
        Array.isArray(data.warnings) && data.warnings.length
          ? data.warnings.join(", ")
          : null
      );
    } catch (e: any) {
      setAttentionError(e?.message || "Failed to load club attention");
      setAttentionItems([]);
      setAttentionSummary(null);
    } finally {
      setAttentionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) {
      void loadAttention(selectedClubId, weekStart);
    }
  }, [access, selectedClubId, weekStart, loadAttention]);

  function handleAttentionAction(item: AttentionItem) {
    setCalendarCoachFilter(item.coachUserId);
    setAssignMessage(null);
    if (item.action.type === "assign") {
      setAssignMessage(`Assign a vault session to ${item.coachName} below.`);
    }
    requestAnimationFrame(() => {
      calendarSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function scheduledDateForAssignDay(dayLabel: string, week: string): string {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const idx = Math.max(0, labels.indexOf(dayLabel));
    const [y, m, d] = week.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + idx, 17, 0, 0, 0));
    return dt.toISOString();
  }

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
        const msg =
          data?.message ||
          data?.error ||
          (data?.error === "DAY_CONFLICT" ? "Coach already has a session that day" : "Assign failed");
        throw new Error(msg);
      }
      setAssignMessage("Session added to coach calendar.");
      await loadCalendar(selectedClubId, weekStart, calendarCoachFilter);
      await loadAttention(selectedClubId, weekStart);
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
          sessionIds: undefined,
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
      await loadAttention(selectedClubId, weekStart);
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

  async function savePhilosophy(opts?: { pushed?: boolean }) {
    if (!selectedClubId || !canEditPhilosophy) return;
    setPhilosophySaving(true);
    setPhilosophyError(null);
    setPhilosophyMessage(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${selectedClubId}/philosophy`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          attackingOrganization: philosophy.attackingOrganization,
          defensiveTransition: philosophy.defensiveTransition,
          defensiveOrganization: philosophy.defensiveOrganization,
          attackingTransition: philosophy.attackingTransition,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || "Save failed");
      }
      setPhilosophyUpdatedAt(data.philosophyUpdatedAt || null);
      setPhilosophy({
        attackingOrganization: data.philosophy?.attackingOrganization || "",
        defensiveTransition: data.philosophy?.defensiveTransition || "",
        defensiveOrganization: data.philosophy?.defensiveOrganization || "",
        attackingTransition: data.philosophy?.attackingTransition || "",
      });
      setPhilosophyMessage(
        opts?.pushed
          ? "Saved. Club coaches will inherit this philosophy on their next session generation."
          : "Game model saved."
      );
    } catch (e: any) {
      setPhilosophyError(e?.message || "Save failed");
    } finally {
      setPhilosophySaving(false);
    }
  }

  if (access === "checking") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#060a13] text-slate-400">
        Checking DOC Hub access…
      </main>
    );
  }

  if (access === "denied") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#060a13] px-4 text-slate-50">
        <div className="max-w-md rounded-2xl border border-slate-700/60 bg-[#090f1a] p-8 text-center">
          <h1 className="text-lg font-semibold text-white">DOC or Section Director access required</h1>
          <p className="mt-2 text-sm text-slate-400">
            DOC Hub is for club directors. Coaches and other roles use Session Builder, Vault, and Calendar instead.
          </p>
          <Link
            href="/app"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white"
          >
            Back to app
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh bg-[#060a13] text-slate-50">
      <div className="relative mx-auto w-full max-w-7xl p-4 md:p-6">
        <section className="rounded-2xl border border-slate-800 bg-[#090f1a]">
          <div className="border-b border-slate-800 px-5 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">DOC Hub</h1>
              <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                Beta
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">Club oversight: coach adoption, game model, and weekly session coverage.</p>
          </div>

          <div className="grid gap-3 border-b border-slate-800 p-5 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Coaches Managed",
                value: String(
                  attentionSummary?.coachesManaged ?? usageSummary?.coachesManaged ?? "—"
                ),
                detail: usageSummary
                  ? `${usageSummary.inactiveThisWeek} inactive this week`
                  : usageLoading || attentionLoading
                    ? "Loading…"
                    : "No club data yet",
              },
              {
                label: "Weekly AI Sessions",
                value: String(
                  attentionSummary?.weeklyAiSessions ?? usageSummary?.weeklyAiSessions ?? "—"
                ),
                detail: "Generated in last 7 days",
              },
              {
                label: "Empty weeks",
                value: attentionSummary ? String(attentionSummary.emptyWeekCount) : "—",
                detail: attentionWarning
                  ? "Calendar unavailable"
                  : "Coaches with no Mon–today sessions",
              },
              {
                label: "Active Coaches",
                value: (() => {
                  const managed =
                    attentionSummary?.coachesManaged ?? usageSummary?.coachesManaged;
                  const active =
                    attentionSummary?.activeCoaches ?? usageSummary?.activeCoaches;
                  if (managed == null || active == null) return "—";
                  return `${active}/${managed}`;
                })(),
                detail: "Last 7 days with ≥1 session",
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-slate-800 bg-[#071121] p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">{stat.label}</div>
                <div className="mt-1 text-2xl font-semibold text-white">{stat.value}</div>
                <div className="mt-1 text-sm text-slate-400">{stat.detail}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 p-5 xl:grid-cols-[1.2fr_1fr]">
            <section className="rounded-lg border border-slate-800 bg-[#071121] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">Coach Usage Snapshot</h2>
                <span className="text-sm text-slate-400">Sessions generated · last 7 days</span>
              </div>
              {usageLoading ? (
                <p className="text-sm text-slate-400">Loading coach usage…</p>
              ) : usageError ? (
                <p className="text-sm text-rose-300">{usageError}</p>
              ) : usageRows.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No coaches in this club yet. Run the ClubMembership backfill if org members exist.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-slate-400">
                      <tr className="border-b border-slate-800">
                        <th className="py-2 pr-3 font-medium">Coach</th>
                        <th className="py-2 pr-3 font-medium">Role</th>
                        <th className="py-2 pr-3 font-medium">Runs (7d)</th>
                        <th className="py-2 pr-3 font-medium">Last Active</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageRows.map((row) => (
                        <tr key={row.userId} className="border-b border-slate-900/80">
                          <td className="py-2.5 pr-3 text-slate-200">{row.name}</td>
                          <td className="py-2.5 pr-3 text-slate-300">{row.roleLabel}</td>
                          <td className="py-2.5 pr-3 text-slate-200">{row.runs}</td>
                          <td className="py-2.5 pr-3 text-slate-400">{row.lastActiveLabel}</td>
                          <td className="py-2.5">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusPill(row.status)}`}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-slate-800 bg-[#071121] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">Club Attention</h2>
                <span className="text-sm text-slate-400">Who’s dark · empty week</span>
              </div>
              {attentionLoading ? (
                <p className="text-sm text-slate-400">Loading attention…</p>
              ) : attentionError ? (
                <p className="text-sm text-rose-300">{attentionError}</p>
              ) : attentionItems.length === 0 ? (
                <p className="text-sm text-slate-400">All coaches look covered this week.</p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-300">
                  {attentionItems.map((item) => (
                    <li
                      key={item.id}
                      className="border-b border-slate-800 px-0 py-2.5 last:border-b-0"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${severityPill(item.severity)}`}
                            >
                              {item.severity}
                            </span>
                            <span className="font-medium text-slate-100">{item.coachName}</span>
                          </div>
                          <div className="mt-1 text-slate-200">{item.title}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{item.detail}</div>
                        </div>
                        {item.action.type !== "none" ? (
                          <button
                            type="button"
                            className={btnQuiet}
                            onClick={() => handleAttentionAction(item)}
                          >
                            {item.action.type === "assign" ? "Assign" : "Calendar"}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {attentionWarning ? (
                <p className="mt-3 text-xs text-amber-300/90">Warning: {attentionWarning}</p>
              ) : null}
            </section>
          </div>

          <div className="border-t border-slate-800 p-5">
            <section className="p-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Game Model Direction</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Club skeleton across 4 stages
                    {clubName ? ` · ${clubName}` : ""}
                    {gameModelId ? ` · ${gameModelId}` : ""}
                  </p>
                </div>
                {clubOptions.length > 1 ? (
                  <select
                    className="min-h-11 rounded-md border border-slate-700 bg-[#081221] px-3 text-sm text-slate-200"
                    value={selectedClubId}
                    onChange={(e) => setSelectedClubId(e.target.value)}
                  >
                    {clubOptions.map((c) => (
                      <option key={c.clubId} value={c.clubId}>
                        {c.clubName}
                        {c.role ? ` (${c.role})` : ""}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              {!selectedClubId ? (
                <p className="text-sm text-slate-400">No club available for philosophy editing yet.</p>
              ) : philosophyLoading ? (
                <p className="text-sm text-slate-400">Loading club philosophy…</p>
              ) : (
                <>
                  <div className="grid gap-3">
                    <label className="text-xs text-slate-300">
                      Stage 1: Attacking Organization (in possession)
                      <textarea
                        rows={3}
                        value={philosophy.attackingOrganization}
                        disabled={!canEditPhilosophy || philosophySaving}
                        onChange={(e) =>
                          setPhilosophy((prev) => ({ ...prev, attackingOrganization: e.target.value }))
                        }
                        placeholder="Create support triangles around the ball, prioritize third-player runs…"
                        className="mt-1 w-full rounded-md border border-slate-700 bg-[#081221] px-2 py-2 text-sm text-slate-200 disabled:opacity-60"
                      />
                    </label>
                    <label className="text-xs text-slate-300">
                      Stage 2: Defensive Transition (on ball loss)
                      <textarea
                        rows={3}
                        value={philosophy.defensiveTransition}
                        disabled={!canEditPhilosophy || philosophySaving}
                        onChange={(e) =>
                          setPhilosophy((prev) => ({ ...prev, defensiveTransition: e.target.value }))
                        }
                        placeholder="Immediate 5-second counter-press around the loss zone…"
                        className="mt-1 w-full rounded-md border border-slate-700 bg-[#081221] px-2 py-2 text-sm text-slate-200 disabled:opacity-60"
                      />
                    </label>
                    <label className="text-xs text-slate-300">
                      Stage 3: Defensive Organization (out of possession)
                      <textarea
                        rows={3}
                        value={philosophy.defensiveOrganization}
                        disabled={!canEditPhilosophy || philosophySaving}
                        onChange={(e) =>
                          setPhilosophy((prev) => ({ ...prev, defensiveOrganization: e.target.value }))
                        }
                        placeholder="Maintain compact line spacing, force play wide…"
                        className="mt-1 w-full rounded-md border border-slate-700 bg-[#081221] px-2 py-2 text-sm text-slate-200 disabled:opacity-60"
                      />
                    </label>
                    <label className="text-xs text-slate-300">
                      Stage 4: Attacking Transition (on ball regain)
                      <textarea
                        rows={3}
                        value={philosophy.attackingTransition}
                        disabled={!canEditPhilosophy || philosophySaving}
                        onChange={(e) =>
                          setPhilosophy((prev) => ({ ...prev, attackingTransition: e.target.value }))
                        }
                        placeholder="First look forward if advantage exists; if not, secure possession…"
                        className="mt-1 w-full rounded-md border border-slate-700 bg-[#081221] px-2 py-2 text-sm text-slate-200 disabled:opacity-60"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={!canEditPhilosophy || philosophySaving}
                      onClick={() => void savePhilosophy()}
                    >
                      {philosophySaving ? "Saving…" : "Save Game Model"}
                    </button>
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={!canEditPhilosophy || philosophySaving}
                      onClick={() => void savePhilosophy({ pushed: true })}
                    >
                      Push to All Coaches
                    </button>
                    {!canEditPhilosophy ? (
                      <span className="text-xs text-slate-400">Read-only for Section Directors. DOC can edit.</span>
                    ) : null}
                    {philosophyUpdatedAt ? (
                      <span className="text-xs text-slate-500">
                        Last saved {new Date(philosophyUpdatedAt).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                  {philosophyMessage ? (
                    <p className="mt-2 text-sm text-emerald-300">{philosophyMessage}</p>
                  ) : null}
                  {philosophyError ? (
                    <p className="mt-2 text-sm text-rose-300">{philosophyError}</p>
                  ) : null}
                </>
              )}
            </section>
          </div>

          <div className="border-t border-slate-800 p-5">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setLaterOpen((v) => !v)}
            >
              <div>
                <h2 className="text-lg font-semibold text-white">Later</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Topic board and AI agent monitoring — deferred until Attention is in use
                </p>
              </div>
              <span className="text-sm text-slate-400">{laterOpen ? "Hide" : "Show"}</span>
            </button>
            {laterOpen ? (
              <p className="mt-3 text-sm text-slate-500">
                No schema yet for discussion threads or LLM quality scans. Club Attention is the
                Phase 4 wedge; these surfaces stay stubbed on purpose.
              </p>
            ) : null}
          </div>

          <div ref={calendarSectionRef} className="border-t border-slate-800 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Coaches Weekly Calendar</h2>
                <span className="text-sm text-slate-400">
                  Week of {weekStart}
                  {calendarDays.length ? ` – ${calendarDays[calendarDays.length - 1]?.date}` : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnQuiet}
                  onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
                >
                  Prev week
                </button>
                <button
                  type="button"
                  className={btnQuiet}
                  onClick={() => setWeekStart(mondayWeekStartIso())}
                >
                  This week
                </button>
                <button
                  type="button"
                  className={btnQuiet}
                  onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
                >
                  Next week
                </button>
              </div>
            </div>
            <div className="mb-3 grid gap-2 md:grid-cols-5">
              <select
                className="min-h-11 rounded-md border border-slate-700 bg-[#081221] px-3 text-sm text-slate-200"
                value={calendarCoachFilter}
                onChange={(e) => setCalendarCoachFilter(e.target.value)}
              >
                <option value="">All coaches (view)</option>
                {usageRows.map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="min-h-11 rounded-md border border-slate-700 bg-[#081221] px-3 text-sm text-slate-200"
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
                className="min-h-11 rounded-md border border-slate-700 bg-[#081221] px-3 text-sm text-slate-200"
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
            {assignMessage ? (
              <p className="mb-3 text-sm text-emerald-300">{assignMessage}</p>
            ) : null}
            {reassignEventId ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-700 bg-[#081221] p-3">
                <span className="text-sm text-slate-300">Reassign selected session to:</span>
                <select
                  className="min-h-11 rounded-md border border-slate-700 bg-[#060a13] px-3 text-sm text-slate-200"
                  value={reassignToCoachId}
                  onChange={(e) => setReassignToCoachId(e.target.value)}
                >
                  <option value="">Select substitute coach</option>
                  {usageRows.map((c) => (
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
            {calendarLoading ? (
              <p className="text-sm text-slate-400">Loading weekly calendar…</p>
            ) : calendarError ? (
              <p className="text-sm text-rose-300">{calendarError}</p>
            ) : calendarCoaches.length === 0 ? (
              <p className="text-sm text-slate-400">No coaches to show for this club/filter.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#071121] p-4">
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
        </section>
      </div>
    </main>
  );
}
