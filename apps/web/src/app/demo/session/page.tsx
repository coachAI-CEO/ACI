"use client";

import { useCallback, useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import SessionForm from "@/components/SessionForm";
import SessionFormWithLoading from "@/components/SessionFormWithLoading";
import SessionProgress from "@/components/SessionProgress";
import FormationSelect from "@/components/FormationSelect";
import PlayerCountInputs from "@/components/PlayerCountInputs";
import QAScoresDisplay from "@/components/QAScoresDisplay";
import DrillDiagramCard from "@/components/DrillDiagramCard";
import TopicSelect from "@/components/TopicSelect";
import CoachChat from "@/components/CoachChat";
import ScheduleSessionModal from "@/components/ScheduleSessionModal";
import ThemedConfirmModal from "@/components/ThemedConfirmModal";
import CreatePlayerPlanModal from "@/components/CreatePlayerPlanModal";
import { getTopicsForPhaseAndZone, getRandomTopic, type Phase, type Zone } from "@/data/session-topics";
import { getUserHeaders } from "@/lib/user";
import type { DiagramV1 } from "@/types/diagram";
import { fetchUserFeatures, UserFeatures } from "@/lib/features";

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
  refCode?: string; // Drill reference code (D-XXXX)
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
  json?: any;
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
    refCode?: string; // Session reference code (S-XXXX or SR-XXXX)
    title: string;
    gameModelId: string;
    phase?: string;
    zone?: string;
    coachLevel?: string;
    ageGroup?: string;
    durationMin?: number;
    summary?: string;
    drills: SessionDrill[];
    sessionPlan?: {
      totalDuration: number;
      breakdown: Array<{ drillType: string; duration: number; durationMin?: number }>;
    };
    equipment?: string[];
    coachingNotes?: string;
    principleIds?: string[];
    psychThemeIds?: string[];
    skillFocus?: SkillFocus;
    creator?: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  };
  qa?: {
    pass: boolean;
    summary?: string;
    scores?: Record<string, number>;
  };
  fixDecision?: any;
  hasRecommendations?: boolean;
  recommendations?: any[];
  error?: string;
  raw?: {
    created?: {
      id?: string;
    };
  };
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
    refCode?: string; // Session reference code from series generation
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
  psychology?: {
    good?: string[];
    bad?: string[];
  };
  sectionPhrases?: Record<
    string,
    {
      encourage?: string[];
      correct?: string[];
    }
  >;
  createdAt?: string;
};

type PlayerPlanStatus = {
  id: string;
  refCode?: string | null;
  title?: string | null;
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
  ROCKLIN_FC: "Rocklin FC",
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

const coachLevelLabel: Record<string, string> = {
  GRASSROOTS: "Grassroots",
  USSF_C: "USSF C",
  USSF_B_PLUS: "USSF B+",
};
const coachLevelOptions = [
  { key: "GRASSROOTS", label: "Grassroots" },
  { key: "USSF_C", label: "USSF C" },
  { key: "USSF_B_PLUS", label: "USSF B+" },
] as const;

function normalizeCoachLevel(value?: string): string {
  const v = String(value || "").toUpperCase();
  if (v === "USSF_B_PLUS" || v === "USSF B+" || v === "USSF_B") return "USSF_B_PLUS";
  if (v === "USSF_C" || v === "USSF C") return "USSF_C";
  if (v === "GRASSROOTS") return "GRASSROOTS";
  return v;
}

function getLanguageLevelBadge(coachLevel?: string) {
  const key = normalizeCoachLevel(coachLevel);
  if (key === "GRASSROOTS") {
    return {
      label: "Language: Grassroots",
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    };
  }
  if (key === "USSF_C") {
    return {
      label: "Language: USSF C",
      className: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    };
  }
  if (key === "USSF_B_PLUS") {
    return {
      label: "Language: USSF B+",
      className: "border-violet-500/40 bg-violet-500/10 text-violet-300",
    };
  }
  return {
    label: "Language: Standard",
    className: "border-slate-600/60 bg-slate-800/60 text-slate-300",
  };
}

const PHASE_OPTIONS: Phase[] = ["ATTACKING", "DEFENDING", "TRANSITION"];
const ZONE_OPTIONS: Zone[] = ["DEFENSIVE_THIRD", "MIDDLE_THIRD", "ATTACKING_THIRD"];
const SESSION_DIVERSITY_KEY = "te_session_combo_history_v1";
const SESSION_DIVERSITY_MAX = 120;
const SESSION_DIVERSITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

type SessionComboHistoryEntry = {
  phase: string;
  zone: string;
  topic: string;
  ts: number;
};

function readSessionComboHistory(): SessionComboHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSION_DIVERSITY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        phase: String(entry.phase || ""),
        zone: String(entry.zone || ""),
        topic: String(entry.topic || ""),
        ts: Number(entry.ts || 0),
      }))
      .filter((entry) => entry.phase && entry.zone && Number.isFinite(entry.ts))
      .filter((entry) => now - entry.ts <= SESSION_DIVERSITY_WINDOW_MS)
      .slice(-SESSION_DIVERSITY_MAX);
  } catch {
    return [];
  }
}

function writeSessionComboHistory(history: SessionComboHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_DIVERSITY_KEY, JSON.stringify(history.slice(-SESSION_DIVERSITY_MAX)));
  } catch {
    // Ignore localStorage write errors (private mode/quota)
  }
}

function recordSessionComboUsage(config: SessionConfig) {
  if (!config?.phase || !config?.zone) return;
  const history = readSessionComboHistory();
  history.push({
    phase: String(config.phase),
    zone: String(config.zone),
    topic: String(config.topic || ""),
    ts: Date.now(),
  });
  writeSessionComboHistory(history);
}

function getBalancedDefaultCombo(coachLevel: string): { phase: Phase; zone: Zone; topic: string } {
  const history = readSessionComboHistory();
  const comboStats = PHASE_OPTIONS.flatMap((phase) =>
    ZONE_OPTIONS.map((zone) => {
      const key = `${phase}|${zone}`;
      const entries = history.filter((h) => `${h.phase}|${h.zone}` === key);
      const count = entries.length;
      const lastUsed = entries.length ? Math.max(...entries.map((e) => e.ts)) : -1;
      return { phase, zone, count, lastUsed };
    })
  );

  comboStats.sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count;
    return a.lastUsed - b.lastUsed;
  });

  const chosen = comboStats[0] || { phase: "ATTACKING" as Phase, zone: "ATTACKING_THIRD" as Zone };
  const topics = getTopicsForPhaseAndZone(chosen.phase, chosen.zone, coachLevel);
  const topicCounts = new Map<string, number>();
  for (const h of history) {
    if (h.phase === chosen.phase && h.zone === chosen.zone && h.topic) {
      topicCounts.set(h.topic, (topicCounts.get(h.topic) || 0) + 1);
    }
  }
  const topic =
    topics.length > 0
      ? topics.slice().sort((a, b) => (topicCounts.get(a) || 0) - (topicCounts.get(b) || 0))[0]
      : "";

  return { phase: chosen.phase, zone: chosen.zone, topic };
}

