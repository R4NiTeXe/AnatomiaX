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

export default function RegisterPage(): JSX.Element {
  const { user, status, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyAuthError | null>(null);

  const fromState = (location.state as { from?: unknown } | null)?.from;
  const destination = safeAuthDestination(fromState ?? searchParams.get('next'), '/human');

  if (status === 'authenticated' && user) {
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const trimmedName = name.trim();
      await register(email.trim(), password, trimmedName ? trimmedName : undefined);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="Sync quiz attempts and studied structures across devices."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-teal-300 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            Sign in
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {status === 'loading' ? (
          <p className="text-sm text-slate-500" data-testid="register-loading">
            Checking session…
          </p>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <label htmlFor="register-email" className="flex flex-col gap-1 text-xs text-slate-400">
              Email
              <input
                id="register-email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                data-testid="register-email"
                className={inputClass}
              />
            </label>
            <label htmlFor="register-name" className="flex flex-col gap-1 text-xs text-slate-400">
              Name <span className="text-slate-500">(optional)</span>
              <input
                id="register-name"
                type="text"
                maxLength={120}
                autoComplete="name"
                value={name}
                onChange={event => setName(event.target.value)}
                data-testid="register-name"
                className={inputClass}
              />
            </label>
            <label
              htmlFor="register-password"
              className="flex flex-col gap-1 text-xs text-slate-400"
            >
              Password <span className="text-slate-500">(8+ characters)</span>
              <input
                id="register-password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                data-testid="register-password"
                className={inputClass}
              />
            </label>
            <AuthErrorNotice error={error} testId="register-error" />
            <button
              type="submit"
              disabled={busy}
              data-testid="register-submit"
              className={primaryButtonClass}
            >
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
        <GoogleSignInButton testId="google-signup" />
      </div>
    </AuthLayout>
  );
}
