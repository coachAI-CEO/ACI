import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useNetworkStatus } from './useNetworkStatus';
import { useOfflineStore } from '../stores/offline.store';
import { listBoards } from '../services/boards.service';
import {
  readBoardsCache,
  setCacheActiveUser,
  writeBoardsCache,
} from '../services/offline-cache.service';

/**
 * Keeps the offline boards list warm:
 * - loads user-scoped cache on login
 * - refreshes from network when connectivity returns or cache is empty
 *
 * Mirrors `useOfflineVaultSync`. List writes also seed per-board detail
 * stubs so the detail screen can fall back when offline.
 */
export function useOfflineBoardsSync() {
  const { user, isAuthenticated } = useAuth();
  const { isOnline } = useNetworkStatus();
  const setCachedBoards = useOfflineStore((s) => s.setCachedBoards);
  const wasOnline = useRef(isOnline);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    setCacheActiveUser(user.id).catch(() => undefined);
    readBoardsCache(user.id)
      .then((payload) => {
        if (!payload) return;
        setCachedBoards(payload.boards, payload.updatedAt);
      })
      .catch(() => undefined);
  }, [isAuthenticated, user?.id, setCachedBoards]);

  useEffect(() => {
    const cameOnline = !wasOnline.current && isOnline;
    wasOnline.current = isOnline;

    if (!isAuthenticated || !user?.id || !isOnline) return;
    if (!cameOnline && useOfflineStore.getState().cachedBoards.length) return;

    listBoards(40)
      .then(async (result) => {
        await writeBoardsCache(result.boards, user.id);
        setCachedBoards(result.boards, new Date().toISOString());
      })
      .catch(() => undefined);
  }, [isAuthenticated, user?.id, isOnline, setCachedBoards]);
}
