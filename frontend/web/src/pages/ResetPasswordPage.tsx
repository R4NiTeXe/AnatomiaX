import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import AuthLayout from '@/components/auth/AuthLayout';
import { friendlyAuthError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { confirmPasswordReset } from '@/lib/auth';

const inputClass =
  'min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';
const primaryButtonClass =
  'min-h-[44px] w-full rounded-lg bg-teal-500/20 px-3 py-2.5 text-sm font-medium text-teal-300 hover:bg-teal-500/30 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';

export default function ResetPasswordPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyAuthError | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await confirmPasswordReset(email.trim(), token.trim(), newPassword);
      navigate('/login?reset=1', { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Enter the email, token, and a new 8+ character password."
      footer={
        <>
          Need a new token?{' '}
          <Link
            to="/forgot-password"
            className="text-teal-300 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            Request again
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label htmlFor="reset-email" className="flex flex-col gap-1 text-xs text-slate-400">
          Email
          <input
            id="reset-email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            data-testid="reset-email"
            className={inputClass}
          />
        </label>
        <label htmlFor="reset-token" className="flex flex-col gap-1 text-xs text-slate-400">
          Reset token
          <input
            id="reset-token"
            type="text"
            required
            minLength={20}
            maxLength={512}
            autoComplete="one-time-code"
            value={token}
            onChange={event => setToken(event.target.value)}
            data-testid="reset-token"
            className={inputClass}
          />
        </label>
        <label htmlFor="reset-password" className="flex flex-col gap-1 text-xs text-slate-400">
          New password <span className="text-slate-500">(8+ characters)</span>
          <input
            id="reset-password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
            data-testid="reset-password"
            className={inputClass}
          />
        </label>
        <AuthErrorNotice error={error} testId="reset-error" />
        <button
          type="submit"
          disabled={busy}
          data-testid="reset-submit"
          className={primaryButtonClass}
        >
          {busy ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </AuthLayout>
  );
}
