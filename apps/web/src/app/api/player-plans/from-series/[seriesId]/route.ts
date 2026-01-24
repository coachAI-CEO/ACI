import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const body = await request.text();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const res = await fetch(
      `${API_BASE}/player-plans/from-series/${seriesId}`,
      {
        method: "POST",
        headers,
        body,
      }
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[PLAYER_PLANS_PROXY] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to create player plan" },
      { status: 500 }
    );
  }
}
