"use client";

import { useCallback, useEffect, useState } from "react";
import { useDocHub } from "../_lib/DocHubContext";
import type { ReadinessCeilingRow } from "../_lib/types";
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

export default function DocHubReadinessLadderPage() {
  const { access, selectedClubId, canEditPhilosophy } = useDocHub();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReadinessCeilingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingAgeGroup, setSavingAgeGroup] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = useCallback(async (clubId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/readiness-ceiling`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load the readiness ladder");
      const loadedRows: ReadinessCeilingRow[] = data.rows || [];
      setRows(loadedRows);
      setDrafts(Object.fromEntries(loadedRows.map((r) => [r.ageGroup, r.ceiling])));
    } catch (e: any) {
      setError(e?.message || "Failed to load the readiness ladder");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) void load(selectedClubId);
  }, [access, selectedClubId, load]);

  async function saveCeiling(ageGroup: string, ceiling: string | null) {
    if (!selectedClubId || !canEditPhilosophy) return;
    setSavingAgeGroup(ageGroup);
    setRowError((prev) => ({ ...prev, [ageGroup]: "" }));
    setRowMessage((prev) => ({ ...prev, [ageGroup]: "" }));
    try {
      const res = await fetch(`/api/doc-hub/clubs/${selectedClubId}/readiness-ceiling/${ageGroup}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ceiling }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || data?.message || "Save failed");
      const updatedRow: ReadinessCeilingRow = data.row;
      setRows((prev) => prev.map((r) => (r.ageGroup === ageGroup ? updatedRow : r)));
      setDrafts((prev) => ({ ...prev, [ageGroup]: updatedRow.ceiling }));
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
        <h1 className="text-2xl font-semibold tracking-tight text-white">Readiness Ladder</h1>
        <p className="mt-1 text-sm text-slate-400">
          The default ceiling for each age group -- which subprinciple tiers (Foundational /
          Developing / Advanced) a team is eligible for by default when assigning a training
          priority. A team&apos;s own override in Teams still wins over this club-wide default.
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
          <ul className="space-y-3">
            {rows.map((row) => {
              const draft = drafts[row.ageGroup] ?? row.ceiling;
              const dirty = draft !== row.ceiling;
              const busy = savingAgeGroup === row.ageGroup;
              return (
                <li
                  key={row.ageGroup}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-sm font-semibold text-slate-100">{row.ageGroup}</span>
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

                  <div className="flex flex-1 items-center justify-end gap-2">
                    <select
                      className={`rounded-xl border px-3 py-2 text-xs font-medium uppercase tracking-wide outline-none focus:border-emerald-500/60 ${TIER_PILL[draft]}`}
                      value={draft}
                      disabled={!canEditPhilosophy}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [row.ageGroup]: e.target.value }))}
                    >
                      {TIERS.map((tier) => (
                        <option key={tier} value={tier} className="bg-slate-950 text-slate-100">
                          {TIER_LABEL[tier]}
                        </option>
                      ))}
                    </select>
                    {row.isCustom ? (
                      <button
                        type="button"
                        className={btnSecondarySm}
                        disabled={!canEditPhilosophy || busy}
                        onClick={() => saveCeiling(row.ageGroup, null)}
                      >
                        Reset
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={btnPrimarySm}
                      disabled={!canEditPhilosophy || busy || !dirty}
                      onClick={() => saveCeiling(row.ageGroup, draft)}
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                  </div>
                  {rowError[row.ageGroup] ? (
                    <p className="w-full text-xs text-rose-300">{rowError[row.ageGroup]}</p>
                  ) : rowMessage[row.ageGroup] ? (
                    <p className="w-full text-xs text-emerald-300">{rowMessage[row.ageGroup]}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {!canEditPhilosophy && !loading && !error ? (
          <p className="mt-4 text-xs text-slate-500">Read-only -- only the club&apos;s DOC can edit the ladder.</p>
        ) : null}
      </div>
    </div>
  );
}
