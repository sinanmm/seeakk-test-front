import { io, Socket } from 'socket.io-client';
import { ENV } from '../config/env';
import { SOCKET_IO_CLIENT_PATH } from '../config/socketConstants';
import useAuthStore from '../store/useAuthStore';
import {
  classifySocketErrorMessage,
  explainFailureKind,
} from './realtimeDiagnostics';
import {
  isRefreshAuthFailure,
  isAccessTokenExpired,
  onAccessTokenRefreshed,
  refreshAccessToken,
  resolveValidAccessToken,
} from './authToken';

let socket: Socket | null = null;
let lastSocketUserId: string | null = null;
let authRecoveryInFlight = false;
/** Prevents infinite connect_error → refresh → connect loops on persistent auth failure */
let consecutiveSocketAuthRecoveries = 0;
const MAX_SOCKET_AUTH_RECOVERIES = 8;
let tokenWasRefreshedForSocket = false;
let lastSocketRecoveryAttemptTime = 0;

const readStoredUserId = (): string | null => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string };
    return typeof parsed.id === 'string' ? parsed.id : null;
  } catch {
    return null;
  }
};

/** Socket.IO uses HTTP origin only (see ENV.SOCKET_URL); never use VITE_API_URL directly if it ends with /api */
const getRealtimeBaseUrl = (): string => ENV.SOCKET_URL;

const maxAttempts = Number.parseInt(
  import.meta.env.VITE_SOCKET_MAX_RECONNECT_ATTEMPTS || '5',
  10,
);
const safeMaxAttempts = Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 5;

/**
 * Long-polling only avoids broken WebSocket upgrades (common on Render: browser shows
 * `WebSocket connection to wss://…/socket.io/… failed` even when the app still "works" via polling).
 *
 * - `VITE_SOCKET_TRANSPORTS=polling` — force polling everywhere.
 * - `VITE_SOCKET_TRANSPORTS=websocket` — allow direct WebSocket only after the production proxy is verified.
 * - Default is polling-only to avoid repeated failed WebSocket upgrade handshakes behind reverse proxies.
 */
const resolveSocketTransports = (): ('polling' | 'websocket')[] => {
  const v = String(import.meta.env.VITE_SOCKET_TRANSPORTS || '')
    .trim()
    .toLowerCase();
  if (v === 'polling' || v === 'poll' || v === 'long-polling') return ['polling'];
  if (v === 'websocket' || v === 'ws') return ['websocket'];

  return ['polling'];
};

/**
 * Render / many reverse proxies handle Engine.IO long-polling reliably but intermittently drop
 * the WebSocket upgrade. `rememberUpgrade: true` skips polling on later connects and retries WS
 * first — that surfaces as "WebSocket connection ... failed" in DevTools while the app looks broken.
 */
const socketRememberUpgrade = (): boolean => {
  if (import.meta.env.PROD) return false;
  const v = String(import.meta.env.VITE_SOCKET_REMEMBER_UPGRADE || '')
    .trim()
    .toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return true;
};

const isLikelySocketAuthError = (msg: string): boolean => {
  const lower = msg.toLowerCase();
  return (
    lower.includes('unauthorized') ||
    lower.includes('token') ||
    lower.includes('authentication') ||
    lower.includes('jwt') ||
    lower.includes('auth_error')
  );
};

const applyFreshTokenToSocket = (s: Socket, token: string): void => {
  s.auth = (cb: (data: { token: string }) => void) => {
    void (async () => {
      try {
        const resolved = await resolveValidAccessToken();
        cb({ token: resolved || token || '' });
      } catch {
        cb({ token: token || '' });
      }
    })();
  };
};

const scheduleSocketReconnect = (s: Socket, delayMs = 400): void => {
  setTimeout(() => {
    if (s.disconnected) {
      s.connect();
    }
  }, delayMs);
};

/** Reconnect Engine.IO with the latest access JWT after a successful refresh elsewhere. */
export const reconnectRealtimeWithFreshToken = (): void => {
  if (!socket) return;

  const token = localStorage.getItem('accessToken') || '';
  if (!token) return;

  consecutiveSocketAuthRecoveries = 0;
  tokenWasRefreshedForSocket = false;
  applyFreshTokenToSocket(socket, token);

  if (socket.connected) {
    socket.disconnect();
  }
  scheduleSocketReconnect(socket, 50);
};

onAccessTokenRefreshed((accessToken) => {
  if (!socket || !lastSocketUserId) return;
  applyFreshTokenToSocket(socket, accessToken);
  consecutiveSocketAuthRecoveries = 0;
  tokenWasRefreshedForSocket = false;
  if (!socket.connected) {
    scheduleSocketReconnect(socket, 50);
  }
});

