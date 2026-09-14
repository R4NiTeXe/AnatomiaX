import { Link } from 'react-router-dom';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/auth/AuthProvider';
import { QuizHistoryList } from '@/components/learning/QuizAttempts';
import StudiedStructures from '@/components/learning/StudiedStructures';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useProgressSnapshot } from '@/hooks/useProgress';
import { buildHumanFocusUrl } from '@/lib/humanLink';

function ContinueSection(): JSX.Element | null {
  const { status } = useAuth();
  const snapshotQuery = useProgressSnapshot();
  if (status !== 'authenticated') return null;

  const keys = snapshotQuery.data?.studiedKeys ?? [];
  const target = keys.length > 0 ? keys[0] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
          Continue learning
        </CardTitle>
      </CardHeader>
      <CardContent>
        {snapshotQuery.isLoading && !snapshotQuery.data ? (
          <Skeleton className="h-10 w-32" data-testid="learn-continue-loading" />
        ) : (
          <Button asChild>
            <Link
              to={target ? buildHumanFocusUrl(target) : '/human'}
              data-testid="learn-continue-link"
            >
              {target ? 'Continue in 3D viewer' : 'Open 3D viewer'}
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function LearnPage(): JSX.Element {
  const { status } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="learn-title">
            Learning progress
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Studied structures and quiz history, synced across devices.
          </p>
        </div>

        {status === 'loading' ? (
          <Skeleton className="h-20 w-full" data-testid="learn-loading" />
        ) : status !== 'authenticated' ? (
          <Card className="p-6">
            <p className="text-sm text-slate-300" data-testid="learn-anonymous">
              Sign in to track studied structures and quiz history.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link to="/login" data-testid="learn-cta-login">
                  Sign in
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/register" data-testid="learn-cta-register">
                  Create account
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/human" data-testid="learn-cta-explore">
                  Explore anatomy
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <ContinueSection />
            <Card>
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
                  Studied structures
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StudiedStructures />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
                  Quiz history
                </CardTitle>
              </CardHeader>
              <CardContent>
                <QuizHistoryList />
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
