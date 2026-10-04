'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuditLogs } from '@/hooks/useAdmin';

export default function AuditLogsPage(): JSX.Element {
  const [action, setAction] = useState('');
  const [actorId, setActorId] = useState('');
  const [targetType, setTargetType] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const query = useAuditLogs({
    action: action || undefined,
    actorId: actorId || undefined,
    targetType: targetType || undefined,
    page,
    limit,
  });

  const resetPage = () => setPage(1);

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-300/80">
            Security
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight" data-testid="admin-audit-title">
            Audit logs
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Privileged actions only — never authentication material.
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-800 bg-slate-900/40">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-audit-action" className="text-xs text-slate-400">
                  Action
                </Label>
                <Input
                  id="admin-audit-action"
                  placeholder="e.g. user.role.changed"
                  value={action}
                  onChange={e => {
                    setAction(e.target.value);
                    resetPage();
                  }}
                  data-testid="admin-audit-action"
                  aria-label="Filter by action"
                  className="bg-slate-950/40"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-audit-actor" className="text-xs text-slate-400">
                  Actor ID
                </Label>
                <Input
                  id="admin-audit-actor"
                  placeholder="Actor user ID"
                  value={actorId}
                  onChange={e => {
                    setActorId(e.target.value);
                    resetPage();
                  }}
                  data-testid="admin-audit-actor"
                  aria-label="Filter by actor"
                  className="bg-slate-950/40"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-audit-target" className="text-xs text-slate-400">
                  Target type
                </Label>
                <Input
                  id="admin-audit-target"
                  placeholder="e.g. user, quiz"
                  value={targetType}
                  onChange={e => {
                    setTargetType(e.target.value);
                    resetPage();
                  }}
                  data-testid="admin-audit-target"
                  aria-label="Filter by target type"
                  className="bg-slate-950/40"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {query.isLoading ? (
              <div className="flex flex-col gap-2 p-4" data-testid="admin-audit-loading">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : query.isError ? (
              <div className="flex flex-col gap-2 p-4">
                <Alert variant="destructive" data-testid="admin-audit-error">
                  <AlertDescription>Failed to load audit logs.</AlertDescription>
                </Alert>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => query.refetch()}
                  data-testid="admin-audit-retry"
                  className="w-fit"
                >
                  Retry
                </Button>
              </div>
            ) : !query.data || query.data.items.length === 0 ? (
              <div className="px-6 py-12 text-center" data-testid="admin-audit-empty">
                <p className="text-sm font-medium text-slate-200">No audit entries</p>
              </div>
            ) : (
              <>
                <ul className="flex flex-col gap-2 p-4" data-testid="admin-audit-list">
                  {query.data.items.map(entry => (
                    <li
                      key={entry.id}
                      data-testid="admin-audit-row"
                      className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {entry.action}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {entry.targetType}
                          {entry.targetId ? ` ${entry.targetId.slice(0, 8)}` : ''}
                        </span>
                        <span className="ml-auto text-xs tabular-nums text-slate-500">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-slate-500">
                        actor {entry.actorId.slice(0, 8)} ({entry.actorRole ?? '—'})
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/20 px-4 py-3">
                  <p className="text-xs tabular-nums text-slate-500" data-testid="admin-audit-info">
                    Page {query.data.page} · {query.data.total} total
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      data-testid="admin-audit-prev"
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={query.data.items.length < limit}
                      onClick={() => setPage(p => p + 1)}
                      data-testid="admin-audit-next"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-slate-600">
          <Link href="/users" className="text-teal-300 hover:text-teal-200">
            ← Back to users
          </Link>
        </p>
      </div>
    </AdminShell>
  );
}
