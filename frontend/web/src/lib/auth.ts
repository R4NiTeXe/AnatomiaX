/**
 * Authentication client — session tokens live in module memory only.
 * The refresh token additionally travels in an httpOnly cookie managed by
 * the backend; application code never reads it and nothing is persisted
 * to localStorage.
 */
import { ApiError, apiRequest } from './api';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  createdAt: string;
}

interface SessionBody {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshInflight: Promise<boolean> | null = null;

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
  } catch {
    return false;
  }
}

/**
 * Authenticated request. Attaches the Bearer token when present and retries
 * once after a refresh on 401. Emits unauthenticated when the session dies.
 */
export async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const attempt = (token: string | null): Promise<T> => {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return apiRequest<T>(path, { credentials: 'include', ...init, headers });
  };

  try {
    return await attempt(accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (!refreshInflight) {
      refreshInflight = doRefresh().finally(() => {
        refreshInflight = null;
      });
    }
    const refreshed = await refreshInflight;
    if (!refreshed) {
      emitUnauthenticated();
      throw error;
    }
    try {
      return await attempt(accessToken);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) emitUnauthenticated();
      throw retryError;
    }
  }
}

function storeSession(body: SessionBody): AuthUser {
  accessToken = body.accessToken;
  refreshToken = body.refreshToken;
  return body.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const body = await apiRequest<SessionBody>('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return storeSession(body);
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
