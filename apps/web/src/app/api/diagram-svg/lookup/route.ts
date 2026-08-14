import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function authHeaders(request: NextRequest): HeadersInit | null {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const cookieToken = request.cookies.get("accessToken")?.value;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (authHeader) {
    headers.Authorization = authHeader;
    return headers;
  }
  if (cookieToken) {
    headers.Authorization = `Bearer ${cookieToken}`;
    return headers;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const headers = authHeaders(request);
    if (!headers) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const res = await fetch(`${API_BASE}/api/diagram-svg/lookup`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
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
