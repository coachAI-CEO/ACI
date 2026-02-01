import DrillDiagramCard from "@/components/DrillDiagramCard";
import DrillFormWithLoading from "@/components/DrillFormWithLoading";
import FormationSelect from "@/components/FormationSelect";
import PlayerCountInputs from "@/components/PlayerCountInputs";
import QAScoresDisplay from "@/components/QAScoresDisplay";
import DrillActions from "@/components/DrillActions";
import type { DiagramV1 } from "@/types/diagram";

export const dynamic = "force-dynamic";

type OrganizationObject = {
  setupSteps?: string[];
  area?: {
    lengthYards?: number;
    widthYards?: number;
    notes?: string;
  };
  rotation?: string;
  restarts?: string;
  scoring?: string;
};

type DrillApiResponse = {
  ok: boolean;
  drill: {
    id?: string;
    refCode?: string | null;
    title: string;
    gameModelId: string;
    phase: string;
    zone: string;
    ageGroup?: string;
    durationMin?: number;
    json: {
      title?: string;
      diagram?: DiagramV1; // New format
      diagramV1?: DiagramV1; // Legacy format (fallback)
      description?: string;
      organization?: string | OrganizationObject; // Can be string (legacy) or object (new)
      sessionObjective?: string;
      difficulty?: number;
      coachingLevel?: string;
      playerLevel?: string;
      constraints?: string[];
      coachingPoints?: string[];
      progressions?: string[];
      ageGroup?: string;
      durationMin?: number;
    };
  };
  qa?: {
    pass: boolean;
    summary?: string;
    scores?: Record<string, number>;
  };
};

type GeneratorConfig = {
  gameModelId: string;
  ageGroup: string;
  phase: string;
  zone: string;
  drillType: string;
  formationAttacking: string;
  formationDefending: string;
  playerLevel: string;
  coachLevel: string;
  numbersMin: number;
  numbersMax: number;
  gkOptional: boolean;
  goalsAvailable: number;
  spaceConstraint: string;
  durationMin: number;
};

const gameModelLabel: Record<string, string> = {
  POSSESSION: "Possession",
  PRESSING: "Pressing",
  TRANSITION: "Transition",
  COACHAI: "Balanced model",
};

const phaseLabel: Record<string, string> = {
  ATTACKING: "Attacking phase",
  DEFENDING: "Defending phase",
  TRANSITION: "Transition phase",
};

const zoneLabel: Record<string, string> = {
  DEFENSIVE_THIRD: "Defensive third",
  MIDDLE_THIRD: "Middle third",
  ATTACKING_THIRD: "Attacking third",
};

// Formation constraints by age group (prevents clarity issues)
const FORMATION_BY_AGE: Record<string, string[]> = {
  // 7v7 formations (U8-U12)
  U8: ["2-3-1", "3-2-1"],
  U9: ["2-3-1", "3-2-1"],
  U10: ["2-3-1", "3-2-1"],
  U11: ["2-3-1", "3-2-1"],
  U12: ["2-3-1", "3-2-1"],
  // 9v9 formations (U13-U14)
  U13: ["3-2-3", "2-3-2-1", "3-3-2"],
  U14: ["3-2-3", "2-3-2-1", "3-3-2"],
  // 11v11 formations (U15-U18)
  U15: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
  U16: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
  U17: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
  U18: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
};

function getValidFormations(ageGroup: string): string[] {
  return FORMATION_BY_AGE[ageGroup] || FORMATION_BY_AGE["U10"]; // Default to U10 if unknown
}

function getDefaultFormation(ageGroup: string): string {
  const valid = getValidFormations(ageGroup);
  return valid[0] || "2-3-1";
}

