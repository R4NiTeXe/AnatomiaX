import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import AuthLayout from '@/components/auth/AuthLayout';
import { friendlyAuthError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestPasswordReset } from '@/lib/auth';

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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              data-testid="forgot-email"
            />
          </div>
          <AuthErrorNotice error={error} testId="forgot-error" />
          <Button type="submit" disabled={busy} data-testid="forgot-submit" className="w-full">
            {busy ? 'Sending…' : 'Send reset instructions'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
