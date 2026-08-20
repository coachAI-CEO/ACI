import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type VaultTab = 'sessions' | 'series' | 'drills';

type VaultFilters = {
  search: string;
  ageGroup: string;
  gameModelId: string;
  phase: string;
  zone: string;
};

type VaultState = {
  activeTab: VaultTab;
  filters: VaultFilters;
  setActiveTab: (tab: VaultTab) => void;
  patchFilters: (next: Partial<VaultFilters>) => void;
  clearFilters: () => void;
};

const initialFilters: VaultFilters = {
  search: '',
  ageGroup: '',
  gameModelId: '',
  phase: '',
  zone: '',
};

export const useVaultStore = create<VaultState>()(
  persist(
    (set) => ({
      activeTab: 'sessions',
      filters: initialFilters,
      setActiveTab: (activeTab) => set({ activeTab }),
      patchFilters: (next) => set((state) => ({ filters: { ...state.filters, ...next } })),
      clearFilters: () => set({ filters: initialFilters }),
    }),
    {
      name: 'vault-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
