"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createBlankBoard,
  listBoards,
  type TacticalBoardSummary,
} from "@/lib/boards";
import { fetchAuthMe } from "@/lib/auth-me";

type Props = {
  enabled: boolean;
  /** Larger vault-style layout for dedicated /boards page */
  expanded?: boolean;
};

type BoardFilter = "all" | "private" | "club" | "forked";

const gameModelLabel: Record<string, string> = {
  POSSESSION: "Possession",
  PRESSING: "Pressing",
  TRANSITION: "Transition",
  COACHAI: "Balanced",
  ROCKLIN_FC: "Rocklin FC",
};

async function resolveCreateGameModelId(): Promise<string | undefined> {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) return undefined;
    const data = await fetchAuthMe();
    if (!data?.ok) return undefined;
    return (
      (data.user?.boardStamp as { gameModelId?: string } | undefined)?.gameModelId ||
      (typeof data.user?.enforcedGameModelId === "string"
        ? data.user.enforcedGameModelId
        : undefined) ||
      undefined
    );
  } catch {
    return undefined;
  }
}

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

const channelLabel: Record<string, string> = {
  LEFT: "Left",
  CENTER: "Center",
  RIGHT: "Right",
};

function humanizeMeta(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLastSaved(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `Saved ${date} · ${time}`;
}

function isForked(b: TacticalBoardSummary): boolean {
  return Boolean(b.sourceSessionId || b.sourceDrillKey);
}

export default function MyBoardsPanel({ enabled, expanded }: Props) {
  const router = useRouter();
  const [boards, setBoards] = useState<TacticalBoardSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BoardFilter>("all");

  const load = useCallback(
    async (cursor?: string | null, append = false) => {
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
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load boards");
      } finally {
        setLoading(false);
      }
    },
    [expanded]
  );

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return boards.filter((b) => {
      if (filter === "private" && b.shareMode !== "PRIVATE") return false;
      if (filter === "club" && b.shareMode !== "CLUB") return false;
      if (filter === "forked" && !isForked(b)) return false;
      if (q && !b.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [boards, filter, search]);

  const counts = useMemo(
    () => ({
      all: boards.length,
      private: boards.filter((b) => b.shareMode === "PRIVATE").length,
      club: boards.filter((b) => b.shareMode === "CLUB").length,
      forked: boards.filter(isForked).length,
    }),
    [boards]
  );

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not create board");
    } finally {
      setCreating(false);
    }
  };

  if (!expanded) {
    return (
      <article className="shrink-0 rounded-2xl border border-emerald-500/[0.12] bg-gradient-to-b from-[#0a1318]/90 to-[#0a0f1a]/70 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-emerald-500/[0.08] px-5 py-3">
          <div>
            <h2 className="text-[13px] font-semibold text-white/90">My boards</h2>
            <p className="text-[11px] text-slate-500">Blank or forked tactical boards</p>
          </div>
          <Link
            href="/boards"
            className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
          >
            View all
          </Link>
        </div>
        <div className="px-4 py-3 space-y-2 overflow-y-auto max-h-56">
          {error ? <p className="text-xs text-rose-300 px-1">{error}</p> : null}
          {!loading && boards.length === 0 ? (
            <p className="text-xs text-slate-500 px-1 py-2">No boards yet.</p>
          ) : null}
          {boards.slice(0, 6).map((b) => (
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
                  {formatLastSaved(b.updatedAt).replace(/^Saved /, "")}
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-slate-500 shrink-0">Open</span>
            </Link>
          ))}
          {loading ? <p className="text-xs text-slate-500 px-1">Loading…</p> : null}
        </div>
      </article>
    );
  }

  const chips: { id: BoardFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "private", label: "Private", count: counts.private },
    { id: "club", label: "Club", count: counts.club },
    { id: "forked", label: "Forked", count: counts.forked },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Tactical Board</h1>
            <p className="text-sm text-slate-400">
              Browse and open your boards — blank canvases or forks from a session
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onNew()}
            disabled={creating}
            className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            {creating ? "Creating…" : "➕ New board"}
          </button>
        </div>
      </header>

      <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-1 flex gap-1 overflow-x-auto">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={`flex-1 min-w-[7rem] px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all ${
              filter === chip.id
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {chip.label} ({chip.count})
          </button>
        ))}
      </div>

      <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 px-6 py-4">
        <label className="block">
          <span className="text-xs font-semibold tracking-[0.18em] text-emerald-400 uppercase">
            Search
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by board title…"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </label>
      </section>

      {error ? (
        <div className="rounded-3xl border border-red-700/70 bg-red-900/20 px-6 py-4">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}

      {loading && boards.length === 0 ? (
        <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
        </div>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-8 text-center text-slate-400">
          <p className="mb-2">
            {boards.length === 0 ? "No boards yet." : "No boards match the selected filters."}
          </p>
          {boards.length === 0 ? (
            <button
              type="button"
              onClick={() => void onNew()}
              disabled={creating}
              className="text-emerald-400 hover:text-emerald-300 underline text-sm disabled:opacity-50"
            >
              Create your first board
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((b) => (
            <Link
              key={b.id}
              href={`/board/${b.id}`}
              className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-3 transition-all hover:border-slate-600/70"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-xs text-slate-200 leading-tight">{b.title}</h3>
                  <p className="text-[9px] text-slate-500 mt-1">{formatLastSaved(b.updatedAt)}</p>
                </div>
                <span className="px-2 py-1 rounded text-[10px] font-semibold bg-emerald-600/20 border border-emerald-500/50 text-emerald-300 shrink-0">
                  View
                </span>
              </div>
              <div className="text-[10px] text-slate-400 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
                    <span className="text-emerald-400/70 font-medium">
                      {gameModelLabel[b.gameModelId] || b.gameModelId}
                    </span>
                  </span>
                  {b.ageGroup ? (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="font-medium">{b.ageGroup}</span>
                    </>
                  ) : null}
                </div>
                {(b.phase || b.zone || b.channel) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {b.phase ? (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">
                        {phaseLabel[b.phase] || humanizeMeta(b.phase)}
                      </span>
                    ) : null}
                    {b.phase && b.zone ? <span className="text-slate-600">•</span> : null}
                    {b.zone ? (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">
                        {zoneLabel[b.zone] || humanizeMeta(b.zone)}
                      </span>
                    ) : null}
                    {(b.phase || b.zone) && b.channel ? (
                      <span className="text-slate-600">•</span>
                    ) : null}
                    {b.channel ? (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">
                        {channelLabel[b.channel] || humanizeMeta(b.channel)}
                      </span>
                    ) : null}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {b.attFormation || b.defFormation ? (
                    <span className="px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 text-[9px] border border-blue-700/30">
                      {b.attFormation && b.defFormation
                        ? `${b.attFormation} vs ${b.defFormation}`
                        : b.attFormation || b.defFormation}
                    </span>
                  ) : null}
                  <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">
                    {b.shareMode === "CLUB" ? "Club" : "Private"}
                  </span>
                  {isForked(b) ? (
                    <span className="px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 text-[9px] border border-blue-700/30">
                      Forked
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">
                      Blank
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {nextCursor ? (
        <button
          type="button"
          onClick={() => void load(nextCursor, true)}
          disabled={loading}
          className="w-full rounded-2xl border border-slate-700/70 bg-slate-900/70 py-3 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
