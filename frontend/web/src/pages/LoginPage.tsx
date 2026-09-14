import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import AuthLayout from '@/components/auth/AuthLayout';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyAuthError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { safeAuthDestination } from '@/lib/authRedirect';

type LoginFormValues = {
  email: string;
  password: string;
};

export default function LoginPage(): JSX.Element {
  const { user, status, sessionExpired, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<FriendlyAuthError | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: { email: '', password: '' },
  });

  const fromState = (location.state as { from?: unknown } | null)?.from;
  const destination = safeAuthDestination(fromState ?? searchParams.get('next'), '/human');

  if (status === 'authenticated' && user) {
    return <Navigate to={destination} replace />;
  }

  const showExpired = sessionExpired || searchParams.get('expired') === '1';
  const showDeleted = searchParams.get('deleted') === '1';
  const showReset = searchParams.get('reset') === '1';
  const showChanged = searchParams.get('changed') === '1';

  const onSubmit = handleSubmit(async values => {
    setError(null);
    try {
      await login(values.email.trim(), values.password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err, { override401: 'Invalid email or password.' }));
    }
  });

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
          <Alert variant="warning" data-testid="login-expired-notice">
            <AlertDescription>Your session expired. Please sign in again.</AlertDescription>
          </Alert>
        ) : null}
        {showDeleted ? (
          <Alert data-testid="login-deleted-notice">
            <AlertDescription>Your account was deleted.</AlertDescription>
          </Alert>
        ) : null}
        {showReset ? (
          <Alert variant="success" data-testid="login-reset-notice">
            <AlertDescription>
              Password reset. Please sign in with your new password.
            </AlertDescription>
          </Alert>
        ) : null}
        {showChanged ? (
          <Alert variant="success" data-testid="login-changed-notice">
            <AlertDescription>Password changed. Please sign in again.</AlertDescription>
          </Alert>
        ) : null}
        {status === 'loading' ? (
          <div className="flex flex-col gap-2" data-testid="login-loading">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                data-testid="login-email"
                aria-invalid={!!errors.email}
                {...register('email', { required: true })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
                data-testid="login-password"
                aria-invalid={!!errors.password}
                {...register('password', { required: true, minLength: 8 })}
              />
            </div>
            <AuthErrorNotice error={error} testId="login-error" />
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="login-submit"
              className="w-full"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
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
