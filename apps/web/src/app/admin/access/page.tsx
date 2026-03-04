"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Lock,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  AlertTriangle,
  RefreshCw,
  User,
  Users,
  Check,
  Info,
} from "lucide-react";
import { adminFetch, API_BASE, getAdminHeaders } from "../_lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Permission = {
  id: string;
  userId: string | null;
  user: { id: string; email: string | null; name: string | null; coachLevel: string | null } | null;
  resourceType: string;
  coachLevel: string | null;
  ageGroups: string[];
  formats: string[];
  canGenerateSessions: boolean;
  canAccessVault: boolean;
  canAccessVideoReview: boolean;
  notes: string | null;
  createdAt: string;
};

type PermForm = {
  userId: string;
  resourceType: "SESSION" | "VAULT" | "BOTH" | "VIDEO_REVIEW";
  coachLevel: string;
  ageGroups: string[];
  formats: string[];
  canGenerateSessions: boolean;
  canAccessVault: boolean;
  canAccessVideoReview: boolean;
  notes: string;
};

const AGE_GROUPS = ["U8","U9","U10","U11","U12","U13","U14","U15","U16","U17","U18"];
const ALL_FORMATS = ["7v7", "9v9", "11v11"] as const;
const RESOURCE_TYPES = ["SESSION", "VAULT", "VIDEO_REVIEW", "BOTH"] as const;
const COACH_LEVELS = ["", "GRASSROOTS", "USSF_C", "USSF_B_PLUS"] as const;
const RESOURCE_TYPE_LABELS: Record<PermForm["resourceType"], string> = {
  SESSION: "Session",
  VAULT: "Vault",
  BOTH: "All",
  VIDEO_REVIEW: "Video Review",
};

function flagsForResourceType(resourceType: PermForm["resourceType"]) {
  switch (resourceType) {
    case "SESSION":
      return { canGenerateSessions: true, canAccessVault: false, canAccessVideoReview: false };
    case "VAULT":
      return { canGenerateSessions: false, canAccessVault: true, canAccessVideoReview: false };
    case "VIDEO_REVIEW":
      return { canGenerateSessions: false, canAccessVault: false, canAccessVideoReview: true };
    case "BOTH":
    default:
      return { canGenerateSessions: true, canAccessVault: true, canAccessVideoReview: true };
  }
}

function resourceTypeFromFlags(flags: {
  canGenerateSessions: boolean;
  canAccessVault: boolean;
  canAccessVideoReview: boolean;
}): PermForm["resourceType"] {
  if (flags.canGenerateSessions && flags.canAccessVault && flags.canAccessVideoReview) return "BOTH";
  if (flags.canAccessVideoReview && !flags.canGenerateSessions && !flags.canAccessVault) return "VIDEO_REVIEW";
  if (flags.canGenerateSessions && flags.canAccessVault) return "BOTH";
  if (flags.canGenerateSessions) return "SESSION";
  if (flags.canAccessVault) return "VAULT";
  return "BOTH";
}

function getFormatFromAgeGroup(ageGroup: string): "7v7" | "9v9" | "11v11" {
  const age = Number(ageGroup.replace("U", ""));
  if (age >= 8 && age <= 12) return "7v7";
  if (age >= 13 && age <= 14) return "9v9";
  return "11v11";
}

function deriveFormatsFromAgeGroups(ageGroups: string[]): string[] {
  if (ageGroups.length === 0) return [];
  return Array.from(new Set(ageGroups.map(getFormatFromAgeGroup)));
}

function ageGroupsForFormat(format: string): string[] {
  switch (format) {
    case "7v7":
      return ["U8", "U9", "U10", "U11", "U12"];
    case "9v9":
      return ["U13", "U14"];
    case "11v11":
      return ["U15", "U16", "U17", "U18"];
    default:
      return [];
  }
}

function emptyForm(): PermForm {
  const flags = flagsForResourceType("BOTH");
  return {
    userId: "",
    resourceType: "BOTH",
    coachLevel: "",
    ageGroups: [],
    formats: [],
    canGenerateSessions: flags.canGenerateSessions,
    canAccessVault: flags.canAccessVault,
    canAccessVideoReview: flags.canAccessVideoReview,
    notes: "",
  };
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function ToggleChip({
  label,
  active,
  onClick,
  color = "slate",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: "slate" | "emerald" | "blue" | "amber";
}) {
  const colors = {
    slate: active ? "border-slate-500/50 bg-slate-700 text-slate-200" : "border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300",
    emerald: active ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300" : "border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300",
    blue: active ? "border-blue-500/40 bg-blue-500/20 text-blue-300" : "border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300",
    amber: active ? "border-amber-500/40 bg-amber-500/20 text-amber-300" : "border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${colors[color]}`}
    >
      {label}
    </button>
  );
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  );
}

