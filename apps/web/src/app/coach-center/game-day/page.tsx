"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MatchRecapSheet } from "../_lib/MatchRecapSheet";
import { useCoachCenter } from "../_lib/CoachCenterContext";
import type { MatchRecap, RecapPair, StatKey } from "../_lib/match-recap";
import { STAT_ROWS, parseMatchRecap, showcaseRecap } from "../_lib/match-recap";
import type { GameDayItem } from "../_lib/types";
import { authHeaders, btnPrimary, btnPrimarySm, btnSecondarySm } from "../_lib/utils";

type MatchForm = {
  matchDate: string;
  opponent: string;
  venue: string;
  competition: string;
  kickoffTime: string;
  formation: string;
  keyFocus: string;
};

const SAMPLE_DATE = "2025-07-24";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateInputValue(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

const fieldClass =
  "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100";
const labelClass = "text-xs text-slate-400";

function PairFields({
  items,
  onChange,
  titlePlaceholder,
}: {
  items: RecapPair[];
  onChange: (next: RecapPair[]) => void;
  titlePlaceholder: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-5">
          <input
            className={`${fieldClass} sm:col-span-2`}
            value={item.title}
            placeholder={titlePlaceholder}
            onChange={(e) => {
              const next = items.slice();
              next[i] = { ...item, title: e.target.value };
              onChange(next);
            }}
          />
          <input
            className={`${fieldClass} sm:col-span-3`}
            value={item.body}
            placeholder="One sentence"
            onChange={(e) => {
              const next = items.slice();
              next[i] = { ...item, body: e.target.value };
              onChange(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function CoachCenterGameDayPage() {
  const { selectedTeam, selectedTeamId, access } = useCoachCenter();
  const [items, setItems] = useState<GameDayItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"recap" | "prepare">("recap");
  const [form, setForm] = useState<MatchForm>({
    matchDate: SAMPLE_DATE,
    opponent: "Davis Legacy",
    venue: "Davis, CA",
    competition: "Davis Legacy College Showcase",
    kickoffTime: "",
    formation: "",
    keyFocus: "",
  });
  const [recap, setRecap] = useState<MatchRecap>(() =>
    showcaseRecap({ opponent: "Davis Legacy" })
  );

  const load = useCallback(async (teamId: string) => {
    const res = await fetch(`/api/coach-center/teams/${teamId}/game-days`, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) setItems(data.items || []);
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedTeamId) void load(selectedTeamId);
  }, [access, selectedTeamId, load]);

  const liveRecap = useMemo(() => {
    const parsed = parseMatchRecap({ ...recap, opponentLabel: form.opponent || recap.opponentLabel });
    return parsed || recap;
  }, [recap, form.opponent]);

  function loadShowcase() {
    setEditingId(null);
    setForm({
      matchDate: SAMPLE_DATE,
      opponent: "Davis Legacy",
      venue: "Davis, CA",
      competition: "Davis Legacy College Showcase",
      kickoffTime: "",
      formation: "",
      keyFocus: "",
    });
    setRecap(showcaseRecap({ opponent: "Davis Legacy" }));
    setMode("recap");
  }

  function loadItem(item: GameDayItem) {
    setEditingId(item.id);
    setForm({
      matchDate: dateInputValue(item.matchDate),
      opponent: item.opponent || "",
      venue: item.venue || "",
      competition: item.competition || "",
      kickoffTime: item.kickoffTime || "",
      formation: item.formation || "",
      keyFocus: item.keyFocus || "",
    });
    setRecap(item.recap || showcaseRecap({ opponent: item.opponent || "Opponent" }));
    setMode(item.recap ? "recap" : "prepare");
  }

  function newBlank() {
    setEditingId(null);
    setForm({
      matchDate: todayIso(),
      opponent: "",
      venue: "",
      competition: "",
      kickoffTime: "",
      formation: "",
      keyFocus: "",
    });
    setRecap({
      ...showcaseRecap({ opponent: "Opponent" }),
      usScore: 0,
      themScore: 0,
      caption: "",
      headline: "Match recap",
      summary: "",
      location: "",
    });
    setMode("recap");
  }

  async function saveRecap(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeamId) return;
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      recap: { ...liveRecap, opponentLabel: form.opponent || "Opponent", location: recap.location || form.venue },
    };
    try {
      const url = editingId
        ? `/api/coach-center/teams/${selectedTeamId}/game-days/${editingId}`
        : `/api/coach-center/teams/${selectedTeamId}/game-days`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.message || data?.error || "Could not save match recap");
        return;
      }
      if (data.item?.id) setEditingId(data.item.id);
      await load(selectedTeamId);
    } finally {
      setSaving(false);
    }
  }

  async function createPrepare(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeamId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach-center/teams/${selectedTeamId}/game-days`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.message || data?.error || "Could not create game-day sheet");
        return;
      }
      await load(selectedTeamId);
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf(id: string) {
    const token = localStorage.getItem("accessToken");
    const res = await fetch(`/api/coach-center/teams/${selectedTeamId}/game-days/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `match-recap-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function setStat(key: StatKey, side: "us" | "them", value: string) {
    const n = Number(value);
    setRecap((current) => ({
      ...current,
      stats: {
        ...current.stats,
        [key]: { ...current.stats[key], [side]: Number.isFinite(n) ? n : 0 },
      },
    }));
  }

  if (!selectedTeam) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-700/60 bg-slate-900 p-8 text-center">
        <h1 className="text-lg font-semibold text-white">Game-day sheets need a team</h1>
        <Link href="/coach-center/team" className="mt-6 inline-flex min-h-11 items-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white">
          Create your team
        </Link>
      </div>
    );
  }

  const clubName = selectedTeam.clubName || selectedTeam.name;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Game day</h1>
          <p className="mt-1 text-sm text-slate-400">
            Family-facing match recap for {selectedTeam.name}. Edit on the left — the sheet updates live.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={mode === "recap" ? btnPrimarySm : btnSecondarySm} onClick={() => setMode("recap")}>
            Match recap
          </button>
          <button type="button" className={mode === "prepare" ? btnPrimarySm : btnSecondarySm} onClick={() => setMode("prepare")}>
            Pre-match sheet
          </button>
        </div>
      </div>

      {mode === "recap" ? (
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recap editor</p>
              <div className="flex gap-1.5">
                <button type="button" className={btnSecondarySm} onClick={loadShowcase}>
                  Load sample
                </button>
                <button type="button" className={btnSecondarySm} onClick={newBlank}>
                  New
                </button>
              </div>
            </div>

            <form onSubmit={saveRecap} className="min-h-0 flex-1 overflow-y-auto p-4">
              {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}

              {items.length > 0 ? (
                <div className="mb-4 space-y-1.5">
                  <p className={labelClass}>Saved sheets</p>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                        editingId === item.id
                          ? "border-sky-500/40 bg-sky-500/10 text-sky-100"
                          : "border-slate-700 bg-slate-950 text-slate-300"
                      }`}
                    >
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => loadItem(item)}>
                        vs {item.opponent || "TBD"} · {new Date(item.matchDate).toLocaleDateString()}
                        {item.recap ? ` · ${item.recap.usScore}–${item.recap.themScore}` : ""}
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-[10px] uppercase tracking-wide text-slate-500 hover:text-slate-200"
                        onClick={() => void downloadPdf(item.id)}
                      >
                        PDF
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <label className={`${labelClass} col-span-2 sm:col-span-1`}>
                  Match date
                  <input
                    type="date"
                    required
                    className={fieldClass}
                    value={form.matchDate}
                    onChange={(e) => setForm((f) => ({ ...f, matchDate: e.target.value }))}
                  />
                </label>
                <label className={labelClass}>
                  Score
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      className={fieldClass}
                      value={recap.usScore}
                      onChange={(e) => setRecap((r) => ({ ...r, usScore: Number(e.target.value) || 0 }))}
                    />
                    <span className="text-slate-500">–</span>
                    <input
                      type="number"
                      className={fieldClass}
                      value={recap.themScore}
                      onChange={(e) => setRecap((r) => ({ ...r, themScore: Number(e.target.value) || 0 }))}
                    />
                  </div>
                </label>
                <label className={`${labelClass} col-span-2`}>
                  Opponent
                  <input
                    className={fieldClass}
                    value={form.opponent}
                    onChange={(e) => setForm((f) => ({ ...f, opponent: e.target.value }))}
                    placeholder="Davis Legacy"
                  />
                </label>
                <label className={labelClass}>
                  Competition
                  <input
                    className={fieldClass}
                    value={form.competition}
                    onChange={(e) => setForm((f) => ({ ...f, competition: e.target.value }))}
                  />
                </label>
                <label className={labelClass}>
                  Caption
                  <input
                    className={fieldClass}
                    value={recap.caption}
                    onChange={(e) => setRecap((r) => ({ ...r, caption: e.target.value }))}
                    placeholder="Our first official match"
                  />
                </label>
                <label className={labelClass}>
                  Location
                  <input
                    className={fieldClass}
                    value={recap.location}
                    onChange={(e) => setRecap((r) => ({ ...r, location: e.target.value }))}
                  />
                </label>
                <label className={labelClass}>
                  Venue
                  <input
                    className={fieldClass}
                    value={form.venue}
                    onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                  />
                </label>
              </div>

              <label className={`${labelClass} mt-3 block`}>
                Headline
                <input
                  className={fieldClass}
                  value={recap.headline}
                  onChange={(e) => setRecap((r) => ({ ...r, headline: e.target.value }))}
                />
              </label>
              <label className={`${labelClass} mt-3 block`}>
                Summary
                <textarea
                  rows={4}
                  className={fieldClass}
                  value={recap.summary}
                  onChange={(e) => setRecap((r) => ({ ...r, summary: e.target.value }))}
                />
              </label>

              <details className="mt-4 rounded-xl border border-slate-800 p-3" open>
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Four pillars
                </summary>
                <div className="mt-3">
                  <PairFields items={recap.pillars} onChange={(pillars) => setRecap((r) => ({ ...r, pillars }))} titlePlaceholder="Pillar" />
                </div>
              </details>

              <details className="mt-3 rounded-xl border border-slate-800 p-3" open>
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Match stats
                </summary>
                <div className="mt-3 space-y-1.5">
                  <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                    <span>Stat</span>
                    <span className="text-center">Us</span>
                    <span className="text-center">Them</span>
                  </div>
                  {STAT_ROWS.map((row) => (
                    <div key={row.key} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2">
                      <span className="text-xs text-slate-300">{row.label}</span>
                      <input
                        type="number"
                        className={fieldClass}
                        value={recap.stats[row.key].us}
                        onChange={(e) => setStat(row.key, "us", e.target.value)}
                      />
                      <input
                        type="number"
                        className={fieldClass}
                        value={recap.stats[row.key].them}
                        onChange={(e) => setStat(row.key, "them", e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </details>

              <details className="mt-3 rounded-xl border border-slate-800 p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Takeaways & close
                </summary>
                <div className="mt-3 space-y-3">
                  <PairFields
                    items={recap.takeaways}
                    onChange={(takeaways) => setRecap((r) => ({ ...r, takeaways }))}
                    titlePlaceholder="Takeaway"
                  />
                  <label className={`${labelClass} block`}>
                    Next up (one per line)
                    <textarea
                      rows={3}
                      className={fieldClass}
                      value={recap.nextUp.join("\n")}
                      onChange={(e) =>
                        setRecap((r) => ({ ...r, nextUp: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean) }))
                      }
                    />
                  </label>
                  <label className={`${labelClass} block`}>
                    Proud of
                    <input
                      className={fieldClass}
                      value={recap.proudOf}
                      onChange={(e) => setRecap((r) => ({ ...r, proudOf: e.target.value }))}
                    />
                  </label>
                  <label className={`${labelClass} block`}>
                    Keep building
                    <input
                      className={fieldClass}
                      value={recap.keepBuilding}
                      onChange={(e) => setRecap((r) => ({ ...r, keepBuilding: e.target.value }))}
                    />
                  </label>
                  <PairFields
                    items={recap.meaning}
                    onChange={(meaning) => setRecap((r) => ({ ...r, meaning }))}
                    titlePlaceholder="Meaning"
                  />
                  <label className={`${labelClass} block`}>
                    Thank you
                    <input
                      className={fieldClass}
                      value={recap.thankYou}
                      onChange={(e) => setRecap((r) => ({ ...r, thankYou: e.target.value }))}
                    />
                  </label>
                </div>
              </details>

              <div className="sticky bottom-0 mt-4 flex gap-2 bg-slate-900/95 py-3">
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving ? "Saving…" : editingId ? "Update recap" : "Save recap"}
                </button>
                {editingId ? (
                  <button type="button" className={btnSecondarySm} onClick={() => void downloadPdf(editingId)}>
                    Download PDF
                  </button>
                ) : null}
              </div>
            </form>
          </aside>

          <div className="min-h-0 overflow-y-auto rounded-2xl border border-slate-700/40 bg-slate-950/40 p-3 sm:p-5">
            <MatchRecapSheet
              recap={liveRecap}
              clubName={clubName}
              teamName={selectedTeam.name}
              ageGroup={selectedTeam.ageGroup}
              competition={form.competition}
              matchDate={form.matchDate}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <form onSubmit={createPrepare} className="grid gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 md:grid-cols-2">
            <h2 className="text-sm font-semibold text-white md:col-span-2">Prepare next match</h2>
            {error ? <p className="text-sm text-rose-300 md:col-span-2">{error}</p> : null}
            <label className="text-sm text-slate-400">
              Match date
              <input
                type="date"
                required
                className={fieldClass}
                value={form.matchDate}
                onChange={(e) => setForm((f) => ({ ...f, matchDate: e.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-400">
              Opponent
              <input
                className={fieldClass}
                value={form.opponent}
                onChange={(e) => setForm((f) => ({ ...f, opponent: e.target.value }))}
                placeholder="Riverside SC"
              />
            </label>
            <label className="text-sm text-slate-400">
              Venue
              <input
                className={fieldClass}
                value={form.venue}
                onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-400">
              Kickoff
              <input
                className={fieldClass}
                value={form.kickoffTime}
                onChange={(e) => setForm((f) => ({ ...f, kickoffTime: e.target.value }))}
                placeholder="10:00 AM"
              />
            </label>
            <label className="text-sm text-slate-400">
              Competition
              <input
                className={fieldClass}
                value={form.competition}
                onChange={(e) => setForm((f) => ({ ...f, competition: e.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-400">
              Formation
              <input
                className={fieldClass}
                value={form.formation}
                onChange={(e) => setForm((f) => ({ ...f, formation: e.target.value }))}
                placeholder="1-4-3-3"
              />
            </label>
            <label className="text-sm text-slate-400 md:col-span-2">
              Match focus (optional — defaults to this week&apos;s curriculum)
              <input
                className={fieldClass}
                value={form.keyFocus}
                onChange={(e) => setForm((f) => ({ ...f, keyFocus: e.target.value }))}
              />
            </label>
            <div className="md:col-span-2">
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? "Preparing…" : "Create game-day sheet"}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      vs {item.opponent || "TBD"} · {new Date(item.matchDate).toLocaleDateString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {[item.kickoffTime, item.venue, item.competition, item.formation].filter(Boolean).join(" · ") ||
                        "Details to fill"}
                    </p>
                  </div>
                  <button type="button" className={btnSecondarySm} onClick={() => void downloadPdf(item.id)}>
                    Download PDF
                  </button>
                </div>
                {item.keyFocus ? <p className="mt-3 text-sm text-slate-300">{item.keyFocus}</p> : null}
              </div>
            ))}
            {items.length === 0 ? (
              <p className="text-sm text-slate-500">No match sheets yet. Prepare the next game above.</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
