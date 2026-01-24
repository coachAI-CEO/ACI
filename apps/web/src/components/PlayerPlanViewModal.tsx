"use client";

import { useState } from "react";

type AdaptedDrill = {
  drillType: string;
  title: string;
  description?: string;
  durationMin?: number;
  organization?: {
    setupSteps?: string[];
    area?: { lengthYards?: number; widthYards?: number; notes?: string };
    equipment?: string[];
    reps?: string;
    rest?: string;
  };
  coachingPoints?: string[];
  progressions?: string[];
  sessionNumber?: number;
  sessionTitle?: string;
};

type PlayerPlan = {
  id: string;
  refCode: string | null;
  title: string;
  ageGroup: string;
  playerLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  objectives: string | null;
  durationMin: number;
  sourceType: "SESSION" | "SERIES";
  sourceId: string;
  sourceRefCode: string | null;
  equipment: string[] | null;
  json: {
    drills: AdaptedDrill[];
    source?: any;
  };
  createdAt: string;
};

interface PlayerPlanViewModalProps {
  plan: PlayerPlan;
  onClose: () => void;
}

const drillTypeLabel: Record<string, string> = {
  WARMUP: "Warm-up",
  TECHNICAL: "Technical",
  TACTICAL: "Tactical",
  CONDITIONED_GAME: "Conditioned Game",
  COOLDOWN: "Cool-down",
};

const drillTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  WARMUP: { bg: "bg-yellow-900/30", text: "text-yellow-300", border: "border-yellow-700/30" },
  TECHNICAL: { bg: "bg-blue-900/30", text: "text-blue-300", border: "border-blue-700/30" },
  TACTICAL: { bg: "bg-purple-900/30", text: "text-purple-300", border: "border-purple-700/30" },
  CONDITIONED_GAME: { bg: "bg-orange-900/30", text: "text-orange-300", border: "border-orange-700/30" },
  COOLDOWN: { bg: "bg-cyan-900/30", text: "text-cyan-300", border: "border-cyan-700/30" },
};

const playerLevelLabel: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const playerLevelColors: Record<string, { bg: string; text: string; border: string }> = {
  BEGINNER: { bg: "bg-blue-900/30", text: "text-blue-300", border: "border-blue-700/30" },
  INTERMEDIATE: { bg: "bg-purple-900/30", text: "text-purple-300", border: "border-purple-700/30" },
  ADVANCED: { bg: "bg-amber-900/30", text: "text-amber-300", border: "border-amber-700/30" },
};

