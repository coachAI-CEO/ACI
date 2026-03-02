import { Router } from "express";
import { z } from "zod";
import { authenticate, AuthRequest } from "./middleware/auth";
import { canAccessVideoReview } from "./services/access-permissions";
import { buildVideoAnalysisPrompt } from "./prompts/video-analysis";
import { prisma } from "./prisma";
import { createHash } from "crypto";

const r = Router();

// Require auth for video analysis flows
r.use(authenticate);
r.use(async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }
    const allowed = await canAccessVideoReview(req.userId, req.user?.coachLevel || null);
    if (!allowed) {
      return res.status(403).json({
        ok: false,
        error: "Video review access is disabled for your account.",
      });
    }
    return next();
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || "Permission check failed" });
  }
});

const VideoAnalysisRunRequestSchema = z.object({
  ageGroup: z.string().min(1),
  playerLevel: z.string().min(1),
  coachLevel: z.string().min(1),
  formationUsed: z.string().min(1),
  gameModelId: z.enum(["COACHAI", "POSSESSION", "PRESSING", "TRANSITION"]),
  phase: z.enum(["ATTACKING", "DEFENDING", "TRANSITION"]),
  zone: z.enum(["DEFENSIVE_THIRD", "MIDDLE_THIRD", "ATTACKING_THIRD"]),
  focusTeamColor: z.string().min(1),
  opponentTeamColor: z.string().min(1).optional(),
  fileUri: z.string().url().optional(),
  minItems: z.number().int().min(12).max(80).optional(),
  maxItems: z.number().int().min(12).max(80).optional(),
  dryRun: z.boolean().optional(),
  forceRefresh: z.boolean().optional(),
  model: z.string().min(1).optional(),
});

const VideoAnalysisVaultSaveSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  ageGroup: z.string().min(1),
  playerLevel: z.string().min(1),
  coachLevel: z.string().min(1),
  gameModelId: z.string().min(1),
  phase: z.string().min(1),
  zone: z.string().min(1),
  focusTeamColor: z.string().min(1),
  opponentTeamColor: z.string().min(1),
  sourceFileUri: z.string().url().optional(),
  fileUriUsed: z.string().optional(),
  model: z.string().optional(),
  analysis: z.any(),
  context: z.any().optional(),
});

const ALLOWED_AGE_GROUPS = new Set([
  "U8",
  "U10",
  "U12",
  "U14",
  "U16",
  "U18",
  "Adult",
  "U8 Girls",
  "U10 Girls",
  "U12 Girls",
  "U14 Girls",
  "U16 Girls",
  "U18 Girls",
  "U8 Boys",
  "U10 Boys",
  "U12 Boys",
  "U14 Boys",
  "U16 Boys",
  "U18 Boys",
]);

const ALLOWED_TEAM_COLORS = new Set(["blue", "red", "white", "black", "yellow", "green"]);
const ALLOWED_COACH_LEVELS = new Set(["GRASSROOTS", "USSF_C", "USSF_B_PLUS"]);
const ALLOWED_PLAYER_LEVELS = new Set(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const REF_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const VIDEO_ANALYSIS_PROMPT_VERSION = "2026-02-21-v2";

const AGE_GROUP_ALIASES: Record<string, string> = {
  U8: "U8",
  U9: "U8",
  U10: "U10",
  U11: "U10",
  U12: "U12",
  U13: "U12",
  U14: "U14",
  U15: "U14",
  U16: "U16",
  U17: "U16",
  U18: "U18",
  ADULT: "Adult",
  "U8_GIRLS": "U8 Girls",
  "U10_GIRLS": "U10 Girls",
  "U12_GIRLS": "U12 Girls",
  "U14_GIRLS": "U14 Girls",
  "U16_GIRLS": "U16 Girls",
  "U18_GIRLS": "U18 Girls",
  "U8_BOYS": "U8 Boys",
  "U10_BOYS": "U10 Boys",
  "U12_BOYS": "U12 Boys",
  "U14_BOYS": "U14 Boys",
  "U16_BOYS": "U16 Boys",
  "U18_BOYS": "U18 Boys",
};

function normalizeCoachLevel(value: unknown): string {
  const v = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (v === "USSF_B_PLUS" || v === "USSF_B+" || v === "USSF_B") return "USSF_B_PLUS";
  if (v === "USSF_C") return "USSF_C";
  if (v === "GRASSROOTS") return "GRASSROOTS";
  return v;
}

function normalizePlayerLevel(value: unknown): string {
  const v = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (v === "BEGINNER") return "BEGINNER";
  if (v === "INTERMEDIATE") return "INTERMEDIATE";
  if (v === "ADVANCED") return "ADVANCED";
  return v;
}

function normalizeFormationUsed(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[xX]/g, "-");
}

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

function getValidFormationsForAgeGroup(ageGroup: string): string[] {
  const bucket = getFormationBucketAge(ageGroup);
  if (["U8", "U9", "U10", "U11", "U12"].includes(bucket)) return ["2-3-1", "3-2-1"];
  if (["U13", "U14"].includes(bucket)) return ["3-2-3", "2-3-2-1", "3-3-2"];
  return ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"];
}

function normalizeAgeGroup(value: unknown): string {
  const raw = String(value || "").trim();
  if (ALLOWED_AGE_GROUPS.has(raw)) return raw;
  const key = raw.toUpperCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (AGE_GROUP_ALIASES[key]) return AGE_GROUP_ALIASES[key];
  return raw;
}

