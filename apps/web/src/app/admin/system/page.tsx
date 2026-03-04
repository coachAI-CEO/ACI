"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Settings,
  Search,
  Copy,
  CheckCheck,
  Play,
  AlertTriangle,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import { API_BASE, getAdminHeaders, adminFetch } from "../_lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

const VAULT_AGE_GROUPS = [
  "U8","U9","U10","U11","U12","U13","U14","U15","U16","U17","U18",
];

type BulkJob = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  total: number;
  completed: number;
  failed: number;
  errors: string[];
  startedAt: string | null;
  completedAt: string | null;
};

type RefCodeResult = {
  type: string;
  refCode: string;
  data: Record<string, unknown>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionPanel({
  title,
  sub,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  sub?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-slate-800/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <div>
            <span className="font-semibold text-sm text-slate-200">{title}</span>
            {sub && <span className="ml-2 text-xs text-slate-600">{sub}</span>}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-600" />}
      </button>
      {open && <div className="border-t border-slate-800 p-5">{children}</div>}
    </div>
  );
}

// ─── Reference Code Lookup ────────────────────────────────────────────────────

function RefCodeLookup() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RefCodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  async function lookup(override?: string) {
    const ref = (override ?? input).trim().toUpperCase();
    if (!ref) { setError("Enter a reference code (e.g. D-1234 or S-5678)"); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/vault/lookup/${encodeURIComponent(ref)}`, {
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data) throw new Error("Not found");
      setResult(data);
      setHistory(prev => [ref, ...prev.filter(x => x !== ref)].slice(0, 5));
    } catch (err: any) {
      setError(err?.message ?? "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  function copyJson() {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="D-AB12 or S-CD34"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none uppercase"
        />
        <button
          onClick={() => lookup()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          {loading ? "…" : "Lookup"}
        </button>
      </div>

      {history.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-slate-600 self-center">Recent:</span>
          {history.map(h => (
            <button
              key={h}
              onClick={() => { setInput(h); lookup(h); }}
              className="rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[11px] font-mono text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
            >
              {h}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded bg-slate-700 px-2 py-0.5 text-slate-300 font-medium">{result.type}</span>
              <span className="font-mono text-emerald-400">{result.refCode}</span>
            </div>
            <button
              onClick={copyJson}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              {copied ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied!" : "Copy JSON"}
            </button>
          </div>
          <pre className="max-h-80 overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-[11px] text-slate-300 whitespace-pre-wrap break-words">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Bulk Generate ────────────────────────────────────────────────────────────

function BulkGeneratePanel() {
  const [ageGroup, setAgeGroup] = useState("U10");
  const [mode, setMode] = useState<"session" | "series">("session");
  const [count, setCount] = useState(5);
  const [sessionsPerSeries, setSessionsPerSeries] = useState(4);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<BulkJob | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll job status while running
  useEffect(() => {
    if (!jobId || !running) return;
    pollRef.current = setInterval(async () => {
      try {
        const data = await adminFetch<{ ok: boolean; job: BulkJob }>(
          `/admin/random-sessions/${encodeURIComponent(jobId)}`
        );
        if (data.ok) {
          setJob(data.job);
          if (data.job.status === "completed" || data.job.status === "failed") {
            setRunning(false);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {
        // polling errors are non-fatal
      }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, running]);

  async function start() {
    setRunning(true); setError(null); setJob(null); setJobId(null);
    try {
      const res = await fetch(`${API_BASE}/admin/random-sessions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({
          ageGroup,
          mode,
          count,
          sessionsPerSeries: mode === "series" ? sessionsPerSeries : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Start failed (${res.status})`);
      setJobId(data.jobId);
    } catch (err: any) {
      setError(err?.message ?? "Failed to start job");
      setRunning(false);
    }
  }

  const progress = job
    ? Math.round(((job.completed + job.failed) / Math.max(job.total, 1)) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Generate random sessions/series for a specific age group and auto-save them to the vault.
      </p>

      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-500 uppercase tracking-wide">Mode:</span>
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-1 inline-flex">
          {(["session", "series"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              disabled={running}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                mode === m
                  ? m === "session"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-cyan-500/20 text-cyan-300"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}s
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Age Group</label>
          <select
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            disabled={running}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            {VAULT_AGE_GROUPS.map(ag => <option key={ag} value={ag}>{ag}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            {mode === "series" ? "# Series" : "# Sessions"}
          </label>
          <input
            type="number" min={1} max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={running}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-slate-200"
          />
        </div>
        {mode === "series" && (
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Sessions/Series</label>
            <input
              type="number" min={2} max={10}
              value={sessionsPerSeries}
              onChange={(e) => setSessionsPerSeries(Number(e.target.value))}
              disabled={running}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-slate-200"
            />
          </div>
        )}
        <div className="flex items-end">
          <button
            onClick={start}
            disabled={running}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {running ? (
              <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Running…</>
            ) : (
              <><Zap className="h-3.5 w-3.5" /> Generate</>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {job && (
        <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className={`font-medium ${
              job.status === "completed" ? "text-emerald-300" :
              job.status === "failed" ? "text-red-400" :
              "text-amber-300"
            }`}>
              {job.status.toUpperCase()}
            </span>
            <span className="text-slate-600">{progress}%</span>
          </div>
          {/* Progress bar */}
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${job.status === "failed" ? "bg-red-500" : "bg-emerald-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="text-emerald-400">{job.completed} done</span>
            {job.failed > 0 && <span className="text-red-400">{job.failed} failed</span>}
            <span>{job.total} total</span>
          </div>
          {job.errors?.length > 0 && (
            <div className="space-y-1">
              {job.errors.slice(0, 3).map((e, i) => (
                <p key={i} className="text-[11px] text-red-400 truncate">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── API Metrics panel ────────────────────────────────────────────────────────

function ApiMetricsPanel() {
  const [recent, setRecent] = useState<Array<{
    id: string;
    operationType: string;
    model: string;
    totalTokens: number | null;
    durationMs: number;
    success: boolean;
    errorMessage: string | null;
    ageGroup: string | null;
    gameModelId: string | null;
    createdAt: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetch<{ ok: boolean; metrics: typeof recent }>(
        "/admin/metrics/recent?limit=20"
      );
      if (data.ok) setRecent(data.metrics ?? []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {!loaded ? (
        <button
          onClick={load}
          className="inline-flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Load Recent Metrics
        </button>
      ) : (
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      )}

      {loaded && recent.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="pb-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">Type</th>
                <th className="pb-2 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">Model</th>
                <th className="pb-2 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600">Tokens</th>
                <th className="pb-2 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600">Duration</th>
                <th className="pb-2 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">Age / Model</th>
                <th className="pb-2 pl-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(m => (
                <tr key={m.id} className="border-b border-slate-800/40">
                  <td className="py-1.5 pr-3 text-slate-400 truncate max-w-[120px]">{m.operationType}</td>
                  <td className="py-1.5 px-2 text-slate-600 truncate max-w-[100px]">{m.model}</td>
                  <td className="py-1.5 px-2 text-right text-slate-400">{m.totalTokens?.toLocaleString() ?? "—"}</td>
                  <td className="py-1.5 px-2 text-right text-slate-500">{(m.durationMs / 1000).toFixed(1)}s</td>
                  <td className="py-1.5 px-2 text-slate-600">{m.ageGroup}{m.gameModelId ? ` / ${m.gameModelId}` : ""}</td>
                  <td className="py-1.5 pl-2 text-right">
                    {m.success ? (
                      <span className="text-emerald-400">✓</span>
                    ) : (
                      <span className="text-red-400" title={m.errorMessage ?? ""}>✗</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSystemPage() {
  return (
    <div className="max-w-4xl space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">System Tools</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Reference code lookup, bulk generation, and API metrics. For developer and debugging use.
        </p>
      </div>

      {/* Reference Code Lookup */}
      <SectionPanel title="Reference Code Lookup" sub="View raw JSON for any session or drill" icon={Search}>
        <RefCodeLookup />
      </SectionPanel>

      {/* Bulk Generation */}
      <SectionPanel title="Bulk Session Generation" sub="Generate random sessions/series and save to vault" icon={Zap} defaultOpen={false}>
        <BulkGeneratePanel />
      </SectionPanel>

      {/* API Metrics */}
      <SectionPanel title="Recent API Metrics" sub="Last 20 AI generation calls" icon={Clock} defaultOpen={false}>
        <ApiMetricsPanel />
      </SectionPanel>
    </div>
  );
}
