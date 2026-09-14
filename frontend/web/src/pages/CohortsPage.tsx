import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SiteNav from '@/components/SiteNav';
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
    <Card>
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
          Create cohort
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cohort-name">Cohort name</Label>
            <Input
              id="cohort-name"
              type="text"
              required
              minLength={1}
              maxLength={120}
              autoComplete="off"
              value={name}
              onChange={event => setName(event.target.value)}
              data-testid="cohort-create-name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cohort-institution">
              Institution <span className="text-slate-500">(optional)</span>
            </Label>
            <Input
              id="cohort-institution"
              type="text"
              maxLength={120}
              autoComplete="off"
              value={institutionLabel}
              onChange={event => setInstitutionLabel(event.target.value)}
              data-testid="cohort-create-institution"
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
    <Card>
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
          Join with invite code
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cohort-invite">Invite code</Label>
            <Input
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNav />
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
    </div>
  );
}
