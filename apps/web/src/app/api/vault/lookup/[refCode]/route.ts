import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ refCode: string }> }
) {
  const { refCode } = await params;
  
  try {
    const res = await fetch(`${API_BASE}/vault/lookup/${encodeURIComponent(refCode)}`, {
      headers: { "Content-Type": "application/json" },
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
