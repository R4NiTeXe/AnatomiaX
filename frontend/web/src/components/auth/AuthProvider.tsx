import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  /** True when a previously-authenticated session died (refresh failed). */
  sessionExpired: boolean;
  dismissSessionNotice: () => void;
  /** Re-fetches /me (used by the OAuth callback page). Never throws. */
  reload: () => Promise<AuthUser | null>;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, name?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Drops all user-scoped caches so accounts can never leak into each other. */
function clearUserCache(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.removeQueries({ queryKey: ['progress'] });
  queryClient.removeQueries({ queryKey: ['cohorts'] });
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [sessionExpired, setSessionExpired] = useState(false);
  const userRef = useRef<AuthUser | null>(null);
  userRef.current = user;

  useEffect(() => {
    let alive = true;
    const unsubscribe = onUnauthenticated(() => {
      if (!alive) return;
      const hadUser = userRef.current !== null;
      setUser(null);
      setStatus('anonymous');
      if (hadUser) setSessionExpired(true);
      clearUserCache(queryClient);
    });
    fetchMe().then(found => {
      if (!alive) return;
      setUser(found);
      setStatus(found ? 'authenticated' : 'anonymous');
      if (found) setSessionExpired(false);
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
      setSessionExpired(false);
      clearUserCache(queryClient);
      return next;
    },
    [queryClient]
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const next = await registerRequest(email, password, name);
      setUser(next);
      setStatus('authenticated');
      setSessionExpired(false);
      clearUserCache(queryClient);
      return next;
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setStatus('anonymous');
    setSessionExpired(false);
    clearUserCache(queryClient);
  }, [queryClient]);

  const reload = useCallback(async () => {
    const found = await fetchMe();
    setUser(found);
    setStatus(found ? 'authenticated' : 'anonymous');
    if (found) setSessionExpired(false);
    else if (userRef.current !== null) setSessionExpired(true);
    if (!found) clearUserCache(queryClient);
    return found;
  }, [queryClient]);

  const dismissSessionNotice = useCallback(() => {
    setSessionExpired(false);
  }, []);

  const value = useMemo(
    () => ({ user, status, sessionExpired, dismissSessionNotice, reload, login, register, logout }),
    [user, status, sessionExpired, dismissSessionNotice, reload, login, register, logout]
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
