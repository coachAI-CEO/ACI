"use client";

import { useCallback, useEffect, useState } from "react";
import { useDocHub } from "../_lib/DocHubContext";
import type { AgeGroupMaturityRow, ReadinessCeilingRow } from "../_lib/types";
import { authHeaders, btnPrimarySm, btnSecondarySm } from "../_lib/utils";

const TIERS = ["FOUNDATIONAL", "DEVELOPING", "ADVANCED"] as const;

const TIER_PILL: Record<string, string> = {
  FOUNDATIONAL: "border-slate-600 bg-slate-800 text-slate-300",
  DEVELOPING: "border-cyan-400/30 bg-cyan-500/15 text-cyan-300",
  ADVANCED: "border-violet-400/30 bg-violet-500/15 text-violet-300",
};

const TIER_LABEL: Record<string, string> = {
  FOUNDATIONAL: "Foundational",
  DEVELOPING: "Developing",
  ADVANCED: "Advanced",
};

function CustomBadge({ isCustom, updatedAt }: { isCustom: boolean; updatedAt: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
          isCustom
            ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
            : "border-slate-600 bg-slate-800 text-slate-400"
        }`}
      >
        {isCustom ? "Custom" : "Default"}
      </span>
      {isCustom && updatedAt ? (
        <span className="text-[10px] text-slate-500">updated {new Date(updatedAt).toLocaleDateString()}</span>
      ) : null}
    </span>
  );
}

export default function DocHubAgeGroupDefaultsPage() {
  const { access, selectedClubId, canEditPhilosophy } = useDocHub();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ceilingRows, setCeilingRows] = useState<ReadinessCeilingRow[]>([]);
  const [ceilingDrafts, setCeilingDrafts] = useState<Record<string, string>>({});
  const [savingCeiling, setSavingCeiling] = useState<string | null>(null);
  const [ceilingMessage, setCeilingMessage] = useState<Record<string, string>>({});
  const [ceilingError, setCeilingError] = useState<Record<string, string>>({});

  const [noteRows, setNoteRows] = useState<AgeGroupMaturityRow[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [noteMessage, setNoteMessage] = useState<Record<string, string>>({});
  const [noteError, setNoteError] = useState<Record<string, string>>({});

  const load = useCallback(async (clubId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [ceilingRes, noteRes] = await Promise.all([
        fetch(`/api/doc-hub/clubs/${clubId}/readiness-ceiling`, { headers: authHeaders() }),
        fetch(`/api/doc-hub/clubs/${clubId}/age-group-maturity`, { headers: authHeaders() }),
      ]);
      const ceilingData = await ceilingRes.json();
      const noteData = await noteRes.json();
      if (!ceilingRes.ok || !ceilingData?.ok) throw new Error(ceilingData?.error || "Failed to load the readiness ladder");
      if (!noteRes.ok || !noteData?.ok) throw new Error(noteData?.error || "Failed to load age-group maturity notes");

      const loadedCeilings: ReadinessCeilingRow[] = ceilingData.rows || [];
      const loadedNotes: AgeGroupMaturityRow[] = noteData.rows || [];
      setCeilingRows(loadedCeilings);
      setNoteRows(loadedNotes);
      setCeilingDrafts(Object.fromEntries(loadedCeilings.map((r) => [r.ageGroup, r.ceiling])));
      setNoteDrafts(Object.fromEntries(loadedNotes.map((r) => [r.ageGroup, r.note])));
    } catch (e: any) {
      setError(e?.message || "Failed to load age group defaults");
      setCeilingRows([]);
      setNoteRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) void load(selectedClubId);
  }, [access, selectedClubId, load]);

  async function saveCeiling(ageGroup: string, ceiling: string | null) {
    if (!selectedClubId || !canEditPhilosophy) return;
    setSavingCeiling(ageGroup);
    setCeilingError((prev) => ({ ...prev, [ageGroup]: "" }));
    setCeilingMessage((prev) => ({ ...prev, [ageGroup]: "" }));
    try {
      const res = await fetch(`/api/doc-hub/clubs/${selectedClubId}/readiness-ceiling/${ageGroup}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ceiling }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || data?.message || "Save failed");
      const updatedRow: ReadinessCeilingRow = data.row;
      setCeilingRows((prev) => prev.map((r) => (r.ageGroup === ageGroup ? updatedRow : r)));
      setCeilingDrafts((prev) => ({ ...prev, [ageGroup]: updatedRow.ceiling }));
      setCeilingMessage((prev) => ({ ...prev, [ageGroup]: updatedRow.isCustom ? "Saved." : "Reset to default." }));
    } catch (e: any) {
      setCeilingError((prev) => ({ ...prev, [ageGroup]: e?.message || "Save failed" }));
    } finally {
      setSavingCeiling(null);
    }
  }

  async function saveNote(ageGroup: string, note: string | null) {
    if (!selectedClubId || !canEditPhilosophy) return;
    setSavingNote(ageGroup);
    setNoteError((prev) => ({ ...prev, [ageGroup]: "" }));
    setNoteMessage((prev) => ({ ...prev, [ageGroup]: "" }));
    try {
      const res = await fetch(`/api/doc-hub/clubs/${selectedClubId}/age-group-maturity/${ageGroup}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || data?.message || "Save failed");
      const updatedRow: AgeGroupMaturityRow = data.row;
      setNoteRows((prev) => prev.map((r) => (r.ageGroup === ageGroup ? updatedRow : r)));
      setNoteDrafts((prev) => ({ ...prev, [ageGroup]: updatedRow.note }));
      setNoteMessage((prev) => ({ ...prev, [ageGroup]: updatedRow.isCustom ? "Saved." : "Reset to default." }));
    } catch (e: any) {
      setNoteError((prev) => ({ ...prev, [ageGroup]: e?.message || "Save failed" }));
    } finally {
      setSavingNote(null);
    }
  }

  const ageGroups = ceilingRows.map((r) => r.ageGroup);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Age Group Defaults</h1>
        <p className="mt-1 text-sm text-slate-400">
          Two independent signals per age group: the <strong>readiness ceiling</strong> (which
          subprinciple tiers a team is eligible for by default) and the{" "}
          <strong>maturity note</strong> (one sentence of generation tone/complexity context) --
          both fall back to the shared default until a DOC customizes them here.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
        {loading ? (
          <p className="text-sm text-slate-400">Loading age groups…</p>
        ) : error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : ageGroups.length === 0 ? (
          <p className="text-sm text-slate-400">No age groups found.</p>
        ) : (
          <ul className="space-y-5">
            {ageGroups.map((ageGroup) => {
              const ceilingRow = ceilingRows.find((r) => r.ageGroup === ageGroup)!;
              const noteRow = noteRows.find((r) => r.ageGroup === ageGroup);
              const ceilingDraft = ceilingDrafts[ageGroup] ?? ceilingRow.ceiling;
              const ceilingDirty = ceilingDraft !== ceilingRow.ceiling;
              const ceilingBusy = savingCeiling === ageGroup;
              const noteDraft = noteDrafts[ageGroup] ?? noteRow?.note ?? "";
              const noteDirty = noteRow ? noteDraft !== noteRow.note : false;
              const noteBusy = savingNote === ageGroup;

              return (
                <li key={ageGroup} className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                  <p className="text-sm font-semibold text-slate-100">{ageGroup}</p>

                  <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                          Readiness ceiling
                        </span>
                        <CustomBadge isCustom={ceilingRow.isCustom} updatedAt={ceilingRow.updatedAt} />
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium uppercase tracking-wide outline-none focus:border-emerald-500/60 ${TIER_PILL[ceilingDraft]}`}
                          value={ceilingDraft}
                          disabled={!canEditPhilosophy}
                          onChange={(e) => setCeilingDrafts((prev) => ({ ...prev, [ageGroup]: e.target.value }))}
                        >
                          {TIERS.map((tier) => (
                            <option key={tier} value={tier} className="bg-slate-950 text-slate-100">
                              {TIER_LABEL[tier]}
                            </option>
                          ))}
                        </select>
                        {ceilingRow.isCustom ? (
                          <button
                            type="button"
                            className={btnSecondarySm}
                            disabled={!canEditPhilosophy || ceilingBusy}
                            onClick={() => saveCeiling(ageGroup, null)}
                          >
                            Reset
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={btnPrimarySm}
                          disabled={!canEditPhilosophy || ceilingBusy || !ceilingDirty}
                          onClick={() => saveCeiling(ageGroup, ceilingDraft)}
                        >
                          {ceilingBusy ? "Saving…" : "Save"}
                        </button>
                      </div>
                      {ceilingError[ageGroup] ? (
                        <p className="mt-1 text-xs text-rose-300">{ceilingError[ageGroup]}</p>
                      ) : ceilingMessage[ageGroup] ? (
                        <p className="mt-1 text-xs text-emerald-300">{ceilingMessage[ageGroup]}</p>
                      ) : null}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                          Maturity note
                        </span>
                        {noteRow ? <CustomBadge isCustom={noteRow.isCustom} updatedAt={noteRow.updatedAt} /> : null}
                      </div>
                      <textarea
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/40 p-2.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                        rows={2}
                        value={noteDraft}
                        disabled={!canEditPhilosophy}
                        onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [ageGroup]: e.target.value }))}
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        {noteRow?.isCustom ? (
                          <button
                            type="button"
                            className={btnSecondarySm}
                            disabled={!canEditPhilosophy || noteBusy}
                            onClick={() => saveNote(ageGroup, null)}
                          >
                            Reset
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={btnPrimarySm}
                          disabled={!canEditPhilosophy || noteBusy || !noteDirty || !noteDraft.trim()}
                          onClick={() => saveNote(ageGroup, noteDraft)}
                        >
                          {noteBusy ? "Saving…" : "Save"}
                        </button>
                      </div>
                      {noteError[ageGroup] ? (
                        <p className="mt-1 text-xs text-rose-300">{noteError[ageGroup]}</p>
                      ) : noteMessage[ageGroup] ? (
                        <p className="mt-1 text-xs text-emerald-300">{noteMessage[ageGroup]}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!canEditPhilosophy && !loading && !error ? (
          <p className="mt-4 text-xs text-slate-500">Read-only -- only the club&apos;s DOC can edit these defaults.</p>
        ) : null}
      </div>
    </div>
  );
}
