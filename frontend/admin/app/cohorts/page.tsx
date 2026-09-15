'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { useAdminCohorts } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function CohortsPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const query = useAdminCohorts({ search: search || undefined, archived, page, limit });

  return (
    <AdminShell>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="admin-cohorts-title">
            Cohorts
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Browse all cohorts — operational view, admin-only.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-cohorts-search" className="text-xs text-slate-400">
                Search
              </Label>
              <Input
                id="admin-cohorts-search"
                placeholder="Search by name or institution…"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                data-testid="admin-cohorts-search"
                aria-label="Search cohorts"
                className="w-64"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-cohorts-archived" className="text-xs text-slate-400">
                Status
              </Label>
              <select
                id="admin-cohorts-archived"
                value={archived}
                onChange={e => {
                  setArchived(e.target.value);
                  setPage(1);
                }}
                data-testid="admin-cohorts-archived-filter"
                aria-label="Filter by archived status"
                className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm"
              >
                <option value="all">All</option>
                <option value="false">Active</option>
                <option value="true">Archived</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {query.isLoading ? (
              <div className="flex flex-col gap-2" data-testid="admin-cohorts-loading">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : query.isError ? (
              <div className="flex flex-col gap-2">
                <Alert variant="destructive" data-testid="admin-cohorts-error">
                  <AlertDescription>
                    Failed to load cohorts.{' '}
                    {(query.error as unknown as { requestId?: string })?.requestId ? (
                      <span className="font-mono text-xs">
                        Ref: {(query.error as unknown as { requestId?: string }).requestId}
                      </span>
                    ) : null}
                  </AlertDescription>
                </Alert>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => query.refetch()}
                  data-testid="admin-cohorts-retry"
                  className="w-fit"
                >
                  Retry
                </Button>
              </div>
            ) : !query.data || query.data.items.length === 0 ? (
              <p
                className="py-8 text-center text-sm text-slate-500"
                data-testid="admin-cohorts-empty"
              >
                No cohorts found.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="admin-cohorts-table">
                    <thead>
                      <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-widest text-slate-500">
                        <th className="px-3 py-2">Cohort</th>
                        <th className="px-3 py-2">Members</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.items.map(c => (
                        <tr
                          key={c.id}
                          className="border-b border-slate-800/50"
                          data-testid="admin-cohort-row"
                        >
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span
                                className="font-medium text-slate-100"
                                data-testid="admin-cohort-name"
                              >
                                {c.name}
                              </span>
                              <span className="text-xs text-slate-500">
                                {c.institutionLabel ?? '—'}
                              </span>
                            </div>
                          </td>
                          <td
                            className="px-3 py-2 text-slate-300"
                            data-testid="admin-cohort-members"
                          >
                            {c.memberCount}
                          </td>
                          <td className="px-3 py-2">
                            {c.archivedAt ? (
                              <Badge variant="secondary" data-testid="admin-cohort-archived">
                                Archived
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-emerald-900/50 text-emerald-300"
                              >
                                Active
                              </Badge>
                            )}
                          </td>
                          <td
                            className="px-3 py-2 text-xs text-slate-500"
                            data-testid="admin-cohort-created"
                          >
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2">
                            <Link
                              href={`/cohorts/${c.id}`}
                              className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                              data-testid="admin-cohort-view"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-slate-500" data-testid="admin-cohorts-pagination-info">
                    Page {query.data.page} · {query.data.total} total
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      data-testid="admin-cohorts-prev"
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={query.data.items.length < limit}
                      onClick={() => setPage(p => p + 1)}
                      data-testid="admin-cohorts-next"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
