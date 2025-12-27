"use client";

import { useEffect, useState } from "react";

type ProgressStage = {
  label: string;
  description: string;
  minTime: number; // seconds
  maxTime: number; // seconds
};

const STAGES: ProgressStage[] = [
  {
    label: "Preparing request",
    description: "Validating inputs and preparing API call",
    minTime: 0,
    maxTime: 1,
  },
  {
    label: "Generating drill",
    description: "AI is creating your custom drill with tactics and organization",
    minTime: 1,
    maxTime: 50,
  },
  {
    label: "Reviewing quality",
    description: "Evaluating drill structure, clarity, and safety",
    minTime: 50,
    maxTime: 60,
  },
  {
    label: "Finalizing",
    description: "Preparing drill diagram and details for display",
    minTime: 60,
    maxTime: 70,
  },
];

export default function GeneratingAnimation() {
  const [dots, setDots] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    // Animate dots
    const dotsInterval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 500);

    // Track elapsed time and update stage
    const timeInterval = setInterval(() => {
      setElapsed((prev) => {
        const newElapsed = prev + 0.5;
        
        // Update stage based on elapsed time
        for (let i = STAGES.length - 1; i >= 0; i--) {
          if (newElapsed >= STAGES[i].minTime) {
            setCurrentStage(i);
            break;
          }
        }
        
        return newElapsed;
      });
    }, 500);

    return () => {
      clearInterval(dotsInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const stage = STAGES[currentStage];
  const stageProgress = Math.min(
    100,
    Math.max(0, ((elapsed - stage.minTime) / (stage.maxTime - stage.minTime)) * 100)
  );
  
  // Overall progress (0-70 seconds total estimated)
  const estimatedTotal = 70; // seconds
  const totalProgress = Math.min(100, (elapsed / estimatedTotal) * 100);
  
  // Estimate time remaining (conservative estimate)
  const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 w-full max-w-md px-6">
        {/* Spinner */}
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-700 border-t-green-500"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full bg-green-500/20"></div>
          </div>
        </div>

        {/* Main text */}
        <div className="text-center w-full">
          <p className="text-lg font-semibold text-slate-100">
            {stage.label}{dots}
          </p>
          <p className="mt-2 text-sm text-slate-400">{stage.description}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full space-y-2">
          {/* Overall progress bar */}
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500 ease-out"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
          
          {/* Stage indicator */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{Math.round(elapsed)}s elapsed</span>
            {estimatedRemaining > 0 && (
              <span className="text-slate-400">
                ~{Math.round(estimatedRemaining)}s remaining
              </span>
            )}
            {estimatedRemaining <= 0 && (
              <span className="text-slate-400">
                {currentStage + 1} of {STAGES.length}
              </span>
            )}
          </div>
        </div>

        {/* Stage list */}
        <div className="w-full space-y-2">
          {STAGES.map((s, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 text-sm transition-all ${
                idx === currentStage
                  ? "text-green-400"
                  : idx < currentStage
                  ? "text-slate-500"
                  : "text-slate-600"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStage
                    ? "bg-green-500 animate-pulse"
                    : idx < currentStage
                    ? "bg-green-500/50"
                    : "bg-slate-700"
                }`}
              />
              <span className="flex-1">{s.label}</span>
              {idx === currentStage && (
                <span className="text-xs text-slate-500">
                  {Math.round(stageProgress)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

