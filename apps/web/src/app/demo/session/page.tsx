import SessionFormWithLoading from "@/components/SessionFormWithLoading";
import SessionForm from "@/components/SessionForm";
import FormationSelect from "@/components/FormationSelect";
import PlayerCountInputs from "@/components/PlayerCountInputs";
import QAScoresDisplay from "@/components/QAScoresDisplay";
import DrillDiagramCard from "@/components/DrillDiagramCard";
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

type SessionDrill = {
  drillType: string;
  title: string;
  durationMin?: number;
  description?: string;
  organization?: string | OrganizationObject;
  coachingPoints?: string[];
  progressions?: string[];
  constraints?: string[];
  diagram?: DiagramV1;
  diagramV1?: DiagramV1;
  rpeMin?: number;
  rpeMax?: number;
  loadNotes?: {
    structure?: string;
    rationale?: string;
  };
  equipment?: string[];
};

type SessionApiResponse = {
  ok: boolean;
  session: {
    id?: string;
    title: string;
    gameModelId: string;
    phase?: string;
    zone?: string;
    ageGroup?: string;
    durationMin?: number;
    summary?: string;
    drills: SessionDrill[];
    sessionPlan?: {
      totalDuration: number;
      breakdown: Array<{ drillType: string; duration: number }>;
    };
    equipment?: string[];
    coachingNotes?: string;
    principleIds?: string[];
    psychThemeIds?: string[];
  };
  qa?: {
    pass: boolean;
    summary?: string;
    scores?: Record<string, number>;
  };
  fixDecision?: any;
};

