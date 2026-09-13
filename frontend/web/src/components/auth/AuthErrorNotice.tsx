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
    <div
      role="alert"
      data-testid={testId}
      className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2"
    >
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
    </div>
  );
}
