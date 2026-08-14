import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drillId: string }> }
) {
  try {
    const { drillId } = await params;
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const headers: HeadersInit = { Authorization: authHeader };

    const res = await fetch(`${API_BASE}/api/diagram-svg/${encodeURIComponent(drillId)}`, {
      headers,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || `API error: ${res.status}` },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
