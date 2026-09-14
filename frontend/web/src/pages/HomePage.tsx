import { Link } from 'react-router-dom';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/auth/AuthProvider';
import { QuizRecent } from '@/components/learning/QuizAttempts';
import StudiedStructures from '@/components/learning/StudiedStructures';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useProgressSnapshot } from '@/hooks/useProgress';
import { buildHumanFocusUrl } from '@/lib/humanLink';

function ContinueCard(): JSX.Element | null {
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
          <Skeleton className="h-10 w-full" data-testid="continue-loading" />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-300">
              {target ? 'Pick up where you left off.' : 'Start exploring the human body in 3D.'}
            </p>
            <Button asChild>
              <Link to={target ? buildHumanFocusUrl(target) : '/human'} data-testid="continue-link">
                {target ? 'Continue in 3D viewer' : 'Open 3D viewer'}
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PublicHome(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="home-title">
          Learn human anatomy in interactive 3D
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Explore body systems, search structures, compare anatomy, and test yourself with quizzes.
          Your progress syncs across devices when you sign in.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link to="/register" data-testid="home-cta-register">
              Create a free account
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/login" data-testid="home-cta-login">
              Sign in
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/human" data-testid="home-cta-explore">
              Explore anatomy
            </Link>
          </Button>
        </div>
      </Card>

      <section aria-label="Features" className="grid gap-4 sm:grid-cols-3">
        {[
          { title: '3D viewer', body: 'Rotate, zoom, and isolate nine body systems.' },
          { title: 'Quizzes', body: 'Test recall with instant review of every answer.' },
          { title: 'Progress sync', body: 'Studied structures and attempts follow you.' },
        ].map(feature => (
          <Card key={feature.title}>
            <CardHeader>
              <CardTitle className="text-sm">{feature.title}</CardTitle>
              <CardDescription>{feature.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}

function Dashboard(): JSX.Element {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  return (
    <div className="flex flex-col gap-4" data-testid="home-dashboard">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="home-title">
          Welcome{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-400">Here is your learning at a glance.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
            Cohorts
          </CardTitle>
          <CardDescription>
            {isTeacher
              ? 'Create cohorts for your classes and track members.'
              : 'Join a cohort with an invite code from your teacher.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/cohorts" data-testid="home-cohorts-link">
              Open My Cohorts
            </Link>
          </Button>
        </CardContent>
      </Card>
      <ContinueCard />
      <Card>
        <CardHeader>
          <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
            Studied structures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StudiedStructures preview />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
            Recent quizzes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <QuizRecent />
        </CardContent>
      </Card>
    </div>
  );
}

export default function HomePage(): JSX.Element {
  const { status } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNav />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {status === 'loading' ? (
          <Skeleton className="h-20 w-full" data-testid="home-loading" />
        ) : status === 'authenticated' ? (
          <Dashboard />
        ) : (
          <PublicHome />
        )}
      </main>
    </div>
  );
}
