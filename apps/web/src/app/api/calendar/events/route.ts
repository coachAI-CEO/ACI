import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    
    if (!authHeader) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const queryString = url.searchParams.toString();

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/calendar/events?${queryString}`, {
        headers: {
          Authorization: authHeader,
        },
      });
    } catch (fetchError: any) {
      console.error(`[CALENDAR_PROXY] GET: Fetch failed:`, fetchError);
      return NextResponse.json(
        { 
          ok: false, 
          error: "Backend server is not running. Please start the API server on port 4000.",
          details: fetchError.message 
        },
        { status: 503 }
      );
    }

    let data: any;
    try {
      data = await res.json();
    } catch (parseError: any) {
      const text = await res.text().catch(() => "Unknown error");
      console.error(`[CALENDAR_PROXY] GET: Failed to parse response:`, text);
      return NextResponse.json(
        { ok: false, error: "Invalid response from backend", details: text },
        { status: res.status || 500 }
      );
    }

    if (!res.ok) {
      console.error(`[CALENDAR_PROXY] GET failed: ${res.status} ${res.statusText}`, data);
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[CALENDAR_PROXY] GET error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    
    if (!authHeader) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Log the request for debugging
    console.log(`[CALENDAR_PROXY] POST to ${API_BASE}/calendar/events`);

    const res = await fetch(`${API_BASE}/calendar/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });

    let data: any;
    try {
      data = await res.json();
    } catch (parseError: any) {
      const text = await res.text().catch(() => "Unknown error");
      console.error(`[CALENDAR_PROXY] POST: Failed to parse response:`, text);
      return NextResponse.json(
        { ok: false, error: "Invalid response from backend", details: text },
        { status: res.status || 500 }
      );
    }

    if (!res.ok) {
      console.error(`[CALENDAR_PROXY] POST failed: ${res.status} ${res.statusText}`, data);
      console.error(`[CALENDAR_PROXY] Error details:`, JSON.stringify(data, null, 2));
      // If we get "Admin access required", this is wrong - calendar should be accessible to all authenticated users
      if (data.error === "Admin access required") {
        console.error(`[CALENDAR_PROXY] ERROR: Calendar endpoint returned "Admin access required" - this should not happen!`);
        console.error(`[CALENDAR_PROXY] This suggests the request is being routed to an admin endpoint instead of calendar endpoint.`);
      }
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[CALENDAR_PROXY] POST error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to create calendar event" },
      { status: 500 }
    );
  }
}
