import * as React from "react";
import type { DiagramV1 } from "@/types/diagram";
import DrillPitchDiagram from "@/components/DrillPitchDiagram";

type Props = {
  title: string;
  gameModelId: string;
  phase: string;
  zone: string;
  diagram: DiagramV1;
};

const gameModelLabel: Record<string, string> = {
  POSSESSION: "POSSESSION",
  PRESSING: "PRESSING",
  TRANSITION: "TRANSITION",
  COACHAI: "COACHAI",
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-600 bg-slate-900/60 px-3 py-1 text-xs font-semibold tracking-tight text-slate-100">
      {children}
    </span>
  );
}

export default function DrillDiagramCard({
  title,
  gameModelId,
  phase,
  zone,
  diagram,
}: Props) {
  const gm = gameModelLabel[gameModelId] ?? gameModelId;

  return (
    <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 shadow-2xl shadow-black/40 px-6 py-5 sm:px-8 sm:py-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-emerald-400 uppercase">
            Tactical Diagram
          </p>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-50">
            {title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
          <Pill>
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {gm}
          </Pill>
          <Pill>{phase}</Pill>
          <Pill>{zone}</Pill>
        </div>
      </div>

      {/* Pitch */}
      <div className="mt-3 rounded-2xl bg-slate-950/60 p-4 sm:p-5">
        <div className="mx-auto max-w-[720px]">
          <DrillPitchDiagram diagram={diagram} />
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] sm:text-xs text-slate-200">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400 border border-slate-900" />
            <span>Attack</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-400 border border-slate-900" />
            <span>Defend</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-4 rounded-full border border-slate-200 bg-transparent" />
            <span>Pass</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 border-b border-dashed border-slate-200" />
            <span>Run</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-6 border-b border-amber-300" />
            <span>Press / trigger</span>
          </div>
        </div>

        <p className="mt-3 text-[11px] sm:text-xs leading-relaxed text-slate-400">
          Player numbers reflect roles (e.g. 4/5 = CB, 6 = DM, 10 = AM, 7 = W).
          Lane shading shows wide channels, half-spaces and central channel.
        </p>
      </div>
    </section>
  );
}
