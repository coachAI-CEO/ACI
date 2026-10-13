import { useEffect } from 'react';
import { readVaultSessionsCache } from '../services/offline-cache.service';
import { useOfflineStore } from '../stores/offline.store';

export function useOfflineVault() {
  const cachedSessions = useOfflineStore((s) => s.cachedSessions);
  const cacheUpdatedAt = useOfflineStore((s) => s.cacheUpdatedAt);
  const setCachedSessions = useOfflineStore((s) => s.setCachedSessions);

  useEffect(() => {
    readVaultSessionsCache()
      .then((payload) => {
        if (!payload) return;
        setCachedSessions(payload.sessions, payload.updatedAt);
      })
      .catch(() => undefined);
  }, [setCachedSessions]);

  return {
    cachedSessions,
    cacheUpdatedAt,
  };
}
