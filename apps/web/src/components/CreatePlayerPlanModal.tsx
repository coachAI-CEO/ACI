"use client";

import { useState } from "react";
import PlayerPlanViewModal from "./PlayerPlanViewModal";

interface CreatePlayerPlanModalProps {
  sourceType: "SESSION" | "SERIES";
  sourceId: string;
  sourceRefCode?: string | null;
  onClose: () => void;
  onPlanCreated?: (planId: string, sourceId: string, sourceType: "SESSION" | "SERIES") => void;
}

export default function CreatePlayerPlanModal({
  sourceType,
  sourceId,
  sourceRefCode,
  onClose,
  onPlanCreated,
}: CreatePlayerPlanModalProps) {
  const [durationMin, setDurationMin] = useState<number>(45);
  const [focus, setFocus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPlan, setCreatedPlan] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent any default form behavior
    e.preventDefault();
    e.stopPropagation();
    
    if (loading || createdPlan) {
      return; // Prevent double submission or if plan already created
    }
    
    setLoading(true);
    setError(null);

    try {
      // Get access token
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      
      if (!accessToken) {
        setError("You must be logged in to create a player plan. Please log in and try again.");
        setLoading(false);
        return;
      }

      const endpoint =
        sourceType === "SESSION"
          ? `/api/player-plans/from-session/${sourceId}`
          : `/api/player-plans/from-series/${sourceId}`;

      const body: any = {
        durationMin,
      };
      if (focus) {
        body.focus = focus;
      }

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      };

      console.log("[CREATE_PLAYER_PLAN] Creating plan:", { endpoint, sourceId, sourceType });

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        console.error("[CREATE_PLAYER_PLAN] API error:", { status: res.status, data });
        
        if (res.status === 401) {
          setError("Authentication failed. Please log out and log back in, then try again.");
        } else {
          setError(data.error || "Failed to create player plan");
        }
        setLoading(false);
        return;
      }

      const planId = data.id || data.plan?.id;
      
      if (!planId) {
        console.error("[CREATE_PLAYER_PLAN] No plan ID returned from API");
        setError("Plan was created but no ID was returned");
        setLoading(false);
        return;
      }

      // Fetch the full plan details to display in modal
      try {
        const planRes = await fetch(`/api/player-plans/${planId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        
        if (!planRes.ok) {
          const errorData = await planRes.json().catch(() => ({}));
          console.error("[CREATE_PLAYER_PLAN] Failed to fetch plan details:", planRes.status, errorData);
          setError("Plan created but failed to load details. Please refresh and try again.");
          setLoading(false);
          return;
        }

        const planData = await planRes.json();
        if (planData.ok && planData.plan) {
          console.log("[CREATE_PLAYER_PLAN] Plan created successfully, showing in modal");
          // Set the plan first, then stop loading
          setCreatedPlan(planData.plan);
          setLoading(false); // Stop loading state
          
          // Notify parent component that a plan was created (but don't navigate)
          if (onPlanCreated) {
            try {
              onPlanCreated(planId, sourceId, sourceType);
            } catch (err) {
              console.error("[CREATE_PLAYER_PLAN] Error in onPlanCreated callback:", err);
            }
          }
          
          // IMPORTANT: Don't close modal, don't navigate - just show plan in modal
          // The conditional rendering will handle showing PlayerPlanViewModal
          return;
        } else {
          console.error("[CREATE_PLAYER_PLAN] Plan data not in expected format:", planData);
          setError("Plan created but data format is invalid");
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error("[CREATE_PLAYER_PLAN] Error fetching plan details:", e);
        setError("Plan created but failed to load. Please close and view from player plans page.");
        setLoading(false);
        return;
      }
    } catch (e: any) {
      console.error("[CREATE_PLAYER_PLAN] Error:", e);
      setError(e.message || "Failed to create player plan");
      setLoading(false);
    }
  };

  // If plan was created, show it in a view modal
  // This replaces the create form with the plan view, all within the same modal
  if (createdPlan) {
    console.log("[CREATE_PLAYER_PLAN] Rendering PlayerPlanViewModal with plan:", createdPlan.id);
    return (
      <div className="fixed inset-0 z-50">
        <PlayerPlanViewModal
          plan={createdPlan}
          onClose={() => {
            console.log("[CREATE_PLAYER_PLAN] Closing PlayerPlanViewModal, returning to vault");
            setCreatedPlan(null);
            onClose();
          }}
        />
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      onClick={(e) => {
        // Prevent closing when clicking backdrop
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div 
        className="relative max-w-md w-full rounded-2xl border border-slate-700/70 bg-slate-900/90 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-200">Create Player Version</h2>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSubmit(e);
          }}
          className="space-y-4"
          onKeyDown={(e) => {
            // Prevent Enter key from submitting if loading
            if (e.key === "Enter" && loading) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <div>
            <label className="block text-xs text-slate-400 uppercase tracking-wide mb-2">
              Duration (minutes)
            </label>
            <select
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
              disabled={loading}
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 uppercase tracking-wide mb-2">
              Focus Area (optional)
            </label>
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200"
              disabled={loading}
            >
              <option value="">All aspects</option>
              <option value="First Touch">First Touch</option>
              <option value="Finishing">Finishing</option>
              <option value="Fitness">Fitness</option>
            </select>
          </div>

          {error && (
            <div className="rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !!createdPlan}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
