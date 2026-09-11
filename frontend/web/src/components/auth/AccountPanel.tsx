import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { useQuizAttempts } from '@/hooks/useProgress';

function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Invalid email or password.';
    if (error.status === 409) return 'An account with this email already exists.';
    if (error.status === 400) return 'Please check the email and password format.';
    if (error.status === 429) return 'Too many attempts. Please wait a minute and retry.';
  }
  return 'Something went wrong. Please try again.';
}

export default function AccountPanel(): JSX.Element {
  const { user, status, login, register, logout } = useAuth();
  const attemptsQuery = useQuizAttempts();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (mode: 'login' | 'register') => async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
      setPassword('');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    await logout();
    setEmail('');
    setPassword('');
  };

  return (
    <section
      className="rounded-xl border border-slate-800 bg-slate-900/40"
      data-testid="anatomy-account-panel"
      aria-label="Account"
    >
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Account</h2>
      </div>
      <div className="px-4 py-3">
        {status === 'loading' ? (
          <p className="text-sm text-slate-500" data-testid="anatomy-account-loading">
            Checking session…
          </p>
        ) : user ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm text-slate-200" data-testid="anatomy-account-user">
                {user.email ?? user.name ?? 'Signed in'}
              </p>
              <span
                className="shrink-0 rounded bg-teal-500/20 px-2 py-0.5 text-xs text-teal-300"
                data-testid="anatomy-account-sync-state"
              >
                {attemptsQuery.isError ? 'Sync unavailable' : 'Sync on'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              data-testid="anatomy-account-logout"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              Sign out
            </button>
          </div>
        ) : (
          <form className="flex flex-col gap-2" onSubmit={submit('login')}>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                data-testid="anatomy-account-email"
                className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                data-testid="anatomy-account-password"
                className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              />
            </label>
            {error && (
              <p className="text-sm text-red-300" data-testid="anatomy-account-error" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                data-testid="anatomy-account-login"
                className="flex-1 rounded-lg bg-teal-500/20 px-3 py-1.5 text-sm font-medium text-teal-300 hover:bg-teal-500/30 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                Sign in
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submit('register')}
                data-testid="anatomy-account-register"
                className="flex-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                Register
              </button>
            </div>
            <p className="text-xs text-slate-500">Progress syncs across devices when signed in.</p>
          </form>
        )}
      </div>
    </section>
  );
}
