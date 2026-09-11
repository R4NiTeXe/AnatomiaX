import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  onUnauthenticated,
  register as registerRequest,
  type AuthUser,
} from '../api/auth';
import { clearCachedUserState } from '../query/client';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, name?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Mobile auth state. Tokens stay inside `api/auth` + secure storage —
 * this context exposes identity and actions only, never credentials.
 */
export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let alive = true;
    const unsubscribe = onUnauthenticated(() => {
      if (!alive) return;
      clearCachedUserState();
      setUser(null);
      setStatus('anonymous');
    });
    fetchMe().then(found => {
      if (!alive) return;
      setUser(found);
      setStatus(found ? 'authenticated' : 'anonymous');
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const next = await loginRequest(email, password);
    // Fresh account session: drop anything cached before the switch.
    clearCachedUserState();
    setUser(next);
    setStatus('authenticated');
    return next;
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const next = await registerRequest(email, password, name);
    clearCachedUserState();
    setUser(next);
    setStatus('authenticated');
    return next;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    clearCachedUserState();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
