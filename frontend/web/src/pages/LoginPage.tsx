import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import AuthLayout from '@/components/auth/AuthLayout';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyAuthError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { safeAuthDestination } from '@/lib/authRedirect';

const inputClass =
  'min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';
const primaryButtonClass =
  'min-h-[44px] w-full rounded-lg bg-teal-500/20 px-3 py-2.5 text-sm font-medium text-teal-300 hover:bg-teal-500/30 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';

export default function LoginPage(): JSX.Element {
  const { user, status, sessionExpired, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyAuthError | null>(null);

  const fromState = (location.state as { from?: unknown } | null)?.from;
  const destination = safeAuthDestination(fromState ?? searchParams.get('next'), '/human');

  if (status === 'authenticated' && user) {
    return <Navigate to={destination} replace />;
  }

  const showExpired = sessionExpired || searchParams.get('expired') === '1';
  const showDeleted = searchParams.get('deleted') === '1';
  const showReset = searchParams.get('reset') === '1';
  const showChanged = searchParams.get('changed') === '1';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err, { override401: 'Invalid email or password.' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your anatomy learning progress on any device."
      footer={
        <>
          New here?{' '}
          <Link
            to="/register"
            className="text-teal-300 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            Create an account
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {showExpired ? (
          <p
            className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200"
            role="status"
            data-testid="login-expired-notice"
          >
            Your session expired. Please sign in again.
          </p>
        ) : null}
        {showDeleted ? (
          <p
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200"
            role="status"
            data-testid="login-deleted-notice"
          >
            Your account was deleted.
          </p>
        ) : null}
        {showReset ? (
          <p
            className="rounded-lg border border-teal-900/60 bg-teal-950/40 px-3 py-2 text-sm text-teal-200"
            role="status"
            data-testid="login-reset-notice"
          >
            Password reset. Please sign in with your new password.
          </p>
        ) : null}
        {showChanged ? (
          <p
            className="rounded-lg border border-teal-900/60 bg-teal-950/40 px-3 py-2 text-sm text-teal-200"
            role="status"
            data-testid="login-changed-notice"
          >
            Password changed. Please sign in again.
          </p>
        ) : null}
        {status === 'loading' ? (
          <p className="text-sm text-slate-500" data-testid="login-loading">
            Checking session…
          </p>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate={false}>
            <label htmlFor="login-email" className="flex flex-col gap-1 text-xs text-slate-400">
              Email
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                data-testid="login-email"
                className={inputClass}
              />
            </label>
            <label htmlFor="login-password" className="flex flex-col gap-1 text-xs text-slate-400">
              Password
              <input
                id="login-password"
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                data-testid="login-password"
                className={inputClass}
              />
            </label>
            <AuthErrorNotice error={error} testId="login-error" />
            <button
              type="submit"
              disabled={busy}
              data-testid="login-submit"
              className={primaryButtonClass}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
        <GoogleSignInButton />
        <p className="text-center text-xs text-slate-500">
          <Link
            to="/forgot-password"
            className="hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            Forgot your password?
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
