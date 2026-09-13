import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SiteNav from '@/components/SiteNav';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyCohortError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
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

const inputClass =
  'min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';
const secondaryButtonClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';
const dangerButtonClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-2.5 text-sm font-medium text-red-200 hover:bg-red-950/70 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400';

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
      <label htmlFor="cohort-edit-name" className="flex flex-col gap-1 text-xs text-slate-400">
        Cohort name
        <input
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
          className={inputClass}
        />
      </label>
      <label
        htmlFor="cohort-edit-institution"
        className="flex flex-col gap-1 text-xs text-slate-400"
      >
        Institution
        <input
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
          className={inputClass}
        />
      </label>
      <AuthErrorNotice error={error} testId="cohort-edit-error" />
      {saved ? (
        <p role="status" data-testid="cohort-edit-saved" className="text-sm text-teal-300">
          Saved.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={updateMutation.isPending}
        data-testid="cohort-edit-submit"
        className={secondaryButtonClass}
      >
        {updateMutation.isPending ? 'Saving…' : 'Save changes'}
      </button>
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
    <section
      aria-label="Invite code"
      className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        Invite code
      </h2>
      {code ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={code}
            data-testid="cohort-invite-code"
            aria-label="Current invite code"
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
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500" data-testid="cohort-invite-unrevealed">
          Invite codes are shown only when created or regenerated — never stored on this page.
        </p>
      )}
      <AuthErrorNotice error={error} testId="cohort-invite-error" />
      <div className="mt-3">
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerateMutation.isPending}
          data-testid="cohort-regenerate"
          className={secondaryButtonClass}
        >
          {regenerateMutation.isPending
            ? 'Regenerating…'
            : code
              ? 'Regenerate code'
              : 'Reveal invite code'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Regenerating invalidates the previous code immediately.
      </p>
    </section>
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
    <section
      aria-label="Archive and leave"
      className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        Archive and leave
      </h2>
      <AuthErrorNotice error={error} testId="cohort-danger-error" />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleArchive}
          disabled={archiveMutation.isPending}
          data-testid="cohort-archive"
          className={dangerButtonClass}
        >
          {confirmArchive ? `Confirm archive of “${name}”?` : 'Archive cohort'}
        </button>
        <button
          type="button"
          onClick={handleLeave}
          disabled={leaveMutation.isPending}
          data-testid="cohort-leave"
          className={secondaryButtonClass}
        >
          {confirmLeave ? 'Confirm leave?' : 'Leave cohort'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Archiving is read-only for everyone afterwards; leaving keeps the cohort itself intact.
      </p>
    </section>
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
    <section
      aria-label="Leave cohort"
      className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Membership</h2>
      <AuthErrorNotice error={error} testId="cohort-leave-error" />
      <div className="mt-3">
        <button
          type="button"
          onClick={handleLeave}
          disabled={leaveMutation.isPending}
          data-testid="cohort-leave"
          className={secondaryButtonClass}
        >
          {confirmLeave ? 'Confirm leave?' : 'Leave cohort'}
        </button>
      </div>
    </section>
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
    return (
      <p className="text-sm text-slate-500" data-testid="members-loading">
        Loading members…
      </p>
    );
  }
  if (membersQuery.isError) {
    return (
      <div className="flex flex-col gap-2">
        <AuthErrorNotice error={friendlyCohortError(membersQuery.error)} testId="members-error" />
        <button
          type="button"
          onClick={() => membersQuery.refetch()}
          data-testid="members-retry"
          className={secondaryButtonClass}
        >
          Retry
        </button>
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
          <li
            key={member.userId}
            data-testid="member-item"
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5"
          >
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
              <button
                type="button"
                onClick={() => handleRemove(member.userId)}
                disabled={removeMutation.isPending}
                data-testid="member-remove"
                className="shrink-0 rounded px-2 py-1 text-xs text-red-300 hover:bg-red-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                {armedId === member.userId ? 'Confirm remove?' : 'Remove'}
              </button>
            ) : null}
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
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6">
        <Link
          to="/cohorts"
          className="w-fit rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          ← Back to My Cohorts
        </Link>

        {cohortQuery.isLoading && !cohort ? (
          <p className="text-sm text-slate-500" data-testid="cohort-detail-loading">
            Loading cohort…
          </p>
        ) : cohortQuery.isError || !cohort ? (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <h1 className="text-xl font-bold tracking-tight" data-testid="cohort-not-found">
              Cohort not found
            </h1>
            <AuthErrorNotice
              error={cohortQuery.error ? friendlyCohortError(cohortQuery.error) : null}
              testId="cohort-detail-error"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleRetry}
                data-testid="cohort-detail-retry"
                className={secondaryButtonClass}
              >
                Retry
              </button>
              <Link to="/cohorts" className={secondaryButtonClass}>
                Back to My Cohorts
              </Link>
            </div>
          </div>
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
                <span
                  data-testid="cohort-role-badge"
                  className="rounded bg-slate-800 px-2 py-0.5 text-xs uppercase text-slate-300"
                >
                  {cohort.myRole ?? 'MEMBER'}
                </span>
                {isArchived ? (
                  <span
                    data-testid="cohort-archived-badge"
                    className="rounded bg-slate-800 px-2 py-0.5 text-xs uppercase text-slate-400"
                  >
                    Archived
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-400" data-testid="cohort-institution">
                {cohort.institutionLabel ?? 'No institution'}
              </p>
            </div>

            {isArchived ? (
              <p
                role="status"
                data-testid="cohort-archived-notice"
                className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 text-sm text-slate-300"
              >
                This cohort is archived and read-only. Members can still view and leave.
              </p>
            ) : null}

            {canManage && !isArchived ? <InviteCard id={cohort.id} /> : null}

            {canManage && !isArchived ? (
              <section
                aria-label="Edit cohort"
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
              >
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Edit cohort
                </h2>
                <EditCohortForm key={cohort.id} cohort={cohort} />
              </section>
            ) : null}

            <section
              aria-label="Members"
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Members
              </h2>
              <div className="mt-2">
                <MembersSection
                  id={cohort.id}
                  canManage={canManage}
                  isArchived={isArchived}
                  ownUserId={user?.id}
                />
              </div>
            </section>

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
