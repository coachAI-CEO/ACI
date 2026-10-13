"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { Plus, Search, Trophy, Users, X } from "lucide-react";
import { useDocHub } from "../_lib/DocHubContext";
import type { CoachUsageRow } from "../_lib/types";
import { authHeaders, btnPrimary, btnPrimarySm, btnSecondary, btnSecondarySm, statusPill } from "../_lib/utils";

type TeamOption = {
  id: string;
  name: string;
  ageGroup: string;
  notes: string | null;
  coaches: Array<{ userId: string; name: string; role: string }>;
};

type AssignedTeam = TeamOption & { assignmentRole: string };

const GROUP_ORDER = [
  "Girls 11v11",
  "Girls 9v9",
  "Girls 7v7",
  "Boys 11v11",
  "Boys 9v9",
  "Boys 7v7",
];

const AVATAR_TONES = [
  "border-emerald-500/25 bg-emerald-500/15 text-emerald-200",
  "border-sky-500/25 bg-sky-500/15 text-sky-200",
  "border-violet-500/25 bg-violet-500/15 text-violet-200",
  "border-amber-500/25 bg-amber-500/15 text-amber-200",
  "border-cyan-500/25 bg-cyan-500/15 text-cyan-200",
  "border-rose-500/25 bg-rose-500/15 text-rose-200",
];

