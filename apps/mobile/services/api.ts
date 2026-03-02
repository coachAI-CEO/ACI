import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from '../utils/secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ApiError = {
  status: number;
  message: string;
};

export function normalizeApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 500;
    const message =
      (error.response?.data as { error?: string; message?: string } | undefined)?.error ??
      (error.response?.data as { error?: string; message?: string } | undefined)?.message ??
      error.message ??
      'Request failed';
    return { status, message };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }
  return { status: 500, message: 'Unknown error' };
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 120_000,
});

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return config;
  }

  const headers = config.headers instanceof AxiosHeaders ? config.headers : new AxiosHeaders(config.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  config.headers = headers;
  return config;
});

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await axios.post<{ ok: boolean; accessToken: string; refreshToken: string }>(
        `${API_URL}/auth/refresh`,
        { refreshToken },
        { timeout: 30_000 }
      );

      await setAuthTokens(response.data.accessToken, response.data.refreshToken || refreshToken);
      return response.data.accessToken;
    } catch {
      await clearAuthTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!originalRequest) {
      throw normalizeApiError(error);
    }

    const status = error.response?.status;
    const isRefreshEndpoint = originalRequest.url?.includes('/auth/refresh');

    if (status !== 401 || originalRequest._retry || isRefreshEndpoint) {
      throw normalizeApiError(error);
    }

    originalRequest._retry = true;
    const nextAccessToken = await refreshAccessToken();

    if (!nextAccessToken) {
      throw normalizeApiError(error);
    }

    const headers =
      originalRequest.headers instanceof AxiosHeaders
        ? originalRequest.headers
        : new AxiosHeaders(originalRequest.headers);
    headers.set('Authorization', `Bearer ${nextAccessToken}`);
    originalRequest.headers = headers;

    return api.request(originalRequest);
  }
);

export default api;
