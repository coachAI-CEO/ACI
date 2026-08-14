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

async function proxy(
  request: NextRequest,
  path: string[],
  method: string,
  body?: unknown
) {
  const pathStr = path.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${API_URL}/boards${pathStr ? `/${pathStr}` : ""}${searchParams ? `?${searchParams}` : ""}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...getAuthHeaders(request),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({ ok: false, error: "Invalid JSON from API" }));
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  return proxy(request, path, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  const body = await request.json().catch(() => ({}));
  return proxy(request, path, "POST", body);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  const body = await request.json().catch(() => ({}));
  return proxy(request, path, "PATCH", body);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  return proxy(request, path, "DELETE");
}
