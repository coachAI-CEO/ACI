import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ refCode: string }> }
) {
  const { refCode } = await params;
  
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const userId = request.headers.get("x-user-id");
    const headers: HeadersInit = {};
    if (authHeader) headers["Authorization"] = authHeader;
    if (userId) headers["x-user-id"] = userId;

    const res = await fetch(`${API_BASE}/vault/lookup/${encodeURIComponent(refCode)}`, {
      headers,
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[LOOKUP] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to lookup reference" },
      { status: 500 }
    );
  }
}
