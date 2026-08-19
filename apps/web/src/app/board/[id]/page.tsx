"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import BoardAiChat from "@/components/boards/BoardAiChat";
import TacticalBoardEditor from "@/components/boards/TacticalBoardEditor";
import ThemedConfirmModal from "@/components/ThemedConfirmModal";
import {
  createBlankBoard,
  getBoard,
  patchBoard,
  type BoardShareMode,
  type TacticalBoard,
} from "@/lib/boards";
import type { DiagramV1 } from "@/types/diagram";
import { fetchUserFeatures } from "@/lib/features";
import { fetchAuthMe } from "@/lib/auth-me";
import { useBoardLoadProgress } from "@/lib/use-board-load-progress";
import type { BoardEmphasis } from "@/lib/board-emphasis";

function BoardLoadingScreen({
  percent,
  label,
}: {
  percent: number;
  label: string;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#060a13] px-6 text-slate-100">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-emerald-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 12h18" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-white/90">Loading board…</p>
              <span className="text-[11px] tabular-nums text-emerald-300/90">{percent}%</span>
            </div>
            <p className="text-[11px] text-slate-500">{label}</p>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-400 transition-[width] duration-200 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </main>
  );
}

function sessionReturnHref(from: string | null, sourceSessionId: string | null): string | null {
  if (
    from &&
    from.startsWith("/demo/session") &&
    !from.startsWith("//") &&
    !from.includes("://")
  ) {
    return from;
  }
  if (sourceSessionId) {
    return `/demo/session?sessionId=${encodeURIComponent(sourceSessionId)}`;
  }
  return null;
}

