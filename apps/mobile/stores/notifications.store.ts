import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type NotificationState = {
  sessionRemindersEnabled: boolean;
  weeklySummaryEnabled: boolean;
  setSessionRemindersEnabled: (enabled: boolean) => void;
  setWeeklySummaryEnabled: (enabled: boolean) => void;
};

export const useNotificationsStore = create<NotificationState>()(
  persist(
    (set) => ({
      sessionRemindersEnabled: true,
      weeklySummaryEnabled: true,
      setSessionRemindersEnabled: (sessionRemindersEnabled) => set({ sessionRemindersEnabled }),
      setWeeklySummaryEnabled: (weeklySummaryEnabled) => set({ weeklySummaryEnabled }),
    }),
    {
      name: 'notifications-settings-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
