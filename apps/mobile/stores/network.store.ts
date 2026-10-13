import { create } from 'zustand';

type NetworkState = {
  isOnline: boolean;
  wasOffline: boolean;
  setOnlineState: (isOnline: boolean) => void;
};

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,
  wasOffline: false,
  setOnlineState: (isOnline) =>
    set((state) => ({
      isOnline,
      wasOffline: state.wasOffline || !isOnline,
    })),
}));
