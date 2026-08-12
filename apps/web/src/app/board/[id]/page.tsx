"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import TacticalBoardEditor from "@/components/boards/TacticalBoardEditor";
import {
  getBoard,
  patchBoard,
  type BoardShareMode,
  type TacticalBoard,
} from "@/lib/boards";
import type { DiagramV1 } from "@/types/diagram";
import { fetchUserFeatures } from "@/lib/features";

export default function BoardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const boardId = params?.id;

  const [board, setBoard] = useState<TacticalBoard | null>(null);
  const [title, setTitle] = useState("");
  const [diagram, setDiagram] = useState<DiagramV1 | null>(null);
  const [shareMode, setShareMode] = useState<BoardShareMode>("PRIVATE");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [flagOn, setFlagOn] = useState<boolean | null>(null);

  useEffect(() => {
    fetchUserFeatures()
      .then((f) => setFlagOn(Boolean(f?.tacticalBoardV1)))
      .catch(() => setFlagOn(false));
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
      if (dirty && !window.confirm("You have unsaved changes. Leave anyway?")) {
        router.push(`/board/${boardId}`);
      }
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

  if (loading || flagOn === null) {
    return (
      <main className="min-h-dvh bg-[#060a13] text-slate-100 p-6">
        <p className="text-sm text-slate-400">Loading board…</p>
      </main>
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

  if (!board || !diagram) return null;

  return (
    <main className="min-h-dvh bg-[#060a13] text-slate-100">
      <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (dirty && !window.confirm("You have unsaved changes. Leave anyway?")) return;
          router.push("/boards");
        }}
          className="text-xs text-slate-400 hover:text-emerald-300"
        >
          ← My boards
        </button>
        <p className="text-[11px] text-slate-500">
          {board.gameModelId}
          {board.shareMode === "CLUB" ? " · Club share" : " · Private"}
          {dirty ? " · Unsaved" : ""}
        </p>
      </div>
      <div className="mx-auto max-w-5xl p-4">
        {error ? <p className="mb-2 text-xs text-rose-300">{error}</p> : null}
        <TacticalBoardEditor
          diagram={diagram}
          title={title}
          shareMode={shareMode}
          canEdit={board.canEdit}
          saving={saving}
          dirty={dirty}
          onDirtyChange={setDirty}
          statusMessage={status}
          onCopyLink={onCopyLink}
          onDelete={
            board.canEdit
              ? async () => {
                  if (!window.confirm("Delete this board? This cannot be undone.")) return;
                  const { deleteBoard } = await import("@/lib/boards");
                  const result = await deleteBoard(boardId!);
                  if (!result.ok) {
                    setError(result.error || "Delete failed");
                    return;
                  }
                  router.push("/boards");
                }
              : undefined
          }
          onChange={(next) => {
            setTitle(next.title);
            setDiagram(next.diagram);
            setShareMode(next.shareMode);
          }}
          onSave={() => void onSave()}
        />
      </div>
    </main>
  );
}
