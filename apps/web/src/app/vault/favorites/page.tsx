"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getUserId, getUserHeaders } from "@/lib/user";
import DrillDiagram from "@/components/DrillDiagram";
import DrillDiagramCard from "@/components/DrillDiagramCard";
import ScheduleSessionModal from "@/components/ScheduleSessionModal";
import ScheduleSeriesModal from "@/components/ScheduleSeriesModal";

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

const coachLevelLabel: Record<string, string> = {
  GRASSROOTS: "Grassroots",
  USSF_C: "USSF C",
  USSF_B_PLUS: "USSF B+",
};

const playerLevelLabel: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
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

export default function FavoritesPage() {
  const [sessions, setSessions] = useState<FavoriteSession[]>([]);
  const [drills, setDrills] = useState<FavoriteDrill[]>([]);
  const [series, setSeries] = useState<FavoriteSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "sessions" | "drills" | "series">("all");
  const [selectedDrill, setSelectedDrill] = useState<FavoriteDrill | null>(null);
  const [selectedSession, setSelectedSession] = useState<FavoriteSession | null>(null);
  const [scheduleModal, setScheduleModal] = useState<{
    sessionId: string;
    sessionTitle: string;
    sessionRefCode?: string | null;
  } | null>(null);
  const [scheduleSeriesModal, setScheduleSeriesModal] = useState<{
    seriesId: string;
    seriesTitle: string;
    sessions: Array<{ id: string; title: string; refCode?: string | null }>;
  } | null>(null);

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

      // Get access token for authenticated requests
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = {};
      
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      } else {
        // Fallback to x-user-id for anonymous users
        Object.assign(headers, getUserHeaders());
      }

      const res = await fetch(`/api/favorites?${params.toString()}`, {
        headers,
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
      // Get access token for authenticated requests
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = {};
      
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      } else {
        // Fallback to x-user-id for anonymous users
        Object.assign(headers, getUserHeaders());
      }

      const res = await fetch(`/api/favorites/${type}/${id}`, {
        method: "DELETE",
        headers,
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
          {(["all", "drills", "sessions", "series"] as const).map((tab) => (
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
                    className="w-6 h-6 flex items-center justify-center rounded border bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                    title="Remove from favorites"
                  >
                    <span className="text-xs font-bold">■</span>
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
                    <span className="text-emerald-400">■ {drill.favoriteCount}</span>
                    <button
                      onClick={() => setSelectedDrill(drill)}
                      className="text-emerald-400 hover:text-emerald-300 ml-auto"
                    >
                      View →
                    </button>
                  </div>
                </div>
              </div>
            ))}

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
                    className="w-6 h-6 flex items-center justify-center rounded border bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                    title="Remove from favorites"
                  >
                    <span className="text-xs font-bold">■</span>
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
                    <span className="text-emerald-400">■ {session.favoriteCount}</span>
                    <button
                      onClick={() => setSelectedSession(session)}
                      className="text-emerald-400 hover:text-emerald-300 ml-auto"
                    >
                      View →
                    </button>
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
                      className="w-6 h-6 flex items-center justify-center rounded border bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                      title="Remove from favorites"
                    >
                      <span className="text-xs font-bold">■</span>
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
                      <span className="text-emerald-400">■ {s.favoriteCount}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // For series, open series scheduling modal
                          setScheduleSeriesModal({
                            seriesId: s.seriesId,
                            seriesTitle: s.sessions[0]?.title 
                              ? s.sessions[0].title.replace(/^(Session \d+:?\s*)/i, "").replace(/\s*-\s*Part\s*\d+/i, "").trim()
                              : `${s.totalSessions}-Session Series`,
                            sessions: s.sessions.map((sess) => ({
                              id: sess.id,
                              title: sess.title || `Session ${s.sessions.indexOf(sess) + 1}`,
                              refCode: sess.refCode || undefined,
                            })),
                          });
                        }}
                        className="px-2 py-1 rounded text-[10px] font-semibold bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/30 transition-colors"
                        title="Schedule Series"
                      >
                        📅
                      </button>
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

        {/* Session Detail Modal */}
        {selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-700/70 bg-slate-900/90 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-lg font-semibold text-slate-200">{selectedSession.title}</h2>
                    {selectedSession.refCode && (
                      <button
                        onClick={() => navigator.clipboard.writeText(selectedSession.refCode!)}
                        className="px-2 py-1 rounded bg-cyan-900/40 text-cyan-300 text-xs font-mono border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors"
                        title="Click to copy reference code"
                      >
                        {selectedSession.refCode}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Game Model:</span>
                      <span className="text-emerald-400">{gameModelLabel[selectedSession.gameModelId]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Age:</span>
                      <span className="text-slate-200">{selectedSession.ageGroup}</span>
                    </div>
                    {selectedSession.phase && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Phase:</span>
                        <span className="text-slate-200">{phaseLabel[selectedSession.phase]}</span>
                      </div>
                    )}
                    {selectedSession.zone && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Zone:</span>
                        <span className="text-slate-200">{zoneLabel[selectedSession.zone]}</span>
                      </div>
                    )}
                    {selectedSession.formationUsed && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Formation:</span>
                        <span className="text-blue-300">{selectedSession.formationUsed}</span>
                      </div>
                    )}
                    {selectedSession.durationMin && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Duration:</span>
                        <span className="text-slate-200">{selectedSession.durationMin} min</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500"
                  aria-label="Close preview"
                >
                  ✕
                </button>
              </div>

              <div className="mt-6 space-y-6">
                {selectedSession.json?.summary && (
                  <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                    <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">Summary</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {selectedSession.json.summary}
                    </p>
                  </div>
                )}

                {selectedSession.json?.drills && selectedSession.json.drills.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">Drills</h3>
                    {selectedSession.json.drills.map((drill: any, i: number) => (
                      <div key={i} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                        {/* Drill Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${
                            drillTypeColors[drill.drillType]?.bg || "bg-slate-800"
                          } ${drillTypeColors[drill.drillType]?.text || "text-slate-300"} border ${
                            drillTypeColors[drill.drillType]?.border || "border-slate-700"
                          }`}>
                            {drillTypeLabel[drill.drillType] || drill.drillType}
                          </span>
                          {drill.durationMin && (
                            <span className="text-[10px] text-slate-500">{drill.durationMin} min</span>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm text-slate-200 mb-2">{drill.title}</h4>
                        
                        {/* Two-column layout: Diagram + Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Left: Diagram */}
                          {drill.diagram && (
                            <div className="flex items-center justify-center">
                              <DrillDiagram
                                diagram={drill.diagram}
                                width={220}
                                height={140}
                              />
                            </div>
                          )}
                          
                          {/* Right: Description & Key Info */}
                          <div className="space-y-2">
                            {drill.description && (
                              <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-4">{drill.description}</p>
                            )}
                            {drill.organization?.area && (
                              <div className="flex gap-2 text-[10px] text-slate-400">
                                {drill.organization.area.lengthYards && (
                                  <span>{drill.organization.area.lengthYards}x{drill.organization.area.widthYards || '?'}y</span>
                                )}
                              </div>
                            )}
                            {drill.coachingPoints && drill.coachingPoints.length > 0 && (
                              <div>
                                <span className="text-[9px] text-slate-500 uppercase">Key Points:</span>
                                <ul className="text-[10px] text-slate-400 mt-1">
                                  {drill.coachingPoints.slice(0, 2).map((pt: string, j: number) => (
                                    <li key={j} className="truncate">• {pt}</li>
                                  ))}
                                  {drill.coachingPoints.length > 2 && (
                                    <li className="text-slate-500">+{drill.coachingPoints.length - 2} more</li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-700/50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSession(null);
                      setScheduleModal({
                        sessionId: selectedSession.id,
                        sessionTitle: selectedSession.title,
                        sessionRefCode: selectedSession.refCode || undefined,
                      });
                    }}
                    className="inline-flex items-center rounded-full border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-500/20 transition-colors"
                  >
                    📅 Schedule Session
                  </button>
                  <Link
                    href={`/demo/session?sessionId=${selectedSession.id}`}
                    className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    View Full Session →
                  </Link>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Drill Detail Modal */}
        {selectedDrill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-700/70 bg-slate-900/90 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Drill Type Badge & Duration */}
                  <div className="flex items-center gap-2 mb-2">
                    {selectedDrill.drillType && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        selectedDrill.drillType === "WARMUP" ? "bg-orange-900/40 text-orange-300 border border-orange-700/30" :
                        selectedDrill.drillType === "TECHNICAL" ? "bg-blue-900/40 text-blue-300 border border-blue-700/30" :
                        selectedDrill.drillType === "TACTICAL" ? "bg-purple-900/40 text-purple-300 border border-purple-700/30" :
                        selectedDrill.drillType === "CONDITIONED_GAME" ? "bg-green-900/40 text-green-300 border border-green-700/30" :
                        selectedDrill.drillType === "COOLDOWN" ? "bg-cyan-900/40 text-cyan-300 border border-cyan-700/30" :
                        "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}>
                        {drillTypeLabel[selectedDrill.drillType] || selectedDrill.drillType}
                      </span>
                    )}
                    {selectedDrill.durationMin && selectedDrill.durationMin > 0 && (
                      <span className="text-sm text-slate-400">{selectedDrill.durationMin} minutes</span>
                    )}
                  </div>

                  <h2 className="text-lg font-semibold mb-3 text-slate-200">{selectedDrill.title}</h2>

                  {/* Drill Info */}
                  <div className="flex flex-wrap gap-3 text-sm mb-4 pb-4 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Topic:</span>
                      <span className="text-emerald-400">{gameModelLabel[selectedDrill.gameModelId]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Age:</span>
                      <span className="text-slate-200">{selectedDrill.ageGroup}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Phase:</span>
                      <span className="text-slate-200">{phaseLabel[selectedDrill.phase]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Zone:</span>
                      <span className="text-slate-200">{zoneLabel[selectedDrill.zone]}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDrill(null)}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                  title="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Diagram */}
                {selectedDrill.json?.diagram && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Diagram</h3>
                    <div className="flex items-center justify-center">
                      <DrillDiagram
                        diagram={selectedDrill.json.diagram}
                        width={280}
                        height={180}
                      />
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedDrill.json?.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-1">Description</h3>
                    <p className="text-xs text-slate-400">{selectedDrill.json.description}</p>
                  </div>
                )}

                {/* Organization */}
                {selectedDrill.json?.organization && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-300">Organization</h3>
                    {typeof selectedDrill.json.organization === "string" ? (
                      <p className="text-xs text-slate-400 whitespace-pre-wrap">{selectedDrill.json.organization}</p>
                    ) : (
                      <div className="text-xs text-slate-400 space-y-2">
                        {selectedDrill.json.organization.area && (
                          <div className="flex gap-3">
                            {selectedDrill.json.organization.area.lengthYards && (
                              <span>
                                <span className="text-slate-500">Length:</span> {selectedDrill.json.organization.area.lengthYards}y
                              </span>
                            )}
                            {selectedDrill.json.organization.area.widthYards && (
                              <span>
                                <span className="text-slate-500">Width:</span> {selectedDrill.json.organization.area.widthYards}y
                              </span>
                            )}
                          </div>
                        )}
                        {selectedDrill.json.organization.rotation && (
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Rotation:</span>
                            <p className="text-xs text-slate-400">{selectedDrill.json.organization.rotation}</p>
                          </div>
                        )}
                        {selectedDrill.json.organization.scoring && (
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Scoring:</span>
                            <p className="text-xs text-slate-400">{selectedDrill.json.organization.scoring}</p>
                          </div>
                        )}
                        {selectedDrill.json.organization.setupSteps && selectedDrill.json.organization.setupSteps.length > 0 && (
                          <div>
                            <h4 className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Setup Steps</h4>
                            <ol className="list-decimal list-inside space-y-1">
                              {selectedDrill.json.organization.setupSteps.map((step: string, i: number) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Coaching Points & Progressions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedDrill.json?.coachingPoints && selectedDrill.json.coachingPoints.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-300 mb-2">Coaching Points</h3>
                      <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                        {selectedDrill.json.coachingPoints.map((point: string, i: number) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedDrill.json?.progressions && selectedDrill.json.progressions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-300 mb-2">Progressions</h3>
                      <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1">
                        {selectedDrill.json.progressions.map((prog: string, i: number) => (
                          <li key={i}>{prog}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex gap-3 pt-4 border-t border-slate-700/50">
                  {selectedDrill.refCode && (
                    <Link
                      href={`/vault?search=${encodeURIComponent(selectedDrill.refCode)}`}
                      className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      View Full Drill →
                    </Link>
                  )}
                  <button
                    onClick={() => setSelectedDrill(null)}
                    className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Session Modal */}
        {scheduleModal && (
          <ScheduleSessionModal
            sessionId={scheduleModal.sessionId}
            sessionTitle={scheduleModal.sessionTitle}
            sessionRefCode={scheduleModal.sessionRefCode}
            onClose={() => setScheduleModal(null)}
            onScheduled={() => {
              console.log("[FAVORITES] Session scheduled successfully");
            }}
          />
        )}
        {/* Schedule Series Modal */}
        {scheduleSeriesModal && (
          <ScheduleSeriesModal
            seriesId={scheduleSeriesModal.seriesId}
            seriesTitle={scheduleSeriesModal.seriesTitle}
            sessions={scheduleSeriesModal.sessions}
            onClose={() => setScheduleSeriesModal(null)}
            onScheduled={() => {
              console.log("[FAVORITES] Series scheduled successfully");
            }}
          />
        )}
      </div>
    </main>
  );
}
