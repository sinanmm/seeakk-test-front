import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import useAuthStore from '../store/useAuthStore';
import { ENV } from '../config/env';
import {
  isRefreshAuthFailure,
  resolveValidAccessToken,
  refreshAccessToken,
} from './authToken';
import { ensureBackendReachable } from './backendWarmup';
import { MANDATORY_FOLLOWUP_QUERY_KEY } from '../constants/mandatoryFollowup.constants';
import { OVERDUE_MANDATORY_QUERY_KEY } from '../hooks/useOverdueMandatoryFollowUps';
import { queryClient } from '../lib/queryClient';

const API_URL = ENV.API_URL;

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _suppressGlobalErrorToast?: boolean;
}

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Generate or retrieve persistent device ID
let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
  deviceId =
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  localStorage.setItem('deviceId', deviceId);
}

let isRedirectingToLogin = false;

export const handleSessionExpired = (): void => {
  useAuthStore.getState().clearAuth();
  redirectToLogin();
};

const redirectToLogin = () => {
  if (typeof window === 'undefined' || isRedirectingToLogin) return;
  isRedirectingToLogin = true;

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const alreadyOnLogin = window.location.pathname === '/login';

  if (alreadyOnLogin) {
    isRedirectingToLogin = false;
    return;
  }

  const next = encodeURIComponent(currentPath);
  window.location.replace(`/login?next=${next}&reason=session-expired`);
};

const clearExpiredSession = () => {
  handleSessionExpired();
};

let backendReadyChain: Promise<boolean> = Promise.resolve(true);

const isAuthRoute = (url?: string): boolean =>
  Boolean(
    url?.includes('/auth/login') ||
      url?.includes('/auth/google') ||
      url?.includes('/auth/refresh') ||
      url?.includes('/auth/forgot-password') ||
      url?.includes('/auth/reset-password'),
  );

const setAuthorizationHeader = (
  config: InternalAxiosRequestConfig,
  accessToken: string,
): void => {
  if (!config.headers) return;
  if (typeof (config.headers as { set?: unknown }).set === 'function') {
    (config.headers as { set: (key: string, value: string) => void }).set(
      'Authorization',
      `Bearer ${accessToken}`,
    );
    return;
  }
  config.headers.Authorization = `Bearer ${accessToken}`;
};

// Add a request interceptor to attach tokens AND proactively refresh
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (!config.headers) return config;

    config.headers['x-device-id'] = deviceId as string;

    if (!isAuthRoute(config.url)) {
      // Fire health check in the background, but do not wait for it to prevent blocking the dashboard
      backendReadyChain = backendReadyChain.then(() => ensureBackendReachable());
    }

    if (isAuthRoute(config.url)) {
      return config;
    }

    try {
      const accessToken = await resolveValidAccessToken();
      if (accessToken) {
        setAuthorizationHeader(config, accessToken);
      }
    } catch (err) {
      if (isRefreshAuthFailure(err)) {
        clearExpiredSession();
      }
      return Promise.reject(err);
    }

    return config;
  },
  (error) => Promise.reject(error),
);

import axiosRetry from 'axios-retry';

// Configure axios-retry for transient failures
axiosRetry(api, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error: AxiosError) => {
    // Retry on 502, 503, 504 and network interruptions
    if (!error.response && error.message === 'Network Error') return true;
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) return true;
    const status = error.response?.status;
    if (status && [502, 503, 504].includes(status)) return true;
    // Do NOT retry 400, 401, 403, 404, 500 (since 500 usually implies hard backend crash, but we only retry transient ones)
    return false;
  },
});

// Add a response interceptor for fallback coverage
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    if (!originalRequest || !originalRequest.url) {
      return Promise.reject(error);
    }

    if (isAuthRoute(originalRequest.url)) {
      return Promise.reject(error);
    }

    const showToastError = (message: string, id?: string) => {
      if (originalRequest._suppressGlobalErrorToast) return;
      import('react-hot-toast').then(({ toast }) => {
        toast.error(message, { id: id || 'api-error' });
      });
    };

    // Differentiate error types instead of generic CORS
    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        showToastError('Connection Timeout: The server took too long to respond.');
      } else if (error.message === 'Network Error') {
        showToastError('Server temporarily unreachable. Please try again in a moment.', 'server-unreachable');
      }
      error.isAxiosError = false; 
      return Promise.reject(error);
    }

    const status = error.response.status;
    
    // Explicit error messaging
    if (status >= 500 && status !== 502 && status !== 503 && status !== 504) {
      showToastError('Internal Server Error: Something went wrong on our end.');
    } else if (status === 404) {
      if (!(originalRequest as any)?._suppressGlobalErrorToast && !(originalRequest as any)?._suppress404Log && !originalRequest.url?.includes('/profile-image')) {
        console.warn('API 404 Not Found:', originalRequest.url);
      }
    } else if (status === 403) {
      showToastError('Forbidden: You do not have permission to perform this action.');
    } else if (status === 400) {
      const data = error.response.data as any;
      if (data?.message) {
        showToastError(`Validation Error: ${data.message}`);
      }
    } else if (status === 429) {
      const data = error.response.data as any;
      const message =
        data?.message ||
        "You're processing requests very quickly. Please wait a few seconds and try again.";
      showToastError(message, 'rate-limit-429');
      return Promise.reject(error);
    }

    if (status === 423) {
      const payload = error.response.data as {
        errorCode?: string;
        mandatoryFollowupRequired?: boolean;
        mandatoryFollowupCount?: number;
        overdueFollowupCount?: number;
      };
      const lockCount =
        payload?.overdueFollowupCount ??
        payload?.mandatoryFollowupCount ??
        0;
      if (payload?.errorCode === 'MANDATORY_FOLLOWUP_REQUIRED') {
        useAuthStore.getState().setMandatoryFollowupBlock(true, lockCount);
        void queryClient.invalidateQueries({ queryKey: MANDATORY_FOLLOWUP_QUERY_KEY });
      }
      void queryClient.invalidateQueries({ queryKey: OVERDUE_MANDATORY_QUERY_KEY });
      return Promise.reject(error);
    }

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newAccessToken = await refreshAccessToken();
        setAuthorizationHeader(originalRequest, newAccessToken);
        return api(originalRequest);
      } catch (err) {
        if (isRefreshAuthFailure(err)) {
          clearExpiredSession();
          return Promise.reject(err);
        }
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
