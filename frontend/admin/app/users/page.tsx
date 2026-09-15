'use client';

import { useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { useAdminUsers } from '@/hooks/useAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function UsersPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;

  const query = useAdminUsers({ search: search || undefined, role, page, limit });

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-300/80">
            Directory
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight" data-testid="admin-users-title">
            Users
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Browse operational user records — safe fields only, no secrets.
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-900/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="admin-users-search" className="text-xs font-medium text-slate-400">
                  Search
                </Label>
                <Input
                  id="admin-users-search"
                  placeholder="Search by email or name…"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  data-testid="admin-users-search"
                  aria-label="Search users"
                  className="max-w-sm bg-slate-950/40"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-users-role" className="text-xs font-medium text-slate-400">
                  Role
                </Label>
                <select
                  id="admin-users-role"
                  value={role}
                  onChange={e => {
                    setRole(e.target.value);
                    setPage(1);
                  }}
                  data-testid="admin-users-role-filter"
                  aria-label="Filter by role"
                  className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-medium text-slate-100 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="ALL">All roles</option>
                  <option value="STUDENT">STUDENT</option>
                  <option value="TEACHER">TEACHER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {query.isLoading ? (
              <div className="flex flex-col gap-2 p-4" data-testid="admin-users-loading">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : query.isError ? (
              <div className="flex flex-col gap-2 p-4">
                <Alert variant="destructive" data-testid="admin-users-error">
                  <AlertDescription>
                    Failed to load users.{' '}
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
                  data-testid="admin-users-retry"
                  className="w-fit"
                >
                  Retry
                </Button>
              </div>
            ) : !query.data || query.data.items.length === 0 ? (
              <div className="px-6 py-12 text-center" data-testid="admin-users-empty">
                <p className="text-sm font-medium text-slate-200">No users found</p>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
                  Try adjusting search or role filter — results are server-filtered and paginated.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="admin-users-table">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/40 text-left text-xs uppercase tracking-widest text-slate-500">
                        <th className="px-4 py-3 font-semibold">User</th>
                        <th className="px-3 py-3 font-semibold">Role</th>
                        <th className="px-3 py-3 font-semibold">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {query.data.items.map(u => (
                        <tr
                          key={u.id}
                          className="transition-colors hover:bg-slate-900/30"
                          data-testid="admin-user-row"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/50 text-xs font-bold text-slate-300">
                                {(
                                  u.email?.trim().charAt(0) ||
                                  u.name?.trim().charAt(0) ||
                                  '?'
                                ).toUpperCase()}
                              </div>
                              <div className="flex min-w-0 flex-col">
                                <span
                                  className="truncate font-medium text-slate-100"
                                  data-testid="admin-user-email"
                                >
                                  {u.email ?? '—'}
                                </span>
                                <span
                                  className="truncate text-xs text-slate-500"
                                  data-testid="admin-user-name"
                                >
                                  {u.name ?? '—'} ·{' '}
                                  <span className="font-mono text-[11px]">{u.id.slice(0, 8)}</span>
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              variant="secondary"
                              className="capitalize"
                              data-testid="admin-user-role"
                            >
                              {u.role.toLowerCase()}
                            </Badge>
                          </td>
                          <td
                            className="px-3 py-3 text-xs tabular-nums text-slate-500"
                            data-testid="admin-user-created"
                          >
                            {new Date(u.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-900/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    className="text-xs tabular-nums text-slate-500"
                    data-testid="admin-users-pagination-info"
                  >
                    Page {query.data.page} · {query.data.total} total · {query.data.limit} per page
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      data-testid="admin-users-prev"
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={query.data.items.length < limit}
                      onClick={() => setPage(p => p + 1)}
                      data-testid="admin-users-next"
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
