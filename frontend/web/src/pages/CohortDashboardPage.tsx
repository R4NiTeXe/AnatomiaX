import { Link, useParams } from 'react-router-dom';
import SiteNav from '@/components/SiteNav';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyCohortError } from '@/components/auth/friendlyAuthError';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { canManageCohort, useCohort, useCohortProgress } from '@/hooks/useCohorts';
import { buildHumanFocusUrl } from '@/lib/humanLink';

function formatDate(value: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function bestScoreText(attempts: { score: number; total: number }[]): string {
  if (attempts.length === 0) return '—';
  let best = attempts[0];
  let bestPct = best.score / Math.max(1, best.total);
  for (const a of attempts.slice(1)) {
    const pct = a.score / Math.max(1, a.total);
    if (pct > bestPct || (pct === bestPct && a.score > best.score)) {
      best = a;
      bestPct = pct;
    }
  }
  return `${best.score} / ${best.total}`;
}

export default function CohortDashboardPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const cohortQuery = useCohort(id);
  const progressQuery = useCohortProgress(id);

  const cohort = cohortQuery.data ?? null;
  const isArchived = !!cohort?.archivedAt;
  const isStudent = user?.role === 'STUDENT';
  const canManage = cohort ? canManageCohort(cohort.myRole, user?.role) : false;

  // Student denied — frontend UX only, backend also 403s on progress
  if (!isStudent && cohortQuery.isError) {
    // fall through to generic error below
  }

  if (cohortQuery.isLoading && !cohort) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <SiteNav />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6"
        >
          <Skeleton className="h-20 w-full" data-testid="dashboard-loading" />
        </main>
      </div>
    );
  }

  if (cohortQuery.isError || !cohort) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <SiteNav />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6"
        >
          <Link
            to="/cohorts"
            className="w-fit rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            ← Back to My Cohorts
          </Link>
          <Card className="p-6">
            <h1 className="text-xl font-bold tracking-tight" data-testid="dashboard-not-found">
              Cohort not found
            </h1>
            <AuthErrorNotice
              error={cohortQuery.error ? friendlyCohortError(cohortQuery.error) : null}
              testId="dashboard-error"
            />
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                onClick={() => cohortQuery.refetch()}
                data-testid="dashboard-retry"
              >
                Retry
              </Button>
              <Button variant="outline" asChild>
                <Link to="/cohorts">Back to My Cohorts</Link>
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // Student guard — UX only
  if (isStudent) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <SiteNav />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6"
        >
          <Link
            to="/cohorts"
            className="w-fit rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-200"
          >
            ← Back to My Cohorts
          </Link>
          <Alert variant="destructive" data-testid="dashboard-denied">
            <AlertDescription>
              Students cannot access the teacher dashboard. Ask your teacher for cohort progress.
            </AlertDescription>
          </Alert>
          <Card className="p-6">
            <h1 className="text-xl font-bold" data-testid="dashboard-cohort-name">
              {cohort.name}
            </h1>
            <p className="mt-1 text-sm text-slate-400" data-testid="dashboard-institution">
              {cohort.institutionLabel ?? 'No institution'}
            </p>
            <Badge className="mt-2" data-testid="dashboard-role-badge">
              {cohort.myRole ?? 'MEMBER'}
            </Badge>
          </Card>
        </main>
      </div>
    );
  }

  const progress = progressQuery.data ?? null;
  const isProgressLoading = progressQuery.isLoading && !progress;
  const isProgressError = progressQuery.isError;

  // Aggregates — computed client-side from server-authorized member progress
  const totalMembers = progress ? progress.length : null;
  const archivedBadge = isArchived ? (
    <Badge variant="secondary" data-testid="dashboard-archived-badge">
      Archived
    </Badge>
  ) : null;
  let aggregateStudied = 0;
  let aggregateQuizzes = 0;
  let bestOverall = '—';
  let recentAttempts: Array<{
    id: string;
    userId: string;
    name: string | null;
    score: number;
    total: number;
    bodyModel: string;
    completedAt: string;
  }> = [];
  if (progress) {
    aggregateStudied = progress.reduce((sum, m) => sum + (m.studiedKeys?.length ?? 0), 0);
    aggregateQuizzes = progress.reduce((sum, m) => sum + (m.quizAttempts?.length ?? 0), 0);
    const allAttempts = progress.flatMap(m =>
      m.quizAttempts.map(a => ({ ...a, name: m.name, userId: m.userId }))
    );
    allAttempts.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
    recentAttempts = allAttempts.slice(0, 5);
    bestOverall = bestScoreText(allAttempts);
  }

  const showProgress = canManage;
  const progressDenied =
    !canManage &&
    !isProgressLoading &&
    progressQuery.isError &&
    (progressQuery.error as unknown as { status?: number })?.status === 403;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNav />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6"
      >
        <Link
          to={`/cohorts/${cohort.id}`}
          className="w-fit rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          ← Back to cohort
        </Link>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className="text-2xl font-bold tracking-tight sm:text-3xl"
              data-testid="dashboard-cohort-name"
            >
              {cohort.name}
            </h1>
            <Badge data-testid="dashboard-role-badge">{cohort.myRole ?? 'MEMBER'}</Badge>
            {archivedBadge}
          </div>
          <p className="mt-1 text-sm text-slate-400" data-testid="dashboard-institution">
            {cohort.institutionLabel ?? 'No institution'}
          </p>
        </div>

        {isArchived ? (
          <Alert data-testid="dashboard-archived-notice">
            <AlertDescription>
              This cohort is archived and read-only. Progress is frozen from archive time.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="dashboard-summary">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
                Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="dashboard-member-count">
                {totalMembers ?? '—'}
              </p>
              <p className="text-xs text-slate-500">{isArchived ? 'archived' : 'active'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
                Studied
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="dashboard-studied-total">
                {progress ? aggregateStudied : '—'}
              </p>
              <p className="text-xs text-slate-500">structures studied</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
                Quizzes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="dashboard-quizzes-total">
                {progress ? aggregateQuizzes : '—'}
              </p>
              <p className="text-xs text-slate-500">completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
                Best
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="dashboard-best">
                {progress ? bestOverall : '—'}
              </p>
              <p className="text-xs text-slate-500">personal best across members</p>
            </CardContent>
          </Card>
        </div>

        {/* Member progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
              Member progress
            </CardTitle>
            <p className="text-xs text-slate-500">
              Server-authorized; non-owners see 403. Student progress links to 3D where structureKey
              exists.
            </p>
          </CardHeader>
          <CardContent>
            {!showProgress ? (
              <Alert variant="destructive" data-testid="dashboard-progress-denied">
                <AlertDescription>
                  Only the cohort owner (or admin) can view member progress.
                </AlertDescription>
              </Alert>
            ) : isProgressLoading ? (
              <Skeleton className="h-20 w-full" data-testid="dashboard-progress-loading" />
            ) : isProgressError ? (
              <div className="flex flex-col gap-2">
                <AuthErrorNotice
                  error={friendlyCohortError(progressQuery.error)}
                  testId="dashboard-progress-error"
                />
                <Button
                  variant="outline"
                  onClick={() => progressQuery.refetch()}
                  data-testid="dashboard-progress-retry"
                >
                  Retry
                </Button>
              </div>
            ) : !progress || progress.length === 0 ? (
              <p className="text-sm text-slate-500" data-testid="dashboard-progress-empty">
                No members yet.
              </p>
            ) : (
              <div className="flex flex-col gap-4" data-testid="dashboard-progress-list">
                {progress.map(member => {
                  const studiedCount = member.studiedKeys.length;
                  const totalQuizzes = member.quizAttempts.length;
                  const latest = member.quizAttempts[0] ?? null;
                  const best = bestScoreText(member.quizAttempts);
                  const recentKey = member.studiedKeys[0] ?? null;
                  return (
                    <Card
                      key={member.userId}
                      className="p-3 bg-slate-950/60"
                      data-testid="dashboard-member-progress"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p
                            className="text-sm font-medium text-slate-100"
                            data-testid="dashboard-member-name"
                          >
                            {member.name ?? 'Unnamed member'}{' '}
                            <span className="text-xs text-slate-500">({member.role})</span>
                          </p>
                          <p className="text-xs text-slate-500">
                            Joined {formatDate(member.joinedAt)} ·{' '}
                            <span data-testid="dashboard-member-studied">
                              {studiedCount} studied
                            </span>{' '}
                            ·{' '}
                            <span data-testid="dashboard-member-quizzes">
                              {totalQuizzes} quizzes
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={latest && latest.score === latest.total ? 'teal' : 'secondary'}
                            data-testid="dashboard-member-latest"
                          >
                            {latest ? `${latest.score}/${latest.total}` : '—'}
                          </Badge>
                          <Badge variant="outline" data-testid="dashboard-member-best">
                            Best {best}
                          </Badge>
                        </div>
                      </div>
                      {member.studiedKeys.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {member.studiedKeys.slice(0, 3).map(k => (
                            <Button key={k} variant="ghost" size="sm" asChild>
                              <Link to={buildHumanFocusUrl(k)} data-testid="dashboard-member-open">
                                Open {k.split(':').pop()}
                              </Link>
                            </Button>
                          ))}
                        </div>
                      ) : null}
                      {member.quizAttempts.length > 0 ? (
                        <ul
                          className="mt-2 flex flex-col gap-1"
                          data-testid="dashboard-member-attempts"
                        >
                          {member.quizAttempts.slice(0, 3).map(a => (
                            <li
                              key={a.id}
                              data-testid="dashboard-member-attempt"
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="text-slate-300">
                                {a.score}/{a.total} · {a.bodyModel}
                              </span>
                              <span className="text-slate-500">{formatDate(a.completedAt)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {recentKey ? (
                        <Button variant="link" size="sm" asChild className="mt-2 h-auto p-0">
                          <Link
                            to={buildHumanFocusUrl(recentKey)}
                            data-testid="dashboard-member-focus"
                          >
                            Open recent in 3D →
                          </Link>
                        </Button>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            )}
            {progressDenied ? (
              <p className="mt-2 text-xs text-slate-500" data-testid="dashboard-progress-forbidden">
                View requires owner/admin.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isProgressLoading ? (
              <Skeleton className="h-10 w-full" data-testid="dashboard-activity-loading" />
            ) : recentAttempts.length === 0 ? (
              <p className="text-sm text-slate-500" data-testid="dashboard-activity-empty">
                No recent quizzes.
              </p>
            ) : (
              <ul className="flex flex-col gap-1" data-testid="dashboard-activity-list">
                {recentAttempts.map(a => (
                  <li
                    key={a.id}
                    data-testid="dashboard-activity-item"
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-100">
                        {a.name ?? 'Member'} — {a.score}/{a.total}
                      </p>
                      <p className="text-xs text-slate-500">{formatDate(a.completedAt)}</p>
                    </div>
                    <Badge variant="secondary">{a.bodyModel}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
