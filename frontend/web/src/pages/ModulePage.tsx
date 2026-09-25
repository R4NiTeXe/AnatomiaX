import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Reveal } from '@/components/motion';
import ProgressRing from '@/components/learning/ProgressRing';
import SectionHeader from '@/components/learning/SectionHeader';
import { displayNameForStudiedKey } from '@/components/learning/StudiedStructures';
import { getLearningModule, moduleProgress } from '@/components/learning/modules';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useProgressSnapshot } from '@/hooks/useProgress';
import { buildHumanFocusUrl } from '@/lib/humanLink';

export default function ModulePage(): JSX.Element {
  const { systemKey } = useParams<{ systemKey: string }>();
  const { status } = useAuth();
  const snapshotQuery = useProgressSnapshot();
  const module = systemKey ? getLearningModule(systemKey) : undefined;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6"
    >
      <div>
        <p className="ax-kicker">Study module</p>
        <h1
          className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
          data-testid="module-title"
        >
          {module ? module.title : 'Unknown module'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          <Link
            to="/learn"
            className="text-teal-300 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            data-testid="module-back-learn"
          >
            ← Back to Learn
          </Link>
        </p>
      </div>

      {!module ? (
        <Card className="p-6" data-testid="module-not-found">
          <p className="text-sm text-slate-300">
            This study module doesn&apos;t exist. Choose a module from Learn.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link to="/learn" data-testid="module-not-found-learn">
                Open Learn
              </Link>
            </Button>
          </div>
        </Card>
      ) : status === 'loading' ||
        (status === 'authenticated' && snapshotQuery.isLoading && !snapshotQuery.data) ? (
        <Skeleton className="h-32 w-full" data-testid="module-loading" />
      ) : (
        <ModuleContent systemKey={module.key} />
      )}
    </main>
  );
}

function ModuleContent({ systemKey }: { systemKey: string }): JSX.Element {
  const module = getLearningModule(systemKey) as NonNullable<ReturnType<typeof getLearningModule>>;
  const { status } = useAuth();
  const snapshotQuery = useProgressSnapshot();
  const studiedKeys = status === 'authenticated' ? (snapshotQuery.data?.studiedKeys ?? []) : [];
  const progress = moduleProgress(module, studiedKeys);
  const nextKey = module.structureKeys.find(key => !studiedKeys.includes(key)) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <section
          aria-label="Module progress"
          className="flex items-center gap-4 rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-soft sm:p-5"
          data-testid="module-progress"
        >
          <ProgressRing
            value={progress.studied}
            max={progress.total}
            size={64}
            strokeWidth={7}
            testId="module-progress-ring"
          />
          <div className="min-w-0 flex-1">
            <p className="ax-section-title">Progress</p>
            <p className="mt-1 text-sm text-slate-300" data-testid="module-progress-text">
              {progress.studied} of {progress.total} structures studied
              {progress.status === 'complete' ? ' — module complete' : ''}
            </p>
            {status !== 'authenticated' ? (
              <p className="mt-1 text-xs text-slate-500" data-testid="module-anonymous-note">
                <Link
                  to="/login"
                  className="text-teal-300 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                >
                  Sign in
                </Link>{' '}
                to track progress across devices.
              </p>
            ) : nextKey ? (
              <div className="mt-3">
                <Button asChild>
                  <Link to={buildHumanFocusUrl(nextKey)} data-testid="module-continue-link">
                    {progress.studied === 0
                      ? `Start study with ${displayNameForStudiedKey(nextKey)}`
                      : `Continue with ${displayNameForStudiedKey(nextKey)}`}
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.05}>
        <section
          aria-label="Module structures"
          className="flex flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-soft sm:p-5"
        >
          <SectionHeader
            kicker="Curriculum"
            title="Structures"
            description="Verified records in this system — open any structure in the 3D viewer."
          />
          <ul className="flex flex-col gap-1.5" data-testid="module-structure-list">
            {module.structureKeys.map(key => {
              const studied = studiedKeys.includes(key);
              return (
                <li key={key} data-testid="module-structure">
                  <Link
                    to={buildHumanFocusUrl(key)}
                    data-testid="module-structure-open"
                    aria-label={`${studied ? 'Studied: ' : ''}Open ${displayNameForStudiedKey(key)} in 3D viewer`}
                    className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5 transition-colors hover:border-slate-700 hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">
                      {displayNameForStudiedKey(key)}
                    </span>
                    {studied ? (
                      <span
                        className="shrink-0 rounded bg-teal-500/20 px-2 py-0.5 text-xs font-medium text-teal-200"
                        data-testid="module-structure-studied"
                      >
                        ✓ Studied
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </Reveal>
    </div>
  );
}
