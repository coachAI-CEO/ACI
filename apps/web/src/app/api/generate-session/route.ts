import { NextRequest, NextResponse } from "next/server";

// Helper to get auth headers from request
function getAuthHeaders(request: NextRequest): Record<string, string> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
  return headers;
}

export async function POST(request: NextRequest) {
  try {
    const apiBase =
      (process.env.API_URL && !process.env.API_URL.includes("localhost"))
        ? process.env.API_URL
        : process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const skipRecommendation = searchParams.get("skipRecommendation") === "1";
    const authHeaders = getAuthHeaders(request);
    const hasAuth = Boolean(authHeaders.Authorization);
    console.log("[API/generate-session] skipRecommendation:", skipRecommendation, "hasAuth:", hasAuth);

    if (!skipRecommendation) {
      try {
        const recRes = await fetch(`${apiBase}/vault/sessions/similar`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            ...body,
            threshold: 0.85,
          }),
        });
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

    const res = await fetch(`${apiBase}/ai/generate-session`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(body),
    });
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
