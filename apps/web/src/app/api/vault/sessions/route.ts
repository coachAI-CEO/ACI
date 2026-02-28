import { NextRequest, NextResponse } from "next/server";

function getApiBaseCandidates(): string[] {
  const configured = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
  const candidates = [configured];
  if (configured.includes("localhost")) {
    candidates.push(configured.replace("localhost", "127.0.0.1"));
  }
  if (configured.includes("127.0.0.1")) {
    candidates.push(configured.replace("127.0.0.1", "localhost"));
  }
  candidates.push("http://127.0.0.1:4000", "http://localhost:4000");
  return Array.from(new Set(candidates));
}

// Helper to get auth headers
function getAuthHeaders(request: NextRequest): HeadersInit {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const cookieToken = request.cookies.get("accessToken")?.value;
  const userIdHeader = request.headers.get("x-user-id");
  const headers: HeadersInit = {};
  if (authHeader) {
    headers.Authorization = authHeader;
  } else if (cookieToken) {
    headers.Authorization = `Bearer ${cookieToken}`;
  }
  if (userIdHeader) {
    headers["x-user-id"] = userIdHeader;
  }
  return headers;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();
    const bases = getApiBaseCandidates();
    let res: Response | null = null;
    let lastError: unknown = null;

    for (const base of bases) {
      const url = `${base}/vault/sessions?${query}`;
      console.log("[VAULT_API] Fetching from:", url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for large datasets
      try {
        res = await fetch(url, {
          signal: controller.signal,
          headers: getAuthHeaders(request),
        });
        clearTimeout(timeoutId);
        break;
      } catch (e: unknown) {
        clearTimeout(timeoutId);
        lastError = e;
        const message = e instanceof Error ? e.message : String(e);
        console.warn(`[VAULT_API] Fetch failed for base ${base}:`, message);
      }
    }

    if (!res) {
      throw lastError || new Error("All API base candidates failed");
    }
    
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
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorName = e instanceof Error ? e.name : "UnknownError";
    
    // Check if it's a fetch failure (backend not running)
    const isFetchFailed = errorName === 'TypeError' && errorMessage.includes('fetch failed');
    const isAbortError = errorName === 'AbortError';
    
    console.error('[VAULT_API] Fetch error:', {
      name: errorName,
      message: errorMessage,
      isFetchFailed,
      isAbortError,
      stack: e instanceof Error ? e.stack : undefined,
      cause: e instanceof Error ? (e as Error & { cause?: unknown }).cause : undefined,
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
