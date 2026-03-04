"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { adminFetch } from "../_lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type UsageByPlan = {
  plan: string;
  userCount: number;
  sessionCount: number;
  avgSessionsPerUser: number;
}[];

type VaultUsage = {
  plan: string;
  userCount: number;
  totalSessions: number;
  totalDrills: number;
  avgSessions: number;
  avgDrills: number;
}[];

type FeatureAccess = {
  plan: string;
  userCount: number;
  canExportPDF: boolean;
  canGenerateSeries: boolean;
  canUseAdvancedFilters: boolean;
  canAccessCalendar: boolean;
  canCreatePlayerPlans: boolean;
  canGenerateWeeklySummaries: boolean;
  canInviteCoaches: boolean;
  canManageOrganization: boolean;
}[];

type TrialAccounts = {
  total: number;
  active: number;
  expired: number;
  conversionRate: string | number;
  upcoming: { userId: string; email: string | null; daysLeft: number }[];
};

type LimitEnforcement = {
  totalHits: number;
  hitsByPlan: Record<string, number>;
  recentHits: {
    userId: string;
    email: string | null;
    limitType: string;
    plan: string;
    createdAt: string;
  }[];
};

type ClubAccounts = {
  total: number;
  standard: number;
  premium: number;
  organizations: { name: string; coachCount: number }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-slate-500",
  TRIAL: "bg-yellow-400",
  COACH_BASIC: "bg-blue-400",
  COACH_PRO: "bg-violet-400",
  CLUB_STANDARD: "bg-emerald-400",
  CLUB_PREMIUM: "bg-emerald-300",
};

const PLAN_TEXT: Record<string, string> = {
  FREE: "text-slate-400",
  TRIAL: "text-yellow-300",
  COACH_BASIC: "text-blue-300",
  COACH_PRO: "text-violet-300",
  CLUB_STANDARD: "text-emerald-300",
  CLUB_PREMIUM: "text-emerald-200",
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString();
}

