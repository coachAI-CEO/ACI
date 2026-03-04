"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  Users,
  Database,
  Cpu,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  Building2,
  BarChart3,
  FileCheck,
  Settings,
  RefreshCw,
  ArrowRight,
  Shield,
} from "lucide-react";
import { API_BASE, getAdminHeaders, adminFetch } from "./_lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type SystemStatus = "online" | "offline" | "checking";

type Stats = {
  database: {
    totalSessions: number;
    totalDrills: number;
    totalSeries: number;
    vaultSessions: number;
    vaultDrills: number;
  };
  api: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRate: string;
  };
  tokens: {
    allTimeTotal: number;
    allTimeCost: string;
    recentCost: string;
  };
};

type UserSummary = {
  totalUsers: number;
  byRole: Record<string, number>;
  byAdminRole: Record<string, number>;
  bySubscriptionPlan: Record<string, number>;
  bySubscriptionStatus: Record<string, number>;
};

type AccountAlert = {
  id: string;
  userId: string;
  userEmail: string | null;
  alertType: string;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

function fmtTokenVolume(n: number | undefined | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtUsd(v: string | number | undefined | null): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n as number)) return "—";
  return `$${(n as number).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatusDot({ status }: { status: SystemStatus }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        status === "online"
          ? "bg-emerald-400 animate-pulse"
          : status === "offline"
          ? "bg-red-400"
          : "bg-yellow-400 animate-pulse"
      }`}
    />
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "slate",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: "slate" | "emerald" | "blue" | "violet" | "amber" | "red";
}) {
  const colors = {
    slate: "bg-slate-800/60 border-slate-700/50 text-slate-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    red: "bg-red-500/10 border-red-500/20 text-red-400",
  };

  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-100">
            {typeof value === "number" ? fmt(value) : value}
          </p>
          {sub && <p className="mt-0.5 text-xs opacity-60">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2 ${colors[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Section link card ────────────────────────────────────────────────────────

function SectionCard({
  href,
  icon: Icon,
  title,
  description,
  badge,
  layer,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  badge?: string;
  layer?: string;
}) {
  const layerColors: Record<string, string> = {
    L1: "bg-blue-500/20 text-blue-300",
    L3: "bg-amber-500/20 text-amber-300",
    L5: "bg-emerald-500/20 text-emerald-300",
  };

  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 transition-all hover:bg-slate-800/80 hover:border-slate-600"
    >
      <div className="shrink-0 rounded-xl bg-slate-700/50 p-2.5 group-hover:bg-slate-700">
        <Icon className="h-5 w-5 text-slate-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-slate-200">{title}</p>
          {layer && (
            <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase ${layerColors[layer] ?? ""}`}>
              {layer}
            </span>
          )}
          {badge && (
            <span className="rounded px-1.5 py-px text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{description}</p>
      </div>
      <ArrowRight className="shrink-0 h-4 w-4 text-slate-600 group-hover:text-slate-400 mt-0.5 transition-colors" />
    </Link>
  );
}

// ─── Plan distribution bar ────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  FREE: "bg-slate-500",
  TRIAL: "bg-yellow-400",
  COACH_BASIC: "bg-blue-400",
  COACH_PRO: "bg-violet-400",
  CLUB_STANDARD: "bg-emerald-400",
  CLUB_PREMIUM: "bg-emerald-300",
};

function PlanBar({ summary }: { summary: UserSummary }) {
  const plans = Object.entries(summary.bySubscriptionPlan ?? {}).sort(
    ([, a], [, b]) => b - a
  );
  const total = summary.totalUsers || 1;

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
        {plans.map(([plan, count]) => (
          <div
            key={plan}
            className={`${PLAN_COLORS[plan] ?? "bg-slate-600"} transition-all`}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${plan}: ${count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {plans.map(([plan, count]) => (
          <div key={plan} className="flex items-center gap-1.5 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${PLAN_COLORS[plan] ?? "bg-slate-600"}`}
            />
            <span className="text-slate-400">{plan}</span>
            <span className="font-semibold text-slate-200">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Overview page ────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const [backendStatus, setBackendStatus] = useState<SystemStatus>("checking");
  const [dbStatus, setDbStatus] = useState<SystemStatus>("checking");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [userSummary, setUserSummary] = useState<UserSummary | null>(null);
  const [alerts, setAlerts] = useState<AccountAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Auth check ───────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored) { setHasAccess(false); return; }
      const user = JSON.parse(stored);
      setHasAccess(user?.adminRole === "SUPER_ADMIN");
    } catch {
      setHasAccess(false);
    }
  }, []);

  // ── System health check ──────────────────────────────────────────────────
  const checkHealth = useCallback(async () => {
    setBackendStatus("checking");
    setDbStatus("checking");
    try {
      const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      if (res.ok) {
        setBackendStatus("online");
        try {
          const statsRes = await fetch(`${API_BASE}/admin/stats`, {
            cache: "no-store",
            headers: getAdminHeaders(),
          });
          setDbStatus(statsRes.ok || statsRes.status === 401 ? "online" : "offline");
        } catch {
          setDbStatus("offline");
        }
      } else {
        setBackendStatus("offline");
        setDbStatus("offline");
      }
    } catch {
      setBackendStatus("offline");
      setDbStatus("offline");
    }
    setLastChecked(new Date());
  }, []);

  // ── Data fetch ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [statsData, summaryData, alertsData] = await Promise.allSettled([
        adminFetch<{ ok: boolean; stats: Stats }>("/admin/stats"),
        adminFetch<{ ok: boolean; summary: UserSummary }>("/admin/users/summary"),
        adminFetch<{ ok: boolean; alerts: AccountAlert[] }>("/admin/account-alerts?limit=5"),
      ]);

      if (statsData.status === "fulfilled" && statsData.value.ok) {
        setStats(statsData.value.stats);
      }
      if (summaryData.status === "fulfilled" && summaryData.value.ok) {
        const s = summaryData.value.summary;
        setUserSummary({
          totalUsers: s?.totalUsers ?? 0,
          byRole: s?.byRole ?? {},
          byAdminRole: s?.byAdminRole ?? {},
          bySubscriptionPlan: s?.bySubscriptionPlan ?? {},
          bySubscriptionStatus: s?.bySubscriptionStatus ?? {},
        });
      }
      if (alertsData.status === "fulfilled" && alertsData.value.ok) {
        setAlerts(alertsData.value.alerts ?? []);
      }
      const rejected = [statsData, summaryData, alertsData].find(
        (r): r is PromiseRejectedResult => r.status === "rejected"
      );
      if (rejected) {
        const message =
          rejected.reason instanceof Error
            ? rejected.reason.message
            : String(rejected.reason ?? "Unknown admin data fetch error");
        setFetchError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess === true) {
      checkHealth();
      fetchData();
    }
    if (hasAccess === false) setLoading(false);
  }, [hasAccess, checkHealth, fetchData]);

  // ── Access denied ─────────────────────────────────────────────────────────
  if (hasAccess === false) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-2xl border border-yellow-700/40 bg-yellow-900/20 p-8 text-center">
          <Shield className="mx-auto mb-4 h-10 w-10 text-yellow-400" />
          <h2 className="text-lg font-bold text-yellow-300">SUPER_ADMIN Required</h2>
          <p className="mt-2 text-sm text-slate-400">
            Your account does not have admin privileges to access this console.
          </p>
          <Link
            href="/vault"
            className="mt-6 inline-block rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Go to App
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-8">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Overview</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            System health, key metrics, and quick navigation
          </p>
        </div>
        <button
          onClick={() => { checkHealth(); fetchData(); }}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
      {fetchError && (
        <div className="rounded-xl border border-amber-600/40 bg-amber-900/20 px-4 py-3 text-xs text-amber-200">
          Some admin metrics failed to load: {fetchError}
        </div>
      )}

      {/* ── System status ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">System Status</h2>
          {lastChecked && (
            <span className="text-[11px] text-slate-600">
              checked {lastChecked.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              { label: "Backend API", status: backendStatus, sub: "port 4000" },
              { label: "Database", status: dbStatus, sub: "PostgreSQL" },
              {
                label: "AI Generation",
                status: (stats?.api.successRate ?? "0%") !== "0%" ? "online" : "checking",
                sub: `${stats?.api.successRate ?? "—"} success rate`,
              },
              {
                label: "Token Budget",
                status: "online" as SystemStatus,
                sub: `${stats?.tokens?.allTimeCost ?? "—"} all-time`,
              },
            ] as { label: string; status: SystemStatus; sub: string }[]
          ).map(({ label, status, sub }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-slate-700/40 bg-slate-800/50 px-3 py-2.5"
            >
              <StatusDot status={status} />
              <div>
                <p className="text-xs font-medium text-slate-300">{label}</p>
                <p className="text-[10px] text-slate-600">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-800/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <KpiCard
            label="Total Users"
            value={userSummary?.totalUsers ?? 0}
            icon={Users}
            color="blue"
          />
          <KpiCard
            label="Vault Sessions"
            value={stats?.database?.vaultSessions ?? 0}
            icon={Database}
            color="emerald"
          />
          <KpiCard
            label="Vault Drills"
            value={stats?.database?.vaultDrills ?? 0}
            icon={Database}
            color="emerald"
          />
          <KpiCard
            label="Total Series"
            value={stats?.database?.totalSeries ?? 0}
            icon={Activity}
            color="slate"
          />
          <KpiCard
            label="API Calls"
            value={stats?.api?.totalCalls ?? 0}
            sub={`${stats?.api?.successRate ?? "—"} success`}
            icon={Cpu}
            color="violet"
          />
          <KpiCard
            label="Failed Calls"
            value={stats?.api?.failedCalls ?? 0}
            icon={XCircle}
            color={stats?.api?.failedCalls ? "red" : "slate"}
          />
          <KpiCard
            label="All-Time AI Cost"
            value={fmtUsd(stats?.tokens?.allTimeCost)}
            sub={`${fmtTokenVolume(stats?.tokens?.allTimeTotal)} tokens`}
            icon={TrendingUp}
            color="amber"
          />
          <KpiCard
            label="Admin Roles"
            value={Object.values(userSummary?.byAdminRole ?? {}).filter((count) => count > 0).length}
            sub="active role types"
            icon={Shield}
            color="slate"
          />
        </div>
      )}

      {/* ── Users by plan + Alerts ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Plan distribution */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Users by Plan</h2>
            <Link href="/admin/users" className="text-xs text-emerald-400 hover:text-emerald-300">
              Manage →
            </Link>
          </div>
          {userSummary ? (
            <PlanBar summary={userSummary} />
          ) : (
            <div className="h-12 animate-pulse rounded-lg bg-slate-800/50" />
          )}

          {/* Plan table */}
          <div className="mt-4 divide-y divide-slate-800">
            {userSummary &&
              Object.entries(userSummary.bySubscriptionPlan ?? {})
                .sort(([, a], [, b]) => b - a)
                .map(([plan, count]) => (
                  <div
                    key={plan}
                    className="flex items-center justify-between py-1.5 text-xs"
                  >
                    <span className="text-slate-400">{plan}</span>
                    <span className="font-semibold text-slate-200">{count}</span>
                  </div>
                ))}
          </div>
        </div>

        {/* Account alerts */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Recent Alerts</h2>
            <span className="text-[11px] text-slate-600">Last 5</span>
          </div>
          {alerts.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-slate-700/30 bg-slate-800/30">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                No recent alerts
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-700/30 bg-slate-800/30 px-3 py-2.5"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-300">
                      {alert.userEmail ?? alert.userId}
                    </p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {alert.message}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-600">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Section navigation cards ─────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-400 uppercase tracking-wide">
          Admin Sections
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SectionCard
            href="/admin/users"
            icon={Users}
            title="User Management"
            description="Create, edit, block, and delete users. Set roles, coach levels, and subscription plans."
            layer="L1"
          />
          <SectionCard
            href="/admin/access"
            icon={Lock}
            title="Access Permissions"
            description="Granular session/vault/video rules by user or coach level. Override defaults."
            layer="L3"
          />
          <SectionCard
            href="/admin/clubs"
            icon={Building2}
            title="Club Management"
            description="Create clubs with join codes that unlock exclusive game models for enrolled members."
            layer="L5"
            badge="NEW"
          />
          <SectionCard
            href="/admin/analytics"
            icon={BarChart3}
            title="Analytics"
            description="Usage by plan, trial conversions, vault adoption, feature access, and limit hits."
          />
          <SectionCard
            href="/admin/content"
            icon={FileCheck}
            title="Content & QA"
            description="Review AI-generated sessions and drills, run QA scoring, and manage regeneration."
          />
          <SectionCard
            href="/admin/system"
            icon={Settings}
            title="System Tools"
            description="Bulk session generation, drill normalization, enrichment, and reference lookup."
          />
        </div>
      </div>

      {/* ── Permission layer reference ───────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-400 uppercase tracking-wide">
          Permission Architecture
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              id: "L1",
              title: "Identity",
              desc: "UserRole (FREE/COACH/CLUB/ADMIN/TRIAL), coachLevel, adminRole",
              color: "border-blue-500/20 bg-blue-500/5 text-blue-300",
            },
            {
              id: "L2",
              title: "Subscription",
              desc: "subscriptionPlan limits: sessionsPerMonth, canExportPDF, etc.",
              color: "border-violet-500/20 bg-violet-500/5 text-violet-300",
            },
            {
              id: "L3",
              title: "Access Rules",
              desc: "AccessPermission rows: user-specific or coach-level overrides",
              color: "border-amber-500/20 bg-amber-500/5 text-amber-300",
            },
            {
              id: "L4",
              title: "Admin Roles",
              desc: "SUPER_ADMIN / ADMIN / MODERATOR / SUPPORT permission matrix",
              color: "border-red-500/20 bg-red-500/5 text-red-300",
            },
            {
              id: "L5",
              title: "Club Code",
              desc: "Club → GameModelId mapping. Enroll via code or admin assign.",
              color: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
            },
          ].map(({ id, title, desc, color }) => (
            <div
              key={id}
              className={`rounded-xl border p-3 ${color.split(" ").slice(0, 2).join(" ")}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`rounded px-1.5 py-px text-[9px] font-bold uppercase ${color}`}
                >
                  {id}
                </span>
                <span className="text-xs font-semibold text-slate-300">{title}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
