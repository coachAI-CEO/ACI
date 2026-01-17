import { NextResponse, NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const { seriesId } = await params;
  
  console.log("[API] Fetching series with ID:", seriesId);
  
  try {
    // seriesId is already decoded by Next.js, just pass it through
    const url = `http://localhost:4000/vault/series/${seriesId}`;
    console.log("[API] Calling backend:", url);
    
    const res = await fetch(url);
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