function formatEnumTitle(value: string): string {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function formatGameModelTitle(value: string): string {
  const upper = String(value || "").toUpperCase();
  if (upper === "COACHAI") return "Balanced";
  return formatEnumTitle(upper);
}

function generateRandomRefChunk(length: number = 4): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += REF_CHARSET[Math.floor(Math.random() * REF_CHARSET.length)];
  }
  return out;
}

async function generateVideoAnalysisRefCode(): Promise<string> {
  const prefix = "VA";
  for (let i = 0; i < 10; i++) {
    const code = `${prefix}-${generateRandomRefChunk(4)}`;
    try {
      const existing = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "id" FROM "VideoAnalysisVault" WHERE "refCode" = $1 LIMIT 1`,
        code
      );
      if (!existing || existing.length === 0) return code;
    } catch {
      // If the vault table is not ready yet, return a generated code and let the caller handle persistence errors.
      return code;
    }
  }
  const suffix = Date.now().toString(36).toUpperCase().slice(-2);
  return `${prefix}-${generateRandomRefChunk(2)}${suffix}`;
}

function isVaultTableMissingError(error: unknown): boolean {
  const message = String((error as any)?.message || "");
  return (
    (message.includes("42P01") && message.includes("VideoAnalysisVault")) ||
    message.includes('relation "VideoAnalysisVault" does not exist')
  );
}

function isGeminiFileUri(uri: string): boolean {
  return /generativelanguage\.googleapis\.com\/v1beta\/files\//i.test(uri);
}

async function uploadExternalVideoToGemini(sourceUrl: string, apiKey: string): Promise<string> {
  const MAX_FALLBACK_BYTES = 200 * 1024 * 1024; // 200 MB

  const sourceRes = await fetch(sourceUrl);
  if (!sourceRes.ok) {
    throw new Error(`SOURCE_VIDEO_FETCH_FAILED (${sourceRes.status})`);
  }

  const contentType = sourceRes.headers.get("content-type") || "video/mp4";
  const fileName = sourceUrl.split("/").pop() || "video_input.mp4";

  // Determine content length before consuming the body.
  const rawCL = sourceRes.headers.get("content-length");
  const parsedCL = rawCL ? parseInt(rawCL, 10) : null;

  let knownLength: number;
  let uploadBody: ReadableStream | Uint8Array;

  if (parsedCL !== null && Number.isFinite(parsedCL) && parsedCL > 0) {
    // Happy path: stream directly without buffering.
    knownLength = parsedCL;
    uploadBody = sourceRes.body!;
  } else {
    // Fallback: no content-length header — buffer, but guard against OOM.
    const ab = await sourceRes.arrayBuffer();
    if (ab.byteLength > MAX_FALLBACK_BYTES) {
      throw new Error(
        `SOURCE_VIDEO_TOO_LARGE_FOR_FALLBACK (${ab.byteLength} bytes > ${MAX_FALLBACK_BYTES})`
      );
    }
    knownLength = ab.byteLength;
    uploadBody = new Uint8Array(ab);
  }

  const startRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(knownLength),
      "X-Goog-Upload-Header-Content-Type": contentType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file: {
        display_name: `video-analysis-${fileName}`.slice(0, 120),
      },
    }),
  });

  if (!startRes.ok) {
    const payload = await startRes.text().catch(() => "");
    throw new Error(`GEMINI_UPLOAD_START_FAILED (${startRes.status}) ${payload}`);
  }

  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error("GEMINI_UPLOAD_URL_MISSING");
  }

  const finalizeRes = await (fetch as any)(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(knownLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: uploadBody,
    duplex: "half",
  });

  const finalizePayload: any = await finalizeRes.json().catch(() => ({}));
  if (!finalizeRes.ok) {
    throw new Error(`GEMINI_UPLOAD_FINALIZE_FAILED (${finalizeRes.status})`);
  }

  const uri = finalizePayload?.file?.uri;
  if (!uri) {
    throw new Error("GEMINI_FILE_URI_MISSING");
  }

  return uri;
}

async function waitForGeminiFileActive(fileUri: string, apiKey: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const fileMetaRes = await fetch(`${fileUri}?key=${apiKey}`);
    const fileMeta = await fileMetaRes.json().catch(() => ({}));
    const state = fileMeta?.state || fileMeta?.file?.state;
    if (fileMetaRes.ok && state === "ACTIVE") return;
    if (state === "FAILED") {
      throw new Error("GEMINI_FILE_PROCESSING_FAILED");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("GEMINI_FILE_ACTIVE_TIMEOUT");
}

function parseJsonSafe(text: string) {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return null;
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function clampCoord(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Number(n.toFixed(2));
}

function abbreviateRole(role: string): string {
  const words = String(role || "").trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return "P";
  const abbrev = words.map((w) => w[0].toUpperCase()).join("").replace(/[^A-Z0-9]/g, "");
  return abbrev.length > 0 ? abbrev : "P";
}

function normalizeDiagramFrames(rawFrames: unknown): any[] {
  if (!Array.isArray(rawFrames)) return [];
  return rawFrames
    .map((f: any, idx: number) => {
      const frameId = String(f?.frameId || `frame_${idx + 1}`);
      const timestamp = String(f?.timestamp || "n/a");
      const orientation = String(f?.pitch?.orientation || "HORIZONTAL").toUpperCase() === "VERTICAL"
        ? "VERTICAL"
        : "HORIZONTAL";
      const players = Array.isArray(f?.players)
        ? f.players
            .map((p: any, pidx: number) => {
              const team = String(p?.team || "A").toUpperCase() === "B" ? "B" : "A";
              const role = String(p?.role || "player");
              const stableId = p?.id
                ? String(p.id)
                : `${team}_${abbreviateRole(role)}_${pidx + 1}`;
              return {
                id: stableId,
                team,
                role,
                jersey: null,
                x: clampCoord(p?.x),
                y: clampCoord(p?.y),
              };
            })
            .slice(0, 30)
        : [];
      const ball = {
        x: clampCoord(f?.ball?.x),
        y: clampCoord(f?.ball?.y),
      };
      const arrows = Array.isArray(f?.arrows)
        ? f.arrows
            .map((a: any) => ({
              type: ["PASS", "RUN", "PRESS"].includes(String(a?.type || "").toUpperCase())
                ? String(a.type).toUpperCase()
                : "PASS",
              from: { x: clampCoord(a?.from?.x), y: clampCoord(a?.from?.y) },
              to: { x: clampCoord(a?.to?.x), y: clampCoord(a?.to?.y) },
              team: String(a?.team || "A").toUpperCase() === "B" ? "B" : "A",
            }))
            .slice(0, 20)
        : [];
      return {
        frameId,
        timestamp,
        coordinateSystem: { unit: "PERCENT_0_100", origin: "TOP_LEFT" },
        pitch: { orientation },
        players,
        ball,
        arrows,
        notes: String(f?.notes || ""),
      };
    })
    .slice(0, 15);
}

function stripJerseyNumberMentions(value: unknown): string {
  const raw = String(value ?? "");
  return raw
    .replace(/\b(team\s*[ab]\s*(?:player|attacker|defender|midfielder|winger|forward|striker|keeper|goalkeeper)\s*)#\d+\b/gi, "$1")
    .replace(/\b(team\s*[ab])\s*#\d+\b/gi, "$1")
    .replace(/\b(player|attacker|defender|midfielder|winger|forward|striker|keeper|goalkeeper)\s*#\d+\b/gi, "$1")
    .replace(/\bjersey\s*(?:number\s*)?#?\d+\b/gi, "role")
    .replace(/(^|\s)#\d+\b/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function scrubAnalysisNumberBias(analysis: any): any {
  if (!analysis || typeof analysis !== "object") return analysis;
  const out = { ...analysis };
  const scrubFields = [
    "summary",
    "scopeSummary",
    "title",
    "whatHappened",
    "teamAImplication",
    "whyItMatters",
    "coachingCue",
    "microCorrection",
    "u10Adaptation",
    "notes",
  ];

  if (out.overall && typeof out.overall === "object") {
    out.overall = { ...out.overall };
    for (const key of scrubFields) {
      if (typeof (out.overall as any)[key] === "string") {
        (out.overall as any)[key] = stripJerseyNumberMentions((out.overall as any)[key]);
      }
    }
    if (Array.isArray((out.overall as any).topPriorities)) {
      (out.overall as any).topPriorities = (out.overall as any).topPriorities.map((v: any) =>
        stripJerseyNumberMentions(v)
      );
    }
    if (Array.isArray((out.overall as any).videoQualityRisks)) {
      (out.overall as any).videoQualityRisks = (out.overall as any).videoQualityRisks.map((v: any) =>
        stripJerseyNumberMentions(v)
      );
    }
  }

  if (Array.isArray(out.analysisArray)) {
    out.analysisArray = out.analysisArray.map((item: any) => {
      const next = { ...item };
      for (const key of scrubFields) {
        if (typeof next[key] === "string") next[key] = stripJerseyNumberMentions(next[key]);
      }
      return next;
    });
  }

  if (Array.isArray(out.diagramFrames)) {
    out.diagramFrames = out.diagramFrames.map((frame: any) => {
      const next = { ...frame };
      if (typeof next.notes === "string") next.notes = stripJerseyNumberMentions(next.notes);
      if (Array.isArray(next.players)) {
        next.players = next.players.map((player: any, pidx: number) => {
          const team = String(player?.team || "A").toUpperCase() === "B" ? "B" : "A";
          const role = String(player?.role || "player");
          const stableId = player?.id
            ? String(player.id)
            : `${team}_${abbreviateRole(role)}_${pidx + 1}`;
          return {
            ...player,
            id: stableId,
            team,
            role: stripJerseyNumberMentions(role),
            jersey: null,
          };
        });
      }
      return next;
    });
  }

  return out;
}

function inferTeamFocus(item: any): "TEAM_A" | "TEAM_B" | "BOTH" | "UNSPECIFIED" {
  const explicit = String(item?.teamFocus || "").toUpperCase();
  if (explicit === "TEAM_A" || explicit === "TEAM_B" || explicit === "BOTH" || explicit === "UNSPECIFIED") {
    return explicit as any;
  }
  const text = `${item?.title || ""} ${item?.whatHappened || ""} ${item?.whyItMatters || ""}`.toLowerCase();
  const hasA = /\bteam\s*a\b/.test(text);
  const hasB = /\bteam\s*b\b/.test(text);
  if (hasA && hasB) return "BOTH";
  if (hasA) return "TEAM_A";
  if (hasB) return "TEAM_B";
  return "UNSPECIFIED";
}

function normalizeAnalysisForDiagram(rawAnalysis: any): any {
  const out = rawAnalysis && typeof rawAnalysis === "object" ? { ...rawAnalysis } : {};
  const frames = normalizeDiagramFrames((out as any).diagramFrames);
  const frameIdSet = new Set(frames.map((f) => f.frameId));
  const validScopeTags = new Set(["IN_SCOPE", "SUPPORTING", "OUT_OF_SCOPE"]);
  const validCategories = new Set(["technical", "tactical", "decision-making", "physical"]);
  const validSeverities = new Set(["critical", "major", "minor"]);
  const analysisArray = Array.isArray((out as any).analysisArray)
    ? (out as any).analysisArray.map((item: any, idx: number) => {
        const sourceIds = Array.isArray(item?.diagramFrameIds) ? item.diagramFrameIds : [];
        const validIds = sourceIds
          .map((x: any) => String(x))
          .filter((id: string) => frameIdSet.has(id));
        const fallbackId = frames[0]?.frameId;
        const teamFocus = inferTeamFocus(item);
        const rawScope = String(item?.scopeTag || "").toUpperCase();
        const scopeTag = validScopeTags.has(rawScope) ? rawScope : teamFocus === "TEAM_A" || teamFocus === "BOTH" ? "IN_SCOPE" : "SUPPORTING";
        const rawCategory = String(item?.category || "").toLowerCase();
        const category = validCategories.has(rawCategory) ? rawCategory : "tactical";
        const rawSeverity = String(item?.severity || "").toLowerCase();
        const severity = validSeverities.has(rawSeverity) ? rawSeverity : "major";
        const teamAImplicationRaw = String(item?.teamAImplication || "").trim();
        const whatHappened = String(item?.whatHappened || "").trim() || String(item?.title || "").trim() || "Observed tactical event.";
        const title = String(item?.title || "").trim() || `Observation ${idx + 1}`;
        const whyItMatters = String(item?.whyItMatters || "").trim() || "This affects Team A tactical execution and development outcomes.";
        const coachingCue = String(item?.coachingCue || "").trim() || "Freeze, reset shape, and coach the next action.";
        const microCorrection = String(item?.microCorrection || "").trim() || "Reposition by 2-3 yards and repeat under guided pressure.";
        const u10Adaptation = String(item?.u10Adaptation || "").trim() || "Use one simple cue and short repetitions.";
        const derivedImplication =
          whyItMatters ||
          coachingCue ||
          "Translate this opponent action into a Team A tactical adjustment.";
        const confidenceRaw = Number(item?.confidence);
        const confidence = Number.isFinite(confidenceRaw)
          ? Math.max(0, Math.min(1, Number(confidenceRaw.toFixed(2))))
          : 0.75;
        const timestamp = String(item?.timestamp || "").trim() || String(frames[idx % Math.max(1, frames.length)]?.timestamp || "n/a");
        return {
          ...item,
          id: String(item?.id || `obs_${idx + 1}`),
          category,
          scopeTag,
          teamFocus,
          title,
          severity,
          confidence,
          timestamp,
          whatHappened,
          teamAImplication:
            teamFocus === "TEAM_B"
              ? teamAImplicationRaw || derivedImplication
              : teamAImplicationRaw,
          whyItMatters,
          coachingCue,
          microCorrection,
          u10Adaptation,
          diagramFrameIds: validIds.length > 0 ? validIds : fallbackId ? [fallbackId] : [],
        };
      })
    : [];

  out.diagramFrames = frames;
  out.analysisArray = analysisArray;
  return out;
}

function normalizeSourceFileUri(uri: string): string {
  const trimmed = String(uri || "").trim();
  try {
    return new URL(trimmed).toString();
  } catch {
    return trimmed;
  }
}

function buildVideoAnalysisCacheKey(input: {
  sourceFileUri: string;
  model: string;
  promptVersion: string;
  ageGroup: string;
  playerLevel: string;
  coachLevel: string;
  formationUsed: string;
  gameModelId: string;
  phase: string;
  zone: string;
  focusTeamColor: string;
  opponentTeamColor: string;
  minItems: number;
  maxItems: number;
}): string {
  const serialized = JSON.stringify({
    v: 1,
    sourceFileUri: input.sourceFileUri,
    model: input.model,
    promptVersion: input.promptVersion,
    ageGroup: input.ageGroup,
    playerLevel: input.playerLevel,
    coachLevel: input.coachLevel,
    formationUsed: input.formationUsed,
    gameModelId: input.gameModelId,
    phase: input.phase,
    zone: input.zone,
    focusTeamColor: input.focusTeamColor,
    opponentTeamColor: input.opponentTeamColor,
    minItems: input.minItems,
    maxItems: input.maxItems,
  });
  return createHash("sha256").update(serialized).digest("hex");
}

function buildAnalysisContract(input: {
  promptVersion: string;
  ageGroup: string;
  playerLevel: string;
  coachLevel: string;
  formationUsed: string;
  gameModelId: string;
  phase: string;
  zone: string;
  focusTeamColor: string;
  opponentTeamColor: string;
  minItems: number;
  maxItems: number;
}) {
  return {
    promptVersion: input.promptVersion,
    ageGroup: input.ageGroup,
    playerLevel: input.playerLevel,
    coachLevel: input.coachLevel,
    formationUsed: input.formationUsed,
    gameModelId: input.gameModelId,
    phase: input.phase,
    zone: input.zone,
    focusTeamColor: input.focusTeamColor,
    opponentTeamColor: input.opponentTeamColor,
    namingPolicy: "ANONYMIZED_TEAM_LABELS_ONLY",
    teamLabels: {
      focusTeam: "Team A",
      opponentTeam: "Team B",
    },
    itemRange: { minItems: input.minItems, maxItems: input.maxItems },
  };
}

function isMissingVideoCacheTableError(err: any): boolean {
  const msg = String(err?.message || "");
  const code = String(err?.code || "");
  return code === "P2021" || msg.includes("VideoAnalysisCache") || msg.includes("does not exist");
}

function getMatchFormatFromFormation(formationUsed: string): string {
  const nums = String(formationUsed || "")
    .split("-")
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const outfield = nums.reduce((sum, n) => sum + n, 0);
  const total = outfield + 1; // include GK
  if (total <= 7) return "7v7";
  if (total <= 9) return "9v9";
  return "11v11";
}

function normalizeTeamLabels(
  analysis: any,
  focusTeamColor: string,
  opponentTeamColor: string,
  formationUsed: string
) {
  const out = analysis && typeof analysis === "object" ? analysis : {};
  out.context = {
    ...(out.context || {}),
    focusTeamColor,
    opponentTeamColor,
    formationUsed,
  };
  out.teamDefinition = {
    ...(out.teamDefinition || {}),
    matchFormat: getMatchFormatFromFormation(formationUsed),
    focusTeam: {
      ...((out.teamDefinition as any)?.focusTeam || {}),
      label: "Team A",
      color: focusTeamColor,
      formation: formationUsed,
    },
    opponentTeam: {
      ...((out.teamDefinition as any)?.opponentTeam || {}),
      label: "Team B",
      color: opponentTeamColor,
      formation: formationUsed,
    },
    namingPolicy: "No personal names. Use team labels and role descriptions only (no jersey numbers).",
  };
  return out;
}

async function storeVideoMetric(data: {
  userId?: string;
  model: string;
  promptLength: number;
  responseLength: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  ageGroup?: string;
  gameModelId?: string;
  phase?: string;
}) {
  try {
    await prisma.apiMetrics.create({
      data: {
        operationType: "video_analysis",
        userId: data.userId,
        model: data.model,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,
        promptLength: data.promptLength,
        responseLength: data.responseLength,
        durationMs: data.durationMs,
        success: data.success,
        errorMessage: data.errorMessage,
        ageGroup: data.ageGroup,
        gameModelId: data.gameModelId,
        phase: data.phase,
      },
    });
  } catch (e: any) {
    // Metrics should never block generation flow
    console.error("[VIDEO_METRICS] Failed to store metrics:", e?.message || String(e));
  }
}

r.post("/ai/video-analysis/run", async (req: AuthRequest, res) => {
  const parsed = VideoAnalysisRunRequestSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_INPUT",
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
    });
  }

  const input = parsed.data;
  const normalized = {
    ...input,
    ageGroup: normalizeAgeGroup(input.ageGroup),
    playerLevel: normalizePlayerLevel(input.playerLevel),
    coachLevel: normalizeCoachLevel(input.coachLevel),
    formationUsed: normalizeFormationUsed(input.formationUsed),
    focusTeamColor: String(input.focusTeamColor || "").trim().toLowerCase(),
    opponentTeamColor: input.opponentTeamColor
      ? String(input.opponentTeamColor).trim().toLowerCase()
      : undefined,
  };
  const allowedFormations = getValidFormationsForAgeGroup(normalized.ageGroup);
  const formationUsed = normalized.formationUsed;

  if (!ALLOWED_AGE_GROUPS.has(normalized.ageGroup)) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_AGE_GROUP",
      details: {
        message: `ageGroup must be one of: ${Array.from(ALLOWED_AGE_GROUPS).join(", ")}`,
      },
    });
  }

  if (!ALLOWED_TEAM_COLORS.has(normalized.focusTeamColor)) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_FOCUS_TEAM_COLOR",
      details: {
        message: `focusTeamColor must be one of: ${Array.from(ALLOWED_TEAM_COLORS).join(", ")}`,
      },
    });
  }

  if (normalized.opponentTeamColor && !ALLOWED_TEAM_COLORS.has(normalized.opponentTeamColor)) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_OPPONENT_TEAM_COLOR",
      details: {
        message: `opponentTeamColor must be one of: ${Array.from(ALLOWED_TEAM_COLORS).join(", ")}`,
      },
    });
  }

  if (!ALLOWED_COACH_LEVELS.has(normalized.coachLevel)) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_COACH_LEVEL",
      details: {
        message: `coachLevel must be one of: ${Array.from(ALLOWED_COACH_LEVELS).join(", ")}`,
      },
    });
  }

  if (!ALLOWED_PLAYER_LEVELS.has(normalized.playerLevel)) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_PLAYER_LEVEL",
      details: {
        message: `playerLevel must be one of: ${Array.from(ALLOWED_PLAYER_LEVELS).join(", ")}`,
      },
    });
  }
  if (!allowedFormations.includes(formationUsed)) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_FORMATION_FOR_AGE",
      details: {
        message: `formationUsed must be one of: ${allowedFormations.join(", ")} for ageGroup=${normalized.ageGroup}`,
      },
    });
  }
  const minItems = input.minItems ?? 28;
  const maxItems = input.maxItems ?? 40;
  if (minItems > maxItems) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_RANGE",
      details: [{ path: "minItems", message: "minItems cannot be greater than maxItems" }],
    });
  }

  const prompt = buildVideoAnalysisPrompt({
    ageGroup: normalized.ageGroup,
    playerLevel: normalized.playerLevel,
    coachLevel: normalized.coachLevel,
    formationUsed,
    gameModelId: input.gameModelId,
    phase: input.phase,
    zone: input.zone,
    focusTeamColor: normalized.focusTeamColor,
    opponentTeamColor: normalized.opponentTeamColor,
    minItems,
    maxItems,
  });

  const opponentTeamColor = normalized.opponentTeamColor || "UNKNOWN";
  const modelName = input.model || process.env.GEMINI_MODEL_PRIMARY || "gemini-3-flash-preview";
  const contract = buildAnalysisContract({
    promptVersion: VIDEO_ANALYSIS_PROMPT_VERSION,
    ageGroup: normalized.ageGroup,
    playerLevel: normalized.playerLevel,
    coachLevel: normalized.coachLevel,
    formationUsed,
    gameModelId: input.gameModelId,
    phase: input.phase,
    zone: input.zone,
    focusTeamColor: normalized.focusTeamColor,
    opponentTeamColor,
    minItems,
    maxItems,
  });

  if (input.dryRun) {
    return res.json({
      ok: true,
      stub: true,
      status: "READY_FOR_MODEL_CALL",
      contract,
      prompt,
      fileUri: input.fileUri || null,
    });
  }

  if (!input.fileUri) {
    return res.status(400).json({
      ok: false,
      error: "fileUri is required when dryRun is false",
    });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ ok: false, error: "GEMINI_API_KEY is not configured" });
  }

  const startedAt = Date.now();
  try {
    const sourceFileUriNormalized = normalizeSourceFileUri(input.fileUri);
    const cacheKey = buildVideoAnalysisCacheKey({
      sourceFileUri: sourceFileUriNormalized,
      model: modelName,
      promptVersion: VIDEO_ANALYSIS_PROMPT_VERSION,
      ageGroup: normalized.ageGroup,
      playerLevel: normalized.playerLevel,
      coachLevel: normalized.coachLevel,
      formationUsed,
      gameModelId: input.gameModelId,
      phase: input.phase,
      zone: input.zone,
      focusTeamColor: normalized.focusTeamColor,
      opponentTeamColor,
      minItems,
      maxItems,
    });

    let cached: any = null;
    if (!input.forceRefresh) {
      try {
        cached = await (prisma as any).videoAnalysisCache.findUnique({
          where: { cacheKey },
        });
      } catch (cacheErr: any) {
        if (!isMissingVideoCacheTableError(cacheErr)) {
          console.error("[VIDEO_CACHE] Failed to lookup cache:", cacheErr?.message || String(cacheErr));
        }
      }
    }
    if (cached) {
      await (prisma as any).videoAnalysisCache
        .update({
          where: { id: cached.id },
          data: { hits: { increment: 1 }, lastHitAt: new Date() },
        })
        .catch(() => undefined);
      const cachedAnalysis =
        cached.analysis && typeof cached.analysis === "object" ? (cached.analysis as any) : {};
      const cachedArray = Array.isArray((cachedAnalysis as any).analysisArray)
        ? (cachedAnalysis as any).analysisArray
        : [];
      await storeVideoMetric({
        userId: req.userId,
        model: modelName,
        promptLength: prompt.length,
        responseLength: JSON.stringify(cachedAnalysis).length,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs: Date.now() - startedAt,
        success: true,
        ageGroup: normalized.ageGroup,
        gameModelId: input.gameModelId,
        phase: input.phase,
      });
      return res.json({
        ok: true,
        stub: false,
        cached: true,
        model: modelName,
        contract: cached.contract,
        analysis: cachedAnalysis,
        stats: {
          totalItems: cachedArray.length,
        },
        fileUriUsed: cached.fileUriUsed || input.fileUri,
        cache: {
          key: cached.cacheKey,
          hits: (cached.hits || 0) + 1,
          createdAt: cached.createdAt,
          updatedAt: cached.updatedAt,
        },
      });
    }

    let geminiFileUri = input.fileUri;

    if (!isGeminiFileUri(geminiFileUri)) {
      geminiFileUri = await uploadExternalVideoToGemini(geminiFileUri, key);
      await waitForGeminiFileActive(geminiFileUri, key);
    }

    // Preflight file status for clearer errors when fileUri is stale or not ACTIVE yet.
    const fileMetaRes = await fetch(`${geminiFileUri}?key=${key}`);
    const fileMeta = await fileMetaRes.json().catch(() => ({}));
    const fileState = fileMeta?.state || fileMeta?.file?.state;
    if (!fileMetaRes.ok || (fileState && fileState !== "ACTIVE")) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_OR_INACTIVE_FILE_URI",
        details: {
          fileUri: geminiFileUri,
          status: fileMetaRes.status,
          state: fileState || "unknown",
          message: "Upload the video to Gemini Files API and ensure state is ACTIVE before analysis.",
        },
      });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  file_data: {
                    mime_type: "video/mp4",
                    file_uri: geminiFileUri,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const geminiPayload = await geminiRes.json().catch(() => ({}));
    if (!geminiRes.ok) {
      await storeVideoMetric({
        userId: req.userId,
        model: modelName,
        promptLength: prompt.length,
        responseLength: null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: JSON.stringify(geminiPayload?.error || geminiPayload || { status: geminiRes.status }),
        ageGroup: normalized.ageGroup,
        gameModelId: input.gameModelId,
        phase: input.phase,
      });
      return res.status(500).json({
        ok: false,
        error: "GEMINI_REQUEST_FAILED",
        model: modelName,
        details: geminiPayload?.error || geminiPayload || { status: geminiRes.status },
      });
    }

    const text = geminiPayload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = parseJsonSafe(text);
    if (!parsed) {
      await storeVideoMetric({
        userId: req.userId,
        model: modelName,
        promptLength: prompt.length,
        responseLength: text.length || null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: "MODEL_OUTPUT_PARSE_FAILED",
        ageGroup: normalized.ageGroup,
        gameModelId: input.gameModelId,
        phase: input.phase,
      });
      return res.status(502).json({
        ok: false,
        error: "MODEL_OUTPUT_PARSE_FAILED",
        model: modelName,
        rawPreview: text.slice(0, 1200),
      });
    }

    const analysisWithDiagram = normalizeAnalysisForDiagram(parsed);
    const scrubbedAnalysis = scrubAnalysisNumberBias(analysisWithDiagram);
    const normalizedAnalysis = normalizeTeamLabels(
      scrubbedAnalysis,
      normalized.focusTeamColor,
      opponentTeamColor,
      formationUsed
    );
    const analysisArray = Array.isArray(normalizedAnalysis.analysisArray) ? normalizedAnalysis.analysisArray : [];
    const usage = geminiPayload?.usageMetadata || geminiPayload?.candidates?.[0]?.usageMetadata || {};
    const promptTokens = Number(usage?.promptTokenCount);
    const completionTokens = Number(usage?.candidatesTokenCount);
    const totalTokens = Number(usage?.totalTokenCount);
    await storeVideoMetric({
      userId: req.userId,
      model: modelName,
      promptLength: prompt.length,
      responseLength: text.length || null,
      promptTokens: Number.isFinite(promptTokens) ? promptTokens : null,
      completionTokens: Number.isFinite(completionTokens) ? completionTokens : null,
      totalTokens: Number.isFinite(totalTokens) ? totalTokens : null,
      durationMs: Date.now() - startedAt,
      success: true,
      ageGroup: normalized.ageGroup,
      gameModelId: input.gameModelId,
      phase: input.phase,
    });

    try {
      await (prisma as any).videoAnalysisCache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          sourceFileUri: input.fileUri,
          sourceFileUriNormalized,
          model: modelName,
          ageGroup: normalized.ageGroup,
          playerLevel: normalized.playerLevel,
          coachLevel: normalized.coachLevel,
          gameModelId: input.gameModelId,
          phase: input.phase,
          zone: input.zone,
          focusTeamColor: normalized.focusTeamColor,
          opponentTeamColor,
          minItems,
          maxItems,
          contract,
          analysis: normalizedAnalysis,
          fileUriUsed: geminiFileUri,
          hits: 0,
        },
        update: {
          sourceFileUri: input.fileUri,
          sourceFileUriNormalized,
          model: modelName,
          ageGroup: normalized.ageGroup,
          playerLevel: normalized.playerLevel,
          coachLevel: normalized.coachLevel,
          gameModelId: input.gameModelId,
          phase: input.phase,
          zone: input.zone,
          focusTeamColor: normalized.focusTeamColor,
          opponentTeamColor,
          minItems,
          maxItems,
          contract,
          analysis: normalizedAnalysis,
          fileUriUsed: geminiFileUri,
        },
      });
    } catch (cacheErr: any) {
      if (!isMissingVideoCacheTableError(cacheErr)) {
        console.error("[VIDEO_CACHE] Failed to store cache:", cacheErr?.message || String(cacheErr));
      }
    }

    return res.json({
      ok: true,
      stub: false,
      cached: false,
      model: modelName,
      contract,
      analysis: normalizedAnalysis,
      stats: {
        totalItems: analysisArray.length,
      },
      fileUriUsed: geminiFileUri,
    });
  } catch (e: any) {
    await storeVideoMetric({
      userId: req.userId,
      model: modelName,
      promptLength: prompt.length,
      responseLength: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: e?.message || String(e),
      ageGroup: normalized.ageGroup,
      gameModelId: input.gameModelId,
      phase: input.phase,
    });
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    });
  }
});

r.post("/vault/video-analysis/save", async (req: AuthRequest, res) => {
  const parsed = VideoAnalysisVaultSaveSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_INPUT",
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
    });
  }

  const input = parsed.data;
  const normalized = {
    ...input,
    ageGroup: normalizeAgeGroup(input.ageGroup),
    playerLevel: normalizePlayerLevel(input.playerLevel),
    coachLevel: normalizeCoachLevel(input.coachLevel),
    focusTeamColor: String(input.focusTeamColor || "").trim().toLowerCase(),
    opponentTeamColor: String(input.opponentTeamColor || "").trim().toLowerCase(),
  };

  if (!ALLOWED_AGE_GROUPS.has(normalized.ageGroup)) {
    return res.status(400).json({ ok: false, error: "INVALID_AGE_GROUP" });
  }
  if (!ALLOWED_PLAYER_LEVELS.has(normalized.playerLevel)) {
    return res.status(400).json({ ok: false, error: "INVALID_PLAYER_LEVEL" });
  }
  if (!ALLOWED_COACH_LEVELS.has(normalized.coachLevel)) {
    return res.status(400).json({ ok: false, error: "INVALID_COACH_LEVEL" });
  }
  if (!ALLOWED_TEAM_COLORS.has(normalized.focusTeamColor)) {
    return res.status(400).json({ ok: false, error: "INVALID_FOCUS_TEAM_COLOR" });
  }
  if (!ALLOWED_TEAM_COLORS.has(normalized.opponentTeamColor)) {
    return res.status(400).json({ ok: false, error: "INVALID_OPPONENT_TEAM_COLOR" });
  }

  const autoTitle = [
    normalized.ageGroup,
    "Video Analysis",
    "•",
    formatGameModelTitle(input.gameModelId),
    "/",
    formatEnumTitle(input.phase),
    "/",
    formatEnumTitle(input.zone),
    "•",
    new Date().toISOString().slice(0, 10),
  ].join(" ");

  try {
    const refCode = await generateVideoAnalysisRefCode();
    const analysisContext =
      input.analysis && typeof input.analysis === "object" && (input.analysis as any).context
        ? (input.analysis as any).context
        : {};
    const contextInput = input.context && typeof input.context === "object" ? input.context : {};
    const inferredFormationUsed = String(
      (contextInput as any).formationUsed || (analysisContext as any).formationUsed || ""
    ).trim();
    const payload = {
      refCode,
      userId: req.userId || null,
      title: (input.title || autoTitle).slice(0, 160),
      ageGroup: normalized.ageGroup,
      playerLevel: normalized.playerLevel,
      coachLevel: normalized.coachLevel,
      gameModelId: input.gameModelId,
      phase: input.phase,
      zone: input.zone,
      focusTeamColor: normalized.focusTeamColor,
      opponentTeamColor: normalized.opponentTeamColor,
      sourceFileUri: input.sourceFileUri || null,
      fileUriUsed: input.fileUriUsed || null,
      model: input.model || null,
      analysis: input.analysis ?? {},
      context: {
        ...contextInput,
        ...(inferredFormationUsed ? { formationUsed: inferredFormationUsed } : {}),
      },
    };

    const vaultClient = (prisma as any).videoAnalysisVault;
    let row: any;
    if (vaultClient && typeof vaultClient.create === "function") {
      row = await vaultClient.create({
        data: payload,
      });
    } else {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "VideoAnalysisVault"
        ("refCode","userId","title","ageGroup","playerLevel","coachLevel","gameModelId","phase","zone","focusTeamColor","opponentTeamColor","sourceFileUri","fileUriUsed","model","analysis","context","createdAt","updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,NOW(),NOW())
        RETURNING "id","refCode","title","createdAt"`,
        payload.refCode,
        payload.userId,
        payload.title,
        payload.ageGroup,
        payload.playerLevel,
        payload.coachLevel,
        payload.gameModelId,
        payload.phase,
        payload.zone,
        payload.focusTeamColor,
        payload.opponentTeamColor,
        payload.sourceFileUri,
        payload.fileUriUsed,
        payload.model,
        JSON.stringify(payload.analysis ?? {}),
        payload.context == null ? null : JSON.stringify(payload.context)
      );
      row = rows?.[0];
    }

    return res.json({
      ok: true,
      item: {
        id: row.id,
        refCode: row.refCode || refCode,
        title: row.title,
        createdAt: row.createdAt,
      },
    });
  } catch (e: any) {
    if (isVaultTableMissingError(e)) {
      return res.status(503).json({
        ok: false,
        error: "VIDEO_ANALYSIS_VAULT_NOT_INITIALIZED",
        message: "Video Analysis Vault is not initialized. Run the latest database migrations.",
      });
    }
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    });
  }
});

