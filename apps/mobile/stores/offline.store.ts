import { create } from 'zustand';
import type { VaultSession } from '../services/vault.service';

type OfflineState = {
  cachedSessions: VaultSession[];
  cacheUpdatedAt: string | null;
  setCachedSessions: (sessions: VaultSession[], updatedAt: string | null) => void;
};

export const useOfflineStore = create<OfflineState>((set) => ({
  cachedSessions: [],
  cacheUpdatedAt: null,
  setCachedSessions: (cachedSessions, cacheUpdatedAt) => set({ cachedSessions, cacheUpdatedAt }),
}));
