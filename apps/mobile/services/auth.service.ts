import type { AuthTokens, CurrentUser } from '@aci/shared';
import api, { normalizeApiError } from './api';

type AuthEnvelope = {
  ok: boolean;
  user: CurrentUser;
  tokens: AuthTokens;
};

export async function login(email: string, password: string): Promise<AuthEnvelope> {
  try {
    const response = await api.post<AuthEnvelope>('/auth/login', { email, password });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function register(name: string, email: string, password: string): Promise<AuthEnvelope> {
  try {
    const response = await api.post<AuthEnvelope>('/auth/register', { name, email, password });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    const response = await api.get<{ ok: boolean; user: CurrentUser }>('/auth/me');
    return response.data.user;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function getUsage(): Promise<CurrentUser['limits']> {
  try {
    const response = await api.get<{ ok: boolean; limits: CurrentUser['limits'] }>('/auth/usage');
    return response.data.limits;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function resendVerification(): Promise<void> {
  try {
    await api.post('/auth/resend-verification');
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function forgotPassword(email: string): Promise<void> {
  try {
    await api.post('/auth/password/forgot', { email });
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function resetPassword(token: string, password: string): Promise<void> {
  try {
    await api.post('/auth/password/reset', { token, password });
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function updateProfile(payload: Partial<Pick<CurrentUser, 'name' | 'coachLevel' | 'organizationName'>>): Promise<void> {
  try {
    await api.patch('/auth/me', payload);
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function logout(refreshToken?: string | null): Promise<void> {
  try {
    await api.post('/auth/logout', { refreshToken });
  } catch {
    // Best effort only.
  }
}
