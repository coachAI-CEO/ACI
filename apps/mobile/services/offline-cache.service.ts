import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VaultSession } from './vault.service';
import { sessionHasUsableDrills } from '../utils/session-payload';

const KEYS = {
  activeUser: 'cache:activeUserId',
  vaultSessions: (userId: string) => `cache:${userId}:vault:sessions`,
  sessionById: (userId: string, sessionId: string) => `cache:${userId}:vault:session:${sessionId}`,
  userMeta: (userId: string) => `cache:${userId}:user:meta`,
  updatedAt: (userId: string) => `cache:${userId}:updatedAt`,
  legacyVaultSessions: 'cache:vault:sessions',
  legacyUpdatedAt: 'cache:updatedAt',
};

export type CachedVaultPayload = {
  sessions: VaultSession[];
  updatedAt: string;
};

async function getActiveUserId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.activeUser);
}

export async function setCacheActiveUser(userId: string | null): Promise<void> {
  if (!userId) {
    await AsyncStorage.removeItem(KEYS.activeUser);
    return;
  }
  await AsyncStorage.setItem(KEYS.activeUser, userId);
}

export async function writeVaultSessionsCache(sessions: VaultSession[], userId?: string | null): Promise<void> {
  const activeUserId = userId || (await getActiveUserId());
  if (!activeUserId) return;

  const payload: CachedVaultPayload = {
    sessions,
    updatedAt: new Date().toISOString(),
  };

  await Promise.all([
    AsyncStorage.setItem(KEYS.vaultSessions(activeUserId), JSON.stringify(payload)),
    AsyncStorage.setItem(KEYS.updatedAt(activeUserId), payload.updatedAt),
  ]);

  // Only overwrite per-session detail when the list item is richer, or no detail exists yet.
  await Promise.all(
    sessions.slice(0, 50).map(async (session) => {
      if (!session?.id) return;
      const existing = await readCachedSessionById(session.id, activeUserId);
      if (existing && sessionHasUsableDrills(existing) && !sessionHasUsableDrills(session)) {
        return;
      }
      await AsyncStorage.setItem(KEYS.sessionById(activeUserId, session.id), JSON.stringify(session));
    })
  );
}

export async function writeSessionDetailCache(session: VaultSession, userId?: string | null): Promise<void> {
  const activeUserId = userId || (await getActiveUserId());
  if (!activeUserId || !session?.id) return;

  await AsyncStorage.setItem(KEYS.sessionById(activeUserId, session.id), JSON.stringify(session));

  const list = await readVaultSessionsCache(activeUserId);
  if (!list) {
    await writeVaultSessionsCache([session], activeUserId);
    return;
  }

  const nextSessions = [...list.sessions];
  const index = nextSessions.findIndex((item) => item.id === session.id);
  if (index >= 0) {
    nextSessions[index] = { ...nextSessions[index], ...session };
  } else {
    nextSessions.unshift(session);
  }

  await writeVaultSessionsCache(nextSessions.slice(0, 50), activeUserId);
}

export async function readVaultSessionsCache(userId?: string | null): Promise<CachedVaultPayload | null> {
  const activeUserId = userId || (await getActiveUserId());
  if (!activeUserId) {
    // Legacy fallback during migration
    const legacy = await AsyncStorage.getItem(KEYS.legacyVaultSessions);
    if (!legacy) return null;
    try {
      return JSON.parse(legacy) as CachedVaultPayload;
    } catch {
      return null;
    }
  }

  const raw = await AsyncStorage.getItem(KEYS.vaultSessions(activeUserId));
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as CachedVaultPayload;
    if (!Array.isArray(payload.sessions)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function readCachedSessionById(
  sessionId: string,
  userId?: string | null
): Promise<VaultSession | null> {
  const activeUserId = userId || (await getActiveUserId());
  if (!activeUserId) {
    const legacy = await AsyncStorage.getItem(`cache:vault:session:${sessionId}`);
    if (!legacy) return null;
    try {
      return JSON.parse(legacy) as VaultSession;
    } catch {
      return null;
    }
  }

  const raw = await AsyncStorage.getItem(KEYS.sessionById(activeUserId, sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VaultSession;
  } catch {
    return null;
  }
}

export async function writeUserMetaCache(meta: Record<string, unknown>, userId?: string | null): Promise<void> {
  const activeUserId = userId || (typeof meta.id === 'string' ? meta.id : null) || (await getActiveUserId());
  if (!activeUserId) return;
  await setCacheActiveUser(activeUserId);
  await AsyncStorage.setItem(KEYS.userMeta(activeUserId), JSON.stringify(meta));
}

export async function readUserMetaCache(userId?: string | null): Promise<Record<string, unknown> | null> {
  const activeUserId = userId || (await getActiveUserId());
  if (!activeUserId) return null;
  const raw = await AsyncStorage.getItem(KEYS.userMeta(activeUserId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function readCacheUpdatedAt(userId?: string | null): Promise<string | null> {
  const activeUserId = userId || (await getActiveUserId());
  if (!activeUserId) return AsyncStorage.getItem(KEYS.legacyUpdatedAt);
  return AsyncStorage.getItem(KEYS.updatedAt(activeUserId));
}

export function isCacheStale(updatedAt: string | null | undefined, staleAfterMs = 24 * 60 * 60 * 1000): boolean {
  if (!updatedAt) return true;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > staleAfterMs;
}

export async function clearUserCache(userId?: string | null): Promise<void> {
  const activeUserId = userId || (await getActiveUserId());
  if (!activeUserId) return;

  const list = await readVaultSessionsCache(activeUserId);
  const removals = [
    KEYS.vaultSessions(activeUserId),
    KEYS.updatedAt(activeUserId),
    KEYS.userMeta(activeUserId),
  ];

  if (list?.sessions?.length) {
    for (const session of list.sessions) {
      if (session?.id) removals.push(KEYS.sessionById(activeUserId, session.id));
    }
  }

  await Promise.all(removals.map((key) => AsyncStorage.removeItem(key)));
}
