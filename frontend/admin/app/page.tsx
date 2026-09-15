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
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-300/80">
            Operations
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight" data-testid="admin-overview-title">
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
              <Card className="relative overflow-hidden border-teal-900/30 bg-gradient-to-br from-teal-950/20 via-slate-900/60 to-slate-900/40 shadow-[0_0_20px_-8px_rgba(20,184,166,0.3)]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-teal-500/10 blur-2xl"
                />
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-widest text-teal-300/80">
                    Total users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold tracking-tight" data-testid="admin-kpi-users">
                    {overview.data.totalUsers}
                  </p>
                  <p className="text-xs text-slate-500">live accounts</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Roles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p
                    className="text-sm font-medium leading-6 text-slate-200"
                    data-testid="admin-kpi-roles"
                  >
                    <span className="font-bold text-slate-100">{overview.data.byRole.STUDENT}</span>{' '}
                    students ·{' '}
                    <span className="font-bold text-slate-100">{overview.data.byRole.TEACHER}</span>{' '}
                    teachers ·{' '}
                    <span className="font-bold text-slate-100">{overview.data.byRole.ADMIN}</span>{' '}
                    admins
                  </p>
                  <p className="mt-1 text-xs text-slate-500">distribution</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Cohorts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold tracking-tight" data-testid="admin-kpi-cohorts">
                    {overview.data.cohortCount}
                  </p>
                  <p className="text-xs text-slate-500">
                    {overview.data.archivedCohortCount} archived ·{' '}
                    {overview.data.cohortCount - overview.data.archivedCohortCount} active
                  </p>
                </CardContent>
              </Card>
              <Card className="border-slate-700/50 bg-slate-900/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                    <p
                      className="text-sm font-semibold text-emerald-300"
                      data-testid="admin-kpi-health"
                    >
                      API reachable
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">via /api/v1/admin/overview</p>
                </CardContent>
              </Card>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="flex flex-col">
                <CardHeader className="pb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Recent users
                  </p>
                  <CardTitle className="text-sm font-bold tracking-tight text-slate-100">
                    Last 5 registrations
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  {overview.data.recentUsers.length === 0 ? (
                    <div
                      className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-6 py-10 text-center"
                      data-testid="admin-recent-users-empty"
                    >
                      <p className="text-sm font-medium text-slate-200">No users yet</p>
                      <p className="mt-1 text-sm text-slate-500">
                        New registrations will appear here — most recent first.
                      </p>
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-2" data-testid="admin-recent-users">
                      {overview.data.recentUsers.map(u => (
                        <li
                          key={u.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5 transition-colors hover:border-slate-700 hover:bg-slate-900/40"
                          data-testid="admin-recent-user"
                        >
                          <div className="min-w-0 flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/50 text-xs font-bold text-slate-300">
                              {(
                                u.email?.trim().charAt(0) ||
                                u.name?.trim().charAt(0) ||
                                '?'
                              ).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-100">
                                {u.email ?? u.name ?? u.id}
                              </p>
                              <p className="text-xs text-slate-500">
                                {u.role} · {formatDate(u.createdAt)}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className="hidden shrink-0 capitalize sm:inline-flex"
                          >
                            {u.role.toLowerCase()}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="flex flex-col">
                <CardHeader className="pb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Recent cohorts
                  </p>
                  <CardTitle className="text-sm font-bold tracking-tight text-slate-100">
                    Last 5 created
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  {overview.data.recentCohorts.length === 0 ? (
                    <div
                      className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-6 py-10 text-center"
                      data-testid="admin-recent-cohorts-empty"
                    >
                      <p className="text-sm font-medium text-slate-200">No cohorts yet</p>
                      <p className="mt-1 text-sm text-slate-500">
                        New cohorts appear here — most recent first.
                      </p>
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-2" data-testid="admin-recent-cohorts">
                      {overview.data.recentCohorts.map(c => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5 transition-colors hover:border-slate-700 hover:bg-slate-900/40"
                          data-testid="admin-recent-cohort"
                        >
                          <div className="min-w-0 flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/50 text-xs font-bold text-slate-300">
                              {(c.name.trim().charAt(0) || '?').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-100">
                                {c.name}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {c.memberCount} members · {formatDate(c.createdAt)}{' '}
                                {c.archivedAt ? '· Archived' : ''}
                              </p>
                            </div>
                          </div>
                          <Link
                            href={`/cohorts/${c.id}`}
                            className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
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
