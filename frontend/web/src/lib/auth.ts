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
      // best-effort: one failing listener must not break the rest
    }
  });
}

export function hasSession(): boolean {
  return accessToken !== null;
}

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
    if (error instanceof ApiError && error.status !== 401 && error.status !== 403) {
      throw error;
    }
    return false;
  }
}

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
    return await attempt(accessToken);
  }
}

function storeSession(body: SessionBody): AuthUser {
  accessToken = body.accessToken;
  refreshToken = body.refreshToken;
  return body.user;
}

export type LoginRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export async function login(email: string, password: string, role?: LoginRole): Promise<AuthUser> {
  const body = await apiRequest<SessionBody>('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify(role ? { email, password, role } : { email, password }),
  });
  return storeSession(body);
}

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
    // best-effort: logout request failure still clears local session
  } finally {
    accessToken = null;
    refreshToken = null;
  }
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    return await authedRequest<AuthUser>('/api/v1/auth/me');
  } catch {
    return null;
  }
}

export function googleLoginUrl(): string {
  return buildApiUrl('/api/v1/auth/google');
}

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

export async function exportAccountData(): Promise<unknown> {
  return authedRequest<unknown>('/api/v1/auth/account/export');
}

export async function deleteAccount(): Promise<void> {
  await authedRequest<{ status: string }>('/api/v1/auth/account', {
    method: 'DELETE',
  });
}
