"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  Ban,
  Trash2,
  KeyRound,
  MailCheck,
  Mail,
  Pencil,
  Check,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  Building2,
  RefreshCw,
} from "lucide-react";
import { adminFetch, API_BASE, getAdminHeaders } from "../_lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClubMembership = {
  id: string;
  clubId: string;
  clubName: string;
  sectionId: string | null;
  role: "DOC" | "SECTION_DIRECTOR" | "COACH";
};

type User = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  adminRole: string | null;
  subscriptionPlan: string;
  subscriptionStatus: string;
  createdAt: string;
  lastLoginAt: string | null;
  blocked: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  coachLevel: string | null;
  teamAgeGroups: string[];
  organizationName?: string | null;
  clubId?: string | null;
  club?: { id: string; name: string; code: string } | null;
  clubMemberships?: ClubMembership[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = ["FREE", "COACH", "CLUB", "ADMIN", "TRIAL"] as const;
const ADMIN_ROLES = ["", "SUPER_ADMIN", "ADMIN", "MODERATOR", "SUPPORT"] as const;
const COACH_LEVELS = ["", "USSF_D", "USSF_C", "USSF_B_PLUS"] as const;
const CLUB_MEMBERSHIP_ROLES = [
  { value: "COACH", label: "Coach" },
  { value: "SECTION_DIRECTOR", label: "Section Director" },
  { value: "DOC", label: "DOC" },
] as const;
const PLANS = [
  "FREE", "TRIAL", "COACH_BASIC", "COACH_PRO", "CLUB_STANDARD", "CLUB_PREMIUM"
] as const;
const AGE_GROUPS = [
  "U8","U9","U10","U11","U12","U13","U14","U15","U16","U17","U18",
];

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-slate-600/40 text-slate-300",
  TRIAL: "bg-yellow-500/20 text-yellow-300",
  COACH_BASIC: "bg-blue-500/20 text-blue-300",
  COACH_PRO: "bg-violet-500/20 text-violet-300",
  CLUB_STANDARD: "bg-emerald-500/20 text-emerald-300",
  CLUB_PREMIUM: "bg-emerald-400/20 text-emerald-200",
};

const ROLE_COLORS: Record<string, string> = {
  FREE: "bg-slate-700/60 text-slate-400",
  COACH: "bg-blue-900/40 text-blue-300",
  CLUB: "bg-violet-900/40 text-violet-300",
  ADMIN: "bg-red-900/40 text-red-300",
  TRIAL: "bg-yellow-900/40 text-yellow-300",
};

const CLUB_ROLE_COLORS: Record<string, string> = {
  DOC: "bg-violet-500/20 text-violet-200",
  SECTION_DIRECTOR: "bg-sky-500/20 text-sky-200",
  COACH: "bg-slate-700/60 text-slate-300",
};

