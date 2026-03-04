"use client";

import { useState, useCallback } from "react";
import {
  FileCheck,
  Star,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  Eye,
  ChevronDown,
  ChevronUp,
  Play,
  Trash2,
} from "lucide-react";
import { API_BASE, getAdminHeaders, adminFetch } from "../_lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type QAResult = {
  score: number | null;
  status: string | null;
  issues: string[];
  suggestions: string[];
};

type ReviewedSession = {
  id: string;
  refCode: string | null;
  title: string;
  qaScore: number | null;
  qaStatus: string | null;
  qa: QAResult | null;
};

type ReviewedDrill = {
  id: string;
  refCode: string | null;
  title: string;
  qaScore: number | null;
  qaStatus: string | null;
  qa: QAResult | null;
};

type NormalizeStatus = {
  total: number;
  needsNormalization: number;
  missingCore: number;
  needsReenrich: number;
  processed: number;
  job?: { running: boolean; processed: number; total: number; error?: string } | null;
  reenrichJob?: { running: boolean; processed: number; total: number; error?: string } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    OK: "bg-emerald-500/20 text-emerald-300",
    PATCHABLE: "bg-yellow-500/20 text-yellow-300",
    NEEDS_REGEN: "bg-red-500/20 text-red-300",
    PASS: "bg-emerald-500/20 text-emerald-300",
    FAIL: "bg-red-500/20 text-red-300",
  };
  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${colors[status] ?? "bg-slate-700 text-slate-400"}`}>
      {status}
    </span>
  );
}

function ScoreRing({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-600 text-sm">—</span>;
  const color =
    score >= 80 ? "text-emerald-400" :
    score >= 60 ? "text-yellow-400" :
    "text-red-400";
  return <span className={`text-2xl font-bold ${color}`}>{score}</span>;
}

function SectionPanel({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <span className="font-semibold text-sm text-slate-200">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-600" />}
      </button>
      {open && <div className="border-t border-slate-800 p-5">{children}</div>}
    </div>
  );
}

// ─── QA Review ────────────────────────────────────────────────────────────────

function QAReviewPanel() {
  const [sessionRef, setSessionRef] = useState("");
  const [drillRef, setDrillRef] = useState("");
  const [reviewingSession, setReviewingSession] = useState(false);
  const [reviewingDrill, setReviewingDrill] = useState(false);
  const [sessionResult, setSessionResult] = useState<ReviewedSession | null>(null);
  const [drillResult, setDrillResult] = useState<ReviewedDrill | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [drillError, setDrillError] = useState<string | null>(null);

  async function reviewSession() {
    const ref = sessionRef.trim();
    if (!ref) { setSessionError("Enter a session ID or ref code"); return; }
    setReviewingSession(true);
    setSessionError(null);
    setSessionResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/sessions/${encodeURIComponent(ref)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Review failed (${res.status})`);
      setSessionResult(data.session ?? data);
    } catch (err: any) {
      setSessionError(err?.message ?? "Review failed");
    } finally {
      setReviewingSession(false);
    }
  }

  async function reviewDrill() {
    const ref = drillRef.trim();
    if (!ref) { setDrillError("Enter a drill ID or ref code"); return; }
    setReviewingDrill(true);
    setDrillError(null);
    setDrillResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/drills/${encodeURIComponent(ref)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Review failed (${res.status})`);
      setDrillResult(data.drill ?? data);
    } catch (err: any) {
      setDrillError(err?.message ?? "Review failed");
    } finally {
      setReviewingDrill(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Session review */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Review Session</p>
        <div className="flex gap-2">
          <input
            value={sessionRef}
            onChange={(e) => setSessionRef(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && reviewSession()}
            placeholder="S-AB12 or UUID"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none font-mono"
          />
          <button
            onClick={reviewSession}
            disabled={reviewingSession}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            <Play className="h-3.5 w-3.5" />
            {reviewingSession ? "Reviewing…" : "Review"}
          </button>
        </div>
        {sessionError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {sessionError}
          </div>
        )}
        {sessionResult && (
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-200">{sessionResult.title}</p>
                <p className="text-[11px] font-mono text-slate-600">{sessionResult.refCode}</p>
              </div>
              <div className="text-right">
                <ScoreRing score={sessionResult.qaScore} />
                <StatusBadge status={sessionResult.qaStatus} />
              </div>
            </div>
            {sessionResult.qa?.issues && sessionResult.qa.issues.length > 0 && (
              <div>
                <p className="text-[10px] text-red-400 uppercase tracking-wide mb-1">Issues</p>
                <ul className="space-y-0.5">
                  {sessionResult.qa.issues.map((issue, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                      <XCircle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sessionResult.qa?.suggestions && sessionResult.qa.suggestions.length > 0 && (
              <div>
                <p className="text-[10px] text-amber-400 uppercase tracking-wide mb-1">Suggestions</p>
                <ul className="space-y-0.5">
                  {sessionResult.qa.suggestions.map((s, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drill review */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Review Drill</p>
        <div className="flex gap-2">
          <input
            value={drillRef}
            onChange={(e) => setDrillRef(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && reviewDrill()}
            placeholder="D-AB12 or UUID"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-violet-500 focus:outline-none font-mono"
          />
          <button
            onClick={reviewDrill}
            disabled={reviewingDrill}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            <Play className="h-3.5 w-3.5" />
            {reviewingDrill ? "Reviewing…" : "Review"}
          </button>
        </div>
        {drillError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {drillError}
          </div>
        )}
        {drillResult && (
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-200">{drillResult.title}</p>
                <p className="text-[11px] font-mono text-slate-600">{drillResult.refCode}</p>
              </div>
              <div className="text-right">
                <ScoreRing score={drillResult.qaScore} />
                <StatusBadge status={drillResult.qaStatus} />
              </div>
            </div>
            {drillResult.qa?.issues && drillResult.qa.issues.length > 0 && (
              <div>
                <p className="text-[10px] text-red-400 uppercase tracking-wide mb-1">Issues</p>
                <ul className="space-y-0.5">
                  {drillResult.qa.issues.map((issue, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                      <XCircle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Session Regeneration panel ───────────────────────────────────────────────

function RegeneratePanel() {
  const [ref, setRef] = useState("");
  const [replace, setReplace] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ replaced: boolean; replacement: { refCode: string | null; title: string } } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRegen() {
    const r = ref.trim();
    if (!r) { setError("Enter a session ref code"); return; }
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/sessions/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({ sessionRef: r, replace }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Regen failed (${res.status})`);
      setResult(data);
    } catch (err: any) {
      setError(err?.message ?? "Regeneration failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Session Ref Code
          </label>
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="S-AB12 or UUID"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none font-mono"
          />
        </div>
        <label className="flex items-center gap-2 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800"
          />
          <span className="text-sm text-slate-300">Replace original</span>
        </label>
        <button
          onClick={handleRegen}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
          {running ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      {result && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/10 px-4 py-3">
          <p className="text-sm text-emerald-300">
            ✓ {result.replaced ? "Replaced original with" : "Generated new"}: {" "}
            <span className="font-mono">{result.replacement?.refCode ?? "—"}</span>{" "}
            <span className="text-slate-400">— {result.replacement?.title}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Delete session panel ─────────────────────────────────────────────────────

function DeleteSessionPanel() {
  const [ref, setRef] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const r = ref.trim();
    if (!r) { setError("Enter a session ID or ref code"); return; }
    if (!confirm(`Delete session "${r}"? This cannot be undone.`)) return;
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/sessions/${encodeURIComponent(r)}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Delete failed (${res.status})`);
      setResult(`Deleted: ${r}`);
      setRef("");
    } catch (err: any) {
      setError(err?.message ?? "Delete failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Session ID or ref code (e.g. S-AB12)"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-red-500 focus:outline-none font-mono"
        />
        <button
          onClick={handleDelete}
          disabled={running || !ref.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-red-600/80 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {running ? "Deleting…" : "Delete"}
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      {result && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/10 px-4 py-2.5">
          <p className="text-sm text-emerald-300">✓ {result}</p>
        </div>
      )}
    </div>
  );
}

// ─── Normalization panel ──────────────────────────────────────────────────────

function NormalizationPanel() {
  const [status, setStatus] = useState<NormalizeStatus | null>(null);
  const [batchSize, setBatchSize] = useState(50);
  const [reenrichBatchSize, setReenrichBatchSize] = useState(20);
  const [includeSessions, setIncludeSessions] = useState(false);
  const [running, setRunning] = useState(false);
  const [reenrichRunning, setReenrichRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await adminFetch<{ ok: boolean } & NormalizeStatus>("/admin/drills/normalize-status");
      if (data.ok) {
        const { ok: _ok, ...rest } = data;
        setStatus(rest as NormalizeStatus);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load status");
    }
  }, []);

  async function runNormalize() {
    setRunning(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/drills/normalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({ limit: batchSize }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Normalize failed");
      await loadStatus();
    } catch (err: any) {
      setError(err?.message ?? "Normalize failed");
    } finally {
      setRunning(false);
    }
  }

  async function runReenrich() {
    setReenrichRunning(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/drills/re-enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminHeaders() },
        body: JSON.stringify({ limit: reenrichBatchSize, includeSessions }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Re-enrich failed");
      await loadStatus();
    } catch (err: any) {
      setError(err?.message ?? "Re-enrich failed");
    } finally {
      setReenrichRunning(false);
    }
  }

  return (
    <div className="space-y-5">
      <button
        onClick={loadStatus}
        className="inline-flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Load Status
      </button>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {status && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Drills", value: status.total, color: "text-slate-100" },
            { label: "Needs Normalize", value: status.needsNormalization, color: "text-amber-400" },
            { label: "Missing Core", value: status.missingCore, color: "text-red-400" },
            { label: "Needs Re-enrich", value: status.needsReenrich, color: "text-violet-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-3">
              <p className="text-[10px] text-slate-600 uppercase tracking-wide">{label}</p>
              <p className={`mt-1 text-xl font-bold ${color}`}>{value?.toLocaleString() ?? "—"}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Normalize */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-300">Normalize Diagrams</p>
          <p className="text-xs text-slate-600">Fix diagram schema and remove generic overlays</p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Batch:</label>
            <input
              type="number"
              min={1} max={500}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
            />
          </div>
          {status?.job?.running && (
            <div className="text-xs text-amber-300">
              Running: {status.job.processed}/{status.job.total}
            </div>
          )}
          <button
            onClick={runNormalize}
            disabled={running}
            className="w-full rounded-xl bg-slate-700 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-50 transition-colors"
          >
            {running ? "Running…" : "Run Normalization"}
          </button>
        </div>

        {/* Re-enrich */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-300">Re-enrich via LLM</p>
          <p className="text-xs text-slate-600">Regenerate enrichment data using the AI model</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Batch:</label>
              <input
                type="number"
                min={1} max={100}
                value={reenrichBatchSize}
                onChange={(e) => setReenrichBatchSize(Number(e.target.value))}
                className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSessions}
                onChange={(e) => setIncludeSessions(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800"
              />
              Include sessions
            </label>
          </div>
          {status?.reenrichJob?.running && (
            <div className="text-xs text-amber-300">
              Running: {status.reenrichJob.processed}/{status.reenrichJob.total}
            </div>
          )}
          <button
            onClick={runReenrich}
            disabled={reenrichRunning}
            className="w-full rounded-xl bg-violet-700/60 py-2 text-sm font-semibold text-slate-200 hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {reenrichRunning ? "Running…" : "Run Re-enrichment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminContentPage() {
  return (
    <div className="max-w-4xl space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">Content & QA</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Review AI-generated sessions and drills, run quality scoring, regenerate, and manage diagram normalization.
        </p>
      </div>

      {/* QA Review */}
      <SectionPanel title="QA Review" icon={Star}>
        <QAReviewPanel />
      </SectionPanel>

      {/* Session Regeneration */}
      <SectionPanel title="Session Regeneration" icon={RefreshCw} defaultOpen={false}>
        <RegeneratePanel />
      </SectionPanel>

      {/* Delete Session */}
      <SectionPanel title="Delete Session" icon={Trash2} defaultOpen={false}>
        <p className="mb-3 text-xs text-slate-600">
          Permanently delete a session from the vault by ID or ref code. This cannot be undone.
        </p>
        <DeleteSessionPanel />
      </SectionPanel>

      {/* Diagram Normalization */}
      <SectionPanel title="Diagram Normalization & Re-enrichment" icon={Wrench} defaultOpen={false}>
        <NormalizationPanel />
      </SectionPanel>
    </div>
  );
}
