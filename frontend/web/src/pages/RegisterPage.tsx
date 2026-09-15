import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import AuthDivider from '@/components/auth/AuthDivider';
import AuthLayout from '@/components/auth/AuthLayout';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyAuthError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { safeAuthDestination } from '@/lib/authRedirect';

type RegisterFormValues = {
  email: string;
  name: string;
  password: string;
};

export default function RegisterPage(): JSX.Element {
  const { user, status, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<FriendlyAuthError | null>(null);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    defaultValues: { email: '', name: '', password: '' },
  });

  const fromState = (location.state as { from?: unknown } | null)?.from;
  const destination = safeAuthDestination(fromState ?? searchParams.get('next'), '/human');

  if (status === 'authenticated' && user) {
    return <Navigate to={destination} replace />;
  }

  const onSubmit = handleSubmit(async values => {
    setError(null);
    try {
      const trimmedName = values.name.trim();
      await register(values.email.trim(), values.password, trimmedName ? trimmedName : undefined);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  });

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
          <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                data-testid="register-email"
                aria-invalid={!!errors.email}
                {...registerField('email', { required: true, maxLength: 254 })}
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
                data-testid="register-name"
                aria-invalid={!!errors.name}
                {...registerField('name', { maxLength: 120 })}
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
                data-testid="register-password"
                aria-invalid={!!errors.password}
                {...registerField('password', { required: true, minLength: 8, maxLength: 128 })}
              />
            </div>
            <AuthErrorNotice error={error} testId="register-error" />
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="register-submit"
              className="w-full"
            >
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        )}
        <AuthDivider />
        <GoogleSignInButton testId="google-signup" />
      </div>
    </AuthLayout>
  );
}
