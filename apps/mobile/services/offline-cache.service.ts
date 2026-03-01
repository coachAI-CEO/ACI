import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VaultSession } from './vault.service';

const KEYS = {
  vaultSessions: 'cache:vault:sessions',
  sessionById: (sessionId: string) => `cache:vault:session:${sessionId}`,
  userMeta: 'cache:user:meta',
  updatedAt: 'cache:updatedAt',
};

export type CachedVaultPayload = {
  sessions: VaultSession[];
  updatedAt: string;
};

export async function writeVaultSessionsCache(sessions: VaultSession[]): Promise<void> {
  const payload: CachedVaultPayload = {
    sessions,
    updatedAt: new Date().toISOString(),
  };

  await Promise.all([
    AsyncStorage.setItem(KEYS.vaultSessions, JSON.stringify(payload)),
    AsyncStorage.setItem(KEYS.updatedAt, payload.updatedAt),
  ]);

  await Promise.all(
    sessions.slice(0, 50).map((session) =>
      AsyncStorage.setItem(KEYS.sessionById(session.id), JSON.stringify(session))
    )
  );
}

export async function readVaultSessionsCache(): Promise<CachedVaultPayload | null> {
  const raw = await AsyncStorage.getItem(KEYS.vaultSessions);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as CachedVaultPayload;
    if (!Array.isArray(payload.sessions)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function readCachedSessionById(sessionId: string): Promise<VaultSession | null> {
  const raw = await AsyncStorage.getItem(KEYS.sessionById(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VaultSession;
  } catch {
    return null;
  }
}

export async function writeUserMetaCache(meta: Record<string, unknown>): Promise<void> {
  await AsyncStorage.setItem(KEYS.userMeta, JSON.stringify(meta));
}

export async function readUserMetaCache(): Promise<Record<string, unknown> | null> {
  const raw = await AsyncStorage.getItem(KEYS.userMeta);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function readCacheUpdatedAt(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.updatedAt);
}
