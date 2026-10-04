import { useAuth } from './AuthProvider';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Role gate for teacher/admin-only views (UX only — every mutation and
 * read is re-authorized server-side; a denied page never implies the API
 * would allow the same call).
 */
export default function RequireRole({
  roles,
  children,
  testId = 'role-denied',
}: {
  roles: Array<'TEACHER' | 'ADMIN'>;
  children: JSX.Element;
  testId?: string;
}): JSX.Element {
  const { user, status } = useAuth();
  if (status === 'loading') {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-slate-500">Checking access…</p>
      </main>
    );
  }
  if (!user || !roles.includes(user.role as 'TEACHER' | 'ADMIN')) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6">
        <Alert variant="destructive" data-testid={testId}>
          <AlertDescription>
            This area is for teachers. Your account does not have access.
          </AlertDescription>
        </Alert>
      </main>
    );
  }
  return children;
}
