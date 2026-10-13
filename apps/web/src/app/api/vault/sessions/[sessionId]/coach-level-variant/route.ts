import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const url = `${API_URL}/vault/sessions/${encodeURIComponent(sessionId)}/coach-level-variant`;
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const cookieToken = request.cookies.get("accessToken")?.value;
  const userIdHeader = request.headers.get("x-user-id");
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (authHeader) {
    headers["Authorization"] = authHeader;
  } else if (cookieToken) {
    headers["Authorization"] = `Bearer ${cookieToken}`;
  }
  if (userIdHeader) {
    headers["x-user-id"] = userIdHeader;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const res = await fetch(url, {
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
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
