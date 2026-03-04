"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getUserId } from "@/lib/user";
import UniversalDrillDiagram from "@/components/UniversalDrillDiagram";
import { tacticalEdgeToUniversalDrillData } from "@/lib/diagram-adapter";
import { useEnforcedGameModelScope } from "@/lib/game-model-scope";

// Helper component for filtered vault list
function FilteredVaultList({ 
  vaultItems, 
  searchQuery, 
  onOpenItem, 
  onRerunItem, 
  onDeleteItem, 
  isLoading 
}: { 
  vaultItems: VideoVaultItem[]; 
  searchQuery: string; 
  onOpenItem: (item: VideoVaultItem) => void; 
  onRerunItem: (item: VideoVaultItem) => void; 
  onDeleteItem: (item: VideoVaultItem) => void; 
  isLoading: boolean; 
}) {
  const filteredVaultItems = useMemo(() => {
    if (!searchQuery.trim()) return vaultItems;
    const query = searchQuery.toLowerCase();
    return vaultItems.filter(item => 
      (item.title || '').toLowerCase().includes(query) ||
      (item.refCode || '').toLowerCase().includes(query) ||
      (item.gameModelId || '').toLowerCase().includes(query) ||
      (item.phase || '').toLowerCase().includes(query) ||
      (item.zone || '').toLowerCase().includes(query)
    );
  }, [vaultItems, searchQuery]);

  if (filteredVaultItems.length === 0 && searchQuery) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/30">
        <svg className="mb-3 h-10 w-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-sm font-medium text-slate-400">No matching results</p>
        <p className="mt-1 text-xs text-slate-500">Try adjusting your search terms</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700/50 bg-slate-900/30">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="sticky top-0 bg-slate-900/95 backdrop-blur text-slate-300">
          <tr className="border-b border-slate-700/50">
            <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Date</th>
            <th className="px-3 py-2.5 font-semibold">Analysis Name</th>
            <th className="px-3 py-2.5 font-semibold">Ref Code</th>
            <th className="px-3 py-2.5 font-semibold">Game Model</th>
            <th className="px-3 py-2.5 font-semibold">Phase</th>
            <th className="px-3 py-2.5 font-semibold">Zone</th>
            <th className="px-3 py-2.5 font-semibold">Age Group</th>
            <th className="px-3 py-2.5 font-semibold">Level</th>
            <th className="whitespace-nowrap px-3 py-2.5 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredVaultItems.map((vaultItem) => {
            const vaultItemName = prettifyVaultTitle(vaultItem.title);
            const createdAt = vaultItem.createdAt ? new Date(vaultItem.createdAt).toLocaleDateString() : 'N/A';
            const refCode = vaultItem.refCode || 'VA-PENDING';
            
            // Normalize game model - convert "3v3" to "3v3", "5v5" to "5v5", etc.
            const gameModel = vaultItem.gameModelId 
              ? vaultItem.gameModelId.replace(/v/i, 'v').replace(/(\d)v(\d)/i, '$1v$2') 
              : '-';
            
            // Normalize phase - capitalize first letter
            const phase = vaultItem.phase 
              ? vaultItem.phase.charAt(0).toUpperCase() + vaultItem.phase.slice(1).toLowerCase()
              : '-';
            
            // Normalize zone
            const zone = vaultItem.zone 
              ? vaultItem.zone.charAt(0).toUpperCase() + vaultItem.zone.slice(1).toLowerCase()
              : '-';
            
            const ageGroup = vaultItem.ageGroup || '-';
            
            // Normalize level - convert "GRASSROOTS" to "Grassroots", "USSF_C" to "USSF C", etc.
            const playerLevel = (vaultItem.playerLevel || vaultItem.coachLevel || '-')
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c: string) => c.toUpperCase());
            
            return (
              <tr 
                key={vaultItem.id} 
                className="border-b border-slate-800/50 transition-colors hover:bg-slate-800/50"
              >
                <td className="whitespace-nowrap px-3 py-3 text-slate-400">{createdAt}</td>
                <td className="px-3 py-3">
                  <span className="font-medium text-white">{vaultItemName}</span>
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
                    {refCode}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="rounded bg-blue-500/20 px-2 py-0.5 text-blue-200">{gameModel}</span>
                </td>
                <td className="px-3 py-3">
                  <span className="rounded bg-purple-500/20 px-2 py-0.5 text-purple-200">{phase}</span>
                </td>
                <td className="px-3 py-3">
                  <span className="rounded bg-orange-500/20 px-2 py-0.5 text-orange-200">{zone}</span>
                </td>
                <td className="px-3 py-3 text-slate-300">{ageGroup}</td>
                <td className="px-3 py-3 text-slate-400">{playerLevel}</td>
                <td className="px-3 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onOpenItem(vaultItem)}
                      className="inline-flex items-center rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-500/20"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => onRerunItem(vaultItem)}
                      disabled={isLoading}
                      className="inline-flex items-center rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-200 transition hover:border-emerald-300/50 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Re-run
                    </button>
                    <button
                      onClick={() => onDeleteItem(vaultItem)}
                      disabled={isLoading}
                      className="inline-flex items-center rounded-md border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-rose-200 transition hover:border-rose-300/50 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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
  ROCKLIN_FC: "Rocklin FC",
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

