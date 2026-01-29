import { NextResponse, NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const { seriesId } = await params;
  
  console.log("[API] Fetching series with ID:", seriesId);
  
  try {
    const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const url = `${API_URL}/vault/series/${seriesId}`;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const headers: HeadersInit = {};
    if (authHeader) headers["Authorization"] = authHeader;
    
    const res = await fetch(url, { headers });
    const data = await res.json();
    
    console.log("[API] Backend response:", { ok: res.ok, status: res.status, data });
    
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("[API] Error fetching series:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
