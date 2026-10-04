'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/admin-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import {
  deactivateUser,
  deleteUserAccount,
  restoreUser,
  setUserRole,
  useAdminUser,
} from '@/hooks/useAdmin';

function actionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Action refused: disappearing safeguard hold (see message).';
    return error.message || `Request failed (${error.status ?? 'unknown'}).`;
  }
  return 'Request failed.';
}

export default function AdminUserDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useAdminUser(id);
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => {
    setRole('');
    void queryClient.invalidateQueries({ queryKey: ['admin', 'user'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    void query.refetch();
  };

  async function run(label: string, fn: () => Promise<unknown>, done?: string) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await fn();
      refresh();
      if (done) setNotice(done);
    } catch (e) {
      setError(e instanceof ApiError && e.message ? e.message : actionError(e));
    } finally {
      setBusy(null);
    }
  }

  const detail = query.data ?? null;

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/users"
            className="w-fit rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            ← Back to users
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight" data-testid="admin-user-title">
            User account
          </h1>
        </div>

        {query.isLoading ? (
          <div className="flex flex-col gap-2" data-testid="admin-user-loading">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : query.isError || !detail ? (
          <div className="flex flex-col gap-2">
            <Alert variant="destructive" data-testid="admin-user-error">
              <AlertDescription>Failed to load user.</AlertDescription>
            </Alert>
            <Button
              variant="outline"
              type="button"
              onClick={() => query.refetch()}
              data-testid="admin-user-retry"
              className="w-fit"
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            <Card>
              <CardHeader className="border-b border-slate-800 bg-slate-900/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-100" data-testid="admin-user-email">
                    {detail.user.email ?? '—'}
                  </span>
                  <Badge variant="secondary" className="capitalize" data-testid="admin-user-role">
                    {detail.user.role.toLowerCase()}
                  </Badge>
                  {detail.deactivatedAt ? (
                    <Badge variant="outline" data-testid="admin-user-deactivated">
                      Deactivated
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500" data-testid="admin-user-id">
                  {detail.user.id}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 p-4 text-sm text-slate-400">
                <p data-testid="admin-user-stats">
                  {detail.stats.memberships} cohort memberships · {detail.stats.quizAttempts} quiz
                  attempts · {detail.stats.cohortsCreated} cohorts created
                </p>
                {detail.deactivatedAt ? (
                  <p data-testid="admin-user-deactivated-at">
                    Deactivated at {new Date(detail.deactivatedAt).toLocaleString()}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {error ? (
              <Alert variant="destructive" data-testid="admin-user-action-error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {notice ? (
              <Alert data-testid="admin-user-notice">
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}

            <Card>
              <CardHeader className="border-b border-slate-800 bg-slate-900/40">
                <p className="text-sm font-bold text-slate-100">Role provisioning</p>
                <p className="mt-1 text-xs text-slate-500">
                  Only admins can change roles. The final administrator cannot be removed.
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="admin-user-role-select" className="text-xs text-slate-400">
                    New role
                  </Label>
                  <select
                    id="admin-user-role-select"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    data-testid="admin-user-role-select"
                    aria-label="New role"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100"
                  >
                    <option value="">Select role…</option>
                    <option value="STUDENT">STUDENT</option>
                    <option value="TEACHER">TEACHER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <Button
                  variant="outline"
                  type="button"
                  disabled={!role || busy !== null}
                  onClick={() =>
                    run('role', () => setUserRole(detail.user.id, role), 'Role updated.')
                  }
                  data-testid="admin-user-role-save"
                  className="w-fit"
                >
                  {busy === 'role' ? 'Saving…' : 'Save role'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-slate-800 bg-slate-900/40">
                <p className="text-sm font-bold text-slate-100">Account lifecycle</p>
                <p className="mt-1 text-xs text-slate-500">
                  Deactivation preserves data and blocks sign-in; deletion purges the account.
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 p-4">
                {detail.deactivatedAt ? (
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      run('restore', () => restoreUser(detail.user.id), 'Account restored.')
                    }
                    data-testid="admin-user-restore"
                    className="w-fit"
                  >
                    {busy === 'restore' ? 'Working…' : 'Restore account'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      run(
                        'deactivate',
                        () => deactivateUser(detail.user.id),
                        'Account deactivated.'
                      )
                    }
                    data-testid="admin-user-deactivate"
                    className="w-fit"
                  >
                    {busy === 'deactivate' ? 'Working…' : 'Deactivate account'}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    run('delete', () =>
                      deleteUserAccount(detail.user.id).then(() => router.push('/users'))
                    )
                  }
                  data-testid="admin-user-delete"
                  className="w-fit"
                >
                  {busy === 'delete' ? 'Working…' : 'Delete account'}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminShell>
  );
}
