import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyAuthError, type FriendlyAuthError } from '@/components/auth/friendlyAuthError';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuizAttempts } from '@/hooks/useProgress';
import { changePassword, deleteAccount, exportAccountData } from '@/lib/auth';

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
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">Home</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/human">Anatomy</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/learn">Progress</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/cohorts">Cohorts</Link>
            </Button>
          </nav>
        </div>

        {sessionExpired ? (
          <Alert variant="warning" data-testid="account-expired-notice">
            <AlertDescription>Your session expired. Please sign in again.</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <dl className="flex flex-col gap-2 text-sm">
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
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={handleLogout} data-testid="account-logout">
                Sign out
              </Button>
              <Button variant="outline" asChild>
                <Link to="/human">Open 3D viewer</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
              Change password
            </CardTitle>
            <CardDescription>Changing your password signs you out on all devices.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3" onSubmit={handlePasswordChange}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="account-current">Current password</Label>
                <Input
                  id="account-current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}
                  data-testid="account-current-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="account-new">
                  New password <span className="text-slate-500">(8+ characters)</span>
                </Label>
                <Input
                  id="account-new"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={event => setNewPassword(event.target.value)}
                  data-testid="account-new-password"
                />
              </div>
              <AuthErrorNotice error={passwordError} testId="account-password-error" />
              <Button
                type="submit"
                variant="outline"
                disabled={passwordBusy}
                data-testid="account-password-submit"
              >
                {passwordBusy ? 'Changing…' : 'Change password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
              Data export
            </CardTitle>
            <CardDescription>
              Download your cohorts, quiz attempts, and progress snapshot as JSON.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exportBusy}
              data-testid="account-export"
            >
              {exportBusy ? 'Preparing…' : 'Download my data'}
            </Button>
            {exportDone ? (
              <Alert variant="success" data-testid="account-export-done">
                <AlertDescription>Export downloaded.</AlertDescription>
              </Alert>
            ) : null}
            <AuthErrorNotice error={exportError} testId="account-export-error" />
          </CardContent>
        </Card>

        <Card className="border-red-900/60 bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-widest text-red-300">
              Delete account
            </CardTitle>
            <CardDescription className="text-red-200/80">
              Permanently deletes your account, progress, and attempts. Cohorts you created survive
              without you. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3" onSubmit={handleDelete}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="account-delete-email">Type your email to confirm</Label>
                <Input
                  id="account-delete-email"
                  type="email"
                  autoComplete="email"
                  value={confirmEmail}
                  onChange={event => setConfirmEmail(event.target.value)}
                  data-testid="account-delete-email"
                />
              </div>
              <div className="flex items-start gap-2">
                <input
                  id="account-delete-check"
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={event => setConfirmChecked(event.target.checked)}
                  data-testid="account-delete-check"
                  className="mt-0.5 h-4 w-4 accent-red-500"
                />
                <Label
                  htmlFor="account-delete-check"
                  className="text-xs font-normal text-slate-300"
                >
                  I understand this permanently deletes my account and learning data.
                </Label>
              </div>
              <AuthErrorNotice error={deleteError} testId="account-delete-error" />
              <Button
                type="submit"
                variant="destructive"
                disabled={!deleteArmed || deleteBusy}
                data-testid="account-delete-submit"
              >
                {deleteBusy ? 'Deleting…' : 'Delete my account'}
              </Button>
              {deleteArmed ? (
                <Badge variant="destructive" className="w-fit">
                  Armed — this will delete your account
                </Badge>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
