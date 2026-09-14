import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import AuthLayout from '@/components/auth/AuthLayout';
import { friendlyAuthError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { confirmPasswordReset } from '@/lib/auth';

type ResetFormValues = {
  email: string;
  token: string;
  newPassword: string;
};

export default function ResetPasswordPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<FriendlyAuthError | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    defaultValues: {
      email: searchParams.get('email') ?? '',
      token: searchParams.get('token') ?? '',
      newPassword: '',
    },
  });

  const onSubmit = handleSubmit(async values => {
    setError(null);
    try {
      await confirmPasswordReset(values.email.trim(), values.token.trim(), values.newPassword);
      navigate('/login?reset=1', { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  });

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
      <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            data-testid="reset-email"
            aria-invalid={!!errors.email}
            {...register('email', { required: true, maxLength: 254 })}
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
            data-testid="reset-token"
            aria-invalid={!!errors.token}
            {...register('token', { required: true, minLength: 20, maxLength: 512 })}
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
            data-testid="reset-password"
            aria-invalid={!!errors.newPassword}
            {...register('newPassword', { required: true, minLength: 8, maxLength: 128 })}
          />
        </div>
        <AuthErrorNotice error={error} testId="reset-error" />
        <Button type="submit" disabled={isSubmitting} data-testid="reset-submit" className="w-full">
          {isSubmitting ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