// Default generator config if no query params are present
function getDefaultConfig(): GeneratorConfig {
  const ageGroup = "U10";
  return {
    gameModelId: "POSSESSION",
    ageGroup,
    phase: "ATTACKING",
    zone: "ATTACKING_THIRD",
    drillType: "TACTICAL",
    formationAttacking: getDefaultFormation(ageGroup), // Ensures valid formation for age
    formationDefending: getDefaultFormation(ageGroup), // Default to same as attacking
    playerLevel: "INTERMEDIATE",
    coachLevel: "GRASSROOTS",
    numbersMin: 8,
    numbersMax: 10,
    gkOptional: false,
    goalsAvailable: 2,
    spaceConstraint: "HALF",
    durationMin: 20,
  };
}

function parseNumberOrDefault(
  v: string | string[] | undefined,
  fallback: number
): number {
  if (Array.isArray(v)) v = v[0];
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseStringOrDefault(
  v: string | string[] | undefined,
  fallback: string
): string {
  if (Array.isArray(v)) v = v[0];
  return typeof v === "string" && v.trim() ? v : fallback;
}

function parseBoolFromPresence(v: string | string[] | undefined): boolean {
  if (Array.isArray(v)) v = v[0];
  if (!v) return false;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

function getConfigFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): GeneratorConfig {
  const defaults = getDefaultConfig();
  
  const ageGroup = parseStringOrDefault(searchParams.ageGroup, defaults.ageGroup);
  // Validate formations match age group, fallback to default if invalid
  const validFormations = getValidFormations(ageGroup);
  const requestedFormationAttacking = parseStringOrDefault(
    searchParams.formationAttacking,
    defaults.formationAttacking
  );
  const requestedFormationDefending = parseStringOrDefault(
    searchParams.formationDefending,
    defaults.formationDefending
  );
  const formationAttacking = validFormations.includes(requestedFormationAttacking)
    ? requestedFormationAttacking
    : getDefaultFormation(ageGroup);
  const formationDefending = validFormations.includes(requestedFormationDefending)
    ? requestedFormationDefending
    : getDefaultFormation(ageGroup);

  return {
    gameModelId: parseStringOrDefault(
      searchParams.gameModelId,
      defaults.gameModelId
    ),
    ageGroup,
    phase: parseStringOrDefault(searchParams.phase, defaults.phase),
    zone: parseStringOrDefault(searchParams.zone, defaults.zone),
    drillType: parseStringOrDefault(
      searchParams.drillType,
      defaults.drillType
    ),
    formationAttacking,
    formationDefending,
    playerLevel: parseStringOrDefault(
      searchParams.playerLevel,
      defaults.playerLevel
    ),
    coachLevel: parseStringOrDefault(
      searchParams.coachLevel,
      defaults.coachLevel
    ),
    numbersMin: parseNumberOrDefault(
      searchParams.numbersMin,
      defaults.numbersMin
    ),
    numbersMax: parseNumberOrDefault(
      searchParams.numbersMax,
      defaults.numbersMax
    ),
    gkOptional: parseBoolFromPresence(searchParams.gkOptional),
    goalsAvailable: parseNumberOrDefault(
      searchParams.goalsAvailable,
      defaults.goalsAvailable
    ),
    spaceConstraint: parseStringOrDefault(
      searchParams.spaceConstraint,
      defaults.spaceConstraint
    ),
    durationMin: parseNumberOrDefault(
      searchParams.durationMin,
      defaults.durationMin
    ),
  };
}

async function fetchDrill(
  config: GeneratorConfig,
  useStatic: boolean
): Promise<DrillApiResponse> {
  const perfStart = Date.now();
  
  if (useStatic) {
    const data = await import("./demo-drill-static.json");
    console.log(`[PERF] Static drill loaded in ${Date.now() - perfStart}ms`);
    return data as DrillApiResponse;
  }

  // Debug: log the config being sent
  console.log("[DRILL_GEN] Sending config:", JSON.stringify(config, null, 2));
  const apiStart = Date.now();
  
  const res = await fetch("http://localhost:4000/coach/generate-drill-vetted", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(config),
  });

  const apiTime = Date.now() - apiStart;
  console.log(`[PERF] API call completed in ${(apiTime / 1000).toFixed(2)}s`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData?.error || `API error: ${res.status}`;
    const errorDetails = errorData?.details || [];
    throw new Error(
      `${errorMessage}${errorDetails.length > 0 ? `: ${JSON.stringify(errorDetails)}` : ""}`
    );
  }

  const parseStart = Date.now();
  const data = await res.json();
  const parseTime = Date.now() - parseStart;
  console.log(`[PERF] JSON parsing completed in ${parseTime}ms`);
  console.log(`[PERF] Total fetchDrill time: ${((Date.now() - perfStart) / 1000).toFixed(2)}s`);
  
  return data;
}

