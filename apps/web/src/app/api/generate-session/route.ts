import { NextRequest, NextResponse } from "next/server";

// Helper to get auth headers from request
function getAuthHeaders(request: NextRequest): Record<string, string> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const userIdHeader = request.headers.get("x-user-id");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
  if (userIdHeader) {
    headers["x-user-id"] = userIdHeader;
  }
  return headers;
}

function getApiBaseCandidates(): string[] {
  const isDev = process.env.NODE_ENV !== "production";
  const configuredDevBase = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  const configuredProdBase = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
  const primary = (isDev ? configuredDevBase : configuredProdBase) || "http://127.0.0.1:4000";

  const candidates = [primary];
  if (primary.includes("localhost")) {
    candidates.push(primary.replace("localhost", "127.0.0.1"));
  }
  if (primary.includes("127.0.0.1")) {
    candidates.push(primary.replace("127.0.0.1", "localhost"));
  }
  if (isDev) {
    candidates.push("http://127.0.0.1:4000");
    candidates.push("http://localhost:4000");
  }
  return Array.from(new Set(candidates.filter(Boolean)));
}

async function fetchWithFallback(
  path: string,
  init: RequestInit,
  signal?: AbortSignal
): Promise<Response> {
  const bases = getApiBaseCandidates();
  let lastError: any = null;

  for (const base of bases) {
    try {
      const res = await fetch(`${base}${path}`, { ...init, signal });
      return res;
    } catch (err: any) {
      lastError = err;
      console.error(`[API/generate-session] fetch failed for base ${base}:`, err?.message || String(err));
    }
  }

  throw lastError || new Error("All API base candidates failed");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const skipRecommendation = searchParams.get("skipRecommendation") === "1";
    const authHeaders = getAuthHeaders(request);
    const hasAuth = Boolean(authHeaders.Authorization);
    console.log("[API/generate-session] skipRecommendation:", skipRecommendation, "hasAuth:", hasAuth);

    if (!skipRecommendation) {
      try {
        const recRes = await fetchWithFallback("/vault/sessions/similar", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            ...body,
            threshold: 0.85,
          }),
        }, request.signal);
        console.log("[API/generate-session] recommendations status:", recRes.status, recRes.statusText);
        if (recRes.ok) {
          const recData = await recRes.json();
          if (recData?.matches?.length > 0) {
            return NextResponse.json({
              ok: true,
              hasRecommendations: true,
              recommendations: recData.matches.slice(0, 5),
            });
          }
        }
      } catch {
        // Ignore recommendation errors and proceed
      }
    }

    const res = await fetchWithFallback("/ai/generate-session", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(body),
    }, request.signal);
    console.log("[API/generate-session] generate status:", res.status, res.statusText);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.log("[API/generate-session] generate error body:", errorData);
      return NextResponse.json(
        { ok: false, error: errorData?.error || `API error: ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
