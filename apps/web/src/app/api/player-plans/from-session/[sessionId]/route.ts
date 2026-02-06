import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const body = await request.text();

    console.log("[PLAYER_PLANS_PROXY] Request:", {
      sessionId,
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 20) + "...",
    });

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
    } else {
      console.warn("[PLAYER_PLANS_PROXY] No authorization header found");
    }

    const res = await fetch(`${API_BASE}/player-plans/from-session/${sessionId}`, {
      method: "POST",
      headers,
      body,
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      // Non-JSON response from backend
      const text = await res.text();
      console.error("[PLAYER_PLANS_PROXY] Non-JSON backend response:", {
        status: res.status,
        text,
      });
      return NextResponse.json(
        { ok: false, error: "Unexpected response from backend when creating player plan" },
        { status: res.status }
      );
    }

    if (!res.ok || !data?.ok) {
      console.error("[PLAYER_PLANS_PROXY] Backend error:", {
        status: res.status,
        data,
      });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[PLAYER_PLANS_PROXY] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to create player plan" },
      { status: 500 }
    );
  }
}