type PageProps = {
  searchParams: { [key: string]: string | string[] | undefined };
};


export default async function DrillDemoPage({ searchParams }: PageProps) {
  const pageStart = Date.now();
  const resolvedSearchParams = await (searchParams as any);

  const configStart = Date.now();
  const config = getConfigFromSearchParams(resolvedSearchParams);
  const hasParams = Object.keys(resolvedSearchParams || {}).length > 0;
  const useStatic = !hasParams; // initial load uses static demo, query → live API
  console.log(`[PERF] Config parsing: ${Date.now() - configStart}ms`);

  let data: DrillApiResponse;

  const fetchStart = Date.now();
  try {
    data = await fetchDrill(config, useStatic);
    console.log(`[PERF] fetchDrill total: ${((Date.now() - fetchStart) / 1000).toFixed(2)}s`);
  } catch (e: any) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <h1 className="text-xl font-semibold">ACI Drill Generator</h1>
          <p className="text-sm text-red-300">
            Failed to fetch drill from ACI API: {e?.message || String(e)}
          </p>
        </div>
      </main>
    );
  }

    // Fallback: if first response has no diagram, try static demo
  const hasDiagram = data.ok && (data.drill?.json?.diagram || data.drill?.json?.diagramV1);
  if (!hasDiagram) {
    try {
      const fallback = await fetchDrill(config, true);
      if (fallback.ok && (fallback.drill?.json?.diagram || fallback.drill?.json?.diagramV1)) {
        data = fallback;
      }
    } catch {}
  }

  // Check for diagram (new format) or diagramV1 (legacy)
  const diagram = data.drill?.json?.diagram || data.drill?.json?.diagramV1;
  if (!data.ok || !diagram) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <h1 className="text-xl font-semibold">ACI Drill Generator</h1>
          <p className="text-sm text-amber-300">
            API responded but no diagram was found on the drill.
          </p>
        </div>
      </main>
    );
  }

  const { drill } = data;
  const meta = drill.json;

  const title = meta.title ?? drill.title;
  const description = meta.description ?? "";
  
  // Handle organization: can be string (legacy) or object (new format)
  const organizationRaw = meta.organization;
  const isOrganizationObject = organizationRaw && typeof organizationRaw === "object" && !Array.isArray(organizationRaw);
  const organizationObj = isOrganizationObject ? (organizationRaw as OrganizationObject) : null;
  const organizationString = isOrganizationObject ? "" : (typeof organizationRaw === "string" ? organizationRaw : "");
  
  const sessionObjective = meta.sessionObjective ?? "";
  const difficulty = meta.difficulty ?? 3;
  const coachingLevel = meta.coachingLevel ?? "";
  const playerLevel = meta.playerLevel ?? "";
  const constraints = Array.isArray(meta.constraints) ? meta.constraints : [];
  const coachingPoints = Array.isArray(meta.coachingPoints)
    ? meta.coachingPoints
    : [];
  const progressions = Array.isArray(meta.progressions)
    ? meta.progressions
    : [];

  // Extract QA scores - QA is at top level of response
  const qaScores = (data.qa?.scores || {}) as Record<string, number>;
  const qaPass = data.qa?.pass;

  const gmText = gameModelLabel[drill.gameModelId] ?? drill.gameModelId;
  const phaseText =
    phaseLabel[drill.phase] ??
    drill.phase.toLowerCase().replace(/_/g, " ");
  const zoneText =
    zoneLabel[drill.zone] ?? drill.zone.toLowerCase().replace(/_/g, " ");

  const sourceLabel = useStatic ? "Static demo JSON" : "/coach/generate-drill-vetted";

  const pageTime = Date.now() - pageStart;
  console.log(`[PERF] Total server-side page render: ${(pageTime / 1000).toFixed(2)}s`);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">
            ACI Drill Generator
          </h1>
          <p className="text-sm text-slate-400">
            Rendering <code>diagram</code> from{" "}
            <span className="text-emerald-300">{sourceLabel}</span>{" "}
            based on your selected inputs.
          </p>
        </header>

        {/* Generator settings card */}
        <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 px-6 py-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">
              Generator Settings
            </h2>
            <span className="text-[11px] text-slate-400">
              Configure context → Generate drill → Inspect diagram & details.
            </span>
          </div>

          <DrillFormWithLoading>
              <div className="space-y-5 text-[11px] sm:text-xs text-slate-200">
                    {/* Row 1: 5 fields */}
                    <div className="grid gap-4 sm:grid-cols-5">
                  {/* Game model */}
                  <div className="space-y-1">
                <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                  Game model
                </label>
                <select
                  name="gameModelId"
                  defaultValue={config.gameModelId}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                >
                  <option value="POSSESSION">Possession</option>
                  <option value="PRESSING">Pressing</option>
                  <option value="TRANSITION">Transition</option>
                  <option value="COACHAI">Balanced (CoachAI)</option>
                </select>
              </div>

              {/* Phase */}
              <div className="space-y-1">
                <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                  Phase
                </label>
                <select
                  name="phase"
                  defaultValue={config.phase}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                >
                  <option value="ATTACKING">Attacking</option>
                  <option value="DEFENDING">Defending</option>
                  <option value="TRANSITION">Transition</option>
                </select>
              </div>

              {/* Zone */}
              <div className="space-y-1">
                <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                  Where (zone)
                </label>
                <select
                  name="zone"
                  defaultValue={config.zone}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                >
                  <option value="DEFENSIVE_THIRD">Defensive third</option>
                  <option value="MIDDLE_THIRD">Middle third</option>
                  <option value="ATTACKING_THIRD">Attacking third</option>
                </select>
              </div>

                  {/* Age group */}
                  <div className="space-y-1">
                <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                  Age group
                </label>
                <select
                  name="ageGroup"
                  id="ageGroup"
                  defaultValue={config.ageGroup}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                >
                  <option value="U8">U8</option>
                  <option value="U9">U9</option>
                  <option value="U10">U10</option>
                  <option value="U11">U11</option>
                  <option value="U12">U12</option>
                  <option value="U13">U13</option>
                  <option value="U14">U14</option>
                  <option value="U15">U15</option>
                  <option value="U16">U16</option>
                  <option value="U17">U17</option>
                  <option value="U18">U18</option>
                </select>
              </div>

              {/* Drill Type */}
              <div className="space-y-1">
                <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                  Drill Type
                </label>
                <select
                  name="drillType"
                  defaultValue={config.drillType}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                >
                  <option value="WARMUP">Warmup</option>
                  <option value="TECHNICAL">Technical</option>
                  <option value="TACTICAL">Tactical</option>
                  <option value="CONDITIONED_GAME">Conditioned Game</option>
                  <option value="FULL_GAME">Full Game</option>
                  <option value="COOLDOWN">Cooldown</option>
                </select>
              </div>
            </div>

                {/* Row 2: 5 fields */}
                <div className="grid gap-4 sm:grid-cols-5">
              {/* Attacking Formation */}
              <div className="space-y-1">
                <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                  Attacking Formation
                </label>
                <FormationSelect
                  ageGroup={config.ageGroup}
                  defaultValue={config.formationAttacking}
                  name="formationAttacking"
                  id="formationAttacking"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                />
              </div>

              {/* Defending Formation */}
              <div className="space-y-1">
                <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                  Defending Formation
                </label>
                <FormationSelect
                  ageGroup={config.ageGroup}
                  defaultValue={config.formationDefending}
                  name="formationDefending"
                  id="formationDefending"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                />
              </div>

              {/* Player Level */}
              <div className="space-y-1">
                <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                  Player Level
                </label>
                <select
                  name="playerLevel"
                  defaultValue={config.playerLevel}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </div>

              {/* Coach Level */}
              <div className="space-y-1">
                <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                  Coach Level
                </label>
                <select
                  name="coachLevel"
                  defaultValue={config.coachLevel}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                >
                  <option value="GRASSROOTS">Grassroots</option>
                  <option value="USSF_C">USSF C</option>
                  <option value="USSF_B_PLUS">USSF B+</option>
                </select>
              </div>

              {/* Space constraint */}
              <div className="space-y-1">
                <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                  Space constraint
                </label>
                <select
                  name="spaceConstraint"
                  defaultValue={config.spaceConstraint}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                >
                  <option value="FULL">Full pitch</option>
                  <option value="HALF">Half pitch</option>
                  <option value="THIRD">Third</option>
                  <option value="QUARTER">Quarter</option>
                </select>
              </div>
            </div>

                {/* Row 3: 4 fields */}
                <div className="grid gap-4 sm:grid-cols-5">
              {/* Goals available */}
              <div className="space-y-1">
                <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                  Goals available
                </label>
                <input
                  type="number"
                  name="goalsAvailable"
                  defaultValue={config.goalsAvailable}
                  min={0}
                  max={4}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                />
              </div>

              {/* Numbers min/max */}
              <div className="space-y-1">
                <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                  Players (min–max)
                </label>
                <PlayerCountInputs
                  minDefault={config.numbersMin}
                  maxDefault={config.numbersMax}
                />
              </div>

              {/* Duration */}
              <div className="space-y-1">
                <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                  Duration (min)
                </label>
                <input
                  type="number"
                  name="durationMin"
                  defaultValue={config.durationMin}
                  min={10}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                />
              </div>

              {/* GK optional */}
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    name="gkOptional"
                    defaultChecked={config.gkOptional}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900"
                  />
                  <span className="uppercase tracking-wide text-[10px] text-slate-400">
                    GK optional
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 mt-2">
              {hasParams && (
                <a
                  href="/demo/drill"
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
                >
                  Reset to static demo
                </a>
              )}
                <button
                  type="submit"
                  className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-1.5 text-[11px] font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
                >
                  Generate drill
                </button>
              </div>
              </div>
            </DrillFormWithLoading>
        </section>

        {/* Main diagram + details layout (same visual style as before) */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
          <div className="max-w-xl space-y-4">
            <DrillDiagramCard
              title={title}
              gameModelId={drill.gameModelId}
              phase={drill.phase}
              zone={drill.zone}
              diagram={diagram}
              description={drill.json?.description}
              organization={
                typeof drill.json?.organization === "object" &&
                drill.json.organization !== null
                  ? {
                      area: drill.json.organization.area,
                      setupSteps: drill.json.organization.setupSteps,
                    }
                  : undefined
              }
            />
            
            {/* QA Scores Display - below diagram */}
            {Object.keys(qaScores).length > 0 && (
              <QAScoresDisplay scores={qaScores} pass={qaPass} />
            )}
          </div>

          <aside className="space-y-4 rounded-3xl border border-slate-700/60 bg-slate-900/60 px-6 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">
                Drill Details
              </h2>
            </div>
            
            {/* Action buttons: Identifier, Save to Vault, Print PDF */}
            <DrillActions
              drillId={drill.id}
              refCode={drill.refCode}
              drill={drill}
            />

            {/* Game model / phase / where row */}
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-100">
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-baseline gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">
                    Game model:
                  </span>
                  <span className="font-semibold">{gmText}</span>
                </div>
                <div className="inline-flex items-baseline gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">
                    Phase:
                  </span>
                  <span className="font-semibold">{phaseText}</span>
                </div>
                <div className="inline-flex items-baseline gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">
                    Where:
                  </span>
                  <span className="font-semibold">{zoneText}</span>
                </div>
              </div>
            </div>

            {/* Difficulty + levels + age group fit */}
            <div className="mt-1 flex flex-wrap items-center gap-4 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <span className="uppercase text-[10px] tracking-wide text-slate-400">
                  Difficulty
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={
                        i < difficulty
                          ? "h-1.5 w-4 rounded-full bg-emerald-400"
                          : "h-1.5 w-4 rounded-full bg-slate-700"
                      }
                    />
                  ))}
                </div>
              </div>

              {coachingLevel && (
                <div>
                  <span className="text-slate-400 mr-1">Coach:</span>
                  <span>{coachingLevel}</span>
                </div>
              )}

              {playerLevel && (
                <div>
                  <span className="text-slate-400 mr-1">Players:</span>
                  <span>
                    {playerLevel.charAt(0) + playerLevel.slice(1).toLowerCase()}
                  </span>
                </div>
              )}

              {meta.ageGroup && (
                <div>
                  <span className="text-slate-400 mr-1">Age Group:</span>
                  <span>{meta.ageGroup}</span>
                </div>
              )}
            </div>

            {sessionObjective && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                  Session Objective
                </h3>
                <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-line">
                  {sessionObjective}
                </p>
              </div>
            )}

            {(organizationString || organizationObj) && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                  Organization
                </h3>
                
                {/* Legacy string format */}
                {organizationString && (
                  <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-line">
                    {organizationString}
                  </p>
                )}
                
                {/* New structured object format */}
                {organizationObj && (
                  <div className="space-y-3 text-xs text-slate-300">
                    {/* Setup Steps */}
                    {organizationObj.setupSteps && organizationObj.setupSteps.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-slate-200 mb-1">Setup Steps:</h4>
                        <ol className="list-decimal pl-4 space-y-1">
                          {organizationObj.setupSteps.map((step, i) => (
                            <li key={i} className="leading-relaxed">{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    
                    {/* Area */}
                    {organizationObj.area && (
                      <div>
                        <h4 className="font-semibold text-slate-200 mb-1">Area:</h4>
                        <p className="leading-relaxed">
                          {organizationObj.area.lengthYards && organizationObj.area.widthYards
                            ? `${organizationObj.area.lengthYards} x ${organizationObj.area.widthYards} yards`
                            : ""}
                          {organizationObj.area.notes && (
                            <span className="text-slate-400"> ({organizationObj.area.notes})</span>
                          )}
                        </p>
                      </div>
                    )}
                    
                    {/* Rotation */}
                    {organizationObj.rotation && (
                      <div>
                        <h4 className="font-semibold text-slate-200 mb-1">Rotation:</h4>
                        <p className="leading-relaxed">{organizationObj.rotation}</p>
                      </div>
                    )}
                    
                    {/* Restarts */}
                    {organizationObj.restarts && (
                      <div>
                        <h4 className="font-semibold text-slate-200 mb-1">Restarts:</h4>
                        <p className="leading-relaxed">{organizationObj.restarts}</p>
                      </div>
                    )}
                    
                    {/* Scoring */}
                    {organizationObj.scoring && (
                      <div>
                        <h4 className="font-semibold text-slate-200 mb-1">Scoring:</h4>
                        <p className="leading-relaxed">{organizationObj.scoring}</p>
                      </div>
                    )}
                  </div>
                )}
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
