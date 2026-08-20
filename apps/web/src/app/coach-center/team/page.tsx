"use client";

import { useState } from "react";
import Link from "next/link";
import { GAME_MODEL_OPTIONS } from "@/lib/game-model-scope";
import { useCoachCenter } from "../_lib/CoachCenterContext";
import { authHeaders, btnPrimary, COACH_LEVEL_LABELS, PLAYER_LEVEL_LABELS } from "../_lib/utils";

const AGE_GROUPS = ["U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18"];

export default function CoachCenterTeamPage() {
  const { teams, clubs, selectedTeam, refresh, setSelectedTeamId } = useCoachCenter();
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState(selectedTeam?.ageGroup || "U12");
  const [gameModelId, setGameModelId] = useState(clubs[0]?.gameModelId || "COACHAI");
  const [clubId, setClubId] = useState(clubs[0]?.clubId || "");
  const [seasonLabel, setSeasonLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockedModel = Boolean(clubId);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/coach-center/teams", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ageGroup,
          gameModelId: lockedModel ? undefined : gameModelId,
          clubId: clubId || null,
          seasonLabel: seasonLabel || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.message || data?.error || "Could not create team");
        return;
      }
      setName("");
      await refresh();
      if (data.team?.id) setSelectedTeamId(data.team.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Team</h1>
        <p className="mt-1 text-sm text-slate-400">
          The side you are assigned to. Club teams inherit the locked game model from DOC Console.
        </p>
      </div>

      {selectedTeam ? (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assigned team</p>
          <h2 className="mt-1 text-xl font-semibold text-white">{selectedTeam.name}</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Age group", selectedTeam.ageGroup],
              ["Game model", selectedTeam.gameModelLabel],
              ["Coach level", COACH_LEVEL_LABELS[selectedTeam.coachLevel] || selectedTeam.coachLevel || "—"],
              ["Player level", PLAYER_LEVEL_LABELS[selectedTeam.playerLevel] || selectedTeam.playerLevel || "—"],
              ["Club", selectedTeam.clubName || "Independent"],
              ["Season", selectedTeam.seasonLabel || selectedTeam.season?.name || "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
                <dd className="mt-0.5 text-sm text-slate-200">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Staff</p>
            <ul className="mt-1 space-y-1 text-sm text-slate-300">
              {selectedTeam.coaches.map((c) => (
                <li key={c.userId}>
                  {c.name} · {c.role === "HEAD" ? "Head coach" : "Assistant"}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Player level is set from the team name (NPL, Navy, White/Grey). Override it in{" "}
            <Link href="/coach-center/settings" className="text-sky-300 hover:text-sky-200">
              Settings
            </Link>
            .
          </p>
        </div>
      ) : null}

      {teams.length > 1 ? (
        <p className="text-xs text-slate-500">
          You have {teams.length} teams. Switch from the sidebar to follow a different season.
        </p>
      ) : null}

      <form onSubmit={createTeam} className="max-w-xl space-y-4 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
        <h2 className="text-sm font-semibold text-white">
          {teams.length ? "Add another team" : "Create the team you coach"}
        </h2>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <label className="block text-sm">
          <span className="text-slate-400">Team name</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="U14 Girls Blue"
            required
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-400">Age group</span>
            <select
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
            >
              {AGE_GROUPS.map((age) => (
                <option key={age} value={age}>
                  {age}
                </option>
              ))}
            </select>
          </label>
          {clubs.length > 0 ? (
            <label className="block text-sm">
              <span className="text-slate-400">Club</span>
              <select
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
              >
                <option value="">Independent</option>
                {clubs.map((c) => (
                  <option key={c.clubId} value={c.clubId}>
                    {c.clubName}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block text-sm">
              <span className="text-slate-400">Game model</span>
              <select
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={gameModelId}
                onChange={(e) => setGameModelId(e.target.value)}
                disabled={lockedModel}
              >
                {GAME_MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {!lockedModel && clubs.length > 0 ? (
          <label className="block text-sm">
            <span className="text-slate-400">Game model</span>
            <select
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              value={gameModelId}
              onChange={(e) => setGameModelId(e.target.value)}
            >
              {GAME_MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block text-sm">
          <span className="text-slate-400">Season label</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={seasonLabel}
            onChange={(e) => setSeasonLabel(e.target.value)}
            placeholder="2026 Fall"
          />
        </label>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Saving…" : "Create team"}
        </button>
      </form>
    </div>
  );
}
