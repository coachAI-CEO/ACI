"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getUserId } from "@/lib/user";

const AGE_GROUP_OPTIONS = [
  { label: "U8", value: "U8" },
  { label: "U9", value: "U9" },
  { label: "U10", value: "U10" },
  { label: "U11", value: "U11" },
  { label: "U12", value: "U12" },
  { label: "U13", value: "U13" },
  { label: "U14", value: "U14" },
  { label: "U15", value: "U15" },
  { label: "U16", value: "U16" },
  { label: "U17", value: "U17" },
  { label: "U18", value: "U18" },
];

const COLOR_OPTIONS = ["blue", "red", "white", "black", "yellow", "green"];
const COACH_LEVEL_OPTIONS = [
  { value: "GRASSROOTS", label: "Grassroots" },
  { value: "USSF_C", label: "USSF C" },
  { value: "USSF_B_PLUS", label: "USSF B+" },
];
const GAME_MODEL_LABELS: Record<string, string> = {
  POSSESSION: "Possession",
  PRESSING: "Pressing",
  TRANSITION: "Transition",
  COACHAI: "Balanced (CoachAI)",
};
const PHASE_LABELS: Record<string, string> = {
  ATTACKING: "Attacking",
  DEFENDING: "Defending",
  TRANSITION: "Transition",
};
const ZONE_LABELS: Record<string, string> = {
  DEFENSIVE_THIRD: "Defensive third",
  MIDDLE_THIRD: "Middle third",
  ATTACKING_THIRD: "Attacking third",
};

function formatColorLabel(color: string): string {
  if (!color) return color;
  return color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
}

