"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Props = {
  isSeries: boolean;
  totalSessions?: number;
  currentSession?: number;
  readySeriesSessions?: Array<{
    id: string;
    title?: string;
    seriesNumber?: number | null;
  }>;
  onCancel?: () => void;
};

const COACH_FLOW_STEPS = [
  {
    id: "objective",
    title: "Framing the Objective",
    details: [
      "Aligning game model, phase, and age context",
      "Checking if constraints match the intended outcome",
      "Setting session intent before drill design",
    ],
  },
  {
    id: "arc",
    title: "Drafting the Session Arc",
    details: [
      "Structuring progression from activation to game phase",
      "Sequencing tactical load across the full session",
      "Building a coherent coaching flow",
    ],
  },
  {
    id: "constraints",
    title: "Balancing Constraints",
    details: [
      "Tuning player numbers and area dimensions",
      "Balancing work-to-rest and overall session load",
      "Adjusting complexity for realistic execution",
    ],
  },
  {
    id: "validation",
    title: "Tactical Validation",
    details: [
      "Checking session logic and progression clarity",
      "Verifying tactical consistency across all blocks",
      "Reviewing quality and coaching usability",
    ],
  },
  {
    id: "final",
    title: "Finalizing Session Plan",
    details: [
      "Preparing final session output",
      "Rendering drill cards and tactical views",
      "Finishing result packaging for review",
    ],
  },
] as const;

const STEP_WINDOWS = [2, 5, 9, 13, 18];

export default function SessionProgress({
  isSeries,
  totalSessions = 0,
  currentSession = 0,
  readySeriesSessions = [],
  onCancel,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [detailIndex, setDetailIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((prev) => prev + 1000);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setDetailIndex((prev) => prev + 1);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const currentLabel = useMemo(() => {
    if (!isSeries) return "Generating session...";
    if (!totalSessions) return "Generating series...";
    return `Generating session ${currentSession || 1} of ${totalSessions}...`;
  }, [isSeries, totalSessions, currentSession]);

  const elapsedSeconds = Math.floor(elapsed / 1000);
  const activeStepIndex = STEP_WINDOWS.findIndex((limit) => elapsedSeconds < limit);
  const normalizedStepIndex =
    activeStepIndex === -1 ? COACH_FLOW_STEPS.length - 1 : activeStepIndex;
  const completedCount = normalizedStepIndex;
  const progressPercent = Math.min(
    100,
    Math.round(((completedCount + 0.35) / COACH_FLOW_STEPS.length) * 100)
  );
  const activeStep = COACH_FLOW_STEPS[normalizedStepIndex];
  const activeDetail = activeStep.details[detailIndex % activeStep.details.length];
  const completedSeriesCount = readySeriesSessions.length;
  const generatingSeriesIndex =
    isSeries && totalSessions > 0
      ? Math.min(totalSessions, Math.max(1, completedSeriesCount + 1))
      : 1;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-6 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-3xl border border-slate-700/70 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-6 text-slate-50 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{currentLabel}</h2>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400">
              {elapsedSeconds}s elapsed
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
              >
                Cancel Generation
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 h-2 w-full rounded-full bg-slate-800/90">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-700"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-[280px_1fr]">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4">
            <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-slate-400">
              Coach Build Flow
            </div>
            <div className="space-y-3">
              {COACH_FLOW_STEPS.map((step, i) => {
                const isComplete = i < normalizedStepIndex;
                const isActive = i === normalizedStepIndex;
                return (
                  <div
                    key={step.id}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-2 transition-all ${
                      isActive
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : isComplete
                          ? "border-slate-700/70 bg-slate-900/70"
                          : "border-slate-800 bg-slate-950/40"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                        isComplete
                          ? "bg-emerald-500 text-slate-950"
                          : isActive
                            ? "bg-emerald-400/90 text-slate-950 animate-pulse"
                            : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {isComplete ? "✓" : i + 1}
                    </div>
                    <div className={`text-sm ${isActive ? "text-slate-100" : "text-slate-400"}`}>
                      {step.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              In Progress
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-100">
              {activeStep.title}
            </div>
            <p className="mt-3 min-h-6 text-sm text-slate-300 transition-opacity duration-300">
              {activeDetail}
            </p>
            <div className="mt-5 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-300">Building with coach-style validation</span>
            </div>
            {isSeries && totalSessions > 0 && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-full border border-cyan-700/70 bg-cyan-950/40 px-3 py-1 text-xs text-cyan-200">
                    Generating: {generatingSeriesIndex}/{totalSessions}
                  </div>
                  <div className="inline-flex items-center rounded-full border border-emerald-700/70 bg-emerald-950/30 px-3 py-1 text-xs text-emerald-200">
                    Ready: {completedSeriesCount}/{totalSessions}
                  </div>
                  <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">
                    Series progress: {currentSession || 1}/{totalSessions}
                  </div>
                </div>
                {readySeriesSessions.length > 0 && (
                  <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">
                      Sessions Ready
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {readySeriesSessions.map((session, idx) => (
                        <div
                          key={session.id}
                          className="rounded-lg border border-emerald-800/40 bg-slate-950/30 px-2.5 py-2 text-xs text-emerald-100"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="font-semibold text-emerald-300">
                                Session {session.seriesNumber || idx + 1}:
                              </span>{" "}
                              <span className="text-slate-200">
                                {session.title || `Session ${session.seriesNumber || idx + 1}`}
                              </span>
                            </div>
                            <Link
                              href={`/demo/session?sessionId=${encodeURIComponent(session.id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded-md border border-emerald-600/60 bg-emerald-900/30 px-2 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-800/40"
                            >
                              Open
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
