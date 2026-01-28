import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

export async function POST(
  request: NextRequest,
  { params }: { params: { seriesId: string } }
) {
  try {
    const { seriesId } = params;
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const body = await request.text();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const res = await fetch(`${API_BASE}/player-plans/from-series/${seriesId}`, {
      method: "POST",
      headers,
      body,
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      const text = await res.text();
      console.error("[PLAYER_PLANS_PROXY] Non-JSON backend response (series):", {
        status: res.status,
        text,
      });
      return NextResponse.json(
        { ok: false, error: "Unexpected response from backend when creating player plan" },
        { status: res.status }
      );
    }

    if (!res.ok || !data?.ok) {
      console.error("[PLAYER_PLANS_PROXY] Backend error (series):", {
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
