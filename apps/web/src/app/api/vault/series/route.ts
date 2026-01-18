import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.API_URL || "http://localhost:4000";
    const url = `${apiUrl}/vault/series`;
    
    console.log('[VAULT_API] Fetching series from:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[VAULT_API] Series error response:', res.status, errorData);
      return NextResponse.json(
        { ok: false, error: errorData?.error || `API error: ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    console.log('[VAULT_API] Series success, count:', data.series?.length || 0);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[VAULT_API] Series fetch error:', e.message);
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch("http://localhost:4000/vault/series/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { ok: false, error: errorData?.error || `API error: ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
