"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [recentMetrics, setRecentMetrics] = useState<RecentMetric[]>([]);
  const [operationStats, setOperationStats] = useState<OperationStats[]>([]);
  const [ageGroupStats, setAgeGroupStats] = useState<AgeGroupStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, timelineRes, recentRes, operationsRes, ageRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/metrics/timeline?days=7"),
        fetch("/api/admin/metrics/recent?limit=20"),
        fetch("/api/admin/metrics/by-operation"),
        fetch("/api/admin/stats/by-age-group"),
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
      if (ageData.ok) setAgeGroupStats(ageData.sessions);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Sessions Card - Split */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Sessions</div>
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
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Drills (in Sessions)</div>
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
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Series</div>
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
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">API</div>
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

        {/* Age Group Distribution */}
        <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Sessions by Age Group</h2>
          {ageGroupStats.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {ageGroupStats
                .sort((a, b) => {
                  const aNum = parseInt(a.ageGroup.replace(/\D/g, ""));
                  const bNum = parseInt(b.ageGroup.replace(/\D/g, ""));
                  return aNum - bNum;
                })
                .map((ag) => (
                  <div
                    key={ag.ageGroup}
                    className="px-3 py-2 bg-slate-800 rounded-lg border border-slate-700"
                  >
                    <div className="text-xs text-slate-400">{ag.ageGroup}</div>
                    <div className="text-lg font-semibold text-emerald-400">{ag.count}</div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No age group data</div>
          )}
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
    </div>
  );
}
