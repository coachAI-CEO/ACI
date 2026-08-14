"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MyBoardsPanel from "@/components/boards/MyBoardsPanel";
import { fetchUserFeatures } from "@/lib/features";

export default function BoardsPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetchUserFeatures()
      .then((f) => setEnabled(Boolean(f?.tacticalBoardV1)))
      .catch(() => setEnabled(false));
  }, []);

  if (enabled === null) {
    return (
      <main className="min-h-dvh bg-[#060a13] text-slate-100 p-6">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!enabled) {
    return (
      <main className="min-h-dvh bg-[#060a13] text-slate-100 p-6">
        <p className="text-sm text-slate-400">Tactical Board is not enabled.</p>
        <Link href="/app" className="mt-4 inline-block text-sm text-emerald-300">
          Back to app
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#060a13] text-slate-100">
      <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold text-white/90">Tactical Board</h1>
          <p className="text-[11px] text-slate-500">Create, edit, and share club boards</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/app" className="text-slate-400 hover:text-emerald-300">
            App
          </Link>
          <Link href="/doc-hub" className="text-slate-400 hover:text-emerald-300">
            DOC Console
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-2xl p-4">
        <MyBoardsPanel enabled expanded />
      </div>
    </main>
  );
}
