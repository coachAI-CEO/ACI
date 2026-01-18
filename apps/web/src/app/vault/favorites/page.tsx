"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getUserId, getUserHeaders } from "@/lib/user";

type FavoriteSession = {
  id: string;
  refCode?: string;
  title: string;
  gameModelId: string;
  ageGroup: string;
  phase?: string;
  zone?: string;
  durationMin?: number;
  formationUsed?: string;
  favoriteCount: number;
  createdAt: string;
  json: any;
};

type FavoriteDrill = {
  id: string;
  refCode?: string;
  title: string;
  gameModelId: string;
  ageGroup: string;
  phase: string;
  zone: string;
  durationMin?: number;
  drillType?: string;
  favoriteCount: number;
  createdAt: string;
  json: any;
};

type FavoriteSeries = {
  seriesId: string;
  sessions: FavoriteSession[];
  totalSessions: number;
  createdAt?: string;
  gameModelId: string;
  ageGroup: string;
  favoriteCount: number;
};

const gameModelLabel: Record<string, string> = {
  POSSESSION: "Possession",
  PRESSING: "Pressing",
  TRANSITION: "Transition",
  COACHAI: "Balanced",
};

const phaseLabel: Record<string, string> = {
  ATTACKING: "Attacking",
  DEFENDING: "Defending",
  TRANSITION: "Transition",
  TRANSITION_TO_ATTACK: "Transition to Attack",
  TRANSITION_TO_DEFEND: "Transition to Defend",
};

const zoneLabel: Record<string, string> = {
  DEFENSIVE_THIRD: "Defensive Third",
  MIDDLE_THIRD: "Middle Third",
  ATTACKING_THIRD: "Attacking Third",
};

const drillTypeLabel: Record<string, string> = {
  WARMUP: "Warm-up",
  TECHNICAL: "Technical",
  TACTICAL: "Tactical",
  CONDITIONED_GAME: "Conditioned Game",
  COOLDOWN: "Cool-down",
};

