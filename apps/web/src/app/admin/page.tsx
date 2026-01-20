"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DrillDiagram from "@/components/DrillDiagram";
import { getUserHeaders } from "@/lib/user";

// Label mappings (same as vault)
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
  GRASSROOTS: "Grassroots",
  USSF_C: "USSF C",
  USSF_B_PLUS: "USSF B+",
};

type Stats = {
  database: {
    totalSessions: number;
    totalDrills: number;
    totalSeries: number;
    vaultSessions: number;
    vaultDrills: number;
    seriesSessions: number;
    sessionDrillsCount: number; // Drills embedded in vault sessions
  };
  api: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRate: string;
  };
  tokens: {
    recentTotal: number;
    recentPromptTokens: number;
    recentCompletionTokens: number;
    allTimeTotal: number;
    allTimePromptTokens: number;
    allTimeCompletionTokens: number;
    allTimeCost: string;
    recentCost: string;
  };
  performance: {
    avgDurationMs: number;
    avgDurationSec: string;
    totalDurationMs: number;
  };
  pricing: {
    inputPer1M: number;
    outputPer1M: number;
    model: string;
  };
};

type TimelineDay = {
  date: string;
  calls: number;
  successful: number;
  failed: number;
  tokens: number;
  avgDuration: number;
  sessions: number;
  drills: number;
  series: number;
  skillFocus: number;
  qaReviews: number;
};

type RecentMetric = {
  id: string;
  operationType: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  promptLength: number;
  responseLength: number | null;
  durationMs: number;
  success: boolean;
  errorMessage: string | null;
  ageGroup: string | null;
  gameModelId: string | null;
  createdAt: string;
};

type OperationStats = {
  type: string;
  count: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  avgTokens: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  totalDurationMs: number;
  avgDurationMs: number;
  totalCost: string;
  avgCost: string;
};

type AgeGroupStats = {
  ageGroup: string;
  count: number;
};

type RandomSessionsJob = {
  id: string;
  ageGroup: string;
  mode: "session" | "series";
  sessionsPerSeries?: number;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  status: "queued" | "running" | "completed" | "failed";
  startedAt: string;
  finishedAt?: string;
  results: Array<
    | { kind: "session"; id: string; refCode?: string; title?: string }
    | { kind: "series"; seriesId: string; totalSessions: number; firstRefCode?: string; title?: string }
  >;
  errors: Array<{ index: number; message: string }>;
};

// Keep admin bulk generator aligned with Vault filters
const VAULT_AGE_GROUPS = ["U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18"] as const;

type SessionReviewResult = {
  session: {
    id: string;
    refCode?: string | null;
    title: string;
    ageGroup: string;
    gameModelId: string;
    phase?: string | null;
    zone?: string | null;
    qaScore: number | null;
    approved: boolean;
  };
  qa: {
    pass: boolean;
    scores: Record<string, number>;
    avgScore: number | null;
    summary: string | null;
    notes: string[];
  };
  fixDecision: { code: string; reason: string };
};

type SessionRegenerateResult = {
  replaced: boolean;
  original: { id: string; refCode?: string | null; title: string } | null;
  replacement: { id: string; refCode?: string; title?: string; qaScore: number | null; approved: boolean };
};

