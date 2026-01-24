import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const queryString = url.searchParams.toString();
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const res = await fetch(
      `${API_BASE}/player-plans${queryString ? `?${queryString}` : ""}`,
      { headers }
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[PLAYER_PLANS_PROXY] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to fetch player plans" },
      { status: 500 }
    );
  }
}
