import { Link } from 'react-router-dom';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/auth/AuthProvider';
import { QuizHistoryList } from '@/components/learning/QuizAttempts';
import StudiedStructures from '@/components/learning/StudiedStructures';
import { useProgressSnapshot } from '@/hooks/useProgress';
import { buildHumanFocusUrl } from '@/lib/humanLink';

function ContinueSection(): JSX.Element | null {
  const { status } = useAuth();
  const snapshotQuery = useProgressSnapshot();
  if (status !== 'authenticated') return null;

  const keys = snapshotQuery.data?.studiedKeys ?? [];
  const target = keys.length > 0 ? keys[0] : null;

  return (
    <section
      aria-label="Continue learning"
      className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        Continue learning
      </h2>
      {snapshotQuery.isLoading && !snapshotQuery.data ? (
        <p className="mt-2 text-sm text-slate-500" data-testid="learn-continue-loading">
          Loading your progress…
        </p>
      ) : (
        <div className="mt-2">
          <Link
            to={target ? buildHumanFocusUrl(target) : '/human'}
            data-testid="learn-continue-link"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-teal-500/20 px-4 py-2.5 text-sm font-medium text-teal-300 hover:bg-teal-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            {target ? 'Continue in 3D viewer' : 'Open 3D viewer'}
          </Link>
        </div>
      )}
    </section>
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
          <p className="text-sm text-slate-500" data-testid="learn-loading">
            Checking session…
          </p>
        ) : status !== 'authenticated' ? (
          <section
            aria-label="Sign in required"
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
          >
            <p className="text-sm text-slate-300" data-testid="learn-anonymous">
              Sign in to track studied structures and quiz history.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/login"
                data-testid="learn-cta-login"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-teal-500/20 px-4 py-2.5 text-sm font-medium text-teal-300 hover:bg-teal-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                data-testid="learn-cta-register"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                Create account
              </Link>
              <Link
                to="/human"
                data-testid="learn-cta-explore"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                Explore anatomy
              </Link>
            </div>
          </section>
        ) : (
          <>
            <ContinueSection />
            <section
              aria-label="Studied structures"
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Studied structures
              </h2>
              <div className="mt-2">
                <StudiedStructures />
              </div>
            </section>
            <section
              aria-label="Quiz history"
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Quiz history
              </h2>
              <div className="mt-2">
                <QuizHistoryList />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
