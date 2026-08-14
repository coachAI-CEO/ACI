import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getAuthHeaders(request: NextRequest): HeadersInit {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const userId = request.headers.get("x-user-id");
  const headers: HeadersInit = {};
  if (authHeader) headers.Authorization = authHeader;
  if (userId) headers["x-user-id"] = userId;
  return headers;
}

/** GET /api/boards — list owned boards (cursor pagination). */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${API_URL}/boards${searchParams ? `?${searchParams}` : ""}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: getAuthHeaders(request),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "Invalid JSON from API" }));
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

/** POST /api/boards — create BLANK or FORK_DRILL. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  try {
    const res = await fetch(`${API_URL}/boards`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "Invalid JSON from API" }));
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
