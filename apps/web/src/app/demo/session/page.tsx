"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SessionForm from "@/components/SessionForm";
import SessionFormWithLoading from "@/components/SessionFormWithLoading";
import SessionProgress from "@/components/SessionProgress";
import FormationSelect from "@/components/FormationSelect";
import PlayerCountInputs from "@/components/PlayerCountInputs";
import QAScoresDisplay from "@/components/QAScoresDisplay";
import DrillDiagramCard from "@/components/DrillDiagramCard";
import TopicSelect from "@/components/TopicSelect";
import { getTopicsForPhaseAndZone, getRandomTopic, type Phase, type Zone } from "@/data/session-topics";
import type { DiagramV1 } from "@/types/diagram";

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

type ProgressiveSeriesApiResponse = {
  ok: boolean;
  series?: Array<{
    sessionNumber: number;
    session: SessionApiResponse["session"];
    qa?: SessionApiResponse["qa"];
    fixDecision?: any;
    qaScore?: number | null;
    id?: string;
  }>;
  metadata?: {
    totalSessions: number;
    gameModelId: string;
    ageGroup: string;
    generatedAt: string;
  };
  hasRecommendations?: boolean;
  recommendations?: any[];
  error?: string;
  message?: string;
};

type SkillFocus = {
  id?: string;
  title: string;
  summary?: string;
  keySkills?: string[];
  coachingPoints?: string[];
  createdAt?: string;
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
  topic?: string;
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
  const phase: Phase = "ATTACKING";
  const zone: Zone = "ATTACKING_THIRD";
  const defaultTopic = getRandomTopic(phase, zone);
  return {
    gameModelId: "POSSESSION",
    ageGroup,
    phase,
    zone,
    formationAttacking: getDefaultFormation(ageGroup),
    formationDefending: getDefaultFormation(ageGroup),
    playerLevel: "INTERMEDIATE",
    coachLevel: "GRASSROOTS",
    numbersMin: 10,
    numbersMax: 14,
    goalsAvailable: 2,
    spaceConstraint: "HALF",
    durationMin: 90,
    topic: defaultTopic,
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
  searchParams: URLSearchParams
): SessionConfig {
  const defaults = getDefaultConfig();
  const phase = parseStringOrDefault(searchParams.get("phase"), defaults.phase || "ATTACKING") as Phase;
  const zone = parseStringOrDefault(searchParams.get("zone"), defaults.zone || "ATTACKING_THIRD") as Zone;
  
  // Get topic from params, or default to first topic for the phase/zone combination
  const topicParam = searchParams.get("topic");
  const availableTopics = getTopicsForPhaseAndZone(phase, zone);
  const defaultTopic = availableTopics[0] || defaults.topic || "";
  const topic = topicParam && availableTopics.includes(topicParam) ? topicParam : defaultTopic;
  
  return {
    gameModelId: parseStringOrDefault(searchParams.get("gameModelId"), defaults.gameModelId),
    ageGroup: parseStringOrDefault(searchParams.get("ageGroup"), defaults.ageGroup),
    phase,
    zone,
    formationAttacking: parseStringOrDefault(
      searchParams.get("formationAttacking"),
      getDefaultFormation(parseStringOrDefault(searchParams.get("ageGroup"), defaults.ageGroup))
    ),
    formationDefending: parseStringOrDefault(
      searchParams.get("formationDefending"),
      getDefaultFormation(parseStringOrDefault(searchParams.get("ageGroup"), defaults.ageGroup))
    ),
    playerLevel: parseStringOrDefault(searchParams.get("playerLevel"), defaults.playerLevel),
    coachLevel: parseStringOrDefault(searchParams.get("coachLevel"), defaults.coachLevel),
    numbersMin: parseNumberOrDefault(searchParams.get("numbersMin"), defaults.numbersMin),
    numbersMax: parseNumberOrDefault(searchParams.get("numbersMax"), defaults.numbersMax),
    goalsAvailable: parseNumberOrDefault(searchParams.get("goalsAvailable"), defaults.goalsAvailable),
    spaceConstraint: parseStringOrDefault(searchParams.get("spaceConstraint"), defaults.spaceConstraint),
    durationMin: parseNumberOrDefault(searchParams.get("durationMin"), defaults.durationMin),
    topic,
  };
}

async function fetchSession(
  config: SessionConfig,
  skipRecommendation: boolean = false
): Promise<SessionApiResponse> {
  const perfStart = Date.now();
  
  console.log("[SESSION_GEN] Sending config:", JSON.stringify(config, null, 2));
  const apiStart = Date.now();
  
  const url = `/api/generate-session${skipRecommendation ? "?skipRecommendation=1" : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(config),
  });

  const apiTime = Date.now() - apiStart;
  console.log(`[PERF] API call completed in ${(apiTime / 1000).toFixed(2)}s`);
  console.log(`[SESSION_GEN] Response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error(`[SESSION_GEN] Error response:`, errorData);
    const errorMessage = errorData?.error || `API error: ${res.status}`;
    throw new Error(errorMessage);
  }

  const parseStart = Date.now();
  const data = await res.json();
  const parseTime = Date.now() - parseStart;
  console.log(`[PERF] JSON parsing completed in ${parseTime}ms`);
  console.log(`[SESSION_GEN] Response data:`, {
    ok: data.ok,
    hasSession: !!data.session,
    hasRecommendations: !!data.hasRecommendations,
    recommendationsCount: data.recommendations?.length,
  });
  console.log(`[PERF] Total fetchSession time: ${((Date.now() - perfStart) / 1000).toFixed(2)}s`);
  
  // Check if we got recommendations instead of a session
  if (data.hasRecommendations && data.recommendations) {
    // Return a special response indicating recommendations
    return {
      ...data,
      session: null,
    } as any;
  }
  
  if (!data.ok) {
    throw new Error(data.error || "Failed to generate session");
  }
  
  if (!data.session) {
    throw new Error("No session was generated");
  }
  
  return data;
}

