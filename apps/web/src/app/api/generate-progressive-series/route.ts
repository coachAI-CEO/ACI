import { NextRequest, NextResponse } from "next/server";

const PROGRESSIVE_SERIES_TIMEOUT = 900000; // 15 minutes

// Configure the route to allow long-running requests
export const maxDuration = 300; // Vercel Hobby limit is 300s

function getApiBaseCandidates(): string[] {
  const isDev = process.env.NODE_ENV !== "production";
  const configuredDevBase = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  const configuredProdBase = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
  const primary = (isDev ? configuredDevBase : configuredProdBase) || "http://127.0.0.1:4000";

  const candidates = [primary];
  if (primary.includes("localhost")) {
    candidates.push(primary.replace("localhost", "127.0.0.1"));
  }
  if (primary.includes("127.0.0.1")) {
    candidates.push(primary.replace("127.0.0.1", "localhost"));
  }
  if (isDev) {
    candidates.push("http://127.0.0.1:4000");
    candidates.push("http://localhost:4000");
  }
  return Array.from(new Set(candidates.filter(Boolean)));
}

export async function POST(request: NextRequest) {
  console.log("[API/progressive-series] Starting request...");
  
  try {
    const body = await request.json();
    const baseInput = body.baseInput || body;
    const numberOfSessions = body.numberOfSessions || 3;
    const { searchParams } = new URL(request.url);
    const skipRecommendation = searchParams.get("skipRecommendation") === "1";

    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const userIdHeader = request.headers.get("x-user-id");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Connection": "keep-alive",
    };
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }
    if (userIdHeader) {
      headers["x-user-id"] = userIdHeader;
    }

    console.log("[API/progressive-series] Forwarding to backend with numberOfSessions:", numberOfSessions);

    const path = `/ai/generate-progressive-series${skipRecommendation ? "?skipRecommendation=1" : ""}`;

    const bases = getApiBaseCandidates();
    let lastError: any = null;
    let res: Response | null = null;
    for (const base of bases) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PROGRESSIVE_SERIES_TIMEOUT);

      try {
        res = await fetch(`${base}${path}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ baseInput, numberOfSessions }),
          signal: controller.signal,
          // @ts-ignore - Next.js extended fetch options
          keepalive: true,
        });
        clearTimeout(timeoutId);
        break;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        lastError = fetchError;
        console.error(`[API/progressive-series] Fetch failed for base ${base}:`, fetchError?.message || String(fetchError));
      }
    }

    try {
      if (!res) {
        throw lastError || new Error("All API base candidates failed");
      }
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
