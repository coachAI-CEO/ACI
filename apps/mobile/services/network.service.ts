import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export type NetworkSnapshot = {
  isOnline: boolean;
};

export function toIsOnline(state: NetInfoState): boolean {
  if (typeof state.isInternetReachable === 'boolean') {
    return Boolean(state.isConnected && state.isInternetReachable);
  }
  return Boolean(state.isConnected);
}

export async function getNetworkSnapshot(): Promise<NetworkSnapshot> {
  const state = await NetInfo.fetch();
  return { isOnline: toIsOnline(state) };
}

export function subscribeNetworkStatus(callback: (snapshot: NetworkSnapshot) => void): () => void {
  return NetInfo.addEventListener((state) => {
    callback({ isOnline: toIsOnline(state) });
  });
}
