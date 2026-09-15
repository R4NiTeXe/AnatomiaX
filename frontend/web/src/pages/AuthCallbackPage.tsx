import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '@/components/auth/AuthLayout';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { useAuth } from '@/components/auth/AuthProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { acceptCallbackSession } from '@/lib/auth';
import { safeAuthDestination } from '@/lib/authRedirect';

export default function AuthCallbackPage(): JSX.Element {
  const { status, reload } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [notice, setNotice] = useState<string | null>(null);

  const next = safeAuthDestination(searchParams.get('next'), '/account');
  const urlError = searchParams.get('error');
  const urlAccess = searchParams.get('accessToken');
  const urlRefresh = searchParams.get('refreshToken');

  useEffect(() => {
    if (urlError) {
      setNotice(searchParams.get('error_description') ?? 'Google sign-in was cancelled or failed.');
      return;
    }
    // Future-proof: backend may one day redirect with tokens in the query.
    if (urlAccess && urlRefresh) {
      try {
        const rawUser = searchParams.get('user');
        if (!rawUser) {
          // No user payload — fall through to the cookie/session recovery below.
          throw new Error('missing user');
        }
        const user = JSON.parse(rawUser) as {
          id: string;
          email: string | null;
          name: string | null;
          role: string;
          createdAt: string;
        };
        acceptCallbackSession({ user, accessToken: urlAccess, refreshToken: urlRefresh });
      } catch {
        setNotice('Invalid sign-in response. Please try again.');
        return;
      }
    }
    let alive = true;
    // The backend sets an httpOnly refresh cookie on the Google callback path;
    // re-fetching /me (with cookie refresh) picks the session up in this app.
    reload().then(found => {
      if (!alive) return;
      if (found) navigate(next, { replace: true });
      else if (!urlError && !(urlAccess && urlRefresh))
        setNotice('No Google session found. Please try again.');
    });
    return () => {
      alive = false;
    };
    // Run once on mount — reload/navigate are stable enough for this flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-sm text-slate-500" data-testid="callback-redirecting">
          Signed in — continuing…
        </p>
      </main>
    );
  }

  return (
    <AuthLayout
      title="Google sign-in"
      subtitle="Completing your Google sign-in…"
      footer={
        <>
          <Link
            to="/login"
            className="text-teal-300 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-400" role="status" data-testid="callback-status">
          {notice ?? 'Checking your Google session…'}
        </p>
        {!notice ? (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-slate-800"
            aria-hidden="true"
            data-testid="callback-progress"
          >
            <Skeleton className="h-full w-1/2 rounded-full" />
          </div>
        ) : null}
        {notice ? <GoogleSignInButton testId="callback-retry" /> : null}
        {urlError ? (
          <p className="text-xs text-slate-500" data-testid="callback-error">
            {urlError}
          </p>
        ) : null}
      </div>
    </AuthLayout>
  );
}
