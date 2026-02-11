import * as React from "react";
import type { DiagramV1 } from "@/types/diagram";
import UniversalDrillDiagram from "@/components/UniversalDrillDiagram";
import { tacticalEdgeToUniversalDrillData } from "@/lib/diagram-adapter";

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
  description?: string;
  organization?: DrillDiagramCardOrganization;
};

export default function DrillDiagramCard({
  title,
  gameModelId,
  phase,
  zone,
  diagram,
  description,
  organization,
}: Props) {
  const drillData = React.useMemo(
    () =>
      tacticalEdgeToUniversalDrillData(diagram, {
        title,
        description,
        organization,
      }),
    [diagram, title, description, organization]
  );

  return (
    <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 shadow-2xl shadow-black/40 px-6 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-[950px]">
        <UniversalDrillDiagram drillData={drillData} size="large" />
      </div>
    </section>
  );
}
