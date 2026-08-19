import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getAuthHeaders(request: NextRequest): HeadersInit {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const headers: HeadersInit = {};
  if (authHeader) headers.Authorization = authHeader;
  return headers;
}

async function proxy(request: NextRequest, path: string[], method: string, body?: unknown) {
  const pathStr = path.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${API_URL}/coach-center/${pathStr}${searchParams ? `?${searchParams}` : ""}`;
  const isPdf = pathStr.endsWith("/pdf");
  const timeoutMs = pathStr.includes("/chat") || isPdf ? 90000 : 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...getAuthHeaders(request),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (isPdf && res.ok) {
      const pdfBuffer = await res.arrayBuffer();
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": res.headers.get("Content-Disposition") || "attachment; filename=game-day.pdf",
        },
      });
    }

    const data = await res.json().catch(() => ({ ok: false, error: "Invalid JSON from API" }));
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    clearTimeout(timeoutId);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(request, path, "GET");
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const body = await request.json().catch(() => ({}));
  return proxy(request, path, "PATCH", body);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const body = await request.json().catch(() => ({}));
  return proxy(request, path, "POST", body);
}
