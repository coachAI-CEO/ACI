import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type CoachCenterState = {
  selectedTeamId: string | null;
  setSelectedTeamId: (teamId: string | null) => void;
};

export const useCoachCenterStore = create<CoachCenterState>()(
  persist(
    (set) => ({
      selectedTeamId: null,
      setSelectedTeamId: (selectedTeamId) => set({ selectedTeamId }),
    }),
    {
      name: 'coach-center-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