const attachCoreSocketHandlers = (s: Socket, baseUrl: string): void => {
  s.on('connect', () => {
    consecutiveSocketAuthRecoveries = 0;
    tokenWasRefreshedForSocket = false;
  });

  s.on('connect_error', async (err: Error & { message?: string }) => {
    const msg = err?.message || String(err);
    const kind = classifySocketErrorMessage(msg);
    console.warn('[Socket.io] connect_error:', msg);
    console.warn('[Socket.io]', explainFailureKind(kind, baseUrl));

    if (!isLikelySocketAuthError(msg)) return;

    // Rate-limiting cooldown (10 seconds) for socket-triggered refreshes to prevent redundant refresh calls while the network is unstable.
    const now = Date.now();
    const COOLDOWN_MS = 10000;
    if (now - lastSocketRecoveryAttemptTime < COOLDOWN_MS) {
      console.warn('[Socket.io] Socket auth recovery cooldown active — letting Socket.IO retry with built-in backoff');
      return;
    }

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      const accessToken = localStorage.getItem('accessToken') || '';
      if (!accessToken || isAccessTokenExpired(accessToken)) {
        console.warn('[Socket.io] Auth handshake failed, token is expired, and no refresh token — clearing session');
        useAuthStore.getState().clearAuth();
        return;
      }

      console.warn(
        '[Socket.io] Auth handshake failed but access token is still valid and no refresh token exists — keeping session and pausing realtime reconnects',
      );
      s.disconnect();
      return;
    }

    if (authRecoveryInFlight) return;

    // If we already refreshed the token for the socket connection once, and we STILL got an auth error,
    // then increment the consecutive recoveries counter.
    if (tokenWasRefreshedForSocket) {
      consecutiveSocketAuthRecoveries += 1;
      tokenWasRefreshedForSocket = false;
    }

    if (consecutiveSocketAuthRecoveries >= MAX_SOCKET_AUTH_RECOVERIES) {
      console.warn('[Socket.io] Too many auth recovery attempts — clearing session');
      useAuthStore.getState().clearAuth();
      return;
    }

    lastSocketRecoveryAttemptTime = now;
    authRecoveryInFlight = true;
    try {
      const newToken = await refreshAccessToken();
      tokenWasRefreshedForSocket = true;
      applyFreshTokenToSocket(s, newToken);
      s.connect();
    } catch (e) {
      if (isRefreshAuthFailure(e)) {
        console.warn('[Socket.io] Refresh failed after auth error — clearing session');
        useAuthStore.getState().clearAuth();
      } else {
        console.warn(
          '[Socket.io] Auth error but refresh failed transiently; leaving session intact for retry',
        );
      }
    } finally {
      authRecoveryInFlight = false;
    }
  });

  s.on('disconnect', (reason) => {
    console.log('Socket Disconnected');
    console.info('[Socket.io] disconnect:', reason);
    if (reason === 'io server disconnect') {
      console.warn('[Socket.io] Server closed the connection');
      return;
    }
    if (
      reason === 'transport error' ||
      reason === 'ping timeout' ||
      reason === 'transport close'
    ) {
      console.warn('[Socket.io] Transport dropped - Socket.IO will automatically reconnect');
    }
  });

  s.on('reconnect', (attemptNumber) => {
    console.info('[Socket.io] Reconnected after attempts:', attemptNumber);
  });

  s.on('reconnect_attempt', () => {
    console.log('Reconnect Attempt');
  });

  s.on('reconnect_error', (err: Error) => {
    console.warn('[Socket.io] reconnect_error:', err?.message || String(err));
  });

  s.on('reconnect_failed', () => {
    console.log('Maximum Retries Reached');
    console.error(
      `[Socket.io] Reconnect exhausted (${safeMaxAttempts} attempts). Verify ${baseUrl}/healthz returns JSON and Vercel has VITE_SOCKET_URL or VITE_API_URL (socket origin is derived from API URL).`,
    );
  });
};

/**
 * Ensures a single Socket.IO client for the logged-in user.
 * Auth payload is resolved on every Engine.IO open so reconnects use a fresh access JWT.
 */
export const connectRealtime = (): Socket | null => {
  const baseUrl = getRealtimeBaseUrl();
  const userId = readStoredUserId();
  const accessToken = localStorage.getItem('accessToken') || '';
  const hasAccess = Boolean(accessToken);
  const refreshToken = localStorage.getItem('refreshToken');

  if (!userId || !hasAccess) {
    disconnectRealtime();
    return null;
  }

  if (isAccessTokenExpired(accessToken) && !refreshToken) {
    console.warn('[Socket.io] Access token expired and refresh token is missing — clearing session');
    useAuthStore.getState().clearAuth();
    disconnectRealtime();
    return null;
  }

  if (socket && lastSocketUserId === userId) {
    if (!socket.connected) {
      if (isAccessTokenExpired(accessToken) && refreshToken) {
        void resolveValidAccessToken().then((validToken) => {
          if (validToken && socket && !socket.connected) {
            applyFreshTokenToSocket(socket, validToken);
            socket.connect();
          }
        });
      } else {
        applyFreshTokenToSocket(socket, accessToken);
        socket.connect();
      }
    }
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  lastSocketUserId = userId;

  const transports = resolveSocketTransports();
  const pollingOnly = transports.length === 1 && transports[0] === 'polling';
  socket = io(baseUrl, {
    path: SOCKET_IO_CLIENT_PATH,
    transports,
    upgrade: !pollingOnly,
    withCredentials: true,
    rememberUpgrade: socketRememberUpgrade(),
    auth: (cb) => {
      void (async () => {
        try {
          const token = await resolveValidAccessToken();
          cb({ token: token || '' });
        } catch {
          cb({ token: '' });
        }
      })();
    },
    reconnection: true,
    reconnectionAttempts: safeMaxAttempts,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
    randomizationFactor: 0.5,
    timeout: 30000,
    autoConnect: true,
  });

  attachCoreSocketHandlers(socket, baseUrl);

  return socket;
};

export const disconnectRealtime = (): void => {
  lastSocketUserId = null;
  authRecoveryInFlight = false;
  consecutiveSocketAuthRecoveries = 0;
  tokenWasRefreshedForSocket = false;
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
};

export const getSocket = (): Socket | null => socket;
