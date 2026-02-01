import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refCodes } = body;
    
    if (!Array.isArray(refCodes) || refCodes.length === 0) {
      return NextResponse.json(
        { ok: false, error: "refCodes must be a non-empty array" },
        { status: 400 }
      );
    }
    
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const userId = request.headers.get("x-user-id");
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (authHeader) headers["Authorization"] = authHeader;
    if (userId) headers["x-user-id"] = userId;

    const res = await fetch(`${API_BASE}/vault/lookup`, {
      method: "POST",
      headers,
      body: JSON.stringify({ refCodes }),
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[LOOKUP_BATCH] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to lookup references" },
      { status: 500 }
    );
  }
}