function formatEnumLabel(value: string): string {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cleanAnalysisTitle(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "Untitled";
  return raw.replace(/^COACHAI:\s*/i, "").trim();
}

function prettifyVaultTitle(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "Untitled";
  return raw
    .replace(/\bCOACHAI\b/gi, "Balanced")
    .replace(/_/g, " ")
    .replace(/\bvideo-analysis\b/gi, "Video Analysis")
    .replace(/\s+/g, " ")
    .trim();
}

function toDisplayTitle(value: unknown): string {
  const raw = prettifyVaultTitle(value);
  if (!raw) return "Untitled analysis";
  const lowered = raw.toLowerCase();
  return lowered
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      if (/^u\d+$/i.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function extractIsoDate(value: unknown): string {
  const raw = String(value || "");
  const m = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return m ? m[1] : "";
}

function buildAnalysisTitle(input: {
  ageGroup?: string;
  gameModelId?: string;
  phase?: string;
  zone?: string;
}): string {
  const gameModel =
    GAME_MODEL_LABELS[String(input.gameModelId || "").toUpperCase()] || formatEnumLabel(String(input.gameModelId || ""));
  const phase = PHASE_LABELS[String(input.phase || "").toUpperCase()] || formatEnumLabel(String(input.phase || ""));
  const zone = ZONE_LABELS[String(input.zone || "").toUpperCase()] || formatEnumLabel(String(input.zone || ""));
  return `${input.ageGroup || "N/A"} Video Analysis • ${gameModel || "N/A"} / ${phase || "N/A"} / ${zone || "N/A"}`;
}

function getMissionAssessment(item: VideoAnalysisItem): "Good" | "Needs Work" {
  const severity = String(item?.severity || "").toLowerCase();
  const scope = String(item?.scopeTag || "").toUpperCase();
  const text = `${item?.title || ""} ${item?.whatHappened || ""}`.toLowerCase();

  if (severity === "critical" || severity === "major") return "Needs Work";
  if (scope === "OUT_OF_SCOPE") return "Needs Work";

  const negativePatterns = [
    "lack",
    "failed",
    "failure",
    "turnover",
    "lost",
    "poor",
    "slow",
    "late",
    "rushed",
    "forced",
    "mistake",
    "error",
    "broken",
    "collapsed",
    "disconnected",
  ];
  const positivePatterns = [
    "good",
    "effective",
    "successful",
    "compact",
    "balanced",
    "support",
    "cover",
    "denying",
    "denied",
    "won",
    "controlled",
    "maintained",
    "improved",
  ];

  if (negativePatterns.some((p) => text.includes(p))) return "Needs Work";
  if (positivePatterns.some((p) => text.includes(p))) return "Good";

  return severity === "minor" && scope === "IN_SCOPE" ? "Good" : "Needs Work";
}

function parseTimestampToSeconds(value: unknown): number {
  const raw = String(value || "").trim();
  if (!raw) return Number.POSITIVE_INFINITY;
  const first = raw.split("-")[0]?.trim() || raw;
  const parts = first.split(":").map((p) => Number(p.trim()));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return Number.POSITIVE_INFINITY;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Number.POSITIVE_INFINITY;
}

function toHexColor(value: unknown, fallback: string): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
  const map: Record<string, string> = {
    blue: "#3b82f6",
    red: "#ef4444",
    white: "#f8fafc",
    black: "#111827",
    yellow: "#facc15",
    green: "#22c55e",
  };
  return map[raw] || fallback;
}

type TacticalAnimFrame = {
  frameId?: string;
  timestamp?: string;
  notes?: string;
  ball?: { x?: number; y?: number };
  arrows?: Array<{ type?: string; from?: { x?: number; y?: number }; to?: { x?: number; y?: number }; team?: string }>;
  players?: Array<{ x?: number; y?: number; id?: string; team?: "A" | "B" }>;
};

function getFormationBucketAge(ageGroup: string): string {
  const raw = String(ageGroup || "").trim();
  const m = raw.match(/U(\d{1,2})/i);
  if (!m) return "U18";
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return "U18";
  if (n <= 8) return "U8";
  if (n <= 9) return "U9";
  if (n <= 10) return "U10";
  if (n <= 11) return "U11";
  if (n <= 12) return "U12";
  if (n <= 13) return "U13";
  if (n <= 14) return "U14";
  if (n <= 15) return "U15";
  if (n <= 16) return "U16";
  if (n <= 17) return "U17";
  return "U18";
}

function getDefaultFormationForAgeGroup(ageGroup: string): string {
  const bucket = getFormationBucketAge(ageGroup);
  if (["U8", "U9", "U10", "U11", "U12"].includes(bucket)) return "2-3-1";
  if (["U13", "U14"].includes(bucket)) return "3-2-3";
  return "4-3-3";
}

function getValidFormationsForAgeGroup(ageGroup: string): string[] {
  const bucket = getFormationBucketAge(ageGroup);
  if (["U8", "U9", "U10", "U11", "U12"].includes(bucket)) return ["2-3-1", "3-2-1"];
  if (["U13", "U14"].includes(bucket)) return ["3-2-3", "2-3-2-1", "3-3-2"];
  return ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"];
}


type VideoAnalysisItem = {
  id?: string;
  category?: string;
  scopeTag?: string;
  teamFocus?: string;
  title?: string;
  severity?: string;
  confidence?: number | string;
  timestamp?: string;
  whatHappened?: string;
  teamAImplication?: string;
  diagramFrameIds?: string[];
};

type AnalysisHistoryEntry = {
  analysis: any | null;
  cached: boolean;
  cacheHits: number | null;
  previewUrl: string;
};

type VideoVaultItem = {
  id: string;
  refCode?: string | null;
  title: string;
  ageGroup?: string;
  playerLevel?: string;
  coachLevel?: string;
  gameModelId?: string;
  phase?: string;
  zone?: string;
  focusTeamColor?: string;
  opponentTeamColor?: string;
  formationUsed?: string;
  sourceFileUri?: string | null;
  fileUriUsed?: string | null;
  model?: string | null;
  analysis?: any;
  createdAt?: string;
};

export default function VideoAnalysisPage() {
  const ANIM_STEP_MS = 1400;
  const [videoContext, setVideoContext] = useState({
    ageGroup: "",
    playerLevel: "",
    coachLevel: "",
    formationUsed: "",
    gameModelId: "",
    phase: "",
    zone: "",
    focusTeamColor: "",
    opponentTeamColor: "",
    fileUri: "",
  });
  const [videoAnalysis, setVideoAnalysis] = useState<any | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [videoCached, setVideoCached] = useState<boolean | null>(null);
  const [videoCacheHits, setVideoCacheHits] = useState<number | null>(null);
  const [videoModel, setVideoModel] = useState<string>("");
  const [videoFileUriUsed, setVideoFileUriUsed] = useState<string>("");
  const [savingToVault, setSavingToVault] = useState(false);
  const [vaultSaveMessage, setVaultSaveMessage] = useState<string | null>(null);
  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultItems, setVaultItems] = useState<VideoVaultItem[]>([]);
  const [currentAnalysisTitle, setCurrentAnalysisTitle] = useState<string>("");
  const [currentAnalysisRefCode, setCurrentAnalysisRefCode] = useState<string>("");
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [confirmRunOpen, setConfirmRunOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const analysisItems: VideoAnalysisItem[] = useMemo(
    () => (Array.isArray(videoAnalysis?.analysisArray) ? videoAnalysis.analysisArray : []),
    [videoAnalysis]
  );
  const overallSummary = useMemo(
    () => String(videoAnalysis?.overall?.summary || "").trim(),
    [videoAnalysis]
  );
  const topPriorities: string[] = useMemo(
    () => (Array.isArray(videoAnalysis?.overall?.topPriorities) ? videoAnalysis.overall.topPriorities : []),
    [videoAnalysis]
  );
  const qualityRisks: string[] = useMemo(
    () => (Array.isArray(videoAnalysis?.overall?.videoQualityRisks) ? videoAnalysis.overall.videoQualityRisks : []),
    [videoAnalysis]
  );
  const scopeSummary = useMemo(
    () => String(videoAnalysis?.overall?.scopeSummary || "").trim(),
    [videoAnalysis]
  );
  const isVideoFormValid = useMemo(() => {
    return (
      videoContext.ageGroup.trim().length > 0 &&
      videoContext.playerLevel.trim().length > 0 &&
      videoContext.coachLevel.trim().length > 0 &&
      videoContext.formationUsed.trim().length > 0 &&
      videoContext.gameModelId.trim().length > 0 &&
      videoContext.phase.trim().length > 0 &&
      videoContext.zone.trim().length > 0 &&
      videoContext.focusTeamColor.trim().length > 0 &&
      videoContext.opponentTeamColor.trim().length > 0 &&
      videoContext.fileUri.trim().length > 0
    );
  }, [videoContext]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of analysisItems) {
      const key = String(item?.category || "unknown").toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [analysisItems]);
  const scopeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of analysisItems) {
      const key = String(item?.scopeTag || "UNSPECIFIED").toUpperCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [analysisItems]);
  const sortedAnalysisItems = useMemo(
    () =>
      [...analysisItems].sort((a, b) => {
        const ta = parseTimestampToSeconds(a.timestamp);
        const tb = parseTimestampToSeconds(b.timestamp);
        if (ta !== tb) return ta - tb;
        return String(a.id || "").localeCompare(String(b.id || ""));
      }),
    [analysisItems]
  );
  const timelineItems = useMemo(() => {
    const focusFirst = sortedAnalysisItems.filter((item) => {
      const teamFocus = String(item?.teamFocus || "").toUpperCase();
      const implication = String(item?.teamAImplication || "").trim();
      return teamFocus === "TEAM_A" || teamFocus === "BOTH" || implication.length > 0;
    });
    if (focusFirst.length >= Math.max(8, Math.ceil(sortedAnalysisItems.length * 0.6))) {
      return focusFirst;
    }
    return sortedAnalysisItems;
  }, [sortedAnalysisItems]);
  const analysisContext = useMemo(
    () => (videoAnalysis?.context && typeof videoAnalysis.context === "object" ? videoAnalysis.context : {}),
    [videoAnalysis]
  );
  const resolvedGameModel = useMemo(
    () => String(videoContext.gameModelId || analysisContext.gameModelId || "").toUpperCase(),
    [videoContext.gameModelId, analysisContext]
  );
  const resolvedPhase = useMemo(
    () => String(videoContext.phase || analysisContext.phase || "").toUpperCase(),
    [videoContext.phase, analysisContext]
  );
  const resolvedZone = useMemo(
    () => String(videoContext.zone || analysisContext.zone || "").toUpperCase(),
    [videoContext.zone, analysisContext]
  );
  const resolvedCoachLevel = useMemo(
    () => String(videoContext.coachLevel || analysisContext.coachLevel || "").toUpperCase(),
    [videoContext.coachLevel, analysisContext]
  );
  const resolvedFormation = useMemo(
    () => String(videoContext.formationUsed || analysisContext.formationUsed || "").trim(),
    [videoContext.formationUsed, analysisContext]
  );
  const formationDisplay = resolvedFormation || "Select formation";
  const formationOptions = useMemo(
    () => (videoContext.ageGroup ? getValidFormationsForAgeGroup(videoContext.ageGroup) : []),
    [videoContext.ageGroup]
  );
  const resolvedAgeGroup = useMemo(
    () => String(videoContext.ageGroup || analysisContext.ageGroup || "").trim(),
    [videoContext.ageGroup, analysisContext]
  );
  const analysisDisplayTitle = useMemo(
    () =>
      (currentAnalysisTitle ? toDisplayTitle(currentAnalysisTitle) : "") ||
      buildAnalysisTitle({
        ageGroup: resolvedAgeGroup,
        gameModelId: resolvedGameModel,
        phase: resolvedPhase,
        zone: resolvedZone,
      }),
    [currentAnalysisTitle, resolvedAgeGroup, resolvedGameModel, resolvedPhase, resolvedZone]
  );
  const analysisDisplayDate = useMemo(
    () => extractIsoDate(currentAnalysisTitle) || extractIsoDate(analysisDisplayTitle),
    [currentAnalysisTitle, analysisDisplayTitle]
  );
  const analysisDisplayTitleWithoutDate = useMemo(
    () => String(analysisDisplayTitle || "").replace(/\b\d{4}-\d{2}-\d{2}\b/g, "").replace(/\s+/g, " ").trim(),
    [analysisDisplayTitle]
  );
  const animationFrames: TacticalAnimFrame[] = useMemo(() => {
    const frames = Array.isArray(videoAnalysis?.diagramFrames) ? videoAnalysis.diagramFrames : [];
    return [...frames].sort((a, b) => parseTimestampToSeconds((a as any)?.timestamp) - parseTimestampToSeconds((b as any)?.timestamp));
  }, [videoAnalysis]);
  const [animFrameIdx, setAnimFrameIdx] = useState(0);
  const [animPlaying, setAnimPlaying] = useState(false);
  const currentAnimFrame = animationFrames[animFrameIdx] || null;
  const focusTeamFill = useMemo(
    () => toHexColor(videoAnalysis?.teamDefinition?.focusTeam?.color || videoContext.focusTeamColor, "#3b82f6"),
    [videoAnalysis, videoContext.focusTeamColor]
  );
  const opponentTeamFill = useMemo(
    () => toHexColor(videoAnalysis?.teamDefinition?.opponentTeam?.color || videoContext.opponentTeamColor, "#f8fafc"),
    [videoAnalysis, videoContext.opponentTeamColor]
  );

  useEffect(() => {
    setAnimFrameIdx(0);
    setAnimPlaying(false);
  }, [videoAnalysis]);

  useEffect(() => {
    if (!animPlaying || animationFrames.length === 0) return;
    const timer = setInterval(() => {
      setAnimFrameIdx((prev) => {
        if (prev >= animationFrames.length - 1) {
          setAnimPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, ANIM_STEP_MS);
    return () => clearInterval(timer);
  }, [animPlaying, animationFrames.length, ANIM_STEP_MS]);

  const getAuthHeaders = () => {
    const accessToken =
      typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const userId = getUserId();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (!accessToken && userId) headers["x-user-id"] = userId;
    return headers;
  };

  const runFullVideoAnalysis = async (
    contextOverride?: Partial<typeof videoContext>,
    options?: { forceRefresh?: boolean }
  ) => {
    const runContext = contextOverride ? { ...videoContext, ...contextOverride } : videoContext;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setVideoLoading(true);
    setVideoError(null);
    setVaultSaveMessage(null);
    setVideoCached(null);
    setVideoCacheHits(null);
    try {
      const res = await fetch("/api/video-analysis/run", {
        method: "POST",
        headers: getAuthHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          ...runContext,
          dryRun: false,
          forceRefresh: Boolean(options?.forceRefresh),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const detailText =
          typeof data?.details === "string"
            ? data.details
            : data?.details?.message
              ? data.details.message
              : data?.details
                ? JSON.stringify(data.details)
                : "";
        throw new Error(`${data?.error || `API error: ${res.status}`}${detailText ? `: ${detailText}` : ""}`);
      }
      const nextPreviewUrl = /^https?:\/\//i.test(runContext.fileUri) ? runContext.fileUri : "";
      const nextCached = Boolean(data?.cached);
      const nextCacheHits = typeof data?.cache?.hits === "number" ? data.cache.hits : null;
      const nextAnalysis = data.analysis || null;
      setVideoAnalysis(nextAnalysis);
      setVideoCached(nextCached);
      setVideoCacheHits(nextCacheHits);
      setVideoModel(String(data?.model || ""));
      setVideoFileUriUsed(String(data?.fileUriUsed || ""));
      setCurrentAnalysisRefCode("");
      setCurrentAnalysisTitle(
        buildAnalysisTitle({
          ageGroup: runContext.ageGroup,
          gameModelId: runContext.gameModelId,
          phase: runContext.phase,
          zone: runContext.zone,
        })
      );
      setVideoPreviewUrl(nextPreviewUrl);
      const nextEntry: AnalysisHistoryEntry = {
        analysis: nextAnalysis,
        cached: nextCached,
        cacheHits: nextCacheHits,
        previewUrl: nextPreviewUrl,
      };
      let nextIndex = -1;
      setAnalysisHistory((prev) => {
        const base = historyIndex >= 0 ? prev.slice(0, historyIndex + 1) : prev;
        const updated = [...base, nextEntry];
        nextIndex = updated.length - 1;
        return updated;
      });
      if (nextIndex >= 0) setHistoryIndex(nextIndex);
      if (nextAnalysis) {
        await autoSaveAnalysisToVault(nextAnalysis, {
          sourceFileUri: nextPreviewUrl || undefined,
          fileUriUsed: String(data?.fileUriUsed || ""),
          model: String(data?.model || ""),
        });
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setVideoError("Video analysis canceled.");
        return;
      }
      setVideoError(e?.message || "Failed to run video analysis");
      setVideoCached(null);
      setVideoCacheHits(null);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setVideoLoading(false);
    }
  };

  const cancelVideoAnalysis = () => {
    abortControllerRef.current?.abort();
  };

  const requestRunConfirmation = () => {
    if (videoLoading || !isVideoFormValid) return;
    setConfirmRunOpen(true);
  };

  const confirmAndRun = async () => {
    setConfirmRunOpen(false);
    await runFullVideoAnalysis();
  };

  const goToPreviousAnalysis = () => {
    if (historyIndex <= 0) return;
    const prevIndex = historyIndex - 1;
    const prev = analysisHistory[prevIndex];
    if (!prev) return;
    setHistoryIndex(prevIndex);
    setVideoAnalysis(prev.analysis);
    setVideoCached(prev.cached);
    setVideoCacheHits(prev.cacheHits);
    setVideoPreviewUrl(prev.previewUrl);
    if (!currentAnalysisRefCode) setCurrentAnalysisRefCode("");
    setVideoError(null);
  };

  const autoSaveAnalysisToVault = async (
    analysisInput: any,
    overrides?: { sourceFileUri?: string; fileUriUsed?: string; model?: string }
  ) => {
    if (!analysisInput) return;
    try {
      const analysisCtx =
        analysisInput?.context && typeof analysisInput.context === "object"
          ? analysisInput.context
          : {};
      const payload = {
        ageGroup: String(videoContext.ageGroup || analysisCtx.ageGroup || "").trim(),
        playerLevel: String(videoContext.playerLevel || analysisCtx.playerLevel || "").trim(),
        coachLevel: String(videoContext.coachLevel || analysisCtx.coachLevel || "").trim(),
        gameModelId: String(videoContext.gameModelId || analysisCtx.gameModelId || "").trim(),
        phase: String(videoContext.phase || analysisCtx.phase || "").trim(),
        zone: String(videoContext.zone || analysisCtx.zone || "").trim(),
        focusTeamColor: String(videoContext.focusTeamColor || analysisCtx.focusTeamColor || "").trim(),
        opponentTeamColor: String(videoContext.opponentTeamColor || analysisCtx.opponentTeamColor || "").trim(),
        sourceFileUri: overrides?.sourceFileUri || (/^https?:\/\//i.test(String(videoContext.fileUri || "").trim()) ? String(videoContext.fileUri).trim() : undefined),
        fileUriUsed: overrides?.fileUriUsed || videoFileUriUsed || undefined,
        model: overrides?.model || videoModel || undefined,
        analysis: analysisInput,
        context: {
          scopeSummary: String(analysisInput?.overall?.scopeSummary || "").trim() || scopeSummary,
          formationUsed: String(
            resolvedFormation ||
              analysisInput?.context?.formationUsed ||
              videoContext.formationUsed ||
              analysisCtx?.formationUsed ||
              ""
          ).trim(),
          savedFrom: "video-analysis-page",
          autoSaved: true,
        },
      };

      const res = await fetch("/api/video-analysis/vault/save", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) return;
      const savedRef = String(data?.item?.refCode || "").trim();
      if (savedRef) setCurrentAnalysisRefCode(savedRef);
      if (data?.item?.title) setCurrentAnalysisTitle(String(data.item.title));
      setVaultSaveMessage(savedRef ? `Auto-saved to Video Analysis Vault (${savedRef}).` : "Auto-saved to Video Analysis Vault.");
    } catch {
      // Non-blocking: run should still complete even if auto-save fails.
    }
  };

  const saveToVideoAnalysisVault = async () => {
    if (!videoAnalysis || savingToVault) return;
    setSavingToVault(true);
    setVaultSaveMessage(null);
    try {
      const analysisContext = (videoAnalysis?.context && typeof videoAnalysis.context === "object")
        ? videoAnalysis.context
        : {};
      const payload = {
        ageGroup: String(videoContext.ageGroup || analysisContext.ageGroup || "").trim(),
        playerLevel: String(videoContext.playerLevel || analysisContext.playerLevel || "").trim(),
        coachLevel: String(videoContext.coachLevel || analysisContext.coachLevel || "").trim(),
        gameModelId: String(videoContext.gameModelId || analysisContext.gameModelId || "").trim(),
        phase: String(videoContext.phase || analysisContext.phase || "").trim(),
        zone: String(videoContext.zone || analysisContext.zone || "").trim(),
        focusTeamColor: String(videoContext.focusTeamColor || analysisContext.focusTeamColor || "").trim(),
        opponentTeamColor: String(videoContext.opponentTeamColor || analysisContext.opponentTeamColor || "").trim(),
        sourceFileUri: /^https?:\/\//i.test(String(videoContext.fileUri || "").trim())
          ? String(videoContext.fileUri).trim()
          : undefined,
        fileUriUsed: videoFileUriUsed || undefined,
        model: videoModel || undefined,
        analysis: videoAnalysis,
        context: {
          scopeSummary,
          formationUsed: String(
            resolvedFormation ||
              videoAnalysis?.context?.formationUsed ||
              analysisContext?.formationUsed ||
              videoContext.formationUsed ||
              ""
          ).trim(),
          savedFrom: "video-analysis-page",
        },
      };

      const missing = [
        payload.ageGroup ? null : "ageGroup",
        payload.playerLevel ? null : "playerLevel",
        payload.coachLevel ? null : "coachLevel",
        payload.gameModelId ? null : "gameModelId",
        payload.phase ? null : "phase",
        payload.zone ? null : "zone",
        payload.focusTeamColor ? null : "focusTeamColor",
        payload.opponentTeamColor ? null : "opponentTeamColor",
      ].filter(Boolean) as string[];
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(", ")}`);
      }

      const res = await fetch("/api/video-analysis/vault/save", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const detailText = Array.isArray(data?.details)
          ? data.details.map((d: any) => `${d?.path || "field"}: ${d?.message || "invalid"}`).join("; ")
          : typeof data?.details?.message === "string"
            ? data.details.message
            : "";
        throw new Error(`${data?.error || `Save failed (${res.status})`}${detailText ? ` - ${detailText}` : ""}`);
      }
      const savedRef = String(data?.item?.refCode || "").trim();
      if (savedRef) setCurrentAnalysisRefCode(savedRef);
      if (data?.item?.title) setCurrentAnalysisTitle(String(data.item.title));
      setVaultSaveMessage(savedRef ? `Saved to Video Analysis Vault (${savedRef}).` : "Saved to Video Analysis Vault.");
    } catch (e: any) {
      setVaultSaveMessage(e?.message || "Failed to save to vault.");
    } finally {
      setSavingToVault(false);
    }
  };

  const openVideoVault = async () => {
    setVaultModalOpen(true);
    setVaultLoading(true);
    setVaultError(null);
    try {
      const res = await fetch("/api/video-analysis/vault/list?limit=40", {
        method: "GET",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Failed to load vault (${res.status})`);
      }
      setVaultItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setVaultItems([]);
      setVaultError(e?.message || "Failed to load vault");
    } finally {
      setVaultLoading(false);
    }
  };

  const openVaultAnalysisItem = (item: VideoVaultItem) => {
    const loadedAnalysis = item.analysis || null;
    setVideoAnalysis(loadedAnalysis);
    setVideoCached(null);
    setVideoCacheHits(null);
    setVideoModel(String(item.model || ""));
    setCurrentAnalysisRefCode(String(item.refCode || ""));
    setCurrentAnalysisTitle(String(item.title || ""));
    const preview = String(item.sourceFileUri || item.fileUriUsed || "");
    setVideoPreviewUrl(/^https?:\/\//i.test(preview) ? preview : "");
    const nextEntry: AnalysisHistoryEntry = {
      analysis: loadedAnalysis,
      cached: false,
      cacheHits: null,
      previewUrl: /^https?:\/\//i.test(preview) ? preview : "",
    };
    setAnalysisHistory((prev) => {
      const updated = [...prev, nextEntry];
      setHistoryIndex(updated.length - 1);
      return updated;
    });
    setVaultModalOpen(false);
  };

  const rerunVaultAnalysisItem = async (item: VideoVaultItem) => {
    const fileUri = String(item.sourceFileUri || item.fileUriUsed || "").trim();
    if (!/^https?:\/\//i.test(fileUri)) {
      setVideoError("Cannot re-run: saved item has no valid video URL.");
      return;
    }
    const rerunContext = {
      ageGroup: String(item.ageGroup || "").trim(),
      playerLevel: String(item.playerLevel || "").trim(),
      coachLevel: String(item.coachLevel || "").trim(),
      formationUsed: String(item.formationUsed || item.analysis?.context?.formationUsed || "").trim(),
      gameModelId: String(item.gameModelId || "").trim(),
      phase: String(item.phase || "").trim(),
      zone: String(item.zone || "").trim(),
      focusTeamColor: String(item.focusTeamColor || "").trim(),
      opponentTeamColor: String(item.opponentTeamColor || "").trim(),
      fileUri,
    };
    const missing = Object.entries(rerunContext)
      .filter(([, v]) => !String(v || "").trim())
      .map(([k]) => k);
    if (missing.length > 0) {
      setVideoError(`Cannot re-run: missing fields in saved item (${missing.join(", ")}).`);
      return;
    }
    setVideoContext(rerunContext);
    setVaultModalOpen(false);
    await runFullVideoAnalysis(rerunContext, { forceRefresh: true });
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#060a13] text-slate-50">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-cyan-600/[0.08] blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-blue-600/[0.06] blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl p-4 md:p-6">
        <section className="rounded-2xl border border-cyan-500/[0.12] bg-gradient-to-b from-[#08131a]/85 to-[#090f1a]/70 shadow-[0_0_30px_-12px_rgba(6,182,212,0.12)]">
          <div className="flex items-center gap-3 border-b border-cyan-500/[0.08] bg-gradient-to-r from-cyan-950/25 to-transparent px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.18)]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
                <path d="M10 9.5l5 2.5-5 2.5v-5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white/90">Video Analysis</h1>
              <p className="text-xs text-slate-500">Dedicated analysis workspace with anonymized Team A/Team B output.</p>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="space-y-4">
              <div className="space-y-3 rounded-xl border border-white/[0.07] bg-black/10 p-3">
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
                <label className="flex flex-col gap-1 whitespace-nowrap text-[11px] text-slate-400">
                  Age Group
                  <select
                    value={videoContext.ageGroup}
                    onChange={(e) =>
                      setVideoContext((prev) => {
                        const ageGroup = e.target.value;
                        const allowed = getValidFormationsForAgeGroup(ageGroup);
                        const formationUsed = allowed.includes(prev.formationUsed)
                          ? prev.formationUsed
                          : getDefaultFormationForAgeGroup(ageGroup);
                        return { ...prev, ageGroup, formationUsed };
                      })
                    }
                    className="rounded-lg border border-white/[0.08] bg-[#0a1620] px-2.5 py-1.5 text-xs text-white/90 outline-none transition focus:border-cyan-400/50"
                  >
                    <option value="" disabled>Select age group</option>
                    {AGE_GROUP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 whitespace-nowrap text-[11px] text-slate-400">
                  Formation Used
                  <select
                    value={videoContext.formationUsed}
                    onChange={(e) => setVideoContext((prev) => ({ ...prev, formationUsed: e.target.value }))}
                    disabled={!videoContext.ageGroup}
                    className="rounded-lg border border-white/[0.08] bg-[#0a1620] px-2.5 py-1.5 text-xs text-white/90 outline-none transition focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="" disabled>
                      {videoContext.ageGroup ? "Select formation" : "Select age group first"}
                    </option>
                    {formationOptions.map((formation) => (
                      <option key={formation} value={formation}>
                        {formation}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 whitespace-nowrap text-[11px] text-slate-400">
                  Player Level
                  <select
                    value={videoContext.playerLevel}
                    onChange={(e) => setVideoContext((prev) => ({ ...prev, playerLevel: e.target.value }))}
                    className="rounded-lg border border-white/[0.08] bg-[#0a1620] px-2.5 py-1.5 text-xs text-white/90 outline-none transition focus:border-cyan-400/50"
                  >
                    <option value="" disabled>Select player level</option>
                    <option value="BEGINNER">Beginner</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 whitespace-nowrap text-[11px] text-slate-400">
                  Coach Level
                  <select
                    value={videoContext.coachLevel}
                    onChange={(e) => setVideoContext((prev) => ({ ...prev, coachLevel: e.target.value }))}
                    className="rounded-lg border border-white/[0.08] bg-[#0a1620] px-2.5 py-1.5 text-xs text-white/90 outline-none transition focus:border-cyan-400/50"
                  >
                    <option value="" disabled>Select coach level</option>
                    {COACH_LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 whitespace-nowrap text-[11px] text-slate-400">
                  Game Model
                  <select
                    value={videoContext.gameModelId}
                    onChange={(e) => setVideoContext((prev) => ({ ...prev, gameModelId: e.target.value }))}
                    className="rounded-lg border border-white/[0.08] bg-[#0a1620] px-2.5 py-1.5 text-xs text-white/90 outline-none transition focus:border-cyan-400/50"
                  >
                    <option value="" disabled>Select game model</option>
                    <option value="POSSESSION">Possession</option>
                    <option value="PRESSING">Pressing</option>
                    <option value="TRANSITION">Transition</option>
                    <option value="COACHAI">Balanced (CoachAI)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 whitespace-nowrap text-[11px] text-slate-400">
                  Phase
                  <select
                    value={videoContext.phase}
                    onChange={(e) => setVideoContext((prev) => ({ ...prev, phase: e.target.value }))}
                    className="rounded-lg border border-white/[0.08] bg-[#0a1620] px-2.5 py-1.5 text-xs text-white/90 outline-none transition focus:border-cyan-400/50"
                  >
                    <option value="" disabled>Select phase</option>
                    <option value="ATTACKING">Attacking</option>
                    <option value="DEFENDING">Defending</option>
                    <option value="TRANSITION">Transition</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 whitespace-nowrap text-[11px] text-slate-400">
                  Zone
                  <select
                    value={videoContext.zone}
                    onChange={(e) => setVideoContext((prev) => ({ ...prev, zone: e.target.value }))}
                    className="rounded-lg border border-white/[0.08] bg-[#0a1620] px-2.5 py-1.5 text-xs text-white/90 outline-none transition focus:border-cyan-400/50"
                  >
                    <option value="" disabled>Select zone</option>
                    <option value="DEFENSIVE_THIRD">Defensive third</option>
                    <option value="MIDDLE_THIRD">Middle third</option>
                    <option value="ATTACKING_THIRD">Attacking third</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 whitespace-nowrap text-[11px] text-slate-400">
                  Focus Color
                  <select
                    value={videoContext.focusTeamColor}
                    onChange={(e) => setVideoContext((prev) => ({ ...prev, focusTeamColor: e.target.value }))}
                    className="rounded-lg border border-cyan-400/30 bg-[#0a1620] px-2.5 py-1.5 text-xs text-cyan-200 outline-none transition focus:border-cyan-300/70"
                  >
                    <option value="" disabled>Select focus color</option>
                    {COLOR_OPTIONS.map((color) => (
                      <option key={color} value={color}>
                        {formatColorLabel(color)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 whitespace-nowrap text-[11px] text-slate-400">
                  Opponent Color
                  <select
                    value={videoContext.opponentTeamColor}
                    onChange={(e) => setVideoContext((prev) => ({ ...prev, opponentTeamColor: e.target.value }))}
                    className="rounded-lg border border-white/[0.08] bg-[#0a1620] px-2.5 py-1.5 text-xs text-white/90 outline-none transition focus:border-cyan-400/50"
                  >
                    <option value="" disabled>Select opponent color</option>
                    {COLOR_OPTIONS.map((color) => (
                      <option key={color} value={color}>
                        {formatColorLabel(color)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                File URI
                <input
                  value={videoContext.fileUri}
                  onChange={(e) => setVideoContext((prev) => ({ ...prev, fileUri: e.target.value }))}
                  placeholder="https://generativelanguage.googleapis.com/v1beta/files/..."
                  className="rounded-lg border border-white/[0.08] bg-[#0a1620] px-2.5 py-1.5 text-xs text-white/90 outline-none transition focus:border-cyan-400/50"
                />
              </label>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <button
                  onClick={requestRunConfirmation}
                  disabled={videoLoading || !isVideoFormValid}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300/50 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {videoLoading ? "Running..." : "Run Full Analysis"}
                </button>
                <button
                  onClick={cancelVideoAnalysis}
                  disabled={!videoLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300/50 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={saveToVideoAnalysisVault}
                  disabled={!videoAnalysis || videoLoading || savingToVault}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-2 text-xs font-semibold text-indigo-200 transition hover:border-indigo-300/50 hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingToVault ? "Saving..." : "Save to Video Analysis Vault"}
                </button>
                <button
                  onClick={openVideoVault}
                  disabled={videoLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  View Video Vault
                </button>
              </div>

              <p className="text-[10px] text-slate-500">
                Output policy: Team A/Team B labels only. No personal names.
              </p>

              {videoError ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                  {videoError}
                </div>
              ) : null}

                <div className="rounded-lg border border-cyan-500/20 bg-[#071119] px-3 py-2 text-[11px] text-slate-300">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-cyan-200">Analysis Scope</span>
                    <span className="text-slate-500">|</span>
                    <span>
                      Focus: <span className="text-white/90">{formatColorLabel(videoContext.focusTeamColor)}</span> (Team A) vs{" "}
                      <span className="text-white/90">{formatColorLabel(videoContext.opponentTeamColor)}</span> (Team B)
                    </span>
                    <span className="text-slate-500">|</span>
                    <span>
                      Tactical scope: <span className="text-white/90">{GAME_MODEL_LABELS[videoContext.gameModelId] || videoContext.gameModelId}</span> /{" "}
                      <span className="text-white/90">{PHASE_LABELS[videoContext.phase] || videoContext.phase}</span> /{" "}
                      <span className="text-white/90">{ZONE_LABELS[videoContext.zone] || videoContext.zone}</span>
                    </span>
                    <span className="text-slate-500">|</span>
                    <span>
                      Formation used: <span className="text-white/90">{formationDisplay}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3">
                <p className="mb-2 text-[11px] font-medium text-slate-300">Clip Preview</p>
                {videoPreviewUrl ? (
                  <video
                    src={videoPreviewUrl}
                    controls
                    preload="metadata"
                    className="w-full rounded-md border border-white/[0.08] bg-black"
                  />
                ) : (
                  <div className="flex h-[420px] items-center justify-center rounded-md border border-dashed border-white/[0.12] text-sm text-slate-500">
                    <span>Run analysis to load video preview.</span>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3">
                <div className="rounded-lg border border-cyan-500/20 bg-[#071119] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-cyan-200">Tactical Animation</p>
                    <span className="text-[10px] text-slate-400">
                      {animationFrames.length > 0 ? `${animFrameIdx + 1}/${animationFrames.length}` : "No frames"}
                    </span>
                  </div>

                  {animationFrames.length === 0 || !currentAnimFrame ? (
                    <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-white/[0.12] text-xs text-slate-500">
                      Run analysis to render tactical animation frames.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-md border border-white/[0.08] bg-[#041018] p-2">
                        <svg viewBox="0 0 120 80" className="h-[210px] w-full">
                          <g stroke="rgba(255,255,255,0.30)" strokeWidth="0.6" fill="none">
                            <line x1="60" y1="0" x2="60" y2="80" />
                            <circle cx="60" cy="40" r="10" />
                            <rect x="0" y="18" width="18" height="44" />
                            <rect x="102" y="18" width="18" height="44" />
                          </g>

                          {(Array.isArray(currentAnimFrame.arrows) ? currentAnimFrame.arrows : []).slice(0, 18).map((arrow, idx) => {
                            const x1 = (Number(arrow?.from?.x ?? 0) / 100) * 120;
                            const y1 = (Number(arrow?.from?.y ?? 0) / 100) * 80;
                            const x2 = (Number(arrow?.to?.x ?? 0) / 100) * 120;
                            const y2 = (Number(arrow?.to?.y ?? 0) / 100) * 80;
                            const type = String(arrow?.type || "").toUpperCase();
                            const stroke = type === "PRESS" ? "#ef4444" : "#fbbf24";
                            return (
                              <line
                                key={`anim-arrow-${idx}`}
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke={stroke}
                                strokeWidth="1.1"
                                strokeDasharray="2 1.8"
                                opacity="0.95"
                              />
                            );
                          })}

                          {(Array.isArray(currentAnimFrame.players) ? currentAnimFrame.players : []).map((player, idx) => {
                            const x = (Number(player?.x ?? 0) / 100) * 120;
                            const y = (Number(player?.y ?? 0) / 100) * 80;
                            const isTeamB = String(player?.team || "A").toUpperCase() === "B";
                            const fill = isTeamB ? opponentTeamFill : focusTeamFill;
                            const textFill = isTeamB ? "#020617" : "#f8fafc";
                            const token = String(player?.id || `P${idx + 1}`).split("_")[1] || String(idx + 1);
                            return (
                              <g
                                key={`anim-player-${player?.id || idx}`}
                                style={{
                                  transform: `translate(${x}px, ${y}px)`,
                                  transition: `transform ${Math.max(500, ANIM_STEP_MS - 180)}ms ease-in-out`,
                                }}
                              >
                                <circle cx="0" cy="0" r="2.2" fill={fill} stroke="#0b1220" strokeWidth="0.45" />
                                <text x="0" y="0.6" fontSize="1.45" textAnchor="middle" fill={textFill} fontWeight="700">
                                  {token}
                                </text>
                              </g>
                            );
                          })}

                          {currentAnimFrame.ball ? (
                            <g
                              style={{
                                transform: `translate(${(Number(currentAnimFrame.ball?.x ?? 0) / 100) * 120}px, ${(Number(currentAnimFrame.ball?.y ?? 0) / 100) * 80}px)`,
                                transition: `transform ${Math.max(500, ANIM_STEP_MS - 180)}ms ease-in-out`,
                              }}
                            >
                              <circle r="1.2" fill="#fb923c" stroke="#f8fafc" strokeWidth="0.35" />
                            </g>
                          ) : null}
                        </svg>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setAnimFrameIdx((prev) => Math.max(0, prev - 1))}
                            disabled={animFrameIdx === 0}
                            className="rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-[10px] text-slate-200 disabled:opacity-40"
                          >
                            Prev
                          </button>
                          <button
                            onClick={() => {
                              if (animFrameIdx >= animationFrames.length - 1) setAnimFrameIdx(0);
                              setAnimPlaying((p) => !p);
                            }}
                            className="rounded-md border border-cyan-400/35 bg-cyan-500/12 px-2.5 py-1 text-[10px] font-semibold text-cyan-200"
                          >
                            {animPlaying ? "Pause" : "Play"}
                          </button>
                          <button
                            onClick={() => setAnimFrameIdx((prev) => Math.min(animationFrames.length - 1, prev + 1))}
                            disabled={animFrameIdx >= animationFrames.length - 1}
                            className="rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-[10px] text-slate-200 disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                        <span className="rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-slate-300">
                          {currentAnimFrame.timestamp || "n/a"}
                        </span>
                      </div>

                      <div className="mt-2 rounded-md border-l-2 border-cyan-400/60 bg-[#0a1620]/70 px-2.5 py-2 text-[11px] text-slate-200">
                        {String(currentAnimFrame.notes || "No coaching note for this frame.")}
                      </div>
                    </>
                  )}
                </div>
              </div>
              </div>
            </div>

            <div className="min-h-[500px] rounded-xl border border-white/[0.07] bg-black/10 p-3">
              <div className="space-y-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
                <div className="rounded-lg border border-white/[0.08] bg-black/15 p-3">
                  {historyIndex > 0 ? (
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <button
                        onClick={goToPreviousAnalysis}
                        disabled={videoLoading}
                        className="inline-flex items-center rounded-md border border-white/[0.12] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Previous Analysis
                      </button>
                      <span className="text-[10px] text-slate-500">
                        {historyIndex + 1}/{analysisHistory.length}
                      </span>
                    </div>
                  ) : null}

                  {videoCached !== null ? (
                    <div className="mb-3 flex items-center">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium ${
                          videoCached
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                            : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                        }`}
                      >
                        {videoCached
                          ? `Cached result${videoCacheHits ? ` • hits ${videoCacheHits}` : ""}`
                          : "Fresh run"}
                      </span>
                    </div>
                  ) : null}

                  {(overallSummary || topPriorities.length > 0 || qualityRisks.length > 0) && (
                    <div className="mb-3 space-y-2 rounded-lg border border-cyan-500/20 bg-[#071119] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Analysis</p>
                      <div className="rounded-lg border border-white/[0.08] bg-[#08152a]/80 p-3">
                        <h3 className="text-[15px] font-semibold leading-snug text-white/95 md:text-[16px]">
                          {analysisDisplayTitleWithoutDate || analysisDisplayTitle}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="inline-flex rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 font-semibold text-cyan-200">
                            {currentAnalysisRefCode || "VA-PENDING"}
                          </span>
                          {analysisDisplayDate ? (
                            <span className="inline-flex rounded-md border border-white/[0.10] bg-white/[0.03] px-2 py-0.5 text-slate-400">
                              {analysisDisplayDate}
                            </span>
                          ) : null}
                          <span className="inline-flex rounded-full border border-white/[0.10] bg-white/[0.04] px-2.5 py-1 text-slate-300">
                            Game Model: <span className="ml-1 font-semibold text-white/90">{GAME_MODEL_LABELS[resolvedGameModel] || formatEnumLabel(resolvedGameModel) || "N/A"}</span>
                          </span>
                          <span className="inline-flex rounded-full border border-white/[0.10] bg-white/[0.04] px-2.5 py-1 text-slate-300">
                            Phase: <span className="ml-1 font-semibold text-white/90">{PHASE_LABELS[resolvedPhase] || formatEnumLabel(resolvedPhase) || "N/A"}</span>
                          </span>
                          <span className="inline-flex rounded-full border border-white/[0.10] bg-white/[0.04] px-2.5 py-1 text-slate-300">
                            Zone: <span className="ml-1 font-semibold text-white/90">{ZONE_LABELS[resolvedZone] || formatEnumLabel(resolvedZone) || "N/A"}</span>
                          </span>
                          <span className="inline-flex rounded-full border border-white/[0.10] bg-white/[0.04] px-2.5 py-1 text-slate-300">
                            Coach Level: <span className="ml-1 font-semibold text-white/90">{COACH_LEVEL_OPTIONS.find((o) => o.value === resolvedCoachLevel)?.label || formatEnumLabel(resolvedCoachLevel) || "N/A"}</span>
                          </span>
                          <span className="inline-flex rounded-full border border-white/[0.10] bg-white/[0.04] px-2.5 py-1 text-slate-300">
                            Formation: <span className="ml-1 font-semibold text-white/90">{formationDisplay}</span>
                          </span>
                        </div>
                      </div>
                      {overallSummary ? (
                        <p className="text-[12px] leading-relaxed text-slate-200">{overallSummary}</p>
                      ) : null}
                      {scopeSummary ? (
                        <p className="text-[11px] leading-relaxed text-cyan-100/90">{scopeSummary}</p>
                      ) : null}

                      {topPriorities.length > 0 ? (
                        <div>
                          <p className="mb-1 text-[11px] font-medium text-cyan-100">Primary Advice</p>
                          <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-300">
                            {topPriorities.slice(0, 5).map((item, idx) => (
                              <li key={`priority-${idx}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {qualityRisks.length > 0 ? (
                        <div>
                          <p className="mb-1 text-[11px] font-medium text-slate-300">Video Quality Notes</p>
                          <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-400">
                            {qualityRisks.map((item, idx) => (
                              <li key={`risk-${idx}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )}

                </div>

                <div className="rounded-lg border border-white/[0.08] bg-black/15 p-3">
                  {videoLoading ? (
                    <div className="flex h-[525px] items-center justify-center rounded-lg border border-dashed border-white/[0.12] text-sm text-cyan-200">
                      <div className="flex items-center gap-3">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
                        <span className="font-medium tracking-wide">Analyzing...</span>
                      </div>
                    </div>
                  ) : analysisItems.length === 0 ? (
                    <div className="flex h-[525px] items-center justify-center rounded-lg border border-dashed border-white/[0.12] text-sm text-slate-500">
                      <span>Run analysis to view categorized findings.</span>
                    </div>
                  ) : (
                    <div className="max-h-[775px] overflow-auto rounded-md border border-white/[0.08]">
                      <table className="min-w-full text-left text-[11px]">
                        <thead className="sticky top-0 bg-[#0a1620] text-slate-300">
                          <tr className="border-b border-white/[0.08]">
                            <th className="px-2 py-2 font-semibold">Time</th>
                            <th className="px-2 py-2 font-semibold">Topic</th>
                            <th className="px-2 py-2 font-semibold">Narrative</th>
                            <th className="px-2 py-2 font-semibold">Mission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timelineItems.map((item, idx) => (
                            <tr key={`${item.id || idx}`} className="border-b border-white/[0.06] align-top">
                              <td className="whitespace-nowrap px-2 py-2 text-slate-400">{item.timestamp || "n/a"}</td>
                              <td className="px-2 py-2 font-medium text-white/90">{cleanAnalysisTitle(item.title)}</td>
                              <td className="px-2 py-2 text-slate-300">
                                {String(item?.teamFocus || "").toUpperCase() === "TEAM_B" && String(item?.teamAImplication || "").trim()
                                  ? `Team A implication: ${String(item.teamAImplication).trim()}`
                                  : item.whatHappened || "-"}
                              </td>
                              <td className="px-2 py-2">
                                {getMissionAssessment(item) === "Good" ? (
                                  <span className="inline-flex rounded-md border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
                                    Good
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                                    Needs Work
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                </div>

              </div>
            </div>
          </div>
        </section>
      </div>

      {confirmRunOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-xl border border-cyan-500/20 bg-[#08131a] p-4 shadow-[0_0_30px_-12px_rgba(6,182,212,0.25)]">
            <h2 className="text-sm font-semibold text-cyan-200">Run Video Analysis?</h2>
            <p className="mt-1 text-xs text-slate-400">Please confirm this input summary before running.</p>

            <div className="mt-3 space-y-1.5 rounded-lg border border-white/[0.08] bg-black/20 p-3 text-[11px] text-slate-300">
              <p>Age group: <span className="text-white/90">{videoContext.ageGroup}</span></p>
              <p>Player level: <span className="text-white/90">{formatEnumLabel(videoContext.playerLevel)}</span></p>
              <p>Coach level: <span className="text-white/90">{COACH_LEVEL_OPTIONS.find((o) => o.value === videoContext.coachLevel)?.label || videoContext.coachLevel}</span></p>
              <p>Formation used: <span className="text-white/90">{formationDisplay}</span></p>
              <p>Focus team: <span className="text-white/90">{formatColorLabel(videoContext.focusTeamColor)}</span></p>
              <p>Opponent team: <span className="text-white/90">{formatColorLabel(videoContext.opponentTeamColor)}</span></p>
              <p>Game model: <span className="text-white/90">{GAME_MODEL_LABELS[videoContext.gameModelId] || videoContext.gameModelId}</span></p>
              <p>Phase: <span className="text-white/90">{PHASE_LABELS[videoContext.phase] || videoContext.phase}</span></p>
              <p>Where (zone): <span className="text-white/90">{ZONE_LABELS[videoContext.zone] || videoContext.zone}</span></p>
              <p className="break-all">File URI: <span className="text-white/90">{videoContext.fileUri}</span></p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmRunOpen(false)}
                className="inline-flex w-full items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08]"
              >
                Go Back
              </button>
              <button
                onClick={confirmAndRun}
                className="inline-flex w-full items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300/50 hover:bg-emerald-500/20"
              >
                Yes, Run
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {vaultModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-4xl rounded-xl border border-cyan-500/20 bg-[#08131a] p-4 shadow-[0_0_30px_-12px_rgba(6,182,212,0.25)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-cyan-200">Video Analysis Vault</h2>
              <button
                onClick={() => setVaultModalOpen(false)}
                className="inline-flex items-center rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.08]"
              >
                Close
              </button>
            </div>

            {vaultLoading ? (
              <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed border-white/[0.12] text-sm text-cyan-200">
                Loading vault...
              </div>
            ) : vaultError ? (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                {vaultError}
              </div>
            ) : vaultItems.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed border-white/[0.12] text-sm text-slate-500">
                No saved video analysis yet.
              </div>
            ) : (
              <div className="max-h-[440px] overflow-auto rounded-md border border-white/[0.08]">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-[#0a1620] text-slate-300">
                    <tr className="border-b border-white/[0.08]">
                      <th className="px-2 py-2 font-semibold">Date</th>
                      <th className="px-2 py-2 font-semibold">Video Analysis</th>
                      <th className="px-2 py-2 font-semibold">Scope</th>
                      <th className="px-2 py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaultItems.map((item) => (
                      <tr key={item.id} className="border-b border-white/[0.06] align-top">
                        <td className="whitespace-nowrap px-2 py-2 text-slate-400">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : "n/a"}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">
                              {item.refCode || "VA-PENDING"}
                            </span>
                            <span className="text-white/90">{prettifyVaultTitle(item.title)}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-slate-300">
                          {item.gameModelId || "n/a"} / {item.phase || "n/a"} / {item.zone || "n/a"}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openVaultAnalysisItem(item)}
                              className="inline-flex items-center rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-500/20"
                            >
                              Open
                            </button>
                            <button
                              onClick={() => rerunVaultAnalysisItem(item)}
                              disabled={videoLoading}
                              className="inline-flex items-center rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200 transition hover:border-emerald-300/50 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Re-run
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
