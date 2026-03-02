import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type GenerateType = 'drill' | 'session' | 'series';

export type GenerateFormState = {
  ageGroup: string;
  playerLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  coachLevel: 'GRASSROOTS' | 'USSF_C' | 'USSF_B_PLUS';
  gameModelId: 'POSSESSION' | 'PRESSING' | 'TRANSITION' | 'COACHAI';
  phase: 'ATTACKING' | 'DEFENDING' | 'TRANSITION_TO_ATTACK' | 'TRANSITION_TO_DEFEND';
  zone: 'DEFENSIVE_THIRD' | 'MIDDLE_THIRD' | 'ATTACKING_THIRD';
  durationMin: 60 | 90;
  numbersMin: number;
  numbersMax: number;
  goalsAvailable: number;
  spaceConstraint: 'QUARTER' | 'THIRD' | 'HALF' | 'FULL';
  formationUsed: string;
  formationAttacking: string;
  formationDefending: string;
  numberOfSessions: number;
};

type GenerateStore = {
  activeType: GenerateType;
  form: GenerateFormState;
  latestDrill: unknown | null;
  latestSession: unknown | null;
  latestSeries: unknown | null;
  setActiveType: (type: GenerateType) => void;
  patchForm: (patch: Partial<GenerateFormState>) => void;
  setLatestDrill: (data: unknown | null) => void;
  setLatestSession: (data: unknown | null) => void;
  setLatestSeries: (data: unknown | null) => void;
  resetLatest: () => void;
};

const defaultForm: GenerateFormState = {
  ageGroup: 'U14',
  playerLevel: 'INTERMEDIATE',
  coachLevel: 'USSF_C',
  gameModelId: 'PRESSING',
  phase: 'ATTACKING',
  zone: 'MIDDLE_THIRD',
  durationMin: 60,
  numbersMin: 6,
  numbersMax: 12,
  goalsAvailable: 2,
  spaceConstraint: 'HALF',
  formationUsed: '4-3-3',
  formationAttacking: '4-3-3',
  formationDefending: '4-4-2',
  numberOfSessions: 3,
};

export const useGenerateStore = create<GenerateStore>()(
  persist(
    (set) => ({
      activeType: 'session',
      form: defaultForm,
      latestDrill: null,
      latestSession: null,
      latestSeries: null,
      setActiveType: (activeType) => set({ activeType }),
      patchForm: (patch) => set((state) => ({ form: { ...state.form, ...patch } })),
      setLatestDrill: (latestDrill) => set({ latestDrill }),
      setLatestSession: (latestSession) => set({ latestSession }),
      setLatestSeries: (latestSeries) => set({ latestSeries }),
      resetLatest: () => set({ latestDrill: null, latestSession: null, latestSeries: null }),
    }),
    {
      name: 'generate-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ activeType: state.activeType, form: state.form }),
    }
  )
);