export default function BoardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const boardId = params?.id;

  const [board, setBoard] = useState<TacticalBoard | null>(null);
  const [title, setTitle] = useState("");
  const [diagram, setDiagram] = useState<DiagramV1 | null>(null);
  const [shareMode, setShareMode] = useState<BoardShareMode>("PRIVATE");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [flagOn, setFlagOn] = useState<boolean | null>(null);
  const [coachLevel, setCoachLevel] = useState<string | null>(null);
  const [emphasis, setEmphasis] = useState<BoardEmphasis | null>(null);
  const onEmphasisChange = useCallback(
    (next: {
      phase: string;
      zone: string;
      channel: string;
      attFormation: string;
    }) => {
      setEmphasis({
        phase: (next.phase || null) as BoardEmphasis["phase"],
        zone: (next.zone || null) as BoardEmphasis["zone"],
        channel: (next.channel || null) as BoardEmphasis["channel"],
        attFormation: next.attFormation || null,
      });
    },
    []
  );
  const [pendingConfirm, setPendingConfirm] = useState<
    | { type: "leave"; href: string }
    | { type: "back" }
    | { type: "new" }
    | { type: "delete" }
    | null
  >(null);
  const skipNextPopRef = useRef(false);
  const applyGenRef = useRef(0);

  const pageLoading = loading || flagOn === null;
  const pageProgress = useBoardLoadProgress(pageLoading);
  const aiProgress = useBoardLoadProgress(aiBusy);

  useEffect(() => {
    fetchUserFeatures()
      .then((f) => setFlagOn(Boolean(f?.tacticalBoardV1)))
      .catch(() => setFlagOn(false));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setCoachLevel(null);
      return;
    }
    fetchAuthMe()
      .then((data) => {
        const level = data?.user?.coachLevel || null;
        setCoachLevel(typeof level === "string" ? level : null);
      })
      .catch(() => setCoachLevel(null));
  }, []);

  const load = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBoard(boardId);
      if (!data.ok || !data.board) {
        setError(data.message || data.error || "Board not found");
        setBoard(null);
        return;
      }
      setBoard(data.board);
      setTitle(data.board.title);
      setDiagram(data.board.diagram);
      setShareMode(data.board.shareMode);
      setDirty(false);
    } catch (e: any) {
      setError(e?.message || "Failed to load board");
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (flagOn === false) return;
    if (flagOn === true) void load();
  }, [flagOn, load]);

  useEffect(() => {
    if (!dirty) return;
    const onPop = () => {
      if (skipNextPopRef.current) {
        skipNextPopRef.current = false;
        return;
      }
      if (!dirty || !boardId) return;
      router.push(`/board/${boardId}`);
      setPendingConfirm({ type: "back" });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dirty, boardId, router]);

  const onSave = async () => {
    if (!boardId || !diagram || !board?.canEdit) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const data = await patchBoard(boardId, { title, diagram, shareMode });
      if (!data.ok || !data.board) {
        setError(data.message || data.error || "Save failed");
        return;
      }
      setBoard(data.board);
      setTitle(data.board.title);
      setDiagram(data.board.diagram);
      setShareMode(data.board.shareMode);
      setDirty(false);
      setStatus("Saved");
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("Link copied");
    } catch {
      setStatus("Could not copy link");
    }
  };

  const createNewBoard = async () => {
    setCreatingBoard(true);
    setError(null);
    try {
      const data = await createBlankBoard({
        title: "Untitled",
        gameModelId: board?.gameModelId || "COACHAI",
        shareMode: "PRIVATE",
      });
      if (!data.ok || !data.board?.id) {
        setError(data.message || data.error || "Could not create board");
        return;
      }
      setDirty(false);
      router.push(`/board/${data.board.id}`);
    } catch (e: any) {
      setError(e?.message || "Could not create board");
    } finally {
      setCreatingBoard(false);
    }
  };

  const onNewBoard = async () => {
    if (dirty) {
      setPendingConfirm({ type: "new" });
      return;
    }
    await createNewBoard();
  };

  const deleteCurrentBoard = async () => {
    if (!boardId) return;
    const { deleteBoard } = await import("@/lib/boards");
    const result = await deleteBoard(boardId);
    if (!result.ok) {
      setError(result.error || "Delete failed");
      return;
    }
    setDirty(false);
    router.push("/boards");
  };

  if (flagOn === false) {
    return (
      <main className="min-h-dvh bg-[#060a13] text-slate-100 p-6">
        <p className="text-sm text-slate-400">Tactical Board is not enabled for this environment.</p>
        <Link href="/app" className="mt-4 inline-block text-emerald-300 text-sm">
          Back to app
        </Link>
      </main>
    );
  }

  if (pageLoading) {
    return (
      <BoardLoadingScreen
        percent={pageProgress.percent || 4}
        label={pageProgress.label || "Opening board…"}
      />
    );
  }

  if (error && !board) {
    return (
      <main className="min-h-dvh bg-[#060a13] text-slate-100 p-6">
        <p className="text-sm text-rose-300">{error}</p>
        <Link href="/app" className="mt-4 inline-block text-emerald-300 text-sm">
          Back to app
        </Link>
      </main>
    );
  }

  if (!board || !diagram || !boardId) return null;

  const sessionHref = sessionReturnHref(
    searchParams.get("from"),
    board.sourceSessionId
  );

  const leaveTo = (href: string) => {
    if (dirty) {
      setPendingConfirm({ type: "leave", href });
      return;
    }
    router.push(href);
  };

  const confirmCopy =
    pendingConfirm?.type === "delete"
      ? {
          title: "Delete this board?",
          message: "This cannot be undone.",
          confirmLabel: "Delete",
          tone: "danger" as const,
        }
      : pendingConfirm?.type === "new"
        ? {
            title: "Unsaved changes",
            message: "You have unsaved changes. Create a new board anyway?",
            confirmLabel: "Create new board",
            tone: "warning" as const,
          }
        : {
            title: "Unsaved changes",
            message: "You have unsaved changes. Leave anyway?",
            confirmLabel: "Leave",
            tone: "warning" as const,
          };

  const onConfirmPending = () => {
    const pending = pendingConfirm;
    setPendingConfirm(null);
    if (!pending) return;
    if (pending.type === "leave") {
      setDirty(false);
      router.push(pending.href);
      return;
    }
    if (pending.type === "back") {
      setDirty(false);
      skipNextPopRef.current = true;
      router.back();
      return;
    }
    if (pending.type === "new") {
      void createNewBoard();
      return;
    }
    void deleteCurrentBoard();
  };

  const chatProps = {
    boardId,
    diagram,
    canEdit: board.canEdit,
    gameModelId: board.gameModelId,
    ageGroup: board.ageGroup,
    coachLevel,
    attFormation: board.attFormation,
    emphasis,
    onBusyChange: setAiBusy,
    onApplyDiagram: (next: DiagramV1) => {
      const gen = ++applyGenRef.current;
      setDiagram(next);
      setDirty(true);
      if (!boardId || !board?.canEdit) {
        setStatus("AI updated board — save when ready");
        return;
      }
      setStatus("AI updated board — saving…");
      void patchBoard(boardId, { title, diagram: next, shareMode })
        .then((data) => {
          if (gen !== applyGenRef.current) return;
          if (!data.ok || !data.board) {
            setStatus("AI updated board — save when ready");
            return;
          }
          setDirty(false);
          setStatus("Saved");
        })
        .catch(() => {
          if (gen !== applyGenRef.current) return;
          setStatus("AI updated board — save when ready");
        });
    },
  };

  return (
    <main className="flex h-dvh min-h-0 flex-col bg-[#060a13] text-slate-100">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {sessionHref ? (
            <button
              type="button"
              onClick={() => leaveTo(sessionHref)}
              className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
            >
              ← Back to session
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => leaveTo("/boards")}
            className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
          >
            {sessionHref ? "My Boards" : "← My Boards"}
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          {board.gameModelId}
          {board.shareMode === "CLUB" ? " · Club share" : " · Private"}
          {dirty ? " · Unsaved" : ""}
          {aiBusy ? " · AI working…" : ""}
        </p>
      </div>

      {aiProgress.visible ? (
        <div className="h-0.5 w-full overflow-hidden bg-white/5">
          <div
            className="h-full bg-emerald-400 transition-[width] duration-200 ease-out"
            style={{ width: `${aiProgress.percent}%` }}
          />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-auto p-3 lg:p-4">
          {error ? <p className="mb-2 text-xs text-rose-300">{error}</p> : null}
          <TacticalBoardEditor
            boardId={boardId}
            diagram={diagram}
            title={title}
            shareMode={shareMode}
            canEdit={board.canEdit && !aiBusy}
            saving={saving}
            dirty={dirty}
            onDirtyChange={setDirty}
            statusMessage={status}
            onCopyLink={onCopyLink}
            onNewBoard={board.canEdit ? () => void onNewBoard() : undefined}
            creatingBoard={creatingBoard}
            onDelete={
              board.canEdit ? () => setPendingConfirm({ type: "delete" }) : undefined
            }
            onEmphasisChange={onEmphasisChange}
            onChange={(next) => {
              setTitle(next.title);
              setDiagram(next.diagram);
              setShareMode(next.shareMode);
            }}
            onSave={() => void onSave()}
          />
          {aiProgress.visible ? (
            <div className="pointer-events-none absolute inset-3 z-20 flex items-start justify-center pt-6 lg:inset-4">
              <div className="min-w-[220px] rounded-xl border border-emerald-500/30 bg-[#07111f]/92 px-4 py-3 shadow-xl backdrop-blur-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs font-semibold text-emerald-100">Updating board…</p>
                  <span className="text-[11px] tabular-nums text-emerald-300/90">
                    {aiProgress.percent}%
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400">{aiProgress.label}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400/90 transition-[width] duration-200 ease-out"
                    style={{ width: `${aiProgress.percent}%` }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="hidden w-[460px] shrink-0 lg:block xl:w-[520px]">
          <BoardAiChat {...chatProps} />
        </div>
      </div>

      <div className="border-t border-white/10 p-2 lg:hidden">
        <details className="rounded-xl border border-white/10 bg-[#07111f]/95">
          <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-emerald-200">
            Tactical Edge AI
          </summary>
          <div className="h-[50vh] border-t border-white/10">
            <BoardAiChat {...chatProps} />
          </div>
        </details>
      </div>

      <ThemedConfirmModal
        open={pendingConfirm !== null}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmLabel={confirmCopy.confirmLabel}
        cancelLabel={pendingConfirm?.type === "delete" ? "Cancel" : "Stay"}
        tone={confirmCopy.tone}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={onConfirmPending}
      />
    </main>
  );
}
