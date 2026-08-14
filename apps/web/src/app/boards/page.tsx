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
      <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
          </div>
        </div>
      </main>
    );
  }

  if (!enabled) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <h1 className="text-xl font-bold tracking-tight">Tactical Board</h1>
          <p className="text-sm text-slate-400">Tactical Board is not enabled for this account.</p>
          <Link href="/app" className="text-sm text-emerald-400 hover:text-emerald-300">
            Back to app
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <MyBoardsPanel enabled expanded />
      </div>
    </main>
  );
}