export default function FavoritesPage() {
  const [sessions, setSessions] = useState<FavoriteSession[]>([]);
  const [drills, setDrills] = useState<FavoriteDrill[]>([]);
  const [series, setSeries] = useState<FavoriteSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "sessions" | "drills" | "series">("all");

  // Filters
  const [filters, setFilters] = useState({
    gameModelId: "",
    ageGroup: "",
    phase: "",
  });

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.gameModelId) params.set("gameModelId", filters.gameModelId);
      if (filters.ageGroup) params.set("ageGroup", filters.ageGroup);
      if (filters.phase) params.set("phase", filters.phase);

      const res = await fetch(`/api/favorites?${params.toString()}`, {
        headers: getUserHeaders(),
      });

      if (!res.ok) {
        throw new Error("Failed to load favorites");
      }

      const data = await res.json();
      setSessions(data.sessions || []);
      setDrills(data.drills || []);
      setSeries(data.series || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const removeFavorite = async (type: "session" | "drill" | "series", id: string) => {
    try {
      const res = await fetch(`/api/favorites/${type}/${id}`, {
        method: "DELETE",
        headers: getUserHeaders(),
      });

      if (res.ok) {
        // Reload favorites
        loadFavorites();
      }
    } catch (e) {
      console.error("Error removing favorite:", e);
    }
  };

  // Filter items based on active tab
  const filteredSessions = activeTab === "all" || activeTab === "sessions" ? sessions : [];
  const filteredDrills = activeTab === "all" || activeTab === "drills" ? drills : [];
  const filteredSeries = activeTab === "all" || activeTab === "series" ? series : [];

  const totalCount = sessions.length + drills.length + series.length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Favorites</h1>
            <p className="text-sm text-slate-400 mt-1">
              {totalCount} item{totalCount !== 1 ? "s" : ""} saved
            </p>
          </div>
          <Link
            href="/vault"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            Back to Vault
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700/70 pb-3">
          {(["all", "sessions", "drills", "series"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                activeTab === tab
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-2 text-xs opacity-70">
                ({tab === "all" ? totalCount : tab === "sessions" ? sessions.length : tab === "drills" ? drills.length : series.length})
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filters.gameModelId}
            onChange={(e) => setFilters({ ...filters, gameModelId: e.target.value })}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200"
          >
            <option value="">All Game Models</option>
            <option value="POSSESSION">Possession</option>
            <option value="PRESSING">Pressing</option>
            <option value="TRANSITION">Transition</option>
            <option value="COACHAI">Balanced</option>
          </select>

          <select
            value={filters.ageGroup}
            onChange={(e) => setFilters({ ...filters, ageGroup: e.target.value })}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200"
          >
            <option value="">All Age Groups</option>
            <option value="U8">U8</option>
            <option value="U10">U10</option>
            <option value="U12">U12</option>
            <option value="U14">U14</option>
            <option value="U16">U16</option>
            <option value="U18">U18</option>
            <option value="Adult">Adult</option>
          </select>

          <select
            value={filters.phase}
            onChange={(e) => setFilters({ ...filters, phase: e.target.value })}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200"
          >
            <option value="">All Phases</option>
            <option value="ATTACKING">Attacking</option>
            <option value="DEFENDING">Defending</option>
            <option value="TRANSITION">Transition</option>
          </select>

          {(filters.gameModelId || filters.ageGroup || filters.phase) && (
            <button
              onClick={() => setFilters({ gameModelId: "", ageGroup: "", phase: "" })}
              className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading favorites...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">{error}</div>
        ) : totalCount === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 mb-4">No favorites yet.</p>
            <Link
              href="/vault"
              className="text-emerald-400 hover:text-emerald-300 underline"
            >
              Browse the vault to add favorites
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Sessions */}
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 text-[10px] font-semibold">
                        SESSION
                      </span>
                      {session.refCode && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-[9px] font-mono border border-cyan-700/30">
                          {session.refCode}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm text-slate-200 leading-tight">
                      {session.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => removeFavorite("session", session.id)}
                    className="text-red-400 hover:text-red-300 text-lg"
                    title="Remove from favorites"
                  >
                    ♥
                  </button>
                </div>
                <div className="text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">{gameModelLabel[session.gameModelId]}</span>
                    <span>•</span>
                    <span>{session.ageGroup}</span>
                    {session.durationMin && (
                      <>
                        <span>•</span>
                        <span>{session.durationMin} min</span>
                      </>
                    )}
                  </div>
                  {(session.phase || session.zone) && (
                    <div className="flex items-center gap-2">
                      {session.phase && <span>{phaseLabel[session.phase]}</span>}
                      {session.phase && session.zone && <span>•</span>}
                      {session.zone && <span>{zoneLabel[session.zone]}</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-pink-400">♥ {session.favoriteCount}</span>
                    <Link
                      href={`/demo/session?sessionId=${session.id}`}
                      className="text-emerald-400 hover:text-emerald-300 ml-auto"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              </div>
            ))}

            {/* Drills */}
            {filteredDrills.map((drill) => (
              <div
                key={drill.id}
                className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-purple-900/40 text-purple-300 text-[10px] font-semibold">
                        DRILL
                      </span>
                      {drill.refCode && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-[9px] font-mono border border-cyan-700/30">
                          {drill.refCode}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm text-slate-200 leading-tight">
                      {drill.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => removeFavorite("drill", drill.id)}
                    className="text-red-400 hover:text-red-300 text-lg"
                    title="Remove from favorites"
                  >
                    ♥
                  </button>
                </div>
                <div className="text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">{gameModelLabel[drill.gameModelId]}</span>
                    <span>•</span>
                    <span>{drill.ageGroup}</span>
                    {drill.drillType && (
                      <>
                        <span>•</span>
                        <span>{drillTypeLabel[drill.drillType] || drill.drillType}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{phaseLabel[drill.phase]}</span>
                    <span>•</span>
                    <span>{zoneLabel[drill.zone]}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-pink-400">♥ {drill.favoriteCount}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Series */}
            {filteredSeries.map((s) => {
              const firstSession = s.sessions[0];
              return (
                <div
                  key={s.seriesId}
                  className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 text-[10px] font-semibold">
                          SERIES
                        </span>
                        {firstSession?.refCode && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-[9px] font-mono border border-cyan-700/30">
                            {firstSession.refCode}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm text-slate-200 leading-tight">
                        {firstSession?.title || `${s.totalSessions}-Session Series`}
                      </h3>
                    </div>
                    <button
                      onClick={() => removeFavorite("series", s.seriesId)}
                      className="text-red-400 hover:text-red-300 text-lg"
                      title="Remove from favorites"
                    >
                      ♥
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400">{gameModelLabel[s.gameModelId]}</span>
                      <span>•</span>
                      <span>{s.ageGroup}</span>
                      <span>•</span>
                      <span>{s.totalSessions} sessions</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-pink-400">♥ {s.favoriteCount}</span>
                      <Link
                        href={`/demo/session?seriesId=${s.seriesId}`}
                        className="text-emerald-400 hover:text-emerald-300 ml-auto"
                      >
                        View Series →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
