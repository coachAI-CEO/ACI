"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DrillDiagramCard from "@/components/DrillDiagramCard";
import QAScoresDisplay from "@/components/QAScoresDisplay";

type VaultSession = {
  id: string;
  title: string;
  gameModelId: string;
  ageGroup: string;
  phase?: string;
  zone?: string;
  durationMin?: number;
  qaScore?: number;
  approved: boolean;
  isSeries: boolean;
  seriesId?: string;
  seriesNumber?: number;
  createdAt: string;
  json: any;
};

type VaultSeries = {
  seriesId: string;
  sessions: VaultSession[];
  totalSessions: number;
  createdAt?: string;
  gameModelId: string;
  ageGroup: string;
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

export default function VaultPage() {
  const [sessions, setSessions] = useState<VaultSession[]>([]);
  const [series, setSeries] = useState<VaultSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sessions" | "series">("sessions");
  const [selectedSession, setSelectedSession] = useState<VaultSession | null>(null);
  const [skillFocus, setSkillFocus] = useState<any | null>(null);
  const [generatingSkillFocus, setGeneratingSkillFocus] = useState(false);
  const [filters, setFilters] = useState({
    gameModelId: "",
    ageGroup: "",
    phase: "",
    zone: "",
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
            onClick={() => setActiveTab("sessions")}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all ${
              activeTab === "sessions"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sessions ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab("series")}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all ${
              activeTab === "series"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Series ({series.length})
          </button>
        </div>

        {/* Filters (for sessions) */}
        {activeTab === "sessions" && (
          <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 px-6 py-5 space-y-4">
            <h2 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">
              Filters
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
        )}

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
              {activeTab === "sessions" ? (
                sessions.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-8 text-center text-slate-400 md:col-span-2 xl:col-span-3">
                    <p className="mb-2">No sessions in vault yet.</p>
                    <Link href="/demo/session" className="text-emerald-400 hover:text-emerald-300 underline text-sm">
                      Generate your first session
                    </Link>
                  </div>
                ) : (
                  sessions.map((session) => (
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
                        {session.qaScore && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 whitespace-nowrap flex-shrink-0">
                            {session.qaScore.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70"></span>
                            <span className="text-emerald-400/70 font-medium">{gameModelLabel[session.gameModelId]}</span>
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="font-medium">{session.ageGroup}</span>
                        </div>
                        {session.phase && session.zone && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">{phaseLabel[session.phase]}</span>
                            <span className="text-slate-600">•</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">{zoneLabel[session.zone]}</span>
                          </div>
                        )}
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
              ) : (
                series.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-8 text-center text-slate-400 md:col-span-2 xl:col-span-3">
                    <p>No series in vault yet.</p>
                  </div>
                ) : (
                  series.map((s) => {
                    const firstSession = s.sessions[0];
                    const seriesPhase = firstSession?.phase ? phaseLabel[firstSession.phase] : null;
                    const seriesZone = firstSession?.zone ? zoneLabel[firstSession.zone] : null;
                    const seriesNameParts = [
                      gameModelLabel[s.gameModelId],
                      s.ageGroup,
                      seriesPhase,
                      seriesZone,
                    ].filter(Boolean);

                    return (
                    <div
                      key={s.seriesId}
                      className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-3"
                    >
                      <h3 className="font-semibold text-xs mb-2 text-slate-200">
                        {seriesNameParts.join(" • ")} Series
                      </h3>
                      <div className="text-[10px] text-slate-400 mb-2">
                        <span className="text-emerald-400/70">{s.totalSessions} sessions</span>
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
                      <div className="space-y-1">
                        {s.sessions.map((session) => (
                          <div
                            key={session.id}
                            onClick={() => setSelectedSession(session)}
                            className="text-[10px] p-2 rounded-lg bg-slate-800/50 cursor-pointer hover:bg-slate-800 transition-colors border border-slate-700/50"
                          >
                            <div className="font-medium text-slate-200">
                              Session {session.seriesNumber}: {session.title}
                            </div>
                            <div className="text-slate-400 truncate">{session.title}</div>
                          </div>
                        ))}
                      </div>
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
                    {selectedSession.qaScore && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">QA Score:</span>
                        <span className="text-emerald-400 font-semibold">{selectedSession.qaScore.toFixed(1)}/5.0</span>
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
                  </div>
                )}

                {selectedSession.json?.drills && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">Drills</h3>
                    {selectedSession.json.drills.map((drill: any, i: number) => (
                      <div key={i} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 space-y-3">
                        <h4 className="font-semibold text-sm text-slate-200">{drill.title}</h4>
                        {drill.description && (
                          <p className="text-xs text-slate-300 leading-relaxed">{drill.description}</p>
                        )}
                        {drill.diagram && (
                          <DrillDiagramCard
                            title={drill.title}
                            gameModelId={selectedSession.gameModelId}
                            phase={selectedSession.phase || "ATTACKING"}
                            zone={selectedSession.zone || "ATTACKING_THIRD"}
                            diagram={drill.diagram}
                          />
                        )}
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
                    className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    {generatingSkillFocus ? "⚡ Generating..." : "🎯 Skill Focus"}
                  </button>
                  <Link
                    href={`/demo/session?sessionId=${selectedSession.id}`}
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
      </div>
    </main>
  );
}
