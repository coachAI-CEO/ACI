"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getUserHeaders } from "@/lib/user";

type PlayerPlan = {
  id: string;
  refCode: string | null;
  title: string;
  ageGroup: string;
  playerLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  durationMin: number;
  sourceType: "SESSION" | "SERIES";
  sourceRefCode: string | null;
  createdAt: string;
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

export default function PlayerPlansPage() {
  const [plans, setPlans] = useState<PlayerPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<"ALL" | "SESSION" | "SERIES">("ALL");

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (sourceTypeFilter !== "ALL") {
        params.append("sourceType", sourceTypeFilter);
      }

      // Get access token for authenticated requests
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = {};
      
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      } else {
        // Fallback to x-user-id for anonymous users (though player plans require auth)
        Object.assign(headers, getUserHeaders());
      }

      const res = await fetch(`/api/player-plans?${params.toString()}`, {
        headers,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load player plans");
      }

      setPlans(data.plans || []);
    } catch (e: any) {
      console.error("[PLAYER_PLANS] Fetch error:", e);
      setError(e.message || "Failed to load player plans");
    } finally {
      setLoading(false);
    }
  }, [sourceTypeFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">My Player Plans</h1>
          <div className="text-slate-400">Loading plans...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">My Player Plans</h1>
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 text-red-300">
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Player Plans</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSourceTypeFilter("ALL")}
              className={`px-3 py-1 rounded text-sm ${
                sourceTypeFilter === "ALL"
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSourceTypeFilter("SESSION")}
              className={`px-3 py-1 rounded text-sm ${
                sourceTypeFilter === "SESSION"
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              Sessions
            </button>
            <button
              onClick={() => setSourceTypeFilter("SERIES")}
              className={`px-3 py-1 rounded text-sm ${
                sourceTypeFilter === "SERIES"
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              Series
            </button>
          </div>
        </div>

        {plans.length === 0 ? (
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-8 text-center">
            <p className="text-slate-400 mb-4">No player plans yet.</p>
            <p className="text-sm text-slate-500">
              Create a player plan from a session or series in the Vault.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <Link
                key={plan.id}
                href={`/player-plans/${plan.id}`}
                className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4 hover:border-cyan-500/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-slate-200 flex-1">{plan.title}</h3>
                  {plan.refCode && (
                    <span className="px-2 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-[10px] font-mono border border-cyan-700/30 ml-2">
                      {plan.refCode}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>{plan.ageGroup}</span>
                    {plan.playerLevel && (
                      <>
                        <span>•</span>
                        <span
                          className={`px-2 py-0.5 rounded ${
                            playerLevelColors[plan.playerLevel]?.bg || "bg-slate-800"
                          } ${playerLevelColors[plan.playerLevel]?.text || "text-slate-300"} border ${
                            playerLevelColors[plan.playerLevel]?.border || "border-slate-700"
                          }`}
                        >
                          {playerLevelLabel[plan.playerLevel] || plan.playerLevel}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span>{plan.durationMin} min</span>
                    <span>•</span>
                    <span className="capitalize">{plan.sourceType.toLowerCase()}</span>
                    {plan.sourceRefCode && (
                      <>
                        <span>•</span>
                        <span className="text-cyan-400 font-mono">{plan.sourceRefCode}</span>
                      </>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-500 mt-3">
                    Created {new Date(plan.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
