"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import UniversalDrillDiagram from "@/components/UniversalDrillDiagram";
import { tacticalEdgeToUniversalDrillData } from "@/lib/diagram-adapter";
import { getUserHeaders } from "@/lib/user";

// Label mappings (same as vault)
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
  ROCKLIN_FC: "Rocklin FC",
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

type Stats = {
  database: {
    totalSessions: number;
    totalDrills: number;
    totalSeries: number;
    vaultSessions: number;
    vaultDrills: number;
    seriesSessions: number;
    sessionDrillsCount: number; // Drills embedded in vault sessions
  };
  api: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRate: string;
  };
  tokens: {
    recentTotal: number;
    recentPromptTokens: number;
    recentCompletionTokens: number;
    allTimeTotal: number;
    allTimePromptTokens: number;
    allTimeCompletionTokens: number;
    allTimeCost: string;
    recentCost: string;
  };
  performance: {
    avgDurationMs: number;
    avgDurationSec: string;
    totalDurationMs: number;
  };
  pricing: {
    inputPer1M: number;
    outputPer1M: number;
    model: string;
  };
};

type TimelineDay = {
  date: string;
  calls: number;
  successful: number;
  failed: number;
  tokens: number;
  avgDuration: number;
  sessions: number;
  drills: number;
  series: number;
  skillFocus: number;
  qaReviews: number;
};

type RecentMetric = {
  id: string;
  operationType: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  promptLength: number;
  responseLength: number | null;
  durationMs: number;
  success: boolean;
  errorMessage: string | null;
  ageGroup: string | null;
  gameModelId: string | null;
  createdAt: string;
};

type OperationStats = {
  type: string;
  count: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  avgTokens: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  totalDurationMs: number;
  avgDurationMs: number;
  totalCost: string;
  avgCost: string;
};

type AgeGroupStats = {
  ageGroup: string;
  count: number;
};

type AccountAlert = {
  id: string;
  action: string;
  resourceId: string | null;
  details?: {
    source?: string;
    account?: {
      email?: string;
      name?: string | null;
      role?: string | null;
      subscriptionPlan?: string | null;
      createdByEmail?: string | null;
    };
  } | null;
  createdAt: string;
  admin?: {
    id: string;
    email: string | null;
    name: string | null;
  } | null;
};

type RandomSessionsJob = {
  id: string;
  ageGroup: string;
  mode: "session" | "series";
  sessionsPerSeries?: number;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  status: "queued" | "running" | "completed" | "failed";
  startedAt: string;
  finishedAt?: string;
  results: Array<
    | { kind: "session"; id: string; refCode?: string; title?: string }
    | { kind: "series"; seriesId: string; totalSessions: number; firstRefCode?: string; title?: string }
  >;
  errors: Array<{ index: number; message: string }>;
};

// Keep admin bulk generator aligned with Vault filters
const VAULT_AGE_GROUPS = ["U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18"] as const;

type SessionReviewResult = {
  session: {
    id: string;
    refCode?: string | null;
    title: string;
    ageGroup: string;
    gameModelId: string;
    phase?: string | null;
    zone?: string | null;
    qaScore: number | null;
    approved: boolean;
  };
  qa: {
    pass: boolean;
    scores: Record<string, number>;
    avgScore: number | null;
    summary: string | null;
    notes: string[];
  };
  fixDecision: { code: string; reason: string };
};

type DrillReviewResult = {
  drill: {
    id: string;
    refCode: string | null;
    title: string;
    ageGroup: string;
    gameModelId: string;
    phase: string | null;
    zone: string | null;
    qaScore: number | null;
    approved: boolean;
  };
  qa: {
    pass: boolean;
    scores: Record<string, number>;
    avgScore: number | null;
    summary: string | null;
    notes: string[];
  };
  fixDecision: {
    code: string;
    reason: string;
  };
};

type SessionRegenerateResult = {
  replaced: boolean;
  original: { id: string; refCode?: string | null; title: string } | null;
  replacement: { id: string; refCode?: string; title?: string; qaScore: number | null; approved: boolean };
};

type DrillRegenerateResult = {
  replaced: boolean;
  original: { id: string; refCode?: string | null; title: string } | null;
  replacement: { id: string; refCode?: string; title?: string; qaScore: number | null; approved: boolean };
};

type DrillNormalizeStatus = {
  total: number;
  needsNormalization: number;
  missingCore?: number;
  needsReenrich?: number;
  processed: number;
  batchSize: number;
  job?: {
    running: boolean;
    startedAt: string | null;
    finishedAt: string | null;
    processed: number;
    updated: number;
    target: number;
    skippedMissingCore: number;
    lastError: string | null;
  };
  reenrichJob?: {
    running: boolean;
    startedAt: string | null;
    finishedAt: string | null;
    processed: number;
    updated: number;
    target: number;
    lastError: string | null;
  };
};

