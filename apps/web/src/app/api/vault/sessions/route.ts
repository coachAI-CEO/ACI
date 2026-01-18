import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiUrl = process.env.API_URL || "http://localhost:4000";
    const url = `${apiUrl}/vault/sessions?${searchParams.toString()}`;
    
    console.log('[VAULT_API] Fetching from:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[VAULT_API] Error response:', res.status, errorData);
      return NextResponse.json(
        { ok: false, error: errorData?.error || `API error: ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    console.log('[VAULT_API] Success, sessions:', data.sessions?.length || 0);
    return NextResponse.json(data);
  } catch (e: any) {
    const errorMessage = e?.message || String(e);
    const errorName = e?.name || 'UnknownError';
    console.error('[VAULT_API] Fetch error:', {
      name: errorName,
      message: errorMessage,
      stack: e?.stack,
      cause: e?.cause,
    });
    return NextResponse.json(
      { 
        ok: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          name: errorName,
          message: errorMessage,
        } : undefined,
      },
      { status: 500 }
    );
  }
}
