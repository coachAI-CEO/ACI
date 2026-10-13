"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Plus,
  Search,
  Trophy,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { adminFetch, API_BASE, getAdminHeaders } from "../_lib/api";

const AGE_GROUPS = ["U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18"];
const GAME_MODELS = [
  { value: "COACHAI", label: "Balanced (CoachAI)" },
  { value: "POSSESSION", label: "Possession" },
  { value: "PRESSING", label: "Pressing" },
  { value: "TRANSITION", label: "Transition" },
  { value: "ROCKLIN_FC", label: "Rocklin FC" },
];

type ClubOption = { id: string; name: string; gameModelId: string };
type CoachRef = { userId: string; name: string; role: string };
type TeamRow = {
  id: string;
  name: string;
  ageGroup: string;
  clubId: string | null;
  clubName: string | null;
  gameModelLabel: string;
  seasonLabel: string | null;
  coaches: CoachRef[];
};

type FoundUser = { id: string; email: string | null; name: string | null };

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [assignTeam, setAssignTeam] = useState<TeamRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamData, clubData] = await Promise.all([
        adminFetch<{ ok: boolean; teams: TeamRow[]; error?: string }>("/admin/teams"),
        adminFetch<{ ok: boolean; clubs: ClubOption[] }>("/admin/clubs").catch(() => ({ ok: true, clubs: [] })),
      ]);
      if (!teamData.ok) throw new Error(teamData.error || "Failed to load teams");
      setTeams(teamData.teams || []);
      setClubs(clubData.clubs || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function unassign(team: TeamRow, userId: string) {
    if (!confirm("Remove this coach from the team?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/teams/${team.id}/coaches/${userId}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Remove failed");
      await load();
    } catch (err: any) {
      alert(err?.message || "Failed to unassign coach");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Teams</h1>
          <p className="mt-1 text-sm text-slate-400">
            Assign a team to a coach. That team then appears in Coach Center.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          Assign team
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Loading teams…</p> : null}

      <div className="space-y-3">
        {teams.map((team) => (
          <div key={team.id} className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10">
                  <Trophy className="h-4 w-4 text-sky-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">{team.name}</p>
                  <p className="text-xs text-slate-400">
                    {team.ageGroup} · {team.gameModelLabel}
                    {team.clubName ? ` · ${team.clubName}` : " · Independent"}
                    {team.seasonLabel ? ` · ${team.seasonLabel}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignTeam(team)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add coach
              </button>
            </div>
            <ul className="mt-3 space-y-1.5">
              {team.coaches.map((coach) => (
                <li
                  key={coach.userId}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-300"
                >
                  <span>
                    {coach.name} · {coach.role === "HEAD" ? "Head coach" : "Assistant"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void unassign(team, coach.userId)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-300"
                    disabled={team.coaches.length <= 1}
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!loading && teams.length === 0 ? (
          <p className="text-sm text-slate-500">No teams yet. Assign one to a coach to start their Coach Center.</p>
        ) : null}
      </div>

      {showCreate ? (
        <AssignTeamModal
          clubs={clubs}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            void load();
          }}
        />
      ) : null}
      {assignTeam ? (
        <AddCoachModal
          team={assignTeam}
          onClose={() => setAssignTeam(null)}
          onSaved={() => {
            setAssignTeam(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function useUserSearch() {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<FoundUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!email.trim()) return;
    setSearching(true);
    setFound(null);
    setNotFound(false);
    setError(null);
    try {
      const data = await adminFetch<{ ok: boolean; users: FoundUser[] }>(
        `/admin/users?search=${encodeURIComponent(email)}&limit=5`
      );
      const match =
        data.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? data.users?.[0] ?? null;
      if (match) setFound(match);
      else setNotFound(true);
    } catch (err: any) {
      setError(err?.message || "Search failed");
    } finally {
      setSearching(false);
    }
  }

  return { email, setEmail, searching, found, notFound, error, setError, search };
}

function AssignTeamModal({
  clubs,
  onClose,
  onSaved,
}: {
  clubs: ClubOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const userSearch = useUserSearch();
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("U12");
  const [clubId, setClubId] = useState("");
  const [gameModelId, setGameModelId] = useState("COACHAI");
  const [seasonLabel, setSeasonLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!userSearch.found) return;
    setSaving(true);
    userSearch.setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({
          name,
          ageGroup,
          coachUserId: userSearch.found.id,
          clubId: clubId || null,
          gameModelId: clubId ? undefined : gameModelId,
          seasonLabel: seasonLabel || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Create failed");
      onSaved();
    } catch (err: any) {
      userSearch.setError(err?.message || "Failed to assign team");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Assign team to coach" onClose={onClose}>
      {userSearch.error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {userSearch.error}
        </div>
      ) : null}
      <UserEmailSearch {...userSearch} />
      <label className="block text-sm text-slate-400">
        Team name
        <input
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="U14 Girls Blue"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-400">
          Age group
          <select
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
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
        <label className="block text-sm text-slate-400">
          Club
          <select
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
          >
            <option value="">Independent</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!clubId ? (
        <label className="block text-sm text-slate-400">
          Game model
          <select
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={gameModelId}
            onChange={(e) => setGameModelId(e.target.value)}
          >
            {GAME_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-xs text-slate-500">Club teams inherit the locked game model from DOC Console.</p>
      )}
      <label className="block text-sm text-slate-400">
        Season label
        <input
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          value={seasonLabel}
          onChange={(e) => setSeasonLabel(e.target.value)}
          placeholder="2026 Fall"
        />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400">
          Cancel
        </button>
        <button
          type="button"
          disabled={!userSearch.found || !name.trim() || saving}
          onClick={() => void save()}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Assigning…" : "Assign team"}
        </button>
      </div>
    </Modal>
  );
}

function AddCoachModal({
  team,
  onClose,
  onSaved,
}: {
  team: TeamRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const userSearch = useUserSearch();
  const [role, setRole] = useState<"HEAD" | "ASSISTANT">("ASSISTANT");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!userSearch.found) return;
    setSaving(true);
    userSearch.setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/teams/${team.id}/coaches/${userSearch.found.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Assign failed");
      onSaved();
    } catch (err: any) {
      userSearch.setError(err?.message || "Failed to add coach");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Add coach to ${team.name}`} onClose={onClose}>
      {userSearch.error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {userSearch.error}
        </div>
      ) : null}
      <UserEmailSearch {...userSearch} />
      <label className="block text-sm text-slate-400">
        Role
        <select
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          value={role}
          onChange={(e) => setRole(e.target.value as "HEAD" | "ASSISTANT")}
        >
          <option value="HEAD">Head coach</option>
          <option value="ASSISTANT">Assistant</option>
        </select>
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400">
          Cancel
        </button>
        <button
          type="button"
          disabled={!userSearch.found || saving}
          onClick={() => void save()}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add coach"}
        </button>
      </div>
    </Modal>
  );
}

function UserEmailSearch({
  email,
  setEmail,
  searching,
  found,
  notFound,
  search,
}: ReturnType<typeof useUserSearch>) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
        Coach email
      </label>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="coach@club.com"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={searching}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200"
        >
          <Search className="h-3.5 w-3.5" />
          {searching ? "…" : "Find"}
        </button>
      </div>
      {found ? (
        <p className="mt-2 text-sm text-emerald-300">
          {found.name || "Coach"} · {found.email}
        </p>
      ) : null}
      {notFound ? <p className="mt-2 text-sm text-amber-300">No user found for that email.</p> : null}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <h2 className="font-semibold text-slate-200">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">{children}</div>
      </div>
    </div>
  );
}
