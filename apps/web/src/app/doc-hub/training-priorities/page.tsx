"use client";

import { useCallback, useEffect, useState } from "react";
import { useDocHub } from "../_lib/DocHubContext";
import type {
  GeneratedDrillResult,
  PrincipleWithSubprinciples,
  TeamListRow,
  TrainingPriorityRow,
} from "../_lib/types";
import {
  authHeaders,
  btnPrimary,
  btnPrimarySm,
  btnSecondary,
  btnSecondarySm,
  mondayWeekStartIso,
} from "../_lib/utils";

const READINESS_LABEL: Record<string, string> = {
  FOUNDATIONAL: "Foundational",
  DEVELOPING: "Developing",
  ADVANCED: "Advanced",
};

const READINESS_PILL: Record<string, string> = {
  FOUNDATIONAL: "border-slate-600 bg-slate-800 text-slate-300",
  DEVELOPING: "border-cyan-400/30 bg-cyan-500/15 text-cyan-300",
  ADVANCED: "border-violet-400/30 bg-violet-500/15 text-violet-300",
};

const OUTCOME_OPTIONS = ["RARELY", "SOMETIMES", "CONSISTENTLY"] as const;
const OUTCOME_LABEL: Record<string, string> = {
  RARELY: "Rarely",
  SOMETIMES: "Sometimes",
  CONSISTENTLY: "Consistently",
};

