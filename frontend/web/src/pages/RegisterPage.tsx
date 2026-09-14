import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import AuthLayout from '@/components/auth/AuthLayout';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyAuthError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { safeAuthDestination } from '@/lib/authRedirect';

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
          <div className="flex flex-col gap-2" data-testid="register-loading">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                data-testid="register-email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-name">
                Name <span className="text-slate-500">(optional)</span>
              </Label>
              <Input
                id="register-name"
                type="text"
                maxLength={120}
                autoComplete="name"
                value={name}
                onChange={event => setName(event.target.value)}
                data-testid="register-name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-password">
                Password <span className="text-slate-500">(8+ characters)</span>
              </Label>
              <Input
                id="register-password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                data-testid="register-password"
              />
            </div>
            <AuthErrorNotice error={error} testId="register-error" />
            <Button type="submit" disabled={busy} data-testid="register-submit" className="w-full">
              {busy ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        )}
        <GoogleSignInButton testId="google-signup" />
      </div>
    </AuthLayout>
  );
}