type RecommendationNarrative = {
  involves: string;
  why: string;
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
  const [vaultSearch, setVaultSearch] = useState("");
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultItems, setVaultItems] = useState<VideoVaultItem[]>([]);
  const [currentAnalysisTitle, setCurrentAnalysisTitle] = useState<string>("");
  const [currentAnalysisRefCode, setCurrentAnalysisRefCode] = useState<string>("");
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [confirmRunOpen, setConfirmRunOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [noMatchDialogOpen, setNoMatchDialogOpen] = useState(false);
  const [searchParams, setSearchParams] = useState<any>(null);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const { enforcedGameModelId, scopedGameModelOptions } = useEnforcedGameModelScope();

  useEffect(() => {
    if (!enforcedGameModelId) return;
    setVideoContext((prev) =>
      prev.gameModelId === enforcedGameModelId ? prev : { ...prev, gameModelId: enforcedGameModelId }
    );
  }, [enforcedGameModelId]);

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
  const resolvedPlayerLevel = useMemo(
    () => String(videoContext.playerLevel || analysisContext.playerLevel || "").toUpperCase(),
    [videoContext.playerLevel, analysisContext]
  );
  const resolvedFormation = useMemo(
    () => String(videoContext.formationUsed || analysisContext.formationUsed || "").trim(),
    [videoContext.formationUsed, analysisContext]
  );
  const resolvedFocusTeamColor = useMemo(
    () => String(videoContext.focusTeamColor || analysisContext.focusTeamColor || "").trim(),
    [videoContext.focusTeamColor, analysisContext]
  );
  const resolvedOpponentTeamColor = useMemo(
    () => String(videoContext.opponentTeamColor || analysisContext.opponentTeamColor || "").trim(),
    [videoContext.opponentTeamColor, analysisContext]
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
  const [animSpeed, setAnimSpeed] = useState(1); // 0.5, 1, 1.5, 2
  const currentAnimFrame = animationFrames[animFrameIdx] || null;
  const animStepMs = Math.round(ANIM_STEP_MS / animSpeed);
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
          return 0; // Loop back to start
        }
        return prev + 1;
      });
    }, Math.round(ANIM_STEP_MS / animSpeed));
    return () => clearInterval(timer);
  }, [animPlaying, animationFrames.length, ANIM_STEP_MS, animSpeed]);

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

  const buildRecommendationNarrative = (session: any): RecommendationNarrative => {
    const sessionGameModel = String(session?.gameModelId || resolvedGameModel || "").toUpperCase();
    const sessionPhase = String(session?.phase || resolvedPhase || "").toUpperCase();
    const sessionZone = String(session?.zone || resolvedZone || "").toUpperCase();
    const sessionAgeGroup = String(session?.ageGroup || resolvedAgeGroup || "current team").trim();
    const sessionDuration = Number(session?.durationMin || 45);
    const sessionFormation = String(session?.formationUsed || resolvedFormation || "").trim();
    const sessionDrillsCount = Array.isArray(session?.json?.drills) ? session.json.drills.length : 0;
    const playerLevelLabel = resolvedPlayerLevel ? formatEnumLabel(resolvedPlayerLevel).toLowerCase() : "";
    const coachLevelLabel = resolvedCoachLevel ? formatEnumLabel(resolvedCoachLevel) : "";
    const focusColorLabel = resolvedFocusTeamColor ? formatColorLabel(resolvedFocusTeamColor).toLowerCase() : "";
    const opponentColorLabel = resolvedOpponentTeamColor ? formatColorLabel(resolvedOpponentTeamColor).toLowerCase() : "";
    const sessionSummaryText = String(session?.json?.summary || "").trim();
    const drillTitles = Array.isArray(session?.json?.drills)
      ? session.json.drills.map((d: any) => String(d?.title || "").trim()).filter(Boolean)
      : [];
    const sessionTextCorpus = [
      String(session?.title || ""),
      sessionSummaryText,
      drillTitles.join(" "),
      sessionGameModel,
      sessionPhase,
      sessionZone,
      sessionFormation,
    ]
      .join(" ")
      .toLowerCase();
    const tokenize = (value: string) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 4);
    const sessionTokens = new Set(tokenize(sessionTextCorpus));

    const priorities = topPriorities
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 4);
    const matchedPriorities = priorities
      .filter((priority) => tokenize(priority).some((token) => sessionTokens.has(token)))
      .slice(0, 2);
    const focusPriorities = (matchedPriorities.length > 0 ? matchedPriorities : priorities).slice(0, 2);
    const fallbackFindings = analysisItems
      .filter((item) => {
        const severity = String(item?.severity || "").toLowerCase();
        return severity === "critical" || severity === "major";
      })
      .map((item) => String(item?.title || "").trim())
      .filter(Boolean)
      .slice(0, 2);
    const focusList = focusPriorities.length > 0 ? focusPriorities : fallbackFindings;
    const focusText = focusList.length > 0 ? focusList.join("; ") : "the key issues identified in the review";

    const severityCounts = analysisItems.reduce(
      (acc, item) => {
        const severity = String(item?.severity || "").toLowerCase();
        if (severity === "critical") acc.critical += 1;
        else if (severity === "major") acc.major += 1;
        else if (severity === "minor") acc.minor += 1;
        return acc;
      },
      { critical: 0, major: 0, minor: 0 }
    );
    const needsWorkCount = analysisItems.reduce(
      (acc, item) => (getMissionAssessment(item) === "Needs Work" ? acc + 1 : acc),
      0
    );
    const highPriorityCount = severityCounts.critical + severityCounts.major;

    const gameModelLabel = GAME_MODEL_LABELS[sessionGameModel] || formatEnumLabel(sessionGameModel) || "targeted";
    const phaseLabel = PHASE_LABELS[sessionPhase] || formatEnumLabel(sessionPhase) || "phase-specific";
    const zoneLabel = ZONE_LABELS[sessionZone] || formatEnumLabel(sessionZone) || "target-zone";
    const fitReasons = [
      sessionGameModel && resolvedGameModel && sessionGameModel === resolvedGameModel ? "matches your game model" : "",
      sessionPhase && resolvedPhase && sessionPhase === resolvedPhase ? "matches your selected phase" : "",
      sessionZone && resolvedZone && sessionZone === resolvedZone ? "matches your selected zone" : "",
      sessionAgeGroup && resolvedAgeGroup && sessionAgeGroup === resolvedAgeGroup ? "fits your age group" : "",
      matchedPriorities.length > 0 ? `targets: ${matchedPriorities.join("; ")}` : "",
      drillTitles.length > 0 ? `session content includes ${drillTitles.slice(0, 2).join(" + ")}` : "",
      sessionSummaryText
        ? `objective: ${sessionSummaryText.split(/[.!?]/)[0].trim().slice(0, 120)}`
        : "",
    ].filter(Boolean);

    const involvesParts = [
      `${sessionDuration} min ${gameModelLabel.toLowerCase()} session`,
      `for ${sessionAgeGroup}${playerLevelLabel ? ` ${playerLevelLabel}` : ""} players`,
      `in ${phaseLabel.toLowerCase()} (${zoneLabel.toLowerCase()})`,
      sessionFormation ? `using ${sessionFormation}` : "",
      sessionDrillsCount > 0 ? `with ${sessionDrillsCount} drills` : "",
      `focused on ${focusText}`,
    ].filter(Boolean);

    const whyParts = [
      fitReasons.length > 0 ? fitReasons.join(". ") : "",
      highPriorityCount > 0
        ? `analysis flagged ${highPriorityCount} high-priority issue${highPriorityCount === 1 ? "" : "s"}`
        : "analysis identified repeated moments to improve",
      needsWorkCount > 0
        ? `${needsWorkCount} timeline moment${needsWorkCount === 1 ? "" : "s"} were marked Needs Work`
        : "",
      coachLevelLabel ? `coach level context: ${coachLevelLabel}` : "",
      focusColorLabel && opponentColorLabel ? `team context: ${focusColorLabel} focus vs ${opponentColorLabel} opponent` : "",
      scopeSummary ? `scope: ${scopeSummary}` : "",
    ].filter(Boolean);

    return {
      involves: `${involvesParts.join(", ")}.`,
      why: `${whyParts.join(". ")}.`,
    };
  };

  const enrichRecommendedSessions = (sessions: any[]) => {
    const base = Array.isArray(sessions) ? sessions.slice(0, 5) : [];
    return base.map((session) => ({
      ...session,
      recommendationNarrative: buildRecommendationNarrative(session),
    }));
  };

  const findRecommendedSessions = async () => {
    if (!videoAnalysis || recommendationsLoading) return;
    
    setRecommendationsLoading(true);
    setRecommendationsError(null);
    setRecommendations([]);
    
    try {
      // Build search parameters from analysis context for vault search
      const searchInput = {
        gameModelId: resolvedGameModel || videoContext.gameModelId || '',
        ageGroup: resolvedAgeGroup || videoContext.ageGroup || '',
        phase: resolvedPhase || videoContext.phase || undefined,
        zone: resolvedZone || videoContext.zone || undefined,
        playerLevel: resolvedPlayerLevel || videoContext.playerLevel || undefined,
        coachLevel: resolvedCoachLevel || videoContext.coachLevel || undefined,
        formationAttacking: resolvedFormation || videoContext.formationUsed || undefined,
        durationMin: 45,
        context: {
          topPriorities,
          summary: overallSummary,
          scopeSummary,
        },
        limit: 10,
      };
      
      // Use vault/sessions GET endpoint with query params
      const queryParams = new URLSearchParams();
      if (searchInput.gameModelId) queryParams.set('gameModelId', searchInput.gameModelId);
      if (searchInput.ageGroup) queryParams.set('ageGroup', searchInput.ageGroup);
      if (searchInput.phase) queryParams.set('phase', searchInput.phase);
      if (searchInput.zone) queryParams.set('zone', searchInput.zone);
      queryParams.set('limit', String(searchInput.limit));
      
      const res = await fetch(`/api/vault/sessions?${queryParams.toString()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      const data = await res.json().catch(() => ({}));
      
      // Check for matches in response
      const sessions = data?.sessions || [];
      
      if (res.ok && sessions.length > 0) {
        // Found matches - display them
        setRecommendations(enrichRecommendedSessions(sessions));
      } else if (res.ok && sessions.length === 0) {
        // Success but no matches - show dialog to expand search or generate
        setSearchParams(searchInput);
        setNoMatchDialogOpen(true);
      } else {
        // API error - show dialog with option to generate
        console.warn('Vault search failed:', res.status, data);
        setSearchParams(searchInput);
        setNoMatchDialogOpen(true);
      }
    } catch (e: any) {
      // Network or other error - show dialog
      console.warn('Vault search error:', e);
      setSearchParams({});
      setNoMatchDialogOpen(true);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const generateNewSession = async (params: any) => {
    setRecommendationsLoading(true);
    setRecommendationsError(null);
    
    try {
      // Use /api/generate-session to create a new session based on analysis
      const res = await fetch('/api/generate-session', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          gameModelId: params.gameModelId,
          ageGroup: params.ageGroup,
          phase: params.phase || undefined,
          zone: params.zone || undefined,
          coachLevel: params.coachLevel || resolvedCoachLevel || undefined,
          playerLevel: params.playerLevel || resolvedPlayerLevel || undefined,
          formationAttacking: params.formationAttacking || '',
          formationDefending: '',
          numbersMin: params.numbersMin || 6,
          numbersMax: params.numbersMax || 11,
          goalsAvailable: params.goalsAvailable || 2,
          spaceConstraint: params.spaceConstraint || 'balanced',
          durationMin: params.durationMin || 45,
          topic: params.context?.topPriorities?.[0] || params.context?.summary?.substring(0, 100) || 'Training session based on video analysis',
        }),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Generation failed: ${res.status}`);
      }
      
      // Set the generated session as recommendation
      if (data?.session) {
        setRecommendations(enrichRecommendedSessions([data.session]));
      } else {
        throw new Error('No session generated');
      }
    } catch (e: any) {
      setRecommendationsError(e?.message || 'Failed to generate session');
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const expandSearchCriteria = async () => {
    if (!searchParams) return;
    
    setNoMatchDialogOpen(false);
    setRecommendationsLoading(true);
    
    try {
      // Expand search with relaxed parameters - remove phase/zone filters
      const queryParams = new URLSearchParams();
      if (searchParams.gameModelId) queryParams.set('gameModelId', searchParams.gameModelId);
      if (searchParams.ageGroup) queryParams.set('ageGroup', searchParams.ageGroup);
      // Remove phase and zone filters for expanded search
      queryParams.set('limit', '20');  // More results
      
      const res = await fetch(`/api/vault/sessions?${queryParams.toString()}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      const data = await res.json().catch(() => ({}));
      
      const sessions = data?.sessions || [];
      
      if (res.ok && sessions.length > 0) {
        setRecommendations(enrichRecommendedSessions(sessions));
      } else {
        // Still no matches, show error - user can still generate
        setRecommendationsError('No sessions found even with expanded criteria. Use "Generate New Session" below.');
      }
    } catch (e: any) {
      setRecommendationsError(e?.message || 'Failed to expand search. You can generate a new session instead.');
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const proceedToGenerate = async () => {
    if (!searchParams) return;
    setNoMatchDialogOpen(false);
    await generateNewSession(searchParams);
  };

  const cancelRecommendationSearch = () => {
    setNoMatchDialogOpen(false);
    setSearchParams(null);
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
      gameModelId: enforcedGameModelId || String(item.gameModelId || "").trim(),
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

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<VideoVaultItem | null>(null);

  const handleDeleteClick = (item: VideoVaultItem) => {
    setDeleteConfirmItem(item);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmItem) return;
    const item = deleteConfirmItem;
    setDeleteConfirmItem(null);
    
    try {
      const res = await fetch(`/api/video-analysis/vault/${item.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setVaultError(data?.error || 'Failed to delete item');
        return;
      }
      // Remove from local list
      setVaultItems(prev => prev.filter(v => v.id !== item.id));
    } catch (e: any) {
      setVaultError(e?.message || 'Failed to delete item');
    }
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/20 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
                <path d="M10 9.5l5 2.5-5 2.5v-5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-white/90">Video Analysis</h1>
              <p className="text-xs text-slate-500">AI-powered tactical analysis with anonymized Team A/Team B output.</p>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="space-y-4">
              <div className="space-y-3 rounded-xl border border-white/[0.07] bg-black/10 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Configure Analysis</p>
                  <span className="text-[10px] text-slate-500">Set parameters for AI analysis</span>
                </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
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
                    disabled={Boolean(enforcedGameModelId)}
                    className="rounded-lg border border-white/[0.08] bg-[#0a1620] px-2.5 py-1.5 text-xs text-white/90 outline-none transition focus:border-cyan-400/50"
                  >
                    <option value="" disabled>Select game model</option>
                    {scopedGameModelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
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

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

                <div className="rounded-lg border border-cyan-500/20 bg-[#071119] px-3 py-3 text-[11px]">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">Analysis Configuration</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-cyan-200">
                      <span className="mr-1 opacity-70">Focus:</span>
                      {formatColorLabel(videoContext.focusTeamColor)}
                      <span className="mx-1 text-cyan-400/50">vs</span>
                      {formatColorLabel(videoContext.opponentTeamColor)}
                    </span>
                    <span className="inline-flex rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-1 text-slate-300">
                      {GAME_MODEL_LABELS[videoContext.gameModelId] || videoContext.gameModelId || 'N/A'}
                    </span>
                    <span className="inline-flex rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-1 text-slate-300">
                      {PHASE_LABELS[videoContext.phase] || videoContext.phase || 'N/A'}
                    </span>
                    <span className="inline-flex rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-1 text-slate-300">
                      {ZONE_LABELS[videoContext.zone] || videoContext.zone || 'N/A'}
                    </span>
                    <span className="inline-flex rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-1 text-slate-300">
                      {formationDisplay}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-slate-300">Video Clip</p>
                    <p className="text-[9px] text-slate-500">Uploaded video for analysis</p>
                  </div>
                  {videoPreviewUrl && (
                    <span className="text-[9px] text-emerald-400">✓ Video loaded</span>
                  )}
                </div>
                {videoPreviewUrl ? (
                  <video
                    src={videoPreviewUrl}
                    controls
                    preload="metadata"
                    className="w-full rounded-md border border-white/[0.08] bg-black"
                  />
                ) : (
                  <div className="flex h-[420px] items-center justify-center rounded-md border border-dashed border-white/[0.12] text-sm text-slate-500">
                    <div className="text-center">
                      <svg className="mx-auto mb-2 h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Run analysis to load video preview</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3">
                <div className="rounded-lg border border-cyan-500/20 bg-[#071119] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold text-cyan-200">Tactical Animation</p>
                      <p className="text-[9px] text-slate-500">Key moments visualized</p>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {animationFrames.length > 0 ? `${animFrameIdx + 1}/${animationFrames.length}` : "No frames"}
                    </span>
                  </div>

                  {animationFrames.length === 0 || !currentAnimFrame ? (
                    <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-white/[0.12] text-xs text-slate-500">
                      <div className="text-center">
                        <svg className="mx-auto mb-2 h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Run analysis to generate tactical animation</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Enhanced Frame Progress Bar / Scrubber */}
                      <div className="mb-3">
                        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="absolute h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200"
                            style={{ width: `${animationFrames.length > 1 ? ((animFrameIdx / (animationFrames.length - 1)) * 100) : 0}%` }}
                          />
                          {/* Frame markers */}
                          {animationFrames.slice(0, Math.min(animationFrames.length, 20)).map((frame, idx) => {
                            const position = animationFrames.length > 1 ? (idx / (animationFrames.length - 1)) * 100 : 0;
                            return (
                              <div
                                key={`marker-${idx}`}
                                className="absolute top-0 h-2 w-0.5 bg-cyan-400/40"
                                style={{ left: `${position}%` }}
                              />
                            );
                          })}
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, animationFrames.length - 1)}
                          value={animFrameIdx}
                          onChange={(e) => {
                            setAnimFrameIdx(Number(e.target.value));
                            setAnimPlaying(false);
                          }}
                          className="absolute inset-x-0 h-2 w-full cursor-pointer opacity-0"
                          style={{ marginTop: '-8px' }}
                        />
                      </div>

                      <div className="rounded-md border border-white/[0.08] bg-[#041018] p-2 relative overflow-hidden">
                        <svg viewBox="0 0 120 80" className="h-[210px] w-full">
                          <defs>
                            {/* Field gradient */}
                            <linearGradient id="animFieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#1a3a2e" />
                              <stop offset="50%" stopColor="#1e4d3a" />
                              <stop offset="100%" stopColor="#1a3a2e" />
                            </linearGradient>
                            {/* Focus team gradient */}
                            <radialGradient id="focusPlayerGrad" cx="30%" cy="30%">
                              <stop offset="0%" stopColor="#60a5fa" />
                              <stop offset="100%" stopColor="#2563eb" />
                            </radialGradient>
                            {/* Opponent gradient */}
                            <radialGradient id="oppPlayerGrad" cx="30%" cy="30%">
                              <stop offset="0%" stopColor="#f8fafc" />
                              <stop offset="100%" stopColor="#cbd5e1" />
                            </radialGradient>
                            {/* Ball gradient */}
                            <radialGradient id="ballGrad" cx="35%" cy="35%">
                              <stop offset="0%" stopColor="#fbbf24" />
                              <stop offset="100%" stopColor="#d97706" />
                            </radialGradient>
                            {/* Glow filter */}
                            <filter id="animGlow" x="-50%" y="-50%" width="200%" height="200%">
                              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                              <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                              </feMerge>
                            </filter>
                          </defs>
                          
                          {/* Field background */}
                          <rect x="0" y="0" width="120" height="80" fill="url(#animFieldGrad)" rx="2" />
                          
                          {/* Field markings */}
                          <g stroke="rgba(255,255,255,0.30)" strokeWidth="0.6" fill="none">
                            <line x1="60" y1="0" x2="60" y2="80" />
                            <circle cx="60" cy="40" r="10" />
                            <rect x="0" y="18" width="18" height="44" />
                            <rect x="102" y="18" width="18" height="44" />
                          </g>

                          {/* Arrows */}
                          {(Array.isArray(currentAnimFrame.arrows) ? currentAnimFrame.arrows : []).slice(0, 18).map((arrow, idx) => {
                            const x1 = (Number(arrow?.from?.x ?? 0) / 100) * 120;
                            const y1 = (Number(arrow?.from?.y ?? 0) / 100) * 80;
                            const x2 = (Number(arrow?.to?.x ?? 0) / 100) * 120;
                            const y2 = (Number(arrow?.to?.y ?? 0) / 100) * 80;
                            const type = String(arrow?.type || "").toUpperCase();
                            const stroke = type === "PRESS" ? "#ef4444" : "#fbbf24";
                            return (
                              <g key={`anim-arrow-${idx}`}>
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeDasharray="4 2" opacity="0.8" filter="url(#animGlow)" />
                                <circle cx={x2} cy={y2} r="2" fill={stroke} opacity="0.9" />
                              </g>
                            );
                          })}

                          {/* Players with enhanced markers */}
                          {(Array.isArray(currentAnimFrame.players) ? currentAnimFrame.players : []).map((player, idx) => {
                            const x = (Number(player?.x ?? 0) / 100) * 120;
                            const y = (Number(player?.y ?? 0) / 100) * 80;
                            const isTeamB = String(player?.team || "A").toUpperCase() === "B";
                            const fill = isTeamB ? "url(#oppPlayerGrad)" : "url(#focusPlayerGrad)";
                            const textFill = isTeamB ? "#0f172a" : "#f8fafc";
                            const token = String(player?.id || `P${idx + 1}`).split("_")[1] || String(idx + 1);
                            return (
                              <g key={`anim-player-${player?.id || idx}`} style={{ transform: `translate(${x}px, ${y}px)`, transition: `transform ${Math.max(500, Math.round(ANIM_STEP_MS / animSpeed) - 180)}ms ease-in-out` }}>
                                <ellipse cx="0" cy="3" rx="3" ry="1.5" fill="rgba(0,0,0,0.4)" />
                                <circle cx="0" cy="0" r="3" fill={fill} stroke="#0b1220" strokeWidth="0.5" filter="url(#animGlow)" />
                                <circle cx="-0.8" cy="-0.8" r="1" fill="rgba(255,255,255,0.3)" />
                                <text x="0" y="0.8" fontSize="1.8" textAnchor="middle" fill={textFill} fontWeight="700" stroke="#0b1220" strokeWidth="0.2">{token}</text>
                              </g>
                            );
                          })}

                          {/* Ball */}
                          {currentAnimFrame.ball ? (
                            <g style={{ transform: `translate(${(Number(currentAnimFrame.ball?.x ?? 0) / 100) * 120}px, ${(Number(currentAnimFrame.ball?.y ?? 0) / 100) * 80}px)`, transition: `transform ${Math.max(500, Math.round(ANIM_STEP_MS / animSpeed) - 180)}ms ease-in-out` }}>
                              <circle r="1.5" cy="1" fill="rgba(0,0,0,0.3)" />
                              <circle r="1.5" fill="url(#ballGrad)" stroke="#f8fafc" strokeWidth="0.3" filter="url(#animGlow)" />
                            </g>
                          ) : null}
                        </svg>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {/* Speed Control */}
                          <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
                            <span className="px-1.5 text-[9px] text-slate-400">Speed</span>
                            {[0.5, 1, 1.5, 2].map((speed) => (
                              <button
                                key={speed}
                                onClick={() => setAnimSpeed(speed)}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                                  animSpeed === speed
                                    ? 'bg-cyan-500/30 text-cyan-200'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {speed}x
                              </button>
                            ))}
                          </div>
                          <div className="h-4 w-px bg-white/[0.1]" />
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setAnimFrameIdx((prev) => Math.max(0, prev - 1))}
                              disabled={animFrameIdx === 0}
                              className="rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-[10px] text-slate-200 disabled:opacity-40 hover:bg-white/[0.08]"
                            >
                              Prev
                            </button>
                            <button
                              onClick={() => {
                                if (animFrameIdx >= animationFrames.length - 1) setAnimFrameIdx(0);
                                setAnimPlaying((p) => !p);
                              }}
                              className="rounded-md border border-cyan-400/35 bg-cyan-500/12 px-3 py-1 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
                            >
                              {animPlaying ? "⏸ Pause" : "▶ Play"}
                            </button>
                            <button
                              onClick={() => setAnimFrameIdx((prev) => Math.min(animationFrames.length - 1, prev + 1))}
                              disabled={animFrameIdx >= animationFrames.length - 1}
                              className="rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-[10px] text-slate-200 disabled:opacity-40 hover:bg-white/[0.08]"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-cyan-300">
                            {currentAnimFrame.timestamp || "n/a"}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Frame {animFrameIdx + 1}/{animationFrames.length}
                          </span>
                        </div>
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

            <div className="flex flex-col gap-4">
            <div className="order-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                  Recommended Sessions
                </p>
                {recommendations.length > 0 && (
                  <span className="text-[10px] text-emerald-400">
                    Based on your analysis: {resolvedGameModel} / {resolvedPhase} / {resolvedZone}
                  </span>
                )}
              </div>
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={findRecommendedSessions}
                  disabled={!videoAnalysis || recommendationsLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300/50 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {recommendationsLoading ? (
                    <>
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border border-emerald-300/30 border-t-emerald-300" />
                      Finding Sessions...
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Find Recommended Sessions
                    </>
                  )}
                </button>
                {recommendations.length > 0 && (
                  <span className="text-[10px] text-emerald-400">
                    {recommendations.length} session{recommendations.length > 1 ? 's' : ''} found
                  </span>
                )}
              </div>

              {recommendationsLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-3">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-300" />
                    <span className="text-sm text-emerald-200">
                      {recommendationsError ? 'Generating new session...' : 'Finding matching sessions...'}
                    </span>
                  </div>
                </div>
              )}

              {recommendationsError && !recommendationsLoading && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                  {recommendationsError}
                </div>
              )}

              {recommendations.length > 0 && !recommendationsLoading && (
                <div className="space-y-3">
                  {recommendations.map((session, idx) => (
                    <div 
                      key={`rec-session-${idx}`}
                      onClick={() => setSelectedSession(session)}
                      className="cursor-pointer rounded-lg border border-white/[0.08] bg-black/20 p-3 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-white truncate">
                              {session.title || `Session ${idx + 1}`}
                            </h4>
                            {session.refCode && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(session.refCode);
                                }}
                                className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-[9px] font-mono border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors shrink-0"
                                title="Click to copy"
                              >
                                {session.refCode}
                              </button>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {session.ageGroup && (
                              <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] text-cyan-200">
                                {session.ageGroup}
                              </span>
                            )}
                            {session.gameModelId && (
                              <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] text-blue-200">
                                {GAME_MODEL_LABELS[session.gameModelId] || session.gameModelId}
                              </span>
                            )}
                            {session.phase && (
                              <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] text-purple-200">
                                {PHASE_LABELS[session.phase] || session.phase}
                              </span>
                            )}
                            {session.zone && (
                              <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[9px] text-orange-200">
                                {ZONE_LABELS[session.zone] || session.zone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {session.durationMin && (
                        <p className="text-[10px] text-slate-500 mb-1">
                          {session.durationMin} min session
                        </p>
                      )}
                      {session.recommendationNarrative?.involves && (
                        <p className="mb-1 text-[11px] text-emerald-200/90 line-clamp-3">
                          <span className="font-semibold text-emerald-300">This session involves:</span> {session.recommendationNarrative.involves}
                        </p>
                      )}
                      {session.recommendationNarrative?.why && (
                        <p className="mb-1 text-[11px] text-cyan-100/90 line-clamp-3">
                          <span className="font-semibold text-cyan-300">Why this is recommended:</span> {session.recommendationNarrative.why}
                        </p>
                      )}
                      {session.json?.summary && (
                        <p className="text-[11px] text-slate-400 line-clamp-2">
                          {session.json.summary}
                        </p>
                      )}
                      {session.json?.drills && session.json.drills.length > 0 && (
                        <p className="mt-1 text-[10px] text-slate-500">
                          {session.json.drills.length} drill{session.json.drills.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="order-1 min-h-[500px] rounded-xl border border-white/[0.07] bg-black/10 p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Analysis Results</p>
                  <span className="text-[10px] text-slate-500">{analysisItems.length} findings</span>
                </div>
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
                          <p className="mb-1 text-[11px] font-medium text-cyan-100">Key Priorities</p>
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
                    <div className="space-y-4 p-2">
                      {/* Skeleton header */}
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-24 animate-pulse rounded-md bg-slate-800" />
                        <div className="h-6 w-20 animate-pulse rounded-md bg-slate-800" />
                      </div>
                      {/* Skeleton summary */}
                      <div className="h-24 w-full animate-pulse rounded-lg bg-slate-800/50" />
                      {/* Skeleton priorities */}
                      <div className="space-y-2">
                        <div className="h-4 w-32 animate-pulse rounded bg-slate-800" />
                        <div className="h-16 w-full animate-pulse rounded-lg bg-slate-800/50" />
                      </div>
                      {/* Skeleton table */}
                      <div className="space-y-2 pt-2">
                        <div className="h-6 w-full animate-pulse rounded bg-slate-800" />
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-12 w-full animate-pulse rounded bg-slate-800/50" />
                        ))}
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
                            <th className="px-2 py-2 font-semibold">Severity</th>
                            <th className="px-2 py-2 font-semibold">Topic</th>
                            <th className="px-2 py-2 font-semibold">Narrative</th>
                            <th className="px-2 py-2 font-semibold">Assessment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timelineItems.map((item, idx) => {
                            const severity = String(item?.severity || "").toLowerCase();
                            const severityConfig = severity === "critical" 
                              ? { bg: "bg-red-500/20", border: "border-red-400/40", text: "text-red-300", label: "Critical" }
                              : severity === "major"
                                ? { bg: "bg-orange-500/20", border: "border-orange-400/40", text: "text-orange-300", label: "Major" }
                                : severity === "minor"
                                  ? { bg: "bg-yellow-500/15", border: "border-yellow-400/30", text: "text-yellow-300", label: "Minor" }
                                  : { bg: "bg-slate-500/15", border: "border-slate-400/30", text: "text-slate-300", label: "Info" };
                            const rowSeverity = severity === "critical" ? "border-l-2 border-l-red-500/60" : severity === "major" ? "border-l-2 border-l-orange-500/50" : "";
                            return (
                              <tr key={`${item.id || idx}`} className={`border-b border-white/[0.06] align-top ${rowSeverity}`}>
                                <td className="whitespace-nowrap px-2 py-2 text-slate-400">{item.timestamp || "n/a"}</td>
                                <td className="px-2 py-2">
                                  <span className={`inline-flex rounded-md border ${severityConfig.bg} ${severityConfig.border} ${severityConfig.text} px-1.5 py-0.5 text-[9px] font-semibold`}>
                                    {severityConfig.label}
                                  </span>
                                </td>
                                <td className="px-2 py-2 font-medium text-white/90">{cleanAnalysisTitle(item.title)}</td>
                                <td className="px-2 py-2 text-slate-300">
                                  {String(item?.teamFocus || "").toUpperCase() === "TEAM_B" && String(item?.teamAImplication || "").trim()
                                    ? `Team A: ${String(item.teamAImplication).trim()}`
                                    : item.whatHappened || "-"}
                                </td>
                                <td className="px-2 py-2">
                                  {getMissionAssessment(item) === "Good" ? (
                                    <span className="inline-flex rounded-md border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
                                      ✓ Good
                                    </span>
                                  ) : (
                                    <span className="inline-flex rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                                      ⚠ Needs Work
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                </div>

              </div>
            </div>
            </div>
          </div>
        </section>
      </div>

      {confirmRunOpen && (
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
      )}

      {vaultModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setVaultModalOpen(false);
              setVaultSearch("");
            }
          }}
        >
          <div className="w-full max-w-5xl max-h-[85vh] flex flex-col rounded-xl border border-cyan-500/20 bg-[#08131a] shadow-[0_0_30px_-12px_rgba(6,182,212,0.25)]">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-cyan-500/10 px-5 pt-5">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <h2 className="text-base font-semibold text-white">Video Analysis Vault</h2>
                {vaultItems.length > 0 && (
                  <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-300">
                    {vaultItems.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setVaultModalOpen(false);
                  setVaultSearch("");
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Bar */}
            {vaultItems.length > 0 && (
              <div className="mb-4 px-5 pt-4">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={vaultSearch}
                    onChange={(e) => setVaultSearch(e.target.value)}
                    placeholder="Search by title, ref code, or game model..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/50 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>
            )}

            {vaultLoading ? (
              <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-white/[0.12] mx-5">
                <div className="flex items-center gap-2 text-cyan-200">
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading vault...
                </div>
              </div>
            ) : vaultError ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {vaultError}
              </div>
            ) : vaultItems.length === 0 ? (
              <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/30 mx-5 mb-5">
                <svg className="mb-3 h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium text-slate-400">No saved video analysis yet</p>
                <p className="mt-1 text-xs text-slate-500">Run an analysis and save it to see it here</p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto px-5 pb-5">
                <FilteredVaultList
                  vaultItems={vaultItems}
                  searchQuery={vaultSearch}
                  onOpenItem={openVaultAnalysisItem}
                  onRerunItem={rerunVaultAnalysisItem}
                  onDeleteItem={handleDeleteClick}
                  isLoading={videoLoading}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setDeleteConfirmItem(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-rose-500/30 bg-[#0f172a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/20">
                <svg className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">PERMANENT CLEARANCE</h3>
                <p className="text-xs text-slate-400">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="mb-6 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
              <p className="text-sm text-slate-200">
                The analysis <span className="font-medium text-white">"{prettifyVaultTitle(deleteConfirmItem.title)}"</span> will be permanently removed from the vault.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                All associated tactical data and insights will be lost.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 rounded-lg border border-slate-600 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Preview Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-white">{selectedSession.title}</h2>
                {selectedSession.refCode && (
                  <button
                    onClick={() => navigator.clipboard.writeText(selectedSession.refCode)}
                    className="px-2 py-1 rounded bg-cyan-900/40 text-cyan-300 text-xs font-mono border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors"
                  >
                    {selectedSession.refCode}
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Session Metadata */}
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
              {selectedSession.gameModelId && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase tracking-wide">Game Model:</span>
                  <span className="text-emerald-400">{GAME_MODEL_LABELS[selectedSession.gameModelId] || selectedSession.gameModelId}</span>
                </div>
              )}
              {selectedSession.ageGroup && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase tracking-wide">Age:</span>
                  <span className="text-slate-200">{selectedSession.ageGroup}</span>
                </div>
              )}
              {selectedSession.phase && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase tracking-wide">Phase:</span>
                  <span className="text-slate-200">{PHASE_LABELS[selectedSession.phase] || selectedSession.phase}</span>
                </div>
              )}
              {selectedSession.zone && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase tracking-wide">Zone:</span>
                  <span className="text-slate-200">{ZONE_LABELS[selectedSession.zone] || selectedSession.zone}</span>
                </div>
              )}
              {selectedSession.formationUsed && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase tracking-wide">Formation:</span>
                  <span className="text-blue-300">{selectedSession.formationUsed}</span>
                </div>
              )}
              {selectedSession.durationMin && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase tracking-wide">Duration:</span>
                  <span className="text-slate-200">{selectedSession.durationMin} min</span>
                </div>
              )}
            </div>

            {/* Summary */}
            {selectedSession.json?.summary && (
              <div className="mb-4 rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Summary</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{selectedSession.json.summary}</p>
              </div>
            )}
            {(selectedSession.recommendationNarrative?.involves || selectedSession.recommendationNarrative?.why) && (
              <div className="mb-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">Recommendation Brief</h3>
                {selectedSession.recommendationNarrative?.involves && (
                  <p className="mb-2 text-sm text-emerald-100">
                    <span className="font-semibold text-emerald-300">Involves:</span> {selectedSession.recommendationNarrative.involves}
                  </p>
                )}
                {selectedSession.recommendationNarrative?.why && (
                  <p className="text-sm text-cyan-100">
                    <span className="font-semibold text-cyan-300">Why needed:</span> {selectedSession.recommendationNarrative.why}
                  </p>
                )}
              </div>
            )}

            {/* Drills Preview */}
            {selectedSession.json?.drills && selectedSession.json.drills.length > 0 && (
              <div className="mb-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                  Drills ({selectedSession.json.drills.length})
                </h3>
                {selectedSession.json.drills.slice(0, 2).map((drill: any, i: number) => {
                  const diagram = drill.diagram ?? drill.json?.diagram ?? drill.json?.diagramV1;
                  const description = drill.description ?? drill.json?.description;
                  const organization = drill.organization ?? drill.json?.organization;
                  return (
                    <div key={i} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
                      {/* Drill Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${
                          drill.drillType === 'WARMUP' ? 'bg-amber-900/40 text-amber-300 border border-amber-700/30' :
                          drill.drillType === 'TECHNICAL' ? 'bg-blue-900/40 text-blue-300 border border-blue-700/30' :
                          drill.drillType === 'TACTICAL' ? 'bg-purple-900/40 text-purple-300 border border-purple-700/30' :
                          drill.drillType === 'CONDITIONED_GAME' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/30' :
                          drill.drillType === 'COOLDOWN' ? 'bg-slate-700/40 text-slate-300 border border-slate-600/30' :
                          'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {drill.drillType || drill.type || `Drill ${i + 1}`}
                        </span>
                        {drill.durationMin && (
                          <span className="text-[10px] text-slate-500">{drill.durationMin} min</span>
                        )}
                      </div>
                      <h4 className="font-semibold text-sm text-slate-200 mb-2">{drill.title || `Drill ${i + 1}`}</h4>
                      
                      {/* Two-column layout: Diagram + Details */}
                      <div className="grid grid-cols-1 gap-3">
                        {/* Diagram */}
                        {diagram && (
                          <div className="flex items-center justify-center rounded-lg border border-slate-700/30 bg-slate-900/50 p-2">
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
                        
                        {/* Description & Key Info */}
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
                {selectedSession.json.drills.length > 2 && (
                  <p className="text-xs text-slate-500 text-center">
                    + {selectedSession.json.drills.length - 2} more drills
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              <a
                href={`/demo/session?sessionId=${selectedSession.id}`}
                onClick={() => {
                  // Store session data in sessionStorage for the demo/session page
                  if (selectedSession.id) {
                    sessionStorage.setItem(
                      `vaultSession:${selectedSession.id}`,
                      JSON.stringify(selectedSession)
                    );
                  }
                }}
                className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                Open Full Session
                <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
              <button
                onClick={() => setSelectedSession(null)}
                className="inline-flex items-center rounded-full border border-slate-600 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Match Confirmation Dialog */}
      {noMatchDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-slate-600/50 bg-[#0f172a] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">No Matching Sessions Found</h3>
                <p className="text-sm text-slate-400">We couldn't find sessions matching your analysis criteria</p>
              </div>
            </div>
            
            <div className="mb-6 space-y-3">
              <p className="text-sm text-slate-300">
                Would you like to:
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400"></span>
                  <span><strong className="text-cyan-300">Expand search</strong> - Broaden criteria to find more sessions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"></span>
                  <span><strong className="text-emerald-300">Generate new</strong> - Create a custom session based on your analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500"></span>
                  <span><strong className="text-slate-300">Skip</strong> - Continue without session recommendations</span>
                </li>
              </ul>
            </div>
            
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={cancelRecommendationSearch}
                className="order-3 sm:order-1 inline-flex justify-center rounded-lg border border-slate-600 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Skip
              </button>
              <button
                onClick={expandSearchCriteria}
                disabled={recommendationsLoading}
                className="order-2 inline-flex justify-center rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-400/50 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Expand Search
              </button>
              <button
                onClick={proceedToGenerate}
                disabled={recommendationsLoading}
                className="order-1 inline-flex justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:order-3"
              >
                {recommendationsLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                ) : 'Generate New Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
