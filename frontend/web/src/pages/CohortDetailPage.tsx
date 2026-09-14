import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SiteNav from '@/components/SiteNav';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyCohortError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
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

function EditCohortForm({ cohort }: { cohort: CohortView }): JSX.Element {
  const updateMutation = useUpdateCohort(cohort.id);
  const [name, setName] = useState(cohort.name);
  const [institutionLabel, setInstitutionLabel] = useState(cohort.institutionLabel ?? '');
  const [error, setError] = useState<FriendlyAuthError | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (updateMutation.isPending) return;
    setError(null);
    setSaved(false);
    try {
      await updateMutation.mutateAsync({
        name: name.trim(),
        institutionLabel: institutionLabel.trim(),
      });
      setSaved(true);
    } catch (err) {
      setError(friendlyCohortError(err));
    }
  };

  return (
    <form className="mt-3 flex flex-col gap-3" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cohort-edit-name">Cohort name</Label>
        <Input
          id="cohort-edit-name"
          type="text"
          required
          minLength={1}
          maxLength={120}
          autoComplete="off"
          value={name}
          onChange={event => {
            setName(event.target.value);
            setSaved(false);
          }}
          data-testid="cohort-edit-name"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cohort-edit-institution">Institution</Label>
        <Input
          id="cohort-edit-institution"
          type="text"
          maxLength={120}
          autoComplete="off"
          value={institutionLabel}
          onChange={event => {
            setInstitutionLabel(event.target.value);
            setSaved(false);
          }}
          data-testid="cohort-edit-institution"
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
    <Card>
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
          Invite code
        </CardTitle>
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
            />
            <Button
              variant="outline"
              type="button"
              onClick={handleCopy}
              data-testid="cohort-copy-invite"
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
    <Card>
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
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
        <p className="text-xs text-slate-500">
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
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
          Membership
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
        >
          Retry
        </Button>
      </div>
    );
  }

  const members = membersQuery.data ?? [];
  if (members.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-testid="members-empty">
        No members yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AuthErrorNotice error={error} testId="member-remove-error" />
      <ul className="flex flex-col gap-2" data-testid="members-list">
        {members.map(member => (
          <li key={member.userId} data-testid="member-item">
            <Card className="flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-950/60">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-100">
                  {member.name ?? 'Unnamed member'}
                  {member.userId === ownUserId ? ' (you)' : ''}
                </p>
                <p className="text-xs text-slate-500">
                  <span className="uppercase">{member.role}</span> · joined{' '}
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
                  className="text-red-300 hover:bg-red-950/40"
                >
                  {armedId === member.userId ? 'Confirm remove?' : 'Remove'}
                </Button>
              ) : null}
            </Card>
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNav />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6"
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
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="text-2xl font-bold tracking-tight sm:text-3xl"
                  data-testid="cohort-name"
                >
                  {cohort.name}
                </h1>
                <Badge data-testid="cohort-role-badge">{cohort.myRole ?? 'MEMBER'}</Badge>
                {isArchived ? (
                  <Badge variant="secondary" data-testid="cohort-archived-badge">
                    Archived
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-400" data-testid="cohort-institution">
                {cohort.institutionLabel ?? 'No institution'}
              </p>
            </div>

            {isArchived ? (
              <Alert data-testid="cohort-archived-notice">
                <AlertDescription>
                  This cohort is archived and read-only. Members can still view and leave.
                </AlertDescription>
              </Alert>
            ) : null}

            {canManage && !isArchived ? <InviteCard id={cohort.id} /> : null}

            {canManage && !isArchived ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
                    Edit cohort
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EditCohortForm key={cohort.id} cohort={cohort} />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
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

            {canManage && !isArchived ? (
              <DangerZone id={cohort.id} name={cohort.name} />
            ) : (
              <LeaveOnly id={cohort.id} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
