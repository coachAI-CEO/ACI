"use client";

import React from "react";
import DrillDiagram from "./DrillDiagram";
import type { DiagramV1 } from "@/types/diagram";

type Props = {
  title: string;
  gameModelId?: string;
  phase?: string;
  zone?: string;
  diagram: DiagramV1;
};

const badgeClass =
  "inline-flex items-center rounded-full border border-slate-700/80 bg-slate-900/60 px-2.5 py-0.5 text-[11px] font-medium text-slate-100";

export const DrillDiagramCard: React.FC<Props> = ({
  title,
  gameModelId,
  phase,
  zone,
  diagram,
}) => {
  return (
    <section className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5 shadow-lg">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
            Tactical Diagram
          </h2>
          <p className="text-base font-semibold text-slate-50">{title}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {gameModelId && (
            <span className={badgeClass}>
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {gameModelId}
            </span>
          )}
          {phase && <span className={badgeClass}>{phase}</span>}
          {zone && <span className={badgeClass}>{zone}</span>}
        </div>
      </header>

      <DrillDiagram diagram={diagram} />

      {/* Footer hint */}
      <footer className="mt-3 text-[11px] text-slate-400">
        <p>
          Player numbers reflect roles (e.g. 4/5 = CB, 6 = DM, 10 = AM, 7 = W).
          Lane shading shows wide channels, half-spaces and central channel.
        </p>
      </footer>
    </section>
  );
};

export default DrillDiagramCard;
