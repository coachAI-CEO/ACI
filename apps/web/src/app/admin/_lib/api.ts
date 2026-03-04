/**
 * Shared admin API utilities
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const AUTH_REFRESH_URL = "/api/auth/refresh";

export function getAdminHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const directAccessToken = localStorage.getItem("accessToken");
  if (directAccessToken) {
    return { Authorization: `Bearer ${directAccessToken}` };
  }

  const stored = localStorage.getItem("user");
  if (!stored) return {};
  try {
    const user = JSON.parse(stored);
    const token = user?.accessToken ?? user?.token ?? "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function setAuthCookie(token: string | null) {
  if (typeof document === "undefined") return;
  if (!token) {
    document.cookie = "accessToken=; path=/; Max-Age=0; SameSite=Lax";
    return;
  }
  document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; Max-Age=604800; SameSite=Lax; Secure`;
}

function clearAuthState() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  setAuthCookie(null);
  window.dispatchEvent(new Event("userLogin"));
}

async function tryRefreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;

  const refreshRes = await fetch(AUTH_REFRESH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => null);

  if (!refreshRes?.ok) return null;
  const refreshData = await refreshRes.json().catch(() => ({}));
  if (!refreshData?.accessToken) return null;

  localStorage.setItem("accessToken", refreshData.accessToken);
  setAuthCookie(refreshData.accessToken);
  return refreshData.accessToken as string;
}

export async function adminFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const request = async (accessTokenOverride?: string) =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAdminHeaders(),
        ...(accessTokenOverride ? { Authorization: `Bearer ${accessTokenOverride}` } : {}),
        ...(options?.headers ?? {}),
      },
      cache: "no-store",
    });

  let res = await request();
  if (!res.ok) {
    let text = await res.text().catch(() => res.statusText);
    const invalidToken = res.status === 401 && /invalid token|unauthorized/i.test(text);

    if (invalidToken) {
      const refreshedToken = await tryRefreshAccessToken();
      if (refreshedToken) {
        res = await request(refreshedToken);
        if (res.ok) {
          return res.json() as Promise<T>;
        }
        text = await res.text().catch(() => res.statusText);
      } else {
        clearAuthState();
      }
    }

    throw new Error(`${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}
