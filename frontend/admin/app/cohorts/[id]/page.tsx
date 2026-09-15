'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { useAdminCohort } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function CohortDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const query = useAdminCohort(id);

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <Link
          href="/cohorts"
          className="inline-flex w-fit items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          data-testid="admin-cohort-back"
        >
          ← Back to cohorts
        </Link>

        {query.isLoading ? (
          <Skeleton className="h-32 w-full" data-testid="admin-cohort-detail-loading" />
        ) : query.isError ? (
          <Card className="border-red-900/30">
            <CardContent className="p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-red-300/80">
                Not found
              </p>
              <h1
                className="mt-1 text-xl font-bold tracking-tight"
                data-testid="admin-cohort-not-found"
              >
                Cohort not found
              </h1>
              <p className="mt-1 text-sm leading-6 text-slate-400" data-testid="admin-cohort-error">
                {(query.error as Error)?.message ?? 'Failed to load cohort.'}{' '}
                {(query.error as unknown as { requestId?: string })?.requestId ? (
                  <span className="font-mono text-xs">
                    Ref: {(query.error as unknown as { requestId?: string }).requestId}
                  </span>
                ) : null}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => query.refetch()}
                  data-testid="admin-cohort-detail-retry"
                >
                  Retry
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/cohorts">Back to cohorts</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : query.data ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 p-5 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-teal-300/80">
                    Cohort detail
                  </p>
                  <h1
                    className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl"
                    data-testid="admin-cohort-name"
                  >
                    {query.data.name}
                  </h1>
                  <p className="mt-1 text-sm text-slate-400" data-testid="admin-cohort-institution">
                    {query.data.institutionLabel ?? 'No institution'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    data-testid="admin-cohort-id"
                    className="font-mono text-xs"
                  >
                    {query.data.id.slice(0, 8)}
                  </Badge>
                  {query.data.archivedAt ? (
                    <Badge variant="secondary" data-testid="admin-cohort-archived">
                      Archived
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-900/50 text-emerald-300">
                      Active
                    </Badge>
                  )}
                  <Badge variant="secondary" data-testid="admin-cohort-member-count">
                    {query.data.memberCount} members
                  </Badge>
                </div>
              </div>
              <dl className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <dt className="font-medium uppercase tracking-wide">Created</dt>
                  <dd data-testid="admin-cohort-created" className="tabular-nums text-slate-300">
                    {new Date(query.data.createdAt).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </dd>
                </div>
                {query.data.archivedAt ? (
                  <div className="flex items-center gap-2">
                    <dt className="font-medium uppercase tracking-wide">Archived</dt>
                    <dd
                      data-testid="admin-cohort-archived-at"
                      className="tabular-nums text-slate-300"
                    >
                      {new Date(query.data.archivedAt).toLocaleString()}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Operational note
                </p>
                <CardTitle className="text-sm font-bold tracking-tight text-slate-100">
                  Read-only view
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert className="border-slate-800 bg-slate-900/40">
                  <AlertDescription className="text-sm leading-6 text-slate-400">
                    Admin view is read-only. Member management remains via teacher cohort dashboard.
                    Backend remains authoritative on all writes.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
