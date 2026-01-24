import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_URL || "http://localhost:4000";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    
    if (!authHeader) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const res = await fetch(`${API_BASE}/calendar/events/${eventId}`, {
      headers: {
        Authorization: authHeader,
      },
    });

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
      { ok: false, error: e?.message || "Failed to fetch calendar event" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    
    if (!authHeader) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const res = await fetch(`${API_BASE}/calendar/events/${eventId}`, {
      method: "PATCH",
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
      console.error(`[CALENDAR_PROXY] PATCH: Failed to parse response:`, text);
      return NextResponse.json(
        { ok: false, error: "Invalid response from backend", details: text },
        { status: res.status || 500 }
      );
    }

    if (!res.ok) {
      console.error(`[CALENDAR_PROXY] PATCH failed: ${res.status} ${res.statusText}`, data);
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[CALENDAR_PROXY] PATCH error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to update calendar event" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    
    if (!authHeader) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const res = await fetch(`${API_BASE}/calendar/events/${eventId}`, {
      method: "DELETE",
      headers: {
        Authorization: authHeader,
      },
    });

    let data: any;
    try {
      data = await res.json();
    } catch (parseError: any) {
      const text = await res.text().catch(() => "Unknown error");
      console.error(`[CALENDAR_PROXY] DELETE: Failed to parse response:`, text);
      return NextResponse.json(
        { ok: false, error: "Invalid response from backend", details: text },
        { status: res.status || 500 }
      );
    }

    if (!res.ok) {
      console.error(`[CALENDAR_PROXY] DELETE failed: ${res.status} ${res.statusText}`, data);
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[CALENDAR_PROXY] DELETE error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to delete calendar event" },
      { status: 500 }
    );
  }
}
