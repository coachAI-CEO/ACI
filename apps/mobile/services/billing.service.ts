import api, { normalizeApiError } from './api';
import * as Linking from 'expo-linking';

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
