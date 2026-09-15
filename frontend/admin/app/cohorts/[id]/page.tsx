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
      <div className="flex flex-col gap-4">
        <Link
          href="/cohorts"
          className="w-fit rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-200"
          data-testid="admin-cohort-back"
        >
          ← Back to cohorts
        </Link>

        {query.isLoading ? (
          <Skeleton className="h-20 w-full" data-testid="admin-cohort-detail-loading" />
        ) : query.isError ? (
          <Card>
            <CardContent className="p-6">
              <h1 className="text-xl font-bold" data-testid="admin-cohort-not-found">
                Cohort not found
              </h1>
              <p className="mt-1 text-sm text-slate-500" data-testid="admin-cohort-error">
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
          <Card>
            <CardHeader>
              <CardTitle className="text-xl" data-testid="admin-cohort-name">
                {query.data.name}
              </CardTitle>
              <p className="text-sm text-slate-400" data-testid="admin-cohort-institution">
                {query.data.institutionLabel ?? 'No institution'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" data-testid="admin-cohort-id">
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
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-slate-400">
              <p data-testid="admin-cohort-created">
                Created: {new Date(query.data.createdAt).toLocaleString()}
              </p>
              {query.data.archivedAt ? (
                <p data-testid="admin-cohort-archived-at">
                  Archived: {new Date(query.data.archivedAt).toLocaleString()}
                </p>
              ) : null}
              <Alert>
                <AlertDescription>
                  Admin view is read-only. Member management remains via teacher cohort dashboard.
                  Backend remains authoritative on all writes.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AdminShell>
  );
}
