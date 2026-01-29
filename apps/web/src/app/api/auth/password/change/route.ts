import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
    }
    const body = await request.json();
    const res = await fetch(`${API_BASE}/auth/password/change`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[AUTH_PROXY] POST /auth/password/change error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to change password" },
      { status: 503 }
    );
  }
}
