"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCoachCenter } from "../_lib/CoachCenterContext";
import type { Recommendation } from "../_lib/types";
import { authHeaders, COACH_LEVEL_LABELS, PLAYER_LEVEL_LABELS } from "../_lib/utils";

export default function CoachCenterNextSessionsPage() {
  const { selectedTeam, selectedTeamId, access, finishTeamSwitch } = useCoachCenter();
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (teamId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coach-center/teams/${teamId}/recommendations`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) setItems(data.recommendations || []);
      else setItems([]);
    } finally {
      setLoading(false);
      finishTeamSwitch(teamId);
    }
  }, [finishTeamSwitch]);

  useEffect(() => {
    if (access === "allowed" && selectedTeamId) void load(selectedTeamId);
  }, [access, selectedTeamId, load]);

  if (!selectedTeam) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900 p-8 text-center">
        <h1 className="text-lg font-semibold text-white">Recommendations need a team</h1>
        <Link href="/coach-center/team" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white">
          Create your team
        </Link>
      </div>
    );
  }

  const week = selectedTeam.season?.currentWeek;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Next sessions</h1>
        <p className="mt-1 text-sm text-slate-400">
          {week
            ? `Vault matches for week ${selectedTeam.season?.currentWeekIndex}: ${week.theme}.`
            : "Vault matches for this team’s age group and game model."}
        </p>
      </div>

      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-5">
        <p className="text-sm text-slate-200">
          Generate a fresh session from this week&apos;s curriculum. The builder opens with this team&apos;s age group, coach level, and player level.
        </p>
        <Link
          href={selectedTeam.generateHref}
          className="mt-3 inline-flex min-h-11 items-center rounded-md bg-sky-600 px-3 text-sm font-medium text-white"
        >
          Generate this week&apos;s session
        </Link>
        <p className="mt-2 text-xs text-sky-200/70">
          {selectedTeam.ageGroup}
          {selectedTeam.coachLevel
            ? ` · ${COACH_LEVEL_LABELS[selectedTeam.coachLevel] || selectedTeam.coachLevel}`
            : ""}
          {selectedTeam.playerLevel
            ? ` · ${PLAYER_LEVEL_LABELS[selectedTeam.playerLevel] || selectedTeam.playerLevel}`
            : ""}
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-500">Searching the vault…</p> : null}

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
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
              className="shrink-0 rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200"
            >
              Open
            </Link>
          </div>
        ))}
        {!loading && items.length === 0 ? (
          <p className="text-sm text-slate-500">No vault matches yet. Generate this week&apos;s session above.</p>
        ) : null}
      </div>
    </div>
  );
}
