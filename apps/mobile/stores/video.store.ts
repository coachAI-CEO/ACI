import { create } from 'zustand';

type VideoState = {
  latestAnalysis: any | null;
  latestContext: Record<string, unknown> | null;
  setLatestAnalysis: (analysis: any | null, context?: Record<string, unknown> | null) => void;
};

export const useVideoStore = create<VideoState>((set) => ({
  latestAnalysis: null,
  latestContext: null,
  setLatestAnalysis: (latestAnalysis, latestContext = null) => set({ latestAnalysis, latestContext }),
}));
