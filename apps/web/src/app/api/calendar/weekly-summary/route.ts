import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart");
    const weekEnd = searchParams.get("weekEnd");
    const format = searchParams.get("format");

    if (!weekStart || !weekEnd) {
      return NextResponse.json(
        { ok: false, error: "weekStart and weekEnd query parameters are required" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.API_URL || "http://localhost:4000";
    const url = `${apiUrl}/calendar/weekly-summary?weekStart=${weekStart}&weekEnd=${weekEnd}${format ? `&format=${format}` : ""}`;

    // Get authorization header
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (authHeader) {
      headers.Authorization = authHeader;
    }

    // Add timeout for AI generation (can take up to 60s + processing time)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout for AI generation

    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        return NextResponse.json(
          { ok: false, error: "Request timeout. AI generation is taking longer than expected. Please try again." },
          { status: 504 }
        );
      }
      // Network error (backend not running, connection refused, etc.)
      console.error("[WEEKLY_SUMMARY_PROXY] Fetch error:", fetchError);
      return NextResponse.json(
        { ok: false, error: "Unable to connect to the backend server. Please ensure the API server is running." },
        { status: 503 }
      );
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { ok: false, error: errorData.error || `API error: ${res.status}` },
        { status: res.status }
      );
    }

    // If PDF format, return the PDF directly
    if (format === "pdf") {
      const pdfBuffer = await res.arrayBuffer();
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="weekly-summary-${weekStart}-${weekEnd}.pdf"`,
        },
      });
    }

    // Otherwise return JSON
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("[WEEKLY_SUMMARY_PROXY] Error:", e);
    // Check if it's a network/connection error
    if (e.message?.includes("fetch failed") || e.message?.includes("ECONNREFUSED") || e.code === "ECONNREFUSED") {
      return NextResponse.json(
        { ok: false, error: "Unable to connect to the backend server. Please ensure the API server is running on port 4000." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { ok: false, error: e.message || "Failed to fetch weekly summary" },
      { status: 500 }
    );
  }
}
