import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.API_URL || "http://localhost:4000";
    const url = `${apiUrl}/vault/series`;
    
    console.log('[VAULT_API] Fetching series from:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for large datasets
    
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
    const errorMessage = e?.message || String(e);
    const errorName = e?.name || 'UnknownError';
    
    // Check if it's a fetch failure (backend not running)
    const isFetchFailed = errorName === 'TypeError' && errorMessage.includes('fetch failed');
    const isAbortError = errorName === 'AbortError';
    
    console.error('[VAULT_API] Series fetch error:', {
      name: errorName,
      message: errorMessage,
      isFetchFailed,
      isAbortError,
      stack: e?.stack,
      cause: e?.cause,
    });
    
    // Provide more helpful error messages
    let userFriendlyError = errorMessage;
    if (isFetchFailed) {
      userFriendlyError = 'Backend server is not running. Please start the API server on port 4000.';
    } else if (isAbortError) {
      userFriendlyError = 'Request timeout. The server took too long to respond.';
    }
    
    return NextResponse.json(
      { 
        ok: false, 
        error: userFriendlyError,
        details: process.env.NODE_ENV === 'development' ? {
          name: errorName,
          message: errorMessage,
        } : undefined,
      },
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
