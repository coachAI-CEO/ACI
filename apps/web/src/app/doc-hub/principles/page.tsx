"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const MOMENT_ORDER = [
  "ATTACKING_ORGANIZATION",
  "ATTACKING_TRANSITION",
  "DEFENSIVE_ORGANIZATION",
  "DEFENSIVE_TRANSITION",
] as const;

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
  const [activeMoment, setActiveMoment] = useState<string | null>(null);

  const load = useCallback(async (clubId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/principles`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load the game model");
      const loaded: PrincipleWithSubprinciples[] = data.principles || [];
      setPrinciples(loaded);
      setActiveMoment((prev) => prev || loaded[0]?.moment || null);
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

  const groupedByMoment = useMemo(() => {
    const groups = new Map<string, PrincipleWithSubprinciples[]>();
    for (const principle of principles) {
      const list = groups.get(principle.moment) || [];
      list.push(principle);
      groups.set(principle.moment, list);
    }
    const order = [...MOMENT_ORDER, ...[...groups.keys()].filter((m) => !MOMENT_ORDER.includes(m as any))];
    return order
      .filter((moment) => groups.has(moment))
      .map((moment) => ({ moment, principles: groups.get(moment)! }));
  }, [principles]);

  const active = groupedByMoment.find((g) => g.moment === activeMoment) || groupedByMoment[0] || null;

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

          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
            {groupedByMoment.map(({ moment, principles: momentPrinciples }) => {
              const isActive = moment === active?.moment;
              return (
                <button
                  key={moment}
                  type="button"
                  onClick={() => setActiveMoment(moment)}
                  className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                    isActive
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-slate-100"
                  }`}
                >
                  <span className="block font-medium">{MOMENT_LABEL[moment] || moment}</span>
                  <span className={`block text-[11px] ${isActive ? "text-emerald-400/80" : "text-slate-500"}`}>
                    {momentPrinciples.length} principles &middot;{" "}
                    {momentPrinciples.reduce((sum, p) => sum + p.subprinciples.length, 0)} subprinciples
                  </span>
                </button>
              );
            })}
          </div>

          {active ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3" style={{ alignItems: "start" }}>
              {active.principles.map((principle) => (
                <div key={principle.id} className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
                  <h3 className="text-base font-semibold text-slate-100">{principle.statement}</h3>

                  <ul className="mt-4 space-y-4">
                    {principle.subprinciples.map((sub) => (
                      <li key={sub.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${READINESS_PILL[sub.readiness]}`}
                        >
                          {READINESS_LABEL[sub.readiness]}
                        </span>

                        <div className="mt-3 space-y-2.5">
                          <p className="text-[15px] leading-relaxed text-slate-100">
                            <span className="mr-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                              Trigger
                            </span>
                            <br />
                            {sub.trigger}
                          </p>
                          <p className="text-[15px] leading-relaxed text-slate-200">
                            <span className="mr-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                              Response
                            </span>
                            <br />
                            {sub.response}
                          </p>
                          {sub.antiPattern ? (
                            <p className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2 text-sm leading-relaxed text-rose-200/90">
                              <span className="mr-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-rose-400/80">
                                Anti-pattern
                              </span>
                              <br />
                              {sub.antiPattern}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