// Base URL for backend API (used for admin-only endpoints that require JWT)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  try {
    const token = localStorage.getItem("accessToken");
    const headers: HeadersInit = {};
    if (token) {
      (headers as any).Authorization = `Bearer ${token}`;
    }
    return headers;
  } catch {
    return {};
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [recentMetrics, setRecentMetrics] = useState<RecentMetric[]>([]);
  const [operationStats, setOperationStats] = useState<OperationStats[]>([]);
  const [ageGroupStats, setAgeGroupStats] = useState<AgeGroupStats[]>([]);
  const [seriesAgeGroupStats, setSeriesAgeGroupStats] = useState<AgeGroupStats[]>([]);
  const [usageByPlan, setUsageByPlan] = useState<any>(null);
  const [vaultUsage, setVaultUsage] = useState<any>(null);
  const [favoritesUsage, setFavoritesUsage] = useState<any>(null);
  const [featureAccess, setFeatureAccess] = useState<any>(null);
  const [trialAccounts, setTrialAccounts] = useState<any>(null);
  const [limitEnforcement, setLimitEnforcement] = useState<any>(null);
  const [clubAccounts, setClubAccounts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [pricePerSession, setPricePerSession] = useState(0.10);
  
  // System status
  const [systemStatus, setSystemStatus] = useState<{
    backend: "checking" | "online" | "offline";
    database: "checking" | "online" | "offline";
    lastChecked: Date | null;
  }>({
    backend: "checking",
    database: "checking",
    lastChecked: null,
  });

  // View JSON by reference code (admin)
  const [refCodeJsonInput, setRefCodeJsonInput] = useState("");
  const [refCodeJsonResult, setRefCodeJsonResult] = useState<{ type: string; refCode: string; data: any } | null>(null);
  const [refCodeJsonError, setRefCodeJsonError] = useState<string | null>(null);
  const [refCodeJsonCopied, setRefCodeJsonCopied] = useState(false);
  const [refCodeJsonLoading, setRefCodeJsonLoading] = useState(false);
  const [refCodeJsonHistory, setRefCodeJsonHistory] = useState<Array<{ refCode: string; type: string }>>([]);
  const refCodeInputRef = useRef<HTMLInputElement>(null);

  // Bulk random session generator (admin)
  const [bulkAgeGroup, setBulkAgeGroup] = useState<string>("U10");
  const [bulkMode, setBulkMode] = useState<"session" | "series">("session");
  const [bulkCount, setBulkCount] = useState<number>(5);
  const [bulkSessionsPerSeries, setBulkSessionsPerSeries] = useState<number>(3);
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [bulkJob, setBulkJob] = useState<RandomSessionsJob | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkJobError, setBulkJobError] = useState<string | null>(null);

  // Review session (admin)
  const [reviewRef, setReviewRef] = useState<string>("");
  const [reviewRunning, setReviewRunning] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<SessionReviewResult | null>(null);
  const [regenerateRunning, setRegenerateRunning] = useState<boolean>(false);
  const [regenerateResult, setRegenerateResult] = useState<SessionRegenerateResult | null>(null);
  const [regenerateReplace, setRegenerateReplace] = useState<boolean>(false);
  const [viewingSession, setViewingSession] = useState<any | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(false);
  const [viewingSessionIsFavorited, setViewingSessionIsFavorited] = useState<boolean>(false);
  const [checkingFavorite, setCheckingFavorite] = useState<boolean>(false);
  
  // Review drill (admin)
  const [reviewDrillRef, setReviewDrillRef] = useState<string>("");
  const [reviewDrillRunning, setReviewDrillRunning] = useState<boolean>(false);
  const [reviewDrillError, setReviewDrillError] = useState<string | null>(null);
  const [reviewDrillResult, setReviewDrillResult] = useState<DrillReviewResult | null>(null);
  const [regenerateDrillRunning, setRegenerateDrillRunning] = useState<boolean>(false);
  const [regenerateDrillResult, setRegenerateDrillResult] = useState<DrillRegenerateResult | null>(null);
  const [regenerateDrillReplace, setRegenerateDrillReplace] = useState<boolean>(false);
  const [viewingDrill, setViewingDrill] = useState<any | null>(null);
  const [loadingDrill, setLoadingDrill] = useState<boolean>(false);

  const [normalizeStatus, setNormalizeStatus] = useState<DrillNormalizeStatus | null>(null);
  const [normalizeBatchSize, setNormalizeBatchSize] = useState<number>(100);
  const [normalizeRunning, setNormalizeRunning] = useState<boolean>(false);
  const [normalizeResult, setNormalizeResult] = useState<any | null>(null);
  const [normalizeError, setNormalizeError] = useState<string | null>(null);
  const [normalizeStatusError, setNormalizeStatusError] = useState<string | null>(null);
  const [reenrichBatchSize, setReenrichBatchSize] = useState<number>(25);
  const [reenrichIncludeSessions, setReenrichIncludeSessions] = useState<boolean>(true);
  const [reenrichRunning, setReenrichRunning] = useState<boolean>(false);
  const [reenrichResult, setReenrichResult] = useState<any | null>(null);
  const [reenrichError, setReenrichError] = useState<string | null>(null);
  const [reenrichSessionId, setReenrichSessionId] = useState<string>("");
  const [reenrichSessionRunning, setReenrichSessionRunning] = useState<boolean>(false);
  const [reenrichSessionResult, setReenrichSessionResult] = useState<any | null>(null);
  const [reenrichSessionError, setReenrichSessionError] = useState<string | null>(null);
  const [deleteSessionRef, setDeleteSessionRef] = useState<string>("");
  const [deleteSessionRunning, setDeleteSessionRunning] = useState<boolean>(false);
  const [deleteSessionResult, setDeleteSessionResult] = useState<any | null>(null);
  const [deleteSessionError, setDeleteSessionError] = useState<string | null>(null);
  const [stripBatchSize, setStripBatchSize] = useState<number>(100);
  const [stripIncludeSessions, setStripIncludeSessions] = useState<boolean>(true);
  const [stripRunning, setStripRunning] = useState<boolean>(false);
  const [stripResult, setStripResult] = useState<any | null>(null);
  const [stripError, setStripError] = useState<string | null>(null);
  
  // QA Status Analytics
  const [qaAnalytics, setQaAnalytics] = useState<{
    total: number;
    withQA: number;
    withoutQA: number;
    statusCounts: {
      OK: number;
      PATCHABLE: number;
      NEEDS_REGEN: number;
      NO_QA_OR_PASS: number;
    };
    sessionsByStatus: {
      OK: Array<{ id: string; refCode: string | null; title: string; qaScore: number | null }>;
      PATCHABLE: Array<{ id: string; refCode: string | null; title: string; qaScore: number | null }>;
      NEEDS_REGEN: Array<{ id: string; refCode: string | null; title: string; qaScore: number | null }>;
      NO_QA_OR_PASS: Array<{ id: string; refCode: string | null; title: string; qaScore: number | null }>;
    };
  } | null>(null);
  const [loadingQaAnalytics, setLoadingQaAnalytics] = useState<boolean>(false);
  const [qaAnalyticsDrills, setQaAnalyticsDrills] = useState<{
    total: number;
    withQA: number;
    withoutQA: number;
    statusCounts: Record<string, number>;
    drillsByStatus: Record<string, Array<{ id: string; refCode: string | null; title: string; qaScore: number | null }>>;
  } | null>(null);
  const [loadingQaAnalyticsDrills, setLoadingQaAnalyticsDrills] = useState<boolean>(false);
  const [userSummary, setUserSummary] = useState<{
    totalUsers: number;
    byRole: Record<string, number>;
    byAdminRole: Record<string, number>;
    bySubscriptionPlan: Record<string, number>;
    bySubscriptionStatus: Record<string, number>;
  } | null>(null);
  const [accountAlerts, setAccountAlerts] = useState<AccountAlert[]>([]);

  // User Management
  const [users, setUsers] = useState<Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    adminRole: string | null;
    subscriptionPlan: string;
    subscriptionStatus: string;
    createdAt: string;
    lastLoginAt: string | null;
    blocked: boolean;
    blockedAt: string | null;
    blockedReason: string | null;
    emailVerified: boolean;
    emailVerifiedAt: string | null;
    coachLevel: string | null;
    teamAgeGroups: string[];
  }>>([]);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<{ userId: string; password?: string } | null>(null);
  const [blockingUser, setBlockingUser] = useState<string | null>(null);
  const [showBlockModal, setShowBlockModal] = useState<{ userId: string; email: string; currentlyBlocked: boolean } | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState<{ userId: string; email: string } | null>(null);
  const [deleteUserConfirmInput, setDeleteUserConfirmInput] = useState("");
  const [showResetPasswordModal, setShowResetPasswordModal] = useState<{ userId: string; email: string } | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState<string | null>(null);
  const [emailActionNotice, setEmailActionNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [roleActionNotice, setRoleActionNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [updatingUserRole, setUpdatingUserRole] = useState<string | null>(null);
  const [showCoachLevelModal, setShowCoachLevelModal] = useState<{ userId: string; email: string; currentCoachLevel: string | null; currentAgeGroups: string[] } | null>(null);
  const [coachLevelForm, setCoachLevelForm] = useState({
    coachLevel: "" as "" | "GRASSROOTS" | "USSF_C" | "USSF_B_PLUS",
    teamAgeGroups: [] as string[],
  });
  const [updatingCoachLevel, setUpdatingCoachLevel] = useState<string | null>(null);

  // Access Permissions Management
  const [accessPermissions, setAccessPermissions] = useState<Array<{
    id: string;
    userId: string | null;
    user: { id: string; email: string | null; name: string | null; coachLevel: string | null } | null;
    resourceType: string;
    coachLevel: string | null;
    ageGroups: string[];
    formats: string[];
    canGenerateSessions: boolean;
    canAccessVault: boolean;
    canAccessVideoReview: boolean;
    notes: string | null;
    createdAt: string;
  }>>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState<{ permission?: any } | null>(null);
  type PermissionFormState = {
    userId: string;
    resourceType: "SESSION" | "VAULT" | "BOTH" | "VIDEO_REVIEW";
    coachLevel: "" | "GRASSROOTS" | "USSF_C" | "USSF_B_PLUS";
    ageGroups: string[];
    formats: string[];
    canGenerateSessions: boolean;
    canAccessVault: boolean;
    canAccessVideoReview: boolean;
    notes: string;
  };
  const createEmptyPermissionForm = (): PermissionFormState => ({
    userId: "" as string | "",
    resourceType: "BOTH" as "SESSION" | "VAULT" | "BOTH" | "VIDEO_REVIEW",
    coachLevel: "" as "" | "GRASSROOTS" | "USSF_C" | "USSF_B_PLUS",
    ageGroups: [] as string[],
    formats: [] as string[],
    canGenerateSessions: false,
    canAccessVault: false,
    canAccessVideoReview: false,
    notes: "",
  });
  const [permissionForm, setPermissionForm] = useState<PermissionFormState>(
    createEmptyPermissionForm()
  );
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    email: "",
    name: "",
    role: "FREE" as "FREE" | "COACH" | "CLUB" | "ADMIN" | "TRIAL",
    adminRole: "" as "" | "SUPER_ADMIN" | "ADMIN" | "MODERATOR" | "SUPPORT",
    password: "",
    autoVerifyEmail: false,
    coachLevel: "" as "" | "GRASSROOTS" | "USSF_C" | "USSF_B_PLUS",
    teamAgeGroups: [] as string[],
  });
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserSuccess, setCreateUserSuccess] = useState<{ email: string; password?: string } | null>(null);

  const checkSystemStatus = useCallback(async () => {
    const apiUrl = API_BASE_URL;
    
    // Check backend API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const res = await fetch(`${apiUrl}/health`, { 
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        setSystemStatus(prev => ({ ...prev, backend: "online" }));
        
        // Check database via admin stats endpoint (requires admin auth)
        try {
          const statsRes = await fetch(`${apiUrl}/admin/stats`, {
            cache: "no-store",
            headers: getAuthHeaders(),
          });
          if (statsRes.ok) {
            setSystemStatus(prev => ({ ...prev, database: "online" }));
          } else if (statsRes.status === 401) {
            // Auth issue: backend is up, but user is not authorized
            // Treat DB as online but indicate need for login via UI metrics (not system status)
            setSystemStatus(prev => ({ ...prev, database: "online" }));
          } else {
            setSystemStatus(prev => ({ ...prev, database: "offline" }));
          }
        } catch {
          setSystemStatus(prev => ({ ...prev, database: "offline" }));
        }
      } else {
        setSystemStatus(prev => ({ ...prev, backend: "offline", database: "offline" }));
      }
    } catch (e) {
      setSystemStatus(prev => ({ ...prev, backend: "offline", database: "offline" }));
    } finally {
      setSystemStatus(prev => ({ ...prev, lastChecked: new Date() }));
    }
  }, []);

  const lookupRefCodeJson = useCallback(async (overrideRefCode?: string) => {
    const raw = overrideRefCode ?? refCodeJsonInput;
    const refCode = String(raw ?? "").trim().toUpperCase();
    if (!refCode || /^\[object\s+object\]$/i.test(refCode)) {
      setRefCodeJsonError("Enter a reference code (e.g. D-1234, S-5678)");
      setRefCodeJsonResult(null);
      return;
    }
    setRefCodeJsonError(null);
    setRefCodeJsonResult(null);
    setRefCodeJsonCopied(false);
    setRefCodeJsonLoading(true);
    try {
      const res = await fetch(`/api/vault/lookup/${encodeURIComponent(refCode)}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRefCodeJsonError(data?.error || `Request failed: ${res.status}`);
        return;
      }
      if (data.found && data.data) {
        const refCodeStr = String(data.refCode ?? refCode ?? "").trim().toUpperCase();
        const entry = { type: data.type, refCode: refCodeStr, data: data.data };
        setRefCodeJsonResult(entry);
        if (refCodeStr && !/^\[object object\]$/i.test(refCodeStr)) {
          setRefCodeJsonHistory((prev) => {
            const next = [{ refCode: refCodeStr, type: String(data.type ?? "") }, ...prev.filter((h) => String(h.refCode ?? "") !== refCodeStr)];
            return next.slice(0, 5);
          });
        }
      } else {
        setRefCodeJsonError(data?.error || "No data returned");
      }
    } catch (e: any) {
      setRefCodeJsonError(e?.message || "Lookup failed");
    } finally {
      setRefCodeJsonLoading(false);
    }
  }, [refCodeJsonInput]);
  const lookupRefCodeByCode = (code: string | unknown) => {
    const codeStr = String(code ?? "").trim();
    if (!codeStr || /^\[object\s+object\]$/i.test(codeStr)) return;
    setRefCodeJsonInput(codeStr);
    lookupRefCodeJson(codeStr);
  };

  const copyRefCodeJson = useCallback(() => {
    if (!refCodeJsonResult) return;
    const jsonStr = JSON.stringify(refCodeJsonResult.data, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setRefCodeJsonCopied(true);
      setTimeout(() => setRefCodeJsonCopied(false), 2000);
    });
  }, [refCodeJsonResult]);

  // Fetch QA Analytics for Drills
  const fetchQaAnalyticsDrills = useCallback(async () => {
    // Check if user is authenticated
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) {
      console.warn("Cannot fetch QA analytics for drills: not authenticated");
      return;
    }

    setLoadingQaAnalyticsDrills(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout (increased from 30s)

      const res = await fetch(`${API_BASE_URL}/admin/analytics/qa-status-drills`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => "Could not read error response");
        console.error(`QA analytics drills fetch failed: ${res.status} ${res.statusText}`, errorText);
        return;
      }
      
      const data = await res.json();
      if (data?.ok) {
        setQaAnalyticsDrills(data);
      } else {
        console.error("QA analytics drills response not ok:", data);
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        console.warn("QA analytics drills fetch timed out after 60 seconds - this query may be slow with large datasets");
        // Don't show error to user, just log it - analytics are non-critical
      } else {
        console.error("Error fetching QA analytics for drills:", e);
        // Check if it's a network error
        if (e.message === "Failed to fetch" || e.name === "TypeError") {
          console.error("Network error - is the API server running on", API_BASE_URL, "?");
        }
      }
    } finally {
      setLoadingQaAnalyticsDrills(false);
    }
  }, []);

  // NOTE: keep fetchData defined before callbacks that reference it (TDZ-safe)
  const fetchQaAnalytics = useCallback(async () => {
    // Check if user is authenticated
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!token) {
      console.warn("Cannot fetch QA analytics: not authenticated");
      return;
    }

    setLoadingQaAnalytics(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout (increased from 30s)

      const res = await fetch(`${API_BASE_URL}/admin/analytics/qa-status`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => "Could not read error response");
        console.error(`QA analytics fetch failed: ${res.status} ${res.statusText}`, errorText);
        return;
      }
      
      const data = await res.json();
      if (data?.ok) {
        setQaAnalytics(data);
      } else {
        console.error("QA analytics response not ok:", data);
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        console.warn("QA analytics fetch timed out after 60 seconds - this query may be slow with large datasets");
        // Don't show error to user, just log it - analytics are non-critical
      } else {
        console.error("Error fetching QA analytics:", e);
        // Check if it's a network error
        if (e.message === "Failed to fetch" || e.name === "TypeError") {
          console.error("Network error - is the API server running on", API_BASE_URL, "?");
        }
      }
    } finally {
      setLoadingQaAnalytics(false);
    }
  }, []);

  const checkSessionFavoriteStatus = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    setCheckingFavorite(true);
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
        setViewingSessionIsFavorited(data?.sessions?.[sessionId] || false);
      }
    } catch (e) {
      console.error("Error checking favorite status:", e);
    } finally {
      setCheckingFavorite(false);
    }
  }, []);

  const toggleViewingSessionFavorite = useCallback(async () => {
    if (!viewingSession?.id) return;
    const isFavorited = viewingSessionIsFavorited;
    
    try {
      const res = await fetch(`/api/favorites/session/${viewingSession.id}`, {
        method: isFavorited ? "DELETE" : "POST",
        headers: getUserHeaders(),
      });
      
      if (res.ok) {
        setViewingSessionIsFavorited(!isFavorited);
      }
    } catch (e) {
      console.error("Error toggling favorite:", e);
    }
  }, [viewingSession?.id, viewingSessionIsFavorited]);

  const loadUsers = useCallback(async (page: number = 1) => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users?page=${page}&limit=50`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        setUsers(data.users || []);
        setUsersPage(data.pagination?.page || 1);
        setUsersTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (e: any) {
      console.error("Error loading users:", e);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const authHeaders = getAuthHeaders();
      const [statsRes, timelineRes, recentRes, operationsRes, ageRes, userSummaryRes, usageByPlanRes, vaultUsageRes, favoritesUsageRes, featureAccessRes, trialAccountsRes, limitEnforcementRes, clubAccountsRes, normalizeStatusRes, accountAlertsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/stats`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/metrics/timeline?days=7`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/metrics/recent?limit=20`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/metrics/by-operation`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/stats/by-age-group`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/users/summary`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/analytics/usage-by-plan`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/analytics/vault-usage`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/analytics/favorites-usage`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/analytics/feature-access`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/analytics/trial-accounts`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/analytics/limit-enforcement`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/analytics/club-accounts`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/drills/normalize-status`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/admin/account-alerts?limit=20`, { headers: authHeaders }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.ok) {
          setStats(statsData.stats);
        }
      }
      if (normalizeStatusRes.ok) {
        const normData = await normalizeStatusRes.json();
        if (normData.ok) {
          setNormalizeStatus({
            total: normData.total,
            needsNormalization: normData.needsNormalization,
            missingCore: normData.missingCore,
            needsReenrich: normData.needsReenrich,
            processed: normData.processed,
            batchSize: normData.batchSize,
            job: normData.job,
            reenrichJob: normData.reenrichJob,
          });
        }
      }

      if (timelineRes.ok) {
        const timelineData = await timelineRes.json();
        if (timelineData.ok) {
          setTimeline(timelineData.timeline || []);
        }
      }

      if (recentRes.ok) {
        const recentData = await recentRes.json();
        if (recentData.ok) {
          setRecentMetrics(recentData.metrics || []);
        }
      }

      if (operationsRes.ok) {
        const operationsData = await operationsRes.json();
        if (operationsData.ok) {
          setOperationStats(operationsData.operations || []);
        }
      }

      if (ageRes.ok) {
        const ageData = await ageRes.json();
        if (ageData.ok) {
          setAgeGroupStats(ageData.sessions || []);
          setSeriesAgeGroupStats(ageData.seriesSessions || []);
        }
      }

      if (userSummaryRes.ok) {
        const userSummaryData = await userSummaryRes.json();
        if (userSummaryData.ok) {
          setUserSummary(userSummaryData.summary);
        }
      }

      if (usageByPlanRes.ok) {
        const data = await usageByPlanRes.json();
        if (data.ok) {
          setUsageByPlan(data.usageByPlan);
        }
      }

      if (vaultUsageRes.ok) {
        const data = await vaultUsageRes.json();
        if (data.ok) {
          setVaultUsage(data.vaultUsageByPlan);
        }
      }

      if (favoritesUsageRes.ok) {
        const data = await favoritesUsageRes.json();
        if (data.ok) {
          setFavoritesUsage(data.favoritesByPlan);
        }
      }

      if (featureAccessRes.ok) {
        const data = await featureAccessRes.json();
        if (data.ok) {
          setFeatureAccess(data.featureAccess);
        }
      }

      if (trialAccountsRes.ok) {
        const data = await trialAccountsRes.json();
        if (data.ok) {
          setTrialAccounts(data.trialAccounts);
        }
      }

      if (limitEnforcementRes.ok) {
        const data = await limitEnforcementRes.json();
        if (data.ok) {
          setLimitEnforcement(data.limitEnforcement);
        }
      }

      if (clubAccountsRes.ok) {
        const data = await clubAccountsRes.json();
        if (data.ok) {
          setClubAccounts(data.clubAccounts);
        }
      }

      if (accountAlertsRes.ok) {
        const data = await accountAlertsRes.json();
        if (data.ok) {
          setAccountAlerts(Array.isArray(data.alerts) ? data.alerts : []);
        }
      }
    } catch (e: any) {
      console.error("Error fetching data:", e);
      setError(e?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(async () => {
    setCreatingUser(true);
    setCreateUserError(null);
    setCreateUserSuccess(null);
    try {
      const res = await fetch("/api/admin/users/quick-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          email: createUserForm.email,
          name: createUserForm.name || undefined,
          role: createUserForm.role,
          adminRole: createUserForm.adminRole || undefined,
          password: createUserForm.password && createUserForm.password.length > 0 ? createUserForm.password : undefined,
          autoVerifyEmail: createUserForm.autoVerifyEmail,
          coachLevel: createUserForm.role === "COACH" && createUserForm.coachLevel ? createUserForm.coachLevel : undefined,
          teamAgeGroups: createUserForm.role === "COACH" && createUserForm.teamAgeGroups.length > 0 ? createUserForm.teamAgeGroups : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCreateUserSuccess({
          email: data.user.email,
          password: data.initialPassword,
        });
        setCreateUserForm({
          email: "",
          name: "",
          role: "FREE",
          adminRole: "",
          password: "",
          autoVerifyEmail: false,
          coachLevel: "",
          teamAgeGroups: [],
        });
        // Reload users and summary
        loadUsers(1);
        fetchData();
      } else {
        setCreateUserError(data.error || "Failed to create user");
      }
    } catch (e: any) {
      setCreateUserError(e?.message || "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  }, [createUserForm, loadUsers, fetchData]);

  const updateUserRole = useCallback(async (userId: string, role?: string, adminRole?: string | null) => {
    setRoleActionNotice(null);
    setUpdatingUserRole(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ...(role && { role }),
          ...(adminRole !== undefined && { adminRole }),
        }),
      });
      const data = await res.json().catch(() => null);
      if (data.ok) {
        // Reload users and summary
        await loadUsers(usersPage);
        await fetchData();
        setRoleActionNotice({ type: "success", message: "User role updated." });
      } else {
        setRoleActionNotice({ type: "error", message: data?.error || "Failed to update role" });
      }
    } catch (e: any) {
      setRoleActionNotice({
        type: "error",
        message:
          e?.message === "Failed to fetch" || e?.name === "TypeError"
            ? "Could not reach the admin API. Check API_URL/NEXT_PUBLIC_API_URL and backend availability."
            : e?.message || "Failed to update role",
      });
    } finally {
      setUpdatingUserRole(null);
    }
  }, [usersPage, loadUsers, fetchData]);

  const resetUserPassword = useCallback(async (userId: string, password?: string) => {
    setResettingPassword(userId);
    setResetPasswordSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          password: password && password.trim() ? password.trim() : undefined,
          autoGenerate: !password || password.trim() === "",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResetPasswordSuccess({
          userId,
          password: data.newPassword,
        });
        // Reload users after a short delay to show success message
        setTimeout(() => {
          loadUsers(usersPage);
          setResetPasswordSuccess(null);
        }, 3000);
      } else {
        alert(data.error || "Failed to reset password");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to reset password");
    } finally {
      setResettingPassword(null);
    }
  }, [usersPage, loadUsers]);

  const updateCoachLevel = useCallback(async (userId: string, coachLevel: string, teamAgeGroups: string[]) => {
    setUpdatingCoachLevel(userId);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/coach-level`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          coachLevel: coachLevel || null,
          teamAgeGroups: teamAgeGroups.length > 0 ? teamAgeGroups : [],
        }),
      });
      const data = await res.json();
      if (data.ok) {
        loadUsers(usersPage);
        fetchData();
        setShowCoachLevelModal(null);
        setCoachLevelForm({ coachLevel: "", teamAgeGroups: [] });
      } else {
        alert(data.error || "Failed to update coach level");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to update coach level");
    } finally {
      setUpdatingCoachLevel(null);
    }
  }, [usersPage, loadUsers, fetchData]);

  const toggleUserBlock = useCallback(async (userId: string, blocked: boolean, reason?: string) => {
    setBlockingUser(userId);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/block`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          blocked,
          reason: reason || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        // Reload users and summary
        loadUsers(usersPage);
        fetchData();
        setShowBlockModal(null);
        setBlockReason("");
      } else {
        alert(data.error || `Failed to ${blocked ? 'block' : 'unblock'} user`);
      }
    } catch (e: any) {
      alert(e?.message || `Failed to ${blocked ? 'block' : 'unblock'} user`);
    } finally {
      setBlockingUser(null);
    }
  }, [usersPage, loadUsers, fetchData]);

  const deleteUserAccount = useCallback(async (userId: string) => {
    setDeletingUser(userId);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok) {
        setShowDeleteUserModal(null);
        setDeleteUserConfirmInput("");
        setEmailActionNotice({
          type: "success",
          message: "User account and related account data deleted successfully.",
        });
        loadUsers(usersPage);
        fetchData();
      } else {
        alert(data?.error || "Failed to delete user account");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to delete user account");
    } finally {
      setDeletingUser(null);
    }
  }, [usersPage, loadUsers, fetchData]);

  const verifyUserEmail = useCallback(async (userId: string) => {
    setEmailActionNotice(null);
    setVerifyingEmail(userId);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      const data = await res.json();
      if (data.ok) {
        setEmailActionNotice({ type: "success", message: "User email marked as verified." });
        loadUsers(usersPage);
        fetchData();
      } else {
        setEmailActionNotice({ type: "error", message: data.error || "Failed to verify email" });
      }
    } catch (e: any) {
      setEmailActionNotice({ type: "error", message: e?.message || "Failed to verify email" });
    } finally {
      setVerifyingEmail(null);
    }
  }, [usersPage, loadUsers, fetchData]);

  const resendVerificationEmail = useCallback(async (userId: string) => {
    setEmailActionNotice(null);
    setResendingVerification(userId);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      const data = await res.json();
      if (data.ok) {
        if (data.token) {
          setEmailActionNotice({
            type: "success",
            message: `Verification email sent. Dev token: ${data.token}`,
          });
        } else {
          setEmailActionNotice({ type: "success", message: "Verification email sent." });
        }
        loadUsers(usersPage);
      } else {
        setEmailActionNotice({
          type: "error",
          message: data.error || "Failed to resend verification email",
        });
      }
    } catch (e: any) {
      setEmailActionNotice({
        type: "error",
        message: e?.message || "Failed to resend verification email",
      });
    } finally {
      setResendingVerification(null);
    }
  }, [usersPage, loadUsers]);

  // Access Permissions Management
  const loadPermissions = useCallback(async () => {
    setLoadingPermissions(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/access-permissions`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        setAccessPermissions(data.permissions || []);
      }
    } catch (e: any) {
      console.error("Error loading permissions:", e);
    } finally {
      setLoadingPermissions(false);
    }
  }, []);

  const savePermission = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/access-permissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          id: showPermissionModal?.permission?.id,
          userId: permissionForm.userId || null,
          resourceType: permissionForm.resourceType,
          coachLevel: permissionForm.userId ? null : (permissionForm.coachLevel || null), // For permission: null if userId set
          updateUserCoachLevel: permissionForm.userId && permissionForm.coachLevel ? true : undefined, // Flag to update user's coach level
          ageGroups: permissionForm.ageGroups,
          formats: permissionForm.formats,
          canGenerateSessions: permissionForm.canGenerateSessions,
          canAccessVault: permissionForm.canAccessVault,
          canAccessVideoReview: permissionForm.canAccessVideoReview,
          notes: permissionForm.notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        loadPermissions();
        // Reload users list to reflect any coach level changes
        if (permissionForm.userId) {
          loadUsers(usersPage);
        }
        setShowPermissionModal(null);
        setPermissionForm(createEmptyPermissionForm());
      } else {
        alert(data.error || "Failed to save permission");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to save permission");
    }
  }, [permissionForm, showPermissionModal, loadPermissions]);

  const deletePermission = useCallback(async (permissionId: string) => {
    if (!confirm("Are you sure you want to delete this permission?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/access-permissions/${permissionId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        loadPermissions();
      } else {
        alert(data.error || "Failed to delete permission");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to delete permission");
    }
  }, [loadPermissions]);

  const startBulkRandomSessions = useCallback(async () => {
    setBulkJobError(null);
    setBulkRunning(true);
    setBulkJob(null);
    setBulkJobId(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/random-sessions/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ageGroup: bulkAgeGroup,
          mode: bulkMode,
          count: bulkCount,
          sessionsPerSeries: bulkMode === "series" ? bulkSessionsPerSeries : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Failed to start job (${res.status})`);
      }
      setBulkJobId(data.jobId);
    } catch (e: any) {
      setBulkJobError(e?.message || String(e));
      setBulkRunning(false);
    }
  }, [bulkAgeGroup, bulkCount]);

  const pollBulkJob = useCallback(async () => {
    if (!bulkJobId) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/random-sessions/${encodeURIComponent(bulkJobId)}`,
        {
          cache: "no-store",
          headers: getAuthHeaders(),
        }
      );
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Failed to fetch job status (${res.status})`);
      }
      const job: RandomSessionsJob = data.job;
      setBulkJob(job);

      if (job.status === "completed" || job.status === "failed") {
        setBulkRunning(false);
        // Refresh admin stats so Age Group counts update
        fetchData();
      }
    } catch (e: any) {
      setBulkJobError(e?.message || String(e));
      setBulkRunning(false);
    }
  }, [bulkJobId, fetchData]);

  // Check admin access on mount
  useEffect(() => {
    const checkAdminAccess = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!token) {
        setHasAdminAccess(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/admin/stats`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        });
        
        if (res.ok) {
          setHasAdminAccess(true);
        } else if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (data.error === "Admin access required" || data.message?.includes("SUPER_ADMIN")) {
            setHasAdminAccess(false);
          } else {
            setHasAdminAccess(true); // Other 403 might be temporary
          }
        } else {
          setHasAdminAccess(true); // Assume access for other errors
        }
      } catch (e) {
        // Network error - assume access for now
        setHasAdminAccess(true);
      }
    };

    checkAdminAccess();
  }, []);

  // Load users and permissions on mount (only if admin access)
  useEffect(() => {
    if (hasAdminAccess === true) {
      loadUsers(1);
      loadPermissions();
    }
  }, [hasAdminAccess, loadUsers, loadPermissions]);

  useEffect(() => {
    fetchData();
    checkSystemStatus();
    fetchQaAnalytics();
    fetchQaAnalyticsDrills();
    
    // Check system status every 30 seconds
    const statusInterval = setInterval(checkSystemStatus, 30000);
    return () => clearInterval(statusInterval);
  }, [fetchData, checkSystemStatus, fetchQaAnalytics, fetchQaAnalyticsDrills]);

  // Poll bulk job progress while running
  useEffect(() => {
    if (!bulkJobId) return;
    if (!bulkRunning) return;
    // initial tick
    pollBulkJob();
    const interval = setInterval(pollBulkJob, 1000);
    return () => clearInterval(interval);
  }, [bulkJobId, bulkRunning, pollBulkJob]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const formatNumber = (n: number) => n.toLocaleString();
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };
  const getOperationLabel = (type: string) => {
    if (type === "unknown") return "Unattributed (legacy)";
    return type.replace(/_/g, " ");
  };
  const calculateRowCost = (promptTokens: number | null, completionTokens: number | null) => {
    const input = promptTokens || 0;
    const output = completionTokens || 0;
    const cost = (input / 1_000_000) * 0.10 + (output / 1_000_000) * 0.40;
    return cost < 0.0001 ? "<$0.0001" : `$${cost.toFixed(4)}`;
  };

  const bulkMaxCount = bulkMode === "series" ? 10 : 25;
  const bulkUnitLabel = bulkMode === "series" ? "series" : "sessions";

  const runSessionReview = useCallback(async () => {
    const ref = reviewRef.trim();
    if (!ref) {
      setReviewError("Enter a Session ID or refCode (e.g., S-AB12 or UUID).");
      return;
    }

    setReviewRunning(true);
    setReviewError(null);
    setReviewResult(null);
    setRegenerateResult(null); // Clear previous regeneration result

    try {
      const res = await fetch(`${API_BASE_URL}/admin/sessions/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ sessionRef: ref }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Review failed (${res.status})`);
      }
      setReviewResult({
        session: data.session,
        qa: data.qa,
        fixDecision: data.fixDecision,
      });
    } catch (e: any) {
      setReviewError(e?.message || String(e));
    } finally {
      setReviewRunning(false);
    }
  }, [reviewRef]);

  const runDrillReview = useCallback(async () => {
    const ref = reviewDrillRef.trim();
    if (!ref) {
      setReviewDrillError("Enter a Drill ID or refCode (e.g., D-AB12 or UUID).");
      return;
    }

    setReviewDrillRunning(true);
    setReviewDrillError(null);
    setReviewDrillResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/drills/review`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ drillRef: ref }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to review drill");
      }

      setReviewDrillResult(data);
    } catch (err: any) {
      setReviewDrillError(err.message || "Failed to review drill");
    } finally {
      setReviewDrillRunning(false);
    }
  }, [reviewDrillRef]);

  const runDrillRegenerate = useCallback(async () => {
    const ref = reviewDrillRef.trim();
    if (!ref) {
      setReviewDrillError("Enter a Drill ID or refCode (e.g., D-AB12 or UUID).");
      return;
    }

    setRegenerateDrillRunning(true);
    setReviewDrillError(null);
    setRegenerateDrillResult(null);

    try {
      console.log("[ADMIN] Starting drill regeneration:", { ref, replace: regenerateDrillReplace });
      const res = await fetch(`${API_BASE_URL}/admin/drills/regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ drillRef: ref, replace: regenerateDrillReplace }),
      });
      
      const data = await res.json();
      console.log("[ADMIN] Drill regeneration response:", { ok: data?.ok, status: res.status, data });
      
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Regeneration failed (${res.status})`);
      }
      
      if (!data?.replacement) {
        throw new Error("No replacement drill returned from server");
      }
      
      setRegenerateDrillResult({
        replaced: data.replaced || false,
        original: data.original || null,
        replacement: data.replacement,
      });
      // Clear any previous errors
      setReviewDrillError(null);
      console.log("[ADMIN] Drill regeneration successful:", {
        replaced: data.replaced,
        original: data.original?.refCode || data.original?.id,
        replacement: data.replacement?.refCode || data.replacement?.id,
      });
      // Refresh stats to show new drill in counts
      fetchData();
    } catch (e: any) {
      console.error("[ADMIN] Drill regeneration error:", e);
      setReviewDrillError(e?.message || String(e));
      setRegenerateDrillResult(null);
    } finally {
      setRegenerateDrillRunning(false);
    }
  }, [reviewDrillRef, regenerateDrillReplace, fetchData]);

  const runDrillNormalizeBatch = useCallback(async () => {
    setNormalizeRunning(true);
    setNormalizeError(null);
    setNormalizeResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/drills/normalize-diagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ all: true, limit: normalizeBatchSize }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Normalize failed (${res.status})`);
      }
      setNormalizeResult(data);
      const statusRes = await fetch(`${API_BASE_URL}/admin/drills/normalize-status`, {
        headers: { ...getAuthHeaders() },
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.ok) {
          setNormalizeStatus({
            total: statusData.total,
            needsNormalization: statusData.needsNormalization,
            missingCore: statusData.missingCore,
            needsReenrich: statusData.needsReenrich,
            processed: statusData.processed,
            batchSize: statusData.batchSize,
            job: statusData.job,
            reenrichJob: statusData.reenrichJob,
          });
          setNormalizeStatusError(null);
        }
      } else {
        const errText = await statusRes.text().catch(() => "");
        setNormalizeStatusError(`Status fetch failed (${statusRes.status}) ${errText}`);
      }
    } catch (e: any) {
      setNormalizeError(e?.message || String(e));
    } finally {
      setNormalizeRunning(false);
    }
  }, [normalizeBatchSize]);

  const runDrillReenrichBatch = useCallback(async () => {
    setReenrichRunning(true);
    setReenrichError(null);
    setReenrichResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/drills/reenrich-diagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          all: true,
          limit: reenrichBatchSize,
          includeSessions: reenrichIncludeSessions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Re-enrich failed (${res.status})`);
      }
      setReenrichResult(data);
      const statusRes = await fetch(`${API_BASE_URL}/admin/drills/normalize-status`, {
        headers: { ...getAuthHeaders() },
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.ok) {
      setNormalizeStatus({
        total: statusData.total,
        needsNormalization: statusData.needsNormalization,
        missingCore: statusData.missingCore,
        needsReenrich: statusData.needsReenrich,
        processed: statusData.processed,
        batchSize: statusData.batchSize,
        job: statusData.job,
        reenrichJob: statusData.reenrichJob,
      });
          setNormalizeStatusError(null);
        }
      }
    } catch (e: any) {
      setReenrichError(e?.message || String(e));
    } finally {
      setReenrichRunning(false);
    }
  }, [reenrichBatchSize, reenrichIncludeSessions]);

  const runSessionReenrich = useCallback(async () => {
    if (!reenrichSessionId.trim()) {
      setReenrichSessionError("Session ID is required");
      return;
    }
    setReenrichSessionRunning(true);
    setReenrichSessionError(null);
    setReenrichSessionResult(null);
    try {
      const input = reenrichSessionId.trim();
      const isRefCode = /^[sS]-[A-Z0-9]{4}$/.test(input);
      const payload = isRefCode ? { refCode: input.toUpperCase() } : { sessionId: input };
      const res = await fetch(`${API_BASE_URL}/admin/sessions/reenrich-diagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const rawText = await res.text().catch(() => "");
      let data: any = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { raw: rawText };
        }
      }
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.raw || `Re-enrich failed (${res.status})`);
      }
      setReenrichSessionResult(data);
    } catch (e: any) {
      setReenrichSessionError(e?.message || String(e));
    } finally {
      setReenrichSessionRunning(false);
    }
  }, [reenrichSessionId]);

  const runDeleteSession = useCallback(async () => {
    const input = deleteSessionRef.trim();
    if (!input) {
      setDeleteSessionError("Session ID or ref code is required");
      return;
    }
    if (!window.confirm(`Delete session ${input}? This cannot be undone.`)) {
      return;
    }

    setDeleteSessionRunning(true);
    setDeleteSessionError(null);
    setDeleteSessionResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/sessions/${encodeURIComponent(input)}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Delete failed (${res.status})`);
      }
      setDeleteSessionResult(data);
      fetchData();
    } catch (e: any) {
      setDeleteSessionError(e?.message || String(e));
    } finally {
      setDeleteSessionRunning(false);
    }
  }, [deleteSessionRef, fetchData]);

  const runStripGenericOverlays = useCallback(async () => {
    setStripRunning(true);
    setStripError(null);
    setStripResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/drills/strip-generic-diagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          all: true,
          limit: stripBatchSize,
          includeSessions: stripIncludeSessions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Strip failed (${res.status})`);
      }
      setStripResult(data);
      const statusRes = await fetch(`${API_BASE_URL}/admin/drills/normalize-status`, {
        headers: { ...getAuthHeaders() },
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.ok) {
          setNormalizeStatus({
            total: statusData.total,
            needsNormalization: statusData.needsNormalization,
            missingCore: statusData.missingCore,
            needsReenrich: statusData.needsReenrich,
            processed: statusData.processed,
            batchSize: statusData.batchSize,
            job: statusData.job,
            reenrichJob: statusData.reenrichJob,
          });
          setNormalizeStatusError(null);
        }
      }
    } catch (e: any) {
      setStripError(e?.message || String(e));
    } finally {
      setStripRunning(false);
    }
  }, [stripBatchSize, stripIncludeSessions]);

  const refreshNormalizeStatus = useCallback(async () => {
    setNormalizeStatusError(null);
    try {
      const statusRes = await fetch(`${API_BASE_URL}/admin/drills/normalize-status`, {
        headers: { ...getAuthHeaders() },
      });
      if (!statusRes.ok) {
        const errText = await statusRes.text().catch(() => "");
        setNormalizeStatusError(`Status fetch failed (${statusRes.status}) ${errText}`);
        return;
      }
      const statusData = await statusRes.json();
      if (statusData.ok) {
      setNormalizeStatus({
        total: statusData.total,
        needsNormalization: statusData.needsNormalization,
        missingCore: statusData.missingCore,
        needsReenrich: statusData.needsReenrich,
        processed: statusData.processed,
        batchSize: statusData.batchSize,
        job: statusData.job,
        reenrichJob: statusData.reenrichJob,
      });
      } else {
        setNormalizeStatusError(statusData?.error || "Status fetch failed");
      }
    } catch (e: any) {
      setNormalizeStatusError(e?.message || String(e));
    }
  }, []);

  useEffect(() => {
    const shouldPoll = normalizeRunning || reenrichRunning || normalizeStatus?.job?.running || normalizeStatus?.reenrichJob?.running;
    if (!shouldPoll) return;
    const interval = setInterval(() => {
      refreshNormalizeStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [normalizeRunning, reenrichRunning, normalizeStatus?.job?.running, normalizeStatus?.reenrichJob?.running, refreshNormalizeStatus]);

  const runSessionRegenerate = useCallback(async () => {
    const ref = reviewRef.trim();
    if (!ref) {
      setReviewError("Enter a Session ID or refCode (e.g., S-AB12 or UUID).");
      return;
    }

    setRegenerateRunning(true);
    setReviewError(null);
    setRegenerateResult(null);

    try {
      console.log("[ADMIN] Starting session regeneration:", { ref, replace: regenerateReplace });
      const res = await fetch(`${API_BASE_URL}/admin/sessions/regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ sessionRef: ref, replace: regenerateReplace }),
      });
      
      const data = await res.json();
      console.log("[ADMIN] Regeneration response:", { ok: data?.ok, status: res.status, data });
      
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Regeneration failed (${res.status})`);
      }
      
      if (!data?.replacement) {
        throw new Error("No replacement session returned from server");
      }
      
      setRegenerateResult({
        replaced: data.replaced || false,
        original: data.original || null,
        replacement: data.replacement,
      });
      // Clear any previous errors
      setReviewError(null);
      console.log("[ADMIN] Regeneration successful:", {
        replaced: data.replaced,
        original: data.original?.refCode || data.original?.id,
        replacement: data.replacement?.refCode || data.replacement?.id,
      });
      // Refresh stats to show new session in counts
      fetchData();
    } catch (e: any) {
      console.error("[ADMIN] Regeneration error:", e);
      setReviewError(e?.message || String(e));
      setRegenerateResult(null);
    } finally {
      setRegenerateRunning(false);
    }
  }, [reviewRef, regenerateReplace, fetchData]);

  // Check admin access
  if (hasAdminAccess === false) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-8">TacticalEdge Admin Dashboard</h1>
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-yellow-300 mb-2">Admin Access Required</h2>
            <p className="text-yellow-200 mb-4">
              This page requires SUPER_ADMIN privileges. Your account does not have the necessary permissions to access the admin dashboard.
            </p>
            <p className="text-sm text-slate-400 mb-4">
              If you believe you should have admin access, please contact your system administrator.
            </p>
            <Link
              href="/vault"
              className="inline-block px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
            >
              Go to Vault
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-8">TacticalEdge Admin Dashboard</h1>
          <div className="animate-pulse">Loading metrics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-8">TacticalEdge Admin Dashboard</h1>
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
            <p className="text-red-300">Error: {error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); fetchData(); }}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">TacticalEdge Admin Dashboard</h1>
            <p className="text-sm text-slate-400">Monitor generation metrics and database usage</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded bg-slate-800 border-slate-600"
              />
              Auto-refresh
            </label>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-white text-sm font-medium"
            >
              Refresh
            </button>
            <Link
              href="/app"
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm font-medium"
            >
              Back to App
            </Link>
          </div>
        </div>

        {/* System Status */}
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">System Status</h2>
            {systemStatus.lastChecked && (
              <span className="text-xs text-slate-400">
                Last checked: {systemStatus.lastChecked.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={checkSystemStatus}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors"
            >
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Backend API Status */}
            <div className="flex h-full items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className={`w-3 h-3 rounded-full ${
                systemStatus.backend === "online" ? "bg-emerald-400 animate-pulse" :
                systemStatus.backend === "offline" ? "bg-red-400" :
                "bg-yellow-400 animate-pulse"
              }`}></div>
              <div className="flex-1">
                <div className="font-medium text-sm">Backend API</div>
                <div className="text-xs text-slate-400">
                  {systemStatus.backend === "online" ? "Running on port 4000" :
                   systemStatus.backend === "offline" ? "Not responding" :
                   "Checking..."}
                </div>
              </div>
              <div className={`text-xs font-semibold ${
                systemStatus.backend === "online" ? "text-emerald-400" :
                systemStatus.backend === "offline" ? "text-red-400" :
                "text-yellow-400"
              }`}>
                {systemStatus.backend === "online" ? "ONLINE" :
                 systemStatus.backend === "offline" ? "OFFLINE" :
                 "CHECKING"}
              </div>
            </div>

            {/* Database Status */}
            <div className="flex h-full items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className={`w-3 h-3 rounded-full ${
                systemStatus.database === "online" ? "bg-emerald-400 animate-pulse" :
                systemStatus.database === "offline" ? "bg-red-400" :
                "bg-yellow-400 animate-pulse"
              }`}></div>
              <div className="flex-1">
                <div className="font-medium text-sm">Database</div>
                <div className="text-xs text-slate-400">
                  {systemStatus.database === "online" ? "Connected" :
                   systemStatus.database === "offline" ? "Connection failed" :
                   "Checking..."}
                </div>
              </div>
              <div className={`text-xs font-semibold ${
                systemStatus.database === "online" ? "text-emerald-400" :
                systemStatus.database === "offline" ? "text-red-400" :
                "text-yellow-400"
              }`}>
                {systemStatus.database === "online" ? "ONLINE" :
                 systemStatus.database === "offline" ? "OFFLINE" :
                 "CHECKING"}
              </div>
            </div>
          </div>
        </div>

        {/* View JSON by Reference Code */}
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
          <h2 className="text-lg font-semibold mb-2">View JSON by Reference Code</h2>
          <p className="text-xs text-slate-400 mb-4">
            Look up a session or drill by its reference code (e.g. D-1234, S-5678, SR-ABCD) and view the full record as JSON.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={refCodeInputRef}
              type="text"
              value={refCodeJsonInput}
              onChange={(e) => setRefCodeJsonInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookupRefCodeJson(refCodeInputRef.current?.value ?? refCodeJsonInput)}
              placeholder="e.g. D-1234, S-5678"
              className="w-48 h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 placeholder:text-slate-500 uppercase"
            />
            <button
              type="button"
              onClick={() => lookupRefCodeJson(refCodeInputRef.current?.value ?? refCodeJsonInput)}
              disabled={refCodeJsonLoading}
              className="px-4 py-2 h-9 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50"
            >
              {refCodeJsonLoading ? "Looking up…" : "Look up"}
            </button>
          </div>
          {refCodeJsonHistory.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-slate-500 mb-1.5">Last 5 inquiries:</p>
              <div className="flex flex-wrap gap-2">
                {refCodeJsonHistory
                  .filter((h) => {
                    const s = String(h.refCode ?? "").trim();
                    return s && !/^\[object\s+object\]$/i.test(s);
                  })
                  .map((h, i) => (
                  <button
                    key={`${h.refCode}-${i}`}
                    type="button"
                    onClick={() => lookupRefCodeByCode(h.refCode)}
                    className="px-2.5 py-1 rounded-md text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-600/50 transition-colors"
                  >
                    {h.refCode}
                    <span className="ml-1.5 text-slate-500 font-sans">{h.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {refCodeJsonError && (
            <div className="mt-3 rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300">
              {refCodeJsonError}
            </div>
          )}
          {refCodeJsonResult && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400">Type:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 font-medium">
                    {refCodeJsonResult.type}
                  </span>
                  <span className="text-slate-400">Ref:</span>
                  <span className="font-mono text-emerald-400">{refCodeJsonResult.refCode}</span>
                </div>
                <button
                  type="button"
                  onClick={copyRefCodeJson}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                >
                  {refCodeJsonCopied ? "Copied!" : "Copy JSON"}
                </button>
              </div>
              <pre className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-300 overflow-auto max-h-[480px] whitespace-pre-wrap break-words">
                {JSON.stringify(refCodeJsonResult.data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Bulk Generate Random Sessions */}
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Bulk Generate Random Sessions</h2>
              <p className="text-xs text-slate-400">
                Generates sessions for a specific age group and auto-saves them to the Vault.
              </p>
            </div>
            <Link
              href="/vault"
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              View Vault →
            </Link>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400 uppercase tracking-wide">Generate</span>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-1 inline-flex">
              <button
                type="button"
                onClick={() => setBulkMode("session")}
                disabled={bulkRunning}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  bulkMode === "session"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Sessions
              </button>
              <button
                type="button"
                onClick={() => setBulkMode("series")}
                disabled={bulkRunning}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  bulkMode === "series"
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Series
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_240px] gap-4 items-end">
            <div>
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide mb-1">Age Group</label>
              <select
                value={bulkAgeGroup}
                onChange={(e) => setBulkAgeGroup(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200"
                disabled={bulkRunning}
              >
                {VAULT_AGE_GROUPS.map((ag) => (
                  <option key={ag} value={ag}>{ag}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide mb-1">
                {bulkMode === "series" ? "How many series?" : "How many sessions?"}
              </label>
              <input
                type="number"
                min={1}
                max={bulkMaxCount}
                value={bulkCount}
                onChange={(e) => setBulkCount(Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200"
                disabled={bulkRunning}
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide mb-1">
                Sessions per series
              </label>
              <input
                type="number"
                min={2}
                max={10}
                value={bulkSessionsPerSeries}
                onChange={(e) => setBulkSessionsPerSeries(Number(e.target.value))}
                className={`w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200 ${
                  bulkMode !== "series" ? "opacity-50" : ""
                }`}
                disabled={bulkRunning || bulkMode !== "series"}
              />
            </div>

            <div>
              <button
                onClick={startBulkRandomSessions}
                disabled={
                  bulkRunning ||
                  bulkCount < 1 ||
                  bulkCount > bulkMaxCount ||
                  (bulkMode === "series" && (bulkSessionsPerSeries < 2 || bulkSessionsPerSeries > 10))
                }
                className={`w-full h-9 px-4 rounded-lg text-sm font-semibold transition-colors ${
                  bulkRunning
                    ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {bulkRunning ? "Generating..." : "Start"}
              </button>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">
            {bulkMode === "series" ? "Max 10 series per run (each series is 2–10 sessions)" : "Max 25 sessions per run"}
          </div>

          {bulkJobError && (
            <div className="mt-3 rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300">
              {bulkJobError}
            </div>
          )}

          {(bulkRunning || bulkJob) && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <div className="font-medium">
                  {(bulkJob?.status ? bulkJob.status.toUpperCase() : "RUNNING")} •{" "}
                  {(bulkJob?.completed ?? 0)}/{(bulkJob?.total ?? bulkCount)} {bulkJob?.mode === "series" ? "series" : "sessions"}
                </div>
                {bulkJobId && (
                  <div className="text-slate-500 font-mono truncate max-w-[240px]">
                    Job: {bulkJobId}
                  </div>
                )}
              </div>

              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700/60">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((bulkJob?.completed ?? 0) / Math.max(1, (bulkJob?.total ?? bulkCount))) * 100
                      )
                    )}%`,
                  }}
                />
              </div>

              {bulkJob && (
                <div className="text-xs text-slate-400 flex gap-3">
                  <span className="text-emerald-400">Success: {bulkJob.succeeded}</span>
                  <span className="text-red-400">Failed: {bulkJob.failed}</span>
                </div>
              )}

              {bulkJob?.results?.length ? (
                <div className="mt-2">
                  <div className="text-xs font-semibold text-slate-300 mb-1">Latest created</div>
                  <div className="space-y-1">
                    {bulkJob.results.slice(-5).reverse().map((s) => (
                      s.kind === "series" ? (
                        <div key={s.seriesId} className="flex items-center gap-2 text-xs text-slate-300">
                          <span className="text-cyan-300 font-semibold">SERIES</span>
                          <span className="text-slate-500 font-mono">{s.seriesId}</span>
                          <span className="text-slate-400 truncate">
                            {s.title || "Series"} {s.firstRefCode ? `• ${s.firstRefCode}` : ""} • {s.totalSessions} sessions
                          </span>
                        </div>
                      ) : (
                        <div key={s.id} className="flex items-center gap-2 text-xs text-slate-300">
                          <span className="text-emerald-300 font-semibold">SESSION</span>
                          <span className="text-slate-500 font-mono">{s.refCode || s.id}</span>
                          <span className="text-slate-400 truncate">{s.title || "Session"}</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              ) : null}

              {bulkJob?.errors?.length ? (
                <details className="mt-2 rounded-lg border border-slate-700/70 bg-slate-950/40 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                    Errors ({bulkJob.errors.length})
                  </summary>
                  <div className="mt-2 space-y-1 text-xs text-red-300">
                    {bulkJob.errors.slice(-10).map((er, idx) => (
                      <div key={`${er.index}-${idx}`} className="opacity-90">
                        #{er.index}: {er.message}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          )}
        </div>

        {/* Review Session & Drill (QA) - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Review Session (QA + optional regen) */}
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Review Session</h2>
              <p className="text-xs text-slate-400">
                Runs QA on a specific session. Use "Regenerate Session" to create a replacement with new QA scores.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_240px_240px] gap-4 items-end">
            <div>
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide mb-1">
                Session ID or Ref Code
              </label>
              <input
                value={reviewRef}
                onChange={(e) => setReviewRef(e.target.value)}
                placeholder="e.g., S-9M3P or 3b2a... (uuid)"
                className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200"
                disabled={reviewRunning || regenerateRunning}
              />
            </div>

            <div>
              <button
                onClick={runSessionReview}
                disabled={reviewRunning || regenerateRunning}
                className={`w-full h-9 px-4 rounded-lg text-sm font-semibold transition-colors ${
                  reviewRunning
                    ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white"
                }`}
              >
                {reviewRunning ? "Reviewing..." : "Run QA Review"}
              </button>
            </div>

            <div>
              {reviewResult?.session?.id ? (
                <Link
                  href={`/demo/session?sessionId=${encodeURIComponent(reviewResult.session.id)}`}
                  className="w-full inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                >
                  View Session →
                </Link>
              ) : (
                <div className="h-9" />
              )}
            </div>
          </div>

          {reviewError && (
            <div className="mt-3 rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300">
              {reviewError}
            </div>
          )}

          {regenerateResult && (
            <div className="mt-3 rounded-lg border border-emerald-700/50 bg-emerald-900/20 p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">✓</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-emerald-300 mb-2">
                    {regenerateResult.replaced 
                      ? "Session Successfully Replaced" 
                      : "Replacement Session Generated"}
                  </div>
                  <div className="text-xs text-emerald-200/80 space-y-1">
                    {regenerateResult.replaced && regenerateResult.original ? (
                      <div>
                        <span className="text-slate-400">Replaced </span>
                        <span className="font-mono font-semibold text-emerald-300">
                          {regenerateResult.original.refCode || regenerateResult.original.id}
                        </span>
                        <span className="text-slate-400"> with </span>
                        <span className="font-mono font-semibold text-emerald-300">
                          {regenerateResult.replacement.refCode || regenerateResult.replacement.id}
                        </span>
                      </div>
                    ) : regenerateResult.original ? (
                      <div>
                        <span className="text-slate-400">Original: </span>
                        <span className="font-mono text-emerald-300">
                          {regenerateResult.original.refCode || regenerateResult.original.id}
                        </span>
                        <span className="text-slate-400"> → Replacement: </span>
                        <span className="font-mono text-emerald-300">
                          {regenerateResult.replacement.refCode || regenerateResult.replacement.id}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-slate-400">New session: </span>
                        <span className="font-mono font-semibold text-emerald-300">
                          {regenerateResult.replacement.refCode || regenerateResult.replacement.id}
                        </span>
                      </div>
                    )}
                    {regenerateResult.replacement.title && (
                      <div className="text-slate-300 mt-1">
                        {regenerateResult.replacement.title}
                      </div>
                    )}
                    {typeof regenerateResult.replacement.qaScore === "number" && (
                      <div className="mt-1">
                        <span className="text-slate-400">QA Score: </span>
                        <span className={regenerateResult.replacement.approved ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                          {regenerateResult.replacement.qaScore.toFixed(2)} ({regenerateResult.replacement.approved ? "PASS" : "FAIL"})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {reviewResult && (
            <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-950/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-200 font-semibold">{reviewResult.session.title}</span>
                {reviewResult.session.refCode && (
                  <span className="px-2 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-[11px] font-mono border border-cyan-700/30">
                    {reviewResult.session.refCode}
                  </span>
                )}
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">{reviewResult.session.ageGroup}</span>
                <span className="text-slate-500">•</span>
                <span className={reviewResult.qa.pass ? "text-emerald-400" : "text-red-400"}>
                  {reviewResult.qa.pass ? "PASS" : "FAIL"}
                </span>
                {typeof reviewResult.qa.avgScore === "number" && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-300">Avg: {reviewResult.qa.avgScore.toFixed(2)}</span>
                  </>
                )}
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">
                  Decision: <span className="font-semibold">{reviewResult.fixDecision.code}</span>
                </span>
              </div>

              {reviewResult.qa.summary && (
                <div className="text-xs text-slate-300">
                  <span className="text-slate-400">Summary: </span>
                  {reviewResult.qa.summary}
                </div>
              )}

              <details className="rounded-lg border border-slate-700/70 bg-slate-950/40 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                  QA Scores
                </summary>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {Object.entries(reviewResult.qa.scores || {}).map(([k, v]) => (
                    <div key={k} className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700/60">
                      <div className="text-slate-400 capitalize">{k}</div>
                      <div className="text-slate-200 font-semibold">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  {reviewResult.fixDecision.reason}
                </div>
              </details>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
                <div className="flex items-center gap-2">
                  <input
                    id="regenerateReplace"
                    type="checkbox"
                    checked={regenerateReplace}
                    onChange={(e) => setRegenerateReplace(e.target.checked)}
                    disabled={regenerateRunning || !reviewResult}
                    className="rounded bg-slate-800 border-slate-600"
                  />
                  <label htmlFor="regenerateReplace" className="text-xs text-slate-400 cursor-pointer">
                    Replace session (delete old)
                  </label>
                </div>
                <button
                  onClick={runSessionRegenerate}
                  disabled={regenerateRunning || !reviewResult || !!regenerateResult}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    regenerateRunning || regenerateResult
                      ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  {regenerateRunning ? "Regenerating..." : regenerateResult ? "Regeneration Complete" : "Regenerate Session"}
                </button>
                {regenerateResult && (
                  <button
                    onClick={async () => {
                      setLoadingSession(true);
                      try {
                        // Fetch session by ID from vault API
                        const res = await fetch(`/api/vault/sessions/${encodeURIComponent(regenerateResult.replacement.id)}`);
                        const data = await res.json();
                        if (res.ok && data && !data.error) {
                          setViewingSession(data);
                          // Check if session is favorited
                          checkSessionFavoriteStatus(data.id).catch(() => {});
                        } else {
                          alert(data?.error || "Session not found");
                        }
                      } catch (e: any) {
                        alert("Error loading session: " + e.message);
                      } finally {
                        setLoadingSession(false);
                      }
                    }}
                    disabled={loadingSession}
                    className="px-4 py-2 rounded-lg text-sm font-semibold border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    {loadingSession ? "Loading..." : `View ${regenerateResult.replaced ? "New" : "Replacement"} Session`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Review Drill</h2>
              <p className="text-xs text-slate-400">
                Runs QA on a specific drill. Reviews standalone drills not contained in sessions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_240px_240px] gap-4 items-end">
            <div>
              <label className="block text-[11px] text-slate-400 uppercase tracking-wide mb-1">
                Drill ID or Ref Code
              </label>
              <input
                value={reviewDrillRef}
                onChange={(e) => setReviewDrillRef(e.target.value)}
                placeholder="e.g., D-9M3P or 3b2a... (uuid)"
                className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200"
                disabled={reviewDrillRunning || regenerateDrillRunning}
              />
            </div>

            <div>
              <button
                onClick={runDrillReview}
                disabled={reviewDrillRunning}
                className={`w-full h-9 px-4 rounded-lg text-sm font-semibold transition-colors ${
                  reviewDrillRunning
                    ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white"
                }`}
              >
                {reviewDrillRunning ? "Reviewing..." : "Run QA Review"}
              </button>
            </div>

            <div>
              {/* Empty column to match Review Session layout */}
              <div className="h-9" />
            </div>
          </div>

          {reviewDrillError && (
            <div className="mt-3 rounded-lg border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300">
              {reviewDrillError}
            </div>
          )}

          {reviewDrillResult && (
            <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-950/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-200 font-semibold">{reviewDrillResult.drill.title}</span>
                {reviewDrillResult.drill.refCode && (
                  <span className="px-2 py-0.5 rounded bg-cyan-900/40 text-cyan-300 text-[11px] font-mono border border-cyan-700/30">
                    {reviewDrillResult.drill.refCode}
                  </span>
                )}
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">{reviewDrillResult.drill.ageGroup}</span>
                <span className="text-slate-500">•</span>
                <span className={reviewDrillResult.qa.pass ? "text-emerald-400" : "text-red-400"}>
                  {reviewDrillResult.qa.pass ? "PASS" : "FAIL"}
                </span>
                {typeof reviewDrillResult.qa.avgScore === "number" && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-300">Avg: {reviewDrillResult.qa.avgScore.toFixed(2)}</span>
                  </>
                )}
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">
                  Decision: <span className="font-semibold">{reviewDrillResult.fixDecision.code}</span>
                </span>
              </div>

              {reviewDrillResult.qa.summary && (
                <div className="text-xs text-slate-300">
                  <span className="text-slate-400">Summary: </span>
                  {reviewDrillResult.qa.summary}
                </div>
              )}

              {Object.keys(reviewDrillResult.qa.scores || {}).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(reviewDrillResult.qa.scores || {}).map(([k, v]) => (
                    <div key={k} className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700/60">
                      <div className="text-slate-400 capitalize">{k}</div>
                      <div className="text-slate-200 font-semibold">{v}</div>
                    </div>
                  ))}
                </div>
              )}

              {reviewDrillResult.fixDecision.reason && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-slate-400 hover:text-slate-300">
                    Decision Reason
                  </summary>
                  <div className="mt-2 text-slate-300">
                    {reviewDrillResult.fixDecision.reason}
                  </div>
                </details>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
                <div className="flex items-center gap-2">
                  <input
                    id="regenerateDrillReplace"
                    type="checkbox"
                    checked={regenerateDrillReplace}
                    onChange={(e) => setRegenerateDrillReplace(e.target.checked)}
                    disabled={regenerateDrillRunning || !reviewDrillResult}
                    className="rounded bg-slate-800 border-slate-600"
                  />
                  <label htmlFor="regenerateDrillReplace" className="text-xs text-slate-400 cursor-pointer">
                    Replace drill (delete old)
                  </label>
                </div>
                <button
                  onClick={runDrillRegenerate}
                  disabled={regenerateDrillRunning || !reviewDrillResult || !!regenerateDrillResult}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    regenerateDrillRunning || regenerateDrillResult
                      ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                      : "bg-cyan-600 hover:bg-cyan-500 text-white"
                  }`}
                >
                  {regenerateDrillRunning ? "Regenerating..." : regenerateDrillResult ? "Regeneration Complete" : "Regenerate Drill"}
                </button>
                {regenerateDrillResult && (
                  <button
                    onClick={async () => {
                      setLoadingDrill(true);
                      try {
                        const drillId = regenerateDrillResult.replacement.id;
                        const drillRefCode = regenerateDrillResult.replacement.refCode;
                        
                        // Try admin endpoint first (by ID or refCode)
                        const identifier = drillId || drillRefCode;
                        if (!identifier) {
                          alert("No drill identifier available");
                          return;
                        }
                        
                        const res = await fetch(`${API_BASE_URL}/admin/drills/${encodeURIComponent(identifier)}`, {
                          headers: {
                            ...getAuthHeaders(),
                          },
                        });
                        
                        const data = await res.json();
                        if (res.ok && data && data.ok && data.drill) {
                          setViewingDrill(data.drill);
                        } else {
                          // Fallback to vault lookup if admin endpoint fails
                          if (drillRefCode) {
                            const lookupRes = await fetch(`${API_BASE_URL}/vault/lookup/${encodeURIComponent(drillRefCode)}`);
                            const lookupData = await lookupRes.json();
                            if (lookupRes.ok && lookupData && lookupData.ok && lookupData.data) {
                              setViewingDrill(lookupData.data);
                            } else {
                              alert(lookupData?.error || data?.error || "Drill not found");
                            }
                          } else {
                            alert(data?.error || "Drill not found");
                          }
                        }
                      } catch (e: any) {
                        console.error("Error loading drill:", e);
                        alert("Error loading drill: " + e.message);
                      } finally {
                        setLoadingDrill(false);
                      }
                    }}
                    disabled={loadingDrill}
                    className="px-4 py-2 rounded-lg text-sm font-semibold border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
                  >
                    {loadingDrill ? "Loading..." : `View ${regenerateDrillResult.replaced ? "New" : "Replacement"} Drill`}
                  </button>
                )}
              </div>
            </div>
          )}

          {regenerateDrillResult && (
            <div className="mt-3 rounded-lg border border-cyan-700/50 bg-cyan-900/20 p-4">
              <div className="flex items-start gap-3">
                <div className="text-cyan-400 text-xl">✓</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-cyan-300 mb-2">
                    {regenerateDrillResult.replaced 
                      ? "Drill Successfully Replaced" 
                      : "Replacement Drill Generated"}
                  </div>
                  <div className="text-xs text-cyan-200/80 space-y-1">
                    {regenerateDrillResult.replaced && regenerateDrillResult.original ? (
                      <div>
                        <span className="text-slate-400">Replaced </span>
                        <span className="font-mono font-semibold text-cyan-300">
                          {regenerateDrillResult.original.refCode || regenerateDrillResult.original.id}
                        </span>
                        <span className="text-slate-400"> with </span>
                        <span className="font-mono font-semibold text-cyan-300">
                          {regenerateDrillResult.replacement.refCode || regenerateDrillResult.replacement.id}
                        </span>
                      </div>
                    ) : regenerateDrillResult.original ? (
                      <div>
                        <span className="text-slate-400">Original: </span>
                        <span className="font-mono text-cyan-300">
                          {regenerateDrillResult.original.refCode || regenerateDrillResult.original.id}
                        </span>
                        <span className="text-slate-400"> → Replacement: </span>
                        <span className="font-mono text-cyan-300">
                          {regenerateDrillResult.replacement.refCode || regenerateDrillResult.replacement.id}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-slate-400">New drill: </span>
                        <span className="font-mono font-semibold text-cyan-300">
                          {regenerateDrillResult.replacement.refCode || regenerateDrillResult.replacement.id}
                        </span>
                      </div>
                    )}
                    {regenerateDrillResult.replacement.title && (
                      <div className="text-slate-300 mt-1">
                        {regenerateDrillResult.replacement.title}
                      </div>
                    )}
                    {typeof regenerateDrillResult.replacement.qaScore === "number" && (
                      <div className="mt-1">
                        <span className="text-slate-400">QA Score: </span>
                        <span className={regenerateDrillResult.replacement.approved ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                          {regenerateDrillResult.replacement.qaScore.toFixed(2)} ({regenerateDrillResult.replacement.approved ? "PASS" : "FAIL"})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-fr items-stretch">
          {/* Sessions Card - Split */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4 h-full flex flex-col">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3 min-h-[32px] flex items-center">Sessions</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500">Generated</div>
                <div className="text-xl font-bold text-slate-300">
                  {formatNumber(stats?.database.totalSessions || 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">In Vault</div>
                <div className="text-xl font-bold text-emerald-400">
                  {formatNumber(stats?.database.vaultSessions || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Drills Card - Split */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4 h-full flex flex-col">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3 min-h-[32px] flex items-center">Drills (in Sessions)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500">In Vault</div>
                <div className="text-xl font-bold text-cyan-400">
                  {formatNumber(stats?.database.sessionDrillsCount || 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Standalone</div>
                <div className="text-xl font-bold text-slate-300">
                  {formatNumber(stats?.database.totalDrills || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Series Card */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4 h-full flex flex-col">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3 min-h-[32px] flex items-center">Series</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-xl font-bold text-blue-400">
                  {formatNumber(stats?.database.totalSeries || 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Sessions</div>
                <div className="text-xl font-bold text-slate-300">
                  {formatNumber(stats?.database.seriesSessions || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* API Stats Card */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4 h-full flex flex-col">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3 min-h-[32px] flex items-center">API</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500">Calls</div>
                <div className="text-xl font-bold text-purple-400">
                  {formatNumber(stats?.api.totalCalls || 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Avg Time</div>
                <div className="text-xl font-bold text-amber-400">
                  {stats?.performance.avgDurationSec}s
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Drill Diagram Normalization */}
        <div className="mt-6 bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Drill Diagram Normalization</div>
              <div className="mt-2 text-sm text-slate-300">
                {normalizeStatus ? (
                  <>
                    <span className="text-slate-400">Needs normalization: </span>
                    <span className="font-semibold text-amber-300">{formatNumber(normalizeStatus.needsNormalization)}</span>
                    <span className="text-slate-500"> / {formatNumber(normalizeStatus.total)}</span>
                    {typeof normalizeStatus.missingCore === "number" && (
                      <span className="text-slate-500"> · Missing core: {formatNumber(normalizeStatus.missingCore)}</span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-500">Status unavailable</span>
                )}
              </div>
              {normalizeStatusError && (
                <div className="mt-1 text-xs text-red-400">{normalizeStatusError}</div>
              )}
              {normalizeStatus?.job && (
                <div className="mt-1 text-xs text-slate-400">
                  {normalizeStatus.job.running ? (
                    <>Processing: {formatNumber(normalizeStatus.job.updated)} updated / {formatNumber(normalizeStatus.job.processed)} scanned</>
                  ) : normalizeStatus.job.finishedAt ? (
                    <>Last run: {formatNumber(normalizeStatus.job.updated)} updated / {formatNumber(normalizeStatus.job.processed)} scanned</>
                  ) : (
                    <>No recent runs</>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={500}
                value={normalizeBatchSize}
                onChange={(e) => setNormalizeBatchSize(Number(e.target.value || 1))}
                className="w-24 rounded-md border border-slate-700/70 bg-slate-950/60 px-2 py-1 text-sm text-slate-200"
              />
              <button
                onClick={refreshNormalizeStatus}
                className="rounded-md border border-slate-600/60 bg-slate-800/40 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800/70"
              >
                Refresh
              </button>
              <button
                onClick={runDrillNormalizeBatch}
                disabled={normalizeRunning}
                className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {normalizeRunning ? "Normalizing..." : "Normalize Batch"}
              </button>
            </div>
          </div>
          {normalizeRunning && (
            <div className="mt-2 text-xs text-slate-400">Processing batch… check API logs for progress.</div>
          )}
          {normalizeError && (
            <div className="mt-2 text-xs text-red-400">{normalizeError}</div>
          )}
          {normalizeResult && (
            <div className="mt-2 text-xs text-slate-400">
              Updated {normalizeResult.updatedCount} of {normalizeResult.processed} scanned
              {typeof normalizeResult.skippedMissingCore === "number" ? ` · Skipped core-missing: ${normalizeResult.skippedMissingCore}` : ""}.
            </div>
          )}
        </div>

        {/* Drill Diagram Re-enrichment (LLM) */}
        <div className="mt-4 bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Re-enrich Diagrams (LLM)</div>
              <div className="mt-2 text-sm text-slate-300">
                Uses LLM to rebuild arrows/annotations/safeZones per drill content. Costs tokens.
              </div>
              {typeof normalizeStatus?.needsReenrich === "number" && typeof normalizeStatus?.total === "number" && (
                <div className="mt-1 text-xs text-slate-400">
                  Needs re-enrich: {formatNumber(normalizeStatus.needsReenrich)} / {formatNumber(normalizeStatus.total)} ·
                  Done: {formatNumber(Math.max(0, normalizeStatus.total - normalizeStatus.needsReenrich))}
                </div>
              )}
              {normalizeStatus?.reenrichJob && (
                <div className="mt-1 text-xs text-slate-400">
                  {normalizeStatus.reenrichJob.running ? (
                    <>Processing: {formatNumber(normalizeStatus.reenrichJob.updated)} updated / {formatNumber(normalizeStatus.reenrichJob.processed)} scanned</>
                  ) : normalizeStatus.reenrichJob.finishedAt ? (
                    <>Last run: {formatNumber(normalizeStatus.reenrichJob.updated)} updated / {formatNumber(normalizeStatus.reenrichJob.processed)} scanned</>
                  ) : (
                    <>No recent runs</>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  id="reenrichIncludeSessions"
                  type="checkbox"
                  checked={reenrichIncludeSessions}
                  onChange={(e) => setReenrichIncludeSessions(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600"
                />
                <label htmlFor="reenrichIncludeSessions">Update sessions</label>
              </div>
              <input
                type="number"
                min={1}
                max={200}
                value={reenrichBatchSize}
                onChange={(e) => setReenrichBatchSize(Number(e.target.value || 1))}
                className="w-24 rounded-md border border-slate-700/70 bg-slate-950/60 px-2 py-1 text-sm text-slate-200"
              />
              <button
                onClick={runDrillReenrichBatch}
                disabled={reenrichRunning}
                className="rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
              >
                {reenrichRunning ? "Re-enriching..." : "Re-enrich Batch"}
              </button>
            </div>
          </div>
          {reenrichRunning && (
            <div className="mt-2 text-xs text-slate-400">Processing batch… check API logs for progress.</div>
          )}
          {reenrichError && (
            <div className="mt-2 text-xs text-red-400">{reenrichError}</div>
          )}
          {reenrichResult && (
            <div className="mt-2 text-xs text-slate-400">
              Updated {reenrichResult.updatedCount} of {reenrichResult.processed} drills.
              {typeof reenrichResult.sessionsUpdated === "number" && (
                <span className="text-slate-500"> · Sessions updated: {formatNumber(reenrichResult.sessionsUpdated)}</span>
              )}
            </div>
          )}
          {Array.isArray(reenrichResult?.sessions) && reenrichResult.sessions.length > 0 && (
            <div className="mt-2 text-xs text-slate-300">
              <div className="text-[11px] text-slate-500 mb-1">Sessions updated (sample):</div>
              <div className="flex flex-wrap gap-2">
                {reenrichResult.sessions.slice(0, 8).map((id: string) => (
                  <div key={id} className="flex items-center gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(id)}
                      className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700/60 text-slate-200 hover:bg-slate-800"
                      title="Click to copy id"
                    >
                      {id.slice(0, 8)}…
                    </button>
                    <a
                      href={`/demo/session?sessionId=${encodeURIComponent(id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-amber-300 hover:text-amber-200 underline"
                      title="Open session view"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
              {reenrichResult.sessions.length > 8 && (
                <div className="mt-1 text-[11px] text-slate-500">
                  +{reenrichResult.sessions.length - 8} more in this batch
                </div>
              )}
            </div>
          )}
          {Array.isArray(reenrichResult?.updated) && reenrichResult.updated.length > 0 && (
            <div className="mt-2 text-xs text-slate-300">
              <div className="text-[11px] text-slate-500 mb-1">Recently updated drills:</div>
              <div className="flex flex-wrap gap-2">
                {reenrichResult.updated.slice(0, 25).map((d: any) => {
                  const ref = d?.refCode || d?.id;
                  return (
                    <div key={ref} className="flex items-center gap-2">
                      <button
                        onClick={() => ref && navigator.clipboard.writeText(ref)}
                        className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700/60 text-slate-200 hover:bg-slate-800"
                        title="Click to copy ref"
                      >
                        {ref}
                      </button>
                      {ref && (
                        <a
                          href={`${API_BASE_URL}/vault/lookup/${ref}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-amber-300 hover:text-amber-200 underline"
                          title="Open JSON in new tab"
                        >
                          View JSON
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
              {reenrichResult.updated.length > 25 && (
                <div className="mt-1 text-[11px] text-slate-500">
                  +{reenrichResult.updated.length - 25} more in this batch
                </div>
              )}
            </div>
          )}
          {normalizeStatus?.reenrichJob?.running && normalizeStatus.reenrichJob.target > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Progress</span>
                <span>
                  {formatNumber(Math.min(normalizeStatus.reenrichJob.updated, normalizeStatus.reenrichJob.target))} / {formatNumber(normalizeStatus.reenrichJob.target)}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800/70 overflow-hidden">
                <div
                  className="h-full bg-amber-400/80"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        (normalizeStatus.reenrichJob.updated / normalizeStatus.reenrichJob.target) * 100
                      )
                    )}%`,
                    transition: "width 200ms ease",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Re-enrich by Session ID */}
        <div className="mt-4 bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide">Re-enrich by Session ID</div>
          <div className="mt-2 text-sm text-slate-300">
            Enter a session ID (UUID) or ref code (S-XXXX) to re-enrich all drill diagrams inside that session.
          </div>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="text"
              value={reenrichSessionId}
              onChange={(e) => setReenrichSessionId(e.target.value)}
              placeholder="Session ID or S-XXXX"
              className="w-80 max-w-full rounded-md border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
            />
            <button
              onClick={runSessionReenrich}
              disabled={reenrichSessionRunning}
              className="rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
            >
              {reenrichSessionRunning ? "Re-enriching..." : "Re-enrich Session"}
            </button>
          </div>
          {reenrichSessionError && (
            <div className="mt-2 text-xs text-red-400">{reenrichSessionError}</div>
          )}
          {reenrichSessionResult && (
            <div className="mt-2 text-xs text-slate-400">
              Updated {reenrichSessionResult.updatedCount} drills in session {reenrichSessionResult.sessionId}.
            </div>
          )}
          {Array.isArray(reenrichSessionResult?.updatedDrills) && reenrichSessionResult.updatedDrills.length > 0 && (
            <div className="mt-2 text-xs text-slate-300">
              <div className="text-[11px] text-slate-500 mb-1">Updated drills:</div>
              <div className="flex flex-wrap gap-2">
                {reenrichSessionResult.updatedDrills.slice(0, 12).map((d: any, idx: number) => (
                  <div key={`${d?.refCode || idx}`} className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700/60 text-slate-200">
                      {d?.refCode || d?.title || "Drill"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Delete session by ID/ref */}
        <div className="mt-4 bg-slate-900/70 border border-red-700/40 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide">Delete Session (Super Admin)</div>
          <div className="mt-2 text-sm text-slate-300">
            Permanently deletes a session by UUID or ref code (S-XXXX), plus linked favorites, calendar events, and SESSION player plans.
          </div>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="text"
              value={deleteSessionRef}
              onChange={(e) => setDeleteSessionRef(e.target.value)}
              placeholder="Session ID or S-XXXX"
              className="w-80 max-w-full rounded-md border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
            />
            <button
              onClick={runDeleteSession}
              disabled={deleteSessionRunning}
              className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              {deleteSessionRunning ? "Deleting..." : "Delete Session"}
            </button>
          </div>
          {deleteSessionError && (
            <div className="mt-2 text-xs text-red-400">{deleteSessionError}</div>
          )}
          {deleteSessionResult?.ok && (
            <div className="mt-2 text-xs text-slate-300">
              Deleted {deleteSessionResult?.deleted?.refCode || deleteSessionResult?.deleted?.id}. Favorites:{" "}
              {deleteSessionResult?.favoritesDeleted ?? 0}, Calendar: {deleteSessionResult?.calendarEventsDeleted ?? 0}, Player Plans:{" "}
              {deleteSessionResult?.playerPlansDeleted ?? 0}
            </div>
          )}
        </div>

        {/* Strip generic overlays */}
        <div className="mt-4 bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide">Strip Generic Overlays</div>
          <div className="mt-2 text-sm text-slate-300">
            Removes default annotations/arrows/safeZones inserted by legacy normalizers.
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <input
                id="stripIncludeSessions"
                type="checkbox"
                checked={stripIncludeSessions}
                onChange={(e) => setStripIncludeSessions(e.target.checked)}
                className="rounded bg-slate-800 border-slate-600"
              />
              <label htmlFor="stripIncludeSessions">Update sessions</label>
            </div>
            <input
              type="number"
              min={1}
              max={500}
              value={stripBatchSize}
              onChange={(e) => setStripBatchSize(Number(e.target.value || 1))}
              className="w-24 rounded-md border border-slate-700/70 bg-slate-950/60 px-2 py-1 text-sm text-slate-200"
            />
            <button
              onClick={runStripGenericOverlays}
              disabled={stripRunning}
              className="rounded-md border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
            >
              {stripRunning ? "Stripping..." : "Strip Batch"}
            </button>
          </div>
          {stripError && (
            <div className="mt-2 text-xs text-red-400">{stripError}</div>
          )}
          {stripResult && (
            <div className="mt-2 text-xs text-slate-400">
              Stripped {stripResult.updatedCount} of {stripResult.processed} drills.
            </div>
          )}
        </div>

        {/* Users & Access Breakdown - Combined Section */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Users Overview Card - Spans 2 columns */}
          <div className="lg:col-span-2 bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3 min-h-[32px] flex items-center">
              Users
            </div>
            {userSummary ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-slate-400">Total</span>
                  <span className="text-lg font-bold text-slate-100">
                    {formatNumber(userSummary.totalUsers || 0)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase mb-2">Roles</div>
                    <div className="space-y-1.5">
                      {["FREE", "COACH", "CLUB", "TRIAL"].map((role) => (
                        <div key={role} className="flex items-center justify-between">
                          <span className="text-slate-400">{role}</span>
                          <span className="text-slate-100 font-medium">
                            {formatNumber(userSummary.byRole?.[role] || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase mb-2">Admins</div>
                    <div className="space-y-1.5">
                      {["SUPER_ADMIN", "ADMIN", "MODERATOR", "SUPPORT"].map((role) => (
                        <div key={role} className="flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">{role}</span>
                          <span className="text-slate-100 font-medium">
                            {formatNumber(userSummary.byAdminRole?.[role] || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">User stats unavailable</div>
            )}
          </div>

          {/* Access Levels Breakdown - Combined with Users section */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-xs text-slate-400 uppercase tracking-wide mb-3 min-h-[32px] flex items-center">Access Levels</h2>
            {userSummary ? (
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Free</span>
                  <span className="font-semibold">
                    {formatNumber(userSummary.byRole?.FREE || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Coach</span>
                  <span className="font-semibold">
                    {formatNumber(userSummary.byRole?.COACH || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Club</span>
                  <span className="font-semibold">
                    {formatNumber(userSummary.byRole?.CLUB || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Trial</span>
                  <span className="font-semibold">
                    {formatNumber(userSummary.byRole?.TRIAL || 0)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">No user data available.</div>
            )}
          </div>

          {/* Subscriptions Card */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-xs text-slate-400 uppercase tracking-wide mb-3 min-h-[32px] flex items-center">Subscriptions</h2>
            {userSummary ? (
              <div className="space-y-2 text-xs text-slate-300">
                {Object.entries(userSummary.bySubscriptionPlan || {}).map(([plan, count]) => (
                  <div key={plan} className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">{plan}</span>
                    <span className="font-semibold">
                      {formatNumber(count || 0)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">No subscription data available.</div>
            )}
          </div>
        </div>

        {/* Admin Roles - Separate row */}
        <div className="mt-6">
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-xs text-slate-400 uppercase tracking-wide mb-3 min-h-[32px] flex items-center">Admin Roles</h2>
            {userSummary ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-300">
                {["SUPER_ADMIN", "ADMIN", "MODERATOR", "SUPPORT"].map((role) => (
                  <div key={role} className="flex items-center justify-between">
                    <span className="text-slate-400">{role}</span>
                    <span className="font-semibold">
                      {formatNumber(userSummary.byAdminRole?.[role] || 0)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">No admin data available.</div>
            )}
          </div>
        </div>

        {/* Usage Analytics by Plan */}
        {usageByPlan && (
          <div className="mt-6 bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-xs text-slate-400 uppercase tracking-wide mb-4">Usage Analytics by Plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(usageByPlan).map(([plan, data]: [string, any]) => (
                <div key={plan} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-sm font-semibold text-slate-200 mb-2">{plan}</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Users</span>
                      <span className="text-slate-200">{data.totalUsers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Sessions Used</span>
                      <span className="text-slate-200">{data.totalSessionsUsed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Drills Used</span>
                      <span className="text-slate-200">{data.totalDrillsUsed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg Sessions/User</span>
                      <span className="text-slate-200">{data.avgSessionsPerUser.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg Drills/User</span>
                      <span className="text-slate-200">{data.avgDrillsPerUser.toFixed(1)}</span>
                    </div>
                    {data.usersAtLimit > 0 && (
                      <div className="flex justify-between text-red-400">
                        <span>At Limit</span>
                        <span>{data.usersAtLimit}</span>
                      </div>
                    )}
                    {data.usersApproachingLimit > 0 && (
                      <div className="flex justify-between text-yellow-400">
                        <span>Approaching (80%+)</span>
                        <span>{data.usersApproachingLimit}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vault Usage Analytics */}
        {vaultUsage && (
          <div className="mt-6 bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-xs text-slate-400 uppercase tracking-wide mb-4">Vault Usage by Plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(vaultUsage).map(([plan, data]: [string, any]) => (
                <div key={plan} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-sm font-semibold text-slate-200 mb-2">{plan}</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Sessions</span>
                      <span className="text-slate-200">{data.totalVaultSessions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Drills</span>
                      <span className="text-slate-200">{data.totalVaultDrills}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg Sessions/User</span>
                      <span className="text-slate-200">{data.avgSessionsPerUser.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg Drills/User</span>
                      <span className="text-slate-200">{data.avgDrillsPerUser.toFixed(1)}</span>
                    </div>
                    {data.usersExceedingLimit > 0 && (
                      <div className="flex justify-between text-red-400">
                        <span>Exceeding Limit</span>
                        <span>{data.usersExceedingLimit}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Favorites Usage Analytics */}
        {favoritesUsage && (
          <div className="mt-6 bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-xs text-slate-400 uppercase tracking-wide mb-4">Favorites Usage by Plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(favoritesUsage).map(([plan, data]: [string, any]) => (
                <div key={plan} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-sm font-semibold text-slate-200 mb-2">{plan}</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Favorites</span>
                      <span className="text-slate-200">{data.totalFavorites}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg/User</span>
                      <span className="text-slate-200">{data.avgFavoritesPerUser.toFixed(1)}</span>
                    </div>
                    {data.usersAtLimit > 0 && (
                      <div className="flex justify-between text-red-400">
                        <span>At Limit</span>
                        <span>{data.usersAtLimit}</span>
                      </div>
                    )}
                    <div className="pt-2 mt-2 border-t border-slate-700/50">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Distribution</div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Sessions</span>
                          <span className="text-slate-200">{data.distribution.sessions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Drills</span>
                          <span className="text-slate-200">{data.distribution.drills}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Series</span>
                          <span className="text-slate-200">{data.distribution.series}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature Access Analytics */}
        {featureAccess && (
          <div className="mt-6 bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-xs text-slate-400 uppercase tracking-wide mb-4">Feature Access by Plan</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-2 text-slate-400">Plan</th>
                    <th className="text-right py-2 px-2 text-slate-400">PDF Export</th>
                    <th className="text-right py-2 px-2 text-slate-400">Series</th>
                    <th className="text-right py-2 px-2 text-slate-400">Advanced Filters</th>
                    <th className="text-right py-2 px-2 text-slate-400">Calendar</th>
                    <th className="text-right py-2 px-2 text-slate-400">Player Plans</th>
                    <th className="text-right py-2 px-2 text-slate-400">Weekly Summary</th>
                    <th className="text-right py-2 px-2 text-slate-400">Invite Coaches</th>
                    <th className="text-right py-2 px-2 text-slate-400">Manage Org</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(featureAccess).map(([plan, data]: [string, any]) => (
                    <tr key={plan} className="border-b border-slate-800">
                      <td className="py-2 px-2 font-semibold text-slate-200">{plan}</td>
                      <td className="py-2 px-2 text-right text-slate-300">{data.canExportPDF}</td>
                      <td className="py-2 px-2 text-right text-slate-300">{data.canGenerateSeries}</td>
                      <td className="py-2 px-2 text-right text-slate-300">{data.canUseAdvancedFilters}</td>
                      <td className="py-2 px-2 text-right text-slate-300">{data.canAccessCalendar}</td>
                      <td className="py-2 px-2 text-right text-slate-300">{data.canCreatePlayerPlans}</td>
                      <td className="py-2 px-2 text-right text-slate-300">{data.canGenerateWeeklySummaries}</td>
                      <td className="py-2 px-2 text-right text-slate-300">{data.canInviteCoaches}</td>
                      <td className="py-2 px-2 text-right text-slate-300">{data.canManageOrganization}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trial Accounts Analytics */}
        {trialAccounts && (
          <div className="mt-6 bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-xs text-slate-400 uppercase tracking-wide mb-4">Trial Accounts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="text-sm font-semibold text-slate-200 mb-3">Overview</div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Trials</span>
                    <span className="text-slate-200">{trialAccounts.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active</span>
                    <span className="text-emerald-400">{trialAccounts.active}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expired</span>
                    <span className="text-red-400">{trialAccounts.expired}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Conversion Rate</span>
                    <span className="text-slate-200">{trialAccounts.conversionRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="text-sm font-semibold text-slate-200 mb-3">Days Remaining Distribution</div>
                <div className="space-y-1.5 text-xs">
                  {Object.entries(trialAccounts.daysRemainingDistribution || {}).map(([bucket, count]: [string, any]) => (
                    <div key={bucket} className="flex justify-between">
                      <span className="text-slate-400">{bucket} days</span>
                      <span className="text-slate-200">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {trialAccounts.upcomingExpirations && trialAccounts.upcomingExpirations.length > 0 && (
              <div className="mt-4 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="text-sm font-semibold text-slate-200 mb-3">Upcoming Expirations (Next 20)</div>
                <div className="space-y-1.5 text-xs max-h-60 overflow-y-auto">
                  {trialAccounts.upcomingExpirations.map((trial: any) => (
                    <div key={trial.userId} className="flex justify-between items-center py-1">
                      <span className="text-slate-300 truncate">{trial.email || trial.userId}</span>
                      <span className={`ml-2 ${trial.daysRemaining <= 1 ? 'text-red-400' : trial.daysRemaining <= 3 ? 'text-yellow-400' : 'text-slate-400'}`}>
                        {trial.daysRemaining} days
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Limit Enforcement Analytics */}
        {limitEnforcement && (
          <div className="mt-6 bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-xs text-slate-400 uppercase tracking-wide mb-4">Limit Enforcement</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="text-sm font-semibold text-slate-200 mb-2">Summary</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Limit Hits</span>
                    <span className="text-red-400 font-semibold">{limitEnforcement.totalHits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sessions</span>
                    <span className="text-slate-200">{limitEnforcement.hitsByType?.sessions || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Drills</span>
                    <span className="text-slate-200">{limitEnforcement.hitsByType?.drills || 0}</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="text-sm font-semibold text-slate-200 mb-2">Hits by Plan</div>
                <div className="space-y-1.5 text-xs">
                  {Object.entries(limitEnforcement.hitsByPlan || {}).map(([plan, count]: [string, any]) => (
                    <div key={plan} className="flex justify-between">
                      <span className="text-slate-400">{plan}</span>
                      <span className="text-red-400">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {limitEnforcement.recentHits && limitEnforcement.recentHits.length > 0 && (
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="text-sm font-semibold text-slate-200 mb-3">Recent Limit Hits (Top 50)</div>
                <div className="space-y-1 text-xs max-h-60 overflow-y-auto">
                  {limitEnforcement.recentHits.map((hit: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-700/30">
                      <div className="flex-1 truncate">
                        <span className="text-slate-300">{hit.email || hit.userId}</span>
                        <span className="text-slate-500 ml-2">({hit.plan})</span>
                      </div>
                      <div className="ml-2 text-red-400">
                        {hit.limitType}: {hit.used}/{hit.limit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Club Accounts Analytics */}
        {clubAccounts && (
          <div className="mt-6 bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-xs text-slate-400 uppercase tracking-wide mb-4">Club Accounts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="text-sm font-semibold text-slate-200 mb-3">Overview</div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Club Accounts</span>
                    <span className="text-slate-200">{clubAccounts.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Standard</span>
                    <span className="text-slate-200">{clubAccounts.standard}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Premium</span>
                    <span className="text-slate-200">{clubAccounts.premium}</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="text-sm font-semibold text-slate-200 mb-3">Organizations</div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Organizations</span>
                    <span className="text-slate-200">{clubAccounts.organizations?.total || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg Coaches/Org</span>
                    <span className="text-slate-200">{clubAccounts.organizations?.avgCoachesPerOrg?.toFixed(1) || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Management */}
        <div className="mt-6 bg-slate-900/70 border border-slate-700/70 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">User Management</h2>
            <button
              onClick={() => {
                setShowCreateUser(!showCreateUser);
                setCreateUserError(null);
                setCreateUserSuccess(null);
              }}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              {showCreateUser ? "Cancel" : "+ Create User"}
            </button>
          </div>

          {/* Create User Form */}
          {showCreateUser && (
            <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Create New User</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email *</label>
                  <input
                    type="email"
                    value={createUserForm.email}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={createUserForm.name}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Role *</label>
                  <select
                    value={createUserForm.role}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, role: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="FREE">FREE</option>
                    <option value="COACH">COACH</option>
                    <option value="CLUB">CLUB</option>
                    <option value="TRIAL">TRIAL</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Admin Role</label>
                  <select
                    value={createUserForm.adminRole}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, adminRole: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">None</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="MODERATOR">MODERATOR</option>
                    <option value="SUPPORT">SUPPORT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={createUserForm.password}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="Leave empty for auto-generated"
                  />
                  <p className="text-xs text-slate-500 mt-1">Auto-generated if left empty</p>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createUserForm.autoVerifyEmail}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, autoVerifyEmail: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500/50"
                    />
                    <span className="text-xs text-slate-400">Auto-verify email</span>
                  </label>
                </div>
              </div>

              {/* Coach-specific fields */}
              {createUserForm.role === "COACH" && (
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <h4 className="text-xs font-semibold text-slate-300 mb-3">Coach Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Coach Level * 
                        {!createUserForm.coachLevel && (
                          <span className="text-red-400 ml-1">(Required)</span>
                        )}
                      </label>
                      <select
                        value={createUserForm.coachLevel}
                        onChange={(e) => setCreateUserForm({ ...createUserForm, coachLevel: e.target.value as any })}
                        required
                        className={`w-full px-3 py-2 rounded-lg border bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                          !createUserForm.coachLevel 
                            ? "border-red-600/50 focus:ring-red-500/50" 
                            : "border-slate-700"
                        }`}
                      >
                        <option value="">Select coach level *</option>
                        <option value="GRASSROOTS">Grassroots</option>
                        <option value="USSF_C">USSF C</option>
                        <option value="USSF_B_PLUS">USSF B+</option>
                      </select>
                      {!createUserForm.coachLevel && (
                        <p className="text-xs text-red-400 mt-1">Coach level is required for COACH role</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Age Groups * 
                        {createUserForm.teamAgeGroups.length === 0 && (
                          <span className="text-red-400 ml-1">(Required)</span>
                        )}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {VAULT_AGE_GROUPS.map((ageGroup) => (
                          <label key={ageGroup} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={createUserForm.teamAgeGroups.includes(ageGroup)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCreateUserForm({
                                    ...createUserForm,
                                    teamAgeGroups: [...createUserForm.teamAgeGroups, ageGroup],
                                  });
                                } else {
                                  setCreateUserForm({
                                    ...createUserForm,
                                    teamAgeGroups: createUserForm.teamAgeGroups.filter((ag) => ag !== ageGroup),
                                  });
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500/50"
                            />
                            <span className="text-xs text-slate-300">{ageGroup}</span>
                          </label>
                        ))}
                      </div>
                      {createUserForm.teamAgeGroups.length === 0 && (
                        <p className="text-xs text-red-400 mt-1">At least one age group is required for COACH role</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {createUserError && (
                <div className="mt-4 p-3 rounded-lg bg-red-900/20 border border-red-700/50 text-sm text-red-300">
                  {createUserError}
                </div>
              )}
              {createUserSuccess && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-900/20 border border-emerald-700/50 text-sm text-emerald-300">
                  User created successfully! Email: {createUserSuccess.email}
                  {createUserSuccess.password && (
                    <div className="mt-2">
                      <strong>Initial Password:</strong> <code className="bg-slate-800 px-2 py-1 rounded">{createUserSuccess.password}</code>
                      <p className="text-xs mt-1 text-emerald-400">Save this password - it won't be shown again!</p>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={createUser}
                  disabled={
                    creatingUser ||
                    !createUserForm.email ||
                    (createUserForm.role === "COACH" && (!createUserForm.coachLevel || createUserForm.teamAgeGroups.length === 0))
                  }
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingUser ? "Creating..." : "Create User"}
                </button>
                <button
                  onClick={() => {
                    setShowCreateUser(false);
                    setCreateUserForm({
                      email: "",
                      name: "",
                      role: "FREE",
                      adminRole: "",
                      password: "",
                      autoVerifyEmail: false,
                      coachLevel: "",
                      teamAgeGroups: [],
                    });
                    setCreateUserError(null);
                    setCreateUserSuccess(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Users List */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Users ({userSummary?.totalUsers || 0})</h3>
            <button
              onClick={() => loadUsers(1)}
              disabled={loadingUsers}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {loadingUsers ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loadingUsers && users.length === 0 ? (
            <div className="text-center py-8 text-slate-400">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No users found. Click "Refresh" to load users.</div>
          ) : (
            <div className="overflow-x-auto">
              {emailActionNotice && (
                <div
                  className={`mb-3 rounded-lg border p-3 text-sm ${
                    emailActionNotice.type === "success"
                      ? "border-emerald-700/50 bg-emerald-900/20 text-emerald-300"
                      : "border-red-700/50 bg-red-900/20 text-red-300"
                  }`}
                >
                  {emailActionNotice.message}
                </div>
              )}
              {roleActionNotice && (
                <div
                  className={`mb-3 rounded-lg border p-3 text-sm ${
                    roleActionNotice.type === "success"
                      ? "border-emerald-700/50 bg-emerald-900/20 text-emerald-300"
                      : "border-red-700/50 bg-red-900/20 text-red-300"
                  }`}
                >
                  {roleActionNotice.message}
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Email</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Name</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Role</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Admin Role</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Coach Level</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Verified</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Created</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-slate-200">{user.email}</td>
                      <td className="py-2 px-3 text-slate-300">{user.name || "-"}</td>
                      <td className="py-2 px-3">
                        <select
                          value={user.role}
                          onChange={(e) => updateUserRole(user.id, e.target.value)}
                          disabled={updatingUserRole === user.id}
                          className="px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                          <option value="FREE">FREE</option>
                          <option value="COACH">COACH</option>
                          <option value="CLUB">CLUB</option>
                          <option value="TRIAL">TRIAL</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={user.adminRole || ""}
                          onChange={(e) => updateUserRole(user.id, undefined, e.target.value || null)}
                          disabled={updatingUserRole === user.id}
                          className="px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                          <option value="">None</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="MODERATOR">MODERATOR</option>
                          <option value="SUPPORT">SUPPORT</option>
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        {user.role === "COACH" ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-300">
                              {user.coachLevel ? coachLevelLabel[user.coachLevel] || user.coachLevel : "Not set"}
                            </span>
                            {user.teamAgeGroups && user.teamAgeGroups.length > 0 && (
                              <span className="text-xs text-slate-500" title={`Age groups: ${user.teamAgeGroups.join(", ")}`}>
                                ({user.teamAgeGroups.length})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">N/A</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {user.emailVerified ? (
                          <span className="text-xs text-emerald-400 font-semibold">✓ Verified</span>
                        ) : (
                          <span className="text-xs text-yellow-400 font-semibold">⚠ Unverified</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-xs">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {user.blocked && (
                            <span className="text-xs text-red-400 font-semibold" title={user.blockedReason || "User is blocked"}>
                              🔒 Blocked
                            </span>
                          )}
                          <div className="flex items-center gap-1 flex-wrap">
                            {!user.emailVerified && (
                              <>
                                <button
                                  onClick={() => verifyUserEmail(user.id)}
                                  disabled={verifyingEmail === user.id}
                                  className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                                  title="Manually verify email"
                                >
                                  {verifyingEmail === user.id ? "Verifying..." : "✓ Verify"}
                                </button>
                                <button
                                  onClick={() => resendVerificationEmail(user.id)}
                                  disabled={resendingVerification === user.id}
                                  className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                                  title="Resend verification email"
                                >
                                  {resendingVerification === user.id ? "Sending..." : "📧 Resend"}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                setShowResetPasswordModal({ userId: user.id, email: user.email });
                                setResetPasswordInput("");
                                setShowPassword(false);
                              }}
                              disabled={resettingPassword === user.id}
                              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                              title="Reset password"
                            >
                              {resettingPassword === user.id ? "Resetting..." : "🔑 Reset"}
                            </button>
                            {user.role === "COACH" && (
                              <button
                                onClick={() => {
                                  setShowCoachLevelModal({
                                    userId: user.id,
                                    email: user.email,
                                    currentCoachLevel: user.coachLevel,
                                    currentAgeGroups: user.teamAgeGroups || [],
                                  });
                                  setCoachLevelForm({
                                    coachLevel: (user.coachLevel || "") as any,
                                    teamAgeGroups: user.teamAgeGroups || [],
                                  });
                                }}
                                disabled={updatingCoachLevel === user.id}
                                className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50"
                                title="Edit coach level and age groups"
                              >
                                {updatingCoachLevel === user.id ? "Updating..." : "🎓 Edit Level"}
                              </button>
                            )}
                            <button
                              onClick={() => setShowBlockModal({ userId: user.id, email: user.email, currentlyBlocked: user.blocked })}
                              disabled={blockingUser === user.id}
                              className={`text-xs ${user.blocked ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'} disabled:opacity-50`}
                              title={user.blocked ? "Unblock user" : "Block user"}
                            >
                              {user.blocked ? "🔓 Unblock" : "🚫 Block"}
                            </button>
                            <button
                              onClick={() => {
                                setShowDeleteUserModal({ userId: user.id, email: user.email });
                                setDeleteUserConfirmInput("");
                              }}
                              disabled={deletingUser === user.id}
                              className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-50"
                              title="Erase account and account data"
                            >
                              {deletingUser === user.id ? "Erasing..." : "🗑 Erase"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {usersTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => loadUsers(usersPage - 1)}
                    disabled={usersPage <= 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-400">
                    Page {usersPage} of {usersTotalPages}
                  </span>
                  <button
                    onClick={() => loadUsers(usersPage + 1)}
                    disabled={usersPage >= usersTotalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Access Permissions Management */}
        <div className="mt-6 bg-slate-900/70 border border-slate-700/70 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Access Permissions</h2>
            <button
              onClick={() => {
                setPermissionForm(createEmptyPermissionForm());
                setShowPermissionModal({});
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              + New Permission
            </button>
          </div>

          {loadingPermissions ? (
            <div className="text-center py-8 text-slate-400">Loading permissions...</div>
          ) : accessPermissions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No permissions configured. Click "New Permission" to create one.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">User</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Resource</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Coach Level</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Age Groups</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Formats</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Sessions</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Vault</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Video Review</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accessPermissions.map((perm) => (
                    <tr key={perm.id} className="border-b border-slate-700/30">
                      <td className="py-2 px-3 text-slate-300">
                        {perm.user ? (
                          <div>
                            <div className="text-xs font-semibold">{perm.user.name || perm.user.email}</div>
                            <div className="text-xs text-slate-500">{perm.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">All Users</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-300">{perm.resourceType}</td>
                      <td className="py-2 px-3 text-slate-300">
                        {perm.userId ? (
                          perm.user?.coachLevel ? (
                            <span>{coachLevelLabel[perm.user.coachLevel] || perm.user.coachLevel}</span>
                          ) : (
                            <span className="text-xs text-slate-500">Not set (User-specific)</span>
                          )
                        ) : (
                          perm.coachLevel ? coachLevelLabel[perm.coachLevel] || perm.coachLevel : "All"
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        {perm.ageGroups.length === 0 ? "All" : perm.ageGroups.join(", ")}
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        {perm.formats.length === 0 ? "All" : perm.formats.join(", ")}
                      </td>
                      <td className="py-2 px-3">
                        {perm.canGenerateSessions ? (
                          <span className="text-xs text-emerald-400 font-semibold">✓ Allowed</span>
                        ) : (
                          <span className="text-xs text-red-400 font-semibold">✗ Denied</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {perm.canAccessVault ? (
                          <span className="text-xs text-emerald-400 font-semibold">✓ Allowed</span>
                        ) : (
                          <span className="text-xs text-red-400 font-semibold">✗ Denied</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {perm.canAccessVideoReview ? (
                          <span className="text-xs text-emerald-400 font-semibold">✓ Allowed</span>
                        ) : (
                          <span className="text-xs text-red-400 font-semibold">✗ Denied</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              // If permission has a userId, find the user and load their current coach level
                              const user = perm.userId ? users.find(u => u.id === perm.userId) : null;
                              setPermissionForm({
                                userId: perm.userId || "",
                                resourceType: perm.resourceType as any,
                                // If user-specific permission, load user's current coach level; otherwise use permission's coachLevel
                                coachLevel: (perm.userId && user?.coachLevel) ? (user.coachLevel as any) : ((perm.coachLevel || "") as any),
                                ageGroups: perm.ageGroups,
                                formats: perm.formats,
                                canGenerateSessions: perm.canGenerateSessions,
                                canAccessVault: perm.canAccessVault,
                                canAccessVideoReview: perm.canAccessVideoReview,
                                notes: perm.notes || "",
                              });
                              setShowPermissionModal({ permission: perm });
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300"
                            title="Edit permission"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => deletePermission(perm.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                            title="Delete permission"
                          >
                            🗑️ Delete
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

        {/* Coach Level Edit Modal */}
        {showCoachLevelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Edit Coach Level</h3>
              <p className="text-sm text-slate-300 mb-4">
                Update coach level and age groups for {showCoachLevelModal.email}
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Coach Level *</label>
                  <select
                    value={coachLevelForm.coachLevel}
                    onChange={(e) => setCoachLevelForm({ ...coachLevelForm, coachLevel: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">Select coach level</option>
                    <option value="GRASSROOTS">Grassroots</option>
                    <option value="USSF_C">USSF C</option>
                    <option value="USSF_B_PLUS">USSF B+</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Age Groups *</label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-slate-700 rounded-lg bg-slate-800/50">
                    {VAULT_AGE_GROUPS.map((ageGroup) => (
                      <label key={ageGroup} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={coachLevelForm.teamAgeGroups.includes(ageGroup)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCoachLevelForm({
                                ...coachLevelForm,
                                teamAgeGroups: [...coachLevelForm.teamAgeGroups, ageGroup],
                              });
                            } else {
                              setCoachLevelForm({
                                ...coachLevelForm,
                                teamAgeGroups: coachLevelForm.teamAgeGroups.filter((ag) => ag !== ageGroup),
                              });
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500/50"
                        />
                        <span className="text-xs text-slate-300">{ageGroup}</span>
                      </label>
                    ))}
                  </div>
                  {coachLevelForm.teamAgeGroups.length === 0 && (
                    <p className="text-xs text-red-400 mt-1">At least one age group is required</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    if (coachLevelForm.coachLevel && coachLevelForm.teamAgeGroups.length > 0) {
                      updateCoachLevel(showCoachLevelModal.userId, coachLevelForm.coachLevel, coachLevelForm.teamAgeGroups);
                    } else {
                      alert("Coach level and at least one age group are required");
                    }
                  }}
                  disabled={
                    updatingCoachLevel === showCoachLevelModal.userId ||
                    !coachLevelForm.coachLevel ||
                    coachLevelForm.teamAgeGroups.length === 0
                  }
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingCoachLevel === showCoachLevelModal.userId ? "Updating..." : "Update Coach Level"}
                </button>
                <button
                  onClick={() => {
                    setShowCoachLevelModal(null);
                    setCoachLevelForm({ coachLevel: "", teamAgeGroups: [] });
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Access Permission Modal */}
        {showPermissionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">
                {showPermissionModal.permission ? "Edit Permission" : "New Permission"}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Assign To</label>
                  <select
                    value={permissionForm.userId}
                    onChange={(e) => {
                      const userId = e.target.value;
                      const selectedUser = userId ? users.find(u => u.id === userId) : null;
                      setPermissionForm({ 
                        ...permissionForm, 
                        userId: userId || "",
                        // If selecting a user, load their current coach level; if clearing, keep existing coachLevel
                        coachLevel: userId && selectedUser?.coachLevel ? (selectedUser.coachLevel as any) : (permissionForm.coachLevel || "")
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">All Users (Coach Level Based)</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email} {user.email ? `(${user.email})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Select a specific user for user-specific permissions, or leave empty for coach-level based permissions
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Resource Type *</label>
                  <select
                    value={permissionForm.resourceType}
                    onChange={(e) => setPermissionForm({ ...permissionForm, resourceType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="SESSION">Sessions Only</option>
                    <option value="VAULT">Vault Only</option>
                    <option value="BOTH">Both Sessions & Vault</option>
                    <option value="VIDEO_REVIEW">Video Review Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Coach Level
                    {permissionForm.userId && <span className="text-slate-500 ml-1">(Updates user's coach level)</span>}
                  </label>
                  <select
                    value={permissionForm.coachLevel}
                    onChange={(e) => {
                      const newCoachLevel = e.target.value as any;
                      setPermissionForm({ 
                        ...permissionForm, 
                        coachLevel: newCoachLevel,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">{permissionForm.userId ? "No change" : "All Coach Levels"}</option>
                    <option value="GRASSROOTS">Grassroots</option>
                    <option value="USSF_C">USSF C</option>
                    <option value="USSF_B_PLUS">USSF B+</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {permissionForm.userId 
                      ? "This will update the user's coach level property. The permission itself is user-specific."
                      : "Leave empty to apply to all coach levels, or select a specific level"}
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Age Groups</label>
                  <p className="text-xs text-slate-500 mb-2">Leave empty to allow all age groups</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-slate-700 rounded-lg bg-slate-800/50">
                    {VAULT_AGE_GROUPS.map((ageGroup) => (
                      <label key={ageGroup} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissionForm.ageGroups.includes(ageGroup)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPermissionForm({
                                ...permissionForm,
                                ageGroups: [...permissionForm.ageGroups, ageGroup],
                              });
                            } else {
                              setPermissionForm({
                                ...permissionForm,
                                ageGroups: permissionForm.ageGroups.filter((ag) => ag !== ageGroup),
                              });
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500/50"
                        />
                        <span className="text-xs text-slate-300">{ageGroup}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Formats</label>
                  <p className="text-xs text-slate-500 mb-2">Leave empty to allow all formats</p>
                  <div className="flex flex-wrap gap-2">
                    {["7v7", "9v9", "11v11"].map((format) => (
                      <label key={format} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissionForm.formats.includes(format)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPermissionForm({
                                ...permissionForm,
                                formats: [...permissionForm.formats, format],
                              });
                            } else {
                              setPermissionForm({
                                ...permissionForm,
                                formats: permissionForm.formats.filter((f) => f !== format),
                              });
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500/50"
                        />
                        <span className="text-xs text-slate-300">{format}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissionForm.canGenerateSessions}
                      onChange={(e) => setPermissionForm({ ...permissionForm, canGenerateSessions: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500/50"
                    />
                    <span className="text-xs text-slate-300">Can Generate Sessions</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissionForm.canAccessVault}
                      onChange={(e) => setPermissionForm({ ...permissionForm, canAccessVault: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500/50"
                    />
                    <span className="text-xs text-slate-300">Can Access Vault</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissionForm.canAccessVideoReview}
                      onChange={(e) => setPermissionForm({ ...permissionForm, canAccessVideoReview: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500/50"
                    />
                    <span className="text-xs text-slate-300">Can Access Video Review</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
                  <textarea
                    value={permissionForm.notes}
                    onChange={(e) => setPermissionForm({ ...permissionForm, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    rows={3}
                    placeholder="Optional notes about this permission..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPermissionModal(null);
                    setPermissionForm(createEmptyPermissionForm());
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={savePermission}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  {showPermissionModal.permission ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {showResetPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Reset Password</h3>
              <p className="text-sm text-slate-300 mb-4">
                Enter a new password for {showResetPasswordModal.email}. Leave empty to auto-generate.
              </p>
              <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={resetPasswordInput}
                    onChange={(e) => setResetPasswordInput(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="Leave empty to auto-generate"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        resetUserPassword(showResetPasswordModal.userId, resetPasswordInput || undefined);
                      } else if (e.key === "Escape") {
                        setShowResetPasswordModal(null);
                        setResetPasswordInput("");
                        setShowPassword(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Press Enter to confirm, Escape to cancel</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    resetUserPassword(showResetPasswordModal.userId, resetPasswordInput || undefined);
                    setShowResetPasswordModal(null);
                    setResetPasswordInput("");
                  }}
                  disabled={resettingPassword === showResetPasswordModal.userId}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
                >
                  {resettingPassword === showResetPasswordModal.userId ? "Resetting..." : "Reset Password"}
                </button>
                <button
                  onClick={() => {
                    setShowResetPasswordModal(null);
                    setResetPasswordInput("");
                    setShowPassword(false);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Success Modal */}
        {resetPasswordSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Password Reset Successful</h3>
              {resetPasswordSuccess.password && (
                <div className="mb-4">
                  <p className="text-sm text-slate-300 mb-2">New password generated:</p>
                  <code className="block bg-slate-800 px-3 py-2 rounded text-slate-200 font-mono text-sm">
                    {resetPasswordSuccess.password}
                  </code>
                  <p className="text-xs text-slate-500 mt-2">Save this password - it won't be shown again!</p>
                </div>
              )}
              <button
                onClick={() => setResetPasswordSuccess(null)}
                className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Block/Unblock User Modal */}
        {showBlockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">
                {showBlockModal.currentlyBlocked ? "Unblock User" : "Block User"}
              </h3>
              <p className="text-sm text-slate-300 mb-4">
                {showBlockModal.currentlyBlocked
                  ? `Are you sure you want to unblock ${showBlockModal.email}?`
                  : `Are you sure you want to block ${showBlockModal.email}? This will prevent them from accessing the system.`}
              </p>
              {!showBlockModal.currentlyBlocked && (
                <div className="mb-4">
                  <label className="block text-xs text-slate-400 mb-1">Reason (optional)</label>
                  <textarea
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="Enter reason for blocking..."
                    rows={3}
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => toggleUserBlock(showBlockModal.userId, !showBlockModal.currentlyBlocked, blockReason)}
                  disabled={blockingUser === showBlockModal.userId}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                    showBlockModal.currentlyBlocked
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-red-600 hover:bg-red-500 text-white'
                  }`}
                >
                  {blockingUser === showBlockModal.userId
                    ? (showBlockModal.currentlyBlocked ? "Unblocking..." : "Blocking...")
                    : (showBlockModal.currentlyBlocked ? "Unblock User" : "Block User")}
                </button>
                <button
                  onClick={() => {
                    setShowBlockModal(null);
                    setBlockReason("");
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete User Modal */}
        {showDeleteUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="bg-slate-900 border border-rose-700/60 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-rose-200 mb-3">Erase Account</h3>
              <p className="text-sm text-slate-300 mb-3">
                This permanently deletes <span className="font-semibold text-slate-100">{showDeleteUserModal.email}</span> and related account data.
              </p>
              <p className="text-xs text-slate-400 mb-3">
                Type <span className="font-mono text-rose-300">DELETE</span> to confirm.
              </p>
              <input
                type="text"
                value={deleteUserConfirmInput}
                onChange={(e) => setDeleteUserConfirmInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                placeholder="Type DELETE"
              />
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteUserModal(null);
                    setDeleteUserConfirmInput("");
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteUserAccount(showDeleteUserModal.userId)}
                  disabled={deleteUserConfirmInput.trim().toUpperCase() !== "DELETE" || deletingUser === showDeleteUserModal.userId}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingUser === showDeleteUserModal.userId ? "Erasing..." : "Erase Account"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Revenue Calculator */}
        {(() => {
          const totalSessions = stats?.database.vaultSessions || 0;
          const apiCost = parseFloat(stats?.tokens.allTimeCost || "0");
          const revenue = totalSessions * pricePerSession;
          const profit = revenue - apiCost;
          const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0";
          
          // Calculate daily averages from timeline for projections
          const avgSessionsPerDay = timeline.length > 0 
            ? timeline.reduce((sum, d) => sum + d.sessions, 0) / timeline.length 
            : 0;
          const projectedMonthlyRevenue = avgSessionsPerDay * 30 * pricePerSession;
          const projectedYearlyRevenue = avgSessionsPerDay * 365 * pricePerSession;
          
          return (
            <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900/70 border border-emerald-700/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-emerald-300">Revenue Calculator</div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.10"
                    max="1.00"
                    step="0.05"
                    value={pricePerSession}
                    onChange={(e) => setPricePerSession(parseFloat(e.target.value))}
                    className="w-32 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="text-sm font-bold text-emerald-400 bg-slate-800/50 px-3 py-1 rounded min-w-[70px] text-center">
                    ${pricePerSession.toFixed(2)}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-xs text-slate-500">Total Revenue</div>
                  <div className="text-2xl font-bold text-emerald-400">${revenue.toFixed(2)}</div>
                  <div className="text-xs text-slate-500">{formatNumber(totalSessions)} sessions</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">API Costs</div>
                  <div className="text-2xl font-bold text-red-400">${apiCost.toFixed(4)}</div>
                  <div className="text-xs text-slate-500">Gemini tokens</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Net Profit</div>
                  <div className={`text-2xl font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${profit.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">{profitMargin}% margin</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Avg Sessions/Day</div>
                  <div className="text-2xl font-bold text-blue-400">{avgSessionsPerDay.toFixed(1)}</div>
                  <div className="text-xs text-slate-500">last 7 days</div>
                </div>
              </div>

              <div className="border-t border-slate-700/50 pt-4">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Projected Revenue @ ${pricePerSession.toFixed(2)}/session</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500">Weekly</div>
                    <div className="text-lg font-bold text-amber-400">${(avgSessionsPerDay * 7 * pricePerSession).toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500">Monthly</div>
                    <div className="text-lg font-bold text-amber-400">${projectedMonthlyRevenue.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500">Yearly</div>
                    <div className="text-lg font-bold text-amber-400">${projectedYearlyRevenue.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Token & Cost Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Total Tokens (All Time)</div>
            <div className="flex items-baseline gap-4">
              <div className="text-3xl font-bold text-cyan-400">
                {formatNumber(stats?.tokens.allTimeTotal || 0)}
              </div>
              <div className="text-lg text-emerald-400 font-medium">
                ${stats?.tokens.allTimeCost || "0.0000"}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Input: </span>
                <span className="text-slate-300">{formatNumber(stats?.tokens.allTimePromptTokens || 0)}</span>
                <span className="text-slate-500 ml-1">@ ${stats?.pricing.inputPer1M || 0.10}/1M</span>
              </div>
              <div>
                <span className="text-slate-500">Output: </span>
                <span className="text-slate-300">{formatNumber(stats?.tokens.allTimeCompletionTokens || 0)}</span>
                <span className="text-slate-500 ml-1">@ ${stats?.pricing.outputPer1M || 0.40}/1M</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Avg Tokens by Operation</div>
            {operationStats.length > 0 ? (
              <div className="space-y-2">
                {operationStats.map((op) => (
                  <div key={op.type} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded ${
                        op.type === "session" ? "bg-emerald-500" :
                        op.type === "drill" ? "bg-cyan-500" :
                        op.type === "qa_review" ? "bg-blue-500" :
                        op.type === "skill_focus" ? "bg-purple-500" :
                        op.type === "series" ? "bg-amber-500" :
                        op.type === "video_analysis" ? "bg-lime-500" :
                        op.type === "chat" ? "bg-pink-500" :
                        op.type === "fixer" ? "bg-orange-500" : "bg-slate-500"
                      }`} />
                      <span className="capitalize text-slate-300">{getOperationLabel(op.type)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-cyan-400 font-medium">{formatNumber(op.avgTokens)}</span>
                      <span className="text-slate-500 ml-2 text-xs">~${op.avgCost}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No operation data yet</div>
            )}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Timeline Chart */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Daily Generation (Last 7 Days)</h2>
            {timeline.length > 0 ? (
              <div className="space-y-2">
                {timeline.map((day) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-slate-400">
                      {new Date(day.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                    <div className="flex-1 flex items-center gap-1 h-6">
                      {/* Stacked bar */}
                      <div
                        className="h-full bg-emerald-500 rounded-l"
                        style={{ width: `${Math.max(2, (day.sessions / Math.max(...timeline.map(t => t.calls)) * 100))}%` }}
                        title={`${day.sessions} sessions`}
                      />
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${Math.max(1, (day.qaReviews / Math.max(...timeline.map(t => t.calls)) * 50))}%` }}
                        title={`${day.qaReviews} QA reviews`}
                      />
                      <div
                        className="h-full bg-purple-500 rounded-r"
                        style={{ width: `${Math.max(1, (day.skillFocus / Math.max(...timeline.map(t => t.calls)) * 30))}%` }}
                        title={`${day.skillFocus} coaching emphasis`}
                      />
                    </div>
                    <div className="w-16 text-right text-xs text-slate-400">
                      {day.calls} calls
                    </div>
                  </div>
                ))}
                <div className="flex gap-4 text-xs text-slate-500 mt-3 pt-2 border-t border-slate-700">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded" /> Sessions</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded" /> QA</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-500 rounded" /> Coaching Emphasis</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No data for the selected period</div>
            )}
          </div>

          {/* Operations Breakdown */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">By Operation Type</h2>
            {operationStats.length > 0 ? (
              <div className="space-y-3">
                {operationStats.map((op) => (
                  <div key={op.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded ${
                        op.type === "session" ? "bg-emerald-500" :
                        op.type === "drill" ? "bg-cyan-500" :
                        op.type === "qa_review" ? "bg-blue-500" :
                        op.type === "skill_focus" ? "bg-purple-500" :
                        op.type === "series" ? "bg-amber-500" :
                        op.type === "chat" ? "bg-pink-500" :
                        op.type === "fixer" ? "bg-orange-500" : "bg-slate-500"
                      }`} />
                      <span className="text-sm capitalize">{getOperationLabel(op.type)}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{formatNumber(op.count)} calls</div>
                      <div className="text-xs text-slate-500">
                        {formatNumber(op.totalTokens)} tokens • ${op.totalCost}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No operation data yet</div>
            )}
          </div>
        </div>

        {/* QA Status Analytics */}
        <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">QA Status Analytics</h2>
            <button
              onClick={fetchQaAnalytics}
              disabled={loadingQaAnalytics}
              className="px-3 py-1 text-xs rounded-lg border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              {loadingQaAnalytics ? "Loading..." : "Refresh"}
            </button>
          </div>
          
          {qaAnalytics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="px-3 py-2 bg-emerald-900/30 rounded-lg border border-emerald-700/30">
                  <div className="text-xs text-emerald-300/70 mb-1">OK</div>
                  <div className="text-2xl font-bold text-emerald-400">{qaAnalytics.statusCounts.OK || 0}</div>
                  <div className="text-[10px] text-emerald-300/50 mt-1">
                    {qaAnalytics.total > 0 ? ((qaAnalytics.statusCounts.OK / qaAnalytics.total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="px-3 py-2 bg-yellow-900/30 rounded-lg border border-yellow-700/30">
                  <div className="text-xs text-yellow-300/70 mb-1">PATCHABLE</div>
                  <div className="text-2xl font-bold text-yellow-400">{qaAnalytics.statusCounts.PATCHABLE || 0}</div>
                  <div className="text-[10px] text-yellow-300/50 mt-1">
                    {qaAnalytics.total > 0 ? ((qaAnalytics.statusCounts.PATCHABLE / qaAnalytics.total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="px-3 py-2 bg-red-900/30 rounded-lg border border-red-700/30">
                  <div className="text-xs text-red-300/70 mb-1">NEEDS_REGEN</div>
                  <div className="text-2xl font-bold text-red-400">{qaAnalytics.statusCounts.NEEDS_REGEN || 0}</div>
                  <div className="text-[10px] text-red-300/50 mt-1">
                    {qaAnalytics.total > 0 ? ((qaAnalytics.statusCounts.NEEDS_REGEN / qaAnalytics.total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="text-xs text-slate-400 mb-1">NO_QA</div>
                  <div className="text-2xl font-bold text-slate-300">{qaAnalytics.statusCounts.NO_QA_OR_PASS || 0}</div>
                  <div className="text-[10px] text-slate-400/50 mt-1">
                    {qaAnalytics.total > 0 ? ((qaAnalytics.statusCounts.NO_QA_OR_PASS / qaAnalytics.total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400 space-y-1">
                <div>Total Vault Sessions: <span className="text-slate-200 font-semibold">{qaAnalytics.total}</span></div>
                <div>Sessions with QA: <span className="text-slate-200 font-semibold">{qaAnalytics.withQA}</span></div>
                <div>Sessions without QA: <span className="text-slate-200 font-semibold">{qaAnalytics.withoutQA}</span></div>
              </div>

              {/* Show sample sessions for each status */}
              {(qaAnalytics.statusCounts.PATCHABLE > 0 || qaAnalytics.statusCounts.NEEDS_REGEN > 0) && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-300 mb-2">
                    View Sample Sessions by Status
                  </summary>
                  <div className="mt-3 space-y-4">
                    {qaAnalytics.statusCounts.PATCHABLE > 0 && qaAnalytics.sessionsByStatus.PATCHABLE.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-yellow-400 mb-2">
                          PATCHABLE Sessions ({qaAnalytics.statusCounts.PATCHABLE} total)
                        </div>
                        <div className="space-y-1">
                          {qaAnalytics.sessionsByStatus.PATCHABLE.slice(0, 5).map((s) => (
                            <div key={s.id} className="text-[10px] text-slate-400 flex items-center gap-2">
                              {s.refCode && (
                                <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 font-mono border border-cyan-700/30">
                                  {s.refCode}
                                </span>
                              )}
                              <span className="truncate">{s.title}</span>
                              {s.qaScore !== null && (
                                <span className="text-yellow-400 ml-auto">QA: {s.qaScore.toFixed(2)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {qaAnalytics.statusCounts.NEEDS_REGEN > 0 && qaAnalytics.sessionsByStatus.NEEDS_REGEN.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-red-400 mb-2">
                          NEEDS_REGEN Sessions ({qaAnalytics.statusCounts.NEEDS_REGEN} total)
                        </div>
                        <div className="space-y-1">
                          {qaAnalytics.sessionsByStatus.NEEDS_REGEN.slice(0, 5).map((s) => (
                            <div key={s.id} className="text-[10px] text-slate-400 flex items-center gap-2">
                              {s.refCode && (
                                <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 font-mono border border-cyan-700/30">
                                  {s.refCode}
                                </span>
                              )}
                              <span className="truncate">{s.title}</span>
                              {s.qaScore !== null && (
                                <span className="text-red-400 ml-auto">QA: {s.qaScore.toFixed(2)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          ) : loadingQaAnalytics ? (
            <div className="text-center py-4 text-sm text-slate-400">Loading QA analytics...</div>
          ) : (
            <div className="text-center py-4 text-sm text-slate-500">Click Refresh to load QA analytics</div>
          )}
        </div>

        {/* QA Status Analytics for Drills */}
        <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">QA Status Analytics - Drills</h2>
            <button
              onClick={fetchQaAnalyticsDrills}
              disabled={loadingQaAnalyticsDrills}
              className="px-3 py-1 text-xs rounded-lg border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              {loadingQaAnalyticsDrills ? "Loading..." : "Refresh"}
            </button>
          </div>
          
          {qaAnalyticsDrills ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="px-3 py-2 bg-emerald-900/30 rounded-lg border border-emerald-700/30">
                  <div className="text-xs text-emerald-300/70 mb-1">OK</div>
                  <div className="text-2xl font-bold text-emerald-400">{qaAnalyticsDrills.statusCounts.OK || 0}</div>
                  <div className="text-[10px] text-emerald-300/50 mt-1">
                    {qaAnalyticsDrills.total > 0 ? ((qaAnalyticsDrills.statusCounts.OK / qaAnalyticsDrills.total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="px-3 py-2 bg-yellow-900/30 rounded-lg border border-yellow-700/30">
                  <div className="text-xs text-yellow-300/70 mb-1">PATCHABLE</div>
                  <div className="text-2xl font-bold text-yellow-400">{qaAnalyticsDrills.statusCounts.PATCHABLE || 0}</div>
                  <div className="text-[10px] text-yellow-300/50 mt-1">
                    {qaAnalyticsDrills.total > 0 ? ((qaAnalyticsDrills.statusCounts.PATCHABLE / qaAnalyticsDrills.total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="px-3 py-2 bg-red-900/30 rounded-lg border border-red-700/30">
                  <div className="text-xs text-red-300/70 mb-1">NEEDS_REGEN</div>
                  <div className="text-2xl font-bold text-red-400">{qaAnalyticsDrills.statusCounts.NEEDS_REGEN || 0}</div>
                  <div className="text-[10px] text-red-300/50 mt-1">
                    {qaAnalyticsDrills.total > 0 ? ((qaAnalyticsDrills.statusCounts.NEEDS_REGEN / qaAnalyticsDrills.total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="text-xs text-slate-400 mb-1">NO_QA</div>
                  <div className="text-2xl font-bold text-slate-300">{qaAnalyticsDrills.statusCounts.NO_QA_OR_PASS || 0}</div>
                  <div className="text-[10px] text-slate-400/50 mt-1">
                    {qaAnalyticsDrills.total > 0 ? ((qaAnalyticsDrills.statusCounts.NO_QA_OR_PASS / qaAnalyticsDrills.total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400 space-y-1">
                <div>Total Vault Drills: <span className="text-slate-200 font-semibold">{qaAnalyticsDrills.total}</span></div>
                <div>Drills with QA: <span className="text-slate-200 font-semibold">{qaAnalyticsDrills.withQA}</span></div>
                <div>Drills without QA: <span className="text-slate-200 font-semibold">{qaAnalyticsDrills.withoutQA}</span></div>
              </div>

              {/* Show sample drills for each status */}
              {(qaAnalyticsDrills.statusCounts.PATCHABLE > 0 ||
                qaAnalyticsDrills.statusCounts.NEEDS_REGEN > 0 ||
                qaAnalyticsDrills.statusCounts.NO_QA_OR_PASS > 0) && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-300 mb-2">
                    View Sample Drills by Status
                  </summary>
                  <div className="mt-2 space-y-3">
                    {qaAnalyticsDrills.statusCounts.PATCHABLE > 0 &&
                      qaAnalyticsDrills.drillsByStatus.PATCHABLE.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-yellow-400 mb-2">
                          PATCHABLE Drills ({qaAnalyticsDrills.statusCounts.PATCHABLE} total)
                        </div>
                        <div className="space-y-1">
                          {qaAnalyticsDrills.drillsByStatus.PATCHABLE.slice(0, 5).map((d) => (
                            <div
                              key={d.id}
                              className="text-[10px] text-slate-400 flex items-center gap-2"
                            >
                              {d.refCode && (
                                <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 font-mono border border-cyan-700/30">
                                  {d.refCode}
                                </span>
                              )}
                              <span className="truncate">
                                {d.title || d.id}
                              </span>
                              {d.qaScore !== null && (
                                <span className="text-yellow-400 ml-auto">QA: {d.qaScore.toFixed(2)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {qaAnalyticsDrills.statusCounts.NEEDS_REGEN > 0 &&
                      qaAnalyticsDrills.drillsByStatus.NEEDS_REGEN.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-red-400 mb-2">
                            NEEDS_REGEN Drills ({qaAnalyticsDrills.statusCounts.NEEDS_REGEN} total)
                          </div>
                          <div className="space-y-1">
                            {qaAnalyticsDrills.drillsByStatus.NEEDS_REGEN.slice(0, 5).map((d) => (
                              <div
                                key={d.id}
                                className="text-[10px] text-slate-400 flex items-center gap-2"
                              >
                                {d.refCode && (
                                  <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 font-mono border border-cyan-700/30">
                                    {d.refCode}
                                  </span>
                                )}
                                <span className="truncate">
                                  {d.title || d.id}
                                </span>
                                {d.qaScore !== null && (
                                  <span className="text-red-400 ml-auto">
                                    QA: {d.qaScore.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    {qaAnalyticsDrills.statusCounts.NO_QA_OR_PASS > 0 &&
                      qaAnalyticsDrills.drillsByStatus.NO_QA_OR_PASS.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-slate-300 mb-2">
                            NO_QA Drills ({qaAnalyticsDrills.statusCounts.NO_QA_OR_PASS} total)
                          </div>
                          <div className="space-y-1">
                            {qaAnalyticsDrills.drillsByStatus.NO_QA_OR_PASS.slice(0, 5).map((d) => (
                              <div
                                key={d.id}
                                className="text-[10px] text-slate-400 flex items-center gap-2"
                              >
                                {d.refCode && (
                                  <span className="px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 font-mono border border-cyan-700/30">
                                    {d.refCode}
                                  </span>
                                )}
                                <span className="truncate">
                                  {d.title || d.id}
                                </span>
                                {!d.refCode && (
                                  <span className="ml-2 text-slate-500">
                                    ID: <span className="font-mono">{d.id}</span>
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </details>
              )}
            </div>
          ) : loadingQaAnalyticsDrills ? (
            <div className="text-center py-4 text-sm text-slate-400">Loading QA analytics for drills...</div>
          ) : (
            <div className="text-center py-4 text-sm text-slate-500">Click Refresh to load QA analytics for drills</div>
          )}
        </div>

        {/* Age Group Distribution */}
        <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-1">Sessions by Age Group</h2>
          <p className="text-xs text-slate-500 mb-4">
            Matches Vault behavior: “Sessions” excludes series sessions; “Series Sessions” are counted separately.
          </p>

          {(() => {
            const toMap = (rows: AgeGroupStats[]) =>
              new Map(rows.map((r) => [r.ageGroup, r.count] as const));

            const sessionsMap = toMap(ageGroupStats);
            const seriesMap = toMap(seriesAgeGroupStats);

            const normalizedSessions = VAULT_AGE_GROUPS.map((ag) => ({
              ageGroup: ag,
              count: sessionsMap.get(ag) ?? 0,
            }));
            const normalizedSeries = VAULT_AGE_GROUPS.map((ag) => ({
              ageGroup: ag,
              count: seriesMap.get(ag) ?? 0,
            }));

            const anySessions = normalizedSessions.some((x) => x.count > 0);
            const anySeries = normalizedSeries.some((x) => x.count > 0);

            return (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-slate-300 mb-2">Vault Sessions (non-series)</div>
                <div className="flex flex-wrap gap-3">
                  {normalizedSessions.map((ag) => (
                    <div
                      key={`sessions-${ag.ageGroup}`}
                      className="px-3 py-2 bg-slate-800 rounded-lg border border-slate-700"
                    >
                      <div className="text-xs text-slate-400">{ag.ageGroup}</div>
                      <div className="text-lg font-semibold text-emerald-400">{ag.count}</div>
                    </div>
                  ))}
                </div>
                {!anySessions && (
                  <div className="mt-2 text-sm text-slate-500">All age groups are 0</div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-300 mb-2">Series Sessions</div>
                <div className="flex flex-wrap gap-3">
                  {normalizedSeries.map((ag) => (
                    <div
                      key={`series-${ag.ageGroup}`}
                      className="px-3 py-2 bg-slate-800 rounded-lg border border-slate-700"
                    >
                      <div className="text-xs text-slate-400">{ag.ageGroup}</div>
                      <div className="text-lg font-semibold text-cyan-400">{ag.count}</div>
                    </div>
                  ))}
                </div>
                {!anySeries && (
                  <div className="mt-2 text-sm text-slate-500">All age groups are 0</div>
                )}
              </div>
            </div>
            );
          })()}
        </div>

        {/* New Account Alerts */}
        <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">New Account Alerts</h2>
            <button
              onClick={fetchData}
              className="px-3 py-1 text-xs rounded-lg border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Refresh
            </button>
          </div>
          {accountAlerts.length > 0 ? (
            <div className="space-y-2">
              {accountAlerts.map((alert) => {
                const account = alert.details?.account;
                const source = alert.details?.source || "unknown";
                return (
                  <div
                    key={alert.id}
                    className="rounded-lg border border-slate-700/70 bg-slate-800/40 p-3 text-xs text-slate-300"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-emerald-300">{account?.email || "Unknown email"}</span>
                      <span className="text-slate-500">•</span>
                      <span>{account?.role || "TRIAL"}</span>
                      <span className="text-slate-500">•</span>
                      <span>{account?.subscriptionPlan || "TRIAL"}</span>
                    </div>
                    <div className="mt-1 text-slate-400">
                      Source: <span className="text-slate-300">{source}</span>
                      {account?.createdByEmail && (
                        <>
                          {" "}• Created by: <span className="text-slate-300">{account.createdByEmail}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 text-slate-500">
                      {new Date(alert.createdAt).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No recent account alerts.</div>
          )}
        </div>

        {/* Recent API Calls */}
        <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Recent API Calls</h2>
          {recentMetrics.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                    <th className="pb-2 pr-4">Time</th>
                    <th className="pb-2 pr-4">Operation</th>
                    <th className="pb-2 pr-4">Model</th>
                    <th className="pb-2 pr-4">Tokens</th>
                    <th className="pb-2 pr-4">Cost</th>
                    <th className="pb-2 pr-4">Duration</th>
                    <th className="pb-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMetrics.map((m) => (
                    <tr key={m.id} className="border-b border-slate-800/50">
                      <td className="py-2 pr-4 text-slate-400">
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 pr-4 capitalize">{getOperationLabel(m.operationType)}</td>
                      <td className="py-2 pr-4 text-xs text-slate-500">
                        {m.model.replace("gemini-", "").replace("-preview", "")}
                      </td>
                      <td className="py-2 pr-4">
                        {m.totalTokens ? formatNumber(m.totalTokens) : "-"}
                      </td>
                      <td className="py-2 pr-4 text-emerald-400 text-xs">
                        {calculateRowCost(m.promptTokens, m.completionTokens)}
                      </td>
                      <td className="py-2 pr-4">{formatDuration(m.durationMs)}</td>
                      <td className="py-2 pr-4">
                        {m.success ? (
                          <span className="text-emerald-400">✓</span>
                        ) : (
                          <span className="text-red-400" title={m.errorMessage || ""}>✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No recent API calls recorded</div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 pt-4 border-t border-slate-800">
          TacticalEdge Admin Dashboard • Data refreshes {autoRefresh ? "every 10s" : "on demand"}
        </div>
      </div>

      {/* Session View Modal (similar to vault) */}
      {viewingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-700/70 bg-slate-900/90 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-lg font-semibold text-slate-200">{viewingSession.title}</h2>
                  {viewingSession.refCode && (
                    <button
                      onClick={() => navigator.clipboard.writeText(viewingSession.refCode!)}
                      className="px-2 py-1 rounded bg-cyan-900/40 text-cyan-300 text-xs font-mono border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors"
                      title="Click to copy reference code"
                    >
                      {viewingSession.refCode}
                    </button>
                  )}
                  <button
                    onClick={toggleViewingSessionFavorite}
                    disabled={checkingFavorite}
                    className={`w-7 h-7 flex items-center justify-center rounded border transition-colors disabled:opacity-50 ${
                      viewingSessionIsFavorited
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30"
                        : "bg-slate-800/50 border-slate-600/50 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400"
                    }`}
                    title={viewingSessionIsFavorited ? "Remove from favorites" : "Add to favorites"}
                  >
                    <span className="text-sm font-bold">■</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs uppercase tracking-wide">Game Model:</span>
                    <span className="text-emerald-400">{gameModelLabel[viewingSession.gameModelId] || viewingSession.gameModelId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs uppercase tracking-wide">Age:</span>
                    <span className="text-slate-200">{viewingSession.ageGroup}</span>
                  </div>
                  {viewingSession.phase && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Phase:</span>
                      <span className="text-slate-200">{phaseLabel[viewingSession.phase] || viewingSession.phase}</span>
                    </div>
                  )}
                  {viewingSession.zone && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Zone:</span>
                      <span className="text-slate-200">{zoneLabel[viewingSession.zone] || viewingSession.zone}</span>
                    </div>
                  )}
                  {viewingSession.formationUsed && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Formation:</span>
                      <span className="text-blue-300">{viewingSession.formationUsed}</span>
                    </div>
                  )}
                  {viewingSession.coachLevel && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Coach Level:</span>
                      <span className="text-amber-300">{coachLevelLabel[viewingSession.coachLevel] || viewingSession.coachLevel}</span>
                    </div>
                  )}
                  {viewingSession.playerLevel && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Player Level:</span>
                      <span className="text-purple-300">{playerLevelLabel[viewingSession.playerLevel] || viewingSession.playerLevel}</span>
                    </div>
                  )}
                  {(viewingSession.numbersMin || viewingSession.numbersMax) && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Players:</span>
                      <span className="text-cyan-300">
                        {viewingSession.numbersMin === viewingSession.numbersMax 
                          ? `${viewingSession.numbersMin}`
                          : `${viewingSession.numbersMin || '?'}-${viewingSession.numbersMax || '?'}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewingSession(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {viewingSession.json?.summary && (
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">Summary</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {viewingSession.json.summary}
                  </p>
                </div>
              )}

              {viewingSession.json?.drills && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold tracking-[0.18em] text-emerald-400 uppercase">Drills</h3>
                  {viewingSession.json.drills.map((drill: any, i: number) => {
                    const diagram = drill.diagram ?? drill.json?.diagram ?? drill.json?.diagramV1;
                    const description = drill.description ?? drill.json?.description;
                    const organization = drill.organization ?? drill.json?.organization;

                    return (
                    <div key={i} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                        
                        <div className="space-y-2">
                          {description && (
                            <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-4">{description}</p>
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
                <Link
                  href={`/demo/session?sessionId=${viewingSession.id}`}
                  className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  View Full Session
                </Link>
                <button
                  onClick={() => setViewingSession(null)}
                  className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drill View Modal */}
      {viewingDrill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-700/70 bg-slate-900/90 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-lg font-semibold text-slate-200">
                    {viewingDrill.title || viewingDrill.json?.title || "Untitled Drill"}
                  </h2>
                  {viewingDrill.refCode && (
                    <button
                      onClick={() => navigator.clipboard.writeText(viewingDrill.refCode)}
                      className="px-2 py-1 rounded bg-cyan-900/40 text-cyan-300 text-xs font-mono border border-cyan-700/30 hover:bg-cyan-900/60 transition-colors"
                      title="Click to copy reference code"
                    >
                      {viewingDrill.refCode}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  {viewingDrill.gameModelId && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Game Model:</span>
                      <span className="text-emerald-400">{gameModelLabel[viewingDrill.gameModelId] || viewingDrill.gameModelId}</span>
                    </div>
                  )}
                  {viewingDrill.ageGroup && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Age:</span>
                      <span className="text-slate-200">{viewingDrill.ageGroup}</span>
                    </div>
                  )}
                  {viewingDrill.phase && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Phase:</span>
                      <span className="text-slate-200">{phaseLabel[viewingDrill.phase] || viewingDrill.phase}</span>
                    </div>
                  )}
                  {viewingDrill.zone && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Zone:</span>
                      <span className="text-slate-200">{zoneLabel[viewingDrill.zone] || viewingDrill.zone}</span>
                    </div>
                  )}
                  {(viewingDrill.numbersMin || viewingDrill.numbersMax) && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Players:</span>
                      <span className="text-cyan-300">
                        {viewingDrill.numbersMin === viewingDrill.numbersMax 
                          ? `${viewingDrill.numbersMin}`
                          : `${viewingDrill.numbersMin || '?'}-${viewingDrill.numbersMax || '?'}`}
                      </span>
                    </div>
                  )}
                  {viewingDrill.durationMin && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs uppercase tracking-wide">Duration:</span>
                      <span className="text-amber-300">{viewingDrill.durationMin} min</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewingDrill(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {/* Drill Diagram */}
              {(viewingDrill.json?.diagram || viewingDrill.json?.diagramV1) && (
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3">Diagram</h3>
                  <div className="flex items-center justify-center">
                    <UniversalDrillDiagram
                      drillData={tacticalEdgeToUniversalDrillData(
                        viewingDrill.json.diagram ?? viewingDrill.json.diagramV1,
                        {
                          title: viewingDrill.json.title ?? viewingDrill.title ?? "Diagram",
                          description: viewingDrill.json.description,
                          organization: viewingDrill.json.organization,
                        }
                      )}
                      size="small"
                    />
                  </div>
                </div>
              )}

              {/* Description */}
              {viewingDrill.json?.description && (
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">Description</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {viewingDrill.json.description}
                  </p>
                </div>
              )}

              {/* Organization */}
              {viewingDrill.json?.organization && (
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">Organization</h3>
                  {typeof viewingDrill.json.organization === 'string' ? (
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {viewingDrill.json.organization}
                    </p>
                  ) : viewingDrill.json.organization.setupSteps ? (
                    <div className="space-y-2">
                      {viewingDrill.json.organization.setupSteps && (
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase">Setup Steps:</span>
                          <ol className="text-sm text-slate-300 mt-1 list-decimal list-inside space-y-1">
                            {viewingDrill.json.organization.setupSteps.map((step: string, i: number) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {viewingDrill.json.organization.area && (
                        <div className="text-sm text-slate-300">
                          <span className="text-[10px] text-slate-500 uppercase">Area: </span>
                          {viewingDrill.json.organization.area.lengthYards && viewingDrill.json.organization.area.widthYards
                            ? `${viewingDrill.json.organization.area.lengthYards} x ${viewingDrill.json.organization.area.widthYards} yards`
                            : JSON.stringify(viewingDrill.json.organization.area)}
                        </div>
                      )}
                      {viewingDrill.json.organization.rotation && (
                        <div className="text-sm text-slate-300">
                          <span className="text-[10px] text-slate-500 uppercase">Rotation: </span>
                          {viewingDrill.json.organization.rotation}
                        </div>
                      )}
                      {viewingDrill.json.organization.restarts && (
                        <div className="text-sm text-slate-300">
                          <span className="text-[10px] text-slate-500 uppercase">Restarts: </span>
                          {viewingDrill.json.organization.restarts}
                        </div>
                      )}
                      {viewingDrill.json.organization.scoring && (
                        <div className="text-sm text-slate-300">
                          <span className="text-[10px] text-slate-500 uppercase">Scoring: </span>
                          {viewingDrill.json.organization.scoring}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Coaching Points */}
              {viewingDrill.json?.coachingPoints && viewingDrill.json.coachingPoints.length > 0 && (
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">Coaching Points</h3>
                  <ul className="text-sm text-slate-300 space-y-1">
                    {viewingDrill.json.coachingPoints.map((point: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Progressions */}
              {viewingDrill.json?.progressions && viewingDrill.json.progressions.length > 0 && (
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">Progressions</h3>
                  <ul className="text-sm text-slate-300 space-y-1">
                    {viewingDrill.json.progressions.map((progression: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-cyan-400 mt-1">{i + 1}.</span>
                        <span>{progression}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-700/50">
                <Link
                  href={`/demo/drill?drillId=${viewingDrill.id || viewingDrill.refCode}`}
                  className="inline-flex items-center rounded-full border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                >
                  View Full Drill
                </Link>
                <button
                  onClick={() => setViewingDrill(null)}
                  className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
