import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { friendlyAuthError, type FriendlyAuthError } from './friendlyAuthError';
import { useQuizAttempts } from '@/hooks/useProgress';

export default function AccountPanel(): JSX.Element {
  const { user, status, sessionExpired, login, register, logout } = useAuth();
  const attemptsQuery = useQuizAttempts();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyAuthError | null>(null);
  // Ref (not state) so the clicked button's onClick — which runs before
  // onSubmit — is visible synchronously. Both buttons stay type=submit so
  // native required/minLength validation applies to login AND register.
  const modeRef = useRef<'login' | 'register'>('login');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const mode =
      modeRef.current === 'register' || submitter?.getAttribute('data-mode') === 'register'
        ? 'register'
        : 'login';
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
      setError(friendlyAuthError(err, { override401: 'Invalid email or password.' }));
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
              className="min-h-[44px] rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              Sign out
            </button>
            <Link
              to="/account"
              data-testid="anatomy-account-manage"
              className="text-center text-xs text-teal-300 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              Manage account →
            </Link>
          </div>
        ) : (
          <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
            {sessionExpired ? (
              <p
                role="status"
                data-testid="anatomy-account-expired"
                className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200"
              >
                Your session expired. Please sign in again.
              </p>
            ) : null}
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                data-testid="anatomy-account-email"
                className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
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
                className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              />
            </label>
            {error && (
              <div role="alert" data-testid="anatomy-account-error">
                <p className="text-sm text-red-300">{error.message}</p>
                {error.requestId ? (
                  <p
                    className="mt-0.5 text-xs text-red-300/70"
                    data-testid="anatomy-account-error-request-id"
                  >
                    Reference: {error.requestId}
                  </p>
                ) : null}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                data-mode="login"
                disabled={busy}
                onClick={() => {
                  modeRef.current = 'login';
                }}
                data-testid="anatomy-account-login"
                className="min-h-[44px] flex-1 rounded-lg bg-teal-500/20 px-3 py-1.5 text-sm font-medium text-teal-300 hover:bg-teal-500/30 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                Sign in
              </button>
              <button
                type="submit"
                data-mode="register"
                disabled={busy}
                onClick={() => {
                  modeRef.current = 'register';
                }}
                data-testid="anatomy-account-register"
                className="min-h-[44px] flex-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                Register
              </button>
            </div>
            <p className="text-xs text-slate-500">Progress syncs across devices when signed in.</p>
            <p className="text-xs text-slate-500">
              <Link to="/login" className="text-teal-300 hover:text-teal-200">
                Full sign-in
              </Link>{' '}
              ·{' '}
              <Link to="/forgot-password" className="text-teal-300 hover:text-teal-200">
                Forgot password?
              </Link>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
