import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const queryString = url.searchParams.toString();
    const userId = request.headers.get("x-user-id");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (userId) {
      headers["x-user-id"] = userId;
    }

    const res = await fetch(
      `${API_BASE}/favorites${queryString ? `?${queryString}` : ""}`,
      { headers }
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[FAVORITES_PROXY] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    const body = await request.text();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (userId) {
      headers["x-user-id"] = userId;
    }

    const res = await fetch(`${API_BASE}/favorites/check`, {
      method: "POST",
      headers,
      body,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[FAVORITES_PROXY] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to check favorites" },
      { status: 500 }
    );
  }
}
