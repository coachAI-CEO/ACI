import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const url = `${API_URL}/vault/sessions/${encodeURIComponent(sessionId)}`;
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const cookieToken = request.cookies.get("accessToken")?.value;
  const userIdHeader = request.headers.get("x-user-id");
  const headers: HeadersInit = {};
  if (authHeader) {
    headers["Authorization"] = authHeader;
  } else if (cookieToken) {
    headers["Authorization"] = `Bearer ${cookieToken}`;
  }
  if (userIdHeader) {
    headers["x-user-id"] = userIdHeader;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { ok: false, error: errorData?.error || `API error: ${res.status}` },
        { status: res.status }
      );
    }
    
    const data = await res.json();
    // Return the backend response format (ok: true, session: {...})
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
