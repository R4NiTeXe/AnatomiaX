import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyCohortError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
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
    <Card>
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
          Create cohort
        </CardTitle>
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
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
          Join with invite code
        </CardTitle>
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
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6"
    >
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
        <Alert variant="success" data-testid="cohort-created-invite">
          <AlertDescription>
            <p className="text-sm font-medium text-teal-200">
              Cohort created — share this invite code:
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={freshInvite.code}
                data-testid="cohort-created-code"
                aria-label="New invite code"
                onFocus={event => event.target.select()}
              />
              <Button
                variant="outline"
                type="button"
                onClick={handleCopy}
                data-testid="cohort-copy-invite"
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button variant="outline" asChild>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
            Your cohorts
          </CardTitle>
        </CardHeader>
        <CardContent>
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
              >
                Retry
              </Button>
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
                <li key={cohort.id} data-testid="cohort-item">
                  <Card className="flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-950/60">
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
                      <Badge variant="secondary" data-testid="cohort-archived-badge">
                        Archived
                      </Badge>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
