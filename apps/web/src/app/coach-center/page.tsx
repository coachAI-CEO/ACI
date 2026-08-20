"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  MessageSquare,
  Sparkles,
  Users,
} from "lucide-react";
import { useCoachCenter } from "./_lib/CoachCenterContext";
import type { Recommendation, TeamSummary } from "./_lib/types";
import { authHeaders, MOMENT_LABELS, PHASE_LABELS, COACH_LEVEL_LABELS, PLAYER_LEVEL_LABELS } from "./_lib/utils";

function SectionCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
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
        <p className="text-sm font-semibold text-slate-200">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-600 group-hover:text-slate-400" />
    </Link>
  );
}

export default function CoachCenterOverviewPage() {
  const { access, selectedTeamId, selectedTeam, teams, canViewAllTeams, finishTeamSwitch } = useCoachCenter();
  const [overview, setOverview] = useState<{
    team: TeamSummary;
    upcoming: any[];
    nextMatch: any;
    recommendations: Recommendation[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (teamId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coach-center/teams/${teamId}/overview`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) setOverview(data);
      else setOverview(null);
    } finally {
      setLoading(false);
      finishTeamSwitch(teamId);
    }
  }, [finishTeamSwitch]);

  useEffect(() => {
    if (access === "allowed" && selectedTeamId) void load(selectedTeamId);
  }, [access, selectedTeamId, load]);

  const week = overview?.team.season?.currentWeek || selectedTeam?.season?.currentWeek;

  if (!teams.length) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900 p-8 text-center">
        <h1 className="text-xl font-semibold text-white">
          {canViewAllTeams ? "No teams yet" : "Assign your team"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {canViewAllTeams
            ? "Create or assign teams in Admin → Teams, then they will appear in this dropdown."
            : "Coach Center follows one team through the season — curriculum, calendar, chat, and game-day sheets."}
        </p>
        <Link
          href={canViewAllTeams ? "/admin/teams" : "/coach-center/team"}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white"
        >
          {canViewAllTeams ? "Open Admin Teams" : "Create your team"}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Overview</h1>
        <p className="mt-1 text-sm text-slate-400">
          Season workspace for {selectedTeam?.name || "your team"} — training this week, then game day.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Team",
            value: selectedTeam?.name || "—",
            detail: selectedTeam
              ? `${selectedTeam.ageGroup} · ${COACH_LEVEL_LABELS[selectedTeam.coachLevel] || selectedTeam.coachLevel || "Coach"} · ${PLAYER_LEVEL_LABELS[selectedTeam.playerLevel] || selectedTeam.playerLevel || "Players"}`
              : "Create a team",
          },
          {
            label: "Season week",
            value: selectedTeam?.season ? String(selectedTeam.season.currentWeekIndex) : "—",
            detail: week?.theme || (loading ? "Loading…" : "No curriculum yet"),
          },
          {
            label: "Upcoming sessions",
            value: String(overview?.upcoming?.length ?? "—"),
            detail: overview?.upcoming?.[0]?.session?.title || "Nothing scheduled",
          },
          {
            label: "Next match",
            value: overview?.nextMatch?.opponent || "—",
            detail: overview?.nextMatch
              ? new Date(overview.nextMatch.matchDate).toLocaleDateString()
              : "Prepare a game-day sheet",
          },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{card.label}</p>
            <p className="mt-2 truncate text-lg font-semibold text-white">{card.value}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{card.detail}</p>
          </div>
        ))}
      </div>

      {week ? (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">This week&apos;s curriculum</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{week.theme}</h2>
          <p className="mt-1 text-sm text-slate-300">
            {PHASE_LABELS[week.phase] || week.phase}
            {week.zone ? ` · ${week.zone.replace("_", " ").toLowerCase()}` : ""}
            {` · ${MOMENT_LABELS[week.moment] || week.moment}`}
          </p>
          <p className="mt-2 text-sm text-slate-400">{week.focus}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={overview?.team.generateHref || selectedTeam?.generateHref || "/demo/session"}
              className="inline-flex min-h-11 items-center rounded-md bg-sky-600 px-3 text-sm font-medium text-white"
            >
              Build this session
            </Link>
            <p className="w-full text-xs text-slate-500">
              Opens with {selectedTeam?.ageGroup}
              {selectedTeam?.coachLevel
                ? ` · ${COACH_LEVEL_LABELS[selectedTeam.coachLevel] || selectedTeam.coachLevel}`
                : ""}
              {selectedTeam?.playerLevel
                ? ` · ${PLAYER_LEVEL_LABELS[selectedTeam.playerLevel] || selectedTeam.playerLevel}`
                : ""}
            </p>
            <Link
              href="/coach-center/next-sessions"
              className="inline-flex min-h-11 items-center rounded-md border border-slate-600 px-3 text-sm text-slate-200"
            >
              See recommendations
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <SectionCard
          href="/coach-center/team"
          icon={Users}
          title="Team"
          description="The side you are assigned to, age group, and game model."
        />
        <SectionCard
          href="/coach-center/curriculum"
          icon={BookOpen}
          title="Curriculum"
          description="16-week season plan across the four moments of the game."
        />
        <SectionCard
          href="/coach-center/calendar"
          icon={CalendarDays}
          title="Calendar"
          description="This week's training and what is already on your schedule."
        />
        <SectionCard
          href="/coach-center/chat"
          icon={MessageSquare}
          title="Season chat"
          description="Talk about the team, last session, and what comes next."
        />
        <SectionCard
          href="/coach-center/next-sessions"
          icon={Sparkles}
          title="Next sessions"
          description="Vault matches and a generate link for this week's theme."
        />
        <SectionCard
          href="/coach-center/game-day"
          icon={ClipboardList}
          title="Game day"
          description="Prepare the match sheet: focus, DNA, and set pieces."
        />
      </div>
    </div>
  );
}
