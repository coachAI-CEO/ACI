import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CoachLevel, GameModelId, PlayerLevel } from '@aci/shared';
import type { DrillType, Phase, SpaceConstraint, Zone } from '@aci/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type GenerateType = 'drill' | 'session' | 'series';

export type GenerateFormState = {
  ageGroup: string;
  playerLevel: PlayerLevel;
  coachLevel: CoachLevel;
  gameModelId: GameModelId;
  phase: Phase;
  zone: Zone;
  topic: string | null;
  durationMin: 60 | 90;
  /** Drill-specific duration (independent of session duration). Used only when activeType === 'drill'. */
  drillDurationMin: number;
  numbersMin: number;
  numbersMax: number;
  goalsAvailable: number;
  spaceConstraint: SpaceConstraint;
  formationUsed: string;
  formationAttacking: string;
  formationDefending: string;
  drillType: DrillType | null;
  gkOptional: boolean;
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
  topic: null,
  durationMin: 60,
  drillDurationMin: 20,
  numbersMin: 6,
  numbersMax: 12,
  goalsAvailable: 2,
  spaceConstraint: 'HALF',
  formationUsed: '4-3-3',
  formationAttacking: '4-3-3',
  formationDefending: '4-4-2',
  drillType: null,
  gkOptional: false,
  numberOfSessions: 3,
};

function migrateLegacyForm(form: Partial<GenerateFormState> | undefined): GenerateFormState {
  const next = { ...defaultForm, ...(form || {}) };
  if ((next.coachLevel as string) === 'GRASSROOTS') {
    next.coachLevel = 'USSF_D';
  }
  // Migrate legacy 4-way phase enum to the 3-way web-aligned enum.
  const legacyPhase = next.phase as string;
  if (
    legacyPhase === 'TRANSITION_TO_ATTACK' ||
    legacyPhase === 'TRANSITION_TO_DEFEND'
  ) {
    next.phase = 'TRANSITION';
  }
  // Backfill new optional fields.
  if (typeof (next as any).topic === 'undefined') next.topic = null;
  if (typeof (next as any).drillType === 'undefined') next.drillType = null;
  if (typeof (next as any).gkOptional !== 'boolean') next.gkOptional = false;
  if (typeof (next as any).drillDurationMin !== 'number') next.drillDurationMin = 20;
  return next;
}

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
      name: 'generate-store-v3',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ activeType: state.activeType, form: state.form }),
      merge: (persisted, current) => {
        const typed = persisted as Partial<GenerateStore> | undefined;
        return {
          ...current,
          ...typed,
          form: migrateLegacyForm(typed?.form),
        };
      },
    }
  )
);