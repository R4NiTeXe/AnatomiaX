import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SiteNav from '@/components/SiteNav';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyCohortError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { useCreateCohort, useJoinCohort, useMyCohorts } from '@/hooks/useCohorts';

const inputClass =
  'min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';
const primaryButtonClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-teal-500/20 px-4 py-2.5 text-sm font-medium text-teal-300 hover:bg-teal-500/30 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';
const secondaryButtonClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';

function CreateCohortCard({
  onCreated,
}: {
  onCreated: (inviteCode: string, id: string) => void;
}): JSX.Element {
  const createMutation = useCreateCohort();
  const [name, setName] = useState('');
  const [institutionLabel, setInstitutionLabel] = useState('');
  const [error, setError] = useState<FriendlyAuthError | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (createMutation.isPending) return;
    setError(null);
    try {
      const created = await createMutation.mutateAsync({
        name: name.trim(),
        ...(institutionLabel.trim() ? { institutionLabel: institutionLabel.trim() } : {}),
      });
      setName('');
      setInstitutionLabel('');
      onCreated(created.inviteCode, created.id);
    } catch (err) {
      setError(friendlyCohortError(err));
    }
  };

  return (
    <section
      aria-label="Create cohort"
      className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        Create cohort
      </h2>
      <form className="mt-3 flex flex-col gap-3" onSubmit={handleSubmit}>
        <label htmlFor="cohort-name" className="flex flex-col gap-1 text-xs text-slate-400">
          Cohort name
          <input
            id="cohort-name"
            type="text"
            required
            minLength={1}
            maxLength={120}
            autoComplete="off"
            value={name}
            onChange={event => setName(event.target.value)}
            data-testid="cohort-create-name"
            className={inputClass}
          />
        </label>
        <label htmlFor="cohort-institution" className="flex flex-col gap-1 text-xs text-slate-400">
          Institution <span className="text-slate-500">(optional)</span>
          <input
            id="cohort-institution"
            type="text"
            maxLength={120}
            autoComplete="off"
            value={institutionLabel}
            onChange={event => setInstitutionLabel(event.target.value)}
            data-testid="cohort-create-institution"
            className={inputClass}
          />
        </label>
        <AuthErrorNotice error={error} testId="cohort-create-error" />
        <button
          type="submit"
          disabled={createMutation.isPending}
          data-testid="cohort-create-submit"
          className={primaryButtonClass}
        >
          {createMutation.isPending ? 'Creating…' : 'Create cohort'}
        </button>
      </form>
    </section>
  );
}

function JoinCohortCard(): JSX.Element {
  const navigate = useNavigate();
  const joinMutation = useJoinCohort();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<FriendlyAuthError | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (joinMutation.isPending) return;
    setError(null);
    try {
      const view = await joinMutation.mutateAsync(inviteCode.trim());
      navigate(`/cohorts/${view.id}`);
    } catch (err) {
      setError(friendlyCohortError(err));
    }
  };

  return (
    <section
      aria-label="Join cohort"
      className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        Join with invite code
      </h2>
      <form className="mt-3 flex flex-col gap-3" onSubmit={handleSubmit}>
        <label htmlFor="cohort-invite" className="flex flex-col gap-1 text-xs text-slate-400">
          Invite code
          <input
            id="cohort-invite"
            type="text"
            required
            minLength={1}
            maxLength={128}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            value={inviteCode}
            onChange={event => setInviteCode(event.target.value)}
            data-testid="cohort-join-code"
            className={inputClass}
          />
        </label>
        <AuthErrorNotice error={error} testId="cohort-join-error" />
        <button
          type="submit"
          disabled={joinMutation.isPending}
          data-testid="cohort-join-submit"
          className={secondaryButtonClass}
        >
          {joinMutation.isPending ? 'Joining…' : 'Join cohort'}
        </button>
      </form>
    </section>
  );
}

export default function CohortsPage(): JSX.Element {
  const { user } = useAuth();
  const cohortsQuery = useMyCohorts();
  const [freshInvite, setFreshInvite] = useState<{ code: string; id: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const canCreate = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const handleCopy = async () => {
    if (!freshInvite) return;
    try {
      await navigator.clipboard.writeText(freshInvite.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="cohorts-title">
            My Cohorts
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {canCreate
              ? 'Create cohorts for your classes and share invite codes with students.'
              : 'Join a cohort with an invite code from your teacher.'}
          </p>
        </div>

        {freshInvite ? (
          <div
            role="status"
            data-testid="cohort-created-invite"
            className="rounded-xl border border-teal-900/60 bg-teal-950/40 p-4"
          >
            <p className="text-sm font-medium text-teal-200">
              Cohort created — share this invite code:
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={freshInvite.code}
                data-testid="cohort-created-code"
                aria-label="New invite code"
                className={inputClass}
                onFocus={event => event.target.select()}
              />
              <button
                type="button"
                onClick={handleCopy}
                data-testid="cohort-copy-invite"
                className={secondaryButtonClass}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <Link
                to={`/cohorts/${freshInvite.id}`}
                data-testid="cohort-created-open"
                className={secondaryButtonClass}
              >
                Open cohort
              </Link>
            </div>
            <p className="mt-2 text-xs text-teal-200/70">
              The code is shown only here — store it somewhere safe.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {canCreate ? (
            <CreateCohortCard
              onCreated={(inviteCode, id) => {
                setCopied(false);
                setFreshInvite({ code: inviteCode, id });
              }}
            />
          ) : null}
          <JoinCohortCard />
        </div>

        <section
          aria-label="Cohort list"
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Your cohorts
          </h2>
          <div className="mt-2">
            {cohortsQuery.isLoading && !cohortsQuery.data ? (
              <p className="text-sm text-slate-500" data-testid="cohorts-loading">
                Loading cohorts…
              </p>
            ) : cohortsQuery.isError ? (
              <div className="flex flex-col gap-2">
                <AuthErrorNotice
                  error={friendlyCohortError(cohortsQuery.error)}
                  testId="cohorts-error"
                />
                <button
                  type="button"
                  onClick={() => cohortsQuery.refetch()}
                  data-testid="cohorts-retry"
                  className={secondaryButtonClass}
                >
                  Retry
                </button>
              </div>
            ) : (cohortsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500" data-testid="cohorts-empty">
                {canCreate
                  ? 'No cohorts yet. Create your first cohort above.'
                  : 'You have not joined any cohorts yet.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="cohorts-list">
                {(cohortsQuery.data ?? []).map(cohort => (
                  <li
                    key={cohort.id}
                    data-testid="cohort-item"
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/cohorts/${cohort.id}`}
                        data-testid="cohort-open"
                        className="block truncate text-sm font-medium text-slate-100 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                      >
                        {cohort.name}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {cohort.institutionLabel ?? 'No institution'} ·{' '}
                        <span className="uppercase">{cohort.myRole ?? 'MEMBER'}</span>
                        {cohort.archivedAt ? ' · Archived' : ''}
                      </p>
                    </div>
                    {cohort.archivedAt ? (
                      <span
                        data-testid="cohort-archived-badge"
                        className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400"
                      >
                        Archived
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
