"use client";

import { useEffect, useMemo, useState } from "react";

const DRILL_FLOW_STEPS = [
  {
    id: "objective",
    title: "Framing the Objective",
    details: [
      "Aligning phase, zone, and age context",
      "Checking tactical intent for this drill",
      "Setting drill outcome before build",
    ],
  },
  {
    id: "structure",
    title: "Drafting Drill Structure",
    details: [
      "Building players, space, and constraints",
      "Sequencing actions and game references",
      "Shaping coaching points and progressions",
    ],
  },
  {
    id: "diagram",
    title: "Composing Diagram Layers",
    details: [
      "Adding tactical arrows and safe zones",
      "Placing annotations with readable contrast",
      "Validating positions and field orientation",
    ],
  },
  {
    id: "validation",
    title: "Tactical Validation",
    details: [
      "Checking clarity and execution realism",
      "Reviewing drill quality and safety",
      "Ensuring coaching usability",
    ],
  },
  {
    id: "final",
    title: "Finalizing Drill Plan",
    details: [
      "Packaging final drill output",
      "Rendering cards and tactical visuals",
      "Preparing result for coach review",
    ],
  },
] as const;

const STEP_WINDOWS = [2, 5, 9, 13, 18];

export default function GeneratingAnimation() {
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [detailIndex, setDetailIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(id);
  }, [startTime]);

  useEffect(() => {
    const id = setInterval(() => {
      setDetailIndex((prev) => prev + 1);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const elapsedSeconds = Math.floor(elapsed / 1000);
  const activeStepIndex = STEP_WINDOWS.findIndex((limit) => elapsedSeconds < limit);
  const normalizedStepIndex =
    activeStepIndex === -1 ? DRILL_FLOW_STEPS.length - 1 : activeStepIndex;
  const completedCount = normalizedStepIndex;
  const progressPercent = Math.min(
    100,
    Math.round(((completedCount + 0.35) / DRILL_FLOW_STEPS.length) * 100)
  );
  const activeStep = DRILL_FLOW_STEPS[normalizedStepIndex];
  const activeDetail = activeStep.details[detailIndex % activeStep.details.length];

  const currentLabel = useMemo(() => "Generating drill...", []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-6 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-3xl border border-slate-700/70 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-6 text-slate-50 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{currentLabel}</h2>
          <div className="text-xs text-slate-400">{elapsedSeconds}s elapsed</div>
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
              {DRILL_FLOW_STEPS.map((step, i) => {
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
            <div className="mt-2 text-2xl font-semibold text-slate-100">{activeStep.title}</div>
            <p className="mt-3 min-h-6 text-sm text-slate-300 transition-opacity duration-300">
              {activeDetail}
            </p>
            <div className="mt-5 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-300">Building with coach-style validation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
