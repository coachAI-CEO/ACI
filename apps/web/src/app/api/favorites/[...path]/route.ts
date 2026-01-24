import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

/**
 * Generic handler for all favorites API requests
 * Proxies requests to the backend API
 */
async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
  method: string
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const url = new URL(request.url);
  const queryString = url.searchParams.toString();
  const fullUrl = `${API_BASE}/favorites/${pathStr}${queryString ? `?${queryString}` : ""}`;

  try {
    // Get authentication from request headers
    const userId = request.headers.get("x-user-id");
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
      console.log(`[FAVORITES_PROXY] ${method} ${pathStr}: Forwarding Authorization header`);
    } else if (userId) {
      headers["x-user-id"] = userId;
      console.log(`[FAVORITES_PROXY] ${method} ${pathStr}: Using x-user-id header`);
    } else {
      console.log(`[FAVORITES_PROXY] ${method} ${pathStr}: No auth headers found`);
    }

    let body: string | undefined;
    if (method !== "GET" && method !== "DELETE") {
      try {
        body = await request.text();
      } catch {
        // No body
      }
    }

    const res = await fetch(fullUrl, {
      method,
      headers,
      body: body || undefined,
    });

    let data: any;
    try {
      data = await res.json();
    } catch (parseError: any) {
      // If JSON parsing fails, try to get text
      const text = await res.text().catch(() => "Unknown error");
      console.error(`[FAVORITES_PROXY] ${method} ${pathStr}: Failed to parse response as JSON:`, text);
      return NextResponse.json(
        { ok: false, error: "Invalid response from backend", details: text },
        { status: res.status || 500 }
      );
    }
    
    if (!res.ok) {
      console.error(`[FAVORITES_PROXY] ${method} ${pathStr} failed: ${res.status} ${res.statusText}`, data);
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[FAVORITES_PROXY] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to proxy request" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context, "GET");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context, "POST");
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context, "DELETE");
}
