import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/components/AuthProvider';
import ProgressSummary from '@/features/progress/components/ProgressSummary';
import { QuizHistoryList } from '@/features/progress/components/QuizAttempts';
import StudiedStructures, {
  displayNameForStudiedKey,
} from '@/features/progress/components/StudiedStructures';
import {
  buildLearningModules,
  findContinueTarget,
  getLearningModule,
  moduleProgress,
} from '@/features/progress/components/modules';
import SectionHeader from '@/features/progress/components/SectionHeader';
import { Reveal } from '@/components/motion';
import ProgressRing from '@/features/progress/components/ProgressRing';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useProgressSnapshot } from '@/features/progress/hooks/useProgress';
import { useMyAssignments } from '@/features/cohorts/hooks/useCohorts';
import { buildHumanFocusUrl } from '@/features/anatomy/humanLink';

function AssignedModulesSection(): JSX.Element | null {
  const { status } = useAuth();
  const assignmentsQuery = useMyAssignments();
  const snapshotQuery = useProgressSnapshot();
  if (status !== 'authenticated') return null;

  if (assignmentsQuery.isLoading && !assignmentsQuery.data) {
    return <Skeleton className="h-20 w-full" data-testid="learn-assigned-loading" />;
  }
  if (assignmentsQuery.isError) {
    return (
      <section
        aria-label="Assigned modules"
        className="flex flex-col gap-2 rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-soft sm:p-5"
      >
        <p className="text-sm text-slate-500" data-testid="learn-assigned-error">
          Couldn&apos;t load assigned modules.
        </p>
        <Button
          variant="outline"
          onClick={() => assignmentsQuery.refetch()}
          data-testid="learn-assigned-retry"
          className="w-fit"
        >
          Retry
        </Button>
      </section>
    );
  }

  const assignments = (assignmentsQuery.data ?? []).filter(a => getLearningModule(a.moduleKey));
  if (assignments.length === 0) return null;
  const studiedKeys = snapshotQuery.data?.studiedKeys ?? [];

  return (
    <section
      aria-label="Assigned modules"
      className="flex flex-col gap-3 rounded-xl border border-teal-900/40 bg-teal-950/10 p-4 shadow-soft sm:p-5"
      data-testid="learn-assigned"
    >
      <SectionHeader
        kicker="Assigned"
        title="From your cohorts"
        description="Modules your teachers assigned — the self-directed curriculum below stays available."
      />
      <ul className="grid gap-2 sm:grid-cols-2" data-testid="learn-assigned-list">
        {assignments.map(a => {
          const module = getLearningModule(a.moduleKey) as NonNullable<
            ReturnType<typeof getLearningModule>
          >;
          const progress = moduleProgress(module, studiedKeys);
          return (
            <li key={`${a.cohortId}:${a.moduleKey}`} data-testid="learn-assigned-item">
              <Link
                to={`/learn/${a.moduleKey}`}
                data-testid="learn-assigned-open"
                aria-label={`${module.title} module from ${a.cohortName}, ${progress.studied} of ${progress.total} studied`}
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 shadow-soft transition-colors hover:border-slate-700 hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 sm:px-4"
              >
                <ProgressRing
                  value={progress.studied}
                  max={progress.total}
                  size={44}
                  strokeWidth={5}
                  testId={`learn-assigned-ring-${a.moduleKey}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-100">
                    {module.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {a.cohortName} · {progress.studied} / {progress.total} studied
                    {progress.status === 'complete' ? ' · Complete' : ''}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ModulesSection(): JSX.Element | null {
  const { status } = useAuth();
  const snapshotQuery = useProgressSnapshot();
  if (status !== 'authenticated') return null;

  const modules = buildLearningModules();
  const studiedKeys =
    snapshotQuery.isLoading && !snapshotQuery.data ? null : (snapshotQuery.data?.studiedKeys ?? []);

  return (
    <section
      aria-label="Study modules"
      className="flex flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-soft sm:p-5"
      data-testid="learn-modules"
    >
      <SectionHeader
        kicker="Curriculum"
        title="Study modules"
        description="One module per body system, built from verified records. Progress is derived from your studied structures."
      />
      {studiedKeys === null ? (
        <Skeleton className="h-20 w-full" data-testid="learn-modules-loading" />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" data-testid="learn-module-list">
          {modules.map(module => {
            const progress = moduleProgress(module, studiedKeys);
            return (
              <li key={module.key} data-testid="learn-module">
                <Link
                  to={`/learn/${module.key}`}
                  data-testid={`learn-module-link-${module.key}`}
                  aria-label={`${module.title} module, ${progress.studied} of ${progress.total} studied`}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 shadow-soft transition-colors hover:border-slate-700 hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 sm:px-4"
                >
                  <ProgressRing
                    value={progress.studied}
                    max={progress.total}
                    size={44}
                    strokeWidth={5}
                    testId={`learn-module-ring-${module.key}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-100">
                      {module.title}
                    </span>
                    <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
                      {progress.studied} / {progress.total} studied
                      {progress.status === 'complete' ? ' · Complete' : ''}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ContinueSection(): JSX.Element | null {
  const { status } = useAuth();
  const snapshotQuery = useProgressSnapshot();
  if (status !== 'authenticated') return null;

  if (snapshotQuery.isLoading && !snapshotQuery.data) {
    return <Skeleton className="h-32 w-full" data-testid="learn-continue-loading" />;
  }

  const keys = snapshotQuery.data?.studiedKeys ?? [];
  const target = findContinueTarget(buildLearningModules(), keys);
  const targetName = target ? displayNameForStudiedKey(target.structureKey) : null;

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
      <h2 className="mt-2 max-w-xl text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
        {target && targetName
          ? `Pick up with ${targetName}`
          : 'Open the 3D viewer to keep learning'}
      </h2>
      <p className="mt-1 max-w-xl text-sm text-slate-400">
        {target
          ? 'Jump straight back into the viewer — new structures you select are tracked automatically.'
          : 'Explore any body system — every structure you select builds your history here.'}
      </p>
      <div className="mt-4">
        <Button asChild>
          <Link
            to={target ? buildHumanFocusUrl(target.structureKey) : '/human'}
            data-testid="learn-continue-link"
          >
            {target ? 'Continue in 3D viewer' : 'Open 3D viewer'}
          </Link>
        </Button>
      </div>
    </section>
  );
}

export default function LearnPage(): JSX.Element {
  const { status } = useAuth();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6"
    >
      <div>
        <p className="ax-kicker">Learn</p>
        <h1
          className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
          data-testid="learn-title"
        >
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
          <Reveal>
            <ProgressSummary />
          </Reveal>
          <Reveal delay={0.05}>
            <ContinueSection />
          </Reveal>
          <Reveal delay={0.05}>
            <AssignedModulesSection />
          </Reveal>
          <Reveal delay={0.05}>
            <ModulesSection />
          </Reveal>
          <Reveal delay={0.05}>
            <section
              aria-label="Studied structures"
              className="flex flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-soft sm:p-5"
            >
              <SectionHeader
                kicker="Library"
                title="Studied structures"
                description="Everything you have selected in the 3D viewer, ready to reopen."
              />
              <StudiedStructures />
            </section>
          </Reveal>
          <Reveal delay={0.1}>
            <section
              aria-label="Quiz history"
              className="flex flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-soft sm:p-5"
            >
              <SectionHeader
                kicker="Practice"
                title="Quiz history"
                description="Tap Details to review answers and open structures in 3D."
              />
              <QuizHistoryList />
            </section>
          </Reveal>
        </>
      )}
    </main>
  );
}
