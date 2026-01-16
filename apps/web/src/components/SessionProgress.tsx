"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  isSeries: boolean;
  totalSessions?: number;
  currentSession?: number;
};

const STAGES = ["Preparing", "API Call", "QA", "Rendering"];

export default function SessionProgress({ isSeries, totalSessions = 0, currentSession = 0 }: Props) {
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(id);
  }, [startTime]);

  const currentLabel = useMemo(() => {
    if (!isSeries) return "Generating session...";
    if (!totalSessions) return "Generating series...";
    return `Generating session ${currentSession || 1} of ${totalSessions}...`;
  }, [isSeries, totalSessions, currentSession]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 text-slate-50 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{currentLabel}</h2>
          <div className="text-xs text-slate-400">
            {Math.floor(elapsed / 1000)}s elapsed
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {STAGES.map((stage, i) => (
            <div key={stage} className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3">
              <div className="text-[11px] uppercase tracking-widest text-slate-400">{stage}</div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800">
                <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: i === 0 ? "100%" : "40%" }} />
              </div>
            </div>
          ))}
        </div>
        {isSeries && totalSessions > 0 && (
          <div className="mt-4 text-xs text-slate-400">
            Progress: {currentSession || 1}/{totalSessions}
          </div>
        )}
      </div>
    </div>
  );
}
