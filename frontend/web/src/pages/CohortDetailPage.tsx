import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyCohortError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { Reveal } from '@/components/motion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  canManageCohort,
  useArchiveCohort,
  useCohort,
  useCohortMembers,
  useLeaveCohort,
  useRegenerateInvite,
  useRemoveMember,
  useUpdateCohort,
} from '@/hooks/useCohorts';
import type { CohortView } from '@/lib/cohorts';

type EditCohortFormValues = {
  name: string;
  institutionLabel: string;
};

function EditCohortForm({ cohort }: { cohort: CohortView }): JSX.Element {
  const updateMutation = useUpdateCohort(cohort.id);
  const [error, setError] = useState<FriendlyAuthError | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditCohortFormValues>({
    defaultValues: {
      name: cohort.name,
      institutionLabel: cohort.institutionLabel ?? '',
    },
  });

  const onSubmit = handleSubmit(async values => {
    if (updateMutation.isPending) return;
    setError(null);
    setSaved(false);
    try {
      await updateMutation.mutateAsync({
        name: values.name.trim(),
        institutionLabel: values.institutionLabel.trim(),
      });
      setSaved(true);
    } catch (err) {
      setError(friendlyCohortError(err));
    }
  });

  return (
    <form className="mt-3 flex flex-col gap-3" onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cohort-edit-name">Cohort name</Label>
        <Controller
          name="name"
          control={control}
          rules={{ required: true, minLength: 1, maxLength: 120 }}
          render={({ field }) => (
            <Input
              id="cohort-edit-name"
              type="text"
              required
              minLength={1}
              maxLength={120}
              autoComplete="off"
              data-testid="cohort-edit-name"
              aria-invalid={!!errors.name}
              {...field}
              onChange={e => {
                field.onChange(e);
                setSaved(false);
              }}
            />
          )}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cohort-edit-institution">Institution</Label>
        <Controller
          name="institutionLabel"
          control={control}
          rules={{ maxLength: 120 }}
          render={({ field }) => (
            <Input
              id="cohort-edit-institution"
              type="text"
              maxLength={120}
              autoComplete="off"
              data-testid="cohort-edit-institution"
              aria-invalid={!!errors.institutionLabel}
              {...field}
              onChange={e => {
                field.onChange(e);
                setSaved(false);
              }}
            />
          )}
        />
      </div>
      <AuthErrorNotice error={error} testId="cohort-edit-error" />
      {saved ? (
        <p role="status" data-testid="cohort-edit-saved" className="text-sm text-teal-300">
          Saved.
        </p>
      ) : null}
      <Button
        type="submit"
        variant="outline"
        disabled={updateMutation.isPending}
        data-testid="cohort-edit-submit"
        className="w-fit"
      >
        {updateMutation.isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

function InviteCard({ id }: { id: string }): JSX.Element {
  const regenerateMutation = useRegenerateInvite(id);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyAuthError | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRegenerate = async () => {
    setError(null);
    try {
      const result = await regenerateMutation.mutateAsync();
      setCode(result.inviteCode);
      setCopied(false);
    } catch (err) {
      setError(friendlyCohortError(err));
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card className="border-slate-800/70">
      <CardHeader className="pb-3">
        <p className="ax-kicker">Access</p>
        <CardTitle className="text-sm font-bold tracking-tight text-slate-100">
          Invite code
        </CardTitle>
        <p className="text-xs leading-5 text-slate-500">
          Share with students — the code is shown only when created or regenerated.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {code ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={code}
              data-testid="cohort-invite-code"
              aria-label="Current invite code"
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
          </div>
        ) : (
          <p className="text-sm text-slate-500" data-testid="cohort-invite-unrevealed">
            Invite codes are shown only when created or regenerated — never stored on this page.
          </p>
        )}
        <AuthErrorNotice error={error} testId="cohort-invite-error" />
        <Button
          variant="outline"
          type="button"
          onClick={handleRegenerate}
          disabled={regenerateMutation.isPending}
          data-testid="cohort-regenerate"
          className="w-fit"
        >
          {regenerateMutation.isPending
            ? 'Regenerating…'
            : code
              ? 'Regenerate code'
              : 'Reveal invite code'}
        </Button>
        <p className="text-xs text-slate-500">
          Regenerating invalidates the previous code immediately.
        </p>
      </CardContent>
    </Card>
  );
}

function DangerZone({ id, name }: { id: string; name: string }): JSX.Element {
  const navigate = useNavigate();
  const archiveMutation = useArchiveCohort(id);
  const leaveMutation = useLeaveCohort(id);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [error, setError] = useState<FriendlyAuthError | null>(null);

  const handleArchive = async () => {
    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }
    setError(null);
    try {
      await archiveMutation.mutateAsync();
      setConfirmArchive(false);
    } catch (err) {
      setError(friendlyCohortError(err));
      setConfirmArchive(false);
    }
  };

  const handleLeave = async () => {
    if (!confirmLeave) {
      setConfirmLeave(true);
      return;
    }
    setError(null);
    try {
      await leaveMutation.mutateAsync();
      navigate('/cohorts');
    } catch (err) {
      setError(friendlyCohortError(err));
      setConfirmLeave(false);
    }
  };

  return (
    <Card className="border-amber-900/30 bg-amber-950/10">
      <CardHeader className="pb-3">
        <p className="ax-kicker text-amber-300/80">Danger zone</p>
        <CardTitle className="text-sm font-bold tracking-tight text-slate-100">
          Archive and leave
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <AuthErrorNotice error={error} testId="cohort-danger-error" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="destructive"
            type="button"
            onClick={handleArchive}
            disabled={archiveMutation.isPending}
            data-testid="cohort-archive"
          >
            {confirmArchive ? `Confirm archive of “${name}”?` : 'Archive cohort'}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={handleLeave}
            disabled={leaveMutation.isPending}
            data-testid="cohort-leave"
          >
            {confirmLeave ? 'Confirm leave?' : 'Leave cohort'}
          </Button>
        </div>
        <p className="text-xs leading-5 text-slate-500">
          Archiving is read-only for everyone afterwards; leaving keeps the cohort itself intact.
        </p>
      </CardContent>
    </Card>
  );
}

function LeaveOnly({ id }: { id: string }): JSX.Element {
  const navigate = useNavigate();
  const leaveMutation = useLeaveCohort(id);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [error, setError] = useState<FriendlyAuthError | null>(null);

  const handleLeave = async () => {
    if (!confirmLeave) {
      setConfirmLeave(true);
      return;
    }
    setError(null);
    try {
      await leaveMutation.mutateAsync();
      navigate('/cohorts');
    } catch (err) {
      setError(friendlyCohortError(err));
      setConfirmLeave(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <p className="ax-kicker">Membership</p>
        <CardTitle className="text-sm font-bold tracking-tight text-slate-100">
          Leave cohort
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <AuthErrorNotice error={error} testId="cohort-leave-error" />
        <Button
          variant="outline"
          type="button"
          onClick={handleLeave}
          disabled={leaveMutation.isPending}
          data-testid="cohort-leave"
          className="w-fit"
        >
          {confirmLeave ? 'Confirm leave?' : 'Leave cohort'}
        </Button>
      </CardContent>
    </Card>
  );
}

function MembersSection({
  id,
  canManage,
  isArchived,
  ownUserId,
}: {
  id: string;
  canManage: boolean;
  isArchived: boolean;
  ownUserId: string | undefined;
}): JSX.Element {
  const membersQuery = useCohortMembers(id);
  const removeMutation = useRemoveMember(id);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyAuthError | null>(null);

  const handleRemove = async (targetUserId: string) => {
    if (armedId !== targetUserId) {
      setArmedId(targetUserId);
      return;
    }
    setError(null);
    try {
      await removeMutation.mutateAsync(targetUserId);
      setArmedId(null);
    } catch (err) {
      setError(friendlyCohortError(err));
      setArmedId(null);
    }
  };

  if (membersQuery.isLoading && !membersQuery.data) {
    return <Skeleton className="h-10 w-full" data-testid="members-loading" />;
  }
  if (membersQuery.isError) {
    return (
      <div className="flex flex-col gap-2">
        <AuthErrorNotice error={friendlyCohortError(membersQuery.error)} testId="members-error" />
        <Button
          variant="outline"
          type="button"
          onClick={() => membersQuery.refetch()}
          data-testid="members-retry"
          className="w-fit"
        >
          Retry
        </Button>
      </div>
    );
  }

  const members = membersQuery.data ?? [];
  if (members.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-6 py-10 text-center"
        data-testid="members-empty"
      >
        <p className="text-sm font-medium text-slate-200">No members yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
          Share the invite code above. As students join, they appear here with join date and role.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {members.length} member{members.length === 1 ? '' : 's'}
        </p>
        {canManage && !isArchived ? (
          <p className="text-xs text-slate-500">Remove is owner-only</p>
        ) : null}
      </div>
      <AuthErrorNotice error={error} testId="member-remove-error" />
      <ul className="flex flex-col gap-2" data-testid="members-list">
        {members.map(member => (
          <li key={member.userId} data-testid="member-item">
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 shadow-soft transition-colors hover:border-slate-700 sm:px-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/50 text-xs font-bold text-slate-300">
                {(member.name?.trim().charAt(0) || '?').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">
                  {member.name ?? 'Unnamed member'}
                  {member.userId === ownUserId ? ' (you)' : ''}
                </p>
                <p className="text-xs text-slate-500">
                  <span className="font-medium uppercase tracking-wide">{member.role}</span> ·
                  joined{' '}
                  {new Date(member.joinedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              {canManage && !isArchived && member.userId !== ownUserId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => handleRemove(member.userId)}
                  disabled={removeMutation.isPending}
                  data-testid="member-remove"
                  className="shrink-0 text-red-300 hover:bg-red-950/40 hover:text-red-200"
                >
                  {armedId === member.userId ? 'Confirm remove?' : 'Remove'}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CohortDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const cohortQuery = useCohort(id);
  const cohort = cohortQuery.data ?? null;
  const isArchived = !!cohort?.archivedAt;
  const canManage = cohort ? canManageCohort(cohort.myRole, user?.role) : false;

  const handleRetry = () => {
    cohortQuery.refetch();
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6"
    >
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link to="/cohorts">← Back to My Cohorts</Link>
      </Button>

      {cohortQuery.isLoading && !cohort ? (
        <Skeleton className="h-20 w-full" data-testid="cohort-detail-loading" />
      ) : cohortQuery.isError || !cohort ? (
        <Card className="p-6">
          <h1 className="text-xl font-bold tracking-tight" data-testid="cohort-not-found">
            Cohort not found
          </h1>
          <AuthErrorNotice
            error={cohortQuery.error ? friendlyCohortError(cohortQuery.error) : null}
            testId="cohort-detail-error"
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              type="button"
              onClick={handleRetry}
              data-testid="cohort-detail-retry"
            >
              Retry
            </Button>
            <Button variant="outline" asChild>
              <Link to="/cohorts">Back to My Cohorts</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Reveal>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 shadow-soft sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="ax-kicker">Cohort</p>
                  <h1
                    className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl"
                    data-testid="cohort-name"
                  >
                    {cohort.name}
                  </h1>
                  <p
                    className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400"
                    data-testid="cohort-institution"
                  >
                    <span>{cohort.institutionLabel ?? 'No institution'}</span>
                    <span className="hidden text-slate-600 sm:inline">·</span>
                    <Badge data-testid="cohort-role-badge" className="capitalize">
                      {cohort.myRole ?? 'MEMBER'}
                    </Badge>
                    {isArchived ? (
                      <Badge variant="secondary" data-testid="cohort-archived-badge">
                        Archived
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-900/50 text-emerald-300">
                        Active
                      </Badge>
                    )}
                  </p>
                </div>
                {(canManage || user?.role === 'TEACHER' || user?.role === 'ADMIN') &&
                user?.role !== 'STUDENT' ? (
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <Link
                      to={`/cohorts/${cohort.id}/dashboard`}
                      data-testid="cohort-dashboard-link"
                    >
                      View dashboard
                    </Link>
                  </Button>
                ) : null}
              </div>
              {isArchived ? (
                <Alert
                  data-testid="cohort-archived-notice"
                  className="mt-4 border-amber-900/50 bg-amber-950/30 text-amber-200"
                >
                  <AlertDescription>
                    This cohort is archived and read-only. Members can still view and leave.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          </Reveal>

          {canManage && !isArchived ? (
            <Reveal delay={0.05}>
              <InviteCard id={cohort.id} />
            </Reveal>
          ) : null}

          {canManage && !isArchived ? (
            <Reveal delay={0.05}>
              <Card>
                <CardHeader className="pb-3">
                  <p className="ax-kicker">Settings</p>
                  <CardTitle className="text-sm font-bold tracking-tight text-slate-100">
                    Edit cohort
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EditCohortForm key={cohort.id} cohort={cohort} />
                </CardContent>
              </Card>
            </Reveal>
          ) : null}

          <Reveal delay={0.08}>
            <Card>
              <CardHeader className="pb-3">
                <p className="ax-kicker">Roster</p>
                <CardTitle className="text-sm font-bold tracking-tight text-slate-100">
                  Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MembersSection
                  id={cohort.id}
                  canManage={canManage}
                  isArchived={isArchived}
                  ownUserId={user?.id}
                />
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={0.1}>
            {canManage && !isArchived ? (
              <DangerZone id={cohort.id} name={cohort.name} />
            ) : (
              <LeaveOnly id={cohort.id} />
            )}
          </Reveal>
        </>
      )}
    </main>
  );
}
