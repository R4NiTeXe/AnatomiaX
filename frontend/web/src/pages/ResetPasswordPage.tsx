import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import AuthLayout from '@/components/auth/AuthLayout';
import { friendlyAuthError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { confirmPasswordReset } from '@/lib/auth';

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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            data-testid="reset-email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-token">Reset token</Label>
          <Input
            id="reset-token"
            type="text"
            required
            minLength={20}
            maxLength={512}
            autoComplete="one-time-code"
            value={token}
            onChange={event => setToken(event.target.value)}
            data-testid="reset-token"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-password">
            New password <span className="text-slate-500">(8+ characters)</span>
          </Label>
          <Input
            id="reset-password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
            data-testid="reset-password"
          />
        </div>
        <AuthErrorNotice error={error} testId="reset-error" />
        <Button type="submit" disabled={busy} data-testid="reset-submit" className="w-full">
          {busy ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
