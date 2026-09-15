'use client';

import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { useAdminOverview } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function OverviewPage(): JSX.Element {
  const overview = useAdminOverview();

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="admin-overview-title">
            Operations overview
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Live operational data — no fake statistics. All counts are from the database.
          </p>
        </div>

        {overview.isLoading ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            data-testid="admin-overview-loading"
          >
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : overview.isError ? (
          <div className="flex flex-col gap-2">
            <Alert variant="destructive" data-testid="admin-overview-error">
              <AlertDescription>
                Failed to load overview.{' '}
                {overview.error instanceof Error ? overview.error.message : 'Please retry.'}{' '}
                {(overview.error as unknown as { requestId?: string })?.requestId ? (
                  <span className="font-mono text-xs">
                    Ref: {(overview.error as unknown as { requestId?: string }).requestId}
                  </span>
                ) : null}
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              type="button"
              onClick={() => overview.refetch()}
              data-testid="admin-overview-retry"
              className="w-fit"
            >
              Retry
            </Button>
          </div>
        ) : overview.data ? (
          <>
            <section
              aria-labelledby="kpi-heading"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              data-testid="admin-kpis"
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
                    Total users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold" data-testid="admin-kpi-users">
                    {overview.data.totalUsers}
                  </p>
                  <p className="text-xs text-slate-500">live accounts</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
                    Roles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-200" data-testid="admin-kpi-roles">
                    {overview.data.byRole.STUDENT} students · {overview.data.byRole.TEACHER}{' '}
                    teachers · {overview.data.byRole.ADMIN} admins
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
                    Cohorts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold" data-testid="admin-kpi-cohorts">
                    {overview.data.cohortCount}
                  </p>
                  <p className="text-xs text-slate-500">
                    {overview.data.archivedCohortCount} archived ·{' '}
                    {overview.data.cohortCount - overview.data.archivedCohortCount} active
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
                    Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p
                    className="text-sm font-medium text-emerald-300"
                    data-testid="admin-kpi-health"
                  >
                    API reachable
                  </p>
                  <p className="text-xs text-slate-500">via /api/v1/admin/overview</p>
                </CardContent>
              </Card>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Recent users</CardTitle>
                  <p className="text-xs text-slate-500">Last 5 registrations</p>
                </CardHeader>
                <CardContent>
                  {overview.data.recentUsers.length === 0 ? (
                    <p className="text-sm text-slate-500" data-testid="admin-recent-users-empty">
                      No users yet.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2" data-testid="admin-recent-users">
                      {overview.data.recentUsers.map(u => (
                        <li
                          key={u.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
                          data-testid="admin-recent-user"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-slate-100">
                              {u.email ?? u.name ?? u.id}
                            </p>
                            <p className="text-xs text-slate-500">
                              {u.role} · {formatDate(u.createdAt)}
                            </p>
                          </div>
                          <Badge variant="secondary" className="capitalize">
                            {u.role.toLowerCase()}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Recent cohorts</CardTitle>
                  <p className="text-xs text-slate-500">Last 5 created</p>
                </CardHeader>
                <CardContent>
                  {overview.data.recentCohorts.length === 0 ? (
                    <p className="text-sm text-slate-500" data-testid="admin-recent-cohorts-empty">
                      No cohorts yet.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2" data-testid="admin-recent-cohorts">
                      {overview.data.recentCohorts.map(c => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
                          data-testid="admin-recent-cohort"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-slate-100">{c.name}</p>
                            <p className="text-xs text-slate-500">
                              {c.memberCount} members · {formatDate(c.createdAt)}{' '}
                              {c.archivedAt ? '· Archived' : ''}
                            </p>
                          </div>
                          <Link
                            href={`/cohorts/${c.id}`}
                            className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                            data-testid="admin-recent-cohort-link"
                          >
                            View
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}