async function fetchProgressiveSeries(
  config: SessionConfig,
  numberOfSessions: number,
  skipRecommendation: boolean = false
): Promise<ProgressiveSeriesApiResponse> {
  const perfStart = Date.now();
  
  console.log("[PROGRESSIVE_SERIES] Sending config:", JSON.stringify(config, null, 2), `numberOfSessions: ${numberOfSessions}`, `skipRecommendation: ${skipRecommendation}`);
  const apiStart = Date.now();
  
  const url = `/api/generate-progressive-series${skipRecommendation ? "?skipRecommendation=1" : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      baseInput: config,
      numberOfSessions,
    }),
    // Note: Browser fetch timeout is handled by the Next.js API route
  }).catch((fetchError) => {
    // Handle network errors
    if (fetchError.message?.includes('fetch failed') || fetchError.code === 'ECONNREFUSED') {
      throw new Error("Cannot connect to API server. Please ensure the backend server is running on port 4000.");
    }
    throw fetchError;
  });

  const apiTime = Date.now() - apiStart;
  console.log(`[PERF] API call completed in ${(apiTime / 1000).toFixed(2)}s`);
  console.log(`[PROGRESSIVE_SERIES] Response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error(`[PROGRESSIVE_SERIES] Error response:`, errorData);
    const errorMessage = errorData?.error || `API error: ${res.status}`;
    throw new Error(errorMessage);
  }

  const parseStart = Date.now();
  const data = await res.json();
  const parseTime = Date.now() - parseStart;
  console.log(`[PERF] JSON parsing completed in ${parseTime}ms`);
  console.log(`[PROGRESSIVE_SERIES] Response data:`, {
    ok: data.ok,
    hasSeries: !!data.series,
    seriesLength: data.series?.length,
    hasRecommendations: !!data.hasRecommendations,
    recommendationsCount: data.recommendations?.length,
    metadata: data.metadata,
  });
  console.log(`[PERF] Total fetchProgressiveSeries time: ${((Date.now() - perfStart) / 1000).toFixed(2)}s`);
  
  if (!data.ok) {
    throw new Error(data.error || "Failed to generate progressive series");
  }
  
  // Check if we got recommendations instead of a series
  if (data.hasRecommendations && data.recommendations) {
    console.log(`[PROGRESSIVE_SERIES] Got recommendations instead of generating new series`);
    // Return a special response indicating recommendations
    return {
      ...data,
      series: undefined,
    } as any;
  }
  
  // If we have a series, validate it
  if (data.series && Array.isArray(data.series) && data.series.length > 0) {
    return data;
  }
  
  // If we get here, something went wrong - no series and no recommendations
  console.error(`[PROGRESSIVE_SERIES] Invalid response:`, data);
  throw new Error(data.message || "No sessions were generated in the series. Please try again or check the backend logs.");
}

async function fetchSkillFocusForSessionId(sessionId: string): Promise<SkillFocus | null> {
  const res = await fetch(`/api/skill-focus/session/${encodeURIComponent(sessionId)}`);
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return data.focus || null;
}

