import Link from "next/link";

export default function Home() {
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
          </div>
        </nav>
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">ACI Training Platform</h1>
          <p className="text-sm text-slate-400">
            Generate drills, full sessions, and progressive series. Save everything to your vault.
          </p>
        </header>

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
