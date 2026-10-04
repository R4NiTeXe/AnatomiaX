import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, type DashboardRecentAttempt } from './dashboardFormat';

interface RecentActivityProps {
  recentAttempts: DashboardRecentAttempt[];
  isProgressLoading: boolean;
}

export default function RecentActivity({
  recentAttempts,
  isProgressLoading,
}: RecentActivityProps): JSX.Element {
  return (
    <Reveal delay={0.08}>
      <section aria-labelledby="activity-heading">
        <Card>
          <CardHeader>
            <CardTitle
              id="activity-heading"
              className="text-xs font-semibold uppercase tracking-widest text-slate-400"
            >
              Recent activity
            </CardTitle>
            <CardDescription>
              Latest 5 quiz completions across members. Studied structures link to 3D.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isProgressLoading ? (
              <div className="flex flex-col gap-2" data-testid="dashboard-activity-loading">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : recentAttempts.length === 0 ? (
              <div
                className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-6 py-10 text-center"
                data-testid="dashboard-activity-empty"
              >
                <h3 className="text-sm font-semibold text-slate-300">No recent quizzes</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
                  Quiz completions will appear here once members start learning. Studied structures
                  are shown in member cards above.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="dashboard-activity-list">
                {recentAttempts.map(a => {
                  const pct = Math.round((a.score / Math.max(1, a.total)) * 100);
                  return (
                    <li
                      key={a.id}
                      data-testid="dashboard-activity-item"
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 transition-colors hover:border-slate-700 sm:px-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 truncate text-sm font-medium text-slate-100">
                          <span className="truncate">{a.name ?? 'Member'}</span>
                          <Badge
                            variant={pct === 100 ? 'teal' : pct >= 60 ? 'secondary' : 'outline'}
                          >
                            {a.score}/{a.total} · {pct}%
                          </Badge>
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{formatDateTime(a.completedAt)}</span>
                          <span className="hidden sm:inline">·</span>
                          <Badge variant="outline" className="capitalize">
                            {a.bodyModel}
                          </Badge>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="hidden text-xs text-slate-500 sm:inline">Quiz</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </Reveal>
  );
}