function humanizeSessionText(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/\bPRESSING\b/g, "Pressing")
    .replace(/\bATTACKING\b/g, "Attacking")
    .replace(/\bMIDDLE_THIRD\b/g, "Middle third");
}

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
  const coachLevel = "GRASSROOTS";
  const balanced = getBalancedDefaultCombo(coachLevel);
  const phase: Phase = balanced.phase;
  const zone: Zone = balanced.zone;
  const defaultTopic =
    balanced.topic || getRandomTopic(phase, zone, coachLevel);
  return {
    gameModelId: "POSSESSION",
    ageGroup,
    phase,
    zone,
    formationAttacking: getDefaultFormation(ageGroup),
    formationDefending: getDefaultFormation(ageGroup),
    playerLevel: "BEGINNER",
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
  v: string | string[] | undefined | null,
  fallback: number
): number {
  if (Array.isArray(v)) v = v[0];
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseStringOrDefault(
  v: string | string[] | undefined | null,
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
  const coachLevel = parseStringOrDefault(searchParams.get("coachLevel"), defaults.coachLevel || "GRASSROOTS");
  const guardedPlayerLevelDefault =
    coachLevel === "GRASSROOTS" ? "BEGINNER" : defaults.playerLevel;
  const rawPlayerLevel = parseStringOrDefault(searchParams.get("playerLevel"), guardedPlayerLevelDefault);
  const playerLevel = coachLevel === "GRASSROOTS" ? "BEGINNER" : rawPlayerLevel;
  
  // Get topic from params, or default to first topic for the phase/zone + coach level combination
  const topicParam = searchParams.get("topic");
  const availableTopics = getTopicsForPhaseAndZone(phase, zone, coachLevel);
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
    playerLevel,
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
  skipRecommendation: boolean = false,
  signal?: AbortSignal,
  generationId?: string
): Promise<SessionApiResponse> {
  const perfStart = Date.now();
  
  console.log("[SESSION_GEN] Sending config:", JSON.stringify(config, null, 2));
  const apiStart = Date.now();
  
  const url = `/api/generate-session${skipRecommendation ? "?skipRecommendation=1" : ""}`;
  
  const requestBody = JSON.stringify({
    ...config,
    ...(generationId ? { generationId } : {}),
  });

  const buildHeaders = (token: string | null): Record<string, string> => {
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(getUserHeaders() as Record<string, string>),
    };
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }
    return requestHeaders;
  };

  const parseErrorMessage = async (response: Response): Promise<string> => {
    const rawText = await response.text().catch(() => "");
    if (!rawText) {
      const statusText = response.statusText ? ` ${response.statusText}` : "";
      return `API error: ${response.status}${statusText}`;
    }
    try {
      const errorData = JSON.parse(rawText);
      return errorData?.error || errorData?.message || `API error: ${response.status}`;
    } catch {
      return rawText;
    }
  };

  const tryRefreshAccessToken = async (): Promise<string | null> => {
    if (typeof window === "undefined") return null;
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;

    const refreshRes = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);

    if (!refreshRes?.ok) return null;
    const refreshData = await refreshRes.json().catch(() => ({}));
    if (!refreshData?.accessToken) return null;
    localStorage.setItem("accessToken", refreshData.accessToken);
    document.cookie = `accessToken=${encodeURIComponent(refreshData.accessToken)}; path=/; Max-Age=604800; SameSite=Lax; Secure`;
    return refreshData.accessToken as string;
  };

  const clearAuthState = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    document.cookie = "accessToken=; path=/; Max-Age=0; SameSite=Lax";
    window.dispatchEvent(new Event("userLogin"));
  };

  let accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(accessToken),
      signal,
      cache: "no-store",
      body: requestBody,
    });
  } catch (fetchError: any) {
    if (fetchError?.name === "AbortError") {
      throw fetchError;
    }
    throw new Error(fetchError?.message || "Network error while generating session");
  }

  const apiTime = Date.now() - apiStart;
  console.log(`[PERF] API call completed in ${(apiTime / 1000).toFixed(2)}s`);
  console.log(`[SESSION_GEN] Response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    let errorMessage = await parseErrorMessage(res);
    const isInvalidToken = res.status === 401 && /invalid token|unauthorized/i.test(errorMessage);

    if (isInvalidToken && accessToken) {
      const refreshedToken = await tryRefreshAccessToken();
      if (refreshedToken) {
        accessToken = refreshedToken;
      } else {
        clearAuthState();
        accessToken = null;
      }

      res = await fetch(url, {
        method: "POST",
        headers: buildHeaders(accessToken),
        signal,
        cache: "no-store",
        body: requestBody,
      });

      if (!res.ok) {
        errorMessage = await parseErrorMessage(res);
      }
    }

    if (!res.ok) {
      console.warn("[SESSION_GEN] Error response", {
        status: res.status,
        statusText: res.statusText,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
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
  skipRecommendation: boolean = false,
  signal?: AbortSignal
): Promise<ProgressiveSeriesApiResponse> {
  const perfStart = Date.now();
  
  console.log("[PROGRESSIVE_SERIES] Sending config:", JSON.stringify(config, null, 2), `numberOfSessions: ${numberOfSessions}`, `skipRecommendation: ${skipRecommendation}`);
  const apiStart = Date.now();
  
  // Use Next.js API route to avoid CORS issues
  const url = `/api/generate-progressive-series${skipRecommendation ? "?skipRecommendation=1" : ""}`;
  
  const requestBody = JSON.stringify({
    baseInput: config,
    numberOfSessions,
  });

  const buildHeaders = (token: string | null): Record<string, string> => {
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(getUserHeaders() as Record<string, string>),
    };
    if (token) requestHeaders["Authorization"] = `Bearer ${token}`;
    return requestHeaders;
  };

  const parseErrorMessage = async (response: Response): Promise<string> => {
    const errorText = await response.text().catch(() => "");
    if (!errorText) return `API error: ${response.status}`;
    try {
      const parsed = JSON.parse(errorText);
      return parsed?.error || parsed?.message || `API error: ${response.status}`;
    } catch {
      return errorText;
    }
  };

  const tryRefreshAccessToken = async (): Promise<string | null> => {
    if (typeof window === "undefined") return null;
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;

    const refreshRes = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
    if (!refreshRes?.ok) return null;

    const refreshData = await refreshRes.json().catch(() => ({}));
    if (!refreshData?.accessToken) return null;
    localStorage.setItem("accessToken", refreshData.accessToken);
    document.cookie = `accessToken=${encodeURIComponent(refreshData.accessToken)}; path=/; Max-Age=604800; SameSite=Lax; Secure`;
    return refreshData.accessToken as string;
  };

  const clearAuthState = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    document.cookie = "accessToken=; path=/; Max-Age=0; SameSite=Lax";
    window.dispatchEvent(new Event("userLogin"));
  };

  let seriesAccessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  let res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(seriesAccessToken),
    signal,
    body: requestBody,
  }).catch((fetchError: any) => {
    console.warn("[PROGRESSIVE_SERIES] Fetch error:", fetchError);
    if (fetchError.message?.includes('fetch failed') || fetchError.code === 'ECONNREFUSED') {
      throw new Error("Cannot connect to server. Please refresh the page and try again.");
    }
    throw fetchError;
  });

  const apiTime = Date.now() - apiStart;
  console.log(`[PERF] API call completed in ${(apiTime / 1000).toFixed(2)}s`);
  console.log(`[PROGRESSIVE_SERIES] Response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    let errorMessage = await parseErrorMessage(res);
    const isInvalidToken = res.status === 401 && /invalid token|unauthorized/i.test(errorMessage);

    if (isInvalidToken && seriesAccessToken) {
      const refreshedToken = await tryRefreshAccessToken();
      if (refreshedToken) {
        seriesAccessToken = refreshedToken;
      } else {
        clearAuthState();
        seriesAccessToken = null;
      }

      res = await fetch(url, {
        method: "POST",
        headers: buildHeaders(seriesAccessToken),
        signal,
        body: requestBody,
      });
      if (!res.ok) {
        errorMessage = await parseErrorMessage(res);
      }
    }

    if (!res.ok) {
      if (res.status === 503 || res.status === 504) {
        console.warn(`[PROGRESSIVE_SERIES] Error response (${res.status}):`, errorMessage);
      } else {
        console.error(`[PROGRESSIVE_SERIES] Error response (${res.status}):`, errorMessage);
      }
    
      // Make connection errors more helpful
      if (res.status === 503) {
        if (errorMessage.includes("Cannot connect") || errorMessage.includes("ECONNREFUSED")) {
          errorMessage = "Backend server is not running. Please start the API server on port 4000.";
        } else {
          errorMessage = "Connection interrupted during generation. Your sessions may still be generating - check the Vault in a few minutes to see if they appear.";
        }
      } else if (res.status === 504) {
        errorMessage = "Request timed out. The sessions may still be generating - check the Vault.";
      }
      throw new Error(errorMessage);
    }
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
  const headers: Record<string, string> = {
    ...(getUserHeaders() as Record<string, string>),
  };
  const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const res = await fetch(`/api/skill-focus/session/${encodeURIComponent(sessionId)}`, { headers });
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
  const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch("/api/skill-focus/session", {
    method: "POST",
    headers,
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
  const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch("/api/skill-focus/series", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || `API error: ${res.status}`);
  }
  const data = await res.json();
  return data.focus;
}

async function fetchPlayerPlanForSessionId(sessionId: string): Promise<PlayerPlanStatus | null> {
  const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (!accessToken) return null;

  const res = await fetch(`/api/player-plans/by-source/SESSION/${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.ok || !data?.exists || !data?.plan?.id) return null;
  return {
    id: data.plan.id,
    refCode: data.plan.refCode || null,
    title: data.plan.title || null,
    createdAt: data.plan.createdAt,
  };
}

function SessionDemoPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<SessionApiResponse | null>(null);
  const [seriesData, setSeriesData] = useState<ProgressiveSeriesApiResponse | null>(null);
  const [loading, setLoading] = useState(() => searchParams.get("autoGenerate") === "true");
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
  const [userFeatures, setUserFeatures] = useState<UserFeatures | null>(null);
  const [savedToVault, setSavedToVault] = useState<boolean>(false);
  const [checkingVaultStatus, setCheckingVaultStatus] = useState(false);
  const [justSaved, setJustSaved] = useState<boolean>(false);
  const [seriesSavedToVault, setSeriesSavedToVault] = useState<boolean>(false);
  const [savingSeries, setSavingSeries] = useState<boolean>(false);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [pendingSeriesCheck, setPendingSeriesCheck] = useState<{
    startTime: number;
    expectedCount: number;
    config: any;
  } | null>(null);
  const [foundPendingSeries, setFoundPendingSeries] = useState<any[] | null>(null);
  const [checkingForSeries, setCheckingForSeries] = useState(false);
  const [liveSeriesSessions, setLiveSeriesSessions] = useState<Array<{
    id: string;
    title?: string;
    seriesNumber?: number | null;
  }>>([]);
  const [skillFocus, setSkillFocus] = useState<SkillFocus | null>(null);
  const [seriesSkillFocus, setSeriesSkillFocus] = useState<SkillFocus | null>(null);
  const [generatingSkillFocus, setGeneratingSkillFocus] = useState(false);
  const [generatingSeriesSkillFocus, setGeneratingSeriesSkillFocus] = useState(false);
  const [sessionPlayerPlan, setSessionPlayerPlan] = useState<PlayerPlanStatus | null>(null);
  const [checkingPlayerPlan, setCheckingPlayerPlan] = useState(false);
  const [coachLevelSessionCache, setCoachLevelSessionCache] = useState<Record<string, SessionApiResponse>>({});
  const [regeneratingCoachLevel, setRegeneratingCoachLevel] = useState<string | null>(null);
  const [confirmCoachLevelModal, setConfirmCoachLevelModal] = useState<{ open: boolean; level: string | null }>({
    open: false,
    level: null,
  });
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [diagramOverrides, setDiagramOverrides] = useState<Record<string, any>>({});
  const diagramFetchInFlight = useRef<Set<string>>(new Set());
  const [scheduleModalSession, setScheduleModalSession] = useState<{
    sessionId: string;
    sessionTitle: string;
    sessionRefCode?: string | null;
    durationMin?: number;
  } | null>(null);
  const [createPlayerPlanModal, setCreatePlayerPlanModal] = useState<{
    sourceType: "SESSION";
    sourceId: string;
    sourceRefCode?: string | null;
  } | null>(null);
  const generationAbortRef = useRef<AbortController | null>(null);
  const generationIdRef = useRef<string | null>(null);
  const activeSeriesGenerationRef = useRef<{
    startTime: number;
    config: SessionConfig;
    seriesId: string | null;
  } | null>(null);
  const pendingSeriesIdRef = useRef<string | null>(null);

  const config = getConfigFromSearchParams(searchParams);
  const normalizeCoachLevelForGeneration = (value?: string) => {
    const v = String(value || "").toUpperCase();
    if (v === "GRASSROOTS") return "GRASSROOTS";
    if (v === "USSF_C") return "USSF_C";
    if (v === "USSF_B_PLUS" || v === "USSF_B" || v === "USSF_A") return "USSF_B_PLUS";
    if (v === "USSF_D") return "GRASSROOTS";
    return undefined;
  };
  const hasParams = searchParams.toString().length > 0;
  const searchParamsString = searchParams.toString();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const isBackgroundSeriesProgress = Boolean(pendingSeriesCheck);
  const showProgressDialog = loading || isBackgroundSeriesProgress;
  const progressIsSeries = progressInfo?.isSeries || isBackgroundSeriesProgress;
  const progressTotalSessions = progressInfo?.totalSessions || pendingSeriesCheck?.expectedCount;
  const progressCurrentSession =
    progressInfo?.currentSession ||
    (progressTotalSessions ? Math.min(progressTotalSessions, Math.max(1, liveSeriesSessions.length + 1)) : 1);

  useEffect(() => {
    // Ensure the generating overlay appears immediately for AI/chat-triggered runs.
    if (searchParams.get("autoGenerate") === "true" && !data && !seriesData) {
      setLoading(true);
    }
    // Intentionally keyed to URL query updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsString]);

  const isAbortError = (err: any) => {
    const message = String(err?.message || "").toLowerCase();
    return err?.name === "AbortError" || message.includes("aborted");
  };

  const startGenerationAbortController = () => {
    if (generationAbortRef.current) {
      generationAbortRef.current.abort();
    }
    const controller = new AbortController();
    generationAbortRef.current = controller;
    return controller;
  };

  const clearGenerationAbortController = (controller?: AbortController) => {
    if (!controller || generationAbortRef.current === controller) {
      generationAbortRef.current = null;
    }
  };

  const createGenerationId = () =>
    `gen_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const getClientAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      ...(getUserHeaders() as Record<string, string>),
    };
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
    return headers;
  }, []);

  const getMatchingSeriesSessions = useCallback((
    sessions: any[],
    startTime: number,
    seriesConfig: SessionConfig
  ) => {
    const clientServerClockSkewToleranceMs = 10 * 60 * 1000;
    return sessions.filter((s: any) => {
      if (!s?.isSeries) return false;
      const createdAt = new Date(s.createdAt).getTime();
      if (createdAt + clientServerClockSkewToleranceMs < startTime) return false;
      if (seriesConfig.ageGroup && s.ageGroup !== seriesConfig.ageGroup) return false;
      if (seriesConfig.gameModelId && s.gameModelId !== seriesConfig.gameModelId) return false;
      if (seriesConfig.phase && s.phase !== seriesConfig.phase) return false;
      return true;
    });
  }, []);

  const mapSeriesSessionsForProgress = useCallback((sessions: any[]) => {
    return sessions
      .slice()
      .sort((a: any, b: any) => {
        const aNumber = Number(a?.seriesNumber || 0);
        const bNumber = Number(b?.seriesNumber || 0);
        if (aNumber && bNumber && aNumber !== bNumber) return aNumber - bNumber;
        const aCreated = new Date(a?.createdAt || 0).getTime();
        const bCreated = new Date(b?.createdAt || 0).getTime();
        return aCreated - bCreated;
      })
      .map((s: any, idx: number) => ({
        id: String(s?.id || `${s?.seriesId || "series"}-${idx}`),
        title: s?.title || undefined,
        seriesNumber: Number.isFinite(Number(s?.seriesNumber)) ? Number(s?.seriesNumber) : null,
      }));
  }, []);

  const pickActiveSeriesSessions = useCallback((
    sessions: any[],
    lockedSeriesId: string | null
  ): { sessions: any[]; seriesId: string | null } => {
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return { sessions: [], seriesId: lockedSeriesId };
    }

    if (lockedSeriesId) {
      const locked = sessions.filter((s: any) => s?.seriesId === lockedSeriesId);
      return { sessions: locked, seriesId: lockedSeriesId };
    }

    const bySeries = new Map<string, any[]>();
    for (const s of sessions) {
      const sid = s?.seriesId;
      if (!sid) continue;
      if (!bySeries.has(sid)) bySeries.set(sid, []);
      bySeries.get(sid)!.push(s);
    }

    if (bySeries.size === 0) {
      return { sessions, seriesId: null };
    }

    const ranked = Array.from(bySeries.entries())
      .map(([seriesId, list]) => ({
        seriesId,
        list,
        latestCreatedAt: Math.max(...list.map((s: any) => new Date(s?.createdAt || 0).getTime())),
      }))
      .sort((a, b) => {
        if (b.latestCreatedAt !== a.latestCreatedAt) return b.latestCreatedAt - a.latestCreatedAt;
        return b.list.length - a.list.length;
      });

    return { sessions: ranked[0].list, seriesId: ranked[0].seriesId };
  }, []);

  const cancelGenerationOnServer = async () => {
    const generationId = generationIdRef.current;
    if (!generationId) return;
    try {
      await fetch("/api/cancel-generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getUserHeaders() as Record<string, string>),
          ...(typeof window !== "undefined" && localStorage.getItem("accessToken")
            ? { Authorization: `Bearer ${localStorage.getItem("accessToken")}` }
            : {}),
        },
        body: JSON.stringify({ generationId }),
      });
    } catch {
      // Best-effort cancellation
    }
  };

  const cancelGeneration = () => {
    if (generationAbortRef.current) {
      generationAbortRef.current.abort();
      generationAbortRef.current = null;
    }
    void cancelGenerationOnServer();
    setPendingSeriesCheck(null);
    setCheckingForSeries(false);
    setLoading(false);
    setProgressInfo(null);
    setLiveSeriesSessions([]);
    setRegeneratingCoachLevel(null);
  };

  useEffect(() => {
    // Fetch user features
    fetchUserFeatures().then(setUserFeatures).catch(() => setUserFeatures(null));
  }, []);

  const isDiagramMissingTactical = (diagram: any) => {
    if (!diagram) return true;
    const arrows = Array.isArray(diagram.arrows) ? diagram.arrows.length : 0;
    const annotations = Array.isArray(diagram.annotations) ? diagram.annotations.length : 0;
    // safeZones can intentionally be empty for simplified grassroots diagrams.
    return arrows === 0 || annotations === 0;
  };

  useEffect(() => {
    const drills = data?.session?.drills;
    if (!drills || !Array.isArray(drills)) return;
    drills.forEach((drill: any) => {
      const refCode = drill.refCode;
      if (!refCode) return;
      if (data?.session?.coachLevel === "GRASSROOTS") return;
      if (diagramOverrides[refCode]) return;
      if (diagramFetchInFlight.current.has(refCode)) return;
      const baseDiagram = drill.json?.diagram || drill.diagram || drill.diagramV1 || drill.json?.diagramV1;
      if (!isDiagramMissingTactical(baseDiagram)) return;
      diagramFetchInFlight.current.add(refCode);
      fetch(`${apiBaseUrl}/vault/lookup/${encodeURIComponent(refCode)}`, {
        headers: {
          ...getUserHeaders(),
        },
      })
        .then((res) => res.json())
        .then((payload) => {
          const fullDrill = payload?.data;
          const enriched =
            fullDrill?.json?.diagram ||
            fullDrill?.diagram ||
            fullDrill?.diagramV1 ||
            fullDrill?.json?.diagramV1;
          if (enriched) {
            setDiagramOverrides((prev) => ({ ...prev, [refCode]: enriched }));
          }
        })
        .catch(() => {
          // ignore fetch failures
        })
        .finally(() => {
          diagramFetchInFlight.current.delete(refCode);
        });
    });
  }, [data, diagramOverrides]);

  useEffect(() => {
    return () => {
      if (generationAbortRef.current) {
        generationAbortRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    const sessionId = searchParams.get("sessionId");
    const hasAnyParams = searchParams.toString().length > 0;
    if (!sessionId && !hasAnyParams) {
      setError(null);
      setSkillFocus(null);
      setSeriesSkillFocus(null);
    }
    
    // If sessionId is provided, load that session instead of generating
    if (sessionId) {
      setLoading(true);
      setError(null);
      setSessionMode("single");
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: Record<string, string> = {};
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
      fetch(`/api/vault/sessions/${encodeURIComponent(sessionId)}`, { headers })
        .then(async (res) => {
          if (res.status === 404) {
            try {
              const cached = sessionStorage.getItem(`vaultSession:${sessionId}`);
              if (cached) {
                const cachedSession = JSON.parse(cached);
                const sessionData = cachedSession.json || {};
                const qaFromJson = sessionData.qa || {};
                const qaData = {
                  pass: cachedSession.approved || qaFromJson.pass || false,
                  summary: qaFromJson.summary,
                  scores: qaFromJson.scores || {},
                };
                setData({
                  ok: true,
                  session: {
                    id: cachedSession.id,
                    title: cachedSession.title,
                    gameModelId: cachedSession.gameModelId,
                    phase: cachedSession.phase,
                    zone: cachedSession.zone,
                    ageGroup: cachedSession.ageGroup,
                    durationMin: cachedSession.durationMin,
                    summary: sessionData.summary,
                    drills: sessionData.drills || [],
                    sessionPlan: sessionData.sessionPlan,
                    equipment: sessionData.equipment,
                    coachingNotes: sessionData.coachingNotes,
                    principleIds: Array.isArray(cachedSession.principleIds) ? cachedSession.principleIds : [],
                    psychThemeIds: Array.isArray(cachedSession.psychThemeIds) ? cachedSession.psychThemeIds : [],
                  },
                  qa: qaData,
                });
                setSavedToVault(true);
                setLoading(false);
                setError(null);
                return null;
              }
            } catch {
              // ignore cache errors
            }
            setError("Session not found in vault. It may have been removed.");
            setData(null);
            setSeriesData(null);
            setSavedToVault(false);
            setSkillFocus(null);
            setLoading(false);
            router.replace("/demo/session");
            return null;
          }
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const msg = res.status === 401
              ? "Please sign in to view this session."
              : (errBody?.error || `Session not found (${res.status})`);
            throw new Error(msg);
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
            
            // Validate required fields
            if (!vaultData.session.id || !vaultData.session.title || !vaultData.session.gameModelId) {
              throw new Error("Session data is missing required fields");
            }

            setData({
              ok: true,
              session: {
                id: vaultData.session.id,
                refCode: vaultData.session.refCode || undefined,
                title: vaultData.session.title,
                gameModelId: vaultData.session.gameModelId,
                phase: vaultData.session.phase || undefined,
                zone: vaultData.session.zone || undefined,
                ageGroup: vaultData.session.ageGroup || "U12",
                durationMin: vaultData.session.durationMin || undefined,
                summary: sessionData.summary || undefined,
                drills: Array.isArray(sessionData.drills) ? sessionData.drills : [],
                sessionPlan: sessionData.sessionPlan || undefined,
                equipment: Array.isArray(sessionData.equipment) ? sessionData.equipment : undefined,
                coachingNotes: sessionData.coachingNotes || undefined,
                principleIds: Array.isArray(vaultData.session.principleIds) ? vaultData.session.principleIds : [],
                psychThemeIds: Array.isArray(vaultData.session.psychThemeIds) ? vaultData.session.psychThemeIds : [],
                creator: vaultData.session.user || vaultData.session.creator || null,
              },
              qa: qaData,
            });
            setSkillFocus(sessionData.skillFocus || null);
            setSeriesData(null);
            setShowRecommendations(false);
            setRecommendations([]);
          } else {
            console.error("[SESSION_LOAD] Invalid session data format:", vaultData);
            throw new Error(`Invalid session data: ${vaultData.error || "Missing required fields"}`);
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
    
    // If seriesId is provided, load the series from vault
    const seriesId = searchParams.get("seriesId");
    if (seriesId) {
      setLoading(true);
      setError(null);
      setSessionMode("series");
      const seriesAccessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const seriesHeaders: Record<string, string> = {};
      if (seriesAccessToken) seriesHeaders["Authorization"] = `Bearer ${seriesAccessToken}`;
      fetch(`/api/vault/series/${encodeURIComponent(seriesId)}`, { headers: seriesHeaders })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error("Series not found in vault");
          }
          const data = await res.json();
          if (data.ok && data.sessions && data.sessions.length > 0) {
            // Convert vault sessions to series format
            const seriesSessions = data.sessions.map((s: any) => {
              const sessionData = s.json || {};
              const qaFromJson = sessionData.qa || {};
              return {
                session: {
                  id: s.id,
                  title: s.title,
                  gameModelId: s.gameModelId,
                  phase: s.phase,
                  zone: s.zone,
                  ageGroup: s.ageGroup,
                  durationMin: s.durationMin,
                  summary: sessionData.summary,
                  drills: sessionData.drills || [],
                  sessionPlan: sessionData.sessionPlan,
                  equipment: sessionData.equipment,
                  coachingNotes: sessionData.coachingNotes,
                  principleIds: Array.isArray(s.principleIds) ? s.principleIds : [],
                  psychThemeIds: Array.isArray(s.psychThemeIds) ? s.psychThemeIds : [],
                  skillFocus: sessionData.skillFocus || null,
                },
                qa: {
                  pass: s.approved || qaFromJson.pass || false,
                  summary: qaFromJson.summary,
                  scores: qaFromJson.scores || {},
                },
              };
            });
            
            setSeriesData({
              ok: true,
              series: seriesSessions,
            });
            setData(null);
            setSelectedSeriesTab(0);
            setSeriesSavedToVault(true); // Series from vault is already saved
            setShowRecommendations(false);
            setRecommendations([]);
          } else {
            throw new Error("No sessions found in series");
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
      const autoGenerate = searchParams.get("autoGenerate") === "true";
      
      setError(null);
      setSessionMode(isSeries ? "series" : "single");
      
      // Set progress info BEFORE setting loading to true, so it shows immediately
      if (isSeries) {
        setProgressInfo({ isSeries: true, totalSessions: numberOfSessions, currentSession: 1 });
        setLiveSeriesSessions([]);
      } else {
        setProgressInfo({ isSeries: false });
        setLiveSeriesSessions([]);
      }
      
      setLoading(true);
      
      // Always skip recommendation gating for direct generation from this page.
      // User can still discover existing sessions in Vault manually.
      const skipRecommendation = true;
      
      if (isSeries) {
        const controller = startGenerationAbortController();
        generationIdRef.current = createGenerationId();
        const generationStartTime = Date.now();
        activeSeriesGenerationRef.current = {
          startTime: generationStartTime,
          config,
          seriesId: null,
        };
        fetchProgressiveSeries(config, numberOfSessions, skipRecommendation, controller.signal)
          .then((result) => {
            console.log("[SESSION_PAGE] Progressive series result:", {
              ok: result.ok,
              hasSeries: !!result.series,
              seriesLength: result.series?.length,
              hasRecommendations: !!result.hasRecommendations,
              recommendationsCount: result.recommendations?.length,
              autoGenerate,
              skipRecommendation,
            });
            
            // Check if we got recommendations instead of a series (only if not auto-generating)
            if (!autoGenerate && result.hasRecommendations && result.recommendations) {
              console.log("[SESSION_PAGE] Showing recommendations instead of generating");
              setRecommendations(result.recommendations);
              setShowRecommendations(true);
              setSeriesData(null);
              setData(null);
            } else if (result.series && Array.isArray(result.series) && result.series.length > 0) {
              console.log("[SESSION_PAGE] Series generated successfully");
              setLiveSeriesSessions(
                mapSeriesSessionsForProgress(result.series.map((item: any) => ({
                  id: item?.id || item?.session?.id,
                  title: item?.session?.title,
                  seriesNumber: item?.sessionNumber || item?.session?.seriesNumber,
                })))
              );
              setSeriesData(result);
              setData(null);
              setSelectedSeriesTab(0);
              recordSessionComboUsage(config);
              setShowRecommendations(false);
              setRecommendations([]);
              // Series is auto-saved to vault now
              setSeriesSavedToVault(true);
            } else {
              console.error("[SESSION_PAGE] Invalid progressive series response:", result);
              throw new Error(result.message || "No sessions were generated in the series. Please try again.");
            }
          })
          .catch((e) => {
            if (isAbortError(e)) {
              return;
            }
            const errorMsg = e?.message || String(e);
            const isBackgroundGeneration = /interrupted|timeout|timed out|503|504/i.test(errorMsg);
            if (isBackgroundGeneration) {
              console.warn("[SESSION_PAGE] Progressive series still generating in background:", errorMsg);
            } else {
              console.error("[SESSION_PAGE] Progressive series error:", e);
            }
            // If it's a timeout/connection error, start polling for the series
            if (isBackgroundGeneration) {
              setError(
                "GENERATION_IN_PROGRESS: The connection timed out, but your sessions are being generated in the background. " +
                "Checking the Vault for your series..."
              );
              // Start polling for the created series
              setPendingSeriesCheck({
                startTime: generationStartTime,
                expectedCount: numberOfSessions,
                config,
              });
              pendingSeriesIdRef.current = null;
            } else {
              setError(errorMsg);
            }
            setSeriesData(null);
            setData(null);
            setShowRecommendations(false);
            setRecommendations([]);
          })
          .finally(() => {
            clearGenerationAbortController(controller);
            generationIdRef.current = null;
            activeSeriesGenerationRef.current = null;
            pendingSeriesIdRef.current = null;
            setLoading(false);
            setProgressInfo(null);
            setLiveSeriesSessions([]);
          });
      } else {
        const controller = startGenerationAbortController();
        const generationId = createGenerationId();
        generationIdRef.current = generationId;
        setProgressInfo({ isSeries: false });
        fetchSession(config, skipRecommendation, controller.signal, generationId)
          .then((result) => {
            // Check if we got recommendations (only if not auto-generating)
            if (!autoGenerate && result.hasRecommendations && result.recommendations) {
              setRecommendations(result.recommendations);
              setShowRecommendations(true);
              setData(null);
              setSeriesData(null);
            } else {
              setData(result);
              setSkillFocus(result.session?.skillFocus || null);
              recordSessionComboUsage(config);
              setSeriesData(null);
              setShowRecommendations(false);
              setRecommendations([]);
            }
          })
          .catch((e) => {
            if (isAbortError(e)) {
              return;
            }
            setError(e?.message || String(e));
            setData(null);
            setSeriesData(null);
            setShowRecommendations(false);
          })
          .finally(() => {
            clearGenerationAbortController(controller);
            generationIdRef.current = null;
            setLoading(false);
            setProgressInfo(null);
            setLiveSeriesSessions([]);
          });
      }
    } else {
      setData(null);
      setSeriesData(null);
      setLiveSeriesSessions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsString]);

  // Poll for series that were being generated when connection timed out
  useEffect(() => {
    if (!pendingSeriesCheck) return;
    
    const { startTime, expectedCount, config } = pendingSeriesCheck;
    let pollCount = 0;
    const maxPolls = 30; // Poll for up to 5 minutes (10s intervals)
    
    const pollForSeries = async () => {
      setCheckingForSeries(true);
      try {
        // Query vault for sessions created after startTime with matching parameters
        const res = await fetch("/api/vault/sessions?excludeSeries=false", {
          headers: getClientAuthHeaders(),
        });
        if (!res.ok) {
          const vaultError = await res.text().catch(() => "");
          console.warn(`[POLL] Vault check unavailable (${res.status})`, vaultError || res.statusText);
          setError(
            "GENERATION_IN_PROGRESS: Sessions are still being generated. " +
            "Vault status is temporarily unavailable, but we will keep checking automatically."
          );
          setCheckingForSeries(false);
          return false;
        }
        const data = await res.json();
        
        if (data.ok && data.sessions) {
          // Find sessions created after our start time with matching parameters
          const matchingSessions = getMatchingSeriesSessions(data.sessions, startTime, config);
          const picked = pickActiveSeriesSessions(matchingSessions, pendingSeriesIdRef.current);
          pendingSeriesIdRef.current = picked.seriesId;
          const activeSessions = picked.sessions;
          setLiveSeriesSessions(mapSeriesSessionsForProgress(activeSessions));
          
          console.log("[POLL] Found matching sessions:", activeSessions.length, "expected:", expectedCount);
          
          if (activeSessions.length >= expectedCount) {
            // Found all sessions!
            setFoundPendingSeries(activeSessions.slice(0, expectedCount));
            setPendingSeriesCheck(null);
            setCheckingForSeries(false);
            setError(
              `SERIES_FOUND: Your ${expectedCount}-session series has been created successfully!`
            );
            return true; // Stop polling
          }
          
          if (activeSessions.length > 0) {
            // Found some sessions, update the message
            setError(
              `GENERATION_IN_PROGRESS: Found ${activeSessions.length}/${expectedCount} sessions so far. Still generating...`
            );
          }
        }
      } catch (err: any) {
        console.warn("[POLL] Error checking vault, will retry:", err?.message || String(err));
        setError(
          "GENERATION_IN_PROGRESS: Sessions are still being generated. " +
          "Could not reach Vault just now, retrying automatically."
        );
      }
      setCheckingForSeries(false);
      return false; // Continue polling
    };
    
    // Initial poll
    pollForSeries();
    
    // Set up interval polling
    const intervalId = setInterval(async () => {
      pollCount++;
      if (pollCount >= maxPolls) {
        clearInterval(intervalId);
        setPendingSeriesCheck(null);
        setCheckingForSeries(false);
        setError(
          "GENERATION_IN_PROGRESS: Generation is taking longer than expected. " +
          "Please check the Vault manually - your sessions may still appear."
        );
        return;
      }
      
      const found = await pollForSeries();
      if (found) {
        clearInterval(intervalId);
      }
    }, 10000); // Poll every 10 seconds
    
    return () => clearInterval(intervalId);
  // Intentionally keyed by pendingSeriesCheck only; helper callbacks are stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSeriesCheck]);

  // Update the series progress graphic using sessions already persisted to Vault.
  useEffect(() => {
    if (!loading || !progressInfo?.isSeries || !progressInfo.totalSessions) return;
    if (!activeSeriesGenerationRef.current) return;

    const syncProgress = async () => {
      const activeGeneration = activeSeriesGenerationRef.current;
      if (!activeGeneration) return;
      try {
        const res = await fetch("/api/vault/sessions?excludeSeries=false", {
          headers: getClientAuthHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.ok || !Array.isArray(data.sessions)) return;
        const matchingSessions = getMatchingSeriesSessions(
          data.sessions,
          activeGeneration.startTime,
          activeGeneration.config
        );
        const picked = pickActiveSeriesSessions(matchingSessions, activeGeneration.seriesId);
        if (activeSeriesGenerationRef.current) {
          activeSeriesGenerationRef.current.seriesId = picked.seriesId;
        }
        const activeSessions = picked.sessions;
        setLiveSeriesSessions(mapSeriesSessionsForProgress(activeSessions));
        const completedCount = activeSessions.length;
        setProgressInfo((prev) => {
          if (!prev?.isSeries || !prev.totalSessions) return prev;
          const nextCurrent = Math.min(prev.totalSessions, Math.max(1, completedCount + 1));
          if (prev.currentSession === nextCurrent) return prev;
          return {
            ...prev,
            currentSession: nextCurrent,
          };
        });
      } catch {
        // Best effort only.
      }
    };

    void syncProgress();
    const intervalId = setInterval(() => {
      void syncProgress();
    }, 7000);

    return () => clearInterval(intervalId);
  // Intentionally keyed by generation/loading state; helper callbacks are stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, progressInfo?.isSeries, progressInfo?.totalSessions]);

  // Get current session (single mode or selected tab from series)
  const seriesList = seriesData?.series ?? [];
  const currentSeriesItem =
    sessionMode === "series" && seriesList.length
      ? seriesList[Math.min(selectedSeriesTab, seriesList.length - 1)]
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
            raw: currentSeriesItem as any,
          }
        : null;
  const hasGeneratedSession = Boolean(
    currentSessionData?.ok || (seriesData?.ok && seriesList.length > 0)
  );

  useEffect(() => {
    if (hasGeneratedSession) {
      setSettingsOpen(false);
    }
  }, [hasGeneratedSession]);

  const session = currentSessionData?.session;
  const qaScores = (currentSessionData?.qa?.scores || {}) as Record<string, number>;
  const qaPass = currentSessionData?.qa?.pass;
  const resolvedSessionId = (() => {
    const direct = session?.id;
    if (typeof direct === "string") {
      const trimmed = direct.trim();
      if (trimmed && trimmed !== "undefined" && trimmed !== "null") {
        return trimmed;
      }
    }
    const rawId = (currentSessionData as any)?.raw?.created?.id as string | undefined;
    if (typeof rawId === "string") {
      const trimmed = rawId.trim();
      if (trimmed && trimmed !== "undefined" && trimmed !== "null") {
        return trimmed;
      }
    }
    const fallback = currentSeriesItem?.id;
    if (typeof fallback === "string") {
      const trimmed = fallback.trim();
      if (trimmed && trimmed !== "undefined" && trimmed !== "null") {
        return trimmed;
      }
    }
    return undefined;
  })();

  // Check vault status when session changes
  useEffect(() => {
    if (resolvedSessionId) {
      checkVaultStatus(resolvedSessionId);
    } else {
      setSavedToVault(false);
    }
  }, [resolvedSessionId]);

  async function checkVaultStatus(sessionId: string) {
    setCheckingVaultStatus(true);
    try {
      const headers: Record<string, string> = {
        ...(getUserHeaders() as Record<string, string>),
      };
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
      const res = await fetch(`/api/vault/sessions/${encodeURIComponent(sessionId)}/status`, {
        headers,
      });
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

  // Check if session is favorited
  useEffect(() => {
    if (resolvedSessionId) {
      checkFavoriteStatus(resolvedSessionId);
    } else {
      setIsFavorited(false);
    }
  }, [resolvedSessionId]);

  useEffect(() => {
    if (!userFeatures?.canCreatePlayerPlans) {
      setSessionPlayerPlan(null);
      return;
    }
    if (!resolvedSessionId) {
      setSessionPlayerPlan(null);
      return;
    }

    let mounted = true;
    setCheckingPlayerPlan(true);
    fetchPlayerPlanForSessionId(resolvedSessionId)
      .then((plan) => {
        if (mounted) setSessionPlayerPlan(plan);
      })
      .catch(() => {
        if (mounted) setSessionPlayerPlan(null);
      })
      .finally(() => {
        if (mounted) setCheckingPlayerPlan(false);
      });

    return () => {
      mounted = false;
    };
  }, [resolvedSessionId, userFeatures?.canCreatePlayerPlans]);

  async function checkFavoriteStatus(sessionId: string) {
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getUserHeaders(),
        },
        body: JSON.stringify({ sessionIds: [sessionId] }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsFavorited(data.sessions?.[sessionId] || false);
      }
    } catch (e) {
      console.error("[FAVORITES] Error checking status:", e);
    }
  }

  async function toggleFavorite() {
    if (!resolvedSessionId) return;
    
    try {
      const res = await fetch(`/api/favorites/session/${resolvedSessionId}`, {
        method: isFavorited ? "DELETE" : "POST",
        headers: getUserHeaders(),
      });
      
      if (res.ok) {
        setIsFavorited(!isFavorited);
      }
    } catch (e) {
      console.error("[FAVORITES] Error toggling:", e);
    }
  }

  const gmText = session ? (gameModelLabel[session.gameModelId] ?? session.gameModelId) : "";
  const phaseText = session?.phase
    ? phaseLabel[session.phase] ?? session.phase.toLowerCase().replace(/_/g, " ")
    : "N/A";
  const zoneText = session?.zone
    ? zoneLabel[session.zone] ?? session.zone.toLowerCase().replace(/_/g, " ")
    : "N/A";
  const coachLevelText = session?.coachLevel
    ? coachLevelLabel[session.coachLevel] ?? session.coachLevel
    : config?.coachLevel
    ? coachLevelLabel[config.coachLevel] ?? config.coachLevel
    : "N/A";
  const currentCoachLevelKey = normalizeCoachLevel(session?.coachLevel || config?.coachLevel);
  const languageLevelBadge = getLanguageLevelBadge(currentCoachLevelKey);

  const buildRegenerateConfigForLevel = (targetCoachLevel: string): SessionConfig => ({
    ...config,
    gameModelId: session?.gameModelId || config.gameModelId,
    ageGroup: session?.ageGroup || config.ageGroup,
    phase: session?.phase || config.phase,
    zone: session?.zone || config.zone,
    durationMin: session?.durationMin || config.durationMin,
    coachLevel: normalizeCoachLevel(targetCoachLevel),
  });

  const getCoachVariantBaseKey = (cfg: SessionConfig): string =>
    JSON.stringify({
      gameModelId: cfg.gameModelId,
      ageGroup: cfg.ageGroup,
      phase: cfg.phase,
      zone: cfg.zone,
      topic: cfg.topic,
      formationAttacking: cfg.formationAttacking,
      formationDefending: cfg.formationDefending,
      playerLevel: cfg.playerLevel,
      numbersMin: cfg.numbersMin,
      numbersMax: cfg.numbersMax,
      goalsAvailable: cfg.goalsAvailable,
      spaceConstraint: cfg.spaceConstraint,
      durationMin: cfg.durationMin,
    });

  const getCoachVariantCacheKey = (cfg: SessionConfig, coachLevel: string): string =>
    `${getCoachVariantBaseKey(cfg)}|${normalizeCoachLevel(coachLevel)}`;

  const getAvailableCoachLevelKeys = (): string[] => {
    const allLevels = coachLevelOptions.map((o) => o.key);
    const baseConfig = buildRegenerateConfigForLevel(currentCoachLevelKey || config.coachLevel);
    return allLevels.filter((level) =>
      Boolean(coachLevelSessionCache[getCoachVariantCacheKey(baseConfig, level)])
    );
  };

  useEffect(() => {
    if (!data?.session) return;
    const level = normalizeCoachLevel(data.session.coachLevel || config.coachLevel);
    if (!level) return;
    const cfg = buildRegenerateConfigForLevel(level);
    const cacheKey = getCoachVariantCacheKey(cfg, level);
    setCoachLevelSessionCache((prev) => (prev[cacheKey] ? prev : { ...prev, [cacheKey]: data }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.session?.id]);

  const runCoachLevelRegeneration = async (nextLevel: string) => {
    const regenerateConfig = buildRegenerateConfigForLevel(nextLevel);
    const cacheKey = getCoachVariantCacheKey(regenerateConfig, nextLevel);

    try {
      const controller = startGenerationAbortController();
      const generationId = createGenerationId();
      generationIdRef.current = generationId;
      setRegeneratingCoachLevel(nextLevel);
      setLoading(true);
      setProgressInfo({ isSeries: false });
      setError(null);
      setShowRecommendations(false);
      setRecommendations([]);

      const result = await fetchSession(regenerateConfig, true, controller.signal, generationId);
      const nextVariant: SessionApiResponse = {
        ...result,
        session: {
          ...result.session,
          coachLevel: result.session?.coachLevel || nextLevel,
        },
      };
      setData(nextVariant);
      setCoachLevelSessionCache((prev) => ({ ...prev, [cacheKey]: nextVariant }));
      setSeriesData(null);
      setSessionMode("single");
      setSkillFocus(result.session?.skillFocus || null);
      recordSessionComboUsage(regenerateConfig);
    } catch (e: any) {
      if (isAbortError(e)) {
        return;
      }
      setError(e?.message || String(e));
      setData(null);
      setSeriesData(null);
    } finally {
      clearGenerationAbortController();
      generationIdRef.current = null;
      setRegeneratingCoachLevel(null);
      setLoading(false);
      setProgressInfo(null);
    }
  };

  const regenerateForCoachLevel = async (nextCoachLevel: string) => {
    if (loading) return;

    const nextLevel = normalizeCoachLevel(nextCoachLevel);
    if (!nextLevel || nextLevel === currentCoachLevelKey) return;

    const regenerateConfig = buildRegenerateConfigForLevel(nextLevel);
    const cacheKey = getCoachVariantCacheKey(regenerateConfig, nextLevel);
    const cachedVariant = coachLevelSessionCache[cacheKey];
    if (cachedVariant?.session) {
      setData(cachedVariant);
      setSeriesData(null);
      setSessionMode("single");
      setSkillFocus(cachedVariant.session?.skillFocus || null);
      return;
    }

    setConfirmCoachLevelModal({ open: true, level: nextLevel });
  };

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
    const sessionId = resolvedSessionId;
    if (!sessionId) {
      setSkillFocus(null);
      return;
    }
    fetchSkillFocusForSessionId(sessionId)
      .then((focus) => setSkillFocus(focus))
      .catch(() => setSkillFocus(null));
  }, [resolvedSessionId]);

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
      {showProgressDialog && (
        <SessionProgress
          isSeries={progressIsSeries}
          totalSessions={progressTotalSessions}
          currentSession={progressCurrentSession}
          readySeriesSessions={liveSeriesSessions}
          onCancel={cancelGeneration}
        />
      )}
      <ThemedConfirmModal
        open={confirmCoachLevelModal.open}
        title="Generate Coach-Level Version"
        message={`Generate a new ${
          coachLevelLabel[confirmCoachLevelModal.level || ""] || confirmCoachLevelModal.level || "coach-level"
        } version for this session context?`}
        confirmLabel="Generate"
        cancelLabel="Cancel"
        onCancel={() => setConfirmCoachLevelModal({ open: false, level: null })}
        onConfirm={() => {
          const level = confirmCoachLevelModal.level;
          setConfirmCoachLevelModal({ open: false, level: null });
          if (level) {
            void runCoachLevelRegeneration(level);
          }
        }}
      />
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">
            TacticalEdge Session Generator
          </h1>
          <p className="text-sm text-slate-400">
            {currentSessionData?.ok || (seriesData?.ok && seriesList.length > 0)
              ? <>Showing generated session based on your selected inputs.
                {seriesData?.metadata?.totalSessions
                  ? ` • ${seriesData.metadata.totalSessions}-session progressive series`
                  : ""}
              </>
              : <>Configure your settings below and click <span className="text-emerald-300 font-medium">Generate Session</span> to create a new training session.</>
            }
          </p>
        </header>

        {/* Generator settings card */}
        <details
          className="collapsible-card rounded-3xl border border-slate-700/70 bg-slate-900/70 overflow-hidden"
          open={settingsOpen}
          onToggle={(e) => setSettingsOpen(e.currentTarget.open)}
        >
          <summary className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-800/30 transition-colors">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">
                Generator Settings
              </h2>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Configure context → Generate session → Review all drills.
              </span>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chevron-icon h-4 w-4 shrink-0 text-slate-400">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <div className="px-6 pb-5 pt-1 space-y-4 border-t border-slate-800/50">

          <SessionForm>
            <SessionFormWithLoading>
              <div className="space-y-5 text-[11px] sm:text-xs text-slate-200">
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                    Core Generation Settings
                  </div>
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9">
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
                        <option value="ROCKLIN_FC">Rocklin FC</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                        Phase
                      </label>
                      <select
                        name="phase"
                        id="phase"
                        defaultValue={config.phase}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                      >
                        <option value="ATTACKING">Attacking</option>
                        <option value="DEFENDING">Defending</option>
                        <option value="TRANSITION">Transition</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                        Where (zone)
                      </label>
                      <select
                        name="zone"
                        id="zone"
                        defaultValue={config.zone}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                      >
                        <option value="DEFENSIVE_THIRD">Defensive third</option>
                        <option value="MIDDLE_THIRD">Middle third</option>
                        <option value="ATTACKING_THIRD">Attacking third</option>
                      </select>
                    </div>

                    <div className="space-y-1 xl:col-span-2">
                      <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                        Topic
                      </label>
                      <TopicSelect
                        key={`${config.phase}-${config.zone}-${config.coachLevel}`}
                        phase={config.phase as Phase}
                        zone={config.zone as Zone}
                        coachLevel={config.coachLevel}
                        defaultValue={config.topic}
                        name="topic"
                        id="topic"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                      />
                    </div>

                    <div className="space-y-1 xl:max-w-[110px]">
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
                    <div className="space-y-1">
                      <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                        Coach Level
                      </label>
                      <select
                        name="coachLevel"
                        id="coachLevel"
                        defaultValue={config.coachLevel}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                      >
                        <option value="GRASSROOTS">Grassroots</option>
                        <option value="USSF_C">USSF C</option>
                        <option value="USSF_B_PLUS">USSF B+</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block uppercase tracking-wide text-[10px] text-slate-400">
                        Player Level
                      </label>
                      <select
                        name="playerLevel"
                        id="playerLevel"
                        defaultValue={config.playerLevel}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
                      >
                        <option value="BEGINNER">Beginner</option>
                        <option value="INTERMEDIATE">Intermediate</option>
                        <option value="ADVANCED">Advanced</option>
                      </select>
                      <p id="playerLevelGuardrailHint" className="min-h-[14px] text-[10px] text-amber-300" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 space-y-3 text-slate-300">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Optional Fine-Tuning (Lower Weight)
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-1">
                      <label className="block uppercase tracking-wide text-[10px] text-slate-500">
                        Attacking Formation
                      </label>
                      <FormationSelect
                        ageGroup={config.ageGroup}
                        defaultValue={config.formationAttacking}
                        name="formationAttacking"
                        id="formationAttacking"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-[11px] text-slate-300"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block uppercase tracking-wide text-[10px] text-slate-500">
                        Defending Formation
                      </label>
                      <FormationSelect
                        ageGroup={config.ageGroup}
                        defaultValue={config.formationDefending}
                        name="formationDefending"
                        id="formationDefending"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-[11px] text-slate-300"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block uppercase tracking-wide text-[10px] text-slate-500">
                        Space constraint
                      </label>
                      <select
                        name="spaceConstraint"
                        defaultValue={config.spaceConstraint}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-[11px] text-slate-300"
                      >
                        <option value="FULL">Full pitch</option>
                        <option value="HALF">Half pitch</option>
                        <option value="THIRD">Third</option>
                        <option value="QUARTER">Quarter</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block uppercase tracking-wide text-[10px] text-slate-500">
                        Goals available
                      </label>
                      <input
                        type="number"
                        name="goalsAvailable"
                        defaultValue={config.goalsAvailable}
                        min={0}
                        max={4}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-[11px] text-slate-300"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block uppercase tracking-wide text-[10px] text-slate-500">
                        Players (min-max)
                      </label>
                      <PlayerCountInputs
                        minDefault={config.numbersMin}
                        maxDefault={config.numbersMax}
                      />
                    </div>
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
                  <div
                    className="space-y-1 w-full sm:max-w-[180px]"
                    id="seriesCountContainer"
                    style={{ display: hasParams && searchParams.get("series") === "true" ? "block" : "none" }}
                  >
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

          </div>
        </details>

        {/* Loading state */}
        {loading && !progressInfo && (
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
                    setLiveSeriesSessions([]);
                    const controller = startGenerationAbortController();
                    generationIdRef.current = createGenerationId();
                    const generationStartTime = Date.now();
                    activeSeriesGenerationRef.current = {
                      startTime: generationStartTime,
                      config,
                      seriesId: null,
                    };
                    fetchProgressiveSeries(config, numberOfSessions, true, controller.signal)
                      .then((result) => {
                        if (result.series && Array.isArray(result.series) && result.series.length > 0) {
                          setLiveSeriesSessions(
                            mapSeriesSessionsForProgress(result.series.map((item: any) => ({
                              id: item?.id || item?.session?.id,
                              title: item?.session?.title,
                              seriesNumber: item?.sessionNumber || item?.session?.seriesNumber,
                            })))
                          );
                          setSeriesData(result);
                          setData(null);
                          setSelectedSeriesTab(0);
                          // Series is auto-saved to vault now
                          setSeriesSavedToVault(true);
                        } else {
                          throw new Error("No sessions were generated in the series");
                        }
                      })
                      .catch((e) => {
                        if (isAbortError(e)) {
                          return;
                        }
                        const errorMsg = e?.message || String(e);
                        const isBackgroundGeneration = /interrupted|timeout|timed out|503|504/i.test(errorMsg);
                        if (isBackgroundGeneration) {
                          setError(
                            "GENERATION_IN_PROGRESS: The connection timed out, but your sessions are being generated in the background. " +
                            "Checking the Vault for your series..."
                          );
                          setPendingSeriesCheck({
                            startTime: generationStartTime,
                            expectedCount: numberOfSessions,
                            config,
                          });
                        } else {
                          setError(errorMsg);
                        }
                        setSeriesData(null);
                        setData(null);
                        setShowRecommendations(false);
                        setRecommendations([]);
                      })
                      .finally(() => {
                        clearGenerationAbortController(controller);
                        generationIdRef.current = null;
                        activeSeriesGenerationRef.current = null;
                        setLoading(false);
                        setProgressInfo(null);
                        setLiveSeriesSessions([]);
                      });
                  } else {
                    // Generate single session with skipRecommendation
                    setProgressInfo({ isSeries: false });
                    setLiveSeriesSessions([]);
                    const controller = startGenerationAbortController();
                    const generationId = createGenerationId();
                    generationIdRef.current = generationId;
                    fetchSession(config, true, controller.signal, generationId)
                      .then((result) => {
                        setData(result);
                        setSeriesData(null);
                      })
                      .catch((e) => {
                        if (isAbortError(e)) {
                          return;
                        }
                        setError(e?.message || String(e));
                        setData(null);
                      })
                      .finally(() => {
                        clearGenerationAbortController(controller);
                        generationIdRef.current = null;
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
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setLoading(true);
                            setShowRecommendations(false);

                            const source = rec.session;
                            if (!source) {
                              alert("Recommended session data is missing.");
                              setLoading(false);
                              return;
                            }

                            const sessionData = source.json || {};
                            const qaFromJson = sessionData.qa || {};
                            const qaData = {
                              pass: source.approved || qaFromJson.pass || false,
                              summary: qaFromJson.summary,
                              scores: qaFromJson.scores || {},
                            };

                            setData({
                              ok: true,
                              session: {
                                id: source.id,
                                title: source.title,
                                gameModelId: source.gameModelId,
                                phase: source.phase,
                                zone: source.zone,
                                ageGroup: source.ageGroup,
                                durationMin: source.durationMin,
                                summary: sessionData.summary,
                                drills: sessionData.drills || [],
                                sessionPlan: sessionData.sessionPlan,
                                equipment: sessionData.equipment,
                                coachingNotes: sessionData.coachingNotes,
                                principleIds: Array.isArray(source.principleIds) ? source.principleIds : [],
                                psychThemeIds: Array.isArray(source.psychThemeIds) ? source.psychThemeIds : [],
                              },
                              qa: qaData,
                            });
                            setSkillFocus(sessionData.skillFocus || null);
                            setSeriesData(null);
                            setSessionMode("single");
                            setSavedToVault(!!source.savedToVault);
                          } catch (e: any) {
                            console.error("[RECOMMENDATION_VIEW] Error loading recommended session:", e);
                            alert(`Error loading recommended session: ${e?.message || String(e)}`);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="inline-flex items-center rounded-full bg-blue-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-blue-400"
                      >
                        View
                      </button>
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
          <div className={`rounded-3xl border px-6 py-5 ${
            error.startsWith("SERIES_FOUND:")
              ? "border-emerald-600/70 bg-emerald-900/20"
              : error.startsWith("GENERATION_IN_PROGRESS:")
              ? "border-amber-600/70 bg-amber-900/20"
              : "border-red-700/70 bg-red-900/20"
          }`}>
            {error.startsWith("SERIES_FOUND:") && foundPendingSeries ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="text-sm font-medium text-emerald-200">
                      Series Created Successfully!
                    </p>
                    <p className="text-sm text-emerald-300/80 mt-1">
                      {error.replace("SERIES_FOUND: ", "")}
                    </p>
                  </div>
                </div>
                {/* Show the created sessions */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {foundPendingSeries.map((session, idx) => (
                    <div
                      key={session.id}
                      className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-4"
                    >
                      <p className="text-xs text-emerald-400 mb-1">Session {idx + 1}</p>
                      <h4 className="text-sm font-medium text-emerald-100 line-clamp-2">
                        {session.title}
                      </h4>
                      <p className="text-xs text-emerald-300/70 mt-2">
                        {session.ageGroup} • {(phaseLabel[session.phase] ?? String(session.phase).toLowerCase().replace(/_/g, " "))} • {session.durationMin} min
                      </p>
                      <Link
                        href={`/demo/session?sessionId=${session.id}`}
                        className="inline-flex items-center mt-3 text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        View Session →
                      </Link>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 pt-2">
                  <Link
                    href="/vault"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <span>🗂️</span>
                    View in Vault
                  </Link>
                  <button
                    onClick={() => {
                      setError(null);
                      setFoundPendingSeries(null);
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : error.startsWith("GENERATION_IN_PROGRESS:") ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  {checkingForSeries ? (
                    <span className="text-2xl animate-spin">🔄</span>
                  ) : (
                    <span className="text-2xl">⏳</span>
                  )}
                  <div>
                    <p className="text-sm font-medium text-amber-200">
                      {checkingForSeries ? "Checking for your sessions..." : "Sessions are being generated..."}
                    </p>
                    <p className="text-sm text-amber-300/80 mt-1">
                      {error.replace("GENERATION_IN_PROGRESS: ", "")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/vault"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <span>🗂️</span>
                    Check Vault
                  </Link>
                  <button
                    onClick={() => {
                      setError(null);
                      setPendingSeriesCheck(null);
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-300">
                Failed to fetch session from TacticalEdge API: {error}
              </p>
            )}
          </div>
        )}

        {/* Empty state — no session generated yet */}
        {!loading && !error && !currentSessionData?.ok && !(seriesData?.ok && seriesList.length > 0) && !showRecommendations && (
          <section className="rounded-3xl border border-dashed border-slate-700/70 bg-slate-900/30 px-6 py-16 text-center">
            <div className="mx-auto max-w-sm space-y-3">
              <svg viewBox="0 0 24 24" className="mx-auto h-10 w-10 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="4" y="4" width="16" height="16" rx="2.5" />
                <path d="M8 9.5h8M8 13h8M8 16.5h5" />
              </svg>
              <h3 className="text-sm font-semibold text-slate-300">No session generated yet</h3>
              <p className="text-xs text-slate-500">
                Choose your settings above and click <span className="text-emerald-400 font-medium">Generate Session</span> to create a full training session with drills, diagrams, and coaching points.
              </p>
            </div>
          </section>
        )}

        {/* Series Tabs (if series mode) */}
        {!loading && seriesData?.ok && seriesList.length > 0 && (
          <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 px-6 py-5">
            {(() => {
              // Build descriptive series title from first session
              const firstSession = seriesList[0]?.session;
              const sessionCount = seriesData.metadata?.totalSessions || seriesList.length;
              const ageGroup = firstSession?.ageGroup || seriesData.metadata?.ageGroup;
              const zone = firstSession?.zone;
              
              // Map phase to readable name
              const phaseNames: Record<string, string> = {
                ATTACKING: "Attacking",
                DEFENDING: "Defending",
                TRANSITION_ATT_DEF: "Att→Def Transition",
                TRANSITION_DEF_ATT: "Def→Att Transition",
              };
              const phaseName = firstSession?.phase ? phaseNames[firstSession.phase] || "" : "";
              
              // Build unique descriptive series title from first session
              let seriesTitle: string;
              if (firstSession?.title) {
                // Clean up the first session title to use as series title
                let baseTitle = firstSession.title
                  .replace(/^(Session \d+:?\s*)/i, "") // Remove "Session 1:" prefix
                  .replace(/\s*-\s*Part\s*\d+/i, "")   // Remove "- Part 1" suffix
                  .trim();
                
                // If title is too long, truncate intelligently
                if (baseTitle.length > 55) {
                  // Try to cut at a natural break point
                  const breakPoints = [" - ", ": ", " and ", " & "];
                  for (const bp of breakPoints) {
                    const idx = baseTitle.indexOf(bp);
                    if (idx > 15 && idx < 55) {
                      baseTitle = baseTitle.substring(0, idx);
                      break;
                    }
                  }
                  if (baseTitle.length > 55) {
                    baseTitle = baseTitle.substring(0, 52) + "...";
                  }
                }
                
                seriesTitle = baseTitle;
              } else {
                seriesTitle = `${sessionCount}-Session Progressive Training`;
              }
              
              return (
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {seriesTitle}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {sessionCount} Sessions {ageGroup ? `• ${ageGroup}` : ""} {phaseName ? `• ${phaseName}` : ""} {zone ? `• ${zone}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    try {
                      setGeneratingSeriesSkillFocus(true);
                      // Handle both formats: s.session?.id (from vault) or s.id (from generation)
                      const sessionIds = seriesList.map(s => s.session?.id || s.id).filter(Boolean) as string[];
                      if (sessionIds.length === 0) {
                        alert("Cannot generate focus: Sessions don't have IDs yet");
                        setGeneratingSeriesSkillFocus(false);
                        return;
                      }
                      const focus = await generateSkillFocusForSeries({ sessionIds });
                      setSeriesSkillFocus(focus);
                    } catch (e: any) {
                      alert("Error generating series coaching emphasis: " + e.message);
                    } finally {
                      setGeneratingSeriesSkillFocus(false);
                    }
                  }}
                  disabled={generatingSeriesSkillFocus}
                  className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    seriesSkillFocus
                      ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                      : "border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {generatingSeriesSkillFocus
                    ? "⚡ Generating Focus..."
                    : seriesSkillFocus
                    ? "✓ Series Coaching Emphasis"
                    : "🎯 Series Coaching Emphasis"}
                </button>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 text-sm font-medium">
                  <span>✓</span>
                  <span>Auto-saved to Vault</span>
                </span>
                <Link
                  href="/vault"
                  className="inline-flex items-center rounded-full border border-slate-600/50 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700/50 transition-all"
                >
                  📂 View in Vault
                </Link>
                  </div>
                </div>
              );
            })()}
            {seriesSkillFocus && (
              <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="text-xs text-emerald-300 uppercase tracking-widest">Series Coaching Emphasis</div>
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
                {(Array.isArray(seriesSkillFocus.psychology?.good) || Array.isArray(seriesSkillFocus.psychology?.bad)) && (
                  <div className="mt-3">
                    <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Psychological Watch</div>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      {Array.isArray(seriesSkillFocus.psychology?.good) && seriesSkillFocus.psychology?.good?.length > 0 && (
                        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
                          <div className="text-[11px] uppercase tracking-widest text-emerald-200/80">Encourage</div>
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-emerald-100/80">
                            {seriesSkillFocus.psychology?.good?.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(seriesSkillFocus.psychology?.bad) && seriesSkillFocus.psychology?.bad?.length > 0 && (
                        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3">
                          <div className="text-[11px] uppercase tracking-widest text-rose-200/80">Correct</div>
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-rose-100/80">
                            {seriesSkillFocus.psychology?.bad?.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {seriesSkillFocus.sectionPhrases && (() => {
                  const allEncourage: string[] = [];
                  const allCorrect: string[] = [];
                  Object.values(seriesSkillFocus.sectionPhrases).forEach((phrases: any) => {
                    if (Array.isArray(phrases?.encourage)) allEncourage.push(...phrases.encourage);
                    if (Array.isArray(phrases?.correct)) allCorrect.push(...phrases.correct);
                  });
                  if (allEncourage.length === 0 && allCorrect.length === 0) return null;
                  return (
                    <div className="mt-4">
                      <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Coaching phrases</div>
                      <div className="mt-2 grid gap-4 md:grid-cols-2">
                        {allEncourage.length > 0 && (
                          <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
                            <div className="text-[10px] uppercase tracking-widest text-emerald-200/70">Encourage</div>
                            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-emerald-100/90">
                              {allEncourage.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {allCorrect.length > 0 && (
                          <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
                            <div className="text-[10px] uppercase tracking-widest text-rose-200/70">Correct</div>
                            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-rose-100/90">
                              {allCorrect.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="flex gap-2 border-b border-slate-700/70 -mx-6 px-6 pb-4">
              {seriesList.map((seriesItem, index) => (
                <button
                  key={seriesItem.session?.id || `session-${index}`}
                  onClick={() => setSelectedSeriesTab(index)}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                    selectedSeriesTab === index
                      ? "bg-slate-800 text-emerald-400 border-b-2 border-emerald-400"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <span>Session {seriesItem.sessionNumber || index + 1}</span>
                  {(seriesItem.refCode || seriesItem.session?.refCode) && (
                    <span className="ml-2 text-xs font-mono text-cyan-400">
                      {seriesItem.refCode || seriesItem.session?.refCode}
                    </span>
                  )}
                  {(() => {
                    const badge = getLanguageLevelBadge(seriesItem.session?.coachLevel || config.coachLevel);
                    return (
                      <span
                        className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                      >
                        {badge.label.replace("Language: ", "")}
                      </span>
                    );
                  })()}
                  {seriesItem.qaScore && (
                    <span className="ml-2 text-xs opacity-60">
                      QA: {seriesItem.qaScore.toFixed(1)}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <p className="text-xs text-slate-400">
                {seriesList[selectedSeriesTab]?.session.summary || "Progressive training series"}
              </p>
            </div>
          </section>
        )}

        {/* Session Results */}
        {!loading && currentSessionData?.ok && session?.drills && session.drills.length > 0 && (
          <>
            {/* Session Overview */}
            <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 px-6 py-5 space-y-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold leading-tight">{session.title}</h2>
                      {session.refCode && (
                        <button
                          onClick={() => navigator.clipboard.writeText(session.refCode!)}
                          className="px-2 py-1 rounded bg-cyan-900/40 text-cyan-300 text-xs font-mono border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors"
                          title="Click to copy reference code"
                        >
                          {session.refCode}
                        </button>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${languageLevelBadge.className}`}
                      >
                        {languageLevelBadge.label}
                      </span>
                    </div>
                    {session.creator && (
                      <div className="text-xs text-slate-400">
                        Created by: <span className="text-slate-300">{session.creator.name || session.creator.email || "Unknown"}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 text-xs font-medium">
                      <span>✓</span>
                      <span>In Vault</span>
                    </span>
                    <button
                      onClick={toggleFavorite}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        isFavorited
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                          : "bg-slate-700/50 text-slate-400 border border-slate-600/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                      }`}
                      title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                    >
                      <span className="text-xs font-bold">■</span>
                      <span>{isFavorited ? "Favorited" : "Favorite"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                  <div className="rounded-full border border-slate-700/70 bg-slate-800/60 px-3 py-1 text-slate-300">
                    <span className="text-slate-400">Game Model: </span>
                    <span className="font-semibold">{gmText}</span>
                  </div>
                  {session.phase && (
                    <div className="rounded-full border border-slate-700/70 bg-slate-800/60 px-3 py-1 text-slate-300">
                      <span className="text-slate-400">Phase: </span>
                      <span className="font-semibold">{phaseText}</span>
                    </div>
                  )}
                  {session.zone && (
                    <div className="rounded-full border border-slate-700/70 bg-slate-800/60 px-3 py-1 text-slate-300">
                      <span className="text-slate-400">Zone: </span>
                      <span className="font-semibold">{zoneText}</span>
                    </div>
                  )}
                  <div className="rounded-full border border-slate-700/70 bg-slate-800/60 px-3 py-1 text-slate-300">
                    <span className="text-slate-400">Coach Level: </span>
                    <span className="font-semibold">{coachLevelText}</span>
                  </div>
                  <div className="rounded-full border border-slate-700/70 bg-slate-800/60 px-3 py-1 text-slate-300">
                    <span className="text-slate-400">Duration: </span>
                    <span className="font-semibold">{session.durationMin} min</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">Regenerate as</span>
                  <span className="text-[11px] text-slate-500">
                    Available:{" "}
                    {(() => {
                      const available = getAvailableCoachLevelKeys();
                      if (available.length === 0) return "current only";
                      return available
                        .map((key) => coachLevelLabel[key] || key)
                        .join(", ");
                    })()}
                  </span>
                  {coachLevelOptions.map((option) => {
                    const isActive = currentCoachLevelKey === option.key;
                    const isBusy =
                      loading ||
                      !!regeneratingCoachLevel ||
                      generatingSkillFocus ||
                      sessionMode === "series";
                    const optionConfig = buildRegenerateConfigForLevel(option.key);
                    const hasSavedVariant = Boolean(
                      coachLevelSessionCache[getCoachVariantCacheKey(optionConfig, option.key)]
                    );
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => regenerateForCoachLevel(option.key)}
                        disabled={isActive || isBusy}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                          isActive
                            ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                            : "border border-slate-700/80 bg-slate-800/60 text-slate-300 hover:bg-slate-700/70"
                        } ${isBusy && !isActive ? "opacity-60" : ""}`}
                        title={
                          sessionMode === "series"
                            ? "Open a single session to regenerate by coach level."
                            : hasSavedVariant
                            ? `Open existing ${option.label} version`
                            : `Generate a new ${option.label} version`
                        }
                      >
                        {regeneratingCoachLevel === option.key
                          ? "Generating..."
                          : hasSavedVariant && !isActive
                          ? `● ${option.label}`
                          : option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {session.summary && (
                <p className="text-sm text-slate-300 leading-relaxed">{humanizeSessionText(session.summary)}</p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 mt-1 border-t border-slate-700/60">
                <Link
                  href="/vault"
                  className="inline-flex h-9 items-center rounded-full border border-slate-600/60 bg-slate-800/55 px-3.5 text-[13px] font-medium text-slate-200 hover:bg-slate-700/60 transition-colors"
                >
                  View in Vault
                </Link>
                {resolvedSessionId && session && (
                  <button
                    type="button"
                    onClick={() =>
                      setScheduleModalSession({
                        sessionId: resolvedSessionId,
                        sessionTitle: session.title,
                        sessionRefCode: session.refCode ?? null,
                        durationMin: session.durationMin ?? 90,
                      })
                    }
                    className="inline-flex h-9 items-center rounded-full border border-slate-600/60 bg-slate-800/55 px-3.5 text-[13px] font-medium text-slate-200 hover:bg-slate-700/60 transition-colors"
                  >
                    Add to Calendar
                  </button>
                )}
                <button
                  onClick={async () => {
                    try {
                      if (!resolvedSessionId) {
                        alert("Session ID is missing. Generate a session first.");
                        return;
                      }
                      setGeneratingSkillFocus(true);
                      const focus = await generateSkillFocusForSessionId(resolvedSessionId);
                      setSkillFocus(focus);
                    } catch (e: any) {
                      alert("Error generating coaching emphasis: " + e.message);
                    } finally {
                      setGeneratingSkillFocus(false);
                    }
                  }}
                  disabled={generatingSkillFocus || !session.id}
                  className={`inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium transition-colors disabled:opacity-50 ${
                    skillFocus
                      ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                      : "border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {generatingSkillFocus
                    ? "Generating Coaching Emphasis..."
                    : skillFocus
                    ? "Coaching Emphasis Ready"
                    : "Generate Coaching Emphasis"}
                </button>
                {userFeatures?.canCreatePlayerPlans && resolvedSessionId && (
                  <>
                    {!sessionPlayerPlan?.id && (
                      <button
                        type="button"
                        onClick={() =>
                          setCreatePlayerPlanModal({
                            sourceType: "SESSION",
                            sourceId: resolvedSessionId,
                            sourceRefCode: session.refCode ?? null,
                          })
                        }
                        disabled={checkingPlayerPlan}
                        className="inline-flex h-9 items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3.5 text-[13px] font-medium text-cyan-300 hover:bg-cyan-500/20 transition-colors disabled:opacity-60"
                      >
                        {checkingPlayerPlan ? "Checking Player Version..." : "Create Player Version"}
                      </button>
                    )}
                    {sessionPlayerPlan?.id && !checkingPlayerPlan && (
                      <Link
                        href={`/player-plans/${sessionPlayerPlan.id}`}
                        className="inline-flex h-9 items-center rounded-full border border-slate-600/70 bg-slate-800/60 px-3.5 text-[13px] font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        View Player Version
                      </Link>
                    )}
                  </>
                )}
                {userFeatures?.canExportPDF && (() => {
                  // Shared helper — builds the export payload and triggers download
                  const handleExport = async (format: "full" | "compact") => {
                    try {
                      const sessionForExport = {
                        ...session,
                        skillFocus: skillFocus || session.skillFocus || null,
                        drills: session.drills?.map((drill: any) => {
                          const drillCopy = { ...drill };
                          if (drill.diagramV1 && !drill.diagram) drillCopy.diagram = drill.diagramV1;
                          if (drill.json?.diagram && !drillCopy.diagram) drillCopy.diagram = drill.json.diagram;
                          return drillCopy;
                        }) || [],
                      };
                      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
                      const headers: Record<string, string> = { "Content-Type": "application/json" };
                      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
                      const response = await fetch("/api/export-session-pdf", {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ session: sessionForExport, format }),
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
                      const suffix = format === "compact" ? "-compact" : "";
                      a.download = `session-${session.title.replace(/[^a-z0-9]/gi, "-")}${suffix}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    } catch (e: any) {
                      alert("Error exporting PDF: " + e.message);
                    }
                  };

                  return (
                    <div className="relative flex items-center rounded-full overflow-hidden border border-emerald-500 bg-emerald-500 text-slate-950 text-[13px] font-semibold shadow-lg shadow-emerald-500/30">
                      {/* Full PDF */}
                      <button
                        onClick={() => handleExport("full")}
                        className="flex items-center gap-1.5 h-9 px-3.5 hover:bg-emerald-400 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        Full PDF
                      </button>
                      {/* Divider */}
                      <span className="w-px h-5 bg-emerald-700/40 self-center" />
                      {/* 1-Page compact */}
                      <button
                        onClick={() => handleExport("compact")}
                        title="Landscape coach's sheet — 4 drill columns, print-ready"
                        className="flex items-center gap-1.5 h-9 px-3 hover:bg-emerald-400 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
                        </svg>
                        1-Page
                      </button>
                    </div>
                  );
                })()}
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

              {/* QA Scores Display */}
              {Object.keys(qaScores).length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <QAScoresDisplay scores={qaScores} pass={qaPass} />
                </div>
              )}

              {skillFocus && (
                <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="text-xs text-emerald-300 uppercase tracking-widest">Player Coaching Emphasis</div>
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
                  {(Array.isArray(skillFocus.psychology?.good) || Array.isArray(skillFocus.psychology?.bad)) && (
                    <div className="mt-3">
                      <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Psychological Watch</div>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      {Array.isArray(skillFocus.psychology?.good) && skillFocus.psychology?.good?.length > 0 && (
                          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
                          <div className="text-[11px] uppercase tracking-widest text-emerald-200/80">Encourage</div>
                            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-emerald-100/80">
                              {skillFocus.psychology?.good?.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      {Array.isArray(skillFocus.psychology?.bad) && skillFocus.psychology?.bad?.length > 0 && (
                          <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3">
                          <div className="text-[11px] uppercase tracking-widest text-rose-200/80">Correct</div>
                            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-rose-100/80">
                              {skillFocus.psychology?.bad?.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {skillFocus.sectionPhrases && (() => {
                    const allEncourage: string[] = [];
                    const allCorrect: string[] = [];
                    Object.values(skillFocus.sectionPhrases).forEach((phrases: any) => {
                      if (Array.isArray(phrases?.encourage)) allEncourage.push(...phrases.encourage);
                      if (Array.isArray(phrases?.correct)) allCorrect.push(...phrases.correct);
                    });
                    if (allEncourage.length === 0 && allCorrect.length === 0) return null;
                    return (
                      <div className="mt-4">
                        <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Coaching phrases</div>
                        <div className="mt-2 grid gap-4 md:grid-cols-2">
                          {allEncourage.length > 0 && (
                            <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
                              <div className="text-[10px] uppercase tracking-widest text-emerald-200/70">Encourage</div>
                              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-emerald-100/90">
                                {allEncourage.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {allCorrect.length > 0 && (
                            <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
                              <div className="text-[10px] uppercase tracking-widest text-rose-200/70">Correct</div>
                              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-rose-100/90">
                                {allCorrect.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </section>

            {/* All Drills in Session */}
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Session Drills</h2>
              {session.drills.map((drill, index) => {
                const baseDiagram = drill.json?.diagram || drill.diagram || drill.diagramV1 || drill.json?.diagramV1;
                const diagram = drill.refCode && diagramOverrides[drill.refCode]
                  ? diagramOverrides[drill.refCode]
                  : baseDiagram;
                if (process.env.NODE_ENV !== "production") {
                  console.log("[SESSION] Drill diagram source", {
                    refCode: drill.refCode,
                    title: drill.title,
                    fromJson: !!drill.json?.diagram,
                    fromDiagram: !!drill.diagram,
                    fromDiagramV1: !!drill.diagramV1,
                    arrows: baseDiagram?.arrows?.length ?? 0,
                    annotations: baseDiagram?.annotations?.length ?? 0,
                    safeZones: baseDiagram?.safeZones?.length ?? 0,
                    overrideApplied: drill.refCode ? !!diagramOverrides[drill.refCode] : false,
                  });
                }
                const isOrganizationObject = drill.organization && typeof drill.organization === "object" && !Array.isArray(drill.organization);
                const organizationObj = isOrganizationObject ? (drill.organization as OrganizationObject) : null;
                const organizationString = isOrganizationObject ? "" : (typeof drill.organization === "string" ? drill.organization : "");
                
                // Create a stable key based on drill properties
                const drillKey = drill.title || `drill-${index}-${drill.drillType || 'unknown'}`;

                return (
                  <section key={drillKey} className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">{drill.title}</h3>
                          {drill.refCode && (
                            <button
                              onClick={() => navigator.clipboard.writeText(drill.refCode!)}
                              className="px-2 py-1 rounded bg-cyan-900/40 text-cyan-300 text-xs font-mono border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors"
                              title="Click to copy reference code"
                            >
                              {drill.refCode}
                            </button>
                          )}
                        </div>
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
                      <p className="text-sm text-slate-300 leading-relaxed">{humanizeSessionText(drill.description)}</p>
                    )}

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
                      {diagram && (
                        <div className="w-full max-w-3xl" key={`diagram-${drill.title}-${index}`}>
                          <DrillDiagramCard
                            title={drill.title}
                            gameModelId={session.gameModelId}
                            phase={session.phase || "ATTACKING"}
                            zone={session.zone || "ATTACKING_THIRD"}
                            diagram={diagram}
                            description={humanizeSessionText(drill.description)}
                            organization={organizationObj ?? undefined}
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

      {/* Floating Chat Button */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center ${
          chatOpen
            ? "bg-slate-700 hover:bg-slate-600"
            : "bg-emerald-600 hover:bg-emerald-500"
        }`}
        title="Coach Assistant"
      >
        {chatOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {chatOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[500px] shadow-2xl rounded-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <CoachChat
            onSessionSelect={(session) => {
              // Navigate to view the selected session
              if (session?.id) {
                router.push(`/demo/session?sessionId=${session.id}`);
                setChatOpen(false);
              }
            }}
            onGenerateRequest={(params) => {
              // Build query params and navigate to trigger generation
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
              const normalizedCoachLevel = normalizeCoachLevelForGeneration(params.coachLevel);
              if (normalizedCoachLevel) queryParams.set("coachLevel", normalizedCoachLevel);
              if (params.goalsAvailable !== null && params.goalsAvailable !== undefined) queryParams.set("goalsAvailable", String(params.goalsAvailable));
              // Series mode
              if (params.numberOfSessions && params.numberOfSessions > 1) {
                queryParams.set("series", "true");
                queryParams.set("numberOfSessions", String(params.numberOfSessions));
              }
              // Flag to skip recommendations and auto-generate
              queryParams.set("autoGenerate", "true");
              queryParams.set("requestId", String(Date.now()));
              setChatOpen(false);
              const targetUrl = `/demo/session?${queryParams.toString()}`;
              const before = typeof window !== "undefined"
                ? `${window.location.pathname}${window.location.search}`
                : "";
              router.push(targetUrl);
              if (typeof window !== "undefined") {
                window.setTimeout(() => {
                  const after = `${window.location.pathname}${window.location.search}`;
                  if (after === before) {
                    window.location.assign(targetUrl);
                  }
                }, 350);
              }
            }}
          />
        </div>
      )}
      {scheduleModalSession && (
        <ScheduleSessionModal
          sessionId={scheduleModalSession.sessionId}
          sessionTitle={scheduleModalSession.sessionTitle}
          sessionRefCode={scheduleModalSession.sessionRefCode}
          sessionDurationMin={scheduleModalSession.durationMin}
          onClose={() => setScheduleModalSession(null)}
          onScheduled={() => setScheduleModalSession(null)}
        />
      )}
      {createPlayerPlanModal && (
        <CreatePlayerPlanModal
          sourceType={createPlayerPlanModal.sourceType}
          sourceId={createPlayerPlanModal.sourceId}
          sourceRefCode={createPlayerPlanModal.sourceRefCode}
          onClose={() => setCreatePlayerPlanModal(null)}
          onPlanCreated={(planId) => {
            setSessionPlayerPlan((prev) => ({
              id: planId,
              refCode: prev?.refCode || null,
              title: prev?.title || null,
              createdAt: prev?.createdAt,
            }));
          }}
        />
      )}
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
              TacticalEdge Session Generator
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
