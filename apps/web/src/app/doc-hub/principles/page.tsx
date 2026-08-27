"use client";

import { useCallback, useEffect, useState } from "react";
import { useDocHub } from "../_lib/DocHubContext";
import type { PrincipleWithSubprinciples } from "../_lib/types";
import { authHeaders } from "../_lib/utils";

const READINESS_LABEL: Record<string, string> = {
  FOUNDATIONAL: "Foundational",
  DEVELOPING: "Developing",
  ADVANCED: "Advanced",
};

const READINESS_PILL: Record<string, string> = {
  FOUNDATIONAL: "border-slate-600 bg-slate-800 text-slate-300",
  DEVELOPING: "border-cyan-400/30 bg-cyan-500/15 text-cyan-300",
  ADVANCED: "border-violet-400/30 bg-violet-500/15 text-violet-300",
};

const MOMENT_LABEL: Record<string, string> = {
  ATTACKING_ORGANIZATION: "Attacking Organization",
  DEFENSIVE_TRANSITION: "Defensive Transition",
  DEFENSIVE_ORGANIZATION: "Defensive Organization",
  ATTACKING_TRANSITION: "Attacking Transition",
};

export default function DocHubPrinciplesPage() {
  const { access, selectedClubId, selectedClub } = useDocHub();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [principles, setPrinciples] = useState<PrincipleWithSubprinciples[]>([]);

  const load = useCallback(async (clubId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/principles`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load the game model");
      setPrinciples(data.principles || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load the game model");
      setPrinciples([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) void load(selectedClubId);
  }, [access, selectedClubId, load]);

  const totalSubprinciples = principles.reduce((sum, p) => sum + p.subprinciples.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Principles &amp; Subprinciples</h1>
        <p className="mt-1 text-sm text-slate-400">
          {selectedClub?.clubName || "This club"}&apos;s own game model -- the exact trigger /
          response / anti-pattern text every generated drill and training priority is built
          from. Read-only here; authored via seed scripts today.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Loading the game model…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      ) : principles.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">This club has no principles or subprinciples yet.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {principles.length} principles &middot; {totalSubprinciples} subprinciples
          </p>
          <div className="space-y-5">
            {principles.map((principle) => (
              <div key={principle.id} className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
                  {MOMENT_LABEL[principle.moment] || principle.moment}
                </p>
                <h2 className="mt-1 text-base font-semibold text-slate-100">{principle.statement}</h2>

                <ul className="mt-4 space-y-3">
                  {principle.subprinciples.map((sub) => (
                    <li key={sub.id} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${READINESS_PILL[sub.readiness]}`}
                      >
                        {READINESS_LABEL[sub.readiness]}
                      </span>
                      <p className="mt-2 text-sm font-medium text-slate-100">
                        <span className="text-slate-500">Trigger — </span>
                        {sub.trigger}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        <span className="text-slate-500">Response — </span>
                        {sub.response}
                      </p>
                      {sub.antiPattern ? (
                        <p className="mt-1 text-xs italic text-slate-500">
                          <span className="not-italic text-slate-600">Anti-pattern — </span>
                          {sub.antiPattern}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
