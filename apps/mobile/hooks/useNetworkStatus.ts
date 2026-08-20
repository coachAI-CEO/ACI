import { useEffect } from 'react';
import { getNetworkSnapshot, subscribeNetworkStatus } from '../services/network.service';
import { useNetworkStore } from '../stores/network.store';

export function useNetworkStatus() {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const setOnlineState = useNetworkStore((s) => s.setOnlineState);

  useEffect(() => {
    getNetworkSnapshot()
      .then((snapshot) => setOnlineState(snapshot.isOnline))
      .catch(() => undefined);

    const unsubscribe = subscribeNetworkStatus((snapshot) => {
      setOnlineState(snapshot.isOnline);
    });

    return unsubscribe;
  }, [setOnlineState]);

  return { isOnline };
}
