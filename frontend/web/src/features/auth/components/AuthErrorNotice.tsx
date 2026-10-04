import { motion } from 'motion/react';
import { DURATIONS, EASE } from '@/components/motion';
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
  // Enter-only feedback motion — subtle horizontal settle draws the eye
  // without shaking the layout. Same testids/contract, no exit delay.
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: DURATIONS.fast, ease: EASE.emphasized }}
    >
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
    </motion.div>
  );
}
