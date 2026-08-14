"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, X } from "lucide-react";

export type PhilosophyForm = {
  attackingOrganization: string;
  defensiveTransition: string;
  defensiveOrganization: string;
  attackingTransition: string;
};

export type PhilosophyStageKey = keyof PhilosophyForm;

type AssistMode = "polish" | "expand" | "shorten" | "draft" | "align";

type ClubGameModel = {
  value: string;
  label: string;
  summary: string;
};

const GAME_MODELS: ClubGameModel[] = [
  {
    value: "COACHAI",
    label: "Balanced (CoachAI)",
    summary: "Flexible balanced model — useful when the club wants adaptable sessions across moments.",
  },
  {
    value: "POSSESSION",
    label: "Possession",
    summary: "Ball security, support angles, and controlled progression through the thirds.",
  },
  {
    value: "PRESSING",
    label: "Pressing",
    summary: "Coordinated regains via triggers, compactness, and aggressive lock-side pressure.",
  },
  {
    value: "TRANSITION",
    label: "Transition",
    summary: "First actions after regain/loss in short windows — speed of decision over settled play.",
  },
  {
    value: "ROCKLIN_FC",
    label: "Rocklin FC",
    summary: "Club-exclusive vertical-possession identity with immediate regain intent.",
  },
];

const STAGES: Array<{
  key: PhilosophyStageKey;
  stageNumber: number;
  title: string;
  moment: string;
  question: string;
  tips: string[];
  placeholder: string;
}> = [
  {
    key: "attackingOrganization",
    stageNumber: 1,
    title: "Attacking Organization",
    moment: "In possession",
    question: "How do we build, progress, and create when we have the ball?",
    tips: [
      "Name shape principles (width, depth, support).",
      "Say how we break lines.",
      "Define final-third intent.",
    ],
    placeholder:
      "Create width and depth, support angles around the ball, progress with pass or dribble line-breaks…",
  },
  {
    key: "defensiveTransition",
    stageNumber: 2,
    title: "Defensive Transition",
    moment: "On ball loss",
    question: "What is the first 3–6 second reaction after we lose the ball?",
    tips: [
      "Set a clear time window.",
      "Counterpress vs recover triggers.",
      "Who presses / who covers.",
    ],
    placeholder: "Immediate 3–5 second counterpress around the loss zone; if not won, recover compact…",
  },
  {
    key: "defensiveOrganization",
    stageNumber: 3,
    title: "Defensive Organization",
    moment: "Out of possession",
    question: "How do we deny progression and force predictable play?",
    tips: [
      "Compactness and distances.",
      "Where we force the opponent.",
      "Protect space in behind.",
    ],
    placeholder: "Keep compact distances, deny central progression, force play wide, protect in behind…",
  },
  {
    key: "attackingTransition",
    stageNumber: 4,
    title: "Attacking Transition",
    moment: "On ball regain",
    question: "What is the first action after we win the ball?",
    tips: [
      "First look forward if on.",
      "Otherwise secure and expand.",
      "Keep the window decisive.",
    ],
    placeholder: "First look forward if advantage exists; if not, secure and expand before next penetration…",
  },
];

const ASSIST_MODES: Array<{ id: AssistMode; label: string; hint: string }> = [
  { id: "polish", label: "Polish", hint: "Clearer coach language" },
  { id: "expand", label: "Expand", hint: "More actionable detail" },
  { id: "shorten", label: "Shorten", hint: "Tighter cues" },
  { id: "draft", label: "Draft", hint: "From notes / empty" },
  { id: "align", label: "Align", hint: "Match model + other stages" },
];

export function getGameModelLabel(gameModelId: string): string {
  return GAME_MODELS.find((m) => m.value === gameModelId)?.label || gameModelId || "—";
}

export function countFilledPhilosophyStages(philosophy: PhilosophyForm): number {
  return STAGES.filter((s) => philosophy[s.key].trim().length > 0).length;
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
  clubName: string;
  gameModelId: string;
  philosophy: PhilosophyForm;
  canEdit: boolean;
  saving: boolean;
  updatedAt: string | null;
  message: string | null;
  error: string | null;
  authHeaders: () => HeadersInit;
  clubId: string;
  /** When true, admin may reassign the locked game model (DOC Hub keeps this false). */
  allowChangeGameModel?: boolean;
  onGameModelChange?: (value: string) => void;
  onPhilosophyChange: (next: PhilosophyForm) => void;
  onSave: (opts?: { pushed?: boolean }) => void;
};

