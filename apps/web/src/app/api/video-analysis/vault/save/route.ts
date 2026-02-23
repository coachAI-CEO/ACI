import { NextRequest, NextResponse } from "next/server";

function getAuthHeaders(request: NextRequest): Record<string, string> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const userIdHeader = request.headers.get("x-user-id");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader) headers["Authorization"] = authHeader;
  if (userIdHeader) headers["x-user-id"] = userIdHeader;
  return headers;
}

function getApiBaseCandidates(): string[] {
  const isDev = process.env.NODE_ENV !== "production";
  const configuredDevBase = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  const configuredProdBase = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
  const primary = (isDev ? configuredDevBase : configuredProdBase) || "http://127.0.0.1:4000";
  const candidates = [primary];
  if (primary.includes("localhost")) candidates.push(primary.replace("localhost", "127.0.0.1"));
  if (primary.includes("127.0.0.1")) candidates.push(primary.replace("127.0.0.1", "localhost"));
  if (isDev) {
    candidates.push("http://127.0.0.1:4000");
    candidates.push("http://localhost:4000");
  }
  return Array.from(new Set(candidates.filter(Boolean)));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeaders = getAuthHeaders(request);
    const bases = getApiBaseCandidates();
    let lastError: any = null;

    for (const base of bases) {
      try {
        const res = await fetch(`${base}/vault/video-analysis/save`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(body || {}),
          signal: request.signal,
        });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error("Unable to reach API");
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
