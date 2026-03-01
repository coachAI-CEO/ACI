import { create } from 'zustand';
import type { CurrentUser } from '@aci/shared';
import * as authService from '../services/auth.service';
import { clearAuthTokens, getRefreshToken, setAuthTokens } from '../utils/secure-store';
import type { ApiError } from '../services/api';
import { writeUserMetaCache } from '../services/offline-cache.service';

type AuthState = {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isLoading: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  updateProfile: (payload: Partial<Pick<CurrentUser, 'name' | 'coachLevel' | 'organizationName'>>) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

function toErrorMessage(error: unknown): string {
  return (error as ApiError)?.message || 'Something went wrong. Please try again.';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
  isLoading: false,
  error: null,

  bootstrap: async () => {
    set({ isBootstrapping: true, error: null });
    try {
      const user = await authService.getCurrentUser();
      await writeUserMetaCache({
        id: user.id,
        name: user.name,
        subscriptionPlan: user.subscriptionPlan,
        features: user.features,
      });
      set({ user, isAuthenticated: true });
    } catch {
      await clearAuthTokens();
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isBootstrapping: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const payload = await authService.login(email.trim().toLowerCase(), password);
      await setAuthTokens(payload.tokens.accessToken, payload.tokens.refreshToken);
      const user = await authService.getCurrentUser();
      await writeUserMetaCache({
        id: user.id,
        name: user.name,
        subscriptionPlan: user.subscriptionPlan,
        features: user.features,
      });
      set({ user, isAuthenticated: true });
    } catch (error) {
      set({ error: toErrorMessage(error), isAuthenticated: false, user: null });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const payload = await authService.register(name, email.trim().toLowerCase(), password);
      await setAuthTokens(payload.tokens.accessToken, payload.tokens.refreshToken);
      const user = await authService.getCurrentUser();
      await writeUserMetaCache({
        id: user.id,
        name: user.name,
        subscriptionPlan: user.subscriptionPlan,
        features: user.features,
      });
      set({ user, isAuthenticated: true });
    } catch (error) {
      set({ error: toErrorMessage(error) });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  refreshCurrentUser: async () => {
    const user = await authService.getCurrentUser();
    set({ user, isAuthenticated: true });
  },

  updateProfile: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      await authService.updateProfile(payload);
      await get().refreshCurrentUser();
    } catch (error) {
      set({ error: toErrorMessage(error) });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      const refreshToken = await getRefreshToken();
      await authService.logout(refreshToken);
    } finally {
      await clearAuthTokens();
      set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    }
  },

  clearError: () => set({ error: null }),
}));
