"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useDocHub } from "../_lib/DocHubContext";
import type { AttentionItem } from "../_lib/types";
import { authHeaders, btnQuiet, mondayWeekStartIso, severityPill } from "../_lib/utils";

export default function DocHubAttentionPage() {
  const { access, selectedClubId } = useDocHub();
  const [weekStart] = useState(mondayWeekStartIso);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async (clubId: string, week: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ weekStart: week });
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/attention?${qs}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load club attention");
      setItems(data.items || []);
      setWarning(
        Array.isArray(data.warnings) && data.warnings.length ? data.warnings.join(", ") : null
      );
    } catch (e: any) {
      setError(e?.message || "Failed to load club attention");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) void load(selectedClubId, weekStart);
  }, [access, selectedClubId, weekStart, load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Attention</h1>
        <p className="mt-1 text-sm text-slate-400">
          Who’s dark or has an empty week · week of {weekStart}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
        {loading ? (
          <p className="text-sm text-slate-400">Loading attention…</p>
        ) : error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400">All coaches look covered this week.</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-300">
            {items.map((item) => (
              <li
                key={item.id}
                className="border-b border-slate-800 px-0 py-3 last:border-b-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${severityPill(item.severity)}`}
                      >
                        {item.severity}
                      </span>
                      <span className="font-medium text-slate-100">{item.coachName}</span>
                    </div>
                    <div className="mt-1 text-slate-200">{item.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{item.detail}</div>
                  </div>
                  {item.action.type !== "none" ? (
                    <Link
                      href={`/doc-hub/calendar?coach=${encodeURIComponent(item.coachUserId)}&action=${item.action.type}`}
                      className={btnQuiet}
                    >
                      {item.action.type === "assign" ? "Assign" : "Calendar"}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {warning ? (
          <p className="mt-3 text-xs text-amber-300/90">Warning: {warning}</p>
        ) : null}
      </div>
    </div>
  );
}