// Base URL for backend API (used for admin-only endpoints that require JWT)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  try {
    const token = localStorage.getItem("accessToken");
    const headers: HeadersInit = {};
    if (token) {
      (headers as any).Authorization = `Bearer ${token}`;
    }
    return headers;
  } catch {
    return {};
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [recentMetrics, setRecentMetrics] = useState<RecentMetric[]>([]);
  const [operationStats, setOperationStats] = useState<OperationStats[]>([]);
  const [ageGroupStats, setAgeGroupStats] = useState<AgeGroupStats[]>([]);
  const [seriesAgeGroupStats, setSeriesAgeGroupStats] = useState<AgeGroupStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [pricePerSession, setPricePerSession] = useState(0.10);
  
  // System status
  const [systemStatus, setSystemStatus] = useState<{
    backend: "checking" | "online" | "offline";
    database: "checking" | "online" | "offline";
    lastChecked: Date | null;
  }>({
    backend: "checking",
    database: "checking",
    lastChecked: null,
  });

  // Bulk random session generator (admin)
  const [bulkAgeGroup, setBulkAgeGroup] = useState<string>("U10");
  const [bulkMode, setBulkMode] = useState<"session" | "series">("session");
  const [bulkCount, setBulkCount] = useState<number>(5);
  const [bulkSessionsPerSeries, setBulkSessionsPerSeries] = useState<number>(3);
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [bulkJob, setBulkJob] = useState<RandomSessionsJob | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkJobError, setBulkJobError] = useState<string | null>(null);

  // Review session (admin)
  const [reviewRef, setReviewRef] = useState<string>("");
  const [reviewRunning, setReviewRunning] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<SessionReviewResult | null>(null);
  const [regenerateRunning, setRegenerateRunning] = useState<boolean>(false);
  const [regenerateResult, setRegenerateResult] = useState<SessionRegenerateResult | null>(null);
  const [regenerateReplace, setRegenerateReplace] = useState<boolean>(false);
  const [viewingSession, setViewingSession] = useState<any | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(false);
  const [viewingSessionIsFavorited, setViewingSessionIsFavorited] = useState<boolean>(false);
  const [checkingFavorite, setCheckingFavorite] = useState<boolean>(false);
  
  // QA Status Analytics
  const [qaAnalytics, setQaAnalytics] = useState<{
    total: number;
    withQA: number;
    withoutQA: number;
    statusCounts: Record<string, number>;
    sessionsByStatus: Record<string, Array<{ id: string; refCode: string | null; title: string; qaScore: number | null }>>;
  } | null>(null);
  const [loadingQaAnalytics, setLoadingQaAnalytics] = useState<boolean>(false);

  const checkSystemStatus = useCallback(async () => {
    const apiUrl = API_BASE_URL;
    
    // Check backend API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const res = await fetch(`${apiUrl}/health`, { 
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        setSystemStatus(prev => ({ ...prev, backend: "online" }));
        
        // Check database via admin stats endpoint (requires admin auth)
        try {
          const statsRes = await fetch(`${apiUrl}/admin/stats`, {
            cache: "no-store",
            headers: getAuthHeaders(),
          });
          if (statsRes.ok) {
            setSystemStatus(prev => ({ ...prev, database: "online" }));
          } else if (statsRes.status === 401) {
            // Auth issue: backend is up, but user is not authorized
            // Treat DB as online but indicate need for login via UI metrics (not system status)
            setSystemStatus(prev => ({ ...prev, database: "online" }));
          } else {
            setSystemStatus(prev => ({ ...prev, database: "offline" }));
          }
        } catch {
          setSystemStatus(prev => ({ ...prev, database: "offline" }));
        }
      } else {
        setSystemStatus(prev => ({ ...prev, backend: "offline", database: "offline" }));
      }
    } catch (e) {
      setSystemStatus(prev => ({ ...prev, backend: "offline", database: "offline" }));
    } finally {
      setSystemStatus(prev => ({ ...prev, lastChecked: new Date() }));
    }
  }, []);

  // NOTE: keep fetchData defined before callbacks that reference it (TDZ-safe)
  const fetchQaAnalytics = useCallback(async () => {
    setLoadingQaAnalytics(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/analytics/qa-status`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        setQaAnalytics(data);
      }
    } catch (e: any) {
      console.error("Error fetching QA analytics:", e);
    } finally {
      setLoadingQaAnalytics(false);
    }
  }, []);

  const checkSessionFavoriteStatus = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    setCheckingFavorite(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getUserHeaders(),
        },
        body: JSON.stringify({ sessionIds: [sessionId] }),
      });
      if (res.ok) {
        const data = await res.json();
        setViewingSessionIsFavorited(data?.sessions?.[sessionId] || false);
      }
    } catch (e) {
      console.error("Error checking favorite status:", e);
    } finally {
      setCheckingFavorite(false);
    }
  }, []);

  const toggleViewingSessionFavorite = useCallback(async () => {
    if (!viewingSession?.id) return;
    const isFavorited = viewingSessionIsFavorited;
    
    try {
      const res = await fetch(`/api/favorites/session/${viewingSession.id}`, {
        method: isFavorited ? "DELETE" : "POST",
        headers: getUserHeaders(),
      });
      
      if (res.ok) {
        setViewingSessionIsFavorited(!isFavorited);
      }
    } catch (e) {
      console.error("Error toggling favorite:", e);
    }
  }, [viewingSession?.id, viewingSessionIsFavorited]);

  const fetchData = useCallback(async () => {
    try {
      const authHeaders = getAuthHeaders();
      const [statsRes, timelineRes, recentRes, operationsRes, ageRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/stats`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/metrics/timeline?days=7`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/metrics/recent?limit=20`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/metrics/by-operation`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/stats/by-age-group`, { headers: authHeaders }),
      ]);

      const [statsData, timelineData, recentData, operationsData, ageData] = await Promise.all([
        statsRes.json(),
        timelineRes.json(),
        recentRes.json(),
        operationsRes.json(),
        ageRes.json(),
      ]);

      if (statsData.ok) setStats(statsData.stats);
      if (timelineData.ok) setTimeline(timelineData.timeline);
      if (recentData.ok) setRecentMetrics(recentData.metrics);
      if (operationsData.ok) setOperationStats(operationsData.operations);
      if (ageData.ok) {
        setAgeGroupStats(ageData.sessions || []);
        setSeriesAgeGroupStats(ageData.seriesSessions || []);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const startBulkRandomSessions = useCallback(async () => {
    setBulkJobError(null);
    setBulkRunning(true);
    setBulkJob(null);
    setBulkJobId(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/random-sessions/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ageGroup: bulkAgeGroup,
          mode: bulkMode,
          count: bulkCount,
          sessionsPerSeries: bulkMode === "series" ? bulkSessionsPerSeries : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Failed to start job (${res.status})`);
      }
      setBulkJobId(data.jobId);
    } catch (e: any) {
      setBulkJobError(e?.message || String(e));
      setBulkRunning(false);
    }
  }, [bulkAgeGroup, bulkCount]);

  const pollBulkJob = useCallback(async () => {
    if (!bulkJobId) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/random-sessions/${encodeURIComponent(bulkJobId)}`,
        {
          cache: "no-store",
          headers: getAuthHeaders(),
        }
      );
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Failed to fetch job status (${res.status})`);
      }
      const job: RandomSessionsJob = data.job;
      setBulkJob(job);

      if (job.status === "completed" || job.status === "failed") {
        setBulkRunning(false);
        // Refresh admin stats so Age Group counts update
        fetchData();
      }
    } catch (e: any) {
      setBulkJobError(e?.message || String(e));
      setBulkRunning(false);
    }
  }, [bulkJobId, fetchData]);

  useEffect(() => {
    fetchData();
    checkSystemStatus();
    fetchQaAnalytics();
    
    // Check system status every 30 seconds
    const statusInterval = setInterval(checkSystemStatus, 30000);
    return () => clearInterval(statusInterval);
  }, [fetchData, checkSystemStatus, fetchQaAnalytics]);

  // Poll bulk job progress while running
  useEffect(() => {
    if (!bulkJobId) return;
    if (!bulkRunning) return;
    // initial tick
    pollBulkJob();
    const interval = setInterval(pollBulkJob, 1000);
    return () => clearInterval(interval);
  }, [bulkJobId, bulkRunning, pollBulkJob]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const formatNumber = (n: number) => n.toLocaleString();
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };
  const calculateRowCost = (promptTokens: number | null, completionTokens: number | null) => {
    const input = promptTokens || 0;
    const output = completionTokens || 0;
    const cost = (input / 1_000_000) * 0.10 + (output / 1_000_000) * 0.40;
    return cost < 0.0001 ? "<$0.0001" : `$${cost.toFixed(4)}`;
  };

  const bulkMaxCount = bulkMode === "series" ? 10 : 25;
  const bulkUnitLabel = bulkMode === "series" ? "series" : "sessions";

  const runSessionReview = useCallback(async () => {
    const ref = reviewRef.trim();
    if (!ref) {
      setReviewError("Enter a Session ID or refCode (e.g., S-AB12 or UUID).");
      return;
    }

    setReviewRunning(true);
    setReviewError(null);
    setReviewResult(null);
    setRegenerateResult(null); // Clear previous regeneration result

    try {
      const res = await fetch("/api/admin/sessions/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ sessionRef: ref }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Review failed (${res.status})`);
      }
      setReviewResult({
        session: data.session,
        qa: data.qa,
        fixDecision: data.fixDecision,
      });
    } catch (e: any) {
      setReviewError(e?.message || String(e));
    } finally {
      setReviewRunning(false);
    }
  }, [reviewRef]);

  const runSessionRegenerate = useCallback(async () => {
    const ref = reviewRef.trim();
    if (!ref) {
      setReviewError("Enter a Session ID or refCode (e.g., S-AB12 or UUID).");
      return;
    }

    setRegenerateRunning(true);
    setReviewError(null);
    setRegenerateResult(null);

    try {
      console.log("[ADMIN] Starting session regeneration:", { ref, replace: regenerateReplace });
      const res = await fetch(`${API_BASE_URL}/admin/sessions/regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ sessionRef: ref, replace: regenerateReplace }),
      });
      
      const data = await res.json();
      console.log("[ADMIN] Regeneration response:", { ok: data?.ok, status: res.status, data });
      
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Regeneration failed (${res.status})`);
      }
      
      if (!data?.replacement) {
        throw new Error("No replacement session returned from server");
      }
      
      setRegenerateResult({
        replaced: data.replaced || false,
        original: data.original || null,
        replacement: data.replacement,
      });
      // Clear any previous errors
      setReviewError(null);
      console.log("[ADMIN] Regeneration successful:", {
        replaced: data.replaced,
        original: data.original?.refCode || data.original?.id,
        replacement: data.replacement?.refCode || data.replacement?.id,
      });
      // Refresh stats to show new session in counts
      fetchData();
    } catch (e: any) {
      console.error("[ADMIN] Regeneration error:", e);
      setReviewError(e?.message || String(e));
      setRegenerateResult(null);
    } finally {
      setRegenerateRunning(false);
    }
  }, [reviewRef, regenerateReplace, fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-8">ACI Admin Dashboard</h1>
          <div className="animate-pulse">Loading metrics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-8">ACI Admin Dashboard</h1>
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
            <p className="text-red-300">Error: {error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); fetchData(); }}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ACI Admin Dashboard</h1>
            <p className="text-sm text-slate-400">Monitor generation metrics and database usage</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded bg-slate-800 border-slate-600"
              />
              Auto-refresh
            </label>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-white text-sm font-medium"
            >
              Refresh
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm font-medium"
            >
              Back to App
            </Link>
          </div>
        </div>

        {/* System Status */}
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">System Status</h2>
            {systemStatus.lastChecked && (
              <span className="text-xs text-slate-400">
                Last checked: {systemStatus.lastChecked.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={checkSystemStatus}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors"
            >
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Backend API Status */}
            <div className="flex h-full items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className={`w-3 h-3 rounded-full ${
                systemStatus.backend === "online" ? "bg-emerald-400 animate-pulse" :
                systemStatus.backend === "offline" ? "bg-red-400" :
                "bg-yellow-400 animate-pulse"
              }`}></div>
              <div className="flex-1">
                <div className="font-medium text-sm">Backend API</div>
                <div className="text-xs text-slate-400">
                  {systemStatus.backend === "online" ? "Running on port 4000" :
                   systemStatus.backend === "offline" ? "Not responding" :
                   "Checking..."}
                </div>
              </div>
              <div className={`text-xs font-semibold ${
                systemStatus.backend === "online" ? "text-emerald-400" :
                systemStatus.backend === "offline" ? "text-red-400" :
                "text-yellow-400"
              }`}>
                {systemStatus.backend === "online" ? "ONLINE" :
                 systemStatus.backend === "offline" ? "OFFLINE" :
                 "CHECKING"}
              </div>
            </div>

            {/* Database Status */}
            <div className="flex h-full items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className={`w-3 h-3 rounded-full ${
                systemStatus.database === "online" ? "bg-emerald-400 animate-pulse" :
                systemStatus.database === "offline" ? "bg-red-400" :
                "bg-yellow-400 animate-pulse"
              }`}></div>
              <div className="flex-1">
                <div className="font-medium text-sm">Database</div>
                <div className="text-xs text-slate-400">
                  {systemStatus.database === "online" ? "Connected" :
                   systemStatus.database === "offline" ? "Connection failed" :
                   "Checking..."}
                </div>
              </div>
              <div className={`text-xs font-semibold ${
                systemStatus.database === "online" ? "text-emerald-400" :
                systemStatus.database === "offline" ? "text-red-400" :
                "text-yellow-400"
              }`}>
                {systemStatus.database === "online" ? "ONLINE" :
                 systemStatus.database === "offline" ? "OFFLINE" :
                 "CHECKING"}
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Generate Random Sessions */}
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Bulk Generate Random Sessions</h2>
              <p className="text-xs text-slate-400">
                Generates sessions for a specific age group and auto-saves them to the Vault.
              </p>
            </div>
            <Link
              href="/vault"
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              View Vault →
            </Link>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400 uppercase tracking-wide">Generate</span>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-1 inline-flex">
              <button
                type="button"
                onClick={() => setBulkMode("session")}
                disabled={bulkRunning}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  bulkMode === "session"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Sessions
              </button>
              <button
                type="button"
                onClick={() => setBulkMode("series")}
                disabled={bulkRunning}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  bulkMode === "series"
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Series
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_240px] gap-4 items-end">
            <div>
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide mb-1">Age Group</label>
              <select
                value={bulkAgeGroup}
                onChange={(e) => setBulkAgeGroup(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200"
                disabled={bulkRunning}
              >
                {VAULT_AGE_GROUPS.map((ag) => (
                  <option key={ag} value={ag}>{ag}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide mb-1">
                {bulkMode === "series" ? "How many series?" : "How many sessions?"}
              </label>
              <input
                type="number"
                min={1}
                max={bulkMaxCount}
                value={bulkCount}
                onChange={(e) => setBulkCount(Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200"
                disabled={bulkRunning}
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide mb-1">
                Sessions per series
              </label>
              <input
                type="number"
                min={2}
                max={10}
                value={bulkSessionsPerSeries}
                onChange={(e) => setBulkSessionsPerSeries(Number(e.target.value))}
                className={`w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200 ${
                  bulkMode !== "series" ? "opacity-50" : ""
                }`}
                disabled={bulkRunning || bulkMode !== "series"}
              />
            </div>

            <div>
              <button
                onClick={startBulkRandomSessions}
                disabled={
                  bulkRunning ||
                  bulkCount < 1 ||
                  bulkCount > bulkMaxCount ||
                  (bulkMode === "series" && (bulkSessionsPerSeries < 2 || bulkSessionsPerSeries > 10))
                }
                className={`w-full h-9 px-4 rounded-lg text-sm font-semibold transition-colors ${
                  bulkRunning
                    ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {bulkRunning ? "Generating..." : "Start"}
              </button>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">
            {bulkMode === "series" ? "Max 10 series per run (each series is 2–10 sessions)" : "Max 25 sessions per run"}
          </div>

          {bulkJobError && (
            <div className="mt-3 rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300">
              {bulkJobError}
            </div>
          )}

          {(bulkRunning || bulkJob) && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <div className="font-medium">
                  {(bulkJob?.status ? bulkJob.status.toUpperCase() : "RUNNING")} •{" "}
                  {(bulkJob?.completed ?? 0)}/{(bulkJob?.total ?? bulkCount)} {bulkJob?.mode === "series" ? "series" : "sessions"}
                </div>
                {bulkJobId && (
                  <div className="text-slate-500 font-mono truncate max-w-[240px]">
                    Job: {bulkJobId}
                  </div>
                )}
              </div>

              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700/60">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((bulkJob?.completed ?? 0) / Math.max(1, (bulkJob?.total ?? bulkCount))) * 100
                      )
                    )}%`,
                  }}
                />
              </div>

              {bulkJob && (
                <div className="text-xs text-slate-400 flex gap-3">
                  <span className="text-emerald-400">Success: {bulkJob.succeeded}</span>
                  <span className="text-red-400">Failed: {bulkJob.failed}</span>
                </div>
              )}

              {bulkJob?.results?.length ? (
                <div className="mt-2">
                  <div className="text-xs font-semibold text-slate-300 mb-1">Latest created</div>
                  <div className="space-y-1">
                    {bulkJob.results.slice(-5).reverse().map((s) => (
                      s.kind === "series" ? (
                        <div key={s.seriesId} className="flex items-center gap-2 text-xs text-slate-300">
                          <span className="text-cyan-300 font-semibold">SERIES</span>
                          <span className="text-slate-500 font-mono">{s.seriesId}</span>
                          <span className="text-slate-400 truncate">
                            {s.title || "Series"} {s.firstRefCode ? `• ${s.firstRefCode}` : ""} • {s.totalSessions} sessions
                          </span>
                        </div>
                      ) : (
                        <div key={s.id} className="flex items-center gap-2 text-xs text-slate-300">
                          <span className="text-emerald-300 font-semibold">SESSION</span>
                          <span className="text-slate-500 font-mono">{s.refCode || s.id}</span>
                          <span className="text-slate-400 truncate">{s.title || "Session"}</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              ) : null}

              {bulkJob?.errors?.length ? (
                <details className="mt-2 rounded-lg border border-slate-700/70 bg-slate-950/40 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                    Errors ({bulkJob.errors.length})
                  </summary>
                  <div className="mt-2 space-y-1 text-xs text-red-300">
                    {bulkJob.errors.slice(-10).map((er, idx) => (
                      <div key={`${er.index}-${idx}`} className="opacity-90">
                        #{er.index}: {er.message}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          )}
        </div>

        {/* Review Session (QA + optional regen) */}
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Review Session</h2>
              <p className="text-xs text-slate-400">
                Runs QA on a specific session. Use "Regenerate Session" to create a replacement with new QA scores.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_240px_240px] gap-4 items-end">
            <div>
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide mb-1">
                Session ID or Ref Code
              </label>
              <input
                value={reviewRef}
                onChange={(e) => setReviewRef(e.target.value)}
                placeholder="e.g., S-9M3P or 3b2a... (uuid)"
                className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200"
                disabled={reviewRunning || regenerateRunning}
              />
            </div>

            <div>
              <button
                onClick={runSessionReview}
                disabled={reviewRunning || regenerateRunning}
                className={`w-full h-9 px-4 rounded-lg text-sm font-semibold transition-colors ${
                  reviewRunning
                    ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white"
                }`}
              >
                {reviewRunning ? "Reviewing..." : "Run QA Review"}
              </button>
            </div>

            <div>
              {reviewResult?.session?.id ? (
                <Link
                  href={`/demo/session?sessionId=${encodeURIComponent(reviewResult.session.id)}`}
                  className="w-full inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                >
                  View Session →
                </Link>
              ) : (
                <div className="h-9" />
              )}
            </div>
          </div>

          {reviewError && (
            <div className="mt-3 rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300">
              {reviewError}
            </div>
          )}

          {regenerateResult && (
            <div className="mt-3 rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">✓</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-emerald-300 mb-2">
                    {regenerateResult.replaced 
                      ? "Session Successfully Replaced" 
                      : "Replacement Session Generated"}
                  </div>
                  <div className="text-xs text-emerald-200/80 space-y-1">
                    {regenerateResult.replaced && regenerateResult.original ? (
                      <div>
                        <span className="text-slate-400">Replaced </span>
                        <span className="font-mono font-semibold text-emerald-300">
                          {regenerateResult.original.refCode || regenerateResult.original.id}
                        </span>
                        <span className="text-slate-400"> with </span>
                        <span className="font-mono font-semibold text-emerald-300">
                          {regenerateResult.replacement.refCode || regenerateResult.replacement.id}
                        </span>
                      </div>
                    ) : regenerateResult.original ? (
                      <div>
                        <span className="text-slate-400">Original: </span>
                        <span className="font-mono text-emerald-300">
                          {regenerateResult.original.refCode || regenerateResult.original.id}
                        </span>
                        <span className="text-slate-400"> → Replacement: </span>
                        <span className="font-mono text-emerald-300">
                          {regenerateResult.replacement.refCode || regenerateResult.replacement.id}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-slate-400">New session: </span>
                        <span className="font-mono font-semibold text-emerald-300">
                          {regenerateResult.replacement.refCode || regenerateResult.replacement.id}
                        </span>
                      </div>
                    )}
                    {regenerateResult.replacement.title && (
                      <div className="text-slate-300 mt-1">
                        {regenerateResult.replacement.title}
                      </div>
                    )}
                    {typeof regenerateResult.replacement.qaScore === "number" && (
                      <div className="mt-1">
                        <span className="text-slate-400">QA Score: </span>
                        <span className={regenerateResult.replacement.approved ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                          {regenerateResult.replacement.qaScore.toFixed(2)} ({regenerateResult.replacement.approved ? "PASS" : "FAIL"})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {reviewResult && (
            <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-950/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-200 font-semibold">{reviewResult.session.title}</span>
                {reviewResult.session.refCode && (
                  <span className="px-2 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-[11px] font-mono border border-cyan-700/30">
                    {reviewResult.session.refCode}
                  </span>
                )}
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">{reviewResult.session.ageGroup}</span>
                <span className="text-slate-500">•</span>
                <span className={reviewResult.qa.pass ? "text-emerald-400" : "text-red-400"}>
                  {reviewResult.qa.pass ? "PASS" : "FAIL"}
                </span>
                {typeof reviewResult.qa.avgScore === "number" && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-300">Avg: {reviewResult.qa.avgScore.toFixed(2)}</span>
                  </>
                )}
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">
                  Decision: <span className="font-semibold">{reviewResult.fixDecision.code}</span>
                </span>
              </div>

              {reviewResult.qa.summary && (
                <div className="text-xs text-slate-300">
                  <span className="text-slate-400">Summary: </span>
                  {reviewResult.qa.summary}
                </div>
              )}

              <details className="rounded-lg border border-slate-700/70 bg-slate-950/40 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                  QA Scores
                </summary>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {Object.entries(reviewResult.qa.scores || {}).map(([k, v]) => (
                    <div key={k} className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700/60">
                      <div className="text-slate-400 capitalize">{k}</div>
                      <div className="text-slate-200 font-semibold">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  {reviewResult.fixDecision.reason}
                </div>
              </details>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
                <div className="flex items-center gap-2">
                  <input
                    id="regenerateReplace"
                    type="checkbox"
                    checked={regenerateReplace}
                    onChange={(e) => setRegenerateReplace(e.target.checked)}
                    disabled={regenerateRunning || !reviewResult}
                    className="rounded bg-slate-800 border-slate-600"
                  />
                  <label htmlFor="regenerateReplace" className="text-xs text-slate-400 cursor-pointer">
                    Replace session (delete old)
                  </label>
                </div>
                <button
                  onClick={runSessionRegenerate}
                  disabled={regenerateRunning || !reviewResult || !!regenerateResult}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    regenerateRunning || regenerateResult
                      ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  {regenerateRunning ? "Regenerating..." : regenerateResult ? "Regeneration Complete" : "Regenerate Session"}
                </button>
                {regenerateResult && (
                  <button
                    onClick={async () => {
                      setLoadingSession(true);
                      try {
                        // Fetch session by ID from vault API
                        const res = await fetch(`/api/vault/sessions/${encodeURIComponent(regenerateResult.replacement.id)}`);
                        const data = await res.json();
                        if (res.ok && data && !data.error) {
                          setViewingSession(data);
                          // Check if session is favorited
                          checkSessionFavoriteStatus(data.id).catch(() => {});
                        } else {
                          alert(data?.error || "Session not found");
                        }
                      } catch (e: any) {
                        alert("Error loading session: " + e.message);
                      } finally {
                        setLoadingSession(false);
                      }
                    }}
                    disabled={loadingSession}
                    className="px-4 py-2 rounded-lg text-sm font-semibold border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    {loadingSession ? "Loading..." : `View ${regenerateResult.replaced ? "New" : "Replacement"} Session`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-fr items-stretch">
          {/* Sessions Card - Split */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4 h-full flex flex-col">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3 min-h-[32px] flex items-center">Sessions</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500">Generated</div>
                <div className="text-xl font-bold text-slate-300">
                  {formatNumber(stats?.database.totalSessions || 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">In Vault</div>
                <div className="text-xl font-bold text-emerald-400">
                  {formatNumber(stats?.database.vaultSessions || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Drills Card - Split */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4 h-full flex flex-col">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3 min-h-[32px] flex items-center">Drills (in Sessions)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500">In Vault</div>
                <div className="text-xl font-bold text-cyan-400">
                  {formatNumber(stats?.database.sessionDrillsCount || 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Standalone</div>
                <div className="text-xl font-bold text-slate-300">
                  {formatNumber(stats?.database.totalDrills || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Series Card */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4 h-full flex flex-col">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3 min-h-[32px] flex items-center">Series</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-xl font-bold text-blue-400">
                  {formatNumber(stats?.database.totalSeries || 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Sessions</div>
                <div className="text-xl font-bold text-slate-300">
                  {formatNumber(stats?.database.seriesSessions || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* API Stats Card */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4 h-full flex flex-col">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3 min-h-[32px] flex items-center">API</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500">Calls</div>
                <div className="text-xl font-bold text-purple-400">
                  {formatNumber(stats?.api.totalCalls || 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Avg Time</div>
                <div className="text-xl font-bold text-amber-400">
                  {stats?.performance.avgDurationSec}s
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Calculator */}
        {(() => {
          const totalSessions = stats?.database.vaultSessions || 0;
          const apiCost = parseFloat(stats?.tokens.allTimeCost || "0");
          const revenue = totalSessions * pricePerSession;
          const profit = revenue - apiCost;
          const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0";
          
          // Calculate daily averages from timeline for projections
          const avgSessionsPerDay = timeline.length > 0 
            ? timeline.reduce((sum, d) => sum + d.sessions, 0) / timeline.length 
            : 0;
          const projectedMonthlyRevenue = avgSessionsPerDay * 30 * pricePerSession;
          const projectedYearlyRevenue = avgSessionsPerDay * 365 * pricePerSession;
          
          return (
            <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900/70 border border-emerald-700/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-emerald-300">Revenue Calculator</div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.10"
                    max="1.00"
                    step="0.05"
                    value={pricePerSession}
                    onChange={(e) => setPricePerSession(parseFloat(e.target.value))}
                    className="w-32 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="text-sm font-bold text-emerald-400 bg-slate-800/50 px-3 py-1 rounded min-w-[70px] text-center">
                    ${pricePerSession.toFixed(2)}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-xs text-slate-500">Total Revenue</div>
                  <div className="text-2xl font-bold text-emerald-400">${revenue.toFixed(2)}</div>
                  <div className="text-xs text-slate-500">{formatNumber(totalSessions)} sessions</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">API Costs</div>
                  <div className="text-2xl font-bold text-red-400">${apiCost.toFixed(4)}</div>
                  <div className="text-xs text-slate-500">Gemini tokens</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Net Profit</div>
                  <div className={`text-2xl font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${profit.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">{profitMargin}% margin</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Avg Sessions/Day</div>
                  <div className="text-2xl font-bold text-blue-400">{avgSessionsPerDay.toFixed(1)}</div>
                  <div className="text-xs text-slate-500">last 7 days</div>
                </div>
              </div>

              <div className="border-t border-slate-700/50 pt-4">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Projected Revenue @ ${pricePerSession.toFixed(2)}/session</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500">Weekly</div>
                    <div className="text-lg font-bold text-amber-400">${(avgSessionsPerDay * 7 * pricePerSession).toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500">Monthly</div>
                    <div className="text-lg font-bold text-amber-400">${projectedMonthlyRevenue.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500">Yearly</div>
                    <div className="text-lg font-bold text-amber-400">${projectedYearlyRevenue.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Token & Cost Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Total Tokens (All Time)</div>
            <div className="flex items-baseline gap-4">
              <div className="text-3xl font-bold text-cyan-400">
                {formatNumber(stats?.tokens.allTimeTotal || 0)}
              </div>
              <div className="text-lg text-emerald-400 font-medium">
                ${stats?.tokens.allTimeCost || "0.0000"}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Input: </span>
                <span className="text-slate-300">{formatNumber(stats?.tokens.allTimePromptTokens || 0)}</span>
                <span className="text-slate-500 ml-1">@ ${stats?.pricing.inputPer1M || 0.10}/1M</span>
              </div>
              <div>
                <span className="text-slate-500">Output: </span>
                <span className="text-slate-300">{formatNumber(stats?.tokens.allTimeCompletionTokens || 0)}</span>
                <span className="text-slate-500 ml-1">@ ${stats?.pricing.outputPer1M || 0.40}/1M</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Avg Tokens by Operation</div>
            {operationStats.length > 0 ? (
              <div className="space-y-2">
                {operationStats.map((op) => (
                  <div key={op.type} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded ${
                        op.type === "session" ? "bg-emerald-500" :
                        op.type === "drill" ? "bg-cyan-500" :
                        op.type === "qa_review" ? "bg-blue-500" :
                        op.type === "skill_focus" ? "bg-purple-500" :
                        op.type === "series" ? "bg-amber-500" :
                        op.type === "chat" ? "bg-pink-500" :
                        op.type === "fixer" ? "bg-orange-500" : "bg-slate-500"
                      }`} />
                      <span className="capitalize text-slate-300">{op.type.replace(/_/g, " ")}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-cyan-400 font-medium">{formatNumber(op.avgTokens)}</span>
                      <span className="text-slate-500 ml-2 text-xs">~${op.avgCost}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No operation data yet</div>
            )}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Timeline Chart */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Daily Generation (Last 7 Days)</h2>
            {timeline.length > 0 ? (
              <div className="space-y-2">
                {timeline.map((day) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-slate-400">
                      {new Date(day.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                    <div className="flex-1 flex items-center gap-1 h-6">
                      {/* Stacked bar */}
                      <div
                        className="h-full bg-emerald-500 rounded-l"
                        style={{ width: `${Math.max(2, (day.sessions / Math.max(...timeline.map(t => t.calls)) * 100))}%` }}
                        title={`${day.sessions} sessions`}
                      />
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${Math.max(1, (day.qaReviews / Math.max(...timeline.map(t => t.calls)) * 50))}%` }}
                        title={`${day.qaReviews} QA reviews`}
                      />
                      <div
                        className="h-full bg-purple-500 rounded-r"
                        style={{ width: `${Math.max(1, (day.skillFocus / Math.max(...timeline.map(t => t.calls)) * 30))}%` }}
                        title={`${day.skillFocus} skill focus`}
                      />
                    </div>
                    <div className="w-16 text-right text-xs text-slate-400">
                      {day.calls} calls
                    </div>
                  </div>
                ))}
                <div className="flex gap-4 text-xs text-slate-500 mt-3 pt-2 border-t border-slate-700">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded" /> Sessions</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded" /> QA</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-500 rounded" /> Skill Focus</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No data for the selected period</div>
            )}
          </div>

          {/* Operations Breakdown */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">By Operation Type</h2>
            {operationStats.length > 0 ? (
              <div className="space-y-3">
                {operationStats.map((op) => (
                  <div key={op.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded ${
                        op.type === "session" ? "bg-emerald-500" :
                        op.type === "drill" ? "bg-cyan-500" :
                        op.type === "qa_review" ? "bg-blue-500" :
                        op.type === "skill_focus" ? "bg-purple-500" :
                        op.type === "series" ? "bg-amber-500" :
                        op.type === "chat" ? "bg-pink-500" :
                        op.type === "fixer" ? "bg-orange-500" : "bg-slate-500"
                      }`} />
                      <span className="text-sm capitalize">{op.type.replace(/_/g, " ")}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{formatNumber(op.count)} calls</div>
                      <div className="text-xs text-slate-500">
                        {formatNumber(op.totalTokens)} tokens • ${op.totalCost}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No operation data yet</div>
            )}
          </div>
        </div>

        {/* QA Status Analytics */}
        <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">QA Status Analytics</h2>
            <button
              onClick={fetchQaAnalytics}
              disabled={loadingQaAnalytics}
              className="px-3 py-1 text-xs rounded-lg border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              {loadingQaAnalytics ? "Loading..." : "Refresh"}
            </button>
          </div>
          
          {qaAnalytics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="px-3 py-2 bg-emerald-900/30 rounded-lg border border-emerald-700/30">
                  <div className="text-xs text-emerald-300/70 mb-1">OK</div>
                  <div className="text-2xl font-bold text-emerald-400">{qaAnalytics.statusCounts.OK || 0}</div>
                  <div className="text-[10px] text-emerald-300/50 mt-1">
                    {qaAnalytics.total > 0 ? ((qaAnalytics.statusCounts.OK / qaAnalytics.total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="px-3 py-2 bg-yellow-900/30 rounded-lg border border-yellow-700/30">
                  <div className="text-xs text-yellow-300/70 mb-1">PATCHABLE</div>
                  <div className="text-2xl font-bold text-yellow-400">{qaAnalytics.statusCounts.PATCHABLE || 0}</div>
                  <div className="text-[10px] text-yellow-300/50 mt-1">
                    {qaAnalytics.total > 0 ? ((qaAnalytics.statusCounts.PATCHABLE / qaAnalytics.total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="px-3 py-2 bg-red-900/30 rounded-lg border border-red-700/30">
                  <div className="text-xs text-red-300/70 mb-1">NEEDS_REGEN</div>
                  <div className="text-2xl font-bold text-red-400">{qaAnalytics.statusCounts.NEEDS_REGEN || 0}</div>
                  <div className="text-[10px] text-red-300/50 mt-1">
                    {qaAnalytics.total > 0 ? ((qaAnalytics.statusCounts.NEEDS_REGEN / qaAnalytics.total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="text-xs text-slate-400 mb-1">NO_QA</div>
                  <div className="text-2xl font-bold text-slate-300">{qaAnalytics.statusCounts.NO_QA_OR_PASS || 0}</div>
                  <div className="text-[10px] text-slate-400/50 mt-1">
                    {qaAnalytics.total > 0 ? ((qaAnalytics.statusCounts.NO_QA_OR_PASS / qaAnalytics.total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400 space-y-1">
                <div>Total Vault Sessions: <span className="text-slate-200 font-semibold">{qaAnalytics.total}</span></div>
                <div>Sessions with QA: <span className="text-slate-200 font-semibold">{qaAnalytics.withQA}</span></div>
                <div>Sessions without QA: <span className="text-slate-200 font-semibold">{qaAnalytics.withoutQA}</span></div>
              </div>

              {/* Show sample sessions for each status */}
              {(qaAnalytics.statusCounts.PATCHABLE > 0 || qaAnalytics.statusCounts.NEEDS_REGEN > 0) && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-300 mb-2">
                    View Sample Sessions by Status
                  </summary>
                  <div className="mt-3 space-y-4">
                    {qaAnalytics.statusCounts.PATCHABLE > 0 && qaAnalytics.sessionsByStatus.PATCHABLE.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-yellow-400 mb-2">
                          PATCHABLE Sessions ({qaAnalytics.statusCounts.PATCHABLE} total)
                        </div>
                        <div className="space-y-1">
                          {qaAnalytics.sessionsByStatus.PATCHABLE.slice(0, 5).map((s) => (
                            <div key={s.id} className="text-[10px] text-slate-400 flex items-center gap-2">
                              {s.refCode && (
                                <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 font-mono border border-cyan-700/30">
                                  {s.refCode}
                                </span>
                              )}
                              <span className="truncate">{s.title}</span>
                              {s.qaScore !== null && (
                                <span className="text-yellow-400 ml-auto">QA: {s.qaScore.toFixed(2)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {qaAnalytics.statusCounts.NEEDS_REGEN > 0 && qaAnalytics.sessionsByStatus.NEEDS_REGEN.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-red-400 mb-2">
                          NEEDS_REGEN Sessions ({qaAnalytics.statusCounts.NEEDS_REGEN} total)
                        </div>
                        <div className="space-y-1">
                          {qaAnalytics.sessionsByStatus.NEEDS_REGEN.slice(0, 5).map((s) => (
                            <div key={s.id} className="text-[10px] text-slate-400 flex items-center gap-2">
                              {s.refCode && (
                                <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 font-mono border border-cyan-700/30">
                                  {s.refCode}
                                </span>
                              )}
                              <span className="truncate">{s.title}</span>
                              {s.qaScore !== null && (
                                <span className="text-red-400 ml-auto">QA: {s.qaScore.toFixed(2)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          ) : loadingQaAnalytics ? (
            <div className="text-center py-4 text-sm text-slate-400">Loading QA analytics...</div>
          ) : (
            <div className="text-center py-4 text-sm text-slate-500">Click Refresh to load QA analytics</div>
          )}
        </div>

        {/* Age Group Distribution */}
        <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-1">Sessions by Age Group</h2>
          <p className="text-xs text-slate-500 mb-4">
            Matches Vault behavior: “Sessions” excludes series sessions; “Series Sessions” are counted separately.
          </p>

          {(() => {
            const toMap = (rows: AgeGroupStats[]) =>
              new Map(rows.map((r) => [r.ageGroup, r.count] as const));

            const sessionsMap = toMap(ageGroupStats);
            const seriesMap = toMap(seriesAgeGroupStats);

            const normalizedSessions = VAULT_AGE_GROUPS.map((ag) => ({
              ageGroup: ag,
              count: sessionsMap.get(ag) ?? 0,
            }));
            const normalizedSeries = VAULT_AGE_GROUPS.map((ag) => ({
              ageGroup: ag,
              count: seriesMap.get(ag) ?? 0,
            }));

            const anySessions = normalizedSessions.some((x) => x.count > 0);
            const anySeries = normalizedSeries.some((x) => x.count > 0);

            return (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-slate-300 mb-2">Vault Sessions (non-series)</div>
                <div className="flex flex-wrap gap-3">
                  {normalizedSessions.map((ag) => (
                    <div
                      key={`sessions-${ag.ageGroup}`}
                      className="px-3 py-2 bg-slate-800 rounded-lg border border-slate-700"
                    >
                      <div className="text-xs text-slate-400">{ag.ageGroup}</div>
                      <div className="text-lg font-semibold text-emerald-400">{ag.count}</div>
                    </div>
                  ))}
                </div>
                {!anySessions && (
                  <div className="mt-2 text-sm text-slate-500">All age groups are 0</div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-300 mb-2">Series Sessions</div>
                <div className="flex flex-wrap gap-3">
                  {normalizedSeries.map((ag) => (
                    <div
                      key={`series-${ag.ageGroup}`}
                      className="px-3 py-2 bg-slate-800 rounded-lg border border-slate-700"
                    >
                      <div className="text-xs text-slate-400">{ag.ageGroup}</div>
                      <div className="text-lg font-semibold text-cyan-400">{ag.count}</div>
                    </div>
                  ))}
                </div>
                {!anySeries && (
                  <div className="mt-2 text-sm text-slate-500">All age groups are 0</div>
                )}
              </div>
            </div>
            );
          })()}
        </div>

        {/* Recent API Calls */}
        <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Recent API Calls</h2>
          {recentMetrics.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                    <th className="pb-2 pr-4">Time</th>
                    <th className="pb-2 pr-4">Operation</th>
                    <th className="pb-2 pr-4">Model</th>
                    <th className="pb-2 pr-4">Tokens</th>
                    <th className="pb-2 pr-4">Cost</th>
                    <th className="pb-2 pr-4">Duration</th>
                    <th className="pb-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMetrics.map((m) => (
                    <tr key={m.id} className="border-b border-slate-800/50">
                      <td className="py-2 pr-4 text-slate-400">
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 pr-4 capitalize">{m.operationType.replace("_", " ")}</td>
                      <td className="py-2 pr-4 text-xs text-slate-500">
                        {m.model.replace("gemini-", "").replace("-preview", "")}
                      </td>
                      <td className="py-2 pr-4">
                        {m.totalTokens ? formatNumber(m.totalTokens) : "-"}
                      </td>
                      <td className="py-2 pr-4 text-emerald-400 text-xs">
                        {calculateRowCost(m.promptTokens, m.completionTokens)}
                      </td>
                      <td className="py-2 pr-4">{formatDuration(m.durationMs)}</td>
                      <td className="py-2 pr-4">
                        {m.success ? (
                          <span className="text-emerald-400">✓</span>
                        ) : (
                          <span className="text-red-400" title={m.errorMessage || ""}>✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No recent API calls recorded</div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 pt-4 border-t border-slate-800">
          ACI Admin Dashboard • Data refreshes {autoRefresh ? "every 10s" : "on demand"}
        </div>
      </div>

      {/* Session View Modal (similar to vault) */}
      {viewingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-700/70 bg-slate-900/90 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-lg font-semibold text-slate-200">{viewingSession.title}</h2>
                  {viewingSession.refCode && (
                    <button
                      onClick={() => navigator.clipboard.writeText(viewingSession.refCode!)}
                      className="px-2 py-1 rounded bg-cyan-900/40 text-cyan-300 text-xs font-mono border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors"
                      title="Click to copy reference code"
                    >
                      {viewingSession.refCode}
                    </button>
                  )}
                  <button
                    onClick={toggleViewingSessionFavorite}
                    disabled={checkingFavorite}
                    className={`w-7 h-7 flex items-center justify-center rounded border transition-colors disabled:opacity-50 ${
                      viewingSessionIsFavorited
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30"
                        : "bg-slate-800/50 border-slate-600/50 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400"
                    }`}
                    title={viewingSessionIsFavorited ? "Remove from favorites" : "Add to favorites"}
                  >
                    <span className="text-sm font-bold">■</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs uppercase tracking-wide">Game Model:</span>
                    <span className="text-emerald-400">{gameModelLabel[viewingSession.gameModelId] || viewingSession.gameModelId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs uppercase tracking-wide">Age:</span>
                    <span className="text-slate-200">{viewingSession.ageGroup}</span>
                  </div>
                  {viewingSession.phase && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Phase:</span>
                      <span className="text-slate-200">{phaseLabel[viewingSession.phase] || viewingSession.phase}</span>
                    </div>
                  )}
                  {viewingSession.zone && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Zone:</span>
                      <span className="text-slate-200">{zoneLabel[viewingSession.zone] || viewingSession.zone}</span>
                    </div>
                  )}
                  {viewingSession.formationUsed && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Formation:</span>
                      <span className="text-blue-300">{viewingSession.formationUsed}</span>
                    </div>
                  )}
                  {viewingSession.coachLevel && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Coach Level:</span>
                      <span className="text-amber-300">{coachLevelLabel[viewingSession.coachLevel] || viewingSession.coachLevel}</span>
                    </div>
                  )}
                  {viewingSession.playerLevel && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Player Level:</span>
                      <span className="text-purple-300">{playerLevelLabel[viewingSession.playerLevel] || viewingSession.playerLevel}</span>
                    </div>
                  )}
                  {(viewingSession.numbersMin || viewingSession.numbersMax) && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Players:</span>
                      <span className="text-cyan-300">
                        {viewingSession.numbersMin === viewingSession.numbersMax 
                          ? `${viewingSession.numbersMin}`
                          : `${viewingSession.numbersMin || '?'}-${viewingSession.numbersMax || '?'}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewingSession(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {viewingSession.json?.summary && (
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">Summary</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {viewingSession.json.summary}
                  </p>
                </div>
              )}

              {viewingSession.json?.drills && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">Drills</h3>
                  {viewingSession.json.drills.map((drill: any, i: number) => (
                    <div key={i} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {drill.diagram && (
                          <div className="flex items-center justify-center">
                            <DrillDiagram
                              diagram={drill.diagram}
                              width={220}
                              height={140}
                            />
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          {drill.description && (
                            <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-4">{drill.description}</p>
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
                <Link
                  href={`/demo/session?sessionId=${viewingSession.id}`}
                  className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  View Full Session
                </Link>
                <button
                  onClick={() => setViewingSession(null)}
                  className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
