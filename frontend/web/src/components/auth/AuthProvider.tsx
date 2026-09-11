import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  onUnauthenticated,
  register as registerRequest,
  type AuthUser,
} from '@/lib/auth';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, name?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function clearProgressCache(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.removeQueries({ queryKey: ['progress'] });
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let alive = true;
    const unsubscribe = onUnauthenticated(() => {
      if (!alive) return;
      setUser(null);
      setStatus('anonymous');
      clearProgressCache(queryClient);
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
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const next = await loginRequest(email, password);
      setUser(next);
      setStatus('authenticated');
      queryClient.removeQueries({ queryKey: ['progress'] });
      return next;
    },
    [queryClient]
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const next = await registerRequest(email, password, name);
      setUser(next);
      setStatus('authenticated');
      queryClient.removeQueries({ queryKey: ['progress'] });
      return next;
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setStatus('anonymous');
    clearProgressCache(queryClient);
  }, [queryClient]);

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
