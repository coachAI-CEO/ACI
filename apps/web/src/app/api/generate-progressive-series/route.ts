import { NextRequest, NextResponse } from "next/server";

const PROGRESSIVE_SERIES_TIMEOUT = 900000; // 15 minutes

// Configure the route to allow long-running requests
export const maxDuration = 300; // Vercel Hobby limit is 300s

export async function POST(request: NextRequest) {
  console.log("[API/progressive-series] Starting request...");
  
  try {
    const apiBase =
      (process.env.API_URL && !process.env.API_URL.includes("localhost"))
        ? process.env.API_URL
        : process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const body = await request.json();
    const baseInput = body.baseInput || body;
    const numberOfSessions = body.numberOfSessions || 3;
    const { searchParams } = new URL(request.url);
    const skipRecommendation = searchParams.get("skipRecommendation") === "1";

    console.log("[API/progressive-series] Forwarding to backend with numberOfSessions:", numberOfSessions);

    const url = `${apiBase}/ai/generate-progressive-series${skipRecommendation ? "?skipRecommendation=1" : ""}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROGRESSIVE_SERIES_TIMEOUT);

    try {
      // Use undici-style fetch options for better long-running request handling
      const res = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Connection": "keep-alive",
        },
        body: JSON.stringify({ baseInput, numberOfSessions }),
        signal: controller.signal,
        // @ts-ignore - Next.js extended fetch options
        keepalive: true,
      });

      clearTimeout(timeoutId);
      
      console.log("[API/progressive-series] Backend response status:", res.status, res.statusText);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("[API/progressive-series] Backend error response:", errorText.substring(0, 500));
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: `Backend returned: ${errorText.substring(0, 200)}` };
        }
        return NextResponse.json(
          { ok: false, error: errorData?.error || `API error: ${res.status}` },
          { status: res.status }
        );
      }

      const text = await res.text();
      console.log("[API/progressive-series] Response size:", text.length, "chars");
      
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error("[API/progressive-series] JSON parse error:", parseErr);
        console.error("[API/progressive-series] Response text preview:", text.substring(0, 500));
        return NextResponse.json(
          { ok: false, error: "Failed to parse backend response" },
          { status: 500 }
        );
      }
      
      console.log("[API/progressive-series] Success - series count:", data.series?.length);
      return NextResponse.json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error("[API/progressive-series] Fetch error:", fetchError.name, fetchError.message);
      
      if (fetchError.name === "AbortError") {
        return NextResponse.json(
          { ok: false, error: "Request timed out after 15 minutes. Try generating fewer sessions." },
          { status: 504 }
        );
      }
      // Connection dropped - backend might still be processing
      if (fetchError.message?.includes("fetch failed") || fetchError.message?.includes("terminated")) {
        return NextResponse.json(
          { ok: false, error: "Connection to backend was interrupted. The sessions may still be generating - check the vault in a few minutes." },
          { status: 503 }
        );
      }
      if (fetchError.code === "ECONNREFUSED") {
        return NextResponse.json(
          { ok: false, error: "Cannot connect to API server. Please ensure the backend server is running on port 4000." },
          { status: 503 }
        );
      }
      // Any other fetch error
      return NextResponse.json(
        { ok: false, error: `Connection error: ${fetchError.message || fetchError.name || 'Unknown error'}` },
        { status: 503 }
      );
    }
  } catch (e: any) {
    console.error("[API/progressive-series] Outer error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