export default function PlayerPlanViewModal({ plan, onClose }: PlayerPlanViewModalProps) {
  const [exporting, setExporting] = useState(false);
  const drills = plan.json?.drills || [];

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!accessToken) {
        alert("You must be logged in to export PDF");
        return;
      }

      const res = await fetch(`/api/player-plans/${plan.id}/export-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to export PDF");
      }

      // Download the PDF
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${plan.title.replace(/[^a-z0-9]/gi, "_")}_player_plan.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      console.error("[PLAYER_PLAN_PDF] Export error:", e);
      alert(e.message || "Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 overflow-y-auto"
      onClick={(e) => {
        // Prevent closing when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="relative max-w-4xl w-full rounded-2xl border border-slate-700/70 bg-slate-900/95 p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6 sticky top-0 bg-slate-900/95 pb-4 border-b border-slate-700/50">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">{plan.title}</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {plan.refCode && (
                <span className="px-2 py-1 rounded bg-cyan-900/40 text-cyan-300 text-xs font-mono border border-cyan-700/30">
                  {plan.refCode}
                </span>
              )}
              <span className="text-slate-400">{plan.ageGroup}</span>
              {plan.playerLevel && (
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    playerLevelColors[plan.playerLevel]?.bg || "bg-slate-800"
                  } ${playerLevelColors[plan.playerLevel]?.text || "text-slate-300"} border ${
                    playerLevelColors[plan.playerLevel]?.border || "border-slate-700"
                  }`}
                >
                  {playerLevelLabel[plan.playerLevel] || plan.playerLevel}
                </span>
              )}
              <span className="text-slate-400">{plan.durationMin} min</span>
              {plan.sourceRefCode && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">
                    Source: <span className="text-cyan-400 font-mono">{plan.sourceRefCode}</span>
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50"
            >
              {exporting ? "Exporting..." : "Print to PDF"}
            </button>
            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Objectives */}
        {plan.objectives && (
          <div className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-emerald-400 mb-2">Objectives</h3>
            <p className="text-sm text-slate-300">{plan.objectives}</p>
          </div>
        )}

        {/* Equipment */}
        {plan.equipment && plan.equipment.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Equipment Needed</h3>
            <div className="flex flex-wrap gap-2">
              {plan.equipment.map((eq, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded bg-slate-800/60 border border-slate-700/60 text-sm text-slate-300"
                >
                  {eq}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Drills List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200">Exercises</h3>
          {drills.length === 0 ? (
            <div className="text-slate-400 text-center py-8">No exercises in this plan.</div>
          ) : (
            drills.map((drill, index) => (
              <div
                key={index}
                className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          drillTypeColors[drill.drillType]?.bg || "bg-slate-800"
                        } ${drillTypeColors[drill.drillType]?.text || "text-slate-300"} border ${
                          drillTypeColors[drill.drillType]?.border || "border-slate-700"
                        }`}
                      >
                        {drillTypeLabel[drill.drillType] || drill.drillType}
                      </span>
                      {drill.sessionNumber && (
                        <span className="text-xs text-slate-500">
                          Session {drill.sessionNumber}
                        </span>
                      )}
                      {drill.durationMin && (
                        <span className="text-xs text-slate-400">{drill.durationMin} min</span>
                      )}
                    </div>
                    <h4 className="text-lg font-semibold text-slate-100">{drill.title}</h4>
                    {drill.description && (
                      <p className="text-sm text-slate-300 mt-2">{drill.description}</p>
                    )}
                  </div>
                </div>

                {/* Setup Steps */}
                {drill.organization?.setupSteps && drill.organization.setupSteps.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">
                      Setup & Instructions
                    </h5>
                    <ol className="space-y-2">
                      {drill.organization.setupSteps.map((step: string, i: number) => (
                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-emerald-400 font-semibold mt-0.5">{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Area & Equipment */}
                {(drill.organization?.area || drill.organization?.equipment) && (
                  <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                    {drill.organization.area && (
                      <div>
                        <span className="text-slate-400">Area: </span>
                        <span className="text-slate-200">
                          {drill.organization.area.lengthYards &&
                          drill.organization.area.widthYards
                            ? `${drill.organization.area.lengthYards} x ${drill.organization.area.widthYards} yards`
                            : drill.organization.area.notes || "Small space"}
                        </span>
                      </div>
                    )}
                    {drill.organization.equipment && drill.organization.equipment.length > 0 && (
                      <div>
                        <span className="text-slate-400">Equipment: </span>
                        <span className="text-slate-200">
                          {drill.organization.equipment.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Reps & Rest */}
                {(drill.organization?.reps || drill.organization?.rest) && (
                  <div className="mt-3 flex gap-4 text-xs">
                    {drill.organization.reps && (
                      <div>
                        <span className="text-slate-400">Reps: </span>
                        <span className="text-slate-200 font-semibold">
                          {drill.organization.reps}
                        </span>
                      </div>
                    )}
                    {drill.organization.rest && (
                      <div>
                        <span className="text-slate-400">Rest: </span>
                        <span className="text-slate-200">{drill.organization.rest}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Coaching Points */}
                {drill.coachingPoints && drill.coachingPoints.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-xs font-semibold text-cyan-400 uppercase tracking-wide mb-2">
                      Self-Coaching Points
                    </h5>
                    <ul className="space-y-1">
                      {drill.coachingPoints.map((point: string, i: number) => (
                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-cyan-400 mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Progressions */}
                {drill.progressions && drill.progressions.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
                      Progressions
                    </h5>
                    <ul className="space-y-1">
                      {drill.progressions.map((prog: string, i: number) => (
                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-amber-400 mt-1">{i + 1}.</span>
                          <span>{prog}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
