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
  goalsAvailable?: number | null;
  description?: string;
  organization?: DrillDiagramCardOrganization;
};

export default function DrillDiagramCard({
  drillId,
  goalsAvailable,
}: Props) {
  return (
    <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 shadow-2xl shadow-black/40 px-6 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-[950px] space-y-3">
        <StoredDrillSvg drillId={drillId} goalsAvailable={goalsAvailable} size="large" className="mx-auto" />
      </div>
    </section>
  );
}
