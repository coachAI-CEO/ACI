import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Helper to get auth headers
function getAuthHeaders(request: NextRequest): HeadersInit {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const headers: HeadersInit = {};
  if (authHeader) {
    headers.Authorization = authHeader;
  }
  return headers;
}

// Proxy all admin routes to the backend
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${API_URL}/admin/${pathStr}${searchParams ? `?${searchParams}` : ""}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: getAuthHeaders(request),
    });
    clearTimeout(timeoutId);
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const body = await request.json().catch(() => ({}));
  const url = `${API_URL}/admin/${pathStr}`;

  // Longer timeout for regeneration operations (QA + generation can take 2+ minutes)
  const isRegeneration = pathStr.includes("sessions/regenerate") || pathStr.includes("sessions/review");
  const timeoutMs = isRegeneration ? 180000 : 60000; // 3 minutes for regeneration, 1 minute for others

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...getAuthHeaders(request),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    // Provide more helpful error messages
    let errorMessage = e?.message || String(e);
    if (errorMessage.includes("aborted") || errorMessage.includes("AbortError")) {
      errorMessage = `Request timed out after ${timeoutMs / 1000} seconds. The operation may still be processing. Please check the server logs.`;
    }
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const body = await request.json().catch(() => ({}));
  const url = `${API_URL}/admin/${pathStr}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const res = await fetch(url, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        ...getAuthHeaders(request),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const url = `${API_URL}/admin/${pathStr}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const res = await fetch(url, {
      method: "DELETE",
      headers: getAuthHeaders(request),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
