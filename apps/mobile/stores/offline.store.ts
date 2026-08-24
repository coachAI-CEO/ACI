import { create } from 'zustand';
import type { BoardListItem } from '../services/boards.service';
import type { VaultSession } from '../services/vault.service';

type OfflineState = {
  cachedSessions: VaultSession[];
  cacheUpdatedAt: string | null;
  cachedBoards: BoardListItem[];
  boardsCacheUpdatedAt: string | null;
  setCachedSessions: (sessions: VaultSession[], updatedAt: string | null) => void;
  setCachedBoards: (boards: BoardListItem[], updatedAt: string | null) => void;
};

export const useOfflineStore = create<OfflineState>((set) => ({
  cachedSessions: [],
  cacheUpdatedAt: null,
  cachedBoards: [],
  boardsCacheUpdatedAt: null,
  setCachedSessions: (cachedSessions, cacheUpdatedAt) => set({ cachedSessions, cacheUpdatedAt }),
  setCachedBoards: (cachedBoards, boardsCacheUpdatedAt) =>
    set({ cachedBoards, boardsCacheUpdatedAt }),
}));
