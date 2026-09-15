import { Link } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import ProgressSummary from '@/components/learning/ProgressSummary';
import { QuizHistoryList } from '@/components/learning/QuizAttempts';
import StudiedStructures, {
  displayNameForStudiedKey,
} from '@/components/learning/StudiedStructures';
import SectionHeader from '@/components/learning/SectionHeader';
import { Reveal } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useProgressSnapshot } from '@/hooks/useProgress';
import { buildHumanFocusUrl } from '@/lib/humanLink';

function ContinueSection(): JSX.Element | null {
  const { status } = useAuth();
  const snapshotQuery = useProgressSnapshot();
  if (status !== 'authenticated') return null;

  if (snapshotQuery.isLoading && !snapshotQuery.data) {
    return <Skeleton className="h-32 w-full" data-testid="learn-continue-loading" />;
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
            to={target ? buildHumanFocusUrl(target) : '/human'}
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
