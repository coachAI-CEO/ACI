"use client";

import type { DiagramV1 } from "@/types/diagram";
import StoredDrillSvg from "@/components/StoredDrillSvg";

export type DrillDiagramCardOrganization = {
  area?: {
    widthYards?: number;
    lengthYards?: number;
    notes?: string;  // ← ADDED: For zone detection (e.g., "central zone", "security zone")
  };
  setupSteps?: string[];
};

export type DrillDebrief = {
  keyTakeaways?: string[];
  questionsToAsk?: string[];
  watchFor?: string[];
};

type Props = {
  title: string;
  gameModelId: string;
  phase: string;
  zone: string;
  diagram: DiagramV1;
  drillId?: string | null;
  drillType?: string | null;
  sessionSummary?: string | null;
  goalsAvailable?: number | null;
  description?: string;
  organization?: DrillDiagramCardOrganization;
  initialSvg?: string | null;
  debrief?: DrillDebrief | null;
};

export default function DrillDiagramCard({
  drillId,
  drillType,
  sessionSummary,
  goalsAvailable,
  initialSvg,
  debrief,
}: Props) {
  const isCooldown = String(drillType || "").toUpperCase() === "COOLDOWN";

  if (isCooldown) {
    const keyTakeaways = debrief?.keyTakeaways?.filter(Boolean) || [];
    const questionsToAsk = debrief?.questionsToAsk?.filter(Boolean) || [];
    const watchFor = debrief?.watchFor?.filter(Boolean) || [];
    const hasDebrief = keyTakeaways.length > 0 || questionsToAsk.length > 0 || watchFor.length > 0;

    return (
      <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 shadow-2xl shadow-black/40 px-6 py-5 sm:px-8 sm:py-6">
        <div className="mx-auto max-w-[950px] space-y-5">
          <h4 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">
            Coach Debrief
          </h4>

          {!hasDebrief && (
            <p className="text-sm leading-relaxed text-slate-300">
              {sessionSummary?.trim() ||
                "Cooldown -- wind the players down and recap the session's key coaching points."}
            </p>
          )}

          {keyTakeaways.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Reinforce Today</h5>
              <ul className="space-y-1.5 text-sm leading-relaxed text-slate-200">
                {keyTakeaways.map((point, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-400">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {questionsToAsk.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Ask the Team</h5>
              <ul className="space-y-1.5 text-sm leading-relaxed text-slate-200">
                {questionsToAsk.map((q, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-sky-400">?</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {watchFor.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <h5 className="text-xs font-semibold tracking-wide text-amber-300 uppercase">
                Coach&apos;s Note — Watch For Next Time
              </h5>
              <ul className="space-y-1.5 text-sm leading-relaxed text-amber-100/90">
                {watchFor.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-400">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 shadow-2xl shadow-black/40 px-6 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-[950px] space-y-3">
        <StoredDrillSvg
          drillId={drillId}
          goalsAvailable={goalsAvailable}
          size="large"
          className="mx-auto"
          initialSvg={initialSvg}
          showRegenerate={false}
        />
      </div>
    </section>
  );
}
