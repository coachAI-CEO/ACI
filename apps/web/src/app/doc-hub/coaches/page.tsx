"use client";

import { useCallback, useEffect, useState } from "react";
import { useDocHub } from "../_lib/DocHubContext";
import type { CoachUsageRow } from "../_lib/types";
import { authHeaders, statusPill } from "../_lib/utils";

export default function DocHubCoachesPage() {
  const { access, selectedClubId } = useDocHub();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CoachUsageRow[]>([]);

  const load = useCallback(async (clubId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/coaches/usage?days=7`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load coach usage");
      setRows(
        (data.coaches || []).map(
          (c: {
            userId: string;
            name: string;
            roleLabel: string;
            runs: number;
            lastActiveLabel: string;
            status: string;
          }) => ({
            userId: c.userId,
            name: c.name,
            roleLabel: c.roleLabel,
            runs: c.runs,
            lastActiveLabel: c.lastActiveLabel,
            status: c.status,
          })
        )
      );
    } catch (e: any) {
      setError(e?.message || "Failed to load coach usage");
      setRows([]);
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
        <h1 className="text-2xl font-semibold tracking-tight text-white">Coaches</h1>
        <p className="mt-1 text-sm text-slate-400">Sessions generated · last 7 days</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60">
        {loading ? (
          <p className="p-5 text-sm text-slate-400">Loading coach usage…</p>
        ) : error ? (
          <p className="p-5 text-sm text-rose-300">{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">
            No coaches in this club yet. Assign club memberships in Admin if needed.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="px-5 py-3 font-medium">Coach</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Runs (7d)</th>
                  <th className="px-3 py-3 font-medium">Last Active</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId} className="border-b border-slate-800/60">
                    <td className="px-5 py-3 text-slate-200">{row.name}</td>
                    <td className="px-3 py-3 text-slate-300">{row.roleLabel}</td>
                    <td className="px-3 py-3 text-slate-200">{row.runs}</td>
                    <td className="px-3 py-3 text-slate-400">{row.lastActiveLabel}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusPill(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