type SessionConfig = {
  gameModelId: string;
  ageGroup: string;
  phase?: string;
  zone?: string;
  formationAttacking: string;
  formationDefending: string;
  playerLevel: string;
  coachLevel: string;
  numbersMin: number;
  numbersMax: number;
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

const drillTypeLabel: Record<string, string> = {
  WARMUP: "Warmup",
  TECHNICAL: "Technical",
  TACTICAL: "Tactical",
  CONDITIONED_GAME: "Conditioned Game",
  FULL_GAME: "Full Game",
  COOLDOWN: "Cooldown",
};

const FORMATION_BY_AGE: Record<string, string[]> = {
  U8: ["2-3-1", "3-2-1"],
  U9: ["2-3-1", "3-2-1"],
  U10: ["2-3-1", "3-2-1"],
  U11: ["2-3-1", "3-2-1"],
  U12: ["2-3-1", "3-2-1"],
  U13: ["3-2-3", "2-3-2-1", "3-3-2"],
  U14: ["3-2-3", "2-3-2-1", "3-3-2"],
  U15: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
  U16: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
  U17: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
  U18: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
};

function getValidFormations(ageGroup: string): string[] {
  return FORMATION_BY_AGE[ageGroup] || FORMATION_BY_AGE["U10"];
}

function getDefaultFormation(ageGroup: string): string {
  const valid = getValidFormations(ageGroup);
  return valid[0] || "2-3-1";
}

function getDefaultConfig(): SessionConfig {
  const ageGroup = "U12";
  return {
    gameModelId: "POSSESSION",
    ageGroup,
    phase: "ATTACKING",
    zone: "ATTACKING_THIRD",
    formationAttacking: getDefaultFormation(ageGroup),
    formationDefending: getDefaultFormation(ageGroup),
    playerLevel: "INTERMEDIATE",
    coachLevel: "GRASSROOTS",
    numbersMin: 10,
    numbersMax: 14,
    goalsAvailable: 2,
    spaceConstraint: "HALF",
    durationMin: 90,
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

function getConfigFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): SessionConfig {
  const defaults = getDefaultConfig();
  return {
    gameModelId: parseStringOrDefault(searchParams.gameModelId, defaults.gameModelId),
    ageGroup: parseStringOrDefault(searchParams.ageGroup, defaults.ageGroup),
    phase: parseStringOrDefault(searchParams.phase, defaults.phase || "ATTACKING"),
    zone: parseStringOrDefault(searchParams.zone, defaults.zone || "ATTACKING_THIRD"),
    formationAttacking: parseStringOrDefault(
      searchParams.formationAttacking,
      getDefaultFormation(parseStringOrDefault(searchParams.ageGroup, defaults.ageGroup))
    ),
    formationDefending: parseStringOrDefault(
      searchParams.formationDefending,
      getDefaultFormation(parseStringOrDefault(searchParams.ageGroup, defaults.ageGroup))
    ),
    playerLevel: parseStringOrDefault(searchParams.playerLevel, defaults.playerLevel),
    coachLevel: parseStringOrDefault(searchParams.coachLevel, defaults.coachLevel),
    numbersMin: parseNumberOrDefault(searchParams.numbersMin, defaults.numbersMin),
    numbersMax: parseNumberOrDefault(searchParams.numbersMax, defaults.numbersMax),
    goalsAvailable: parseNumberOrDefault(searchParams.goalsAvailable, defaults.goalsAvailable),
    spaceConstraint: parseStringOrDefault(searchParams.spaceConstraint, defaults.spaceConstraint),
    durationMin: parseNumberOrDefault(searchParams.durationMin, defaults.durationMin),
  };
}

async function fetchSession(
  config: SessionConfig
): Promise<SessionApiResponse> {
  const perfStart = Date.now();
  
  console.log("[SESSION_GEN] Sending config:", JSON.stringify(config, null, 2));
  const apiStart = Date.now();
  
  const res = await fetch("http://localhost:4000/ai/generate-session", {
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
    throw new Error(errorMessage);
  }

  const parseStart = Date.now();
  const data = await res.json();
  const parseTime = Date.now() - parseStart;
  console.log(`[PERF] JSON parsing completed in ${parseTime}ms`);
  console.log(`[PERF] Total fetchSession time: ${((Date.now() - perfStart) / 1000).toFixed(2)}s`);
  
  return data;
}

type PageProps = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function SessionDemoPage({ searchParams }: PageProps) {
  const pageStart = Date.now();
  const resolvedSearchParams = await (searchParams as any);

  const configStart = Date.now();
  const config = getConfigFromSearchParams(resolvedSearchParams);
  const hasParams = Object.keys(resolvedSearchParams || {}).length > 0;
  console.log(`[PERF] Config parsing: ${Date.now() - configStart}ms`);

  let data: SessionApiResponse;

  const fetchStart = Date.now();
  try {
    if (!hasParams) {
      // No params = show form only, don't fetch
      data = {
        ok: false,
        session: {
          title: "",
          gameModelId: config.gameModelId,
          drills: [],
        },
      };
    } else {
      data = await fetchSession(config);
      console.log(`[PERF] fetchSession total: ${((Date.now() - fetchStart) / 1000).toFixed(2)}s`);
    }
  } catch (e: any) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <h1 className="text-xl font-semibold">ACI Session Generator</h1>
          <p className="text-sm text-red-300">
            Failed to fetch session from ACI API: {e?.message || String(e)}
          </p>
        </div>
      </main>
    );
  }

  const { session } = data;
  const qaScores = (data.qa?.scores || {}) as Record<string, number>;
  const qaPass = data.qa?.pass;

  const gmText = gameModelLabel[session.gameModelId] ?? session.gameModelId;
  const phaseText = session.phase
    ? phaseLabel[session.phase] ?? session.phase.toLowerCase().replace(/_/g, " ")
    : "N/A";
  const zoneText = session.zone
    ? zoneLabel[session.zone] ?? session.zone.toLowerCase().replace(/_/g, " ")
    : "N/A";

  const pageTime = Date.now() - pageStart;
  console.log(`[PERF] Total server-side page render: ${(pageTime / 1000).toFixed(2)}s`);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">
            ACI Session Generator
          </h1>
          <p className="text-sm text-slate-400">
            Generate complete training sessions (60 or 90 minutes) with multiple drills
          </p>
        </header>

        {/* Generator settings card */}
        <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 px-6 py-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">
              Generator Settings
            </h2>
            <span className="text-[11px] text-slate-400">
              Configure context → Generate session → Review all drills.
            </span>
          </div>

          <SessionForm>
            <SessionFormWithLoading>
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

                  {/* Session Duration */}
                  <div className="space-y-1">
                    <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                      Duration
                    </label>
                    <select
                      name="durationMin"
                      defaultValue={config.durationMin}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                    >
                      <option value={60}>60 minutes</option>
                      <option value={90}>90 minutes</option>
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

                {/* Row 3: 3 fields */}
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
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 mt-2">
                  {hasParams && (
                    <a
                      href="/demo/session"
                      className="text-[11px] text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
                    >
                      Reset form
                    </a>
                  )}
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-1.5 text-[11px] font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
                  >
                    Generate session
                  </button>
                </div>
              </div>
            </SessionFormWithLoading>
          </SessionForm>
        </section>

        {/* Session Results */}
        {hasParams && data.ok && session.drills && session.drills.length > 0 && (
          <>
            {/* Session Overview */}
            <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{session.title}</h2>
                <div className="flex gap-4 text-sm text-slate-300">
                  <div>
                    <span className="text-slate-400">Game Model: </span>
                    <span className="font-semibold">{gmText}</span>
                  </div>
                  {session.phase && (
                    <div>
                      <span className="text-slate-400">Phase: </span>
                      <span className="font-semibold">{phaseText}</span>
                    </div>
                  )}
                  {session.zone && (
                    <div>
                      <span className="text-slate-400">Zone: </span>
                      <span className="font-semibold">{zoneText}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">Duration: </span>
                    <span className="font-semibold">{session.durationMin} min</span>
                  </div>
                </div>
              </div>

              {session.summary && (
                <p className="text-sm text-slate-300 leading-relaxed">{session.summary}</p>
              )}

              {/* Session Plan Breakdown */}
              {session.sessionPlan && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3">Session Plan</h3>
                  <div className="grid grid-cols-5 gap-2 text-xs">
                    {session.sessionPlan.breakdown.map((item, i) => (
                      <div key={i} className="text-center p-2 rounded-lg bg-slate-800/50">
                        <div className="font-semibold text-slate-200">
                          {drillTypeLabel[item.drillType] || item.drillType}
                        </div>
                        <div className="text-slate-400 mt-1">{item.duration} min</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* QA Scores Display */}
              {Object.keys(qaScores).length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <QAScoresDisplay scores={qaScores} pass={qaPass} />
                </div>
              )}
            </section>

            {/* All Drills in Session */}
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Session Drills</h2>
              {session.drills.map((drill, index) => {
                const diagram = drill.diagram || drill.diagramV1;
                const isOrganizationObject = drill.organization && typeof drill.organization === "object" && !Array.isArray(drill.organization);
                const organizationObj = isOrganizationObject ? (drill.organization as OrganizationObject) : null;
                const organizationString = isOrganizationObject ? "" : (typeof drill.organization === "string" ? drill.organization : "");
                
                // Debug: log diagram structure for each drill
                if (diagram) {
                  const playersInDiagram = Array.isArray(diagram?.players) ? diagram.players : [];
                  console.log(`[SessionPage] Drill ${index} "${drill.title}": diagram has ${playersInDiagram.length} players`);
                }
                
                // Create a stable key based on drill properties
                const drillKey = drill.title || `drill-${index}-${drill.drillType || 'unknown'}`;

                return (
                  <section key={drillKey} className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{drill.title}</h3>
                        <div className="flex gap-4 mt-1 text-sm text-slate-400">
                          <span>{drillTypeLabel[drill.drillType] || drill.drillType}</span>
                          {drill.durationMin && <span>{drill.durationMin} minutes</span>}
                          {drill.rpeMin && drill.rpeMax && (
                            <span>RPE: {drill.rpeMin}-{drill.rpeMax}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {drill.description && (
                      <p className="text-sm text-slate-300 leading-relaxed">{drill.description}</p>
                    )}

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
                      {diagram ? (
                        <div className="max-w-xl" key={`diagram-${drill.title}-${index}`}>
                          <DrillDiagramCard
                            title={drill.title}
                            gameModelId={session.gameModelId}
                            phase={session.phase || "ATTACKING"}
                            zone={session.zone || "ATTACKING_THIRD"}
                            diagram={diagram}
                          />
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400">No diagram available</div>
                      )}

                      <aside className="space-y-4 rounded-3xl border border-slate-700/60 bg-slate-900/60 px-6 py-5">
                        <h4 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">
                          Drill Details
                        </h4>

                        {(organizationString || organizationObj) && (
                          <div className="space-y-2">
                            <h5 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                              Organization
                            </h5>
                            
                            {organizationString && (
                              <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-line">
                                {organizationString}
                              </p>
                            )}
                            
                            {organizationObj && (
                              <div className="space-y-3 text-xs text-slate-300">
                                {organizationObj.setupSteps && organizationObj.setupSteps.length > 0 && (
                                  <div>
                                    <h6 className="font-semibold text-slate-200 mb-1">Setup Steps:</h6>
                                    <ol className="list-decimal pl-4 space-y-1">
                                      {organizationObj.setupSteps.map((step, i) => (
                                        <li key={i} className="leading-relaxed">{step}</li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                                
                                {organizationObj.area && (
                                  <div>
                                    <h6 className="font-semibold text-slate-200 mb-1">Area:</h6>
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
                                
                                {organizationObj.rotation && (
                                  <div>
                                    <h6 className="font-semibold text-slate-200 mb-1">Rotation:</h6>
                                    <p className="leading-relaxed">{organizationObj.rotation}</p>
                                  </div>
                                )}
                                
                                {organizationObj.restarts && (
                                  <div>
                                    <h6 className="font-semibold text-slate-200 mb-1">Restarts:</h6>
                                    <p className="leading-relaxed">{organizationObj.restarts}</p>
                                  </div>
                                )}
                                
                                {organizationObj.scoring && (
                                  <div>
                                    <h6 className="font-semibold text-slate-200 mb-1">Scoring:</h6>
                                    <p className="leading-relaxed">{organizationObj.scoring}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {drill.coachingPoints && drill.coachingPoints.length > 0 && (
                          <div className="space-y-1">
                            <h5 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                              Coaching Points
                            </h5>
                            <ul className="list-disc pl-4 space-y-1 text-xs leading-relaxed text-slate-300">
                              {drill.coachingPoints.map((cp, i) => (
                                <li key={i}>{cp}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {drill.progressions && drill.progressions.length > 0 && (
                          <div className="space-y-1">
                            <h5 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                              Progressions
                            </h5>
                            <ul className="list-disc pl-4 space-y-1 text-xs leading-relaxed text-slate-300">
                              {drill.progressions.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {drill.constraints && drill.constraints.length > 0 && (
                          <div className="space-y-1">
                            <h5 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                              Constraints
                            </h5>
                            <ul className="list-disc pl-4 space-y-1 text-xs leading-relaxed text-slate-300">
                              {drill.constraints.map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {drill.loadNotes && (
                          <div className="space-y-1">
                            <h5 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                              Load Notes
                            </h5>
                            {drill.loadNotes.structure && (
                              <p className="text-xs text-slate-300 font-semibold">{drill.loadNotes.structure}</p>
                            )}
                            {drill.loadNotes.rationale && (
                              <p className="text-xs text-slate-300 leading-relaxed">{drill.loadNotes.rationale}</p>
                            )}
                          </div>
                        )}
                      </aside>
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

