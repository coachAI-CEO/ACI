import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    
    if (!authHeader) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const res = await fetch(`${API_BASE}/player-plans/bulk-lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });

    let data: any;
    try {
      data = await res.json();
    } catch (parseError: any) {
      const text = await res.text().catch(() => "Unknown error");
      console.error(`[PLAYER_PLAN_PROXY] bulk-lookup: Failed to parse response:`, text);
      return NextResponse.json(
        { ok: false, error: "Invalid response from backend", details: text },
        { status: res.status || 500 }
      );
    }

    if (!res.ok) {
      console.error(`[PLAYER_PLAN_PROXY] bulk-lookup failed: ${res.status} ${res.statusText}`, data);
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[PLAYER_PLAN_PROXY] bulk-lookup error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to bulk lookup player plans" },
      { status: 500 }
    );
  }
}
