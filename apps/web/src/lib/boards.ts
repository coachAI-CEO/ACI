import type { DiagramV1 } from "@/types/diagram";
import { getUserHeaders } from "@/lib/user";

export type BoardShareMode = "PRIVATE" | "CLUB";

export type TacticalBoardSummary = {
  id: string;
  ownerUserId: string;
  clubId: string | null;
  title: string;
  ageGroup: string | null;
  gameModelId: string;
  shareMode: BoardShareMode;
  sourceSessionId: string | null;
  sourceDrillKey: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  phase?: string | null;
  zone?: string | null;
  channel?: string | null;
  attFormation?: string | null;
  defFormation?: string | null;
  slideCount?: number;
  favorited?: boolean;
  creator?: { name: string | null; email: string | null } | null;
};

export type TacticalBoard = TacticalBoardSummary & {
  diagram: DiagramV1;
};

function authHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(getUserHeaders() as Record<string, string>),
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseJson(res: Response) {
  return res.json().catch(() => ({ ok: false, error: "Invalid JSON" }));
}

export async function listBoards(opts?: {
  cursor?: string | null;
  limit?: number;
}): Promise<{ ok: boolean; boards?: TacticalBoardSummary[]; nextCursor?: string | null; error?: string }> {
  const params = new URLSearchParams();
  if (opts?.cursor) params.set("cursor", opts.cursor);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const res = await fetch(`/api/boards${qs ? `?${qs}` : ""}`, { headers: authHeaders() });
  return parseJson(res);
}

export async function getBoard(
  id: string
): Promise<{ ok: boolean; board?: TacticalBoard; error?: string; message?: string }> {
  const res = await fetch(`/api/boards/${encodeURIComponent(id)}`, { headers: authHeaders() });
  return parseJson(res);
}

export async function createBlankBoard(input?: {
  title?: string;
  ageGroup?: string;
  gameModelId?: string;
  shareMode?: BoardShareMode;
}): Promise<{ ok: boolean; board?: TacticalBoard; error?: string; message?: string }> {
  const res = await fetch("/api/boards", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ mode: "BLANK", ...input }),
  });
  return parseJson(res);
}

export async function createForkBoard(input: {
  sessionId: string;
  drillIndex?: number;
  drillRefCode?: string;
  title?: string;
  shareMode?: BoardShareMode;
}): Promise<{ ok: boolean; board?: TacticalBoard; error?: string; message?: string }> {
  const res = await fetch("/api/boards", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ mode: "FORK_DRILL", ...input }),
  });
  return parseJson(res);
}

export async function createForkSessionBoard(input: {
  sessionId: string;
  title?: string;
  shareMode?: BoardShareMode;
}): Promise<{ ok: boolean; board?: TacticalBoard; error?: string; message?: string }> {
  const res = await fetch("/api/boards", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ mode: "FORK_SESSION", ...input }),
  });
  return parseJson(res);
}

export async function patchBoard(
  id: string,
  patch: {
    title?: string;
    diagram?: DiagramV1;
    shareMode?: BoardShareMode;
    ageGroup?: string | null;
    favorited?: boolean;
  }
): Promise<{ ok: boolean; board?: TacticalBoard; error?: string; message?: string; details?: unknown }> {
  const res = await fetch(`/api/boards/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  return parseJson(res);
}

export async function deleteBoard(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/boards/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function boardAiChat(
  id: string,
  input: {
    message: string;
    diagram: DiagramV1;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    image?: { mimeType: string; data: string; fileName?: string };
  }
): Promise<{
  ok: boolean;
  reply?: string;
  applied?: boolean;
  diagram?: DiagramV1;
  coachLevel?: string;
  playerLevel?: string;
  sessionBridge?: {
    params: Record<string, unknown>;
    recommendations: Array<{
      id: string;
      title: string;
      ageGroup?: string | null;
      gameModelId?: string | null;
      phase?: string | null;
      zone?: string | null;
      formationUsed?: string | null;
      durationMin?: number | null;
      similarity: number;
      summary?: string | null;
      openUrl: string;
    }>;
    generatorUrl: string;
    generatorPrompt: string;
  } | null;
  error?: string;
  message?: string;
}> {
  const res = await fetch(`/api/boards/${encodeURIComponent(id)}/ai-chat`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

/** Place Setup phase/zone/channel via shared API chassis (no save). */
export async function placeBoardPhase(
  id: string,
  input: {
    diagram: DiagramV1;
    phase: string;
    zone: string;
    channel: string;
    attFormation?: string;
    defFormation?: string;
    showOpposition?: boolean;
  }
): Promise<{ ok: boolean; diagram?: DiagramV1; error?: string; message?: string }> {
  const res = await fetch(`/api/boards/${encodeURIComponent(id)}/phase-place`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return parseJson(res);
}
