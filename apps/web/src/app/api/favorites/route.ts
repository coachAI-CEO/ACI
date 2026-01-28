import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const queryString = url.searchParams.toString();
    const userId = request.headers.get("x-user-id");
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
      console.log("[FAVORITES_PROXY] GET: Forwarding Authorization header");
    } else if (userId) {
      headers["x-user-id"] = userId;
      console.log("[FAVORITES_PROXY] GET: Using x-user-id header");
    } else {
      console.log("[FAVORITES_PROXY] GET: No auth headers found");
    }

    const res = await fetch(
      `${API_BASE}/favorites${queryString ? `?${queryString}` : ""}`,
      { headers }
    );

    let data: any;
    try {
      data = await res.json();
    } catch (parseError: any) {
      // If JSON parsing fails, try to get text
      const text = await res.text().catch(() => "Unknown error");
      console.error(`[FAVORITES_PROXY] GET: Failed to parse response as JSON:`, text);
      return NextResponse.json(
        { ok: false, error: "Invalid response from backend", details: text },
        { status: res.status || 500 }
      );
    }
    
    if (!res.ok) {
      console.error(`[FAVORITES_PROXY] GET failed: ${res.status} ${res.statusText}`, data);
      // If backend returns an error, forward it but ensure it has the error structure
      if (!data.ok && data.error) {
        return NextResponse.json(data, { status: res.status });
      }
      // If backend error doesn't have proper structure, wrap it
      return NextResponse.json(
        { 
          ok: false, 
          error: data.error || data.message || `Backend error: ${res.status} ${res.statusText}`,
          details: data
        },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[FAVORITES_PROXY] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const body = await request.text();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (authHeader) {
      headers["Authorization"] = authHeader;
      console.log("[FAVORITES_PROXY] POST: Forwarding Authorization header");
    } else if (userId) {
      headers["x-user-id"] = userId;
      console.log("[FAVORITES_PROXY] POST: Using x-user-id header");
    } else {
      console.log("[FAVORITES_PROXY] POST: No auth headers found");
    }

    const res = await fetch(`${API_BASE}/favorites/check`, {
      method: "POST",
      headers,
      body,
    });

    let data: any;
    try {
      data = await res.json();
    } catch (parseError: any) {
      // If JSON parsing fails, try to get text
      const text = await res.text().catch(() => "Unknown error");
      console.error(`[FAVORITES_PROXY] POST: Failed to parse response as JSON:`, text);
      return NextResponse.json(
        { ok: false, error: "Invalid response from backend", details: text },
        { status: res.status || 500 }
      );
    }
    
    if (!res.ok) {
      console.error(`[FAVORITES_PROXY] POST failed: ${res.status} ${res.statusText}`, data);
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[FAVORITES_PROXY] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to check favorites" },
      { status: 500 }
    );
  }
}
