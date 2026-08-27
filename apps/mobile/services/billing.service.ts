import api, { normalizeApiError } from './api';
import * as Linking from 'expo-linking';
import { webPath } from '../constants/web';

export async function openBillingPortal(returnUrl?: string): Promise<void> {
  try {
    const response = await api.post<{ ok: boolean; url: string }>('/billing/customer-portal', {
      returnUrl,
    });
    if (!response.data.url) {
      throw new Error('Billing portal URL missing');
    }
    await Linking.openURL(response.data.url);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

/** Opens public pricing / upgrade page in the system browser. */
export async function openUpgradePricing(): Promise<void> {
  await Linking.openURL(webPath('/pricing'));
}
