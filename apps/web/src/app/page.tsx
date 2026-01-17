"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import CoachChat from "@/components/CoachChat";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        <nav className="flex items-center justify-between">
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
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">ACI Training Platform</h1>
          <p className="text-sm text-slate-400">
            Generate drills, full sessions, and progressive series. Save everything to your vault.
          </p>
        </header>

        {/* Coach Assistant Chat Card */}
        <section className="rounded-3xl border border-emerald-600/50 bg-slate-900/70 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <div>
              <h2 className="text-lg font-semibold text-emerald-400">Coach Assistant</h2>
              <p className="text-sm text-slate-400">
                Describe what you need in plain language - I'll find or create sessions for you
              </p>
            </div>
          </div>
          <div className="h-[450px]">
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

        <section className="grid gap-4 md:grid-cols-3">
          <Link
            href="/demo/drill"
            className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 hover:border-emerald-500/60 transition"
          >
            <h2 className="text-lg font-semibold text-emerald-400">🧩 Drill Generation</h2>
            <p className="mt-2 text-sm text-slate-400">
              Create individual drills with diagrams and structure.
            </p>
          </Link>
          <Link
            href="/demo/session"
            className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 hover:border-emerald-500/60 transition"
          >
            <h2 className="text-lg font-semibold text-emerald-400">📋 Session Generation</h2>
            <p className="mt-2 text-sm text-slate-400">
              Generate complete sessions and progressive series.
            </p>
          </Link>
          <Link
            href="/vault"
            className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 hover:border-emerald-500/60 transition"
          >
            <h2 className="text-lg font-semibold text-emerald-400">🗂️ Vault</h2>
            <p className="mt-2 text-sm text-slate-400">
              Browse and manage your saved sessions and series.
            </p>
          </Link>
        </section>

        <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 space-y-3">
          <h3 className="text-sm font-semibold tracking-[0.2em] text-emerald-400 uppercase">
            Why this is more than a chat box
          </h3>
          <ul className="text-sm text-slate-300 space-y-2">
            <li>Structured prompts enforce coaching logic, drill flow, and diagram requirements.</li>
            <li>QA review scores and fixer decisions reduce hallucinations and format drift.</li>
            <li>Progressive series carry context so each session builds on the last.</li>
            <li>Vault indexing + similarity checks help you reuse high-quality plans.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
