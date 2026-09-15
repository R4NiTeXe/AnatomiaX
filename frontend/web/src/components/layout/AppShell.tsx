import { Outlet } from 'react-router-dom';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageTransition } from '@/components/motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AppShell(): JSX.Element {
  const { status } = useAuth();

  // Loading state for authenticated shell initialization — preserves navigation, shows skeleton
  if (status === 'loading') {
    return (
      <div className="ax-app-bg min-h-screen text-slate-100">
        <SiteNav />
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6" data-testid="shell-loading">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-20 w-full" />
        </div>
      </div>
    );
  }

  // Error is handled via anonymous -> RequireAuth redirect; shell itself does not need error UI beyond loading.
  // Keep alert placeholder for future extension without breaking existing flows.
  return (
    <div className="ax-app-bg min-h-screen text-slate-100">
      <SiteNav />
      <PageTransition>
        <Outlet />
      </PageTransition>
    </div>
  );
}

export function AppShellErrorFallback(): JSX.Element {
  return (
    <div className="ax-app-bg min-h-screen text-slate-100">
      <SiteNav />
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Alert variant="destructive" data-testid="shell-error">
          <AlertDescription>Couldn&apos;t load navigation. Please reload.</AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
