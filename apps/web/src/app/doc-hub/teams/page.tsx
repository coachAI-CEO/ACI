"use client";

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { Plus, Search, Trophy, Users, X } from "lucide-react";
import { useDocHub } from "../_lib/DocHubContext";
import { authHeaders, btnPrimary, btnPrimarySm, btnSecondary, btnSecondarySm } from "../_lib/utils";

const AGE_GROUPS = ["U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18"];

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

type CoachOption = { userId: string; name: string; roleLabel: string };
type TeamRow = {
  id: string;
  name: string;
  ageGroup: string;
  notes: string | null;
  gameModelLabel: string;
  seasonLabel: string | null;
  sectionName: string | null;
  playerLevel?: string;
  coachLevel?: string;
  coaches: Array<{ userId: string; name: string; role: string }>;
};

function teamGroup(team: Pick<TeamRow, "name" | "ageGroup" | "notes">) {
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

export default function DocHubTeamsPage() {
  const { access, selectedClubId, selectedClub } = useDocHub();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [assignTeam, setAssignTeam] = useState<TeamRow | null>(null);

  const load = useCallback(async (clubId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [teamsRes, coachesRes] = await Promise.all([
        fetch(`/api/doc-hub/clubs/${clubId}/teams`, { headers: authHeaders() }),
        fetch(`/api/doc-hub/clubs/${clubId}/coaches/usage?days=7`, { headers: authHeaders() }),
      ]);
      const teamsData = await teamsRes.json().catch(() => ({}));
      const coachesData = await coachesRes.json().catch(() => ({}));
      if (!teamsRes.ok || !teamsData?.ok) {
        throw new Error(teamsData?.message || teamsData?.error || "Failed to load teams");
      }
      setTeams(teamsData.teams || []);
      setCoaches(
        (coachesData.coaches || []).map((c: { userId: string; name: string; roleLabel: string }) => ({
          userId: c.userId,
          name: c.name,
          roleLabel: c.roleLabel,
        }))
      );
    } catch (e: any) {
      setError(e?.message || "Failed to load teams");
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) void load(selectedClubId);
  }, [access, selectedClubId, load]);

  const stats = useMemo(() => {
    const staffed = teams.filter((team) => team.coaches.length > 0).length;
    const coachIds = new Set(teams.flatMap((team) => team.coaches.map((coach) => coach.userId)));
    const formats = new Set(teams.map((team) => teamGroup(team)));
    return {
      teams: teams.length,
      staffed,
      open: Math.max(0, teams.length - staffed),
      coachesAssigned: coachIds.size,
      formats: formats.size,
    };
  }, [teams]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? teams.filter((team) =>
          `${team.name} ${team.ageGroup} ${team.notes || ""} ${team.coaches.map((c) => c.name).join(" ")}`
            .toLowerCase()
            .includes(q)
        )
      : teams;
    const byGroup = new Map<string, TeamRow[]>();
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

  async function unassign(teamId: string, userId: string) {
    if (!selectedClubId) return;
    if (!confirm("Remove this coach from the team?")) return;
    const res = await fetch(
      `/api/doc-hub/clubs/${selectedClubId}/teams/${teamId}/coaches/${userId}`,
      { method: "DELETE", headers: authHeaders() }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      alert(data?.message || data?.error || "Could not remove coach");
      return;
    }
    await load(selectedClubId);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Teams</h1>
        <p className="mt-1 text-sm text-slate-400">
          Club roster by format. Assign one or more coaches to each side for Coach Center.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Club teams",
            value: loading ? "—" : String(stats.teams),
            detail: loading ? "Loading…" : `${stats.formats} format groups`,
          },
          {
            label: "Staffed",
            value: loading ? "—" : String(stats.staffed),
            detail: "Have at least one coach",
          },
          {
            label: "Needs a coach",
            value: loading ? "—" : String(stats.open),
            detail: stats.open ? "Assign from the list below" : "Every side has a coach",
          },
          {
            label: "Coaches assigned",
            value: loading ? "—" : String(stats.coachesAssigned),
            detail: `${coaches.length} club coaches total`,
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
              <Trophy className="h-4 w-4 text-emerald-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Club catalog</p>
              <p className="text-xs text-slate-500">
                {loading
                  ? "Loading teams…"
                  : `${stats.teams} sides in ${selectedClub?.clubName || "this club"}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="w-56 rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500/60"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teams or coaches…"
              />
            </span>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setShowCreate(true)}
              disabled={!coaches.length}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New team
            </button>
          </div>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-slate-400">Loading teams…</p>
        ) : error ? (
          <p className="p-6 text-sm text-rose-300">{error}</p>
        ) : teams.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">
            No teams in {selectedClub?.clubName || "this club"} yet.
            {coaches.length === 0 ? " Add coaches in Admin first, then create a side." : " Create a team to get started."}
          </p>
        ) : grouped.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No teams match that search.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-500">
                <tr className="border-b border-slate-800">
                  <th className="px-5 py-3 font-semibold">Team</th>
                  <th className="px-3 py-3 font-semibold">Coaches</th>
                  <th className="px-3 py-3 font-semibold">Details</th>
                  <th className="px-5 py-3 font-semibold text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(([group, items]) => (
                  <Fragment key={group}>
                    <tr className="bg-slate-950/50">
                      <td colSpan={4} className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        {group}
                        <span className="ml-2 font-medium normal-case tracking-normal text-slate-600">
                          {items.length} {items.length === 1 ? "side" : "sides"}
                        </span>
                      </td>
                    </tr>
                    {items.map((team) => (
                      <tr
                        key={team.id}
                        className="border-b border-slate-800/70 bg-transparent transition-colors last:border-b-0 hover:bg-slate-800/35"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${avatarTone(team.name)}`}
                            >
                              {team.ageGroup}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-100">{team.name}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{team.ageGroup}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          {team.coaches.length === 0 ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-700 px-2.5 py-1 text-xs text-slate-500">
                              <Users className="h-3 w-3" />
                              No coach yet
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {team.coaches.map((coach) => (
                                <span
                                  key={coach.userId}
                                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 py-1 pl-2.5 pr-1 text-xs text-sky-100"
                                >
                                  <span className="truncate">{coach.name}</span>
                                  <span className="rounded-full bg-slate-950/40 px-1.5 py-px text-[10px] uppercase tracking-wide text-slate-400">
                                    {coach.role === "ASSISTANT" ? "Asst" : "Head"}
                                  </span>
                                  <button
                                    type="button"
                                    className="flex h-5 w-5 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-rose-500/20 hover:text-rose-200"
                                    aria-label={`Remove ${coach.name}`}
                                    onClick={() => void unassign(team.id, coach.userId)}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-medium text-slate-200">{team.gameModelLabel}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {[
                              team.playerLevel === "ADVANCED"
                                ? "Advanced"
                                : team.playerLevel === "BEGINNER"
                                  ? "Beginner · D"
                                  : team.playerLevel === "INTERMEDIATE"
                                    ? "Intermediate"
                                    : null,
                              team.sectionName,
                              team.seasonLabel,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Club catalog"}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            className={team.coaches.length ? btnSecondarySm : btnPrimarySm}
                            onClick={() => setAssignTeam(team)}
                            disabled={coaches.length === 0}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            {team.coaches.length ? "Edit coaches" : "Assign coaches"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showCreate && selectedClubId ? (
        <CreateTeamModal
          coaches={coaches}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await load(selectedClubId);
          }}
          clubId={selectedClubId}
        />
      ) : null}

      {assignTeam && selectedClubId ? (
        <AssignCoachesModal
          team={assignTeam}
          coaches={coaches}
          onClose={() => setAssignTeam(null)}
          onAssigned={async () => {
            setAssignTeam(null);
            await load(selectedClubId);
          }}
          clubId={selectedClubId}
        />
      ) : null}
    </div>
  );
}

function AssignCoachesModal({
  team,
  coaches,
  clubId,
  onClose,
  onAssigned,
}: {
  team: TeamRow;
  coaches: CoachOption[];
  clubId: string;
  onClose: () => void;
  onAssigned: () => Promise<void>;
}) {
  const assignedIds = team.coaches.map((coach) => coach.userId);
  const [selectedIds, setSelectedIds] = useState<string[]>(assignedIds);
  const [role, setRole] = useState<"HEAD" | "ASSISTANT">(team.coaches.length ? "ASSISTANT" : "HEAD");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return coaches;
    return coaches.filter((coach) => `${coach.name} ${coach.roleLabel}`.toLowerCase().includes(q));
  }, [coaches, query]);

  function toggleCoach(userId: string) {
    setSelectedIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/teams/${team.id}/coaches`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ coachUserIds: selectedIds, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.message || data?.error || "Could not save coaches");
      await onAssigned();
    } catch (err: any) {
      setError(err?.message || "Could not save coaches");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <form
        onSubmit={save}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Assign coaches</h2>
          <p className="mt-1 text-sm text-slate-400">
            {team.name} · {team.ageGroup}. A team can have a head coach and assistants.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {coaches.length === 0 ? (
            <p className="text-sm text-slate-400">No club coaches to assign yet.</p>
          ) : (
            <>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
                Search
                <span className="relative mt-1.5 block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500/60"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Coach name…"
                  />
                </span>
              </label>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Coaches</p>
                  <p className="text-xs text-slate-500">{selectedIds.length} selected</p>
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                  {filtered.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-slate-500">No coaches match that search.</p>
                  ) : (
                    filtered.map((coach) => {
                      const selected = selectedIds.includes(coach.userId);
                      const alreadyOn = assignedIds.includes(coach.userId);
                      return (
                        <label
                          key={coach.userId}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                            selected
                              ? "border border-emerald-500/30 bg-emerald-500/10"
                              : "border border-transparent hover:bg-slate-800/80"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleCoach(coach.userId)}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500"
                          />
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${avatarTone(coach.name)}`}
                          >
                            {initials(coach.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-slate-100">{coach.name}</span>
                            <span className="block text-xs text-slate-500">
                              {coach.roleLabel}
                              {alreadyOn ? " · Already assigned" : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
                Role for newly added coaches
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
          <button type="submit" className={btnPrimary} disabled={saving || coaches.length === 0}>
            {saving ? "Saving…" : `Save ${selectedIds.length} coaches`}
          </button>
        </div>
      </form>
    </div>
  );
}

function CreateTeamModal({
  coaches,
  clubId,
  onClose,
  onCreated,
}: {
  coaches: CoachOption[];
  clubId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("U12");
  const [seasonLabel, setSeasonLabel] = useState("");
  const [coachUserId, setCoachUserId] = useState(coaches[0]?.userId || "");
  const [role, setRole] = useState<"HEAD" | "ASSISTANT">("HEAD");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!coachUserId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/teams`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ageGroup,
          seasonLabel: seasonLabel || undefined,
          coachUserId,
          role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.message || data?.error || "Could not create team");
      await onCreated();
    } catch (err: any) {
      setError(err?.message || "Could not create team");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <form
        onSubmit={save}
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="text-base font-semibold text-white">New team</h2>
          <p className="mt-1 text-sm text-slate-400">Add a side that isn’t already in the club catalog.</p>
        </div>
        <div className="space-y-4 p-5">
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
            Team name
            <input
              required
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="U14 Girls Blue"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
              Age group
              <select
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
              >
                {AGE_GROUPS.map((age) => (
                  <option key={age} value={age}>
                    {age}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
              Season
              <input
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                value={seasonLabel}
                onChange={(e) => setSeasonLabel(e.target.value)}
                placeholder="2026 Fall"
              />
            </label>
          </div>
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
            First coach
            <select
              required
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              value={coachUserId}
              onChange={(e) => setCoachUserId(e.target.value)}
            >
              {coaches.map((coach) => (
                <option key={coach.userId} value={coach.userId}>
                  {coach.name}
                  {coach.roleLabel ? ` · ${coach.roleLabel}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
            Role
            <select
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              value={role}
              onChange={(e) => setRole(e.target.value as "HEAD" | "ASSISTANT")}
            >
              <option value="HEAD">Head coach</option>
              <option value="ASSISTANT">Assistant</option>
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={saving || !coachUserId}>
            {saving ? "Saving…" : "Create team"}
          </button>
        </div>
      </form>
    </div>
  );
}
