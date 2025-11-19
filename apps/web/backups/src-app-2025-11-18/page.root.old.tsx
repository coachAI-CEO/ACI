import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          ACI Web – Drill Diagrams
        </h1>
        <p className="text-sm text-slate-400">
          Backend is doing the intelligence. This UI renders the{" "}
          <code>diagramV1</code> JSON.
        </p>
        <Link
          href="/demo/drill"
          className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition"
        >
          View Demo Drill Diagram
        </Link>
      </div>
    </main>
  );
}
