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

    const res = await fetch(url, {
      method: "GET",
      headers,
    });

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
    return NextResponse.json(
      { ok: false, error: e.message || "Failed to fetch weekly summary" },
      { status: 500 }
    );
  }
}
