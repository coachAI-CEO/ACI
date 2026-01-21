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
    
    const res = await fetch(`${API_BASE}/vault/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
