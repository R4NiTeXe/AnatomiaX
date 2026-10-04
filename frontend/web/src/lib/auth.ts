/**
 * Authentication client — session tokens live in module memory only.
 * The refresh token additionally travels in an httpOnly cookie managed by
 * the backend; application code never reads it and nothing is persisted
 * to localStorage.
 */
import { ApiError, apiRequest, buildApiUrl } from './api';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  createdAt: string;
}

export interface SessionBody {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshInflight: Promise<boolean> | null = null;
// Set when a shared refresh cycle starts: concurrent 401 waiters must notify
// listeners exactly once when that cycle fails (not once per waiter).
let refreshCycleNotified = false;

type UnauthListener = () => void;
const unauthListeners = new Set<UnauthListener>();

export function onUnauthenticated(listener: UnauthListener): () => void {
  unauthListeners.add(listener);
  return () => {
    unauthListeners.delete(listener);
  };
}

function emitUnauthenticated(): void {
  accessToken = null;
  refreshToken = null;
  unauthListeners.forEach(listener => {
    try {
      listener();
    } catch {
      // Listener failures must never break request handling.
    }
  });
}

export function hasSession(): boolean {
  return accessToken !== null;
}

/** For tests only — resets module state. */
export function __resetAuthForTests(): void {
  accessToken = null;
  refreshToken = null;
  refreshInflight = null;
  refreshCycleNotified = false;
}

async function doRefresh(): Promise<boolean> {
  try {
    const body = await apiRequest<SessionBody>('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
    });
    accessToken = body.accessToken;
    refreshToken = body.refreshToken;
    return true;
  } catch (error) {
    // Only 401/403 means the session is dead. Network failures, timeouts,
    // and 5xx are transient — rethrow so the caller surfaces a retry instead
    // of clearing tokens and logging the user out on a blip.
    if (error instanceof ApiError && error.status !== 401 && error.status !== 403) {
      throw error;
    }
    return false;
  }
}

/**
 * Authenticated request. Attaches the Bearer token when present and retries
 * once after a refresh on 401. Emits unauthenticated when the session dies.
 */
/** Copies caller headers without losing Headers instances or entry arrays. */
function mergeAuthHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...(headers as Record<string, string> | undefined) };
}

export async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const attempt = (token: string | null): Promise<T> => {
    const headers = mergeAuthHeaders(init?.headers);
    if (token) headers.Authorization = `Bearer ${token}`;
    // credentials: include must win — callers must not downgrade the cookie
    // flow by overriding it through init.
    return apiRequest<T>(path, { ...init, credentials: 'include', headers });
  };

  try {
    return await attempt(accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (!refreshInflight) {
      refreshCycleNotified = false;
      refreshInflight = doRefresh().finally(() => {
        refreshInflight = null;
      });
    }
    const refreshed = await refreshInflight;
    if (!refreshed) {
      if (!refreshCycleNotified) {
        refreshCycleNotified = true;
        emitUnauthenticated();
      }
      throw error;
    }
    // A 401 after a successful refresh is a domain rejection (e.g. wrong
    // current password), not a dead session — the refresh itself proved the
    // session is alive, so never log out here. Logout happens only when the
    // refresh itself fails (above).
    return await attempt(accessToken);
  }
}

function storeSession(body: SessionBody): AuthUser {
  accessToken = body.accessToken;
  refreshToken = body.refreshToken;
  return body.user;
}

export type LoginRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

/**
 * Requested login role (login UI tabs). Advisory only: the backend compares
 * it against the database role and rejects mismatches with a generic 401 —
 * it can never escalate, and the returned session always carries the DB role.
 */
export async function login(email: string, password: string, role?: LoginRole): Promise<AuthUser> {
  const body = await apiRequest<SessionBody>('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify(role ? { email, password, role } : { email, password }),
  });
  return storeSession(body);
}

/**
 * Default post-authentication landing by authoritative (database) role.
 * Explicit destinations (?next=, login `from` state) always win; this only
 * supplies the fallback. ADMIN lands on /account — role administration
 * lives in the separate admin app, not this SPA.
 */
export function defaultDestinationForRole(role: string | undefined): string {
  if (role === 'TEACHER') return '/cohorts';
  if (role === 'ADMIN') return '/account';
  return '/human';
}

export async function register(email: string, password: string, name?: string): Promise<AuthUser> {
  const body = await apiRequest<SessionBody>('/api/v1/auth/register', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify(name ? { email, password, name } : { email, password }),
  });
  return storeSession(body);
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<{ status: string }>('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
      body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
    });
  } catch {
    // Logout is best-effort; local session always clears.
  } finally {
    accessToken = null;
    refreshToken = null;
  }
}

/** Returns the current user, or null when anonymous. Never throws. */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    return await authedRequest<AuthUser>('/api/v1/auth/me');
  } catch {
    return null;
  }
}

/** Backend Google entrypoint — full-page navigation (sets httpOnly cookie). */
export function googleLoginUrl(): string {
  return buildApiUrl('/api/v1/auth/google');
}

/**
 * Stores a session delivered via the OAuth callback (future-proof query-param
 * flow). Tokens stay in module memory only — never persisted to storage.
 */
export function acceptCallbackSession(body: SessionBody): AuthUser {
  return storeSession(body);
}

export async function changePassword(
  currentPassword: string | undefined,
  newPassword: string
): Promise<void> {
  await authedRequest<{ status: string }>('/api/v1/auth/password/change', {
    method: 'POST',
    body: JSON.stringify(currentPassword ? { currentPassword, newPassword } : { newPassword }),
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiRequest<{ status: string }>('/api/v1/auth/password-reset/request', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(
  email: string,
  token: string,
  newPassword: string
): Promise<void> {
  await apiRequest<{ status: string }>('/api/v1/auth/password-reset/confirm', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ email, token, newPassword }),
  });
}

/** Fetches the caller's own export payload (JSON-serializable). */
export async function exportAccountData(): Promise<unknown> {
  return authedRequest<unknown>('/api/v1/auth/account/export');
}

export async function deleteAccount(): Promise<void> {
  await authedRequest<{ status: string }>('/api/v1/auth/account', {
    method: 'DELETE',
  });
}
