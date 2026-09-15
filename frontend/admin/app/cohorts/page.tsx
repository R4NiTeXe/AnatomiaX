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
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-300/80">
            Operations
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight" data-testid="admin-cohorts-title">
            Cohorts
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Browse all cohorts — operational view, admin-only.
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-900/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-1 flex-col gap-2">
                <Label
                  htmlFor="admin-cohorts-search"
                  className="text-xs font-medium text-slate-400"
                >
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
                  className="max-w-sm bg-slate-950/40"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="admin-cohorts-archived"
                  className="text-xs font-medium text-slate-400"
                >
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
                  className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-medium text-slate-100 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="all">All</option>
                  <option value="false">Active</option>
                  <option value="true">Archived</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {query.isLoading ? (
              <div className="flex flex-col gap-2 p-4" data-testid="admin-cohorts-loading">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : query.isError ? (
              <div className="flex flex-col gap-2 p-4">
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
              <div className="px-6 py-12 text-center" data-testid="admin-cohorts-empty">
                <p className="text-sm font-medium text-slate-200">No cohorts found</p>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
                  Try adjusting search or status filter — operational cohorts appear here.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="admin-cohorts-table">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/40 text-left text-xs uppercase tracking-widest text-slate-500">
                        <th className="px-4 py-3 font-semibold">Cohort</th>
                        <th className="px-3 py-3 font-semibold">Members</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                        <th className="px-3 py-3 font-semibold">Created</th>
                        <th className="px-3 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {query.data.items.map(c => (
                        <tr
                          key={c.id}
                          className="transition-colors hover:bg-slate-900/30"
                          data-testid="admin-cohort-row"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/50 text-xs font-bold text-slate-300">
                                {(c.name.trim().charAt(0) || '?').toUpperCase()}
                              </div>
                              <div className="flex min-w-0 flex-col">
                                <span
                                  className="truncate font-medium text-slate-100"
                                  data-testid="admin-cohort-name"
                                >
                                  {c.name}
                                </span>
                                <span className="truncate text-xs text-slate-500">
                                  {c.institutionLabel ?? '—'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td
                            className="px-3 py-3 font-medium tabular-nums text-slate-300"
                            data-testid="admin-cohort-members"
                          >
                            {c.memberCount}
                          </td>
                          <td className="px-3 py-3">
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
                            className="px-3 py-3 text-xs tabular-nums text-slate-500"
                            data-testid="admin-cohort-created"
                          >
                            {new Date(c.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-3 py-3">
                            <Link
                              href={`/cohorts/${c.id}`}
                              className="inline-flex rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
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
                <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-900/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    className="text-xs tabular-nums text-slate-500"
                    data-testid="admin-cohorts-pagination-info"
                  >
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
