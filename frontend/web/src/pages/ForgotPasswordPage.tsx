import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import AuthLayout from '@/components/auth/AuthLayout';
import { friendlyAuthError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestPasswordReset } from '@/lib/auth';

type ForgotFormValues = {
  email: string;
};

export default function ForgotPasswordPage(): JSX.Element {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [error, setError] = useState<FriendlyAuthError | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async values => {
    setError(null);
    try {
      const trimmed = values.email.trim();
      await requestPasswordReset(trimmed);
      setSentEmail(trimmed);
      setSent(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  });

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
          If an account exists for <span className="font-medium">{sentEmail}</span>, reset
          instructions are on the way. Check your inbox, then{' '}
          <Link to="/reset-password" className="text-teal-300 hover:text-teal-200">
            enter your reset token
          </Link>
          .
        </p>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              data-testid="forgot-email"
              aria-invalid={!!errors.email}
              {...register('email', { required: true, maxLength: 254 })}
            />
          </div>
          <AuthErrorNotice error={error} testId="forgot-error" />
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="forgot-submit"
            className="w-full"
          >
            {isSubmitting ? 'Sending…' : 'Send reset instructions'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