async function fetchSkillFocusForSeriesId(seriesId: string): Promise<SkillFocus | null> {
  const res = await fetch(`/api/skill-focus/series/${encodeURIComponent(seriesId)}`);
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return data.focus || null;
}

async function generateSkillFocusForSessionId(sessionId: string): Promise<SkillFocus> {
  const res = await fetch("/api/skill-focus/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || `API error: ${res.status}`);
  }
  const data = await res.json();
  return data.focus;
}

async function generateSkillFocusForSeries(input: { seriesId?: string; sessionIds?: string[] }): Promise<SkillFocus> {
  const res = await fetch("/api/skill-focus/series", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || `API error: ${res.status}`);
  }
  const data = await res.json();
  return data.focus;
}

function SessionDemoPageContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<SessionApiResponse | null>(null);
  const [seriesData, setSeriesData] = useState<ProgressiveSeriesApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressInfo, setProgressInfo] = useState<{
    isSeries: boolean;
    totalSessions?: number;
    currentSession?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<"single" | "series">("single");
  const [selectedSeriesTab, setSelectedSeriesTab] = useState(0);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [savedToVault, setSavedToVault] = useState<boolean>(false);
  const [checkingVaultStatus, setCheckingVaultStatus] = useState(false);
  const [justSaved, setJustSaved] = useState<boolean>(false);
  const [seriesSavedToVault, setSeriesSavedToVault] = useState<boolean>(false);
  const [savingSeries, setSavingSeries] = useState<boolean>(false);
  const [skillFocus, setSkillFocus] = useState<SkillFocus | null>(null);
  const [seriesSkillFocus, setSeriesSkillFocus] = useState<SkillFocus | null>(null);
  const [generatingSkillFocus, setGeneratingSkillFocus] = useState(false);
  const [generatingSeriesSkillFocus, setGeneratingSeriesSkillFocus] = useState(false);

  const config = getConfigFromSearchParams(searchParams);
  const hasParams = searchParams.toString().length > 0;
  const searchParamsString = searchParams.toString();

  useEffect(() => {
    const sessionId = searchParams.get("sessionId");
    
    // If sessionId is provided, load that session instead of generating
    if (sessionId) {
      setLoading(true);
      setError(null);
      setSessionMode("single");
      
      fetch(`/api/vault/sessions/${encodeURIComponent(sessionId)}`)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`Session not found: ${res.status}`);
          }
          const vaultData = await res.json();
          if (vaultData.ok && vaultData.session) {
            // If loading from vault, it's already saved
            setSavedToVault(vaultData.session.savedToVault || true);
            
            // Convert vault session format to SessionApiResponse format
            const sessionData = vaultData.session.json || {};
            
            // Extract QA data from session.json if available, otherwise use defaults
            const qaFromJson = sessionData.qa || {};
            const qaData = {
              pass: vaultData.session.approved || qaFromJson.pass || false,
              summary: qaFromJson.summary,
              scores: qaFromJson.scores || {},
            };
            
            setData({
              ok: true,
              session: {
                id: vaultData.session.id,
                title: vaultData.session.title,
                gameModelId: vaultData.session.gameModelId,
                phase: vaultData.session.phase,
                zone: vaultData.session.zone,
                ageGroup: vaultData.session.ageGroup,
                durationMin: vaultData.session.durationMin,
                summary: sessionData.summary,
                drills: sessionData.drills || [],
                sessionPlan: sessionData.sessionPlan,
                equipment: sessionData.equipment,
                coachingNotes: sessionData.coachingNotes,
                principleIds: Array.isArray(vaultData.session.principleIds) ? vaultData.session.principleIds : [],
                psychThemeIds: Array.isArray(vaultData.session.psychThemeIds) ? vaultData.session.psychThemeIds : [],
              },
              qa: qaData,
            });
            setSeriesData(null);
            setShowRecommendations(false);
            setRecommendations([]);
          } else {
            throw new Error("Invalid session data");
          }
        })
        .catch((e) => {
          setError(e?.message || String(e));
          setData(null);
          setSeriesData(null);
        })
        .finally(() => setLoading(false));
      return;
    }
    
    if (hasParams) {
      const isSeries = searchParams.get("series") === "true";
      const numberOfSessions = parseInt(searchParams.get("numberOfSessions") || "3");
      
      setError(null);
      setSessionMode(isSeries ? "series" : "single");
      
      // Set progress info BEFORE setting loading to true, so it shows immediately
      if (isSeries) {
        setProgressInfo({ isSeries: true, totalSessions: numberOfSessions, currentSession: 1 });
      } else {
        setProgressInfo({ isSeries: false });
      }
      
      setLoading(true);
      
      if (isSeries) {
        fetchProgressiveSeries(config, numberOfSessions, false)
          .then((result) => {
            console.log("[SESSION_PAGE] Progressive series result:", {
              ok: result.ok,
              hasSeries: !!result.series,
              seriesLength: result.series?.length,
              hasRecommendations: !!result.hasRecommendations,
              recommendationsCount: result.recommendations?.length,
            });
            
            // Check if we got recommendations instead of a series
            if (result.hasRecommendations && result.recommendations) {
              console.log("[SESSION_PAGE] Showing recommendations instead of generating");
              setRecommendations(result.recommendations);
              setShowRecommendations(true);
              setSeriesData(null);
              setData(null);
            } else if (result.series && Array.isArray(result.series) && result.series.length > 0) {
              console.log("[SESSION_PAGE] Series generated successfully");
              setSeriesData(result);
              setData(null);
              setSelectedSeriesTab(0);
              setShowRecommendations(false);
              setRecommendations([]);
            } else {
              console.error("[SESSION_PAGE] Invalid progressive series response:", result);
              throw new Error(result.message || "No sessions were generated in the series. Please try again.");
            }
          })
          .catch((e) => {
            console.error("[SESSION_PAGE] Progressive series error:", e);
            setError(e?.message || String(e));
            setSeriesData(null);
            setData(null);
            setShowRecommendations(false);
            setRecommendations([]);
          })
          .finally(() => {
            setLoading(false);
            setProgressInfo(null);
          });
      } else {
        setProgressInfo({ isSeries: false });
        fetchSession(config, false)
          .then((result) => {
            // Check if we got recommendations
            if (result.hasRecommendations && result.recommendations) {
              setRecommendations(result.recommendations);
              setShowRecommendations(true);
              setData(null);
              setSeriesData(null);
            } else {
              setData(result);
              setSeriesData(null);
              setShowRecommendations(false);
              setRecommendations([]);
            }
          })
          .catch((e) => {
            setError(e?.message || String(e));
            setData(null);
            setSeriesData(null);
            setShowRecommendations(false);
          })
          .finally(() => {
            setLoading(false);
            setProgressInfo(null);
          });
      }
    } else {
      setData(null);
      setSeriesData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsString]);

  // Get current session (single mode or selected tab from series)
  const currentSeriesItem =
    sessionMode === "series" && seriesData?.series?.length
      ? seriesData.series[Math.min(selectedSeriesTab, seriesData.series.length - 1)]
      : null;

  const currentSessionData =
    sessionMode === "single"
      ? data
      : currentSeriesItem
        ? {
            ok: true,
            session: currentSeriesItem.session,
            qa: currentSeriesItem.qa,
            fixDecision: currentSeriesItem.fixDecision,
          }
        : null;

  const session = currentSessionData?.session;
  const qaScores = (currentSessionData?.qa?.scores || {}) as Record<string, number>;
  const qaPass = currentSessionData?.qa?.pass;

  // Check vault status when session changes
  useEffect(() => {
    if (session?.id) {
      checkVaultStatus(session.id);
    } else {
      setSavedToVault(false);
    }
  }, [session?.id]);

  async function checkVaultStatus(sessionId: string) {
    setCheckingVaultStatus(true);
    try {
      const res = await fetch(`/api/vault/sessions/${encodeURIComponent(sessionId)}/status`);
      if (res.ok) {
        const data = await res.json();
        setSavedToVault(data.savedToVault || false);
      } else if (res.status === 404) {
        // Session exists in the UI but is not yet saved to the vault
        setSavedToVault(false);
      }
    } catch (e) {
      console.error("[VAULT] Error checking vault status:", e);
    } finally {
      setCheckingVaultStatus(false);
    }
  }

  const gmText = session ? (gameModelLabel[session.gameModelId] ?? session.gameModelId) : "";
  const phaseText = session?.phase
    ? phaseLabel[session.phase] ?? session.phase.toLowerCase().replace(/_/g, " ")
    : "N/A";
  const zoneText = session?.zone
    ? zoneLabel[session.zone] ?? session.zone.toLowerCase().replace(/_/g, " ")
    : "N/A";

  // Show/hide series count input based on mode
  useEffect(() => {
    const updateSeriesCountVisibility = () => {
      const sessionModeInputs = document.querySelectorAll('input[name="sessionMode"]') as NodeListOf<HTMLInputElement>;
      const selectedMode = Array.from(sessionModeInputs).find(input => input.checked)?.value || "single";
      const seriesCountContainer = document.getElementById("seriesCountContainer");
      if (seriesCountContainer) {
        seriesCountContainer.style.display = selectedMode === "series" ? "block" : "none";
      }
    };
    
    updateSeriesCountVisibility();
    const sessionModeInputs = document.querySelectorAll('input[name="sessionMode"]');
    sessionModeInputs.forEach(input => {
      input.addEventListener("change", updateSeriesCountVisibility);
    });
    
    return () => {
      sessionModeInputs.forEach(input => {
        input.removeEventListener("change", updateSeriesCountVisibility);
      });
    };
  }, []);

  useEffect(() => {
    const sessionId = data?.session?.id;
    if (!sessionId) {
      setSkillFocus(null);
      return;
    }
    fetchSkillFocusForSessionId(sessionId)
      .then((focus) => setSkillFocus(focus))
      .catch(() => setSkillFocus(null));
  }, [data?.session?.id]);

  useEffect(() => {
    const firstSession: any = seriesData?.series?.[0]?.session;
    const seriesId = firstSession?.seriesId;
    if (!seriesId) {
      setSeriesSkillFocus(null);
      return;
    }
    fetchSkillFocusForSeriesId(seriesId)
      .then((focus) => setSeriesSkillFocus(focus))
      .catch(() => setSeriesSkillFocus(null));
  }, [seriesData?.series?.length]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
      {loading && (
        <SessionProgress
          isSeries={progressInfo?.isSeries || false}
          totalSessions={progressInfo?.totalSessions}
          currentSession={progressInfo?.currentSession}
        />
      )}
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">
            ACI Session Generator
          </h1>
          <p className="text-sm text-slate-400">
            Generate complete training sessions (60 or 90 minutes) with multiple drills
            {seriesData?.metadata?.totalSessions
              ? ` • ${seriesData.metadata.totalSessions}-session progressive series`
              : ""}
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
                {/* Row 1: 6 fields */}
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
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

                  {/* Topic */}
                  <div className="space-y-1">
                    <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                      Topic
                    </label>
                    <TopicSelect
                      phase={config.phase as Phase}
                      zone={config.zone as Zone}
                      defaultValue={config.topic}
                      name="topic"
                      id="topic"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                    />
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

                {/* Session Mode Toggle */}
                <div className="grid gap-4 sm:grid-cols-3 pt-4 border-t border-slate-700/50">
                  <div className="space-y-1">
                    <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                      Generation Mode
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="sessionMode"
                          value="single"
                          defaultChecked={!hasParams || searchParams.get("series") !== "true"}
                          className="w-4 h-4 text-emerald-500 bg-slate-800 border-slate-600 focus:ring-emerald-500"
                        />
                        <span className="text-[11px] text-slate-300">Single Session</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="sessionMode"
                          value="series"
                          defaultChecked={hasParams && searchParams.get("series") === "true"}
                          className="w-4 h-4 text-emerald-500 bg-slate-800 border-slate-600 focus:ring-emerald-500"
                        />
                        <span className="text-[11px] text-slate-300">Progressive Series</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Number of Sessions (shown when series is selected) */}
                  <div className="space-y-1" id="seriesCountContainer" style={{ display: hasParams && searchParams.get("series") === "true" ? "block" : "none" }}>
                    <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                      Number of Sessions
                    </label>
                    <input
                      type="number"
                      name="numberOfSessions"
                      id="numberOfSessions"
                      defaultValue={parseInt(searchParams.get("numberOfSessions") || "3")}
                      min={2}
                      max={10}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
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
                    Generate {sessionMode === "series" ? "Series" : "Session"}
                  </button>
                </div>
              </div>
            </SessionFormWithLoading>
          </SessionForm>
        </section>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
            <p className="mt-4 text-sm text-slate-400">Generating session...</p>
          </div>
        )}

        {/* Recommendations */}
        {showRecommendations && recommendations.length > 0 && (
          <section className="rounded-3xl border border-blue-700/70 bg-blue-900/20 px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-blue-300">
                  Similar Sessions Found in Vault
                </h2>
                <p className="text-sm text-blue-200/70">
                  We found {recommendations.length} similar session(s) that might match what you're looking for.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowRecommendations(false);
                  setLoading(true);
                  setError(null);
                  
                  // Check if we're in series mode
                  const isSeries = sessionMode === "series";
                  const numberOfSessions = parseInt(searchParams.get("numberOfSessions") || "3");
                  
                  if (isSeries) {
                    // Generate progressive series with skipRecommendation
                    setProgressInfo({ isSeries: true, totalSessions: numberOfSessions, currentSession: 1 });
                    fetchProgressiveSeries(config, numberOfSessions, true)
                      .then((result) => {
                        if (result.series && Array.isArray(result.series) && result.series.length > 0) {
                          setSeriesData(result);
                          setData(null);
                          setSelectedSeriesTab(0);
                        } else {
                          throw new Error("No sessions were generated in the series");
                        }
                      })
                      .catch((e) => {
                        setError(e?.message || String(e));
                        setSeriesData(null);
                        setData(null);
                      })
                      .finally(() => {
                        setLoading(false);
                        setProgressInfo(null);
                      });
                  } else {
                    // Generate single session with skipRecommendation
                    setProgressInfo({ isSeries: false });
                    fetchSession(config, true)
                      .then((result) => {
                        setData(result);
                        setSeriesData(null);
                      })
                      .catch((e) => {
                        setError(e?.message || String(e));
                        setData(null);
                      })
                      .finally(() => {
                        setLoading(false);
                        setProgressInfo(null);
                      });
                  }
                }}
                className="inline-flex items-center rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-blue-400"
              >
                Generate New Anyway
              </button>
            </div>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div
                  key={rec.session.id || i}
                  className="rounded-lg border border-blue-700/50 bg-blue-900/30 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-1">{rec.session.title}</h3>
                      <div className="text-xs text-blue-200/70 space-y-1">
                        <div>
                          {gameModelLabel[rec.session.gameModelId]} • {rec.session.ageGroup}
                          {rec.session.phase && rec.session.zone && (
                            <> • {phaseLabel[rec.session.phase]} • {zoneLabel[rec.session.zone]}</>
                          )}
                        </div>
                        {rec.session.qaScore && (
                          <div>QA Score: {rec.session.qaScore.toFixed(1)}/5.0</div>
                        )}
                        <div className="text-blue-300/50">{rec.matchReason}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Link
                        href={`/demo/session?sessionId=${rec.session.id}`}
                        className="inline-flex items-center rounded-full bg-blue-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-blue-400"
                      >
                        View
                      </Link>
                      <Link
                        href="/vault"
                        className="inline-flex items-center rounded-full border border-blue-500/50 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20"
                      >
                        Vault
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-3xl border border-red-700/70 bg-red-900/20 px-6 py-5">
            <p className="text-sm text-red-300">
              Failed to fetch session from ACI API: {error}
            </p>
          </div>
        )}

        {/* Series Tabs (if series mode) */}
        {!loading && seriesData?.ok && seriesData?.series?.length > 0 && (
          <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {seriesData.metadata.totalSessions}-Session Progressive Series
                </h2>
                <p className="text-xs text-slate-400">
                  {seriesData.metadata.gameModelId} • {seriesData.metadata.ageGroup}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    try {
                      setGeneratingSeriesSkillFocus(true);
                      const sessionIds = seriesData.series.map(s => s.id).filter(Boolean) as string[];
                      if (sessionIds.length === 0) {
                        alert("Cannot generate focus: Sessions don't have IDs yet");
                        setGeneratingSeriesSkillFocus(false);
                        return;
                      }
                      const focus = await generateSkillFocusForSeries({ sessionIds });
                      setSeriesSkillFocus(focus);
                    } catch (e: any) {
                      alert("Error generating series skill focus: " + e.message);
                    } finally {
                      setGeneratingSeriesSkillFocus(false);
                    }
                  }}
                  disabled={generatingSeriesSkillFocus}
                  className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  {generatingSeriesSkillFocus ? "⚡ Generating Focus..." : "🎯 Series Skill Focus"}
                </button>
                <button
                  onClick={async () => {
                    try {
                      setSavingSeries(true);
                      const sessionIds = seriesData.series.map(s => s.id).filter(Boolean) as string[];
                      if (sessionIds.length === 0) {
                        alert("Cannot save: Sessions don't have IDs yet");
                        setSavingSeries(false);
                        return;
                      }
                      const response = await fetch("/api/vault/series", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          seriesId: `series-${Date.now()}`,
                          sessionIds,
                        }),
                      });
                      if (!response.ok) {
                        const error = await response.json();
                        alert("Error saving series to vault: " + (error.error || "Unknown error"));
                        setSavingSeries(false);
                        return;
                      }
                      setSeriesSavedToVault(true);
                      setJustSaved(true);
                      // Hide the "just saved" message after 5 seconds
                      setTimeout(() => setJustSaved(false), 5000);
                    } catch (e: any) {
                      alert("Error saving series to vault: " + e.message);
                    } finally {
                      setSavingSeries(false);
                    }
                  }}
                  disabled={seriesSavedToVault || savingSeries}
                  className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    seriesSavedToVault
                      ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 cursor-default"
                      : "border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  } ${savingSeries ? "opacity-50 cursor-wait" : ""}`}
                >
                  {savingSeries ? (
                    <>⏳ Saving...</>
                  ) : seriesSavedToVault ? (
                    <>✓ Series Saved to Vault</>
                  ) : (
                    <>💾 Save Series to Vault</>
                  )}
                </button>
                {justSaved && seriesSavedToVault && (
                  <Link
                    href="/vault"
                    className="inline-flex items-center rounded-full border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-500/20 transition-all animate-pulse"
                  >
                    → Go to Vault
                  </Link>
                )}
              </div>
            </div>
            {seriesSkillFocus && (
              <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="text-xs text-emerald-300 uppercase tracking-widest">Series Skill Focus</div>
                <h3 className="mt-2 text-sm font-semibold text-emerald-100">{seriesSkillFocus.title}</h3>
                {seriesSkillFocus.summary && (
                  <p className="mt-2 text-sm text-emerald-100/80">{seriesSkillFocus.summary}</p>
                )}
                {Array.isArray(seriesSkillFocus.keySkills) && seriesSkillFocus.keySkills.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Key Skills</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {seriesSkillFocus.keySkills.map((skill, i) => (
                        <span key={i} className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-100">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(seriesSkillFocus.coachingPoints) && seriesSkillFocus.coachingPoints.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Coaching Points</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-100/80">
                      {seriesSkillFocus.coachingPoints.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 border-b border-slate-700/70 -mx-6 px-6 pb-4">
              {seriesData.series.map((seriesItem, index) => (
                <button
                  key={seriesItem.sessionNumber}
                  onClick={() => setSelectedSeriesTab(index)}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                    selectedSeriesTab === index
                      ? "bg-slate-800 text-emerald-400 border-b-2 border-emerald-400"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  Session {seriesItem.sessionNumber}
                  {seriesItem.qaScore && (
                    <span className="ml-2 text-xs">
                      (QA: {seriesItem.qaScore.toFixed(1)})
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <p className="text-xs text-slate-400">
                {seriesData.series[selectedSeriesTab]?.session.summary || "Progressive training series"}
              </p>
            </div>
          </section>
        )}

        {/* Session Results */}
        {!loading && currentSessionData?.ok && session?.drills && session.drills.length > 0 && (
          <>
            {/* Session Overview */}
            <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{session.title}</h2>
                  {savedToVault && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 text-xs font-medium">
                      <span>✓</span>
                      <span>Saved to Vault</span>
                    </span>
                  )}
                </div>
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

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                {session.id && !savedToVault && (
                  <button
                    onClick={async () => {
                      try {
                        const sessionId = session.id;
                        console.log("[VAULT FRONTEND] Attempting to save session");
                        console.log("[VAULT FRONTEND] Session object:", { id: sessionId, hasId: !!sessionId, idType: typeof sessionId });
                        console.log("[VAULT FRONTEND] Full session:", session);
                        
                        if (!sessionId || typeof sessionId !== 'string') {
                          alert("Error: Session ID is missing or invalid");
                          return;
                        }
                        
                        const url = `/api/vault/sessions/${encodeURIComponent(sessionId)}/save`;
                        console.log("[VAULT FRONTEND] Calling URL:", url);
                        
                        const response = await fetch(url, {
                          method: "POST",
                        });
                        
                        console.log("[VAULT FRONTEND] Response status:", response.status, response.statusText);
                        console.log("[VAULT FRONTEND] Response headers:", Object.fromEntries(response.headers.entries()));
                        
                        if (!response.ok) {
                          let errorText = "";
                          let errorJson = null;
                          
                          try {
                            errorText = await response.text();
                            console.log("[VAULT FRONTEND] Error response text:", errorText);
                            
                            try {
                              errorJson = JSON.parse(errorText);
                              console.error("[VAULT FRONTEND] Parsed error JSON:", errorJson);
                            } catch (e) {
                              console.error("[VAULT FRONTEND] Could not parse error as JSON:", e);
                            }
                          } catch (e) {
                            console.error("[VAULT FRONTEND] Could not read error response:", e);
                          }
                          
                          const errorMessage = errorJson?.error || errorText || `HTTP ${response.status}: ${response.statusText}`;
                          console.error("[VAULT FRONTEND] Final error message:", errorMessage);
                          alert("Error saving to vault: " + errorMessage);
                          return;
                        }
                        const result = await response.json();
                        console.log("[VAULT FRONTEND] Save successful:", result);
                        setSavedToVault(true);
                        setJustSaved(true);
                        // Hide the "just saved" message after 5 seconds
                        setTimeout(() => setJustSaved(false), 5000);
                      } catch (e: any) {
                        console.error("[VAULT FRONTEND] Save exception:", e);
                        alert("Error saving to vault: " + e.message);
                      }
                    }}
                    disabled={savedToVault || checkingVaultStatus}
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                      savedToVault
                        ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 cursor-default"
                        : "border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    } ${checkingVaultStatus ? "opacity-50 cursor-wait" : ""}`}
                  >
                    {checkingVaultStatus ? (
                      <>⏳ Checking...</>
                    ) : savedToVault ? (
                      <>✓ Saved to Vault</>
                    ) : (
                      <>💾 Save to Vault</>
                    )}
                  </button>
                )}
                {justSaved && (
                  <Link
                    href="/vault"
                    className="inline-flex items-center rounded-full border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-500/20 transition-all animate-pulse"
                  >
                    → Go to Vault
                  </Link>
                )}
                <button
                  onClick={async () => {
                    try {
                      if (!session.id) {
                        alert("Session ID is missing. Generate a session first.");
                        return;
                      }
                      setGeneratingSkillFocus(true);
                      const focus = await generateSkillFocusForSessionId(session.id);
                      setSkillFocus(focus);
                    } catch (e: any) {
                      alert("Error generating skill focus: " + e.message);
                    } finally {
                      setGeneratingSkillFocus(false);
                    }
                  }}
                  disabled={generatingSkillFocus || !session.id}
                  className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  {generatingSkillFocus ? "⚡ Generating Skill Focus..." : "🎯 Generate Skill Focus"}
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/export-session-pdf", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ session }),
                      });
                      if (!response.ok) {
                        const error = await response.json();
                        alert("Error exporting PDF: " + (error.error || "Unknown error"));
                        return;
                      }
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `session-${session.title.replace(/[^a-z0-9]/gi, "-")}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    } catch (e: any) {
                      alert("Error exporting PDF: " + e.message);
                    }
                  }}
                  className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
                >
                  📄 Export PDF
                </button>
              </div>

              {/* Session Plan Breakdown */}
              {session.sessionPlan && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3">Session Plan</h3>
                  {Array.isArray(session.sessionPlan.breakdown) ? (
                    <div className="grid grid-cols-5 gap-2 text-xs">
                      {session.sessionPlan.breakdown.map((item, i) => (
                        <div key={i} className="text-center p-2 rounded-lg bg-slate-800/50">
                          <div className="font-semibold text-slate-200">
                            {drillTypeLabel[item.drillType] || item.drillType}
                          </div>
                          <div className="text-slate-400 mt-1">
                            {(item.duration || item.durationMin || 0)} min
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-300">
                      {typeof session.sessionPlan.breakdown === "string" 
                        ? session.sessionPlan.breakdown 
                        : `Total Duration: ${session.sessionPlan.totalDuration || session.durationMin || 90} minutes`}
                    </div>
                  )}
                </div>
              )}

              {skillFocus && (
                <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="text-xs text-emerald-300 uppercase tracking-widest">Player Skill Focus</div>
                  <h3 className="mt-2 text-sm font-semibold text-emerald-100">{skillFocus.title}</h3>
                  {skillFocus.summary && (
                    <p className="mt-2 text-sm text-emerald-100/80">{skillFocus.summary}</p>
                  )}
                  {Array.isArray(skillFocus.keySkills) && skillFocus.keySkills.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Key Skills</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {skillFocus.keySkills.map((skill, i) => (
                          <span key={i} className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-100">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(skillFocus.coachingPoints) && skillFocus.coachingPoints.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Coaching Points</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-100/80">
                        {skillFocus.coachingPoints.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
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
                      {diagram && (
                        <div className="max-w-xl" key={`diagram-${drill.title}-${index}`}>
                          <DrillDiagramCard
                            title={drill.title}
                            gameModelId={session.gameModelId}
                            phase={session.phase || "ATTACKING"}
                            zone={session.zone || "ATTACKING_THIRD"}
                            diagram={diagram}
                          />
                        </div>
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

export default function SessionDemoPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <header className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight">
              ACI Session Generator
            </h1>
            <p className="text-sm text-slate-400">
              Loading...
            </p>
          </header>
        </div>
      </main>
    }>
      <SessionDemoPageContent />
    </Suspense>
  );
}

