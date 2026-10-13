"use client";

import { useCallback, useEffect, useState } from "react";
import { useDocHub } from "../_lib/DocHubContext";
import type { CoachAdherenceRow } from "../_lib/types";
import { authHeaders } from "../_lib/utils";

export default function DocHubAdherencePage() {
  const { access, selectedClubId } = useDocHub();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ranking, setRanking] = useState<CoachAdherenceRow[]>([]);

  const load = useCallback(async (clubId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/coaches/adherence`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load adherence");
      setRanking(data.ranking || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load adherence");
      setRanking([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) void load(selectedClubId);
  }, [access, selectedClubId, load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Adherence</h1>
        <p className="mt-1 text-sm text-slate-400">
          How often a coach&apos;s team generated a session for the exact subprinciple assigned
          that week, out of every week one was assigned. Advisory only -- nothing blocks a coach
          from training something else; this is visibility, not a gate.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : ranking.length === 0 ? (
          <p className="text-sm text-slate-400">No coaches with teams in this club yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="pb-2 font-semibold">Coach</th>
                <th className="pb-2 font-semibold">Adherence</th>
                <th className="pb-2 text-right font-semibold">Rate</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((row) => (
                <tr key={row.userId} className="border-b border-slate-800/70 last:border-b-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-slate-100">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      {row.teams.map((t) => t.teamName).join(", ") || "No teams"}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-800">
                      {row.rate !== null ? (
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.round(row.rate * 100)}%` }}
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 text-right font-mono text-xs text-slate-300">
                    {row.rate === null ? (
                      <span className="text-slate-500">0 / 0 · —</span>
                    ) : (
                      `${row.matched} / ${row.assigned} · ${Math.round(row.rate * 100)}%`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
