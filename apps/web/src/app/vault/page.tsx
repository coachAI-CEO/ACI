"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DrillDiagramCard from "@/components/DrillDiagramCard";
import DrillDiagram from "@/components/DrillDiagram";

type VaultSession = {
  id: string;
  title: string;
  gameModelId: string;
  ageGroup: string;
  phase?: string;
  zone?: string;
  durationMin?: number;
  approved: boolean;
  isSeries: boolean;
  seriesId?: string;
  seriesNumber?: number;
  createdAt: string;
  json: any;
  formationUsed?: string;
  playerLevel?: string;
  coachLevel?: string;
  numbersMin?: number;
  numbersMax?: number;
};

type VaultSeries = {
  seriesId: string;
  sessions: VaultSession[];
  totalSessions: number;
  createdAt?: string;
  gameModelId: string;
  ageGroup: string;
};

type VaultDrill = {
  id: string; // generated: sessionId-drillIndex
  drillType: string;
  title: string;
  description: string;
  durationMin: number;
  organization?: any;
  progressions?: string[];
  coachingPoints?: string[];
  diagram?: any;
  // Parent session info
  sessionId: string;
  sessionTitle: string;
  sessionAgeGroup: string;
  sessionGameModelId: string;
  sessionPhase?: string;
  sessionZone?: string;
  sessionFormation?: string;
  sessionCreatedAt: string;
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
};

const zoneLabel: Record<string, string> = {
  DEFENSIVE_THIRD: "Defensive Third",
  MIDDLE_THIRD: "Middle Third",
  ATTACKING_THIRD: "Attacking Third",
};

const playerLevelLabel: Record<string, string> = {
  BEGINNER: "Beginner",
  DEVELOPING: "Developing",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  ELITE: "Elite",
};

const coachLevelLabel: Record<string, string> = {
  ENTRY: "Entry",
  GRASSROOTS: "Grassroots",
  QUALIFIED: "Qualified",
  ADVANCED: "Advanced",
  ELITE: "Elite",
};