r.get("/vault/video-analysis", async (req: AuthRequest, res) => {
  if (!req.userId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 30;

  try {
    const items = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","refCode","title","ageGroup","playerLevel","coachLevel","gameModelId","phase","zone","focusTeamColor","opponentTeamColor","sourceFileUri","fileUriUsed","model","analysis","context","createdAt"
       FROM "VideoAnalysisVault"
       WHERE "userId" = $1
       ORDER BY "createdAt" DESC
       LIMIT $2`,
      req.userId,
      limit
    );

    return res.json({
      ok: true,
      items: items.map((item) => ({
        id: item.id,
        refCode: item.refCode || null,
        title: item.title,
        ageGroup: item.ageGroup,
        playerLevel: item.playerLevel,
        coachLevel: item.coachLevel,
        gameModelId: item.gameModelId,
        phase: item.phase,
        zone: item.zone,
        focusTeamColor: item.focusTeamColor,
        opponentTeamColor: item.opponentTeamColor,
        sourceFileUri: item.sourceFileUri,
        fileUriUsed: item.fileUriUsed,
        model: item.model,
        analysis: item.analysis,
        context: item.context,
        createdAt: item.createdAt,
      })),
    });
  } catch (e: any) {
    if (isVaultTableMissingError(e)) {
      return res.status(503).json({
        ok: false,
        error: "VIDEO_ANALYSIS_VAULT_NOT_INITIALIZED",
        message: "Video Analysis Vault is not initialized. Run the latest database migrations.",
      });
    }
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    });
  }
});

// DELETE /vault/video-analysis/:id - Delete a video analysis from vault
r.delete("/vault/video-analysis/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ ok: false, error: "Invalid analysis ID" });
    }

    // Support delete by DB id (preferred) and by refCode (fallback)
    const existing = await prisma.videoAnalysisVault.findFirst({
      where: {
        userId: userId,
        OR: [{ id }, { refCode: id }],
      },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Analysis not found" });
    }

    // Delete the analysis
    await prisma.videoAnalysisVault.delete({
      where: { id: existing.id },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    if (isVaultTableMissingError(e)) {
      return res.status(503).json({
        ok: false,
        error: "VIDEO_ANALYSIS_VAULT_NOT_INITIALIZED",
        message: "Video Analysis Vault is not initialized. Run the latest database migrations.",
      });
    }
    return res.status(500).json({
      ok: false,
      error: e?.message || String(e),
    });
  }
});

export default r;