export default function DocHubTrainingPrioritiesPage() {
  const { access, selectedClubId, canEditPhilosophy } = useDocHub();
  const [teams, setTeams] = useState<TeamListRow[]>([]);
  const [principles, setPrinciples] = useState<PrincipleWithSubprinciples[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [priorities, setPriorities] = useState<TrainingPriorityRow[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingPriorities, setLoadingPriorities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadTeamsAndPrinciples = useCallback(async (clubId: string) => {
    setLoadingTeams(true);
    setError(null);
    try {
      const [teamsRes, principlesRes] = await Promise.all([
        fetch(`/api/doc-hub/clubs/${clubId}/teams`, { headers: authHeaders() }),
        fetch(`/api/doc-hub/clubs/${clubId}/principles`, { headers: authHeaders() }),
      ]);
      const teamsData = await teamsRes.json().catch(() => ({}));
      const principlesData = await principlesRes.json().catch(() => ({}));
      if (!teamsRes.ok || !teamsData?.ok) throw new Error(teamsData?.error || "Failed to load teams");
      if (!principlesRes.ok || !principlesData?.ok) {
        throw new Error(principlesData?.error || "Failed to load the club's game model");
      }
      const teamRows: TeamListRow[] = (teamsData.teams || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        ageGroup: t.ageGroup,
      }));
      setTeams(teamRows);
      setPrinciples(principlesData.principles || []);
      setSelectedTeamId((prev) => (prev && teamRows.some((t) => t.id === prev) ? prev : teamRows[0]?.id || ""));
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoadingTeams(false);
    }
  }, []);

  const loadPriorities = useCallback(async (clubId: string, teamId: string) => {
    setLoadingPriorities(true);
    setError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/teams/${teamId}/training-priorities`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load training priorities");
      setPriorities(data.priorities || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load training priorities");
      setPriorities([]);
    } finally {
      setLoadingPriorities(false);
    }
  }, []);

  useEffect(() => {
    if (access === "allowed" && selectedClubId) void loadTeamsAndPrinciples(selectedClubId);
  }, [access, selectedClubId, loadTeamsAndPrinciples]);

  useEffect(() => {
    if (selectedClubId && selectedTeamId) void loadPriorities(selectedClubId, selectedTeamId);
  }, [selectedClubId, selectedTeamId, loadPriorities]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Training Priorities</h1>
          <p className="mt-1 text-sm text-slate-400">
            Assign a team&apos;s weekly focus from the club&apos;s own game model, generate a drill for it, and
            track whether it stuck.
          </p>
        </div>
        <button
          type="button"
          className={btnPrimary}
          disabled={!selectedTeamId || !canEditPhilosophy}
          onClick={() => setShowCreate(true)}
        >
          Assign this week&apos;s priority
        </button>
      </div>

      <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
        Team
        <select
          className="mt-1.5 w-full max-w-xs rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/60 sm:w-auto"
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
        >
          {teams.length === 0 ? <option value="">No teams</option> : null}
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.ageGroup})
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
        {loadingTeams || loadingPriorities ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : teams.length === 0 ? (
          <p className="text-sm text-slate-400">No teams in this club yet -- add one in Teams first.</p>
        ) : priorities.length === 0 ? (
          <p className="text-sm text-slate-400">No priorities assigned to {selectedTeam?.name} yet.</p>
        ) : (
          <ul className="space-y-4">
            {priorities.map((priority) => (
              <PriorityCard
                key={priority.id}
                priority={priority}
                clubId={selectedClubId}
                canEdit={canEditPhilosophy}
                onChanged={() => {
                  if (selectedClubId && selectedTeamId) void loadPriorities(selectedClubId, selectedTeamId);
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {!canEditPhilosophy && !loadingTeams && !error ? (
        <p className="text-xs text-slate-500">Read-only -- only the club&apos;s DOC can assign or resolve priorities.</p>
      ) : null}

      {showCreate && selectedClubId && selectedTeamId ? (
        <CreatePriorityModal
          clubId={selectedClubId}
          teamId={selectedTeamId}
          teamAgeGroup={selectedTeam?.ageGroup || ""}
          principles={principles}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void loadPriorities(selectedClubId, selectedTeamId);
          }}
        />
      ) : null}
    </div>
  );
}

function PriorityCard({
  priority,
  clubId,
  canEdit,
  onChanged,
}: {
  priority: TrainingPriorityRow;
  clubId: string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedDrillResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [showResolve, setShowResolve] = useState(false);

  async function generateDrill() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(
        `/api/doc-hub/clubs/${clubId}/training-priorities/${priority.id}/generate-drill`,
        { method: "POST", headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.message || data?.error || "Generation failed");
      setResult({ intent: data.intent, drill: data.drill, qa: data.qa });
    } catch (e: any) {
      setGenError(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function resolve(outcome: string, notes: string) {
    setResolving(true);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/training-priorities/${priority.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ outcome, outcomeNotes: notes || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.message || data?.error || "Could not resolve");
      setShowResolve(false);
      onChanged();
    } catch (e: any) {
      alert(e?.message || "Could not resolve");
    } finally {
      setResolving(false);
    }
  }

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Week of {priority.weekStart.slice(0, 10)}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusPillClasses(priority.status)}`}
            >
              {priority.status}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${READINESS_PILL[priority.subprinciple.readiness]}`}
            >
              {READINESS_LABEL[priority.subprinciple.readiness]}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-100">{priority.subprinciple.trigger}</p>
          <p className="mt-1 text-xs text-slate-400">{priority.subprinciple.response}</p>
          <p className="mt-2 text-xs italic text-slate-500">&ldquo;{priority.rationale}&rdquo;</p>
          {priority.status === "RESOLVED" ? (
            <p className="mt-2 text-xs text-emerald-300">
              Outcome: {priority.outcome ? OUTCOME_LABEL[priority.outcome] : "—"}
              {priority.outcomeNotes ? ` — ${priority.outcomeNotes}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button type="button" className={btnSecondarySm} disabled={generating} onClick={generateDrill}>
            {generating ? "Generating…" : "Generate Drill"}
          </button>
          {priority.status === "ACTIVE" && canEdit ? (
            <button type="button" className={btnSecondarySm} onClick={() => setShowResolve((v) => !v)}>
              Resolve
            </button>
          ) : null}
        </div>
      </div>

      {genError ? <p className="mt-3 text-xs text-rose-300">{genError}</p> : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-100">{result.drill.title}</p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                result.qa.pass
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                  : "border-rose-400/30 bg-rose-500/15 text-rose-300"
              }`}
            >
              QA {result.qa.pass ? "Pass" : "Fail"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {result.drill.organization.area.lengthYards} × {result.drill.organization.area.widthYards} yd
          </p>
          {result.qa.principleAlignment?.contradicted ? (
            <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-200">
              Principle alignment contradiction: {result.qa.principleAlignment.contradictingConstraint}
            </p>
          ) : null}
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Constraints</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-300">
              {result.drill.constraints.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Coaching points</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-300">
              {result.drill.coachingPoints.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {showResolve ? (
        <ResolveForm resolving={resolving} onCancel={() => setShowResolve(false)} onSubmit={resolve} />
      ) : null}
    </li>
  );
}

function statusPillClasses(status: string) {
  return status === "ACTIVE"
    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
    : "border-slate-600 bg-slate-800 text-slate-400";
}

function ResolveForm({
  resolving,
  onCancel,
  onSubmit,
}: {
  resolving: boolean;
  onCancel: () => void;
  onSubmit: (outcome: string, notes: string) => void;
}) {
  const [outcome, setOutcome] = useState<string>("SOMETIMES");
  const [notes, setNotes] = useState("");

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
        Did the team improve on this?
        <select
          className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        >
          {OUTCOME_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABEL[o]}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-xs font-medium uppercase tracking-wider text-slate-500">
        Notes (optional)
        <textarea
          className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 outline-none focus:border-emerald-500/60"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className={btnSecondary} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={btnPrimary} disabled={resolving} onClick={() => onSubmit(outcome, notes)}>
          {resolving ? "Saving…" : "Mark resolved"}
        </button>
      </div>
    </div>
  );
}

function CreatePriorityModal({
  clubId,
  teamId,
  teamAgeGroup,
  principles,
  onClose,
  onCreated,
}: {
  clubId: string;
  teamId: string;
  teamAgeGroup: string;
  principles: PrincipleWithSubprinciples[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const allSubprinciples = principles.flatMap((p) =>
    p.subprinciples.map((s) => ({ ...s, momentLabel: p.moment, statement: p.statement }))
  );
  const [subprincipleId, setSubprincipleId] = useState(allSubprinciples[0]?.id || "");
  const [weekStart, setWeekStart] = useState(mondayWeekStartIso());
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!subprincipleId || !rationale.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/training-priorities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ teamId, subprincipleId, weekStart, rationale: rationale.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.message || data?.error || "Could not assign priority");
      onCreated();
    } catch (err: any) {
      setError(err?.message || "Could not assign priority");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <form
        onSubmit={save}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Assign this week&apos;s priority</h2>
          <p className="mt-1 text-sm text-slate-400">
            {teamAgeGroup ? `${teamAgeGroup} · ` : ""}Blocked automatically if the subprinciple is above this
            team&apos;s readiness ceiling.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {allSubprinciples.length === 0 ? (
            <p className="text-sm text-slate-400">This club has no subprinciples yet.</p>
          ) : (
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
              Subprinciple
              <select
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                value={subprincipleId}
                onChange={(e) => setSubprincipleId(e.target.value)}
              >
                {principles.map((p) => (
                  <optgroup key={p.id} label={`${p.moment} — ${p.statement}`}>
                    {p.subprinciples.map((s) => (
                      <option key={s.id} value={s.id}>
                        [{READINESS_LABEL[s.readiness]}] {s.trigger}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
            Week start (Monday)
            <input
              type="date"
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
            Why this, this week?
            <textarea
              required
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 outline-none focus:border-emerald-500/60"
              rows={3}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Conceded twice from a poor build-up shape in Saturday's match."
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <button type="button" className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={saving || !subprincipleId || !rationale.trim()}>
            {saving ? "Saving…" : "Assign priority"}
          </button>
        </div>
      </form>
    </div>
  );
}
