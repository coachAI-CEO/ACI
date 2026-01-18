"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import CoachChat from "@/components/CoachChat";

export default function Home() {
  const router = useRouter();

  return (
    <main className="h-screen bg-slate-950 text-slate-50 flex flex-col">
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col flex-1 w-full gap-6">
        <nav className="flex items-center justify-between flex-shrink-0">
          <Link href="/" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
            ACI Training Platform
          </Link>
          <div className="flex items-center gap-4 text-xs text-slate-300">
            <Link href="/demo/drill" className="hover:text-emerald-300">🧩 Drill Generator</Link>
            <Link href="/demo/session" className="hover:text-emerald-300">📋 Session Generator</Link>
            <Link href="/vault" className="hover:text-emerald-300">🗂️ Vault</Link>
            <Link href="/admin" className="hover:text-emerald-300">📊 Admin</Link>
          </div>
        </nav>
        
        <header className="space-y-2 flex-shrink-0">
          <h1 className="text-2xl font-bold tracking-tight">ACI Training Platform</h1>
          <p className="text-sm text-slate-400">
            Generate drills, full sessions, and progressive series. Save everything to your vault.
          </p>
        </header>

        {/* Quick Access Cards - On top for mobile visibility */}
        <section className="grid gap-3 md:grid-cols-3 flex-shrink-0">
          <Link
            href="/demo/drill"
            className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 hover:border-emerald-500/60 transition"
          >
            <h2 className="text-base font-semibold text-emerald-400">🧩 Drill Generation</h2>
            <p className="mt-1 text-xs text-slate-400">
              Create individual drills with diagrams and structure.
            </p>
          </Link>
          <Link
            href="/demo/session"
            className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 hover:border-emerald-500/60 transition"
          >
            <h2 className="text-base font-semibold text-emerald-400">📋 Session Generation</h2>
            <p className="mt-1 text-xs text-slate-400">
              Generate complete sessions and progressive series.
            </p>
          </Link>
          <Link
            href="/vault"
            className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 hover:border-emerald-500/60 transition"
          >
            <h2 className="text-base font-semibold text-emerald-400">🗂️ Vault</h2>
            <p className="mt-1 text-xs text-slate-400">
              Browse and manage your saved sessions and series.
            </p>
          </Link>
        </section>

        {/* Coach Assistant Chat Card - Fills remaining space */}
        <section className="rounded-2xl border border-emerald-600/50 bg-slate-900/70 p-4 flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-3 flex-shrink-0 mb-3">
            <span className="text-xl">💬</span>
            <div>
              <h2 className="text-base font-semibold text-emerald-400">Coach Assistant</h2>
              <p className="text-xs text-slate-400">
                Describe what you need in plain language - I'll find or create sessions for you
              </p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <CoachChat
              onSessionSelect={(session) => {
                if (session?.id) {
                  router.push(`/demo/session?sessionId=${session.id}`);
                }
              }}
              onGenerateRequest={(params) => {
                // Build query params from extracted parameters
                const queryParams = new URLSearchParams();
                if (params.ageGroup) queryParams.set("ageGroup", params.ageGroup);
                if (params.gameModelId) queryParams.set("gameModelId", params.gameModelId);
                if (params.phase) queryParams.set("phase", params.phase);
                if (params.zone) queryParams.set("zone", params.zone);
                if (params.topic) queryParams.set("topic", params.topic);
                if (params.durationMin) queryParams.set("durationMin", String(params.durationMin));
                if (params.numbersMin) queryParams.set("numbersMin", String(params.numbersMin));
                if (params.numbersMax) queryParams.set("numbersMax", String(params.numbersMax));
                if (params.formationAttacking) queryParams.set("formationAttacking", params.formationAttacking);
                if (params.formationDefending) queryParams.set("formationDefending", params.formationDefending);
                if (params.playerLevel) queryParams.set("playerLevel", params.playerLevel);
                if (params.coachLevel) queryParams.set("coachLevel", params.coachLevel);
                if (params.goalsAvailable !== null && params.goalsAvailable !== undefined) queryParams.set("goalsAvailable", String(params.goalsAvailable));
                // Series mode
                if (params.numberOfSessions && params.numberOfSessions > 1) {
                  queryParams.set("series", "true");
                  queryParams.set("numberOfSessions", String(params.numberOfSessions));
                }
                // Flag to skip recommendations and auto-generate
                queryParams.set("autoGenerate", "true");
                router.push(`/demo/session?${queryParams.toString()}`);
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