const RT_COLORS: Record<string, string> = {
  SESSION: "bg-blue-500/20 text-blue-300",
  VAULT: "bg-violet-500/20 text-violet-300",
  BOTH: "bg-emerald-500/20 text-emerald-300",
  VIDEO_REVIEW: "bg-amber-500/20 text-amber-300",
};

// ─── Permission modal ─────────────────────────────────────────────────────────

function PermissionModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Permission;
  onSave: (form: PermForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PermForm>(
    initial
      ? {
          ...flagsForResourceType(initial.resourceType as PermForm["resourceType"]),
          userId: initial.userId ?? "",
          resourceType: initial.resourceType as PermForm["resourceType"],
          coachLevel: initial.coachLevel ?? "",
          ageGroups: initial.ageGroups,
          formats: deriveFormatsFromAgeGroups(initial.ageGroups),
          notes: initial.notes ?? "",
        }
      : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleArray<T extends string>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function applyResourceType(resourceType: PermForm["resourceType"]) {
    const flags = flagsForResourceType(resourceType);
    setForm((f) => ({ ...f, resourceType, ...flags }));
  }

  function applyFeatureFlag(key: "canGenerateSessions" | "canAccessVault" | "canAccessVideoReview", value: boolean) {
    setForm((f) => {
      const nextFlags = {
        canGenerateSessions: key === "canGenerateSessions" ? value : f.canGenerateSessions,
        canAccessVault: key === "canAccessVault" ? value : f.canAccessVault,
        canAccessVideoReview: key === "canAccessVideoReview" ? value : f.canAccessVideoReview,
      };
      const resourceType = resourceTypeFromFlags(nextFlags);
      return { ...f, resourceType, ...flagsForResourceType(resourceType) };
    });
  }

  function toggleFormat(format: string) {
    setForm((f) => {
      const formatAges = ageGroupsForFormat(format);
      if (formatAges.length === 0) return f;

      const allSelected = formatAges.every((ag) => f.ageGroups.includes(ag));
      let nextAgeGroups: string[];

      if (allSelected) {
        nextAgeGroups = f.ageGroups.filter((ag) => !formatAges.includes(ag));
      } else {
        nextAgeGroups = Array.from(new Set([...f.ageGroups, ...formatAges]));
      }

      return {
        ...f,
        ageGroups: nextAgeGroups,
        formats: deriveFormatsFromAgeGroups(nextAgeGroups),
      };
    });
  }

  const isUserSpecific = !!form.userId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 p-5 shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-400" />
            <h2 className="font-semibold text-slate-200">
              {initial ? "Edit Permission" : "Create Permission"}
            </h2>
            <span className="rounded px-1.5 py-px text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">L3</span>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2.5 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Scope: user-specific or coach-level */}
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <Info className="h-3.5 w-3.5" />
              Scope — who does this rule apply to?
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                User ID or Email <span className="normal-case font-normal text-slate-600">(leave blank for coach-level rule)</span>
              </label>
              <input
                value={form.userId}
                onChange={(e) => setForm(f => ({ ...f, userId: e.target.value }))}
                placeholder="user-uuid or email"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
              />
            </div>
            {!isUserSpecific && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                  Coach Level <span className="normal-case font-normal text-slate-600">(blank = all coach levels)</span>
                </label>
                <select
                  value={form.coachLevel}
                  onChange={(e) => setForm(f => ({ ...f, coachLevel: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                >
                  {COACH_LEVELS.map(l => <option key={l} value={l}>{l || "All coach levels"}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Resource type */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Resource Type</label>
              <span className="text-[10px] text-slate-600">All = Session + Vault + Video</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {RESOURCE_TYPES.map(rt => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => applyResourceType(rt)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.resourceType === rt
                      ? `${RT_COLORS[rt]} border-current`
                      : "border-slate-700 bg-slate-800 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {RESOURCE_TYPE_LABELS[rt]}
                </button>
              ))}
            </div>
          </div>

          {/* Age groups */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Age Groups <span className="normal-case font-normal text-slate-600">(empty = all)</span>
              </label>
              {form.ageGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, ageGroups: [], formats: [] }))}
                  className="text-[10px] text-slate-600 hover:text-slate-400"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {AGE_GROUPS.map(ag => (
                <ToggleChip
                  key={ag}
                  label={ag}
                  active={form.ageGroups.includes(ag)}
                  onClick={() =>
                    setForm((f) => {
                      const nextAgeGroups = toggleArray(f.ageGroups, ag);
                      return {
                        ...f,
                        ageGroups: nextAgeGroups,
                        formats: deriveFormatsFromAgeGroups(nextAgeGroups),
                      };
                    })
                  }
                  color="blue"
                />
              ))}
            </div>
          </div>

          {/* Formats (derived) */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Formats <span className="normal-case font-normal text-slate-600">(click to toggle related age groups)</span>
            </label>
            <div className="flex gap-2">
              {ALL_FORMATS.map((f) => (
                <button
                  type="button"
                  onClick={() => toggleFormat(f)}
                  key={f}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    form.ageGroups.length === 0 || form.formats.includes(f)
                      ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                      : "border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Feature flags */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Feature Flags
            </label>
            <div className="space-y-2">
              {(
                [
                  { key: "canGenerateSessions" as const, label: "Can Generate Sessions", desc: "Unlocks AI session generation" },
                  { key: "canAccessVault" as const, label: "Can Access Vault", desc: "Unlocks vault browsing & saving" },
                  { key: "canAccessVideoReview" as const, label: "Can Access Video Review", desc: "Unlocks video analysis features" },
                ] as const
              ).map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => applyFeatureFlag(key, e.target.checked)}
                    className="mt-0.5 rounded border-slate-600 bg-slate-800 text-amber-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-300 group-hover:text-slate-200">{label}</p>
                    <p className="text-[11px] text-slate-600">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes about why this permission exists…"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:border-amber-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800 shrink-0">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50">
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : initial ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Permission card ──────────────────────────────────────────────────────────

function PermissionCard({
  perm,
  onEdit,
  onDelete,
}: {
  perm: Permission;
  onEdit: (p: Permission) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`shrink-0 rounded-xl p-2 ${perm.userId ? "bg-blue-500/10 border border-blue-500/20" : "bg-slate-700/50"}`}>
          {perm.userId ? <User className="h-4 w-4 text-blue-400" /> : <Users className="h-4 w-4 text-slate-400" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Who */}
          <div className="flex items-center gap-2 flex-wrap">
            {perm.user ? (
              <span className="text-sm font-medium text-slate-200 truncate">
                {perm.user.email ?? perm.userId}
              </span>
            ) : (
              <span className="text-sm font-medium text-slate-400">
                Coach-level rule
                {perm.coachLevel && (
                  <span className="ml-1 font-normal text-amber-300">
                    → {perm.coachLevel.replace("USSF_", "")}
                  </span>
                )}
                {!perm.coachLevel && (
                  <span className="ml-1 font-normal text-slate-600"> (all levels)</span>
                )}
              </span>
            )}
            <Badge className={RT_COLORS[perm.resourceType] ?? "bg-slate-700 text-slate-400"}>
              {RESOURCE_TYPE_LABELS[(perm.resourceType as PermForm["resourceType"])] ?? perm.resourceType}
            </Badge>
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-1.5">
            {perm.canGenerateSessions && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300">
                <Check className="h-2.5 w-2.5" /> Generate Sessions
              </span>
            )}
            {perm.canAccessVault && (
              <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/15 border border-violet-500/20 px-2 py-0.5 text-[11px] text-violet-300">
                <Check className="h-2.5 w-2.5" /> Vault Access
              </span>
            )}
            {perm.canAccessVideoReview && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 text-[11px] text-amber-300">
                <Check className="h-2.5 w-2.5" /> Video Review
              </span>
            )}
          </div>

          {/* Scope */}
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
            {perm.ageGroups.length > 0 ? (
              <span>Ages: {perm.ageGroups.join(", ")}</span>
            ) : (
              <span className="text-slate-700">All age groups</span>
            )}
            <span>·</span>
            {perm.formats.length > 0 ? (
              <span>Formats: {perm.formats.join(", ")}</span>
            ) : (
              <span className="text-slate-700">All formats</span>
            )}
          </div>

          {perm.notes && (
            <p className="text-[11px] text-slate-600 italic">{perm.notes}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(perm)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-800 hover:text-amber-300 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(perm.id)}
            className="rounded-lg p-2 text-slate-600 hover:bg-red-900/20 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAccessPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState<{ perm?: Permission } | null>(null);
  const [filterType, setFilterType] = useState<"" | "user" | "coach">(""); // filter by scope

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ ok: boolean; permissions: Permission[] }>(
        "/admin/access-permissions"
      );
      setPermissions(data.permissions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  async function savePermission(form: PermForm) {
    const editing = showModal?.perm;
    const url = `${API_BASE}/admin/access-permissions`;
    const method = "POST";

    const body = {
      ...(editing ? { id: editing.id } : {}),
      ...form,
      formats: deriveFormatsFromAgeGroups(form.ageGroups),
      userId: form.userId || null,
      coachLevel: form.userId ? null : (form.coachLevel || null),
    };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...getAdminHeaders() },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
    setShowModal(null);
    loadPermissions();
  }

  async function deletePermission(id: string) {
    if (!confirm("Delete this permission? This cannot be undone.")) return;
    const res = await fetch(`${API_BASE}/admin/access-permissions/${id}`, {
      method: "DELETE",
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (data.ok) loadPermissions();
    else alert(data.error ?? "Delete failed");
  }

  const filtered = permissions.filter(p => {
    if (filterType === "user") return !!p.userId;
    if (filterType === "coach") return !p.userId;
    return true;
  });

  const userRules = permissions.filter(p => !!p.userId).length;
  const coachRules = permissions.filter(p => !p.userId).length;

  return (
    <div className="max-w-3xl space-y-6">
      {showModal !== null && (
        <PermissionModal
          initial={showModal.perm}
          onSave={savePermission}
          onClose={() => setShowModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-100">Access Permissions</h1>
            <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Layer 3
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            Granular overrides for session generation, vault access, and video review — by user or coach level.
          </p>
        </div>
        <button
          onClick={() => setShowModal({})}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Rule
        </button>
      </div>

      {/* Resolution order callout */}
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4 space-y-2 text-xs text-slate-500">
        <p className="font-semibold text-slate-300 text-[11px] uppercase tracking-wide">Resolution Order</p>
        <ol className="list-decimal list-inside space-y-1">
          <li><span className="text-red-300">SUPER_ADMIN</span> — always bypasses all permission checks</li>
          <li><span className="text-blue-300">User-specific rules</span> — highest priority, override coach-level rules</li>
          <li><span className="text-amber-300">Coach-level rules</span> — apply to all users at that coach level</li>
          <li><span className="text-slate-400">Default: true</span> — if no rules exist, access is granted for backward compatibility</li>
        </ol>
      </div>

      {/* Stats + filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-3">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2 text-center">
            <p className="text-xl font-bold text-slate-100">{permissions.length}</p>
            <p className="text-[10px] text-slate-600">total rules</p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-center">
            <p className="text-xl font-bold text-blue-300">{userRules}</p>
            <p className="text-[10px] text-slate-600">user-specific</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-center">
            <p className="text-xl font-bold text-amber-300">{coachRules}</p>
            <p className="text-[10px] text-slate-600">coach-level</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadPermissions()}
            className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <div className="flex rounded-xl border border-slate-700 overflow-hidden">
            {(
              [
                { val: "" as const, label: "All" },
                { val: "user" as const, label: "User-specific" },
                { val: "coach" as const, label: "Coach-level" },
              ]
            ).map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setFilterType(val)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterType === val
                    ? "bg-slate-700 text-slate-200"
                    : "bg-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Permission list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-800/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/50 py-16 text-center">
          <Lock className="mb-3 h-8 w-8 text-slate-700" />
          <p className="text-sm font-medium text-slate-500">No permissions yet</p>
          <p className="mt-1 text-xs text-slate-600">Create rules to override the default access behavior</p>
          <button
            onClick={() => setShowModal({})}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
          >
            <Plus className="h-4 w-4" />
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <PermissionCard
              key={p.id}
              perm={p}
              onEdit={(p) => setShowModal({ perm: p })}
              onDelete={deletePermission}
            />
          ))}
        </div>
      )}
    </div>
  );
}
