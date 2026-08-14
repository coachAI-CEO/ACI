export type AuthMeResponse = {
  ok?: boolean;
  user?: Record<string, unknown> | null;
  error?: string;
};

type CacheEntry = {
  token: string;
  data: AuthMeResponse;
  complete: boolean;
  at: number;
};

const CACHE_TTL_MS = 60_000;

let cache: CacheEntry | null = null;
let inFlight: Promise<AuthMeResponse | null> | null = null;

function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

function readStoredUser(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function invalidateAuthMeCache() {
  cache = null;
  inFlight = null;
}

/** Seed from login/register so Session Builder can lock the club model without waiting on /auth/me. */
export function seedAuthMeFromUser(user: unknown, token?: string | null) {
  const accessToken = token || readAccessToken();
  if (!accessToken || !user || typeof user !== "object") return;
  const record = user as Record<string, unknown>;
  cache = {
    token: accessToken,
    data: { ok: true, user: record },
    complete: false,
    at: Date.now(),
  };
}

export function peekEnforcedGameModelId(): { ready: boolean; value: string | null } {
  const token = readAccessToken();
  const users: Array<Record<string, unknown> | null> = [];
  if (cache?.data?.user && (!token || cache.token === token)) {
    users.push(cache.data.user);
  }
  users.push(readStoredUser());

  for (const user of users) {
    if (user && Object.prototype.hasOwnProperty.call(user, "enforcedGameModelId")) {
      const scoped = String(user.enforcedGameModelId || "").trim();
      return { ready: true, value: scoped || null };
    }
  }
  return { ready: false, value: null };
}

export async function fetchAuthMe(options?: { force?: boolean }): Promise<AuthMeResponse | null> {
  const token = readAccessToken();
  if (!token) {
    invalidateAuthMeCache();
    return null;
  }

  if (
    !options?.force &&
    cache &&
    cache.token === token &&
    cache.complete &&
    Date.now() - cache.at < CACHE_TTL_MS
  ) {
    return cache.data;
  }

  if (!options?.force && inFlight) return inFlight;

  let request: Promise<AuthMeResponse | null>;
  request = fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (res) => {
      const data = (await res.json().catch(() => ({}))) as AuthMeResponse;
      if (res.ok && data?.ok && data.user) {
        cache = { token, data, complete: true, at: Date.now() };
        try {
          const existing = readStoredUser() || {};
          localStorage.setItem("user", JSON.stringify({ ...existing, ...data.user }));
        } catch {
          /* ignore quota / private mode */
        }
      }
      return data;
    })
    .catch(() => (cache?.token === token ? cache.data : null))
    .finally(() => {
      if (inFlight === request) inFlight = null;
    });

  inFlight = request;
  return request;
}
