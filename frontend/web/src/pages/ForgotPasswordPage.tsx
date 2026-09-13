import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import AuthLayout from '@/components/auth/AuthLayout';
import { friendlyAuthError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { requestPasswordReset } from '@/lib/auth';

const inputClass =
  'min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';
const primaryButtonClass =
  'min-h-[44px] w-full rounded-lg bg-teal-500/20 px-3 py-2.5 text-sm font-medium text-teal-300 hover:bg-teal-500/30 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';

export default function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<FriendlyAuthError | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="We will email reset instructions if an account exists for that address."
      footer={
        <>
          Remembered it?{' '}
          <Link
            to="/login"
            className="text-teal-300 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <p role="status" data-testid="forgot-sent" className="text-sm leading-6 text-slate-200">
          If an account exists for <span className="font-medium">{email.trim()}</span>, reset
          instructions are on the way. Check your inbox, then{' '}
          <Link to="/reset-password" className="text-teal-300 hover:text-teal-200">
            enter your reset token
          </Link>
          .
        </p>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label htmlFor="forgot-email" className="flex flex-col gap-1 text-xs text-slate-400">
            Email
            <input
              id="forgot-email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              data-testid="forgot-email"
              className={inputClass}
            />
          </label>
          <AuthErrorNotice error={error} testId="forgot-error" />
          <button
            type="submit"
            disabled={busy}
            data-testid="forgot-submit"
            className={primaryButtonClass}
          >
            {busy ? 'Sending…' : 'Send reset instructions'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
