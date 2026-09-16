import { Link } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { QuizRecent } from '@/components/learning/QuizAttempts';
import StudiedStructures, {
  displayNameForStudiedKey,
} from '@/components/learning/StudiedStructures';
import { documentedCoverage } from '@/components/learning/coverage';
import ProgressRing from '@/components/learning/ProgressRing';
import SectionHeader from '@/components/learning/SectionHeader';
import { Reveal } from '@/components/motion';
import { LottiePlayer, animationSrc } from '@/components/animation';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useProgressSnapshot, useQuizAttempts } from '@/hooks/useProgress';
import { buildHumanFocusUrl } from '@/lib/humanLink';

function ContinueHero(): JSX.Element | null {
  const { status } = useAuth();
  const snapshotQuery = useProgressSnapshot();
  if (status !== 'authenticated') return null;

  if (snapshotQuery.isLoading && !snapshotQuery.data) {
    return <Skeleton className="h-32 w-full" data-testid="continue-loading" />;
  }

  const keys = snapshotQuery.data?.studiedKeys ?? [];
  const target = keys.length > 0 ? keys[0] : null;
  const targetName = target ? displayNameForStudiedKey(target) : null;

  return (
    <section
      aria-label="Continue learning"
      className="relative overflow-hidden rounded-xl border border-teal-900/40 bg-gradient-to-br from-teal-950/60 via-slate-900/60 to-slate-900/40 p-5 shadow-glow-sm sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl"
      />
      <p className="ax-kicker">Continue learning</p>
      <h2
        className="mt-2 max-w-xl text-xl font-bold tracking-tight text-slate-50 sm:text-2xl"
        data-testid="home-continue-title"
      >
        {target && targetName
          ? `Pick up with ${targetName}`
          : 'Start exploring the human body in 3D'}
      </h2>
      <p className="mt-1 max-w-xl text-sm text-slate-400" data-testid="home-next-action">
        {target
          ? 'Jump back into the viewer where you left off — your progress is saved automatically.'
          : 'Select any structure in the viewer to begin tracking your progress.'}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link to={target ? buildHumanFocusUrl(target) : '/human'} data-testid="continue-link">
            {target ? 'Continue in 3D viewer' : 'Open 3D viewer'}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/learn" data-testid="home-review-link">
            Review progress
          </Link>
        </Button>
      </div>
    </section>
  );
}

function MasteryStrip(): JSX.Element | null {
  const { status } = useAuth();
  const snapshotQuery = useProgressSnapshot();
  const attemptsQuery = useQuizAttempts();
  if (status !== 'authenticated') return null;

  if (
    (snapshotQuery.isLoading && !snapshotQuery.data) ||
    (attemptsQuery.isLoading && !attemptsQuery.data)
  ) {
    return <Skeleton className="h-28 w-full" data-testid="home-mastery-loading" />;
  }
  if (snapshotQuery.isError && !snapshotQuery.data) return null;

  const keys = snapshotQuery.data?.studiedKeys ?? [];
  const attempts = attemptsQuery.data;
  const latest = attempts?.[0] ?? null;
  const coverage = documentedCoverage(keys, snapshotQuery.data?.bodyModel ?? null);

  return (
    <section
      aria-label="Mastery overview"
      data-testid="home-mastery"
      className="grid gap-4 rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-soft sm:p-5 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-6"
    >
      <div className="flex items-center gap-4">
        <ProgressRing
          value={coverage.studied}
          max={coverage.total}
          testId="home-mastery-coverage"
        />
        <div className="min-w-0">
          <p className="ax-section-title">Mastery</p>
          <p className="mt-1 text-sm text-slate-300">
            {coverage.studied} of {coverage.total} documented structures
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-4">
        <div>
          <dt className="ax-section-title">Studied</dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums text-slate-100"
            data-testid="home-mastery-studied"
          >
            {keys.length}
          </dd>
        </div>
        <div>
          <dt className="ax-section-title">Quizzes</dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums text-slate-100"
            data-testid="home-mastery-quizzes"
          >
            {attempts ? attempts.length : '—'}
          </dd>
        </div>
        <div>
          <dt className="ax-section-title">Latest</dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums text-slate-100"
            data-testid="home-mastery-latest"
          >
            {latest ? `${latest.score} / ${latest.total}` : '—'}
          </dd>
        </div>
      </dl>
    </section>
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

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-3">
          <div className="aspect-[16/10] w-full bg-slate-950/60">
            <LottiePlayer
              src={animationSrc('body-scan')}
              ariaLabel="Body scan animation — secondary to 3D viewer"
              className="h-full w-full"
              loop
              autoplay
            />
          </div>
          <div className="p-4">
            <p className="ax-kicker">Anatomy preview</p>
            <h2 className="mt-1 text-sm font-bold tracking-tight text-slate-100">Body scan</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Supporting visual — the interactive 3D model remains primary.
            </p>
          </div>
        </Card>
        <Card className="overflow-hidden lg:col-span-2">
          <div className="aspect-[16/10] w-full bg-slate-950/60">
            <LottiePlayer
              src={animationSrc('medical-technology')}
              ariaLabel="Medical technology animation"
              className="h-full w-full"
              loop
              autoplay
            />
          </div>
          <div className="p-4">
            <p className="ax-kicker">Technology</p>
            <h2 className="mt-1 text-sm font-bold tracking-tight text-slate-100">How it works</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Product content first, animation second — restrained loop.
            </p>
          </div>
        </Card>
      </div>

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
    <div className="flex flex-col gap-6" data-testid="home-dashboard">
      <div>
        <p className="ax-kicker">Dashboard</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl" data-testid="home-title">
          Welcome{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-400">Here is your learning at a glance.</p>
      </div>
      <Reveal>
        <ContinueHero />
      </Reveal>
      <Reveal delay={0.05}>
        <MasteryStrip />
      </Reveal>
      <div className="grid gap-4 lg:grid-cols-5">
        <Reveal className="lg:col-span-3" delay={0.05}>
          <section
            aria-label="Studied structures"
            className="flex h-full flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-soft sm:p-5"
          >
            <SectionHeader kicker="Review" title="Studied structures" />
            <StudiedStructures preview />
          </section>
        </Reveal>
        <Reveal className="lg:col-span-2" delay={0.1}>
          <section
            aria-label="Recent quizzes"
            className="flex h-full flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-soft sm:p-5"
          >
            <SectionHeader kicker="Practice" title="Recent quizzes" />
            <QuizRecent />
          </section>
        </Reveal>
      </div>
      <Reveal delay={0.1}>
        <section
          aria-label="Cohorts"
          className="flex flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <div className="min-w-0">
            <p className="ax-section-title">Cohorts</p>
            <p className="mt-1 text-sm text-slate-400">
              {isTeacher
                ? 'Create cohorts for your classes and track members.'
                : 'Join a cohort with an invite code from your teacher.'}
            </p>
          </div>
          <Button variant="outline" asChild className="shrink-0">
            <Link to="/cohorts" data-testid="home-cohorts-link">
              Open My Cohorts
            </Link>
          </Button>
        </section>
      </Reveal>
    </div>
  );
}

export default function HomePage(): JSX.Element {
  const { status } = useAuth();

  // Rendered inside AppShell which already provides SiteNav + min-h-screen.
  // Keep main#main-content for skip-link target; AppShell's Outlet renders this.
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      {status === 'loading' ? (
        <Skeleton className="h-20 w-full" data-testid="home-loading" />
      ) : status === 'authenticated' ? (
        <Dashboard />
      ) : (
        <PublicHome />
      )}
    </main>
  );
}
