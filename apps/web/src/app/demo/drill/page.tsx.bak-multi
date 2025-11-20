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
  const diagram = drill.json.diagramV1!;
  const title = drill.json.title ?? drill.title;

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

        <DrillDiagramCard
          title={title}
          gameModelId={drill.gameModelId}
          phase={drill.phase}
          zone={drill.zone}
          diagram={diagram}
        />
      </div>
    </main>
  );
}
