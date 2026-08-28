import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import { useOfflineStore } from '../stores/offline.store';
import { getVaultSessions } from '../services/vault.service';
import {
  readVaultSessionsCache,
  setCacheActiveUser,
  writeVaultSessionsCache,
} from '../services/offline-cache.service';

/**
 * Keeps the offline vault list warm:
 * - loads user-scoped cache on login
 * - refreshes from network when connectivity returns
 */
export function useOfflineVaultSync() {
  const { user, isAuthenticated } = useAuth();
  const { isOnline } = useNetworkStatus();
  const setCachedSessions = useOfflineStore((s) => s.setCachedSessions);
  const wasOnline = useRef(isOnline);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    setCacheActiveUser(user.id).catch(() => undefined);
    readVaultSessionsCache(user.id)
      .then((payload) => {
        if (!payload) return;
        setCachedSessions(payload.sessions, payload.updatedAt);
      })
      .catch(() => undefined);
  }, [isAuthenticated, user?.id, setCachedSessions]);

  useEffect(() => {
    const cameOnline = !wasOnline.current && isOnline;
    wasOnline.current = isOnline;

    if (!isAuthenticated || !user?.id || !isOnline) return;
    if (!cameOnline && useOfflineStore.getState().cachedSessions.length) return;

    getVaultSessions({ limit: 30, offset: 0 })
      .then(async (result) => {
        await writeVaultSessionsCache(result.sessions, user.id);
        setCachedSessions(result.sessions, new Date().toISOString());
      })
      .catch(() => undefined);
  }, [isAuthenticated, user?.id, isOnline, setCachedSessions]);
}
