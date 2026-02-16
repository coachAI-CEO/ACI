"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DrillDiagramCard from "@/components/DrillDiagramCard";
import UniversalDrillDiagram from "@/components/UniversalDrillDiagram";
import { tacticalEdgeToUniversalDrillData } from "@/lib/diagram-adapter";
import { getUserHeaders } from "@/lib/user";
import CreatePlayerPlanModal from "@/components/CreatePlayerPlanModal";
import PlayerPlanViewModal from "@/components/PlayerPlanViewModal";
import ScheduleSessionModal from "@/components/ScheduleSessionModal";
import ScheduleSeriesModal from "@/components/ScheduleSeriesModal";
import { fetchUserFeatures, UserFeatures } from "@/lib/features";

type VaultSession = {
  id: string;
  refCode?: string; // Human-readable reference code (S-XXXX or SR-XXXX)
  title: string;
  gameModelId: string;
  ageGroup: string;
  phase?: string;
  zone?: string;
  durationMin?: number;
  approved: boolean;
  isSeries: boolean;
  seriesId?: string;
  seriesNumber?: number;
  createdAt: string;
  json: any;
  formationUsed?: string;
  playerLevel?: string;
  coachLevel?: string;
  numbersMin?: number;
  numbersMax?: number;
  favoriteCount?: number;
  // Optional creator info from backend (user who generated the session)
  user?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  // Normalized creator field we may add in the future
  creator?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type VaultSeries = {
  seriesId: string;
  sessions: VaultSession[];
  totalSessions: number;
  createdAt?: string;
  gameModelId: string;
  ageGroup: string;
};

type VaultDrill = {
  id: string; // generated: sessionId-drillIndex
  refCode?: string; // Human-readable reference code (D-XXXX)
  drillType: string;
  title: string;
  description: string;
  durationMin: number;
  organization?: any;
  progressions?: string[];
  coachingPoints?: string[];
  diagram?: any;
  json?: any;
  // Parent session info
  sessionId: string;
  sessionRefCode?: string;
  sessionTitle: string;
  sessionAgeGroup: string;
  sessionGameModelId: string;
  sessionPhase?: string;
  sessionZone?: string;
  sessionFormation?: string;
  sessionCreatedAt: string;
  sessionCreator?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

const drillTypeLabel: Record<string, string> = {
  WARMUP: "Warm-up",
  TECHNICAL: "Technical",
  TACTICAL: "Tactical",
  CONDITIONED_GAME: "Conditioned Game",
  COOLDOWN: "Cool-down",
};

const drillTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  WARMUP: { bg: "bg-yellow-900/30", text: "text-yellow-300", border: "border-yellow-700/30" },
  TECHNICAL: { bg: "bg-blue-900/30", text: "text-blue-300", border: "border-blue-700/30" },
  TACTICAL: { bg: "bg-purple-900/30", text: "text-purple-300", border: "border-purple-700/30" },
  CONDITIONED_GAME: { bg: "bg-orange-900/30", text: "text-orange-300", border: "border-orange-700/30" },
  COOLDOWN: { bg: "bg-cyan-900/30", text: "text-cyan-300", border: "border-cyan-700/30" },
};

const gameModelLabel: Record<string, string> = {
  POSSESSION: "Possession",
  PRESSING: "Pressing",
  TRANSITION: "Transition",
  COACHAI: "Balanced",
};

const phaseLabel: Record<string, string> = {
  ATTACKING: "Attacking",
  DEFENDING: "Defending",
  TRANSITION: "Transition",
};

const zoneLabel: Record<string, string> = {
  DEFENSIVE_THIRD: "Defensive Third",
  MIDDLE_THIRD: "Middle Third",
  ATTACKING_THIRD: "Attacking Third",
};

const playerLevelLabel: Record<string, string> = {
  BEGINNER: "Beginner",
  DEVELOPING: "Developing",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  ELITE: "Elite",
};

const coachLevelLabel: Record<string, string> = {
  GRASSROOTS: "Grassroots",
  USSF_C: "USSF C",
  USSF_B_PLUS: "USSF B+",
};

export default function VaultPage() {
  console.log('[VAULT] Component rendering...');
  
  const [sessions, setSessions] = useState<VaultSession[]>([]);
  const [series, setSeries] = useState<VaultSeries[]>([]);
  
  // Helper to get series by seriesId
  const getSeriesById = (seriesId: string) => {
    return series.find((s) => s.seriesId === seriesId);
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sessions" | "series" | "drills">("drills");
  
  useEffect(() => {
    console.log('[VAULT] Component mounted');
    // Fetch user features
    fetchUserFeatures().then(setUserFeatures).catch(() => setUserFeatures(null));
  }, []);
  const [selectedSession, setSelectedSession] = useState<VaultSession | null>(null);
  const [selectedDrill, setSelectedDrill] = useState<VaultDrill | null>(null);
  const [skillFocus, setSkillFocus] = useState<any | null>(null);
  const [generatingSkillFocus, setGeneratingSkillFocus] = useState(false);
  const [createPlayerPlanModal, setCreatePlayerPlanModal] = useState<{
    sourceType: "SESSION" | "SERIES";
    sourceId: string;
    sourceRefCode?: string | null;
  } | null>(null);
  const [viewPlayerPlanModal, setViewPlayerPlanModal] = useState<any | null>(null);
  const [scheduleModal, setScheduleModal] = useState<{
    sessionId: string;
    sessionTitle: string;
    sessionRefCode?: string | null;
  } | null>(null);
  const [scheduleSeriesModal, setScheduleSeriesModal] = useState<{
    seriesId: string;
    seriesTitle: string;
    sessions: Array<{ id: string; title: string; refCode?: string | null }>;
  } | null>(null);
  const [userFeatures, setUserFeatures] = useState<UserFeatures | null>(null);
  
  // Favorites state
  const [favoritedSessions, setFavoritedSessions] = useState<Set<string>>(new Set());
  const [favoritedSeries, setFavoritedSeries] = useState<Set<string>>(new Set());
  const [favoritedDrills, setFavoritedDrills] = useState<Set<string>>(new Set()); // Stores drill DB IDs
  const [drillRefCodeToDbId, setDrillRefCodeToDbId] = useState<Map<string, string>>(new Map()); // Maps refCode -> dbId
  const [sessionPlayerPlans, setSessionPlayerPlans] = useState<Map<string, { id: string; refCode: string | null }>>(new Map()); // Maps sessionId -> playerPlan info
  const [seriesPlayerPlans, setSeriesPlayerPlans] = useState<Map<string, { id: string; refCode: string | null }>>(new Map()); // Maps seriesId -> playerPlan info
  const [sessionCalendarCounts, setSessionCalendarCounts] = useState<Map<string, number>>(new Map()); // Maps sessionId -> number of scheduled events
  const [seriesCalendarCounts, setSeriesCalendarCounts] = useState<Map<string, number>>(new Map()); // Maps seriesId -> number of scheduled events
  
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    gameModelId: "",
    ageGroup: "",
    phase: "",
    zone: "",
    gameFormat: "", // 7v7, 9v9, 11v11
    drillType: "", // WARMUP, TECHNICAL, TACTICAL, CONDITIONED_GAME, COOLDOWN
    search: "", // Search by name, code, summary, or drill text
    creator: "", // Filter by creator name/email
    favoritesOnly: false, // Show only favorited items (per active tab)
  });

  // Helper to determine game format from formation
  const getGameFormat = (session: VaultSession): string => {
    const formation = session.formationUsed;
    if (!formation) return "11v11"; // Default to 11v11 if no formation
    
    // Parse formation (e.g., "4-3-3", "3-2-1", "2-3-1") and sum the numbers
    const numbers = formation.split("-").map(n => parseInt(n, 10)).filter(n => !isNaN(n));
    const outfieldPlayers = numbers.reduce((sum, n) => sum + n, 0);
    
    // outfield + 1 GK = total per team
    // 4-3-3 = 10 outfield + 1 GK = 11 players = 11v11
    // 3-2-3 = 8 outfield + 1 GK = 9 players = 9v9
    // 2-3-1 = 6 outfield + 1 GK = 7 players = 7v7
    if (outfieldPlayers <= 6) return "7v7";
    if (outfieldPlayers <= 8) return "9v9";
    return "11v11";
  };

  // Filter sessions by game format, text search, creator, and favorites (client-side)
  const filteredSessions = sessions.filter((s) => {
    if (filters.gameFormat && getGameFormat(s) !== filters.gameFormat) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const title = (s.title || "").toLowerCase();
      const ref = (s.refCode || "").toLowerCase();
      const summary = ((s.json as any)?.summary || "").toLowerCase();
      const drills = Array.isArray((s.json as any)?.drills) ? (s.json as any).drills : [];

      const matchesTitle = title.includes(searchLower);
      const matchesRefCode = ref.includes(searchLower);
      const matchesSummary = summary.includes(searchLower);
      const matchesDrill = drills.some((d: any) => {
        const dt = (d?.title || "").toLowerCase();
        const dd = (d?.description || "").toLowerCase();
        const dcp = Array.isArray(d?.coachingPoints)
          ? (d.coachingPoints as string[]).join(" ").toLowerCase()
          : "";
        const dprog = Array.isArray(d?.progressions)
          ? (d.progressions as string[]).join(" ").toLowerCase()
          : "";
        return (
          dt.includes(searchLower) ||
          dd.includes(searchLower) ||
          dcp.includes(searchLower) ||
          dprog.includes(searchLower)
        );
      });

      if (!matchesTitle && !matchesRefCode && !matchesSummary && !matchesDrill) return false;
    }

    if (filters.creator) {
      const creator = (s.user || s.creator) as { name?: string | null; email?: string } | null;
      const needle = filters.creator.toLowerCase();
      const name = (creator?.name || "").toLowerCase();
      const email = (creator?.email || "").toLowerCase();
      if (!name.includes(needle) && !email.includes(needle)) return false;
    }

    if (filters.favoritesOnly && !favoritedSessions.has(s.id)) {
      return false;
    }
    return true;
  });

  // Filter series by game format and search (based on first session)
  const filteredSeries = series.filter((s) => {
    if (filters.gameFormat && s.sessions[0] && getGameFormat(s.sessions[0]) !== filters.gameFormat) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const firstSession = s.sessions[0];
      if (firstSession) {
        const matchesTitle = firstSession.title.toLowerCase().includes(searchLower);
        const matchesRefCode = firstSession.refCode?.toLowerCase().includes(searchLower);
        // Also check series title (derived from first session)
        const seriesTitle = firstSession.title
          .replace(/^(Session \d+:?\s*)/i, "")
          .replace(/\s*-\s*Part\s*\d+/i, "")
          .trim();
        const matchesSeriesTitle = seriesTitle.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesRefCode && !matchesSeriesTitle) return false;
      } else {
        return false;
      }
    }
    return true;
  });

  // Extract drills from all sessions
  const allDrills: VaultDrill[] = sessions.flatMap((session) => {
    const sessionDrills = session.json?.drills || [];
    return sessionDrills.map((drill: any, index: number) => ({
      id: `${session.id}-${index}`,
      refCode: drill.refCode, // Drill reference code (D-XXXX)
      drillType: drill.drillType || "TECHNICAL",
      title: drill.title || `Drill ${index + 1}`,
      description: drill.description || "",
      durationMin: drill.durationMin || 0,
      organization: drill.organization,
      progressions: drill.progressions,
      coachingPoints: drill.coachingPoints,
      diagram: drill.diagram || drill.diagramV1,
      sessionId: session.id,
      sessionRefCode: session.refCode, // Parent session reference code
      sessionTitle: session.title,
      sessionAgeGroup: session.ageGroup,
      sessionCreator: session.user || session.creator || null,
      sessionGameModelId: session.gameModelId,
      sessionPhase: session.phase,
      sessionZone: session.zone,
      sessionFormation: session.formationUsed,
      sessionCreatedAt: session.createdAt,
    }));
  });

  // Filter drills (respecting global filters, creator, favorites, and search)
  const filteredDrills = allDrills.filter((drill) => {
    if (filters.gameFormat) {
      const session = sessions.find(s => s.id === drill.sessionId);
      if (session && getGameFormat(session) !== filters.gameFormat) return false;
    }
    if (filters.drillType && drill.drillType !== filters.drillType) return false;
    if (filters.gameModelId && drill.sessionGameModelId !== filters.gameModelId) return false;
    if (filters.ageGroup && drill.sessionAgeGroup !== filters.ageGroup) return false;
    if (filters.phase && drill.sessionPhase !== filters.phase) return false;
    if (filters.zone && drill.sessionZone !== filters.zone) return false;

    if (filters.creator) {
      const creator = drill.sessionCreator as { name?: string | null; email?: string } | null;
      const needle = filters.creator.toLowerCase();
      const name = (creator?.name || "").toLowerCase();
      const email = (creator?.email || "").toLowerCase();
      if (!name.includes(needle) && !email.includes(needle)) return false;
    }

    if (filters.favoritesOnly && !favoritedDrills.has(drill.id)) {
      return false;
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const title = (drill.title || "").toLowerCase();
      const ref = (drill.refCode || "").toLowerCase();
      const desc = (drill.description || "").toLowerCase();
      const orgText =
        typeof drill.organization === "string"
          ? (drill.organization as string).toLowerCase()
          : JSON.stringify(drill.organization || "").toLowerCase();
      const cp =
        Array.isArray(drill.coachingPoints) && drill.coachingPoints.length
          ? drill.coachingPoints.join(" ").toLowerCase()
          : "";
      const prog =
        Array.isArray(drill.progressions) && drill.progressions.length
          ? drill.progressions.join(" ").toLowerCase()
          : "";
      const sessionTitle = (drill.sessionTitle || "").toLowerCase();
      const sessionRef = (drill.sessionRefCode || "").toLowerCase();

      const matches =
        title.includes(searchLower) ||
        ref.includes(searchLower) ||
        desc.includes(searchLower) ||
        orgText.includes(searchLower) ||
        cp.includes(searchLower) ||
        prog.includes(searchLower) ||
        sessionTitle.includes(searchLower) ||
        sessionRef.includes(searchLower);

      if (!matches) return false;
    }
    return true;
  });

  const loadVaultData = useCallback(async () => {
    console.log('[VAULT] Starting loadVaultData...');
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.gameModelId) params.append("gameModelId", filters.gameModelId);
      if (filters.ageGroup) params.append("ageGroup", filters.ageGroup);
      if (filters.phase) params.append("phase", filters.phase);
      if (filters.zone) params.append("zone", filters.zone);

      console.log('[VAULT] Fetching data from API...');
      const sessionsUrl = `/api/vault/sessions?${params.toString()}`;
      const seriesUrl = `/api/vault/series`;
      console.log('[VAULT] Sessions URL:', sessionsUrl);
      console.log('[VAULT] Series URL:', seriesUrl);

      // Get auth token for authenticated requests
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      // Add timeout to fetch calls (increased to 30 seconds for large datasets)
      const fetchWithTimeout = (url: string, timeout = 30000) => {
        return Promise.race([
          fetch(url, { headers }),
          new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout)
          ),
        ]);
      };

      const [sessionsRes, seriesRes] = await Promise.all([
        fetchWithTimeout(sessionsUrl),
        fetchWithTimeout(seriesUrl),
      ]);
      
      console.log('[VAULT] API responses received:', {
        sessionsStatus: sessionsRes.status,
        seriesStatus: seriesRes.status,
      });

      if (!sessionsRes.ok) {
        const errorText = await sessionsRes.text().catch(() => 'Unknown error');
        console.error('[VAULT] Sessions API error:', sessionsRes.status, errorText);
        throw new Error(`Sessions API error: ${sessionsRes.status} - ${errorText}`);
      }
      if (!seriesRes.ok) {
        const errorText = await seriesRes.text().catch(() => 'Unknown error');
        console.error('[VAULT] Series API error:', seriesRes.status, errorText);
        throw new Error(`Series API error: ${seriesRes.status} - ${errorText}`);
      }

      const sessionsData = await sessionsRes.json();
      const seriesData = await seriesRes.json();
      
      console.log('[VAULT] Loaded:', {
        sessions: sessionsData.sessions?.length || 0,
        series: seriesData.series?.length || 0,
      });

      setSessions(sessionsData.sessions || []);
      setSeries(seriesData.series || []);
      
      // Check which items are favorited (non-blocking)
      const sessionIds = sessionsData.sessions?.map((s: any) => s.id).filter(Boolean) || [];
      const seriesIds = seriesData.series?.map((s: any) => s.seriesId).filter(Boolean) || [];
      if (sessionIds.length > 0 || seriesIds.length > 0) {
        checkFavorites(sessionIds, seriesIds).catch(() => {
          // Silently fail - favorites are optional
        });
      }

      // Extract drills and check drill favorites (by refCode lookup)
      // Note: allDrills is computed from sessions, so we compute it here
      const currentSessions = sessionsData.sessions || [];
      const currentAllDrills: VaultDrill[] = currentSessions.flatMap((session: any) => {
        const sessionDrills = session.json?.drills || [];
        return sessionDrills.map((drill: any, index: number) => ({
          id: `${session.id}-${index}`,
          refCode: drill.refCode,
        }));
      });
      const drillRefCodes = currentAllDrills
        .map((d) => (typeof d.refCode === "string" ? d.refCode : String(d.refCode ?? "")))
        .filter((s) => s && !/^\[object\s+object\]$/i.test(s));
      if (drillRefCodes.length > 0) {
        checkDrillFavorites(drillRefCodes).catch(() => {
          // Silently fail - favorites are optional
        });
      }

      // Check which sessions have player plans (non-blocking)
      if (sessionIds.length > 0) {
        checkSessionPlayerPlans(sessionIds).catch(() => {
          // Silently fail - player plan check is optional
        });
      }

      // Check which series have player plans (non-blocking)
      if (seriesIds.length > 0) {
        checkSeriesPlayerPlans(seriesIds).catch(() => {
          // Silently fail - player plan check is optional
        });
      }
    } catch (e: any) {
      const errorMsg = e?.message || String(e);
      console.error('[VAULT] Error loading vault data:', errorMsg);
      
      // Provide user-friendly error message
      if (errorMsg.includes('Backend server is not running')) {
        setError('Backend server is not running. Please start the API server on port 4000.');
      } else if (errorMsg.includes('timeout')) {
        setError('Request timeout. The server took too long to respond. Please try again.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [filters.gameModelId, filters.ageGroup, filters.phase, filters.zone]);

  useEffect(() => {
    loadVaultData();
  }, [loadVaultData]);

  useEffect(() => {
    const sessionId = selectedSession?.id;
    if (!sessionId) {
      setSkillFocus(null);
      return;
    }
    const headers: Record<string, string> = {
      ...(getUserHeaders() as Record<string, string>),
    };
    const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    fetch(`/api/skill-focus/session/${encodeURIComponent(sessionId)}`, { headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSkillFocus(data?.focus || null))
      .catch(() => setSkillFocus(null));
  }, [selectedSession?.id]);

  // Check favorites status for loaded items (non-blocking)
  async function checkFavorites(sessionIds: string[], seriesIds: string[]) {
    try {
      // Get access token for authenticated requests
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      } else {
        // Fallback to x-user-id for anonymous users
        Object.assign(headers, getUserHeaders() as Record<string, string>);
      }

      const res = await fetch("/api/favorites", {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionIds, seriesIds }),
      });
      
      if (res.ok) {
        const data = await res.json();
        const favSessions = new Set<string>();
        const favSeries = new Set<string>();
        
        if (data.sessions) {
          Object.entries(data.sessions).forEach(([id, isFav]) => {
            if (isFav) favSessions.add(id);
          });
        }
        if (data.series) {
          Object.entries(data.series).forEach(([id, isFav]) => {
            if (isFav) favSeries.add(id);
          });
        }
        
        setFavoritedSessions(favSessions);
        setFavoritedSeries(favSeries);
      }
    } catch (e) {
      // Silently fail - favorites are optional and shouldn't block vault loading
      console.debug("Favorites check failed (non-critical):", e);
    }
  }

  // Check drill favorites by looking up refCodes (using bulk lookup)
  async function checkDrillFavorites(drillRefCodes: string[]) {
    if (drillRefCodes.length === 0) return;
    
    try {
      // Use bulk lookup endpoint instead of individual requests
      const lookupHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(getUserHeaders() as Record<string, string>),
      };
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (accessToken) lookupHeaders["Authorization"] = `Bearer ${accessToken}`;
      const res = await fetch("/api/vault/lookup", {
        method: "POST",
        headers: lookupHeaders,
        body: JSON.stringify({ refCodes: drillRefCodes }),
      });

      if (!res.ok) {
        console.debug("Bulk drill lookup failed (non-critical):", res.status);
        return;
      }

      const data = await res.json();
      const results = data.results || [];

      // Build refCode -> dbId map from successful lookups
      const refCodeMap = new Map<string, string>();
      const drillDbIds: string[] = [];

      results.forEach((result: any) => {
        if (result.found && result.type === "drill" && result.data?.id) {
          refCodeMap.set(result.refCode, result.data.id);
          drillDbIds.push(result.data.id);
        }
      });

      if (refCodeMap.size === 0) return;

      setDrillRefCodeToDbId(refCodeMap);

      // Check favorite status for these drill IDs (reuse auth from above)
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(getUserHeaders() as Record<string, string>),
      };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      const favRes = await fetch("/api/favorites", {
        method: "POST",
        headers,
        body: JSON.stringify({ drillIds: drillDbIds }),
      });

      if (favRes.ok) {
        const favData = await favRes.json();
        const favDrills = new Set<string>();
        
        if (favData.drills) {
          Object.entries(favData.drills).forEach(([id, isFav]) => {
            if (isFav) favDrills.add(id);
          });
        }
        
        setFavoritedDrills(favDrills);
      }
    } catch (e) {
      // Silently fail - favorites are optional
      console.debug("Drill favorites check failed (non-critical):", e);
    }
  }

  // Check which sessions have player plans (bulk lookup)
  async function checkSessionPlayerPlans(sessionIds: string[]) {
    if (sessionIds.length === 0) return;

    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!accessToken) {
        // Not authenticated, skip check
        return;
      }

      // Bulk lookup all sessions at once
      const res = await fetch("/api/player-plans/bulk-lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sessions: sessionIds }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.sessions) {
          // Convert response object to Map
          const plansMap = new Map<string, { id: string; refCode: string | null }>();
          Object.entries(data.sessions).forEach(([sessionId, planInfo]: [string, any]) => {
            plansMap.set(sessionId, {
              id: planInfo.id,
              refCode: planInfo.refCode,
            });
          });
          setSessionPlayerPlans(plansMap);
        }
      }
    } catch (e) {
      // Silently fail - player plan check is optional
      console.debug("Player plan check failed (non-critical):", e);
    }
  }

  // Check which series have player plans (bulk lookup)
  async function checkSeriesPlayerPlans(seriesIds: string[]) {
    if (seriesIds.length === 0) return;

    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!accessToken) {
        // Not authenticated, skip check
        return;
      }

      // Bulk lookup all series at once
      const res = await fetch("/api/player-plans/bulk-lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ series: seriesIds }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.series) {
          // Convert response object to Map
          const plansMap = new Map<string, { id: string; refCode: string | null }>();
          Object.entries(data.series).forEach(([seriesId, planInfo]: [string, any]) => {
            plansMap.set(seriesId, {
              id: planInfo.id,
              refCode: planInfo.refCode,
            });
          });
          setSeriesPlayerPlans(plansMap);
        }
      }
    } catch (e) {
      // Silently fail - player plan check is optional
      console.debug("Series player plan check failed (non-critical):", e);
    }
  }

  // Check calendar event counts for sessions
  async function checkSessionCalendarCounts(sessionIds: string[]) {
    if (sessionIds.length === 0) return;

    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!accessToken) {
        return;
      }

      // Fetch all calendar events and count by sessionId
      const res = await fetch("/api/calendar/events?includeCancelled=false", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.events) {
          const countsMap = new Map<string, number>();
          sessionIds.forEach((sessionId) => {
            const count = data.events.filter((e: any) => e.sessionId === sessionId && !e.cancelled).length;
            if (count > 0) {
              countsMap.set(sessionId, count);
            }
          });
          setSessionCalendarCounts(countsMap);
        }
      }
    } catch (e) {
      console.debug("Calendar count check failed (non-critical):", e);
    }
  }

  // Check calendar event counts for series (count sessions in series that are scheduled)
  async function checkSeriesCalendarCounts(seriesIds: string[]) {
    if (seriesIds.length === 0) return;

    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!accessToken) {
        return;
      }

      // Fetch calendar events
      const res = await fetch("/api/calendar/events?includeCancelled=false", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.events) {
          const countsMap = new Map<string, number>();
          seriesIds.forEach((seriesId) => {
            const s = getSeriesById(seriesId);
            if (s) {
              const seriesSessionIds = s.sessions.map((sess) => sess.id);
              const count = data.events.filter((e: any) => 
                seriesSessionIds.includes(e.sessionId) && !e.cancelled
              ).length;
              if (count > 0) {
                countsMap.set(seriesId, count);
              }
            }
          });
          setSeriesCalendarCounts(countsMap);
        }
      }
    } catch (e) {
      console.debug("Series calendar count check failed (non-critical):", e);
    }
  }

  // Fetch and display a player plan in a modal
  async function viewPlayerPlan(planId: string) {
    try {
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!accessToken) {
        alert("You must be logged in to view player plans");
        return;
      }

      const res = await fetch(`/api/player-plans/${planId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.plan) {
          setViewPlayerPlanModal(data.plan);
        } else {
          alert("Failed to load player plan");
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "Failed to load player plan");
      }
    } catch (e: any) {
      console.error("Error loading player plan:", e);
      alert(e.message || "Failed to load player plan");
    }
  }

  // Toggle favorite for a session
  async function toggleSessionFavorite(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const isFavorited = favoritedSessions.has(sessionId);
    
    try {
      // Get access token for authenticated requests
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: Record<string, string> = {};
      
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      } else {
        // Fallback to x-user-id for anonymous users
        Object.assign(headers, getUserHeaders() as Record<string, string>);
      }

      const res = await fetch(`/api/favorites/session/${sessionId}`, {
        method: isFavorited ? "DELETE" : "POST",
        headers,
      });
      
      if (res.ok) {
        setFavoritedSessions(prev => {
          const next = new Set(prev);
          if (isFavorited) {
            next.delete(sessionId);
          } else {
            next.add(sessionId);
          }
          return next;
        });
      }
    } catch (e) {
      console.error("Error toggling favorite:", e);
    }
  }

  // Toggle favorite for a series
  async function toggleSeriesFavorite(seriesId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const isFavorited = favoritedSeries.has(seriesId);
    
    try {
      // Get access token for authenticated requests
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: Record<string, string> = {};
      
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      } else {
        // Fallback to x-user-id for anonymous users
        Object.assign(headers, getUserHeaders() as Record<string, string>);
      }

      const res = await fetch(`/api/favorites/series/${seriesId}`, {
        method: isFavorited ? "DELETE" : "POST",
        headers,
      });
      
      if (res.ok) {
        setFavoritedSeries(prev => {
          const next = new Set(prev);
          if (isFavorited) {
            next.delete(seriesId);
          } else {
            next.add(seriesId);
          }
          return next;
        });
      }
    } catch (e) {
      console.error("Error toggling series favorite:", e);
    }
  }

  // Toggle favorite for a drill (lookup by refCode first)
  async function toggleDrillFavorite(drill: VaultDrill, e: React.MouseEvent) {
    e.stopPropagation();
    
    const refCodeRaw = drill.refCode;
    const refCodeStr = typeof refCodeRaw === "string" ? refCodeRaw : String(refCodeRaw ?? "");
    if (!refCodeStr.trim() || /^\[object\s+object\]$/i.test(refCodeStr.trim())) {
      return; // Silently fail - invalid refCode
    }

    // Check if we already have the DB ID mapped
    let drillDbId = drillRefCodeToDbId.get(refCodeStr);
    
    // If not, look it up
    if (!drillDbId) {
      try {
        const lookupHeaders: Record<string, string> = {
          ...(getUserHeaders() as Record<string, string>),
        };
        const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
        if (accessToken) lookupHeaders["Authorization"] = `Bearer ${accessToken}`;
        const lookupRes = await fetch(`/api/vault/lookup/${encodeURIComponent(refCodeStr)}`, {
          headers: lookupHeaders,
        });
        if (!lookupRes.ok) {
          const errorData = await lookupRes.json().catch(() => ({}));
          console.error(`[DRILL_FAVORITE] Drill lookup failed for ${refCodeStr}:`, errorData.error || lookupRes.status);
          // Try using refCode directly - the API now supports looking up by refCode
          drillDbId = refCodeStr; // Use refCode as fallback
        } else {
          const lookupData = await lookupRes.json();
          if (lookupData.found && lookupData.type === "drill" && lookupData.data?.id) {
            drillDbId = lookupData.data.id;
            // Cache the mapping
            setDrillRefCodeToDbId(prev => new Map(prev).set(refCodeStr, drillDbId!));
          } else {
            // Use refCode as fallback - API will try to find by refCode
            drillDbId = refCodeStr;
          }
        }
      } catch (e: any) {
        console.error(`[DRILL_FAVORITE] Error looking up drill ${refCodeStr}:`, e);
        // Use refCode as fallback
        drillDbId = refCodeStr;
      }
    }

    // Use refCode if we don't have a DB ID
    const identifierToUse = drillDbId || refCodeStr;
    const isFavorited = drillDbId && drillDbId !== refCodeStr ? favoritedDrills.has(drillDbId) : false;
    
    try {
      // Get access token for authenticated requests
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: Record<string, string> = {};
      
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      } else {
        // Fallback to x-user-id for anonymous users
        Object.assign(headers, getUserHeaders() as Record<string, string>);
      }

      const res = await fetch(`/api/favorites/drill/${identifierToUse}`, {
        method: isFavorited ? "DELETE" : "POST",
        headers,
      });
      
      if (res.ok) {
        const result = await res.json();
        // If we used refCode and got a result, update our mapping
        if (identifierToUse === refCodeStr && result.drillId) {
          setDrillRefCodeToDbId(prev => new Map(prev).set(refCodeStr, result.drillId));
          drillDbId = result.drillId;
        }
        
        if (drillDbId) {
          setFavoritedDrills(prev => {
            const next = new Set(prev);
            const stableDrillId = drillDbId;
            if (!stableDrillId) return next;
            if (isFavorited) {
              next.delete(stableDrillId);
            } else {
              next.add(stableDrillId);
            }
            return next;
          });
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error(`[DRILL_FAVORITE] Failed to update favorite for ${identifierToUse}:`, errorData.error || res.status);
      }
    } catch (e: any) {
      console.error(`[DRILL_FAVORITE] Error toggling drill favorite for ${identifierToUse}:`, e);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Session Vault</h1>
              <p className="text-sm text-slate-400">
                Browse and manage your saved training sessions and progressive series
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/vault/favorites"
                className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                ■ My Favorites
              </Link>
              <Link
                href="/demo/session"
                className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                ➕ Generate New
              </Link>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-1 flex gap-1">
          <button
            onClick={() => setActiveTab("drills")}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all ${
              activeTab === "drills"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Drills ({filteredDrills.length}{filters.drillType || filters.gameFormat || filters.search ? ` of ${allDrills.length}` : ''})
          </button>
          <button
            onClick={() => setActiveTab("sessions")}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all ${
              activeTab === "sessions"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sessions ({filteredSessions.length}{filters.gameFormat ? ` of ${sessions.length}` : ''})
          </button>
          <button
            onClick={() => setActiveTab("series")}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-2xl transition-all ${
              activeTab === "series"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Series ({filteredSeries.length}{filters.gameFormat || filters.search ? ` of ${series.length}` : ''})
          </button>
        </div>

        {/* Filters - collapsible */}
        <section className="rounded-3xl border border-slate-700/70 bg-slate-900/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-4 transition-colors hover:bg-slate-800/30"
          >
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">
                Filters
              </h2>
              {/* Active filter count badge */}
              {(() => {
                const count = [
                  filters.search, filters.creator, filters.gameFormat, filters.drillType,
                  filters.gameModelId, filters.ageGroup, filters.phase, filters.zone,
                ].filter(Boolean).length + (filters.favoritesOnly ? 1 : 0);
                return count > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/20 px-1.5 text-[11px] font-semibold text-emerald-400">
                    {count}
                  </span>
                ) : null;
              })()}
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${
              filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="px-6 pb-5 space-y-4 border-t border-slate-800/50">
                {/* Search & Creator */}
                <div className="grid gap-4 md:grid-cols-2 mt-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 uppercase tracking-wide mb-1">
                      Search (Name, Code, Summary, Drills)
                    </label>
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      placeholder='e.g., "pressing trap", "3v2 overload", S-9M3P, D-AB12...'
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 uppercase tracking-wide mb-1">
                      Creator (Name or Email)
                    </label>
                    <input
                      type="text"
                      value={filters.creator}
                      onChange={(e) => setFilters({ ...filters, creator: e.target.value })}
                      placeholder="e.g., Alex, coach@club.com"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] text-slate-400 uppercase tracking-wide">Game Format</label>
                    <select
                      value={filters.gameFormat}
                      onChange={(e) => setFilters({ ...filters, gameFormat: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                    >
                      <option value="">All Formats</option>
                      <option value="7v7">7v7</option>
                      <option value="9v9">9v9</option>
                      <option value="11v11">11v11</option>
                    </select>
                  </div>
                  {activeTab === "drills" && (
                    <div className="space-y-1">
                      <label className="block text-[11px] text-slate-400 uppercase tracking-wide">Drill Type</label>
                      <select
                        value={filters.drillType}
                        onChange={(e) => setFilters({ ...filters, drillType: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                      >
                        <option value="">All Types</option>
                        <option value="WARMUP">Warm-up</option>
                        <option value="TECHNICAL">Technical</option>
                        <option value="TACTICAL">Tactical</option>
                        <option value="CONDITIONED_GAME">Conditioned Game</option>
                        <option value="COOLDOWN">Cool-down</option>
                      </select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="block text-[11px] text-slate-400 uppercase tracking-wide">Game Model</label>
                    <select
                      value={filters.gameModelId}
                      onChange={(e) => setFilters({ ...filters, gameModelId: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                    >
                      <option value="">All</option>
                      <option value="POSSESSION">Possession</option>
                      <option value="PRESSING">Pressing</option>
                      <option value="TRANSITION">Transition</option>
                      <option value="COACHAI">Balanced</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] text-slate-400 uppercase tracking-wide">Age Group</label>
                    <select
                      value={filters.ageGroup}
                      onChange={(e) => setFilters({ ...filters, ageGroup: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                    >
                      <option value="">All</option>
                      {["U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18"].map(age => (
                        <option key={age} value={age}>{age}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] text-slate-400 uppercase tracking-wide">Phase</label>
                    <select
                      value={filters.phase}
                      onChange={(e) => setFilters({ ...filters, phase: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                    >
                      <option value="">All</option>
                      <option value="ATTACKING">Attacking</option>
                      <option value="DEFENDING">Defending</option>
                      <option value="TRANSITION">Transition</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] text-slate-400 uppercase tracking-wide">Zone</label>
                    <select
                      value={filters.zone}
                      onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                    >
                      <option value="">All</option>
                      <option value="DEFENSIVE_THIRD">Defensive Third</option>
                      <option value="MIDDLE_THIRD">Middle Third</option>
                      <option value="ATTACKING_THIRD">Attacking Third</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/70 mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      id="favoritesOnly"
                      type="checkbox"
                      checked={filters.favoritesOnly}
                      onChange={(e) => setFilters({ ...filters, favoritesOnly: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                    />
                    <label htmlFor="favoritesOnly" className="text-[11px] text-slate-300">
                      Show <span className="font-semibold">favorites only</span> (applies to the active tab)
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFilters({
                        gameModelId: "",
                        ageGroup: "",
                        phase: "",
                        zone: "",
                        gameFormat: "",
                        drillType: "",
                        search: "",
                        creator: "",
                        favoritesOnly: false,
                      })
                    }
                    className="text-[11px] text-slate-400 hover:text-emerald-400 underline"
                  >
                    Clear all filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
            <p className="mt-4 text-sm text-slate-400">Loading vault...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-3xl border border-red-700/70 bg-red-900/20 px-6 py-4">
            <p className="text-sm text-red-300">Error: {error}</p>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <div className="grid grid-cols-1 gap-6">
            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {activeTab === "sessions" && (
                filteredSessions.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-8 text-center text-slate-400 md:col-span-2 xl:col-span-3">
                    <p className="mb-2">{sessions.length === 0 ? "No sessions in vault yet." : "No sessions match the selected filters."}</p>
                    {sessions.length === 0 && (
                      <Link href="/demo/session" className="text-emerald-400 hover:text-emerald-300 underline text-sm">
                        Generate your first session
                      </Link>
                    )}
                  </div>
                ) : (
                  filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className={`rounded-2xl border p-3 cursor-pointer transition-all ${
                        selectedSession?.id === session.id
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : "border-slate-700/70 bg-slate-900/70 hover:border-slate-600/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-xs text-slate-200 leading-tight">{session.title}</h3>
                            {session.refCode && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(session.refCode!);
                                }}
                                className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-[9px] font-mono border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors"
                                title="Click to copy"
                              >
                                {session.refCode}
                              </button>
                            )}
                          </div>
                          {session.durationMin && (
                            <div className="text-[9px] text-slate-500">
                              {session.durationMin} min session
                            </div>
                          )}
                          {(session.user || session.creator) && (
                            <div className="text-[9px] text-slate-500 mt-1">
                              Created by: <span className="text-slate-400">{(session.user || session.creator)?.name || (session.user || session.creator)?.email || 'Unknown'}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setScheduleModal({
                                sessionId: session.id,
                                sessionTitle: session.title,
                                sessionRefCode: session.refCode || undefined,
                              });
                            }}
                            className="px-2 py-1 rounded text-[10px] font-semibold bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/30 transition-colors"
                            title="Schedule Session"
                          >
                            📅
                          </button>
                          {sessionPlayerPlans.has(session.id) ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const planId = sessionPlayerPlans.get(session.id)!.id;
                                viewPlayerPlan(planId);
                              }}
                              className="px-2 py-1 rounded text-[10px] font-semibold bg-emerald-600/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/30 transition-colors flex items-center gap-1"
                              title="View Player Plan"
                            >
                              <span>✓</span>
                              <span>View Player</span>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCreatePlayerPlanModal({
                                  sourceType: "SESSION",
                                  sourceId: session.id,
                                  sourceRefCode: session.refCode || undefined,
                                });
                              }}
                              className="px-2 py-1 rounded text-[10px] font-semibold bg-cyan-600/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-600/30 transition-colors"
                              title="Create Player Version"
                            >
                              Player
                            </button>
                          )}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => toggleSessionFavorite(session.id, e)}
                              className={`w-6 h-6 flex items-center justify-center rounded border transition-colors ${
                                favoritedSessions.has(session.id)
                                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30"
                                  : "bg-slate-800/50 border-slate-600/50 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400"
                              }`}
                              title={favoritedSessions.has(session.id) ? "Remove from favorites" : "Add to favorites"}
                            >
                              <span className="text-xs font-bold">■</span>
                            </button>
                            {sessionCalendarCounts.has(session.id) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = "/calendar";
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded border bg-blue-500/20 border-blue-500/50 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                title={`${sessionCalendarCounts.get(session.id)} scheduled session(s) - Click to view calendar`}
                              >
                                <span className="text-xs">📅</span>
                                <span className="text-[8px] font-bold ml-0.5">{sessionCalendarCounts.get(session.id)}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70"></span>
                            <span className="text-emerald-400/70 font-medium">{gameModelLabel[session.gameModelId]}</span>
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="font-medium">{session.ageGroup}</span>
                        </div>
                        {(session.phase || session.zone) && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {session.phase && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">{phaseLabel[session.phase]}</span>
                            )}
                            {session.phase && session.zone && <span className="text-slate-600">•</span>}
                            {session.zone && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">{zoneLabel[session.zone]}</span>
                            )}
                          </div>
                        )}
                        {/* Formation, Coach Level, Player Level & Player Qty */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {session.formationUsed && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 text-[9px] border border-blue-700/30">
                              {session.formationUsed}
                            </span>
                          )}
                          {session.coachLevel && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-300 text-[9px] border border-amber-700/30">
                              Coach: {coachLevelLabel[session.coachLevel] || session.coachLevel}
                            </span>
                          )}
                          {session.playerLevel && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-300 text-[9px] border border-purple-700/30">
                              Player: {playerLevelLabel[session.playerLevel] || session.playerLevel}
                            </span>
                          )}
                          {(session.numbersMin || session.numbersMax) && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-300 text-[9px] border border-cyan-700/30">
                              {session.numbersMin === session.numbersMax 
                                ? `${session.numbersMin} players`
                                : `${session.numbersMin || '?'}-${session.numbersMax || '?'} players`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
                          <div className="text-[9px] text-slate-500">
                            {new Date(session.createdAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className="text-[9px] text-slate-600 font-mono">
                            {session.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTab === "drills" && (
                filteredDrills.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-8 text-center text-slate-400 md:col-span-2 xl:col-span-3">
                    <p className="mb-2">{allDrills.length === 0 ? "No drills in vault yet." : "No drills match the selected filters."}</p>
                    {allDrills.length === 0 && (
                      <Link href="/demo/session" className="text-emerald-400 hover:text-emerald-300 underline text-sm">
                        Generate a session to add drills
                      </Link>
                    )}
                  </div>
                ) : (
                  filteredDrills.map((drill) => {
                    const typeColors = drillTypeColors[drill.drillType] || drillTypeColors.TECHNICAL;
                    return (
                      <div
                        key={drill.id}
                        onClick={() => setSelectedDrill(drill)}
                        className={`rounded-2xl border p-3 cursor-pointer transition-all ${
                          selectedDrill?.id === drill.id
                            ? "border-emerald-500/50 bg-emerald-500/10"
                            : "border-slate-700/70 bg-slate-900/70 hover:border-slate-600/70"
                        }`}
                      >
                        {/* Drill Type Badge */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${typeColors.bg} ${typeColors.text} border ${typeColors.border}`}>
                            {drillTypeLabel[drill.drillType] || drill.drillType}
                          </span>
                          <div className="flex items-center gap-2">
                            {drill.durationMin > 0 && (
                              <span className="text-[9px] text-slate-500">{drill.durationMin} min</span>
                            )}
                            {drill.refCode && (() => {
                              const drillDbId = drillRefCodeToDbId.get(drill.refCode);
                              const isFavorited = drillDbId ? favoritedDrills.has(drillDbId) : false;
                              return (
                                <button
                                  onClick={(e) => toggleDrillFavorite(drill, e)}
                                  className={`w-5 h-5 flex items-center justify-center rounded border transition-colors ${
                                    isFavorited
                                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30"
                                      : "bg-slate-800/50 border-slate-600/50 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400"
                                  }`}
                                  title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                                >
                                  <span className="text-[10px] font-bold">■</span>
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                        
                        {/* Drill Title with Ref Code */}
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-xs text-slate-200 leading-tight">{drill.title}</h3>
                          {drill.refCode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(drill.refCode!);
                              }}
                              className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-[9px] font-mono border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors flex-shrink-0"
                              title="Click to copy"
                            >
                              {drill.refCode}
                            </button>
                          )}
                        </div>
                        
                        {/* Description Preview */}
                        {drill.description && (
                          <p className="text-[10px] text-slate-400 line-clamp-2 mb-2">
                            {drill.description}
                          </p>
                        )}
                        
                        {/* Session Info */}
                        <div className="text-[10px] text-slate-400 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70"></span>
                              <span className="text-emerald-400/70 font-medium">{gameModelLabel[drill.sessionGameModelId]}</span>
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="font-medium">{drill.sessionAgeGroup}</span>
                            {drill.sessionFormation && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-blue-300">{drill.sessionFormation}</span>
                              </>
                            )}
                          </div>
                          
                          {drill.sessionCreator && (
                            <div className="text-[9px] text-slate-500 mt-1">
                              Created by: <span className="text-slate-400">{drill.sessionCreator.name || drill.sessionCreator.email || 'Unknown'}</span>
                            </div>
                          )}
                          
                          {/* Quick Stats */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {drill.coachingPoints && drill.coachingPoints.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">
                                {drill.coachingPoints.length} coaching points
                              </span>
                            )}
                            {drill.progressions && drill.progressions.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-300 text-[9px]">
                                {drill.progressions.length} progressions
                              </span>
                            )}
                          </div>
                          
                          {/* From Session */}
                          <div className="pt-2 border-t border-slate-700/50">
                            <span className="text-[9px] text-slate-500">From: </span>
                            <span className="text-[9px] text-slate-400">{drill.sessionTitle}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              )}

              {activeTab === "series" && (
                filteredSeries.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-8 text-center text-slate-400 md:col-span-2 xl:col-span-3">
                    <p>{series.length === 0 ? "No series in vault yet." : "No series match the selected filters."}</p>
                  </div>
                ) : (
                filteredSeries.map((s) => {
                    const firstSession = s.sessions[0];
                    const seriesPhase = firstSession?.phase ? phaseLabel[firstSession.phase] : null;
                    const seriesZone = firstSession?.zone ? zoneLabel[firstSession.zone] : null;
                    
                    // Build unique descriptive series title from first session
                    let seriesTitle: string;
                    if (firstSession?.title) {
                      // Clean up the first session title to use as series title
                      let baseTitle = firstSession.title
                        .replace(/^(Session \d+:?\s*)/i, "") // Remove "Session 1:" prefix
                        .replace(/\s*-\s*Part\s*\d+/i, "")   // Remove "- Part 1" suffix
                        .trim();
                      
                      // If title is too long, truncate intelligently
                      if (baseTitle.length > 50) {
                        // Try to cut at a natural break point
                        const breakPoints = [" - ", ": ", " and ", " & "];
                        for (const bp of breakPoints) {
                          const idx = baseTitle.indexOf(bp);
                          if (idx > 15 && idx < 50) {
                            baseTitle = baseTitle.substring(0, idx);
                            break;
                          }
                        }
                        if (baseTitle.length > 50) {
                          baseTitle = baseTitle.substring(0, 47) + "...";
                        }
                      }
                      
                      seriesTitle = `${baseTitle} (${s.ageGroup})`;
                    } else {
                      // Fallback to game model + age group
                      seriesTitle = `${gameModelLabel[s.gameModelId] || s.gameModelId} Training (${s.ageGroup})`;
                    }

                    // Get ref code from first session with SR prefix for series display
                    const seriesRefCode = firstSession?.refCode;
                    
                    return (
                    <div
                      key={s.seriesId}
                      className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <h3 className="font-semibold text-xs text-slate-200 leading-tight">
                            {seriesTitle}
                          </h3>
                          {seriesRefCode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(seriesRefCode);
                              }}
                              className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-[9px] font-mono border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors"
                              title="Click to copy series ref"
                            >
                              {seriesRefCode}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // For series, open series scheduling modal
                              setScheduleSeriesModal({
                                seriesId: s.seriesId,
                                seriesTitle: s.sessions[0]?.title 
                                  ? s.sessions[0].title.replace(/^(Session \d+:?\s*)/i, "").replace(/\s*-\s*Part\s*\d+/i, "").trim()
                                  : `${s.totalSessions}-Session Series`,
                                sessions: s.sessions.map((sess) => ({
                                  id: sess.id,
                                  title: sess.title || `Session ${s.sessions.indexOf(sess) + 1}`,
                                  refCode: sess.refCode || undefined,
                                })),
                              });
                            }}
                            className="px-2 py-1 rounded text-[10px] font-semibold bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:bg-blue-600/30 transition-colors"
                            title="Schedule Series"
                          >
                            📅
                          </button>
                          {seriesPlayerPlans.has(s.seriesId) ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const planId = seriesPlayerPlans.get(s.seriesId)!.id;
                                viewPlayerPlan(planId);
                              }}
                              className="px-2 py-1 rounded text-[10px] font-semibold bg-emerald-600/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/30 transition-colors flex items-center gap-1"
                              title="View Player Plan"
                            >
                              <span>✓</span>
                              <span>View Player</span>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCreatePlayerPlanModal({
                                  sourceType: "SERIES",
                                  sourceId: s.seriesId,
                                  sourceRefCode: seriesRefCode || undefined,
                                });
                              }}
                              className="px-2 py-1 rounded text-[10px] font-semibold bg-cyan-600/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-600/30 transition-colors"
                              title="Create Player Version"
                            >
                              Player
                            </button>
                          )}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => toggleSeriesFavorite(s.seriesId, e)}
                              className={`w-6 h-6 flex items-center justify-center rounded border transition-colors ${
                                favoritedSeries.has(s.seriesId)
                                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30"
                                  : "bg-slate-800/50 border-slate-600/50 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400"
                              }`}
                              title={favoritedSeries.has(s.seriesId) ? "Remove from favorites" : "Add to favorites"}
                            >
                              <span className="text-xs font-bold">■</span>
                            </button>
                            {seriesCalendarCounts.has(s.seriesId) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = "/calendar";
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded border bg-blue-500/20 border-blue-500/50 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                title={`${seriesCalendarCounts.get(s.seriesId)} scheduled session(s) - Click to view calendar`}
                              >
                                <span className="text-xs">📅</span>
                                <span className="text-[8px] font-bold ml-0.5">{seriesCalendarCounts.get(s.seriesId)}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500 mb-2">
                        {s.totalSessions} Sessions {seriesPhase ? `• ${seriesPhase}` : ""} {seriesZone ? `• ${seriesZone}` : ""}
                      </p>
                      <div className="text-[10px] text-slate-400 mb-2">
                        <span className="text-emerald-400/70">{s.totalSessions} sessions</span>
                        {firstSession?.durationMin && (
                          <>
                            <span className="text-slate-600 mx-1">•</span>
                            <span>{firstSession.durationMin} min each</span>
                          </>
                        )}
                        {s.createdAt && (
                          <>
                            <span className="text-slate-600 mx-1">•</span>
                            <span>
                              {new Date(s.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </>
                        )}
                      </div>
                      {/* Formation, Coach Level, Player Level & Player Qty */}
                      <div className="flex items-center gap-2 flex-wrap mb-3 text-[10px]">
                        {firstSession?.formationUsed && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 text-[9px] border border-blue-700/30">
                            {firstSession.formationUsed}
                          </span>
                        )}
                        {firstSession?.coachLevel && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-300 text-[9px] border border-amber-700/30">
                            Coach: {coachLevelLabel[firstSession.coachLevel] || firstSession.coachLevel}
                          </span>
                        )}
                        {firstSession?.playerLevel && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-300 text-[9px] border border-purple-700/30">
                            Player: {playerLevelLabel[firstSession.playerLevel] || firstSession.playerLevel}
                          </span>
                        )}
                        {(firstSession?.numbersMin || firstSession?.numbersMax) && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-300 text-[9px] border border-cyan-700/30">
                            {firstSession.numbersMin === firstSession.numbersMax 
                              ? `${firstSession.numbersMin} players`
                              : `${firstSession.numbersMin || '?'}-${firstSession.numbersMax || '?'} players`}
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {s.sessions.map((session, idx) => (
                          <div
                            key={session.id}
                            onClick={() => setSelectedSession(session)}
                            className="text-[10px] py-1 px-2 rounded bg-slate-800/50 cursor-pointer hover:bg-slate-800 transition-colors border border-slate-700/50"
                          >
                            <div className="flex items-center gap-2">
                              {session.refCode && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(session.refCode!);
                                  }}
                                  className="px-1 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-[8px] font-mono border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors flex-shrink-0"
                                  title="Click to copy"
                                >
                                  {session.refCode}
                                </button>
                              )}
                              <span className="font-medium text-slate-200 line-clamp-1">
                                {session.title}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Link
                        href={`/demo/session?seriesId=${s.seriesId}`}
                        className="mt-2 inline-flex items-center text-[10px] text-emerald-400/70 hover:text-emerald-300"
                      >
                        View Full Series →
                      </Link>
                    </div>
                  )})
                )
              )}
            </div>
          </div>
        )}

        {selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-700/70 bg-slate-900/90 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-lg font-semibold text-slate-200">{selectedSession.title}</h2>
                    {selectedSession.refCode && (
                      <button
                        onClick={() => navigator.clipboard.writeText(selectedSession.refCode!)}
                        className="px-2 py-1 rounded bg-cyan-900/40 text-cyan-300 text-xs font-mono border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors"
                        title="Click to copy reference code"
                      >
                        {selectedSession.refCode}
                      </button>
                    )}
                    {(selectedSession.user || selectedSession.creator) && (
                      <div className="text-xs text-slate-400">
                        Created by: <span className="text-slate-300">{(selectedSession.user || selectedSession.creator)?.name || (selectedSession.user || selectedSession.creator)?.email || 'Unknown'}</span>
                      </div>
                    )}
                    <button
                      onClick={(e) => toggleSessionFavorite(selectedSession.id, e)}
                      className={`w-7 h-7 flex items-center justify-center rounded border transition-colors ${
                        favoritedSessions.has(selectedSession.id)
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30"
                          : "bg-slate-800/50 border-slate-600/50 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400"
                      }`}
                      title={favoritedSessions.has(selectedSession.id) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <span className="text-sm font-bold">■</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Game Model:</span>
                      <span className="text-emerald-400">{gameModelLabel[selectedSession.gameModelId]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Age:</span>
                      <span className="text-slate-200">{selectedSession.ageGroup}</span>
                    </div>
                    {selectedSession.phase && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Phase:</span>
                        <span className="text-slate-200">{phaseLabel[selectedSession.phase]}</span>
                      </div>
                    )}
                    {selectedSession.zone && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Zone:</span>
                        <span className="text-slate-200">{zoneLabel[selectedSession.zone]}</span>
                      </div>
                    )}
                    {selectedSession.formationUsed && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Formation:</span>
                        <span className="text-blue-300">{selectedSession.formationUsed}</span>
                      </div>
                    )}
                    {selectedSession.coachLevel && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Coach Level:</span>
                        <span className="text-amber-300">{coachLevelLabel[selectedSession.coachLevel] || selectedSession.coachLevel}</span>
                      </div>
                    )}
                    {selectedSession.playerLevel && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Player Level:</span>
                        <span className="text-purple-300">{playerLevelLabel[selectedSession.playerLevel] || selectedSession.playerLevel}</span>
                      </div>
                    )}
                    {(selectedSession.numbersMin || selectedSession.numbersMax) && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Players:</span>
                        <span className="text-cyan-300">
                          {selectedSession.numbersMin === selectedSession.numbersMax 
                            ? `${selectedSession.numbersMin}`
                            : `${selectedSession.numbersMin || '?'}-${selectedSession.numbersMax || '?'}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500"
                  aria-label="Close preview"
                >
                  ✕
                </button>
              </div>

              <div className="mt-6 space-y-6">
                {selectedSession.json?.summary && (
                  <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                    <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">Summary</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {selectedSession.json.summary}
                    </p>
                  </div>
                )}

                {skillFocus && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <h3 className="text-xs font-semibold text-emerald-300 uppercase tracking-wide mb-2">Player Skill Focus</h3>
                    <div className="text-sm font-semibold text-emerald-100">{skillFocus.title}</div>
                    {skillFocus.summary && (
                      <p className="mt-2 text-sm text-emerald-100/80">{skillFocus.summary}</p>
                    )}
                    {Array.isArray(skillFocus.keySkills) && skillFocus.keySkills.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Key Skills</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {skillFocus.keySkills.map((skill: string, i: number) => (
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
                          {skillFocus.coachingPoints.map((point: string, i: number) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(Array.isArray(skillFocus.psychologyGood) || Array.isArray(skillFocus.psychologyBad)) && (
                      <div className="mt-3">
                        <div className="text-[11px] text-emerald-200/70 uppercase tracking-widest">Psychological Watch</div>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          {Array.isArray(skillFocus.psychologyGood) && skillFocus.psychologyGood.length > 0 && (
                            <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
                              <div className="text-[11px] uppercase tracking-widest text-emerald-200/80">Encourage</div>
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-emerald-100/80">
                                {skillFocus.psychologyGood.map((item: string, i: number) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(skillFocus.psychologyBad) && skillFocus.psychologyBad.length > 0 && (
                            <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3">
                              <div className="text-[11px] uppercase tracking-widest text-rose-200/80">Correct</div>
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-rose-100/80">
                                {skillFocus.psychologyBad.map((item: string, i: number) => (
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
                                  {allEncourage.map((item: string, i: number) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {allCorrect.length > 0 && (
                              <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
                                <div className="text-[10px] uppercase tracking-widest text-rose-200/70">Correct</div>
                                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-rose-100/90">
                                  {allCorrect.map((item: string, i: number) => (
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

                {selectedSession.json?.drills && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">Drills</h3>
                    {selectedSession.json.drills.map((drill: any, i: number) => {
                      const diagram = drill.diagram ?? drill.json?.diagram ?? drill.json?.diagramV1;
                      const description = drill.description ?? drill.json?.description;
                      const organization = drill.organization ?? drill.json?.organization;

                      return (
                      <div key={i} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
                        {/* Drill Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${
                            drillTypeColors[drill.drillType]?.bg || "bg-slate-800"
                          } ${drillTypeColors[drill.drillType]?.text || "text-slate-300"} border ${
                            drillTypeColors[drill.drillType]?.border || "border-slate-700"
                          }`}>
                            {drillTypeLabel[drill.drillType] || drill.drillType}
                          </span>
                          {drill.durationMin && (
                            <span className="text-[10px] text-slate-500">{drill.durationMin} min</span>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm text-slate-200 mb-2">{drill.title}</h4>
                        
                        {/* Two-column layout: Diagram + Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Left: Diagram */}
                          {diagram && (
                            <div className="flex items-center justify-center">
                              <UniversalDrillDiagram
                                drillData={tacticalEdgeToUniversalDrillData(diagram, {
                                  title: drill.title ?? "Diagram",
                                  description,
                                  organization,
                                })}
                                size="small"
                              />
                            </div>
                          )}
                          
                          {/* Right: Description & Key Info */}
                          <div className="space-y-2">
                            {description && (
                              <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-4">{description}</p>
                            )}
                            {organization?.area && (
                              <div className="flex gap-2 text-[10px] text-slate-400">
                                {organization.area.lengthYards && (
                                  <span>{organization.area.lengthYards}x{organization.area.widthYards || '?'}y</span>
                                )}
                              </div>
                            )}
                            {drill.coachingPoints && drill.coachingPoints.length > 0 && (
                              <div>
                                <span className="text-[9px] text-slate-500 uppercase">Key Points:</span>
                                <ul className="text-[10px] text-slate-400 mt-1">
                                  {drill.coachingPoints.slice(0, 2).map((pt: string, j: number) => (
                                    <li key={j} className="truncate">• {pt}</li>
                                  ))}
                                  {drill.coachingPoints.length > 2 && (
                                    <li className="text-slate-500">+{drill.coachingPoints.length - 2} more</li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-700/50">
                  <button
                    onClick={async () => {
                      try {
                        if (!selectedSession?.id) return;
                        setGeneratingSkillFocus(true);
                        const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
                        const headers: Record<string, string> = { "Content-Type": "application/json" };
                        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
                        const response = await fetch("/api/skill-focus/session", {
                          method: "POST",
                          headers,
                          body: JSON.stringify({ sessionId: selectedSession.id }),
                        });
                        if (!response.ok) {
                          const error = await response.json();
                          alert("Error generating skill focus: " + (error.error || "Unknown error"));
                          return;
                        }
                        const data = await response.json();
                        setSkillFocus(data.focus || null);
                      } catch (e: any) {
                        alert("Error generating skill focus: " + e.message);
                      } finally {
                        setGeneratingSkillFocus(false);
                      }
                    }}
                    disabled={generatingSkillFocus}
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      skillFocus
                        ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                        : "border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700"
                    }`}
                  >
                    {generatingSkillFocus
                      ? "⚡ Generating..."
                      : skillFocus
                      ? "✓ Skill Focus Ready"
                      : "🎯 Skill Focus"}
                  </button>
                  <Link
                    href={`/demo/session?sessionId=${selectedSession.id}`}
                    onClick={() => {
                      try {
                        sessionStorage.setItem(
                          `vaultSession:${selectedSession.id}`,
                          JSON.stringify(selectedSession)
                        );
                      } catch {
                        // Non-fatal if storage is unavailable
                      }
                    }}
                    className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    View Full Session
                  </Link>
                  {userFeatures?.canExportPDF && (
                    <button
                      onClick={async () => {
                        try {
                          // Get auth token for authenticated requests
                          const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
                          const headers: Record<string, string> = {
                            "Content-Type": "application/json",
                          };
                          if (accessToken) {
                            headers["Authorization"] = `Bearer ${accessToken}`;
                          }
                          
                          const response = await fetch("/api/export-session-pdf", {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                              session: {
                                ...selectedSession.json,
                                id: selectedSession.id,
                              },
                            }),
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
                          a.download = `session-${selectedSession.title.replace(/[^a-z0-9]/gi, "-")}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                        } catch (e: any) {
                          alert("Error exporting PDF: " + e.message);
                        }
                      }}
                      className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
                    >
                      📄 Export PDF
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Drill Detail Modal */}
        {selectedDrill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-700/70 bg-slate-900/90 p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Drill Type Badge & Duration */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      drillTypeColors[selectedDrill.drillType]?.bg || "bg-slate-800"
                    } ${drillTypeColors[selectedDrill.drillType]?.text || "text-slate-300"} border ${
                      drillTypeColors[selectedDrill.drillType]?.border || "border-slate-700"
                    }`}>
                      {drillTypeLabel[selectedDrill.drillType] || selectedDrill.drillType}
                    </span>
                    {selectedDrill.durationMin > 0 && (
                      <span className="text-sm text-slate-400">{selectedDrill.durationMin} minutes</span>
                    )}
                  </div>

                  <h2 className="text-lg font-semibold mb-3 text-slate-200">{selectedDrill.title}</h2>
                  
                  {selectedDrill.sessionCreator && (
                    <div className="text-xs text-slate-400 mb-3">
                      Created by: <span className="text-slate-300">{selectedDrill.sessionCreator.name || selectedDrill.sessionCreator.email || 'Unknown'}</span>
                    </div>
                  )}

                  {/* Session Info */}
                  <div className="flex flex-wrap gap-3 text-sm mb-4 pb-4 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Topic:</span>
                      <span className="text-emerald-400">{gameModelLabel[selectedDrill.sessionGameModelId]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Age:</span>
                      <span className="text-slate-200">{selectedDrill.sessionAgeGroup}</span>
                    </div>
                    {selectedDrill.sessionPhase && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Phase:</span>
                        <span className="text-slate-200">{phaseLabel[selectedDrill.sessionPhase]}</span>
                      </div>
                    )}
                    {selectedDrill.sessionZone && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Zone:</span>
                        <span className="text-slate-200">{zoneLabel[selectedDrill.sessionZone]}</span>
                      </div>
                    )}
                    {selectedDrill.sessionFormation && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs uppercase tracking-wide">Formation:</span>
                        <span className="text-blue-300">{selectedDrill.sessionFormation}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDrill(null)}
                  className="text-slate-400 hover:text-slate-200 text-xl leading-none p-1"
                >
                  ×
                </button>
              </div>

              {/* Two-column layout: Diagram + Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Left: Diagram */}
                {(() => {
                  const diagram = selectedDrill.diagram ?? selectedDrill.json?.diagram ?? selectedDrill.json?.diagramV1;
                  const description = selectedDrill.description ?? selectedDrill.json?.description;
                  const organization = selectedDrill.organization ?? selectedDrill.json?.organization;

                  return (
                diagram && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Diagram</h3>
                    <div className="flex items-center justify-center">
                      <UniversalDrillDiagram
                        drillData={tacticalEdgeToUniversalDrillData(diagram, {
                          title: selectedDrill.title ?? "Diagram",
                          description,
                          organization,
                        })}
                        size="small"
                      />
                    </div>
                  </div>
                )
                  );
                })()}

                {/* Right: Description & Organization */}
                <div className="space-y-3">
                  {(() => {
                    const description = selectedDrill.description ?? selectedDrill.json?.description;
                    const organization = selectedDrill.organization ?? selectedDrill.json?.organization;

                    return (
                      <>
                        {/* Description */}
                        {description && (
                          <div>
                            <h3 className="text-sm font-semibold text-slate-300 mb-1">Description</h3>
                            <p className="text-xs text-slate-400">{description}</p>
                          </div>
                        )}

                        {/* Area Dimensions */}
                        {organization?.area && (
                          <div className="flex gap-3 text-xs">
                            {organization.area.lengthYards && (
                              <span className="text-slate-400">
                                <span className="text-slate-500">Length:</span> {organization.area.lengthYards}y
                              </span>
                            )}
                            {organization.area.widthYards && (
                              <span className="text-slate-400">
                                <span className="text-slate-500">Width:</span> {organization.area.widthYards}y
                              </span>
                            )}
                          </div>
                        )}

                        {/* Rotation & Scoring */}
                        {organization?.rotation && (
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Rotation:</span>
                            <p className="text-xs text-slate-400">{organization.rotation}</p>
                          </div>
                        )}
                        {organization?.scoring && (
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Scoring:</span>
                            <p className="text-xs text-slate-400">{organization.scoring}</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Setup Steps */}
              {(selectedDrill.organization ?? selectedDrill.json?.organization)?.setupSteps &&
                (selectedDrill.organization ?? selectedDrill.json?.organization)?.setupSteps.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Setup Steps</h3>
                  <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1">
                    {(selectedDrill.organization ?? selectedDrill.json?.organization)?.setupSteps?.map((step: string, i: number) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Two-column: Coaching Points & Progressions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Coaching Points */}
                {selectedDrill.coachingPoints && selectedDrill.coachingPoints.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Coaching Points</h3>
                    <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                      {selectedDrill.coachingPoints.map((point: string, i: number) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Progressions */}
                {selectedDrill.progressions && selectedDrill.progressions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Progressions</h3>
                    <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1">
                      {selectedDrill.progressions.map((prog: string, i: number) => (
                        <li key={i}>{prog}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-700/50">
                <button
                  onClick={() => {
                    const session = sessions.find(s => s.id === selectedDrill.sessionId);
                    if (session) {
                      setSelectedDrill(null);
                      setSelectedSession(session);
                    }
                  }}
                  className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  View Full Session
                </button>
                <button
                  onClick={() => setSelectedDrill(null)}
                  className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Player Plan Modal */}
      {viewPlayerPlanModal && (
        <div className="fixed inset-0 z-50">
          <PlayerPlanViewModal
            plan={viewPlayerPlanModal}
            onClose={() => setViewPlayerPlanModal(null)}
          />
        </div>
      )}
      {scheduleModal && (
        <ScheduleSessionModal
          sessionId={scheduleModal.sessionId}
          sessionTitle={scheduleModal.sessionTitle}
          sessionRefCode={scheduleModal.sessionRefCode}
          onClose={() => setScheduleModal(null)}
          onScheduled={() => {
            // Optionally refresh calendar or show success message
            console.log("[VAULT] Session scheduled successfully");
            // Refresh calendar counts
            const sessionIds = sessions.map((s) => s.id);
            if (sessionIds.length > 0) {
              checkSessionCalendarCounts(sessionIds).catch(() => {});
            }
            const seriesIds = series.map((s) => s.seriesId);
            if (seriesIds.length > 0) {
              checkSeriesCalendarCounts(seriesIds).catch(() => {});
            }
          }}
        />
      )}
      {scheduleSeriesModal && (
        <ScheduleSeriesModal
          seriesId={scheduleSeriesModal.seriesId}
          seriesTitle={scheduleSeriesModal.seriesTitle}
          sessions={scheduleSeriesModal.sessions}
          onClose={() => setScheduleSeriesModal(null)}
          onScheduled={() => {
            // Optionally refresh calendar or show success message
            console.log("[VAULT] Series scheduled successfully");
            // Refresh calendar counts
            const sessionIds = sessions.map((s) => s.id);
            if (sessionIds.length > 0) {
              checkSessionCalendarCounts(sessionIds).catch(() => {});
            }
            const seriesIds = series.map((s) => s.seriesId);
            if (seriesIds.length > 0) {
              checkSeriesCalendarCounts(seriesIds).catch(() => {});
            }
          }}
        />
      )}
      {createPlayerPlanModal && (
        <CreatePlayerPlanModal
          sourceType={createPlayerPlanModal.sourceType}
          sourceId={createPlayerPlanModal.sourceId}
          sourceRefCode={createPlayerPlanModal.sourceRefCode}
          onClose={() => {
            console.log("[VAULT] Closing player plan modal");
            setCreatePlayerPlanModal(null);
          }}
          onPlanCreated={(planId, sourceId, sourceType) => {
            console.log("[VAULT] Plan created callback:", { planId, sourceId, sourceType });
            // Update the player plan status when a new plan is created
            // This should NOT close the modal - the modal will show the plan
            const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
            if (accessToken) {
              // Fetch the plan details to get refCode (async, non-blocking)
              fetch(`/api/player-plans/${planId}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
              })
                .then((res) => res.json())
                .then((data) => {
                  if (data.ok && data.plan) {
                    if (sourceType === "SESSION") {
                      setSessionPlayerPlans((prev) => {
                        const next = new Map(prev);
                        next.set(sourceId, {
                          id: data.plan.id,
                          refCode: data.plan.refCode,
                        });
                        return next;
                      });
                    } else {
                      setSeriesPlayerPlans((prev) => {
                        const next = new Map(prev);
                        next.set(sourceId, {
                          id: data.plan.id,
                          refCode: data.plan.refCode,
                        });
                        return next;
                      });
                    }
                  }
                })
                .catch((err) => {
                  console.error("[VAULT] Error updating player plan status:", err);
                });
            }
          }}
        />
      )}
    </main>
  );
}
