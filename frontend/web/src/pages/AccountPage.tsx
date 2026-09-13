import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyAuthError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { useQuizAttempts } from '@/hooks/useProgress';
import { changePassword, deleteAccount, exportAccountData } from '@/lib/auth';

const inputClass =
  'min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';
const secondaryButtonClass =
  'min-h-[44px] rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';
const dangerButtonClass =
  'min-h-[44px] rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2.5 text-sm font-medium text-red-200 hover:bg-red-950/70 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400';

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function AccountPage(): JSX.Element {
  const { user, status, sessionExpired, logout } = useAuth();
  const attemptsQuery = useQuizAttempts();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<FriendlyAuthError | null>(null);

  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<FriendlyAuthError | null>(null);
  const [exportDone, setExportDone] = useState(false);

  const [confirmEmail, setConfirmEmail] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<FriendlyAuthError | null>(null);

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-500" data-testid="account-loading">
          Checking session…
        </p>
      </main>
    );
  }

  if (status !== 'authenticated' || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-400">
          Please{' '}
          <Link to="/login" className="text-teal-300 hover:text-teal-200">
            sign in
          </Link>{' '}
          to manage your account.
        </p>
      </main>
    );
  }

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordBusy) return;
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await changePassword(currentPassword ? currentPassword : undefined, newPassword);
      // Backend revokes all sessions on change — force a fresh sign-in.
      await logout();
      navigate('/login?changed=1', { replace: true });
    } catch (err) {
      setPasswordError(friendlyAuthError(err, { override401: 'Current password is incorrect.' }));
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleExport = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    setExportError(null);
    setExportDone(false);
    try {
      const data = await exportAccountData();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`anatomiax-export-${stamp}.json`, data);
      setExportDone(true);
    } catch (err) {
      setExportError(friendlyAuthError(err));
    } finally {
      setExportBusy(false);
    }
  };

  const deleteArmed =
    confirmChecked &&
    confirmEmail.trim().toLowerCase() === (user.email ?? '').toLowerCase() &&
    user.email;

  const handleDelete = async (event: FormEvent) => {
    event.preventDefault();
    if (deleteBusy || !deleteArmed) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      await logout();
      navigate('/login?deleted=1', { replace: true });
    } catch (err) {
      setDeleteError(friendlyAuthError(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            <Link to="/" className="hover:text-slate-300">
              AnatomiaX
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Account</h1>
          <nav
            aria-label="Primary"
            className="mt-2 flex items-center gap-1 text-sm"
            data-testid="account-nav"
          >
            <Link
              to="/"
              className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              Home
            </Link>
            <Link
              to="/human"
              className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              Anatomy
            </Link>
            <Link
              to="/learn"
              className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              Progress
            </Link>
          </nav>
        </div>

        {sessionExpired ? (
          <p
            role="status"
            data-testid="account-expired-notice"
            className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-200"
          >
            Your session expired. Please sign in again.
          </p>
        ) : null}

        <section
          aria-label="Profile"
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Profile
          </h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="w-24 shrink-0 text-slate-500">Email</dt>
              <dd className="break-all text-slate-100" data-testid="account-email">
                {user.email ?? '—'}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="w-24 shrink-0 text-slate-500">Name</dt>
              <dd className="text-slate-100" data-testid="account-name">
                {user.name ?? '—'}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="w-24 shrink-0 text-slate-500">Role</dt>
              <dd className="text-slate-100" data-testid="account-role">
                {user.role}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="w-24 shrink-0 text-slate-500">Sync</dt>
              <dd className="text-slate-100" data-testid="account-sync-state">
                {attemptsQuery.isError ? 'Sync unavailable' : 'Sync on'}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleLogout}
              data-testid="account-logout"
              className={secondaryButtonClass}
            >
              Sign out
            </button>
            <Link
              to="/human"
              className={`${secondaryButtonClass} inline-flex items-center justify-center`}
            >
              Open 3D viewer
            </Link>
          </div>
        </section>

        <section
          aria-label="Change password"
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Change password
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Changing your password signs you out on all devices.
          </p>
          <form className="mt-3 flex flex-col gap-3" onSubmit={handlePasswordChange}>
            <label htmlFor="account-current" className="flex flex-col gap-1 text-xs text-slate-400">
              Current password
              <input
                id="account-current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
                data-testid="account-current-password"
                className={inputClass}
              />
            </label>
            <label htmlFor="account-new" className="flex flex-col gap-1 text-xs text-slate-400">
              New password <span className="text-slate-500">(8+ characters)</span>
              <input
                id="account-new"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                data-testid="account-new-password"
                className={inputClass}
              />
            </label>
            <AuthErrorNotice error={passwordError} testId="account-password-error" />
            <button
              type="submit"
              disabled={passwordBusy}
              data-testid="account-password-submit"
              className={secondaryButtonClass}
            >
              {passwordBusy ? 'Changing…' : 'Change password'}
            </button>
          </form>
        </section>

        <section
          aria-label="Data export"
          className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Data export
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Download your cohorts, quiz attempts, and progress snapshot as JSON.
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={handleExport}
              disabled={exportBusy}
              data-testid="account-export"
              className={secondaryButtonClass}
            >
              {exportBusy ? 'Preparing…' : 'Download my data'}
            </button>
          </div>
          {exportDone ? (
            <p
              role="status"
              data-testid="account-export-done"
              className="mt-2 text-sm text-teal-300"
            >
              Export downloaded.
            </p>
          ) : null}
          <AuthErrorNotice error={exportError} testId="account-export-error" />
        </section>

        <section
          aria-label="Delete account"
          className="rounded-xl border border-red-900/60 bg-red-950/20 p-4"
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest text-red-300">
            Delete account
          </h2>
          <p className="mt-1 text-xs text-red-200/80">
            Permanently deletes your account, progress, and attempts. Cohorts you created survive
            without you. This cannot be undone.
          </p>
          <form className="mt-3 flex flex-col gap-3" onSubmit={handleDelete}>
            <label
              htmlFor="account-delete-email"
              className="flex flex-col gap-1 text-xs text-slate-400"
            >
              Type your email to confirm
              <input
                id="account-delete-email"
                type="email"
                autoComplete="email"
                value={confirmEmail}
                onChange={event => setConfirmEmail(event.target.value)}
                data-testid="account-delete-email"
                className={inputClass}
              />
            </label>
            <label
              htmlFor="account-delete-check"
              className="flex items-start gap-2 text-xs text-slate-300"
            >
              <input
                id="account-delete-check"
                type="checkbox"
                checked={confirmChecked}
                onChange={event => setConfirmChecked(event.target.checked)}
                data-testid="account-delete-check"
                className="mt-0.5 h-4 w-4 accent-red-500"
              />
              I understand this permanently deletes my account and learning data.
            </label>
            <AuthErrorNotice error={deleteError} testId="account-delete-error" />
            <button
              type="submit"
              disabled={!deleteArmed || deleteBusy}
              data-testid="account-delete-submit"
              className={dangerButtonClass}
            >
              {deleteBusy ? 'Deleting…' : 'Delete my account'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
