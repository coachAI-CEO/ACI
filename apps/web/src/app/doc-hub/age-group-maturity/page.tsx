"use client";

import { useCallback, useEffect, useState } from "react";
import { useDocHub } from "../_lib/DocHubContext";
import type { AgeGroupMaturityRow } from "../_lib/types";
import { authHeaders, btnPrimarySm, btnSecondarySm } from "../_lib/utils";

export default function DocHubAgeGroupMaturityPage() {
  const { access, selectedClubId, canEditPhilosophy } = useDocHub();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AgeGroupMaturityRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingAgeGroup, setSavingAgeGroup] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = useCallback(async (clubId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/age-group-maturity`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load age-group maturity notes");
      const loadedRows: AgeGroupMaturityRow[] = data.rows || [];
      setRows(loadedRows);
      setDrafts(Object.fromEntries(loadedRows.map((r) => [r.ageGroup, r.note])));
    } catch (e: any) {
      setError(e?.message || "Failed to load age-group maturity notes");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) void load(selectedClubId);
  }, [access, selectedClubId, load]);

  async function saveNote(ageGroup: string, note: string | null) {
    if (!selectedClubId || !canEditPhilosophy) return;
    setSavingAgeGroup(ageGroup);
    setRowError((prev) => ({ ...prev, [ageGroup]: "" }));
    setRowMessage((prev) => ({ ...prev, [ageGroup]: "" }));
    try {
      const res = await fetch(`/api/doc-hub/clubs/${selectedClubId}/age-group-maturity/${ageGroup}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || data?.message || "Save failed");
      const updatedRow: AgeGroupMaturityRow = data.row;
      setRows((prev) => prev.map((r) => (r.ageGroup === ageGroup ? updatedRow : r)));
      setDrafts((prev) => ({ ...prev, [ageGroup]: updatedRow.note }));
      setRowMessage((prev) => ({
        ...prev,
        [ageGroup]: updatedRow.isCustom ? "Saved." : "Reset to the shared default.",
      }));
    } catch (e: any) {
      setRowError((prev) => ({ ...prev, [ageGroup]: e?.message || "Save failed" }));
    } finally {
      setSavingAgeGroup(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Age Group Maturity</h1>
        <p className="mt-1 text-sm text-slate-400">
          One-sentence context injected into generation for each age group -- lets ages that
          share the same player/coach level (e.g. U13 and U18, both 11v11) still generate
          differently. Leave an age group on “Default” to use the shared note.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
        {loading ? (
          <p className="text-sm text-slate-400">Loading age groups…</p>
        ) : error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-400">No age groups found.</p>
        ) : (
          <ul className="space-y-4">
            {rows.map((row) => {
              const draft = drafts[row.ageGroup] ?? row.note;
              const dirty = draft !== row.note;
              const busy = savingAgeGroup === row.ageGroup;
              return (
                <li key={row.ageGroup} className="border-b border-slate-800 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">{row.ageGroup}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          row.isCustom
                            ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                            : "border-slate-600 bg-slate-800 text-slate-400"
                        }`}
                      >
                        {row.isCustom ? "Custom" : "Default"}
                      </span>
                      {row.isCustom && row.updatedAt ? (
                        <span className="text-[10px] text-slate-500">
                          updated {new Date(row.updatedAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {row.isCustom ? (
                        <button
                          type="button"
                          className={btnSecondarySm}
                          disabled={!canEditPhilosophy || busy}
                          onClick={() => saveNote(row.ageGroup, null)}
                        >
                          Reset to default
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={btnPrimarySm}
                        disabled={!canEditPhilosophy || busy || !dirty || !draft.trim()}
                        onClick={() => saveNote(row.ageGroup, draft)}
                      >
                        {busy ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                    rows={2}
                    value={draft}
                    disabled={!canEditPhilosophy}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [row.ageGroup]: e.target.value }))}
                  />
                  {rowError[row.ageGroup] ? (
                    <p className="mt-1 text-xs text-rose-300">{rowError[row.ageGroup]}</p>
                  ) : rowMessage[row.ageGroup] ? (
                    <p className="mt-1 text-xs text-emerald-300">{rowMessage[row.ageGroup]}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {!canEditPhilosophy && !loading && !error ? (
          <p className="mt-4 text-xs text-slate-500">Read-only -- only the club's DOC can edit these notes.</p>
        ) : null}
      </div>
    </div>
  );
}
