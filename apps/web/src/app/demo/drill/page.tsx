import DrillDiagramCard from "@/components/DrillDiagramCard";
import type { DiagramV1 } from "@/types/diagram";

export const dynamic = "force-static";

type DrillApiResponse = {
  ok: boolean;
  drill: {
    title: string;
    gameModelId: string;
    phase: string;
    zone: string;
    json: {
      title?: string;
      diagramV1?: DiagramV1;
      description?: string;
      organization?: string;
      constraints?: string[];
      coachingPoints?: string[];
      progressions?: string[];
    };
  };
};

// Toggle this for dev vs live API.
// true  = use demo-drill-static.json (instant render)
// false = call http://localhost:4000/coach/generate-drill-vetted each time
const USE_STATIC = true;

async function fetchDrill(): Promise<DrillApiResponse> {
  if (USE_STATIC) {
    const data = await import("./demo-drill-static.json");
    return data as DrillApiResponse;
  }

  const res = await fetch("http://localhost:4000/coach/generate-drill-vetted", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      gameModelId: "POSSESSION",
      ageGroup: "U12",
      phase: "ATTACKING",
      zone: "ATTACKING_THIRD",
      numbersMin: 10,
      numbersMax: 12,
      gkOptional: true,
      goalsAvailable: 2,
      spaceConstraint: "HALF",
      durationMin: 25,
    }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export default async function DrillDemoPage() {
  let data: DrillApiResponse;

  try {
    data = await fetchDrill();
  } catch (e: any) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <h1 className="text-xl font-semibold">ACI Drill Diagram Demo</h1>
          <p className="text-sm text-red-300">
            Failed to fetch drill from ACI API: {e?.message || String(e)}
          </p>
        </div>
      </main>
    );
  }

  if (!data.ok || !data.drill?.json?.diagramV1) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <h1 className="text-xl font-semibold">ACI Drill Diagram Demo</h1>
          <p className="text-sm text-amber-300">
            API responded but no diagramV1 was found on the drill.
          </p>
        </div>
      </main>
    );
  }

  const { drill } = data;
  const meta = drill.json;
  const diagram = meta.diagramV1!;
  const title = meta.title ?? drill.title;
  const description = meta.description ?? "";
  const organization = meta.organization ?? "";
  const constraints = Array.isArray(meta.constraints) ? meta.constraints : [];
  const coachingPoints = Array.isArray(meta.coachingPoints) ? meta.coachingPoints : [];
  const progressions = Array.isArray(meta.progressions) ? meta.progressions : [];


  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">
            ACI Drill Diagram Demo
          </h1>
          <p className="text-sm text-slate-400">
            Rendering <code>diagramV1</code> from /coach/generate-drill-vetted.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
          <div className="max-w-xl">
            <DrillDiagramCard
              title={title}
              gameModelId={drill.gameModelId}
              phase={drill.phase}
              zone={drill.zone}
              diagram={diagram}
            />
          </div>

          <aside className="space-y-4 rounded-3xl border border-slate-700/60 bg-slate-900/60 px-6 py-5">
            <h2 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">
              Drill Details
            </h2>

            {organization && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                  Organization
                </h3>
                <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-line">
                  {organization}
                </p>
              </div>
            )}

            {description && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                  Description
                </h3>
                <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-line">
                  {description}
                </p>
              </div>
            )}

            {constraints.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                  Constraints
                </h3>
                <ul className="list-disc pl-4 space-y-1 text-xs leading-relaxed text-slate-300">
                  {constraints.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {coachingPoints.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                  Coaching Points
                </h3>
                <ul className="list-disc pl-4 space-y-1 text-xs leading-relaxed text-slate-300">
                  {coachingPoints.map((cp, i) => (
                    <li key={i}>{cp}</li>
                  ))}
                </ul>
              </div>
            )}

            {progressions.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                  Progressions
                </h3>
                <ul className="list-disc pl-4 space-y-1 text-xs leading-relaxed text-slate-300">
                  {progressions.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
