"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getUserHeaders } from "@/lib/user";

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

export default function PlayerPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.planId as string;

  const [plan, setPlan] = useState<PlayerPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlan = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get access token for authenticated requests
        const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
        const headers: HeadersInit = {};
        
        if (accessToken) {
          headers["Authorization"] = `Bearer ${accessToken}`;
        } else {
          // Fallback to x-user-id for anonymous users (though player plans require auth)
          Object.assign(headers, getUserHeaders());
        }

        const res = await fetch(`/api/player-plans/${planId}`, {
          headers,
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load player plan");
        }

        setPlan(data.plan);
      } catch (e: any) {
        console.error("[PLAYER_PLAN] Fetch error:", e);
        setError(e.message || "Failed to load player plan");
      } finally {
        setLoading(false);
      }
    };

    if (planId) {
      fetchPlan();
    }
  }, [planId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-slate-400">Loading plan...</div>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 text-red-300">
            {error || "Plan not found"}
          </div>
          <Link
            href="/player-plans"
            className="mt-4 inline-block text-cyan-400 hover:text-cyan-300"
          >
            ← Back to Plans
          </Link>
        </div>
      </div>
    );
  }

  const drills = plan.json?.drills || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/player-plans"
            className="text-sm text-cyan-400 hover:text-cyan-300 mb-4 inline-block"
          >
            ← Back to Plans
          </Link>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100 mb-2">{plan.title}</h1>
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
          </div>

          {plan.objectives && (
            <div className="bg-slate-900/70 border border-slate-700/70 rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold text-emerald-400 mb-2">Objectives</h2>
              <p className="text-sm text-slate-300">{plan.objectives}</p>
            </div>
          )}

          {plan.equipment && plan.equipment.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-slate-300 mb-2">Equipment Needed</h2>
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
        </div>

        {/* Drills List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">Exercises</h2>
          {drills.length === 0 ? (
            <div className="text-slate-400 text-center py-8">No exercises in this plan.</div>
          ) : (
            drills.map((drill, index) => (
              <div
                key={index}
                className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-5"
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
                    <h3 className="text-lg font-semibold text-slate-100">{drill.title}</h3>
                    {drill.description && (
                      <p className="text-sm text-slate-300 mt-2">{drill.description}</p>
                    )}
                  </div>
                </div>

                {/* Setup Steps */}
                {drill.organization?.setupSteps && drill.organization.setupSteps.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">
                      Setup & Instructions
                    </h4>
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
                    <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wide mb-2">
                      Self-Coaching Points
                    </h4>
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
                    <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
                      Progressions
                    </h4>
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