export default function GameModelDirectionModal({
  open,
  onClose,
  clubName,
  gameModelId,
  philosophy,
  canEdit,
  saving,
  updatedAt,
  message,
  error,
  authHeaders,
  clubId,
  allowChangeGameModel = false,
  onGameModelChange,
  onPhilosophyChange,
  onSave,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const selectedModel = useMemo(
    () => GAME_MODELS.find((m) => m.value === gameModelId) ?? null,
    [gameModelId]
  );
  const filledCount = countFilledPhilosophyStages(philosophy);

  const [assistStage, setAssistStage] = useState<PhilosophyStageKey | null>(null);
  const [assistMode, setAssistMode] = useState<AssistMode>("polish");
  const [assistNotes, setAssistNotes] = useState("");
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotes, setImportNotes] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving && !assistBusy && !importBusy) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, saving, assistBusy, importBusy]);

  function updateStage(key: PhilosophyStageKey, value: string) {
    onPhilosophyChange({ ...philosophy, [key]: value });
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(new Error("Could not read PDF"));
      reader.readAsDataURL(file);
    });
  }

  async function importPdf(file: File) {
    if (!canEdit || !clubId) return;
    setImportBusy(true);
    setImportError(null);
    setImportNotes(null);
    try {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("Please upload a PDF");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("PDF too large (max 5MB)");
      }
      const base64 = await fileToBase64(file);
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/philosophy/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: "application/pdf",
          base64,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || "Import failed");
      }
      const draft = data.draft || {};
      onPhilosophyChange({
        attackingOrganization: String(draft.attackingOrganization || ""),
        defensiveTransition: String(draft.defensiveTransition || ""),
        defensiveOrganization: String(draft.defensiveOrganization || ""),
        attackingTransition: String(draft.attackingTransition || ""),
      });
      setImportNotes(
        draft.notes
          ? String(draft.notes)
          : `Drafted from ${file.name}. Review stages, then Save / Push.`
      );
      setSuggestion(null);
      setAssistError(null);
    } catch (e: any) {
      setImportError(e?.message || "Import failed");
    } finally {
      setImportBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function runAssist(stageKey: PhilosophyStageKey) {
    if (!canEdit || !clubId) return;
    setAssistStage(stageKey);
    setAssistBusy(true);
    setAssistError(null);
    setSuggestion(null);
    try {
      const res = await fetch(`/api/doc-hub/clubs/${clubId}/philosophy/assist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          stageKey,
          mode: assistMode,
          currentText: philosophy[stageKey],
          notes: assistNotes.trim() || null,
          otherStages: philosophy,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || "Assistant failed");
      }
      setSuggestion(String(data.text || "").trim());
    } catch (e: any) {
      setAssistError(e?.message || "Assistant failed");
    } finally {
      setAssistBusy(false);
    }
  }

  function applySuggestion(stageKey: PhilosophyStageKey) {
    if (!suggestion) return;
    updateStage(stageKey, suggestion);
    setSuggestion(null);
    setAssistNotes("");
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4"
      onClick={() => {
        if (!saving && !assistBusy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-model-direction-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="game-model-direction-title" className="text-lg font-semibold text-slate-100">
                Game Model Direction
              </h2>
              <span className="rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
                Engine
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {clubName || "Club"} · locked model + 4-moment DNA for session generation
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || assistBusy || importBusy}
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-sm text-slate-300 leading-relaxed">
              Injected into every coach session / series as{" "}
              <span className="text-emerald-300">mandatory</span> club DNA. Also scopes vault and
              calendar assignment to the locked model.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded border border-slate-600/80 bg-slate-950/40 px-2 py-1 text-slate-300">
                Stages {filledCount}/4
              </span>
              {selectedModel ? (
                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                  {selectedModel.label}
                </span>
              ) : null}
            </div>
          </div>

          {canEdit && clubId ? (
            <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Import from PDF
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Upload your club game model. AI drafts the 4 stages — you tune, then Save.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={importBusy || saving || assistBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {importBusy ? "Reading PDF…" : "Upload PDF"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importPdf(file);
                  }}
                />
              </div>
              {importNotes ? (
                <p className="mt-3 text-sm text-emerald-300">{importNotes}</p>
              ) : null}
              {importError ? <p className="mt-3 text-sm text-rose-300">{importError}</p> : null}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Club game model
            </p>
            {allowChangeGameModel && canEdit && onGameModelChange ? (
              <>
                <select
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                  value={gameModelId}
                  disabled={saving || importBusy}
                  onChange={(e) => onGameModelChange(e.target.value)}
                >
                  {!gameModelId ? (
                    <option value="" disabled>
                      Select a game model
                    </option>
                  ) : null}
                  {GAME_MODELS.map((gm) => (
                    <option key={gm.value} value={gm.value}>
                      {gm.label}
                    </option>
                  ))}
                </select>
                {selectedModel ? (
                  <p className="mt-2 text-sm text-slate-400">{selectedModel.summary}</p>
                ) : null}
                <p className="mt-2 text-[11px] text-amber-200/80">
                  Platform admin can reassign the locked model. Club members will only see this
                  model after save.
                </p>
              </>
            ) : (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-100">
                    {selectedModel?.label || gameModelId || "Not assigned"}
                  </span>
                  <span className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-400">
                    Locked for club members
                  </span>
                </div>
                {selectedModel ? (
                  <p className="mt-2 text-sm text-slate-400">{selectedModel.summary}</p>
                ) : (
                  <p className="mt-2 text-sm text-amber-200/90">
                    No exclusive model assigned yet — ask a platform admin to set it on the club.
                  </p>
                )}
                <p className="mt-2 text-[11px] text-slate-500">
                  DOC and coaches only see this model. Platform admins assign it on the club
                  record.
                </p>
              </>
            )}
          </div>

          <div className="space-y-3">
            {STAGES.map((stage) => {
              const value = philosophy[stage.key];
              const isActiveAssist = assistStage === stage.key;
              return (
                <article
                  key={stage.key}
                  className="rounded-xl border border-slate-700 bg-slate-950/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-emerald-400/90">
                        Stage {stage.stageNumber} · {stage.moment}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-white">{stage.title}</h3>
                      <p className="mt-1 text-sm text-slate-400">{stage.question}</p>
                    </div>
                    <span className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-400">
                      {value.length}/4000
                    </span>
                  </div>

                  <ul className="mt-3 flex flex-wrap gap-2">
                    {stage.tips.map((tip) => (
                      <li
                        key={tip}
                        className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400"
                      >
                        {tip}
                      </li>
                    ))}
                  </ul>

                  <textarea
                    rows={4}
                    value={value}
                    disabled={!canEdit || saving || importBusy}
                    onChange={(e) => updateStage(stage.key, e.target.value)}
                    placeholder={stage.placeholder}
                    className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm leading-relaxed text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                  />

                  {canEdit ? (
                    <div className="mt-3 rounded-xl border border-slate-700/80 bg-slate-900/80 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-200">AI writing assistant</p>
                        <p className="text-[11px] text-slate-500">You stay in control</p>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ASSIST_MODES.map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            title={mode.hint}
                            disabled={assistBusy}
                            onClick={() => setAssistMode(mode.id)}
                            className={`rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
                              assistMode === mode.id
                                ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                                : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>

                      <textarea
                        rows={2}
                        value={assistNotes}
                        disabled={assistBusy || saving || importBusy}
                        onChange={(e) => {
                          setAssistStage(stage.key);
                          setAssistNotes(e.target.value);
                        }}
                        onFocus={() => setAssistStage(stage.key)}
                        placeholder="Optional notes (intent, must-keep phrases)…"
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                      />

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={assistBusy || saving || importBusy}
                          onClick={() => void runAssist(stage.key)}
                          className="inline-flex min-h-9 items-center justify-center rounded-xl bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                        >
                          {assistBusy && isActiveAssist ? "Writing…" : "Ask assistant"}
                        </button>
                        {isActiveAssist && suggestion ? (
                          <>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => applySuggestion(stage.key)}
                              className="inline-flex min-h-9 items-center justify-center rounded-xl border border-emerald-500/40 px-3 text-xs text-emerald-200"
                            >
                              Use suggestion
                            </button>
                            <button
                              type="button"
                              onClick={() => setSuggestion(null)}
                              className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-700 px-3 text-xs text-slate-400"
                            >
                              Dismiss
                            </button>
                          </>
                        ) : null}
                      </div>

                      {isActiveAssist && assistError ? (
                        <p className="mt-2 text-xs text-rose-300">{assistError}</p>
                      ) : null}
                      {isActiveAssist && suggestion ? (
                        <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                          <p className="text-[11px] uppercase tracking-wide text-emerald-300/80">
                            Suggestion
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                            {suggestion}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              On save
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-300">
              <li>Coaches inherit DNA on next session / series generation.</li>
              <li>Game-model picker locks; vault + calendar stay scoped.</li>
              <li>Push saves the same DNA (no separate broadcast yet).</li>
            </ul>
          </div>

          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-4">
          <div className="text-xs text-slate-500">
            {!canEdit ? (
              <span>Read-only for Section Directors.</span>
            ) : updatedAt ? (
              <span>Last saved {new Date(updatedAt).toLocaleString()}</span>
            ) : (
              <span>Unsaved drafts stay local until Save.</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-xl border border-slate-700 px-4 text-sm text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
            <button
              type="button"
              disabled={!canEdit || saving || importBusy || !gameModelId}
              onClick={() => onSave()}
              className="min-h-10 rounded-xl border border-slate-600 px-4 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={!canEdit || saving || importBusy || !gameModelId}
              onClick={() => onSave({ pushed: true })}
              className="min-h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              Push to Coaches
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
