import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  (process.env.API_URL && !process.env.API_URL.includes("localhost"))
    ? process.env.API_URL
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
    }
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: authHeader },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[AUTH_PROXY] GET /auth/me error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to fetch user" },
      { status: 503 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
    }
    const body = await request.json();
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[AUTH_PROXY] PATCH /auth/me error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to update profile" },
      { status: 503 }
    );
  }
}
