import { Link } from 'react-router-dom';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/auth/AuthProvider';
import { QuizRecent } from '@/components/learning/QuizAttempts';
import StudiedStructures from '@/components/learning/StudiedStructures';
import { useProgressSnapshot } from '@/hooks/useProgress';
import { buildHumanFocusUrl } from '@/lib/humanLink';

function ContinueCard(): JSX.Element | null {
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
        <p className="mt-2 text-sm text-slate-500" data-testid="continue-loading">
          Loading your progress…
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm text-slate-300">
            {target ? 'Pick up where you left off.' : 'Start exploring the human body in 3D.'}
          </p>
          <Link
            to={target ? buildHumanFocusUrl(target) : '/human'}
            data-testid="continue-link"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-teal-500/20 px-3 py-2.5 text-sm font-medium text-teal-300 hover:bg-teal-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            {target ? 'Continue in 3D viewer' : 'Open 3D viewer'}
          </Link>
        </div>
      )}
    </section>
  );
}

function PublicHome(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Welcome"
        className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
      >
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="home-title">
          Learn human anatomy in interactive 3D
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Explore body systems, search structures, compare anatomy, and test yourself with quizzes.
          Your progress syncs across devices when you sign in.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link
            to="/register"
            data-testid="home-cta-register"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-teal-500/20 px-4 py-2.5 text-sm font-medium text-teal-300 hover:bg-teal-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            Create a free account
          </Link>
          <Link
            to="/login"
            data-testid="home-cta-login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            Sign in
          </Link>
          <Link
            to="/human"
            data-testid="home-cta-explore"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            Explore anatomy
          </Link>
        </div>
      </section>

      <section aria-label="Features" className="grid gap-4 sm:grid-cols-3">
        {[
          { title: '3D viewer', body: 'Rotate, zoom, and isolate nine body systems.' },
          { title: 'Quizzes', body: 'Test recall with instant review of every answer.' },
          { title: 'Progress sync', body: 'Studied structures and attempts follow you.' },
        ].map(feature => (
          <div
            key={feature.title}
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
          >
            <h2 className="text-sm font-semibold text-slate-100">{feature.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{feature.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function Dashboard(): JSX.Element {
  const { user } = useAuth();
  return (
    <div className="flex flex-col gap-4" data-testid="home-dashboard">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="home-title">
          Welcome{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-400">Here is your learning at a glance.</p>
      </div>
      <ContinueCard />
      <section
        aria-label="Studied structures"
        className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Studied structures
        </h2>
        <div className="mt-2">
          <StudiedStructures preview />
        </div>
      </section>
      <section
        aria-label="Recent quiz attempts"
        className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Recent quizzes
        </h2>
        <div className="mt-2">
          <QuizRecent />
        </div>
      </section>
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
          <p className="text-sm text-slate-500" data-testid="home-loading">
            Checking session…
          </p>
        ) : status === 'authenticated' ? (
          <Dashboard />
        ) : (
          <PublicHome />
        )}
      </main>
    </div>
  );
}
