import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from '../utils/secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ApiError = {
  status: number;
  message: string;
  code?: string;
};

type ApiErrorBody = {
  error?: string;
  message?: string;
  code?: string;
};

function isApiError(error: unknown): error is ApiError {
  // Must be our plain normalized object — not an AxiosError/Error (those also have message/status).
  return (
    typeof error === 'object' &&
    error !== null &&
    !(error instanceof Error) &&
    !axios.isAxiosError(error) &&
    typeof (error as ApiError).status === 'number' &&
    typeof (error as ApiError).message === 'string'
  );
}

export function normalizeApiError(error: unknown): ApiError {
  // Interceptors already normalize; avoid wiping the real message on re-normalize.
  if (isApiError(error)) {
    return error;
  }
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data = error.response?.data as ApiErrorBody | undefined;
    if (!error.response) {
      const hint =
        error.code === 'ERR_NETWORK' || error.message === 'Network Error'
          ? `Cannot reach API at ${API_URL}. Check EXPO_PUBLIC_API_URL and your connection.`
          : error.message || 'Network request failed';
      return { status: 0, message: hint };
    }
    const message = data?.error ?? data?.message ?? error.message ?? 'Request failed';
    return { status, message, code: data?.code };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }
  return { status: 500, message: 'Unknown error' };
}

export function describeApiError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const normalized = isApiError(error) ? error : normalizeApiError(error);

  if (normalized.code === 'TRIALS_CLOSED' || normalized.status === 503) {
    return normalized.message || 'Free trials are currently closed. Contact support or manage billing on the web.';
  }

  if (normalized.status === 403) {
    if (/club vault/i.test(normalized.message)) {
      return 'This item is outside your club vault.';
    }
    if (/video/i.test(normalized.message) || /review/i.test(normalized.message)) {
      return 'Video review is not enabled for your account. Ask an admin to grant access.';
    }
    return normalized.message || 'You do not have permission to do that.';
  }

  return normalized.message || fallback;
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
    const url = originalRequest.url || '';
    const isAuthCredentialRequest =
      url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh');

    // Don't attempt token refresh for bad login/register credentials.
    if (status !== 401 || originalRequest._retry || isAuthCredentialRequest) {
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
