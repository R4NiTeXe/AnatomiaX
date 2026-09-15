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
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="admin-users-title">
            Users
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Browse operational user records — safe fields only, no secrets.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-users-search" className="text-xs text-slate-400">
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
                className="w-64"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-users-role" className="text-xs text-slate-400">
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
                className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm"
              >
                <option value="ALL">All roles</option>
                <option value="STUDENT">STUDENT</option>
                <option value="TEACHER">TEACHER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {query.isLoading ? (
              <div className="flex flex-col gap-2" data-testid="admin-users-loading">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : query.isError ? (
              <div className="flex flex-col gap-2">
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
              <p
                className="py-8 text-center text-sm text-slate-500"
                data-testid="admin-users-empty"
              >
                No users found.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="admin-users-table">
                    <thead>
                      <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-widest text-slate-500">
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.items.map(u => (
                        <tr
                          key={u.id}
                          className="border-b border-slate-800/50"
                          data-testid="admin-user-row"
                        >
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span
                                className="font-medium text-slate-100"
                                data-testid="admin-user-email"
                              >
                                {u.email ?? '—'}
                              </span>
                              <span
                                className="text-xs text-slate-500"
                                data-testid="admin-user-name"
                              >
                                {u.name ?? '—'} ·{' '}
                                <span className="font-mono text-[11px]">{u.id.slice(0, 8)}</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="secondary"
                              className="capitalize"
                              data-testid="admin-user-role"
                            >
                              {u.role.toLowerCase()}
                            </Badge>
                          </td>
                          <td
                            className="px-3 py-2 text-xs text-slate-500"
                            data-testid="admin-user-created"
                          >
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-slate-500" data-testid="admin-users-pagination-info">
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
