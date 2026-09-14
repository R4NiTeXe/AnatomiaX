import { Alert, AlertDescription } from '@/components/ui/alert';
import type { FriendlyAuthError } from './friendlyAuthError';

export default function AuthErrorNotice({
  error,
  testId = 'auth-error',
}: {
  error: FriendlyAuthError | null;
  testId?: string;
}): JSX.Element | null {
  if (!error) return null;
  return (
    <Alert variant="destructive" data-testid={testId}>
      <AlertDescription>
        <p className="text-sm text-red-200">{error.message}</p>
        {error.details?.length ? (
          <ul className="mt-1 list-disc pl-5 text-xs text-red-300/90">
            {error.details.map(detail => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
        {error.requestId ? (
          <p className="mt-1 text-xs text-red-300/70" data-testid={`${testId}-request-id`}>
            Reference: {error.requestId}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