export default function VaultPage() {
  const [sessions, setSessions] = useState<VaultSession[]>([]);
  const [series, setSeries] = useState<VaultSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sessions" | "series" | "drills">("drills");
  const [selectedSession, setSelectedSession] = useState<VaultSession | null>(null);
  const [selectedDrill, setSelectedDrill] = useState<VaultDrill | null>(null);
  const [skillFocus, setSkillFocus] = useState<any | null>(null);
  const [generatingSkillFocus, setGeneratingSkillFocus] = useState(false);
  const [filters, setFilters] = useState({
    gameModelId: "",
    ageGroup: "",
    phase: "",
    zone: "",
    gameFormat: "", // 7v7, 9v9, 11v11
    drillType: "", // WARMUP, TECHNICAL, TACTICAL, CONDITIONED_GAME, COOLDOWN
  });

  // Helper to determine game format from formation
  const getGameFormat = (session: VaultSession): string => {
    const formation = session.formationUsed;
    if (!formation) return "11v11"; // Default to 11v11 if no formation
    
    // Parse formation (e.g., "4-3-3", "3-2-1", "2-3-1") and sum the numbers
    const numbers = formation.split("-").map(n => parseInt(n, 10)).filter(n => !isNaN(n));
    const outfieldPlayers = numbers.reduce((sum, n) => sum + n, 0);
    
    // outfield + 1 GK = total per team
    // 4-3-3 = 10 outfield + 1 GK = 11 players = 11v11
    // 3-2-3 = 8 outfield + 1 GK = 9 players = 9v9
    // 2-3-1 = 6 outfield + 1 GK = 7 players = 7v7
    if (outfieldPlayers <= 6) return "7v7";
    if (outfieldPlayers <= 8) return "9v9";
    return "11v11";
  };

  // Filter sessions by game format (client-side)
  const filteredSessions = filters.gameFormat
    ? sessions.filter((s) => getGameFormat(s) === filters.gameFormat)
    : sessions;

  // Filter series by game format (based on first session)
  const filteredSeries = filters.gameFormat
    ? series.filter((s) => s.sessions[0] && getGameFormat(s.sessions[0]) === filters.gameFormat)
    : series;

  // Extract drills from all sessions
  const allDrills: VaultDrill[] = sessions.flatMap((session) => {
    const sessionDrills = session.json?.drills || [];
    return sessionDrills.map((drill: any, index: number) => ({
      id: `${session.id}-${index}`,
      drillType: drill.drillType || "TECHNICAL",
      title: drill.title || `Drill ${index + 1}`,
      description: drill.description || "",
      durationMin: drill.durationMin || 0,
      organization: drill.organization,
      progressions: drill.progressions,
      coachingPoints: drill.coachingPoints,
      diagram: drill.diagram || drill.diagramV1,
      sessionId: session.id,
      sessionTitle: session.title,
      sessionAgeGroup: session.ageGroup,
      sessionGameModelId: session.gameModelId,
      sessionPhase: session.phase,
      sessionZone: session.zone,
      sessionFormation: session.formationUsed,
      sessionCreatedAt: session.createdAt,
    }));
  });

  // Filter drills
  const filteredDrills = allDrills.filter((drill) => {
    if (filters.gameFormat) {
      const session = sessions.find(s => s.id === drill.sessionId);
      if (session && getGameFormat(session) !== filters.gameFormat) return false;
    }
    if (filters.drillType && drill.drillType !== filters.drillType) return false;
    if (filters.gameModelId && drill.sessionGameModelId !== filters.gameModelId) return false;
    if (filters.ageGroup && drill.sessionAgeGroup !== filters.ageGroup) return false;
    if (filters.phase && drill.sessionPhase !== filters.phase) return false;
    if (filters.zone && drill.sessionZone !== filters.zone) return false;
    return true;
  });

  useEffect(() => {
    loadVaultData();
  }, [activeTab, filters]);

  useEffect(() => {
    const sessionId = selectedSession?.id;
    if (!sessionId) {
      setSkillFocus(null);
      return;
    }
    fetch(`/api/skill-focus/session/${encodeURIComponent(sessionId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSkillFocus(data?.focus || null))
      .catch(() => setSkillFocus(null));
  }, [selectedSession?.id]);

  async function loadVaultData() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.gameModelId) params.append("gameModelId", filters.gameModelId);
      if (filters.ageGroup) params.append("ageGroup", filters.ageGroup);
      if (filters.phase) params.append("phase", filters.phase);
      if (filters.zone) params.append("zone", filters.zone);

      const [sessionsRes, seriesRes] = await Promise.all([
        fetch(`/api/vault/sessions?${params.toString()}`),
        fetch("/api/vault/series"),
      ]);

      if (!sessionsRes.ok) throw new Error(`API error: ${sessionsRes.status}`);
      if (!seriesRes.ok) throw new Error(`API error: ${seriesRes.status}`);

      const sessionsData = await sessionsRes.json();
      const seriesData = await seriesRes.json();

      setSessions(sessionsData.sessions || []);
      setSeries(seriesData.series || []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function removeFromVault(sessionId: string) {
    try {
      const res = await fetch(`/api/vault/sessions/${sessionId}/remove`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to remove from vault");
      await loadVaultData();
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
      }
    } catch (e: any) {
      alert("Error removing from vault: " + e.message);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Session Vault</h1>
              <p className="text-sm text-slate-400">
                Browse and manage your saved training sessions and progressive series
              </p>
            </div>
            <Link
              href="/demo/session"
              className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              ➕ Generate New Session
            </Link>
          </div>
        </header>

        {/* Tabs */}
        <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-1 flex gap-1">
          <button
            onClick={() => setActiveTab("drills")}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all ${
              activeTab === "drills"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Drills ({filteredDrills.length}{filters.drillType || filters.gameFormat ? ` of ${allDrills.length}` : ''})
          </button>
          <button
            onClick={() => setActiveTab("sessions")}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all ${
              activeTab === "sessions"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sessions ({filteredSessions.length}{filters.gameFormat ? ` of ${sessions.length}` : ''})
          </button>
          <button
            onClick={() => setActiveTab("series")}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all ${
              activeTab === "series"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Series ({filteredSeries.length}{filters.gameFormat ? ` of ${series.length}` : ''})
          </button>
        </div>

        {/* Filters (for sessions) */}
        {/* Filters - shown for both tabs */}
        <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 px-6 py-5 space-y-4">
          <h2 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">
            Filters
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide">Game Format</label>
              <select
                value={filters.gameFormat}
                onChange={(e) => setFilters({ ...filters, gameFormat: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="">All Formats</option>
                <option value="7v7">7v7</option>
                <option value="9v9">9v9</option>
                <option value="11v11">11v11</option>
              </select>
            </div>
            {activeTab === "drills" && (
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 uppercase tracking-wide">Drill Type</label>
                <select
                  value={filters.drillType}
                  onChange={(e) => setFilters({ ...filters, drillType: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                >
                  <option value="">All Types</option>
                  <option value="WARMUP">Warm-up</option>
                  <option value="TECHNICAL">Technical</option>
                  <option value="TACTICAL">Tactical</option>
                  <option value="CONDITIONED_GAME">Conditioned Game</option>
                  <option value="COOLDOWN">Cool-down</option>
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide">Game Model</label>
              <select
                value={filters.gameModelId}
                onChange={(e) => setFilters({ ...filters, gameModelId: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="">All</option>
                <option value="POSSESSION">Possession</option>
                <option value="PRESSING">Pressing</option>
                <option value="TRANSITION">Transition</option>
                <option value="COACHAI">Balanced</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide">Age Group</label>
              <select
                value={filters.ageGroup}
                onChange={(e) => setFilters({ ...filters, ageGroup: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="">All</option>
                {["U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18"].map(age => (
                  <option key={age} value={age}>{age}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide">Phase</label>
              <select
                value={filters.phase}
                onChange={(e) => setFilters({ ...filters, phase: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="">All</option>
                <option value="ATTACKING">Attacking</option>
                <option value="DEFENDING">Defending</option>
                <option value="TRANSITION">Transition</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide">Zone</label>
              <select
                value={filters.zone}
                onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="">All</option>
                <option value="DEFENSIVE_THIRD">Defensive Third</option>
                <option value="MIDDLE_THIRD">Middle Third</option>
                <option value="ATTACKING_THIRD">Attacking Third</option>
              </select>
            </div>
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
            <p className="mt-4 text-sm text-slate-400">Loading vault...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-3xl border border-red-700/70 bg-red-900/20 px-6 py-4">
            <p className="text-sm text-red-300">Error: {error}</p>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <div className="grid grid-cols-1 gap-6">
            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {activeTab === "sessions" && (
                filteredSessions.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-8 text-center text-slate-400 md:col-span-2 xl:col-span-3">
                    <p className="mb-2">{sessions.length === 0 ? "No sessions in vault yet." : "No sessions match the selected filters."}</p>
                    {sessions.length === 0 && (
                      <Link href="/demo/session" className="text-emerald-400 hover:text-emerald-300 underline text-sm">
                        Generate your first session
                      </Link>
                    )}
                  </div>
                ) : (
                  filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className={`rounded-2xl border p-3 cursor-pointer transition-all ${
                        selectedSession?.id === session.id
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : "border-slate-700/70 bg-slate-900/70 hover:border-slate-600/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-xs text-slate-200 leading-tight mb-1">{session.title}</h3>
                          {session.durationMin && (
                            <div className="text-[9px] text-slate-500">
                              {session.durationMin} min session
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70"></span>
                            <span className="text-emerald-400/70 font-medium">{gameModelLabel[session.gameModelId]}</span>
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="font-medium">{session.ageGroup}</span>
                        </div>
                        {(session.phase || session.zone) && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {session.phase && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">{phaseLabel[session.phase]}</span>
                            )}
                            {session.phase && session.zone && <span className="text-slate-600">•</span>}
                            {session.zone && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">{zoneLabel[session.zone]}</span>
                            )}
                          </div>
                        )}
                        {/* Formation, Coach Level, Player Level & Player Qty */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {session.formationUsed && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 text-[9px] border border-blue-700/30">
                              {session.formationUsed}
                            </span>
                          )}
                          {session.coachLevel && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-300 text-[9px] border border-amber-700/30">
                              Coach: {coachLevelLabel[session.coachLevel] || session.coachLevel}
                            </span>
                          )}
                          {session.playerLevel && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-300 text-[9px] border border-purple-700/30">
                              Player: {playerLevelLabel[session.playerLevel] || session.playerLevel}
                            </span>
                          )}
                          {(session.numbersMin || session.numbersMax) && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-300 text-[9px] border border-cyan-700/30">
                              {session.numbersMin === session.numbersMax 
                                ? `${session.numbersMin} players`
                                : `${session.numbersMin || '?'}-${session.numbersMax || '?'} players`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
                          <div className="text-[9px] text-slate-500">
                            {new Date(session.createdAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className="text-[9px] text-slate-600 font-mono">
                            {session.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Remove from vault?")) {
                            removeFromVault(session.id);
                          }
                        }}
                        className="mt-2 text-[10px] text-red-400 hover:text-red-300 transition-colors"
                      >
                        Remove from vault
                      </button>
                    </div>
                  ))
                )
              )}

              {activeTab === "drills" && (
                filteredDrills.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-8 text-center text-slate-400 md:col-span-2 xl:col-span-3">
                    <p className="mb-2">{allDrills.length === 0 ? "No drills in vault yet." : "No drills match the selected filters."}</p>
                    {allDrills.length === 0 && (
                      <Link href="/demo/session" className="text-emerald-400 hover:text-emerald-300 underline text-sm">
                        Generate a session to add drills
                      </Link>
                    )}
                  </div>
                ) : (
                  filteredDrills.map((drill) => {
                    const typeColors = drillTypeColors[drill.drillType] || drillTypeColors.TECHNICAL;
                    return (
                      <div
                        key={drill.id}
                        onClick={() => setSelectedDrill(drill)}
                        className={`rounded-2xl border p-3 cursor-pointer transition-all ${
                          selectedDrill?.id === drill.id
                            ? "border-emerald-500/50 bg-emerald-500/10"
                            : "border-slate-700/70 bg-slate-900/70 hover:border-slate-600/70"
                        }`}
                      >
                        {/* Drill Type Badge */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${typeColors.bg} ${typeColors.text} border ${typeColors.border}`}>
                            {drillTypeLabel[drill.drillType] || drill.drillType}
                          </span>
                          {drill.durationMin > 0 && (
                            <span className="text-[9px] text-slate-500">{drill.durationMin} min</span>
                          )}
                        </div>
                        
                        {/* Drill Title */}
                        <h3 className="font-semibold text-xs text-slate-200 leading-tight mb-2">{drill.title}</h3>
                        
                        {/* Description Preview */}
                        {drill.description && (
                          <p className="text-[10px] text-slate-400 line-clamp-2 mb-2">
                            {drill.description}
                          </p>
                        )}
                        
                        {/* Session Info */}
                        <div className="text-[10px] text-slate-400 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70"></span>
                              <span className="text-emerald-400/70 font-medium">{gameModelLabel[drill.sessionGameModelId]}</span>
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="font-medium">{drill.sessionAgeGroup}</span>
                            {drill.sessionFormation && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-blue-300">{drill.sessionFormation}</span>
                              </>
                            )}
                          </div>
                          
                          {/* Quick Stats */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {drill.coachingPoints && drill.coachingPoints.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">
                                {drill.coachingPoints.length} coaching points
                              </span>
                            )}
                            {drill.progressions && drill.progressions.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">
                                {drill.progressions.length} progressions
                              </span>
                            )}
                          </div>
                          
                          {/* From Session */}
                          <div className="pt-2 border-t border-slate-700/50">
                            <span className="text-[9px] text-slate-500">From: </span>
                            <span className="text-[9px] text-slate-400">{drill.sessionTitle}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              )}

              {activeTab === "series" && (
                filteredSeries.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-8 text-center text-slate-400 md:col-span-2 xl:col-span-3">
                    <p>{series.length === 0 ? "No series in vault yet." : "No series match the selected filters."}</p>
                  </div>
                ) : (
                filteredSeries.map((s) => {
                    const firstSession = s.sessions[0];
                    const seriesPhase = firstSession?.phase ? phaseLabel[firstSession.phase] : null;
                    const seriesZone = firstSession?.zone ? zoneLabel[firstSession.zone] : null;
                    
                    // Build unique descriptive series title from first session
                    let seriesTitle: string;
                    if (firstSession?.title) {
                      // Clean up the first session title to use as series title
                      let baseTitle = firstSession.title
                        .replace(/^(Session \d+:?\s*)/i, "") // Remove "Session 1:" prefix
                        .replace(/\s*-\s*Part\s*\d+/i, "")   // Remove "- Part 1" suffix
                        .trim();
                      
                      // If title is too long, truncate intelligently
                      if (baseTitle.length > 50) {
                        // Try to cut at a natural break point
                        const breakPoints = [" - ", ": ", " and ", " & "];
                        for (const bp of breakPoints) {
                          const idx = baseTitle.indexOf(bp);
                          if (idx > 15 && idx < 50) {
                            baseTitle = baseTitle.substring(0, idx);
                            break;
                          }
                        }
                        if (baseTitle.length > 50) {
                          baseTitle = baseTitle.substring(0, 47) + "...";
                        }
                      }
                      
                      seriesTitle = `${baseTitle} (${s.ageGroup})`;
                    } else {
                      // Fallback to game model + age group
                      seriesTitle = `${gameModelLabel[s.gameModelId] || s.gameModelId} Training (${s.ageGroup})`;
                    }

                    return (
                    <div
                      key={s.seriesId}
                      className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-3"
                    >
                      <h3 className="font-semibold text-xs mb-1 text-slate-200 leading-tight">
                        {seriesTitle}
                      </h3>
                      <p className="text-[9px] text-slate-500 mb-2">
                        {s.totalSessions} Sessions {seriesPhase ? `• ${seriesPhase}` : ""} {seriesZone ? `• ${seriesZone}` : ""}
                      </p>
                      <div className="text-[10px] text-slate-400 mb-2">
                        <span className="text-emerald-400/70">{s.totalSessions} sessions</span>
                        {firstSession?.durationMin && (
                          <>
                            <span className="text-slate-600 mx-1">•</span>
                            <span>{firstSession.durationMin} min each</span>
                          </>
                        )}
                        {s.createdAt && (
                          <>
                            <span className="text-slate-600 mx-1">•</span>
                            <span>
                              {new Date(s.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </>
                        )}
                      </div>
                      {/* Formation, Coach Level, Player Level & Player Qty */}
                      <div className="flex items-center gap-2 flex-wrap mb-3 text-[10px]">
                        {firstSession?.formationUsed && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 text-[9px] border border-blue-700/30">
                            {firstSession.formationUsed}
                          </span>
                        )}
                        {firstSession?.coachLevel && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-300 text-[9px] border border-amber-700/30">
                            Coach: {coachLevelLabel[firstSession.coachLevel] || firstSession.coachLevel}
                          </span>
                        )}
                        {firstSession?.playerLevel && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-300 text-[9px] border border-purple-700/30">
                            Player: {playerLevelLabel[firstSession.playerLevel] || firstSession.playerLevel}
                          </span>
                        )}
                        {(firstSession?.numbersMin || firstSession?.numbersMax) && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-300 text-[9px] border border-cyan-700/30">
                            {firstSession.numbersMin === firstSession.numbersMax 
                              ? `${firstSession.numbersMin} players`
                              : `${firstSession.numbersMin || '?'}-${firstSession.numbersMax || '?'} players`}
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {s.sessions.map((session, idx) => (
                          <div
                            key={session.id}
                            onClick={() => setSelectedSession(session)}
                            className="text-[10px] py-1 px-2 rounded bg-slate-800/50 cursor-pointer hover:bg-slate-800 transition-colors border border-slate-700/50"
                          >
                            <div className="font-medium text-slate-200 line-clamp-1">
                              {session.title}
                            </div>
                          </div>
                        ))}
                      </div>
                      <Link
                        href={`/demo/session?seriesId=${s.seriesId}`}
                        className="mt-2 inline-flex items-center text-[10px] text-emerald-400/70 hover:text-emerald-300"
                      >
                        View Full Series →
                      </Link>
                    </div>
                  )})
                )
              )}
            </div>
          </div>
        )}

        {selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-700/70 bg-slate-900/90 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold mb-3 text-slate-200">{selectedSession.title}</h2>
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
                    {selectedSession.coachLevel && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Coach Level:</span>
                        <span className="text-amber-300">{coachLevelLabel[selectedSession.coachLevel] || selectedSession.coachLevel}</span>
                      </div>
                    )}
                    {selectedSession.playerLevel && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Player Level:</span>
                        <span className="text-purple-300">{playerLevelLabel[selectedSession.playerLevel] || selectedSession.playerLevel}</span>
                      </div>
                    )}
                    {(selectedSession.numbersMin || selectedSession.numbersMax) && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Players:</span>
                        <span className="text-cyan-300">
                          {selectedSession.numbersMin === selectedSession.numbersMax 
                            ? `${selectedSession.numbersMin}`
                            : `${selectedSession.numbersMin || '?'}-${selectedSession.numbersMax || '?'}`}
                        </span>
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

                {skillFocus && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <h3 className="text-xs font-semibold text-emerald-300 uppercase tracking-wide mb-2">Player Skill Focus</h3>
                    <div className="text-sm font-semibold text-emerald-100">{skillFocus.title}</div>
                    {skillFocus.summary && (
                      <p className="mt-2 text-sm text-emerald-100/80">{skillFocus.summary}</p>
                    )}
                    {Array.isArray(skillFocus.keySkills) && skillFocus.keySkills.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Key Skills</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {skillFocus.keySkills.map((skill: string, i: number) => (
                            <span key={i} className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-100">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {Array.isArray(skillFocus.coachingPoints) && skillFocus.coachingPoints.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Coaching Points</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-100/80">
                          {skillFocus.coachingPoints.map((point: string, i: number) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(Array.isArray(skillFocus.psychologyGood) || Array.isArray(skillFocus.psychologyBad)) && (
                      <div className="mt-3">
                        <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Psychological Watch</div>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          {Array.isArray(skillFocus.psychologyGood) && skillFocus.psychologyGood.length > 0 && (
                            <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
                              <div className="text-[11px] uppercase tracking-widest text-emerald-200/80">Encourage</div>
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-emerald-100/80">
                                {skillFocus.psychologyGood.map((item: string, i: number) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(skillFocus.psychologyBad) && skillFocus.psychologyBad.length > 0 && (
                            <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3">
                              <div className="text-[11px] uppercase tracking-widest text-rose-200/80">Correct</div>
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-rose-100/80">
                                {skillFocus.psychologyBad.map((item: string, i: number) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {skillFocus.sectionPhrases && (
                      <div className="mt-4">
                        <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Section Phrases</div>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          {Object.entries(skillFocus.sectionPhrases).map(([section, phrases]: any) => (
                            <div key={section} className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
                              <div className="text-[11px] uppercase tracking-widest text-slate-300">
                                {String(section).replace("_", " ")}
                              </div>
                              {Array.isArray(phrases?.encourage) && phrases.encourage.length > 0 && (
                                <div className="mt-2">
                                  <div className="text-[10px] uppercase tracking-widest text-emerald-200/70">Encourage</div>
                                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-emerald-100/80">
                                    {phrases.encourage.map((item: string, i: number) => (
                                      <li key={i}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {Array.isArray(phrases?.correct) && phrases.correct.length > 0 && (
                                <div className="mt-2">
                                  <div className="text-[10px] uppercase tracking-widest text-rose-200/70">Correct</div>
                                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-rose-100/80">
                                    {phrases.correct.map((item: string, i: number) => (
                                      <li key={i}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedSession.json?.drills && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">Drills</h3>
                    {selectedSession.json.drills.map((drill: any, i: number) => (
                      <div key={i} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
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
                    onClick={async () => {
                      try {
                        if (!selectedSession?.id) return;
                        setGeneratingSkillFocus(true);
                        const response = await fetch("/api/skill-focus/session", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ sessionId: selectedSession.id }),
                        });
                        if (!response.ok) {
                          const error = await response.json();
                          alert("Error generating skill focus: " + (error.error || "Unknown error"));
                          return;
                        }
                        const data = await response.json();
                        setSkillFocus(data.focus || null);
                      } catch (e: any) {
                        alert("Error generating skill focus: " + e.message);
                      } finally {
                        setGeneratingSkillFocus(false);
                      }
                    }}
                    disabled={generatingSkillFocus}
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      skillFocus
                        ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                        : "border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700"
                    }`}
                  >
                    {generatingSkillFocus
                      ? "⚡ Generating..."
                      : skillFocus
                      ? "✓ Skill Focus Ready"
                      : "🎯 Skill Focus"}
                  </button>
                  <Link
                    href={`/demo/session?sessionId=${selectedSession.id}`}
                    onClick={() => {
                      try {
                        sessionStorage.setItem(
                          `vaultSession:${selectedSession.id}`,
                          JSON.stringify(selectedSession)
                        );
                      } catch {
                        // Non-fatal if storage is unavailable
                      }
                    }}
                    className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    View Full Session
                  </Link>
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch("/api/export-session-pdf", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            session: {
                              ...selectedSession.json,
                              id: selectedSession.id,
                            },
                          }),
                        });
                        if (!response.ok) {
                          const error = await response.json();
                          alert("Error exporting PDF: " + (error.error || "Unknown error"));
                          return;
                        }
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `session-${selectedSession.title.replace(/[^a-z0-9]/gi, "-")}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      } catch (e: any) {
                        alert("Error exporting PDF: " + e.message);
                      }
                    }}
                    className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
                  >
                    📄 Export PDF
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Remove from vault?")) {
                        removeFromVault(selectedSession.id);
                      }
                    }}
                    className="inline-flex items-center rounded-full border border-red-700/70 bg-red-900/20 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/30 transition-colors"
                  >
                    Remove from Vault
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
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      drillTypeColors[selectedDrill.drillType]?.bg || "bg-slate-800"
                    } ${drillTypeColors[selectedDrill.drillType]?.text || "text-slate-300"} border ${
                      drillTypeColors[selectedDrill.drillType]?.border || "border-slate-700"
                    }`}>
                      {drillTypeLabel[selectedDrill.drillType] || selectedDrill.drillType}
                    </span>
                    {selectedDrill.durationMin > 0 && (
                      <span className="text-sm text-slate-400">{selectedDrill.durationMin} minutes</span>
                    )}
                  </div>

                  <h2 className="text-lg font-semibold mb-3 text-slate-200">{selectedDrill.title}</h2>

                  {/* Session Info */}
                  <div className="flex flex-wrap gap-3 text-sm mb-4 pb-4 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Topic:</span>
                      <span className="text-emerald-400">{gameModelLabel[selectedDrill.sessionGameModelId]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Age:</span>
                      <span className="text-slate-200">{selectedDrill.sessionAgeGroup}</span>
                    </div>
                    {selectedDrill.sessionPhase && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Phase:</span>
                        <span className="text-slate-200">{phaseLabel[selectedDrill.sessionPhase]}</span>
                      </div>
                    )}
                    {selectedDrill.sessionZone && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Zone:</span>
                        <span className="text-slate-200">{zoneLabel[selectedDrill.sessionZone]}</span>
                      </div>
                    )}
                    {selectedDrill.sessionFormation && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Formation:</span>
                        <span className="text-blue-300">{selectedDrill.sessionFormation}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDrill(null)}
                  className="text-slate-400 hover:text-slate-200 text-xl leading-none p-1"
                >
                  ×
                </button>
              </div>

              {/* Two-column layout: Diagram + Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Left: Diagram */}
                {selectedDrill.diagram && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Diagram</h3>
                    <div className="flex items-center justify-center">
                      <DrillDiagram
                        diagram={selectedDrill.diagram}
                        width={280}
                        height={180}
                      />
                    </div>
                  </div>
                )}

                {/* Right: Description & Organization */}
                <div className="space-y-3">
                  {/* Description */}
                  {selectedDrill.description && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-300 mb-1">Description</h3>
                      <p className="text-xs text-slate-400">{selectedDrill.description}</p>
                    </div>
                  )}

                  {/* Area Dimensions */}
                  {selectedDrill.organization?.area && (
                    <div className="flex gap-3 text-xs">
                      {selectedDrill.organization.area.lengthYards && (
                        <span className="text-slate-400">
                          <span className="text-slate-500">Length:</span> {selectedDrill.organization.area.lengthYards}y
                        </span>
                      )}
                      {selectedDrill.organization.area.widthYards && (
                        <span className="text-slate-400">
                          <span className="text-slate-500">Width:</span> {selectedDrill.organization.area.widthYards}y
                        </span>
                      )}
                    </div>
                  )}

                  {/* Rotation & Scoring */}
                  {selectedDrill.organization?.rotation && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">Rotation:</span>
                      <p className="text-xs text-slate-400">{selectedDrill.organization.rotation}</p>
                    </div>
                  )}
                  {selectedDrill.organization?.scoring && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">Scoring:</span>
                      <p className="text-xs text-slate-400">{selectedDrill.organization.scoring}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Setup Steps */}
              {selectedDrill.organization?.setupSteps && selectedDrill.organization.setupSteps.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Setup Steps</h3>
                  <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1">
                    {selectedDrill.organization.setupSteps.map((step: string, i: number) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Two-column: Coaching Points & Progressions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Coaching Points */}
                {selectedDrill.coachingPoints && selectedDrill.coachingPoints.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Coaching Points</h3>
                    <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                      {selectedDrill.coachingPoints.map((point: string, i: number) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Progressions */}
                {selectedDrill.progressions && selectedDrill.progressions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Progressions</h3>
                    <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1">
                      {selectedDrill.progressions.map((prog: string, i: number) => (
                        <li key={i}>{prog}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-700/50">
                <button
                  onClick={() => {
                    const session = sessions.find(s => s.id === selectedDrill.sessionId);
                    if (session) {
                      setSelectedDrill(null);
                      setSelectedSession(session);
                    }
                  }}
                  className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  View Full Session
                </button>
                <button
                  onClick={() => setSelectedDrill(null)}
                  className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