function SectionHeader({
  title,
  sub,
  open,
  onToggle,
}: {
  title: string;
  sub?: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between text-left"
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        {sub && <p className="text-xs text-slate-600">{sub}</p>}
      </div>
      {open ? (
        <ChevronUp className="h-4 w-4 text-slate-600" />
      ) : (
        <ChevronDown className="h-4 w-4 text-slate-600" />
      )}
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = "slate",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color === "slate" ? "text-slate-100" : color}`}>
        {typeof value === "number" ? fmt(value) : value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-600">{sub}</p>}
    </div>
  );
}

// ─── Usage by Plan section ────────────────────────────────────────────────────

function UsageByPlanSection({ data }: { data: UsageByPlan }) {
  if (!data?.length) return <p className="text-sm text-slate-600">No data available.</p>;
  const maxSessions = Math.max(...data.map(d => d.sessionCount), 1);
  return (
    <div className="space-y-3">
      {data.map(row => (
        <div key={row.plan} className="flex items-center gap-3">
          <span className={`w-24 shrink-0 text-xs font-medium ${PLAN_TEXT[row.plan] ?? "text-slate-400"}`}>
            {row.plan}
          </span>
          <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${PLAN_COLORS[row.plan] ?? "bg-slate-500"}`}
              style={{ width: `${(row.sessionCount / maxSessions) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs text-slate-400">
            {fmt(row.sessionCount)} <span className="text-slate-700">sessions</span>
          </span>
          <span className="w-12 shrink-0 text-right text-[11px] text-slate-600">
            {row.userCount} users
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Feature access section ───────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  canExportPDF: "PDF Export",
  canGenerateSeries: "Series",
  canUseAdvancedFilters: "Adv. Filters",
  canAccessCalendar: "Calendar",
  canCreatePlayerPlans: "Player Plans",
  canGenerateWeeklySummaries: "Weekly Summary",
  canInviteCoaches: "Invite Coaches",
  canManageOrganization: "Manage Org",
};

function FeatureAccessSection({ data }: { data: FeatureAccess }) {
  if (!data?.length) return <p className="text-sm text-slate-600">No data available.</p>;
  const featureKeys = Object.keys(FEATURE_LABELS) as (keyof FeatureAccess[0])[];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="pb-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 w-32">Plan</th>
            {featureKeys.map(k => (
              <th key={k} className="pb-2 px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {FEATURE_LABELS[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.plan} className="border-b border-slate-800/50">
              <td className={`py-2 pr-3 font-medium ${PLAN_TEXT[row.plan] ?? "text-slate-400"}`}>
                {row.plan}
              </td>
              {featureKeys.map(k => (
                <td key={k} className="py-2 px-2 text-center">
                  {row[k] ? (
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="inline-block h-2 w-2 rounded-full bg-slate-700" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Trial accounts section ───────────────────────────────────────────────────

function TrialSection({ data }: { data: TrialAccounts }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Trials" value={data.total} />
        <StatCard label="Active" value={data.active} color="text-emerald-300" />
        <StatCard label="Expired" value={data.expired} color="text-red-400" />
        <StatCard label="Conversion" value={data.conversionRate ?? "—"} color="text-violet-300" />
      </div>

      {data.upcoming?.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Expiring Soon</p>
          <div className="space-y-1.5">
            {data.upcoming.slice(0, 8).map(u => (
              <div key={u.userId} className="flex items-center justify-between rounded-xl border border-slate-700/30 bg-slate-800/30 px-3 py-2">
                <span className="text-xs text-slate-400 truncate">{u.email ?? u.userId}</span>
                <span className={`text-xs font-medium ${u.daysLeft <= 1 ? "text-red-400" : u.daysLeft <= 3 ? "text-amber-400" : "text-slate-400"}`}>
                  {u.daysLeft}d left
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Limit enforcement section ────────────────────────────────────────────────

function LimitSection({ data }: { data: LimitEnforcement }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Total Hits" value={data.totalHits} color="text-red-400" />
        {Object.entries(data.hitsByPlan ?? {})
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([plan, count]) => (
            <StatCard key={plan} label={plan} value={count} />
          ))}
      </div>

      {data.recentHits?.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Hits</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {data.recentHits.slice(0, 20).map((h, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-700/30 bg-slate-800/30 px-3 py-2 text-xs">
                <span className={`shrink-0 font-medium ${PLAN_TEXT[h.plan] ?? "text-slate-400"}`}>{h.plan}</span>
                <span className="flex-1 truncate text-slate-500">{h.email ?? h.userId}</span>
                <span className="shrink-0 text-slate-600">{h.limitType}</span>
                <span className="shrink-0 text-slate-700">
                  {new Date(h.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vault usage section ──────────────────────────────────────────────────────

function VaultSection({ data }: { data: VaultUsage }) {
  if (!data?.length) return <p className="text-sm text-slate-600">No data available.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">Plan</th>
            <th className="pb-2 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600">Users</th>
            <th className="pb-2 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600">Total Sessions</th>
            <th className="pb-2 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600">Avg Sessions</th>
            <th className="pb-2 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600">Total Drills</th>
            <th className="pb-2 pl-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600">Avg Drills</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.plan} className="border-b border-slate-800/50">
              <td className={`py-2 pr-4 font-medium ${PLAN_TEXT[row.plan] ?? "text-slate-400"}`}>{row.plan}</td>
              <td className="py-2 px-3 text-right text-slate-400">{fmt(row.userCount)}</td>
              <td className="py-2 px-3 text-right text-slate-200 font-medium">{fmt(row.totalSessions)}</td>
              <td className="py-2 px-3 text-right text-slate-500">{row.avgSessions?.toFixed(1) ?? "—"}</td>
              <td className="py-2 px-3 text-right text-slate-200 font-medium">{fmt(row.totalDrills)}</td>
              <td className="py-2 pl-3 text-right text-slate-500">{row.avgDrills?.toFixed(1) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [usageByPlan, setUsageByPlan] = useState<UsageByPlan | null>(null);
  const [vaultUsage, setVaultUsage] = useState<VaultUsage | null>(null);
  const [featureAccess, setFeatureAccess] = useState<FeatureAccess | null>(null);
  const [trialAccounts, setTrialAccounts] = useState<TrialAccounts | null>(null);
  const [limitEnforcement, setLimitEnforcement] = useState<LimitEnforcement | null>(null);
  const [clubAccounts, setClubAccounts] = useState<ClubAccounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Section open/close state
  const [open, setOpen] = useState({
    usage: true,
    vault: true,
    features: false,
    trials: true,
    limits: false,
    clubs: false,
  });

  function toggleSection(key: keyof typeof open) {
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usage, vault, features, trials, limits, clubs] = await Promise.allSettled([
        adminFetch<{
          ok: boolean;
          usageByPlan: Record<string, { totalUsers: number; totalSessionsUsed: number; avgSessionsPerUser: number }>;
        }>("/admin/analytics/usage-by-plan"),
        adminFetch<{
          ok: boolean;
          vaultUsageByPlan: Record<
            string,
            { totalUsers: number; totalVaultSessions: number; totalVaultDrills: number; avgSessionsPerUser: number; avgDrillsPerUser: number }
          >;
        }>("/admin/analytics/vault-usage"),
        adminFetch<{
          ok: boolean;
          featureAccess: Record<
            string,
            {
              canExportPDF: number;
              canGenerateSeries: number;
              canUseAdvancedFilters: number;
              canAccessCalendar: number;
              canCreatePlayerPlans: number;
              canGenerateWeeklySummaries: number;
              canInviteCoaches: number;
              canManageOrganization: number;
            }
          >;
        }>("/admin/analytics/feature-access"),
        adminFetch<{
          ok: boolean;
          trialAccounts: {
            total: number;
            active: number;
            expired: number;
            conversionRate: number;
            upcomingExpirations: { userId: string; email: string | null; daysRemaining: number }[];
          };
        }>("/admin/analytics/trial-accounts"),
        adminFetch<{ ok: boolean; limitEnforcement: LimitEnforcement }>("/admin/analytics/limit-enforcement"),
        adminFetch<{
          ok: boolean;
          clubAccounts: {
            total: number;
            standard: number;
            premium: number;
            organizations: {
              coachCounts: Record<string, number>;
            };
          };
        }>("/admin/analytics/club-accounts"),
      ]);

      if (usage.status === "fulfilled" && usage.value.ok) {
        const rows: UsageByPlan = Object.entries(usage.value.usageByPlan ?? {}).map(([plan, v]) => ({
          plan,
          userCount: v.totalUsers ?? 0,
          sessionCount: v.totalSessionsUsed ?? 0,
          avgSessionsPerUser: v.avgSessionsPerUser ?? 0,
        }));
        setUsageByPlan(rows);
      }
      if (vault.status === "fulfilled" && vault.value.ok) {
        const rows: VaultUsage = Object.entries(vault.value.vaultUsageByPlan ?? {}).map(([plan, v]) => ({
          plan,
          userCount: v.totalUsers ?? 0,
          totalSessions: v.totalVaultSessions ?? 0,
          totalDrills: v.totalVaultDrills ?? 0,
          avgSessions: v.avgSessionsPerUser ?? 0,
          avgDrills: v.avgDrillsPerUser ?? 0,
        }));
        setVaultUsage(rows);
      }
      if (features.status === "fulfilled" && features.value.ok) {
        const rows: FeatureAccess = Object.entries(features.value.featureAccess ?? {}).map(([plan, v]) => ({
          plan,
          userCount: 0,
          canExportPDF: Boolean(v.canExportPDF),
          canGenerateSeries: Boolean(v.canGenerateSeries),
          canUseAdvancedFilters: Boolean(v.canUseAdvancedFilters),
          canAccessCalendar: Boolean(v.canAccessCalendar),
          canCreatePlayerPlans: Boolean(v.canCreatePlayerPlans),
          canGenerateWeeklySummaries: Boolean(v.canGenerateWeeklySummaries),
          canInviteCoaches: Boolean(v.canInviteCoaches),
          canManageOrganization: Boolean(v.canManageOrganization),
        }));
        setFeatureAccess(rows);
      }
      if (trials.status === "fulfilled" && trials.value.ok) {
        const t = trials.value.trialAccounts;
        setTrialAccounts({
          total: t?.total ?? 0,
          active: t?.active ?? 0,
          expired: t?.expired ?? 0,
          conversionRate: t?.conversionRate ?? 0,
          upcoming: (t?.upcomingExpirations ?? []).map((u) => ({
            userId: u.userId,
            email: u.email,
            daysLeft: u.daysRemaining,
          })),
        });
      }
      if (limits.status === "fulfilled" && limits.value.ok) {
        const l = limits.value.limitEnforcement;
        setLimitEnforcement({
          totalHits: l?.totalHits ?? 0,
          hitsByPlan: l?.hitsByPlan ?? {},
          recentHits: (l?.recentHits ?? []).map((h) => ({
            userId: h.userId,
            email: h.email,
            plan: h.plan,
            limitType: h.limitType,
            createdAt: new Date().toISOString(),
          })),
        });
      }
      if (clubs.status === "fulfilled" && clubs.value.ok) {
        const c = clubs.value.clubAccounts;
        const organizations = Object.entries(c?.organizations?.coachCounts ?? {}).map(([name, coachCount]) => ({
          name,
          coachCount,
        }));
        setClubAccounts({
          total: c?.total ?? 0,
          standard: c?.standard ?? 0,
          premium: c?.premium ?? 0,
          organizations,
        });
      }

      const rejected = [usage, vault, features, trials, limits, clubs].find(
        (r): r is PromiseRejectedResult => r.status === "rejected"
      );
      if (rejected) {
        const message = rejected.reason instanceof Error ? rejected.reason.message : String(rejected.reason);
        setError(message);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Analytics</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Usage across plans, feature adoption, trials, and limit enforcement
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Session Usage by Plan ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 space-y-4">
        <SectionHeader
          title="Session Generation by Plan"
          sub="How many sessions each plan tier has generated"
          open={open.usage}
          onToggle={() => toggleSection("usage")}
        />
        {open.usage && (
          loading ? <div className="h-32 animate-pulse rounded-xl bg-slate-800/50" /> :
          usageByPlan ? <UsageByPlanSection data={usageByPlan} /> :
          <p className="text-sm text-slate-600">No data</p>
        )}
      </div>

      {/* ── Vault Usage ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 space-y-4">
        <SectionHeader
          title="Vault Usage by Plan"
          sub="Sessions and drills saved in the vault per plan"
          open={open.vault}
          onToggle={() => toggleSection("vault")}
        />
        {open.vault && (
          loading ? <div className="h-32 animate-pulse rounded-xl bg-slate-800/50" /> :
          vaultUsage ? <VaultSection data={vaultUsage} /> :
          <p className="text-sm text-slate-600">No data</p>
        )}
      </div>

      {/* ── Feature Access ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 space-y-4">
        <SectionHeader
          title="Feature Access Matrix"
          sub="Which features are enabled per subscription plan"
          open={open.features}
          onToggle={() => toggleSection("features")}
        />
        {open.features && (
          loading ? <div className="h-32 animate-pulse rounded-xl bg-slate-800/50" /> :
          featureAccess ? <FeatureAccessSection data={featureAccess} /> :
          <p className="text-sm text-slate-600">No data</p>
        )}
      </div>

      {/* ── Trial Accounts ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 space-y-4">
        <SectionHeader
          title="Trial Accounts"
          sub="Active, expired, and conversion tracking (public game models only)"
          open={open.trials}
          onToggle={() => toggleSection("trials")}
        />
        {open.trials && (
          loading ? <div className="h-32 animate-pulse rounded-xl bg-slate-800/50" /> :
          trialAccounts ? <TrialSection data={trialAccounts} /> :
          <p className="text-sm text-slate-600">No data</p>
        )}
      </div>

      {/* ── Limit Enforcement ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 space-y-4">
        <SectionHeader
          title="Limit Enforcement"
          sub="Users hitting subscription caps — upgrade opportunities"
          open={open.limits}
          onToggle={() => toggleSection("limits")}
        />
        {open.limits && (
          loading ? <div className="h-32 animate-pulse rounded-xl bg-slate-800/50" /> :
          limitEnforcement ? <LimitSection data={limitEnforcement} /> :
          <p className="text-sm text-slate-600">No data</p>
        )}
      </div>

      {/* ── Club Accounts ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 space-y-4">
        <SectionHeader
          title="Club Accounts"
          sub="CLUB_STANDARD and CLUB_PREMIUM organizations"
          open={open.clubs}
          onToggle={() => toggleSection("clubs")}
        />
        {open.clubs && (
          loading ? <div className="h-16 animate-pulse rounded-xl bg-slate-800/50" /> :
          clubAccounts ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Total Clubs" value={clubAccounts.total} />
                <StatCard label="Standard" value={clubAccounts.standard} />
                <StatCard label="Premium" value={clubAccounts.premium} color="text-emerald-300" />
              </div>
              {clubAccounts.organizations?.length > 0 && (
                <div className="space-y-1.5">
                  {clubAccounts.organizations.slice(0, 10).map((org, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-slate-700/30 bg-slate-800/30 px-3 py-2 text-xs">
                      <span className="text-slate-300">{org.name}</span>
                      <span className="text-slate-600">{org.coachCount} coaches</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : <p className="text-sm text-slate-600">No data</p>
        )}
      </div>
    </div>
  );
}
