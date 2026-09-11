/**
 * Mobile authentication — tokens live in secure device storage only.
 * Refresh tokens travel in JSON bodies (mobile path); application code never
 * reads them except here, and nothing is persisted to localStorage.
 */
import { ApiError, apiRequest } from './client';
import { clearSession, loadAccessToken, loadSession, saveSession } from '../lib/secureStore';

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
  unauthListeners.forEach(listener => {
    try {
      listener();
    } catch {
      // Listener failures must never break request handling.
    }
  });
}

/** For tests only — clears in-flight state (storage is cleared separately). */
export function __resetAuthForTests(): void {
  refreshInflight = null;
}

async function doRefresh(): Promise<boolean> {
  try {
    const session = await loadSession();
    if (!session) return false;
    const body = await apiRequest<SessionBody>('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    await saveSession(body.accessToken, body.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticated request. Attaches the Bearer token when present and retries
 * once after a refresh on 401. Clears the session and emits unauthenticated
 * when the session dies. Concurrent 401s share one refresh (single-flight).
 */
export async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const attempt = async (retrying: boolean): Promise<T> => {
    const accessToken = await loadAccessToken();
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      return await apiRequest<T>(path, { ...init, headers });
    } catch (error) {
      if (retrying || !(error instanceof ApiError) || error.status !== 401) throw error;
      if (!refreshInflight) {
        refreshInflight = doRefresh().finally(() => {
          refreshInflight = null;
        });
      }
      const refreshed = await refreshInflight;
      if (!refreshed) {
        await clearSession();
        emitUnauthenticated();
        throw error;
      }
      try {
        return await attempt(true);
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401) {
          await clearSession();
          emitUnauthenticated();
        }
        throw retryError;
      }
    }
  };
  return attempt(false);
}

async function storeSession(body: SessionBody): Promise<AuthUser> {
  // Switching users overwrites the previous session — no state can leak.
  await saveSession(body.accessToken, body.refreshToken);
  return body.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const body = await apiRequest<SessionBody>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return storeSession(body);
}

export async function register(email: string, password: string, name?: string): Promise<AuthUser> {
  const body = await apiRequest<SessionBody>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(name ? { email, password, name } : { email, password }),
  });
  return storeSession(body);
}

export async function logout(): Promise<void> {
  try {
    const session = await loadSession();
    await apiRequest<{ status: string }>('/api/v1/auth/logout', {
      method: 'POST',
      body: session ? JSON.stringify({ refreshToken: session.refreshToken }) : undefined,
    });
  } catch {
    // Logout is best-effort; local session always clears.
  } finally {
    await clearSession();
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
