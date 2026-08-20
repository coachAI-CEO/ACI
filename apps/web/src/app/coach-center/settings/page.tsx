"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCoachCenter, useFinishTeamSwitch } from "../_lib/CoachCenterContext";
import {
  authHeaders,
  btnPrimary,
  COACH_LEVEL_LABELS,
  PLAYER_LEVEL_LABELS,
  TEAM_BAND_LABELS,
} from "../_lib/utils";

const LEVEL_OPTIONS = [
  { value: "AUTO", label: "Auto from team name" },
  { value: "BEGINNER", label: "Beginner · D license" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];

export default function CoachCenterSettingsPage() {
  const { selectedTeam, refresh } = useCoachCenter();
  useFinishTeamSwitch(true);
  const [playerLevel, setPlayerLevel] = useState("AUTO");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPlayerLevel(selectedTeam?.playerLevelOverride || "AUTO");
    setSaved(false);
  }, [selectedTeam?.id, selectedTeam?.playerLevelOverride]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeam) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/coach-center/teams/${selectedTeam.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ playerLevel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.message || data?.error || "Could not save settings");
      await refresh();
      setSaved(true);
    } catch (err: any) {
      setError(err?.message || "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  if (!selectedTeam) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900 p-8 text-center">
        <h1 className="text-lg font-semibold text-white">Pick a team first</h1>
        <Link
          href="/coach-center/team"
          className="mt-6 inline-flex min-h-11 items-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white"
        >
          Open Team
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Player level drives the curriculum. Coach level changes how the week is coached.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Current players",
            value: PLAYER_LEVEL_LABELS[selectedTeam.playerLevel] || selectedTeam.playerLevel,
            detail: selectedTeam.audienceSource === "override" ? "Manual override" : "From team name",
          },
          {
            label: "Current coach track",
            value: COACH_LEVEL_LABELS[selectedTeam.coachLevel] || selectedTeam.coachLevel,
            detail: selectedTeam.playerLevel === "BEGINNER" ? "Locked to D for beginner sides" : "Assigned coach license",
          },
          {
            label: "Name band",
            value: TEAM_BAND_LABELS[selectedTeam.band] || selectedTeam.band,
            detail: selectedTeam.name,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-800/70 to-slate-900/40 p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{card.label}</p>
            <p className="mt-2 text-lg font-semibold text-white">{card.value}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{card.detail}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold text-white">How team names map</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li>
            <span className="font-medium text-sky-200">NPL / ECRL</span>
            <span className="text-slate-500"> — Advanced players. Coach license follows the assigned coach.</span>
          </li>
          <li>
            <span className="font-medium text-sky-200">Navy / Pre-NPL</span>
            <span className="text-slate-500"> — Intermediate players. Coach license follows the assigned coach.</span>
          </li>
          <li>
            <span className="font-medium text-sky-200">White / Grey / other</span>
            <span className="text-slate-500"> — Beginner players on a D-license curriculum.</span>
          </li>
        </ul>
      </section>

      <form
        onSubmit={save}
        className="max-w-xl space-y-4 rounded-2xl border border-slate-700/50 bg-slate-900/70 p-5"
      >
        <h2 className="text-sm font-semibold text-white">Player level for {selectedTeam.name}</h2>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {saved ? <p className="text-sm text-emerald-300">Saved. Curriculum updates immediately.</p> : null}
        <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
          Player level
          <select
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500/60"
            value={playerLevel}
            onChange={(e) => setPlayerLevel(e.target.value)}
          >
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-500">
          Auto keeps NPL as Advanced, Navy as Intermediate, and White/Grey as D + Beginner. Override only if this
          side is an exception.
        </p>
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
