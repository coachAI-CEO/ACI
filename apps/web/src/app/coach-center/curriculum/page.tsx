"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CurriculumWeek, Recommendation, TeamSummary } from "../_lib/types";
import { useCoachCenter } from "../_lib/CoachCenterContext";
import {
  authHeaders,
  COACH_LEVEL_LABELS,
  MOMENT_LABELS,
  PHASE_LABELS,
  PLAYER_LEVEL_LABELS,
  ZONE_LABELS,
} from "../_lib/utils";

export default function CoachCenterCurriculumPage() {
  const { selectedTeam, selectedTeamId, access } = useCoachCenter();
  const weeks = useMemo(
    () => [...(selectedTeam?.season?.weeks || [])].sort((a, b) => a.weekIndex - b.weekIndex),
    [selectedTeam?.season?.weeks]
  );
  const current = selectedTeam?.season?.currentWeekIndex;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [vault, setVault] = useState<Recommendation[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);

  const selected =
    weeks.find((week) => week.weekIndex === (selectedIndex ?? current ?? weeks[0]?.weekIndex)) || weeks[0] || null;

  useEffect(() => {
    if (current) setSelectedIndex(current);
    else if (weeks[0]) setSelectedIndex(weeks[0].weekIndex);
  }, [selectedTeam?.id, current, weeks]);

  const loadVault = useCallback(async (teamId: string, weekIndex: number) => {
    setVaultLoading(true);
    try {
      const res = await fetch(
        `/api/coach-center/teams/${teamId}/recommendations?weekIndex=${weekIndex}`,
        { headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      setVault(res.ok && data?.ok ? data.recommendations || [] : []);
    } finally {
      setVaultLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedTeamId && selected?.weekIndex) {
      void loadVault(selectedTeamId, selected.weekIndex);
    }
  }, [access, selectedTeamId, selected?.weekIndex, loadVault]);

  if (!selectedTeam) {
    return <EmptyTeam title="Curriculum follows the team you coach" href="/coach-center/team" />;
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Curriculum</h1>
        <p className="mt-1 text-sm text-slate-400">
          Pick a week, then use the plan written for {selectedTeam.name} · {selectedTeam.ageGroup} ·{" "}
          {PLAYER_LEVEL_LABELS[selectedTeam.playerLevel] || selectedTeam.playerLevel}.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-900/90 to-slate-950/80">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Season weeks</p>
            <p className="mt-0.5 text-xs text-slate-500">{weeks.length} topics</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {weeks.map((week) => {
              const isSelected = week.weekIndex === selected?.weekIndex;
              const isCurrent = week.weekIndex === current;
              return (
                <button
                  key={week.id}
                  type="button"
                  onClick={() => setSelectedIndex(week.weekIndex)}
                  className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? "border border-sky-500/30 bg-sky-500/10"
                      : "border border-transparent hover:bg-slate-800/70"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Week {week.weekIndex}
                    {isCurrent ? " · now" : ""}
                  </p>
                  <p className={`mt-0.5 text-sm font-medium ${isSelected ? "text-white" : "text-slate-200"}`}>
                    {week.theme}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-900/90 to-slate-950/80">
          {selected ? (
            <WeekDetail team={selectedTeam} week={selected} vault={vault} vaultLoading={vaultLoading} />
          ) : (
            <p className="p-6 text-sm text-slate-400">No curriculum weeks yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function WeekDetail({
  team,
  week,
  vault,
  vaultLoading,
}: {
  team: TeamSummary;
  week: CurriculumWeek;
  vault: Recommendation[];
  vaultLoading: boolean;
}) {
  const knowledge = week.knowledge;
  const href = weekHref(team, week);

  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
            Week {week.weekIndex} topic
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">{week.theme}</h2>
          <p className="mt-2 text-sm text-slate-300">{week.focus}</p>
        </div>
        <Link
          href={href}
          className="inline-flex h-9 items-center rounded-lg bg-sky-600 px-3 text-sm font-medium text-white"
        >
          Build this session
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-wide">
        <Chip>{team.ageGroup}</Chip>
        <Chip>{PLAYER_LEVEL_LABELS[team.playerLevel] || team.playerLevel}</Chip>
        <Chip>{COACH_LEVEL_LABELS[team.coachLevel] || team.coachLevel}</Chip>
        {knowledge?.format ? <Chip>{knowledge.format}</Chip> : null}
        <Chip>{MOMENT_LABELS[week.moment] || week.moment}</Chip>
        <Chip>{PHASE_LABELS[week.phase] || week.phase}</Chip>
        {week.zone ? <Chip>{ZONE_LABELS[week.zone] || week.zone}</Chip> : null}
      </div>

      {knowledge ? (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
            For {knowledge.audienceLabel}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{knowledge.why}</p>
        </div>
      ) : null}

      {week.notes ? <p className="text-sm text-slate-400">{week.notes}</p> : null}

      {knowledge?.constraints?.length ? (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">This week’s constraints</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {knowledge.constraints.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-300"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {knowledge?.ideas?.length ? (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Session breakdown
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Four parts that fit {team.ageGroup} {PLAYER_LEVEL_LABELS[team.playerLevel] || "players"} on this topic.
          </p>
          <div className="mt-3 space-y-2">
            {knowledge.ideas.map((idea) => (
              <div key={idea.slot} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300/80">{idea.slot}</p>
                <p className="mt-1 text-sm font-semibold text-white">{idea.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{idea.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Vault sessions that can work this week
        </h3>
        {vaultLoading ? <p className="mt-2 text-sm text-slate-500">Searching the vault…</p> : null}
        <div className="mt-3 space-y-2">
          {vault.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4"
            >
              <div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {item.refCode || "Vault"} · {item.ageGroup}
                  {item.durationMin ? ` · ${item.durationMin} min` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-500">{item.matchReason}</p>
              </div>
              <Link
                href={item.href}
                className="shrink-0 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                Open
              </Link>
            </div>
          ))}
          {!vaultLoading && vault.length === 0 ? (
            <p className="text-sm text-slate-500">
              No saved vault match yet. Build a fresh session for this week and save it.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-slate-400">{children}</span>
  );
}

function weekHref(team: TeamSummary, week: CurriculumWeek) {
  if (week.generateHref) return week.generateHref;
  const search = new URLSearchParams({
    ageGroup: team.ageGroup,
    gameModelId: team.gameModelId,
    coachLevel: team.coachLevel,
    playerLevel: team.playerLevel,
  });
  if (week.phase) search.set("phase", week.phase);
  if (week.zone) search.set("zone", week.zone);
  if (week.theme) search.set("topic", week.theme);
  return `/demo/session?${search.toString()}`;
}

function EmptyTeam({ title, href }: { title: string; href: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900 p-8 text-center">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <Link href={href} className="mt-6 inline-flex min-h-11 items-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white">
        Create your team
      </Link>
    </div>
  );
}
