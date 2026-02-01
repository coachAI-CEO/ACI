import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function GET(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const userId = request.headers.get("x-user-id");
    const headers: HeadersInit = {};
    if (authHeader) headers["Authorization"] = authHeader;
    if (userId) headers["x-user-id"] = userId;
    const res = await fetch(`${API_BASE}/vault/sessions/${sessionId}/status`, { headers });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
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
