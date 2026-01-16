import { NextRequest, NextResponse } from "next/server";

const PROGRESSIVE_SERIES_TIMEOUT = 600000; // 10 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const baseInput = body.baseInput || body;
    const numberOfSessions = body.numberOfSessions || 3;
    const { searchParams } = new URL(request.url);
    const skipRecommendation = searchParams.get("skipRecommendation") === "1";

    const url = `http://localhost:4000/ai/generate-progressive-series${skipRecommendation ? "?skipRecommendation=1" : ""}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROGRESSIVE_SERIES_TIMEOUT);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseInput, numberOfSessions }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return NextResponse.json(
          { ok: false, error: errorData?.error || `API error: ${res.status}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      return NextResponse.json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        return NextResponse.json(
          { ok: false, error: "Request timed out. Progressive series generation can take several minutes." },
          { status: 504 }
        );
      }
      if (fetchError.message?.includes("fetch failed") || fetchError.code === "ECONNREFUSED") {
        return NextResponse.json(
          { ok: false, error: "Cannot connect to API server. Please ensure the backend server is running on port 4000." },
          { status: 503 }
        );
      }
      throw fetchError;
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
