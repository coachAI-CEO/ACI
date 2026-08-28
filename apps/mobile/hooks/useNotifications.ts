import { useEffect, useState } from 'react';
import {
  getNotificationPermission,
  requestNotificationPermission,
} from '../services/notifications.service';

export function useNotifications() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    getNotificationPermission()
      .then((granted) => setHasPermission(granted))
      .catch(() => setHasPermission(false));
  }, []);

  const requestPermission = async () => {
    const granted = await requestNotificationPermission();
    setHasPermission(granted);
    return granted;
  };

  return {
    hasPermission,
    requestPermission,
  };
}
