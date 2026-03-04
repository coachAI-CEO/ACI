"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  Copy,
  CheckCheck,
  Search,
  Users,
  Key,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  X,
  Save,
} from "lucide-react";
import { adminFetch, API_BASE, getAdminHeaders } from "../_lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

const GAME_MODELS = [
  { value: "COACHAI", label: "Balanced (CoachAI)" },
  { value: "POSSESSION", label: "Possession" },
  { value: "PRESSING", label: "Pressing" },
  { value: "TRANSITION", label: "Transition" },
  { value: "ROCKLIN_FC", label: "Rocklin FC" },
];

const EXCLUSIVE_MODELS = new Set(["ROCKLIN_FC"]); // models that require club enrollment

type Club = {
  id: string;
  name: string;
  code: string;
  gameModelId: string;
  description: string | null;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
  users?: ClubUser[];
};

type ClubUser = {
  id: string;
  email: string | null;
  name: string | null;
  subscriptionPlan: string;
  coachLevel: string | null;
};

type ClubForm = {
  name: string;
  code: string;
  gameModelId: string;
  description: string;
  active: boolean;
};

const emptyForm = (): ClubForm => ({
  name: "",
  code: "",
  gameModelId: "ROCKLIN_FC",
  description: "",
  active: true,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Badge({
  children,
  color = "slate",
}: {
  children: React.ReactNode;
  color?: "slate" | "emerald" | "red" | "amber" | "blue";
}) {
  const colors = {
    slate: "bg-slate-700/60 text-slate-300",
    emerald: "bg-emerald-500/20 text-emerald-300",
    red: "bg-red-500/20 text-red-300",
    amber: "bg-amber-500/20 text-amber-300",
    blue: "bg-blue-500/20 text-blue-300",
  };
  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
    >
      {copied ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied!" : text}
    </button>
  );
}

// ─── Club form modal ──────────────────────────────────────────────────────────

function ClubModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Club;
  onSave: (form: ClubForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ClubForm>(
    initial
      ? {
          name: initial.name,
          code: initial.code,
          gameModelId: initial.gameModelId,
          description: initial.description ?? "",
          active: initial.active,
        }
      : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      setError("Name and code are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save club");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-400" />
            <h2 className="font-semibold text-slate-200">
              {initial ? "Edit Club" : "Create Club"}
            </h2>
            <span className="rounded px-1.5 py-px text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              L5
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-500 hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2.5 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Club Name *
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Rocklin FC"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Join Code * <span className="normal-case text-[10px] text-slate-600">(stored lowercase)</span>
              </label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase() }))}
                placeholder="e.g. rocklin"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-emerald-300 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Exclusive Game Model *
            </label>
            <select
              value={form.gameModelId}
              onChange={(e) => setForm((f) => ({ ...f, gameModelId: e.target.value }))}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              {GAME_MODELS.map((gm) => (
                <option key={gm.value} value={gm.value} disabled={!EXCLUSIVE_MODELS.has(gm.value)}>
                  {gm.label}{!EXCLUSIVE_MODELS.has(gm.value) ? " (public — cannot be club-exclusive)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-600">
              Only users enrolled in this club will see content for this game model.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Optional description..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="club-active"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="rounded border-slate-600 bg-slate-800"
            />
            <label htmlFor="club-active" className="text-sm text-slate-300">
              Club is active (inactive clubs reject new enrollments)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : initial ? "Update Club" : "Create Club"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Assign user modal ────────────────────────────────────────────────────────

function AssignUserModal({
  clubId,
  clubName,
  onAssigned,
  onClose,
}: {
  clubId: string;
  clubName: string;
  onAssigned: () => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<{ id: string; email: string; name: string | null; subscriptionPlan: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchUser() {
    if (!email.trim()) return;
    setSearching(true);
    setFound(null);
    setNotFound(false);
    setError(null);
    try {
      const data = await adminFetch<{ ok: boolean; users: any[] }>(
        `/admin/users?search=${encodeURIComponent(email)}&limit=5`
      );
      const match = data.users?.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      ) ?? data.users?.[0];
      if (match) setFound(match);
      else setNotFound(true);
    } catch (err: any) {
      setError(err?.message ?? "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function assignUser() {
    if (!found) return;
    setAssigning(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/clubs/${clubId}/users/${found.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Assignment failed");
      onAssigned();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to assign user");
    } finally {
      setAssigning(false);
    }
  }

  const PLAN_ALLOWED = new Set(["COACH_BASIC", "COACH_PRO", "CLUB_STANDARD", "CLUB_PREMIUM"]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-blue-400" />
            <h2 className="font-semibold text-slate-200">Assign User to {clubName}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
              User Email
            </label>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFound(null); setNotFound(false); }}
                onKeyDown={(e) => e.key === "Enter" && searchUser()}
                placeholder="user@example.com"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={searchUser}
                disabled={searching || !email.trim()}
                className="rounded-xl bg-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-600 disabled:opacity-50 transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          {notFound && (
            <p className="text-sm text-amber-400">No user found with that email.</p>
          )}

          {found && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">{found.name ?? "—"}</p>
                  <p className="text-xs text-slate-500">{found.email}</p>
                </div>
                <Badge color={PLAN_ALLOWED.has(found.subscriptionPlan) ? "emerald" : "red"}>
                  {found.subscriptionPlan}
                </Badge>
              </div>
              {!PLAN_ALLOWED.has(found.subscriptionPlan) && (
                <p className="text-[11px] text-amber-400">
                  ⚠ This user is on {found.subscriptionPlan}. They will be assigned but cannot access club content until they upgrade to COACH_BASIC or higher.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1 border-t border-slate-800">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={assignUser}
              disabled={!found || assigning}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {assigning ? "Assigning…" : "Assign User"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Club row ─────────────────────────────────────────────────────────────────

function ClubRow({
  club,
  onEdit,
  onDelete,
  onRefresh,
}: {
  club: Club;
  onEdit: (c: Club) => void;
  onDelete: (c: Club) => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [users, setUsers] = useState<ClubUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [removingUser, setRemovingUser] = useState<string | null>(null);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const data = await adminFetch<{ ok: boolean; club: Club }>(
        `/admin/clubs/${club.id}`
      );
      setUsers(data.club.users ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function removeUser(userId: string) {
    setRemovingUser(userId);
    try {
      const res = await fetch(`${API_BASE}/admin/clubs/${club.id}/users/${userId}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Remove failed");
      setUsers((u) => u.filter((x) => x.id !== userId));
      onRefresh();
    } catch (err: any) {
      alert(err?.message ?? "Failed to remove user");
    } finally {
      setRemovingUser(null);
    }
  }

  function toggleExpanded() {
    if (!expanded) loadUsers();
    setExpanded((v) => !v);
  }

  const gm = GAME_MODELS.find((m) => m.value === club.gameModelId);

  return (
    <>
      {showAssign && (
        <AssignUserModal
          clubId={club.id}
          clubName={club.name}
          onAssigned={() => { loadUsers(); onRefresh(); }}
          onClose={() => setShowAssign(false)}
        />
      )}

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 overflow-hidden">
        {/* Club header row */}
        <div className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Building2 className="h-4 w-4 text-emerald-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-200">{club.name}</p>
              <Badge color={club.active ? "emerald" : "red"}>
                {club.active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {club.description ?? "No description"}
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400">
            <div className="text-center">
              <p className="font-semibold text-slate-200">{club._count?.users ?? "—"}</p>
              <p className="text-[10px]">members</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-emerald-300 font-semibold">{club.code}</p>
              <p className="text-[10px]">join code</p>
            </div>
            <div className="text-center">
              <p className="text-slate-300 font-medium">{gm?.label ?? club.gameModelId}</p>
              <p className="text-[10px]">game model</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <CopyButton text={club.code} />
            <button
              onClick={() => onEdit(club)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
              title="Edit club"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(club)}
              className="rounded-lg p-2 text-slate-500 hover:bg-red-900/20 hover:text-red-400 transition-colors"
              title="Delete club"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={toggleExpanded}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
              title="View members"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded members section */}
        {expanded && (
          <div className="border-t border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Members ({users.length})
              </h3>
              <button
                onClick={() => setShowAssign(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 px-2.5 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-600/30 transition-colors"
              >
                <UserPlus className="h-3 w-3" />
                Assign User
              </button>
            </div>

            {loadingUsers ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-800/50" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-700/50 py-6 text-xs text-slate-600">
                No members yet — assign users or share the join code
              </div>
            ) : (
              <div className="space-y-1.5">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-700/30 bg-slate-800/30 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium text-slate-300">
                        {user.name ?? user.email ?? user.id}
                      </p>
                      {user.name && (
                        <p className="truncate text-[10px] text-slate-600">{user.email}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        color={
                          ["COACH_BASIC", "COACH_PRO", "CLUB_STANDARD", "CLUB_PREMIUM"].includes(
                            user.subscriptionPlan
                          )
                            ? "emerald"
                            : "amber"
                        }
                      >
                        {user.subscriptionPlan}
                      </Badge>
                      {user.coachLevel && (
                        <Badge color="blue">{user.coachLevel.replace("USSF_", "")}</Badge>
                      )}
                      <button
                        onClick={() => removeUser(user.id)}
                        disabled={removingUser === user.id}
                        className="rounded-lg p-1.5 text-slate-600 hover:bg-red-900/20 hover:text-red-400 transition-colors disabled:opacity-40"
                        title="Remove from club"
                      >
                        <UserMinus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<{ club?: Club } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");

  const loadClubs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch<{ ok: boolean; clubs: Club[] }>("/admin/clubs");
      setClubs(data.clubs ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load clubs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  async function saveClub(form: ClubForm) {
    const editing = showModal?.club;
    const url = editing
      ? `${API_BASE}/admin/clubs/${editing.id}`
      : `${API_BASE}/admin/clubs`;
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...getAdminHeaders() },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
    setShowModal(null);
    loadClubs();
  }

  async function deleteClub(club: Club) {
    if (!confirm(`Delete club "${club.name}"? This cannot be undone.`)) return;
    setDeleting(club.id);
    try {
      const res = await fetch(`${API_BASE}/admin/clubs/${club.id}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Delete failed");
      loadClubs();
    } catch (err: any) {
      alert(err?.message ?? "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  const filtered = clubs.filter(
    (c) =>
      !searchQ ||
      c.name.toLowerCase().includes(searchQ.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <div className="max-w-4xl space-y-6">
      {showModal && (
        <ClubModal
          initial={showModal.club}
          onSave={saveClub}
          onClose={() => setShowModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100">Club Management</h1>
            <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Layer 5
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            Clubs link a join code to an exclusive game model. Enrolled users on COACH_BASIC+ unlock that model.
          </p>
        </div>
        <button
          onClick={() => setShowModal({})}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Club
        </button>
      </div>

      {/* Access rules callout */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4 text-xs text-slate-400 space-y-1.5">
        <div className="flex items-center gap-2 font-semibold text-slate-300">
          <Key className="h-3.5 w-3.5 text-emerald-400" />
          How Club Access Works
        </div>
        <ul className="space-y-1 list-disc list-inside text-slate-500">
          <li><span className="text-slate-300">SUPER_ADMIN</span> — always sees all game models regardless of club</li>
          <li><span className="text-slate-300">COACH_BASIC+</span> enrolled in club → unlocks that club&apos;s game model</li>
          <li><span className="text-slate-300">FREE or TRIAL</span> → public game models only (COACHAI, POSSESSION, PRESSING, TRANSITION)</li>
          <li>Admin-assigning a FREE/TRIAL user stores clubId but has no access effect until they upgrade</li>
          <li>Self-enroll endpoint <code className="text-emerald-300">POST /api/user/join-club</code> blocks FREE/TRIAL at the door</li>
        </ul>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search clubs by name or code…"
          className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-2.5 pl-9 pr-4 text-sm text-slate-300 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* Club list */}
      {error && (
        <div className="rounded-xl border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-800/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/50 py-16 text-center">
          <Building2 className="mb-3 h-8 w-8 text-slate-700" />
          <p className="text-sm font-medium text-slate-500">
            {searchQ ? "No clubs match your search" : "No clubs yet"}
          </p>
          {!searchQ && (
            <button
              onClick={() => setShowModal({})}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" />
              Create First Club
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((club) => (
            <ClubRow
              key={club.id}
              club={club}
              onEdit={(c) => setShowModal({ club: c })}
              onDelete={deleteClub}
              onRefresh={loadClubs}
            />
          ))}
        </div>
      )}
    </div>
  );
}
