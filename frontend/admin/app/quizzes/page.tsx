'use client';

import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminQuizzes } from '@/hooks/useAdmin';

export default function AdminQuizzesPage(): JSX.Element {
  const query = useAdminQuizzes();

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-300/80">
            Assessments
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight" data-testid="admin-quizzes-title">
            Quizzes
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            System-wide bank visibility, all statuses. Lifecycle actions are audited.
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {query.isLoading ? (
              <div className="flex flex-col gap-2 p-4" data-testid="admin-quizzes-loading">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : query.isError ? (
              <div className="flex flex-col gap-2 p-4">
                <Alert variant="destructive" data-testid="admin-quizzes-error">
                  <AlertDescription>Failed to load quizzes.</AlertDescription>
                </Alert>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => query.refetch()}
                  data-testid="admin-quizzes-retry"
                  className="w-fit"
                >
                  Retry
                </Button>
              </div>
            ) : !query.data || query.data.length === 0 ? (
              <div className="px-6 py-12 text-center" data-testid="admin-quizzes-empty">
                <p className="text-sm font-medium text-slate-200">No quizzes yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                  Teachers create quizzes in the main application; they appear here for oversight.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/50" data-testid="admin-quizzes-list">
                {query.data.map(q => (
                  <li
                    key={q.id}
                    data-testid="admin-quiz-row"
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-medium text-slate-100"
                        data-testid="admin-quiz-title"
                      >
                        {q.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{q.questionCount} questions</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={q.status === 'PUBLISHED' ? 'teal' : 'secondary'}
                        data-testid="admin-quiz-status"
                      >
                        {q.status}
                      </Badge>
                      <Link
                        href={`/quizzes/${q.id}`}
                        data-testid="admin-quiz-manage"
                        aria-label={`Manage ${q.title}`}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-teal-300 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                      >
                        Manage →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