function teamGroup(team: TeamOption) {
  const notes = (team.notes || "").trim();
  if (/girls|boys/i.test(notes) && /7v7|9v9|11v11/i.test(notes)) return notes;
  const gender = /girls/i.test(team.name) ? "Girls" : /boys/i.test(team.name) ? "Boys" : "";
  const format = notes.match(/7v7|9v9|11v11/i)?.[0] || "";
  return [gender, format].filter(Boolean).join(" ") || team.ageGroup || "Teams";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function avatarTone(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  return AVATAR_TONES[hash];
}

export default function DocHubCoachesPage() {
  const { access, selectedClubId } = useDocHub();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CoachUsageRow[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [assignCoach, setAssignCoach] = useState<CoachUsageRow | null>(null);

  const load = useCallback(async (clubId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [usageRes, teamsRes] = await Promise.all([
        fetch(`/api/doc-hub/clubs/${clubId}/coaches/usage?days=7`, { headers: authHeaders() }),
        fetch(`/api/doc-hub/clubs/${clubId}/teams`, { headers: authHeaders() }),
      ]);
      const usageData = await usageRes.json();
      const teamsData = await teamsRes.json().catch(() => ({}));
      if (!usageRes.ok || !usageData?.ok) throw new Error(usageData?.error || "Failed to load coaches");
      setRows(
        (usageData.coaches || []).map(
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
      setTeams(teamsData.teams || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load coaches");
      setRows([]);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) void load(selectedClubId);
  }, [access, selectedClubId, load]);

  const teamsByCoach = useMemo(() => {
    const map = new Map<string, AssignedTeam[]>();
    for (const team of teams) {
      for (const coach of team.coaches) {
        const list = map.get(coach.userId) || [];
        list.push({ ...team, assignmentRole: coach.role });
        map.set(coach.userId, list);
      }
    }
    return map;
  }, [teams]);

  const stats = useMemo(() => {
    const assignedCount = rows.filter((row) => (teamsByCoach.get(row.userId) || []).length > 0).length;
    const weeklyRuns = rows.reduce((sum, row) => sum + (row.runs || 0), 0);
    const active = rows.filter((row) => row.status === "active" || row.status === "heavy").length;
    return {
      coaches: rows.length,
      assignedCount,
      unassignedCount: Math.max(0, rows.length - assignedCount),
      weeklyRuns,
      active,
    };
  }, [rows, teamsByCoach]);

  async function unassign(teamId: string, userId: string) {
    if (!selectedClubId) return;
    if (!confirm("Remove this coach from the team?")) return;
    const res = await fetch(
      `/api/doc-hub/clubs/${selectedClubId}/teams/${teamId}/coaches/${userId}`,
      { method: "DELETE", headers: authHeaders() }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      alert(data?.message || data?.error || "Could not remove team");
      return;
    }
    await load(selectedClubId);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Coaches</h1>
        <p className="mt-1 text-sm text-slate-400">
          Assign one or more teams to each club coach or DOC. Those sides then appear in their Coach Center.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Club coaches",
            value: loading ? "—" : String(stats.coaches),
            detail: loading ? "Loading…" : `${stats.active} active this week`,
          },
          {
            label: "Assigned",
            value: loading ? "—" : String(stats.assignedCount),
            detail: "Have at least one team",
          },
          {
            label: "Needs a team",
            value: loading ? "—" : String(stats.unassignedCount),
            detail: stats.unassignedCount ? "Assign from the list below" : "Every coach has a side",
          },
          {
            label: "AI sessions",
            value: loading ? "—" : String(stats.weeklyRuns),
            detail: "Generated in last 7 days",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-800/70 to-slate-900/40 p-4 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.8)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.detail}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-900/90 to-slate-950/80 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
              <Users className="h-4 w-4 text-emerald-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Club roster</p>
              <p className="text-xs text-slate-500">
                {loading ? "Loading coaches…" : `${stats.coaches} coaches · ${teams.length} sides in catalog`}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-slate-400">Loading coaches…</p>
        ) : error ? (
          <p className="p-6 text-sm text-rose-300">{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">
            No coaches in this club yet. Assign club memberships in Admin first.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-500">
                <tr className="border-b border-slate-800">
                  <th className="px-5 py-3 font-semibold">Coach</th>
                  <th className="px-3 py-3 font-semibold">Team</th>
                  <th className="px-3 py-3 font-semibold">Activity</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const assigned = teamsByCoach.get(row.userId) || [];
                  return (
                    <tr
                      key={row.userId}
                      className="border-b border-slate-800/70 bg-transparent transition-colors last:border-b-0 hover:bg-slate-800/35"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${avatarTone(row.name)}`}
                          >
                            {initials(row.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-100">{row.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{row.roleLabel}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        {assigned.length === 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-700 px-2.5 py-1 text-xs text-slate-500">
                            <Trophy className="h-3 w-3" />
                            No team yet
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {assigned.map((team) => (
                              <span
                                key={team.id}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 py-1 pl-2.5 pr-1 text-xs text-sky-100"
                              >
                                <span className="truncate">
                                  {team.name}
                                  <span className="ml-1 text-sky-300/70">{team.ageGroup}</span>
                                </span>
                                <span className="rounded-full bg-slate-950/40 px-1.5 py-px text-[10px] uppercase tracking-wide text-slate-400">
                                  {team.assignmentRole === "ASSISTANT" ? "Asst" : "Head"}
                                </span>
                                <button
                                  type="button"
                                  className="flex h-5 w-5 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-rose-500/20 hover:text-rose-200"
                                  aria-label={`Remove ${team.name}`}
                                  onClick={() => void unassign(team.id, row.userId)}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-medium text-slate-200">
                          {row.runs} <span className="font-normal text-slate-500">runs</span>
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{row.lastActiveLabel}</p>
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusPill(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          className={assigned.length ? btnSecondarySm : btnPrimarySm}
                          onClick={() => setAssignCoach(row)}
                          disabled={teams.length === 0}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          {assigned.length ? "Edit teams" : "Assign teams"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {assignCoach && selectedClubId ? (
        <AssignTeamModal
          coach={assignCoach}
          teams={teams}
          assignedTeamIds={(teamsByCoach.get(assignCoach.userId) || []).map((team) => team.id)}
          onClose={() => setAssignCoach(null)}
          onAssigned={async () => {
            setAssignCoach(null);
            await load(selectedClubId);
          }}
          clubId={selectedClubId}
        />
      ) : null}
    </div>
  );
}

function AssignTeamModal({
  coach,
  teams,
  assignedTeamIds,
  clubId,
  onClose,
  onAssigned,
}: {
  coach: CoachUsageRow;
  teams: TeamOption[];
  assignedTeamIds: string[];
  clubId: string;
  onClose: () => void;
  onAssigned: () => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(assignedTeamIds);
  const [role, setRole] = useState<"HEAD" | "ASSISTANT">("HEAD");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? teams.filter((t) => `${t.name} ${t.ageGroup} ${t.notes || ""}`.toLowerCase().includes(q))
      : teams;
    const byGroup = new Map<string, TeamOption[]>();
    for (const team of filtered) {
      const key = teamGroup(team);
      const list = byGroup.get(key) || [];
      list.push(team);
      byGroup.set(key, list);
    }
    return [...byGroup.entries()].sort(([a], [b]) => {
      const ai = GROUP_ORDER.indexOf(a);
      const bi = GROUP_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [teams, query]);

  function toggleTeam(teamId: string) {
    setSelectedIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/coaches/${coach.userId}/teams`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ teamIds: selectedIds, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.message || data?.error || "Could not save teams");
      await onAssigned();
    } catch (err: any) {
      setError(err?.message || "Could not save teams");
    } finally {
      setSaving(false);
    }
  }

  const addedCount = selectedIds.filter((id) => !assignedTeamIds.includes(id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <form
        onSubmit={save}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Assign teams</h2>
          <p className="mt-1 text-sm text-slate-400">
            {coach.name} can hold more than one side. Check every team they should see in Coach Center.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {teams.length === 0 ? (
            <p className="text-sm text-slate-400">No club teams to assign yet.</p>
          ) : (
            <>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
                Search
                <span className="relative mt-1.5 block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-500/60"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="2014 Girls, Navy, U13…"
                  />
                </span>
              </label>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Teams</p>
                  <p className="text-xs text-slate-500">
                    {selectedIds.length} selected
                  </p>
                </div>
                <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                  {grouped.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-slate-500">No teams match that search.</p>
                  ) : (
                    grouped.map(([group, items]) => (
                      <div key={group}>
                        <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                          {group}
                        </p>
                        <div className="space-y-1">
                          {items.map((team) => {
                            const selected = selectedIds.includes(team.id);
                            const alreadyOn = assignedTeamIds.includes(team.id);
                            return (
                              <label
                                key={team.id}
                                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                                  selected
                                    ? "border border-emerald-500/30 bg-emerald-500/10"
                                    : "border border-transparent hover:bg-slate-800/80"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleTeam(team.id)}
                                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-medium text-slate-100">{team.name}</span>
                                  <span className="block text-xs text-slate-500">
                                    {team.ageGroup}
                                    {alreadyOn
                                      ? " · Already assigned"
                                      : team.coaches.length
                                        ? ` · ${team.coaches.length} coach${team.coaches.length === 1 ? "" : "es"} already`
                                        : " · Open"}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
                Role for newly added teams
                <select
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "HEAD" | "ASSISTANT")}
                >
                  <option value="HEAD">Head coach</option>
                  <option value="ASSISTANT">Assistant</option>
                </select>
              </label>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={saving || teams.length === 0}>
            {saving ? "Saving…" : addedCount ? `Save ${selectedIds.length} teams` : "Save teams"}
          </button>
        </div>
      </form>
    </div>
  );
}
