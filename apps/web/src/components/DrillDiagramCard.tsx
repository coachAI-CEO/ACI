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
};

export default function DrillDiagramCard({
  drillId,
  drillType,
  sessionSummary,
  goalsAvailable,
  initialSvg,
}: Props) {
  const isCooldown = String(drillType || "").toUpperCase() === "COOLDOWN";

  if (isCooldown) {
    return (
      <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 shadow-2xl shadow-black/40 px-6 py-5 sm:px-8 sm:py-6">
        <div className="mx-auto max-w-[950px] space-y-3">
          <h4 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">
            Session Summary
          </h4>
          <p className="text-sm leading-relaxed text-slate-300">
            {sessionSummary?.trim() ||
              "Cooldown -- no tactical diagram needed. Wind the players down and recap the session's key coaching points."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 shadow-2xl shadow-black/40 px-6 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-[950px] space-y-3">
        <StoredDrillSvg drillId={drillId} goalsAvailable={goalsAvailable} size="large" className="mx-auto" initialSvg={initialSvg} />
      </div>
    </section>
  );
}
