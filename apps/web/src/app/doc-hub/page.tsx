"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Compass,
  Trophy,
  Users,
} from "lucide-react";
import { useDocHub } from "./_lib/DocHubContext";
import type { AttentionSummary, UsageSummary } from "./_lib/types";
import { authHeaders, mondayWeekStartIso } from "./_lib/utils";

function SectionCard({
  href,
  icon: Icon,
  title,
  description,
  badge,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 transition-all hover:border-slate-600 hover:bg-slate-800/80"
    >
      <div className="shrink-0 rounded-xl bg-slate-700/50 p-2.5 group-hover:bg-slate-700">
        <Icon className="h-5 w-5 text-slate-300" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-200">{title}</p>
          {badge ? (
            <span className="rounded px-1.5 py-px text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-600 transition-colors group-hover:text-slate-400" />
    </Link>
  );
}

export default function DocHubOverviewPage() {
  const { access, selectedClubId, selectedClub } = useDocHub();
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [attentionSummary, setAttentionSummary] = useState<AttentionSummary | null>(null);
  const [highAttention, setHighAttention] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (clubId: string) => {
    setLoading(true);
    try {
      const week = mondayWeekStartIso();
      const [usageRes, attentionRes] = await Promise.all([
        fetch(`/api/doc-hub/clubs/${clubId}/coaches/usage?days=7`, { headers: authHeaders() }),
        fetch(`/api/doc-hub/clubs/${clubId}/attention?weekStart=${week}`, {
          headers: authHeaders(),
        }),
      ]);
      const usageData = await usageRes.json().catch(() => ({}));
      const attentionData = await attentionRes.json().catch(() => ({}));
      if (usageRes.ok && usageData?.ok) setUsageSummary(usageData.summary || null);
      else setUsageSummary(null);
      if (attentionRes.ok && attentionData?.ok) {
        setAttentionSummary(attentionData.summary || null);
        const high = (attentionData.items || []).filter(
          (i: { severity?: string }) => i.severity === "high"
        ).length;
        setHighAttention(high);
      } else {
        setAttentionSummary(null);
        setHighAttention(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) void load(selectedClubId);
  }, [access, selectedClubId, load]);

  const managed =
    attentionSummary?.coachesManaged ?? usageSummary?.coachesManaged ?? null;
  const active = attentionSummary?.activeCoaches ?? usageSummary?.activeCoaches ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Overview</h1>
        <p className="mt-1 text-sm text-slate-400">
          Club oversight for {selectedClub?.clubName || "your club"} — jump into the workspace you
          need.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Coaches Managed",
            value: managed == null ? "—" : String(managed),
            detail: usageSummary
              ? `${usageSummary.inactiveThisWeek} inactive this week`
              : loading
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
            detail: "Coaches with no Mon–today sessions",
          },
          {
            label: "Active Coaches",
            value: managed == null || active == null ? "—" : `${active}/${managed}`,
            detail: "Last 7 days with ≥1 session",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className="mt-1.5 text-2xl font-bold text-slate-100">{stat.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{stat.detail}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Workspaces
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <SectionCard
            href="/doc-hub/attention"
            icon={AlertTriangle}
            title="Attention"
            description={
              highAttention > 0
                ? `${highAttention} high-priority alert${highAttention === 1 ? "" : "s"} need a look`
                : "Who’s dark or has an empty week"
            }
            badge={highAttention > 0 ? `${highAttention} high` : undefined}
          />
          <SectionCard
            href="/doc-hub/coaches"
            icon={Users}
            title="Coaches"
            description="Assign one or more teams to each coach"
          />
          <SectionCard
            href="/doc-hub/teams"
            icon={Trophy}
            title="Teams"
            description="Club roster and who is assigned to each side"
          />
          <SectionCard
            href="/doc-hub/calendar"
            icon={CalendarDays}
            title="Calendar"
            description="Weekly coverage, assign vault sessions, reassign coverage"
          />
          <SectionCard
            href="/doc-hub/game-model"
            icon={Compass}
            title="Game Model"
            description="Locked club model + 4-moment DNA with AI writing assist"
            badge="Engine"
          />
        </div>
      </div>
    </div>
  );
}
