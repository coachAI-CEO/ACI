import { useState } from 'react';
import { requestNotificationPermission } from '../services/notifications.service';

export function useNotifications() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

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
