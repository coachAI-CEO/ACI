"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  createBlankBoard,
  listBoards,
  type TacticalBoardSummary,
} from "@/lib/boards";

type Props = {
  enabled: boolean;
  /** Larger list for dedicated /boards page */
  expanded?: boolean;
};

async function resolveCreateGameModelId(): Promise<string | undefined> {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) return undefined;
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return (
      data?.user?.boardStamp?.gameModelId ||
      data?.user?.enforcedGameModelId ||
      undefined
    );
  } catch {
    return undefined;
  }
}

export default function MyBoardsPanel({ enabled, expanded }: Props) {
  const router = useRouter();
  const [boards, setBoards] = useState<TacticalBoardSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string | null, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBoards({ cursor: cursor || undefined, limit: expanded ? 50 : 20 });
      if (!data.ok) {
        setError(data.error || "Failed to load boards");
        return;
      }
      setBoards((prev) => (append ? [...prev, ...(data.boards || [])] : data.boards || []));
      setNextCursor(data.nextCursor ?? null);
    } catch (e: any) {
      setError(e?.message || "Failed to load boards");
    } finally {
      setLoading(false);
    }
  }, [expanded]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  if (!enabled) return null;

  const onNew = async () => {
    setCreating(true);
    setError(null);
    try {
      const gameModelId = (await resolveCreateGameModelId()) || "COACHAI";
      const data = await createBlankBoard({
        title: "Untitled",
        gameModelId,
      });
      if (!data.ok || !data.board?.id) {
        setError(data.message || data.error || "Could not create board");
        return;
      }
      router.push(`/board/${data.board.id}`);
    } catch (e: any) {
      setError(e?.message || "Could not create board");
    } finally {
      setCreating(false);
    }
  };

  return (
    <article className="shrink-0 rounded-2xl border border-emerald-500/[0.12] bg-gradient-to-b from-[#0a1318]/90 to-[#0a0f1a]/70 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-emerald-500/[0.08] px-5 py-3">
        <div>
          <h2 className="text-[13px] font-semibold text-white/90">My boards</h2>
          <p className="text-[11px] text-slate-500">Blank or forked tactical boards</p>
        </div>
        <button
          type="button"
          onClick={() => void onNew()}
          disabled={creating}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50"
        >
          {creating ? "Creating…" : "New board"}
        </button>
      </div>

      <div className={`px-4 py-3 space-y-2 overflow-y-auto ${expanded ? "max-h-[70vh]" : "max-h-56"}`}>
        {error ? <p className="text-xs text-rose-300 px-1">{error}</p> : null}
        {!loading && boards.length === 0 ? (
          <p className="text-xs text-slate-500 px-1 py-2">No boards yet. Create one to start drawing.</p>
        ) : null}
        {boards.map((b) => (
          <Link
            key={b.id}
            href={`/board/${b.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.06]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white/85">{b.title}</p>
              <p className="text-[10px] text-slate-500">
                {b.shareMode === "CLUB" ? "Club" : "Private"}
                {" · "}
                {new Date(b.updatedAt).toLocaleString()}
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-wide text-slate-500 shrink-0">Open</span>
          </Link>
        ))}
        {loading ? <p className="text-xs text-slate-500 px-1">Loading…</p> : null}
        {nextCursor ? (
          <button
            type="button"
            onClick={() => void load(nextCursor, true)}
            disabled={loading}
            className="w-full rounded-lg border border-white/10 py-2 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            Load more
          </button>
        ) : null}
      </div>
    </article>
  );
}
