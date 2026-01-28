import { NextRequest, NextResponse } from "next/server";

// Helper to get auth headers
function getAuthHeaders(request: NextRequest): HeadersInit {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const headers: HeadersInit = {};
  if (authHeader) {
    headers.Authorization = authHeader;
  }
  return headers;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiUrl = process.env.API_URL || "http://localhost:4000";
    const url = `${apiUrl}/vault/sessions?${searchParams.toString()}`;
    
    console.log('[VAULT_API] Fetching from:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for large datasets
    
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: getAuthHeaders(request),
    });
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
    
    // Check if it's a fetch failure (backend not running)
    const isFetchFailed = errorName === 'TypeError' && errorMessage.includes('fetch failed');
    const isAbortError = errorName === 'AbortError';
    
    console.error('[VAULT_API] Fetch error:', {
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