function clubRoleLabel(role: string) {
  if (role === "SECTION_DIRECTOR") return "Section Dir";
  return role;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Badge({
  children,
  className = "bg-slate-700/60 text-slate-300",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`}
    />
  );
}

function ActionIcon({
  label,
  onClick,
  disabled,
  className = "text-slate-600 hover:bg-slate-700 hover:text-emerald-300",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`group relative rounded p-1.5 transition-colors disabled:opacity-40 ${className}`}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-[10px] font-medium text-slate-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {label}
      </span>
    </button>
  );
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({
  onCreated,
  onClose,
}: {
  onCreated: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "FREE" as string,
    adminRole: "" as string,
    password: "",
    autoVerifyEmail: true,
    coachLevel: "" as string,
    teamAgeGroups: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ email: string; password?: string } | null>(null);
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Email and password are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({
          ...form,
          adminRole: form.adminRole || null,
          coachLevel: form.coachLevel || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Create failed");
      setSuccess({ email: form.email, password: data.password ?? form.password });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center space-y-4">
          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <Check className="h-6 w-6 text-emerald-400" />
          </div>
          <h3 className="font-semibold text-slate-200">User Created</h3>
          <p className="text-sm text-slate-400">{success.email}</p>
          {success.password && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-mono text-emerald-300">
              {success.password}
            </div>
          )}
          <button
            onClick={() => { onCreated(); onClose(); }}
            className="w-full rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 p-5 shrink-0">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-400" />
            <h2 className="font-semibold text-slate-200">Create User</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Password *</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 pr-10 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Role <span className="text-blue-400">(L1)</span>
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Admin Role <span className="text-red-400">(L4)</span>
              </label>
              <select
                value={form.adminRole}
                onChange={(e) => setForm(f => ({ ...f, adminRole: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                {ADMIN_ROLES.map(r => <option key={r} value={r}>{r || "None"}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Coach Level <span className="text-amber-400">(L3)</span>
              </label>
              <select
                value={form.coachLevel}
                onChange={(e) => setForm(f => ({ ...f, coachLevel: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                {COACH_LEVELS.map(l => <option key={l} value={l}>{l || "None"}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Auto Verify Email</label>
              <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoVerifyEmail}
                  onChange={(e) => setForm(f => ({ ...f, autoVerifyEmail: e.target.checked }))}
                  className="rounded border-slate-600 bg-slate-800"
                />
                <span className="text-sm text-slate-300">Verify on create</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
              {saving ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: { id: string; email: string };
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleReset() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({ password: password || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Reset failed");
      setResult(data.password ?? password ?? "Password reset successfully");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-400" />
            <h2 className="font-semibold text-slate-200">Reset Password</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">{user.email}</p>

        {result ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-4 py-3">
              <p className="text-xs text-slate-400 mb-1">New password:</p>
              <p className="font-mono text-sm text-emerald-300">{result}</p>
            </div>
            <button onClick={onClose} className="w-full rounded-xl bg-slate-700 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600">Close</button>
          </div>
        ) : (
          <>
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to auto-generate"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 pr-10 text-sm text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-xl border border-slate-700 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
              <button onClick={handleReset} disabled={saving} className="flex-1 rounded-xl bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50">
                {saving ? "Resetting…" : "Reset"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Block Modal ──────────────────────────────────────────────────────────────

function BlockModal({
  user,
  onDone,
  onClose,
}: {
  user: { id: string; email: string; blocked: boolean };
  onDone: () => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${user.id}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({
          blocked: !user.blocked,
          reason: user.blocked ? undefined : reason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Action failed");
      onDone();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban className={`h-4 w-4 ${user.blocked ? "text-emerald-400" : "text-red-400"}`} />
            <h2 className="font-semibold text-slate-200">
              {user.blocked ? "Unblock User" : "Block User"}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">{user.email}</p>
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {!user.blocked && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for blocking (optional)"
            rows={3}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:border-red-500 focus:outline-none resize-none"
          />
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-700 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50 ${user.blocked ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}
          >
            {saving ? "…" : user.blocked ? "Unblock" : "Block"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Coach Level Modal ────────────────────────────────────────────────────────

function CoachLevelModal({
  user,
  onDone,
  onClose,
}: {
  user: { id: string; email: string; role: string; coachLevel: string | null; teamAgeGroups: string[] };
  onDone: () => void;
  onClose: () => void;
}) {
  const [coachLevel, setCoachLevel] = useState(user.coachLevel ?? "");
  const [ageGroups, setAgeGroups] = useState<string[]>(user.teamAgeGroups ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAgeGroup(ag: string) {
    setAgeGroups(prev =>
      prev.includes(ag) ? prev.filter(x => x !== ag) : [...prev, ag]
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${user.id}/coach-level`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({
          coachLevel: coachLevel || null,
          teamAgeGroups: ageGroups,
          promoteToCoach: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed");
      onDone();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-amber-400" />
            <h2 className="font-semibold text-slate-200">Coach Level</h2>
            <span className="rounded px-1.5 py-px text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">L3</span>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">{user.email}</p>
        {user.role !== "COACH" && (
          <div className="rounded-xl border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-300">
            Saving will also set this user&apos;s role to <span className="font-semibold">COACH</span>.
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Coach Level</label>
          <select
            value={coachLevel}
            onChange={(e) => setCoachLevel(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
          >
            {COACH_LEVELS.map(l => <option key={l} value={l}>{l || "None"}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Team Age Groups</label>
          <div className="flex flex-wrap gap-1.5">
            {AGE_GROUPS.map(ag => (
              <button
                key={ag}
                type="button"
                onClick={() => toggleAgeGroup(ag)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  ageGroups.includes(ag)
                    ? "border-amber-500/40 bg-amber-500/20 text-amber-300"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {ag}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-1 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-700 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClubAssignModal({
  user,
  onDone,
  onClose,
}: {
  user: {
    id: string;
    email: string;
    organizationName?: string | null;
    clubMemberships?: ClubMembership[];
  };
  onDone: () => void;
  onClose: () => void;
}) {
  const primaryMembership = user.clubMemberships?.[0] ?? null;
  const [clubs, setClubs] = useState<Array<{ id: string; name: string; code: string; active: boolean }>>([]);
  const [clubId, setClubId] = useState(primaryMembership?.clubId ?? "");
  const [clubRole, setClubRole] = useState<"DOC" | "SECTION_DIRECTOR" | "COACH">(
    primaryMembership?.role ?? "COACH"
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adminFetch<{
          ok: boolean;
          clubs: Array<{ id: string; name: string; code: string; active: boolean }>;
        }>("/admin/clubs");
        const list = data.clubs ?? [];
        setClubs(list);
        if (primaryMembership?.clubId) {
          setClubId(primaryMembership.clubId);
          setClubRole(primaryMembership.role);
        } else {
          const current = list.find((c) => c.name === user.organizationName);
          setClubId(current?.id ?? "");
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load clubs");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.organizationName, primaryMembership?.clubId, primaryMembership?.role]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const previousClubId =
        primaryMembership?.clubId ??
        clubs.find((c) => c.name === user.organizationName)?.id ??
        null;

      if (!clubId) {
        if (previousClubId) {
          const res = await fetch(`${API_BASE}/admin/clubs/${previousClubId}/users/${user.id}`, {
            method: "DELETE",
            headers: getAdminHeaders(),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to remove club");
        }
      } else {
        if (previousClubId && previousClubId !== clubId) {
          const removeRes = await fetch(
            `${API_BASE}/admin/clubs/${previousClubId}/users/${user.id}`,
            {
              method: "DELETE",
              headers: getAdminHeaders(),
            }
          );
          const removeData = await removeRes.json();
          if (!removeRes.ok || !removeData.ok) {
            throw new Error(removeData.error ?? "Failed to move user off previous club");
          }
        }

        const res = await fetch(`${API_BASE}/admin/clubs/${clubId}/users/${user.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAdminHeaders() },
          body: JSON.stringify({ role: clubRole }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to assign club");
      }
      onDone();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save club assignment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-400" />
            <h2 className="font-semibold text-slate-200">Club Assignment</h2>
            <span className="rounded px-1.5 py-px text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">L5</span>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">{user.email}</p>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            Club
          </label>
          <select
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
            disabled={loading || saving}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
          >
            <option value="">No club</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name} ({club.code}){club.active ? "" : " - inactive"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            Club role
          </label>
          <select
            value={clubRole}
            onChange={(e) =>
              setClubRole(e.target.value as "DOC" | "SECTION_DIRECTOR" | "COACH")
            }
            disabled={loading || saving || !clubId}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
          >
            {CLUB_MEMBERSHIP_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-slate-500">
            DOC and Section Director unlock DOC Hub. This is separate from platform Role (L1).
          </p>
        </div>

        <div className="flex gap-3 pt-1 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-700 py-2 text-sm text-slate-400 hover:text-slate-200">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({
  user,
  onRefresh,
}: {
  user: User;
  onRefresh: () => void;
}) {
  const [showReset, setShowReset] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [showCoachLevel, setShowCoachLevel] = useState(false);
  const [showClubAssign, setShowClubAssign] = useState(false);
  const [deletingThis, setDeletingThis] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  async function verifyEmail() {
    setVerifying(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${user.id}/verify-email`, {
        method: "POST",
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data.ok) onRefresh();
    } finally {
      setVerifying(false);
    }
  }

  async function deleteUser() {
    if (!confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return;
    setDeletingThis(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${user.id}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data.ok) onRefresh();
      else alert(data.error ?? "Delete failed");
    } finally {
      setDeletingThis(false);
    }
  }

  return (
    <>
      {mounted && showReset && createPortal(
        <ResetPasswordModal user={user} onClose={() => setShowReset(false)} />,
        document.body
      )}
      {mounted && showBlock && createPortal(
        <BlockModal user={user} onDone={onRefresh} onClose={() => setShowBlock(false)} />,
        document.body
      )}
      {mounted && showCoachLevel && createPortal(
        <CoachLevelModal user={user} onDone={onRefresh} onClose={() => setShowCoachLevel(false)} />,
        document.body
      )}
      {mounted && showClubAssign && createPortal(
        <ClubAssignModal user={user} onDone={onRefresh} onClose={() => setShowClubAssign(false)} />,
        document.body
      )}

      <tr className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors">
        {/* User identity */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <StatusDot ok={!user.blocked} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate max-w-[180px]">{user.email}</p>
              {user.name && <p className="text-[10px] text-slate-600 truncate max-w-[180px]">{user.name}</p>}
            </div>
          </div>
        </td>

        {/* Role L1 */}
        <td className="px-3 py-3">
          <Badge className={ROLE_COLORS[user.role] ?? "bg-slate-700 text-slate-300"}>{user.role}</Badge>
        </td>

        {/* Plan L2 */}
        <td className="px-3 py-3">
          <Badge className={PLAN_COLORS[user.subscriptionPlan] ?? "bg-slate-700 text-slate-300"}>
            {user.subscriptionPlan}
          </Badge>
        </td>

        {/* Coach level L3 */}
        <td className="px-3 py-3 text-xs text-slate-500">
          {user.coachLevel?.replace("USSF_", "") ?? "—"}
        </td>

        {/* Admin role L4 */}
        <td className="px-3 py-3">
          {user.adminRole ? (
            <Badge className="bg-red-900/30 text-red-300">{user.adminRole}</Badge>
          ) : (
            <span className="text-xs text-slate-700">—</span>
          )}
        </td>

        {/* Club L5 */}
        <td className="px-3 py-3">
          {user.clubMemberships && user.clubMemberships.length > 0 ? (
            <div className="space-y-1">
              {user.clubMemberships.map((m) => (
                <div key={m.id} className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 text-emerald-400 shrink-0" />
                  <span className="text-xs text-emerald-300 font-medium truncate max-w-[110px]">
                    {m.clubName}
                  </span>
                  <Badge className={CLUB_ROLE_COLORS[m.role] ?? "bg-slate-700 text-slate-300"}>
                    {clubRoleLabel(m.role)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : user.club ? (
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3 w-3 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-300 font-medium">{user.club.name}</span>
            </div>
          ) : user.organizationName ? (
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3 w-3 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-300 font-medium">{user.organizationName}</span>
              <Badge className="bg-amber-500/15 text-amber-300">No role</Badge>
            </div>
          ) : (
            <span className="text-xs text-slate-700">—</span>
          )}
        </td>

        {/* Email verified */}
        <td className="px-3 py-3">
          <StatusDot ok={user.emailVerified} />
        </td>

        {/* Joined */}
        <td className="px-3 py-3 text-xs text-slate-600">{fmtDate(user.createdAt)}</td>

        {/* Actions */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-1">
            <ActionIcon
              label="Assign club / role"
              onClick={() => setShowClubAssign(true)}
              className="text-slate-600 hover:bg-slate-700 hover:text-emerald-300"
            >
              <Building2 className="h-3 w-3" />
            </ActionIcon>
            <ActionIcon
              label="Edit coach level"
              onClick={() => setShowCoachLevel(true)}
              className="text-slate-600 hover:bg-slate-700 hover:text-amber-300"
            >
              <Pencil className="h-3 w-3" />
            </ActionIcon>
            <ActionIcon
              label="Reset password"
              onClick={() => setShowReset(true)}
              className="text-slate-600 hover:bg-slate-700 hover:text-amber-300"
            >
              <KeyRound className="h-3 w-3" />
            </ActionIcon>
            {!user.emailVerified && (
              <ActionIcon
                label="Verify email"
                onClick={() => void verifyEmail()}
                disabled={verifying}
                className="text-slate-600 hover:bg-slate-700 hover:text-emerald-300"
              >
                <MailCheck className="h-3 w-3" />
              </ActionIcon>
            )}
            <ActionIcon
              label={user.blocked ? "Unblock user" : "Block user"}
              onClick={() => setShowBlock(true)}
              className={
                user.blocked
                  ? "text-red-500 hover:bg-red-900/20 hover:text-red-300"
                  : "text-slate-600 hover:bg-slate-700 hover:text-red-400"
              }
            >
              <Ban className="h-3 w-3" />
            </ActionIcon>
            <ActionIcon
              label="Delete user"
              onClick={() => void deleteUser()}
              disabled={deletingThis}
              className="text-slate-600 hover:bg-red-900/20 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </ActionIcon>
          </div>
        </td>
      </tr>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const loadUsers = useCallback(async (p = 1, q = search, plan = filterPlan, role = filterRole) => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "50" });
      if (q) params.set("search", q);
      if (plan) params.set("subscriptionPlan", plan);
      if (role) params.set("role", role);
      const data = await adminFetch<{
        ok: boolean;
        users: User[];
        pagination: { page: number; totalPages: number; total: number };
      }>(`/admin/users?${params}`);
      if (data.ok) {
        setUsers(data.users ?? []);
        setPage(data.pagination?.page ?? 1);
        setTotalPages(data.pagination?.totalPages ?? 1);
        setTotal(data.pagination?.total ?? 0);
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search, filterPlan, filterRole]);

  useEffect(() => { loadUsers(); }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    loadUsers(1, searchInput, filterPlan, filterRole);
  }

  return (
    <div className="max-w-full space-y-6">
      {showCreate && (
        <CreateUserModal
          onCreated={() => loadUsers(1)}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100">Users</h1>
            <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">L1 + L2</span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {total.toLocaleString()} total users — manage roles, plans, coach levels, and clubs
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => loadUsers(page)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New User
          </button>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by email or name…"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-2 pl-9 pr-3 text-sm text-slate-300 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <button type="submit" className="rounded-xl bg-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-600">
            Go
          </button>
        </form>

        <select
          value={filterPlan}
          onChange={(e) => { setFilterPlan(e.target.value); loadUsers(1, search, e.target.value, filterRole); }}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All plans</option>
          {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          value={filterRole}
          onChange={(e) => { setFilterRole(e.target.value); loadUsers(1, search, filterPlan, e.target.value); }}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">User</th>
                <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Role <span className="text-blue-400">(L1)</span>
                </th>
                <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Plan <span className="text-violet-400">(L2)</span>
                </th>
                <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Coach <span className="text-amber-400">(L3)</span>
                </th>
                <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Admin <span className="text-red-400">(L4)</span>
                </th>
                <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Club <span className="text-emerald-400">(L5)</span>
                </th>
                <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Email</th>
                <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Joined</th>
                <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/40">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-4 animate-pulse rounded bg-slate-800/60" style={{ width: `${40 + (i * j) % 60}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-slate-600">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map(u => <UserRow key={u.id} user={u} onRefresh={() => loadUsers(page)} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
          <span className="text-xs text-slate-600">
            Page {page} of {totalPages} · {total.toLocaleString()} users
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => { const p = page - 1; setPage(p); loadUsers(p); }}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => { const p = page + 1; setPage(p); loadUsers(p); }}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
