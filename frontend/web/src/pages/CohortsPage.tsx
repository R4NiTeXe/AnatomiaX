import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyCohortError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import SectionHeader from '@/components/learning/SectionHeader';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCreateCohort, useJoinCohort, useMyCohorts } from '@/hooks/useCohorts';

type CreateCohortFormValues = {
  name: string;
  institutionLabel: string;
};

function CreateCohortCard({
  onCreated,
}: {
  onCreated: (inviteCode: string, id: string) => void;
}): JSX.Element {
  const createMutation = useCreateCohort();
  const [error, setError] = useState<FriendlyAuthError | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCohortFormValues>({
    defaultValues: { name: '', institutionLabel: '' },
  });

  const onSubmit = handleSubmit(async values => {
    if (createMutation.isPending) return;
    setError(null);
    try {
      const created = await createMutation.mutateAsync({
        name: values.name.trim(),
        ...(values.institutionLabel.trim()
          ? { institutionLabel: values.institutionLabel.trim() }
          : {}),
      });
      reset();
      onCreated(created.inviteCode, created.id);
    } catch (err) {
      setError(friendlyCohortError(err));
    }
  });

  return (
    <Card className="border-teal-900/40 bg-gradient-to-br from-teal-950/30 via-slate-900/40 to-slate-900/20">
      <CardHeader className="pb-3">
        <p className="ax-kicker">Create</p>
        <CardTitle className="text-sm font-bold tracking-tight text-slate-100">
          New cohort
        </CardTitle>
        <p className="text-xs leading-5 text-slate-400">For your classes — you become the owner.</p>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cohort-name">Cohort name</Label>
            <Controller
              name="name"
              control={control}
              rules={{ required: true, minLength: 1, maxLength: 120 }}
              render={({ field }) => (
                <Input
                  id="cohort-name"
                  type="text"
                  required
                  minLength={1}
                  maxLength={120}
                  autoComplete="off"
                  data-testid="cohort-create-name"
                  aria-invalid={!!errors.name}
                  {...field}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cohort-institution">
              Institution <span className="text-slate-500">(optional)</span>
            </Label>
            <Controller
              name="institutionLabel"
              control={control}
              rules={{ maxLength: 120 }}
              render={({ field }) => (
                <Input
                  id="cohort-institution"
                  type="text"
                  maxLength={120}
                  autoComplete="off"
                  data-testid="cohort-create-institution"
                  aria-invalid={!!errors.institutionLabel}
                  {...field}
                />
              )}
            />
          </div>
          <AuthErrorNotice error={error} testId="cohort-create-error" />
          <Button
            type="submit"
            disabled={createMutation.isPending}
            data-testid="cohort-create-submit"
          >
            {createMutation.isPending ? 'Creating…' : 'Create cohort'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

type JoinCohortFormValues = {
  inviteCode: string;
};

function JoinCohortCard(): JSX.Element {
  const navigate = useNavigate();
  const joinMutation = useJoinCohort();
  const [error, setError] = useState<FriendlyAuthError | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinCohortFormValues>({
    defaultValues: { inviteCode: '' },
  });

  const onSubmit = handleSubmit(async values => {
    if (joinMutation.isPending) return;
    setError(null);
    try {
      const view = await joinMutation.mutateAsync(values.inviteCode.trim());
      navigate(`/cohorts/${view.id}`);
    } catch (err) {
      setError(friendlyCohortError(err));
    }
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <p className="ax-kicker">Join</p>
        <CardTitle className="text-sm font-bold tracking-tight text-slate-100">
          Join with invite code
        </CardTitle>
        <p className="text-xs leading-5 text-slate-400">From your teacher — one-time code.</p>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cohort-invite">Invite code</Label>
            <Controller
              name="inviteCode"
              control={control}
              rules={{ required: true, minLength: 1, maxLength: 128 }}
              render={({ field }) => (
                <Input
                  id="cohort-invite"
                  type="text"
                  required
                  minLength={1}
                  maxLength={128}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  data-testid="cohort-join-code"
                  aria-invalid={!!errors.inviteCode}
                  {...field}
                />
              )}
            />
          </div>
          <AuthErrorNotice error={error} testId="cohort-join-error" />
          <Button
            type="submit"
            variant="outline"
            disabled={joinMutation.isPending}
            data-testid="cohort-join-submit"
          >
            {joinMutation.isPending ? 'Joining…' : 'Join cohort'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function CohortsPage(): JSX.Element {
  const { user } = useAuth();
  const cohortsQuery = useMyCohorts();
  const [freshInvite, setFreshInvite] = useState<{ code: string; id: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const canCreate = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const cohorts = cohortsQuery.data ?? [];
  const activeCount = cohorts.filter(c => !c.archivedAt).length;
  const archivedCount = cohorts.length - activeCount;

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
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6"
    >
      <div>
        <p className="ax-kicker">Teaching</p>
        <h1
          className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
          data-testid="cohorts-title"
        >
          My Cohorts
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          {canCreate
            ? 'Create cohorts for your classes and share invite codes with students.'
            : 'Join a cohort with an invite code from your teacher.'}
        </p>
        {cohortsQuery.data ? (
          <p className="mt-2 text-xs text-slate-500">
            {cohorts.length} total · {activeCount} active
            {archivedCount > 0 ? ` · ${archivedCount} archived` : ''} ·{' '}
            {canCreate ? 'owner' : 'member'} view
          </p>
        ) : null}
      </div>

      {freshInvite ? (
        <Reveal>
          <Alert
            variant="success"
            data-testid="cohort-created-invite"
            className="border-teal-800/50 shadow-glow-sm"
          >
            <AlertDescription>
              <p className="text-sm font-semibold text-teal-200">
                Cohort created — share this invite code:
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  readOnly
                  value={freshInvite.code}
                  data-testid="cohort-created-code"
                  aria-label="New invite code"
                  onFocus={event => event.target.select()}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleCopy}
                  data-testid="cohort-copy-invite"
                  className="shrink-0"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button variant="outline" asChild className="shrink-0">
                  <Link to={`/cohorts/${freshInvite.id}`} data-testid="cohort-created-open">
                    Open cohort
                  </Link>
                </Button>
              </div>
              <p className="mt-2 text-xs text-teal-200/70">
                The code is shown only here — store it somewhere safe.
              </p>
            </AlertDescription>
          </Alert>
        </Reveal>
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

      <Reveal delay={0.05}>
        <section
          aria-label="Your cohorts"
          className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 shadow-soft sm:p-5"
        >
          <SectionHeader
            kicker="Library"
            title="Your cohorts"
            description={
              cohorts.length > 0
                ? `${cohorts.length} cohort${cohorts.length === 1 ? '' : 's'} · sorted by creation`
                : undefined
            }
          />
          <div className="mt-4">
            {cohortsQuery.isLoading && !cohortsQuery.data ? (
              <Skeleton className="h-10 w-full" data-testid="cohorts-loading" />
            ) : cohortsQuery.isError ? (
              <div className="flex flex-col gap-2">
                <AuthErrorNotice
                  error={friendlyCohortError(cohortsQuery.error)}
                  testId="cohorts-error"
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => cohortsQuery.refetch()}
                  data-testid="cohorts-retry"
                  className="w-fit"
                >
                  Retry
                </Button>
              </div>
            ) : cohorts.length === 0 ? (
              <div
                className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-6 py-10 text-center"
                data-testid="cohorts-empty"
              >
                <p className="text-sm font-medium text-slate-200">
                  {canCreate ? 'No cohorts yet' : 'No memberships yet'}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
                  {canCreate
                    ? 'Create your first cohort above — you will receive an invite code to share.'
                    : 'Ask your teacher for an invite code and join above.'}
                </p>
              </div>
            ) : (
              <Stagger>
                <ul className="flex flex-col gap-2" data-testid="cohorts-list">
                  {cohorts.map(cohort => (
                    <StaggerItem as="li" key={cohort.id} data-testid="cohort-item">
                      <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 shadow-soft transition-colors hover:border-slate-700 hover:bg-slate-900/60 sm:px-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/60 text-[0.7rem] font-bold tracking-widest text-slate-400">
                          {(cohort.name.trim().charAt(0) || '?').toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/cohorts/${cohort.id}`}
                            data-testid="cohort-open"
                            className="block truncate text-sm font-semibold text-slate-100 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                          >
                            {cohort.name}
                          </Link>
                          <p className="truncate text-xs text-slate-500">
                            {cohort.institutionLabel ?? 'No institution'} ·{' '}
                            <span className="font-medium uppercase tracking-wide">
                              {cohort.myRole ?? 'MEMBER'}
                            </span>
                            {cohort.archivedAt ? ' · Archived' : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {cohort.archivedAt ? (
                            <Badge variant="secondary" data-testid="cohort-archived-badge">
                              Archived
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="hidden border-emerald-900/40 text-emerald-300 sm:inline-flex"
                            >
                              Active
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="hidden sm:inline-flex"
                          >
                            <Link to={`/cohorts/${cohort.id}`}>Open</Link>
                          </Button>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </ul>
              </Stagger>
            )}
          </div>
        </section>
      </Reveal>
    </main>
  );
}
