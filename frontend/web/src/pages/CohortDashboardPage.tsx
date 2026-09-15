import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import { useAuth } from '@/components/auth/AuthProvider';
import { friendlyCohortError } from '@/components/auth/friendlyAuthError';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { canManageCohort, useCohort, useCohortProgress } from '@/hooks/useCohorts';
import { buildHumanFocusUrl } from '@/lib/humanLink';

function formatDate(value: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value: string | Date | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const [memberQuery, setMemberQuery] = useState('');

  const filteredProgress = useMemo(() => {
    const p = progressQuery.data ?? null;
    if (!p) return null;
    const q = memberQuery.trim().toLowerCase();
    if (!q) return p;
    return p.filter(m => {
      const name = (m.name ?? '').toLowerCase();
      const role = m.role.toLowerCase();
      return name.includes(q) || role.includes(q);
    });
  }, [progressQuery.data, memberQuery]);

  const cohort = cohortQuery.data ?? null;
  const isArchived = !!cohort?.archivedAt;
  const isStudent = user?.role === 'STUDENT';
  const canManage = cohort ? canManageCohort(cohort.myRole, user?.role) : false;

  if (cohortQuery.isLoading && !cohort) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6"
      >
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-48 w-full" data-testid="dashboard-loading" />
      </main>
    );
  }

  if (cohortQuery.isError || !cohort) {
    return (
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
          <p className="mt-1 text-sm text-slate-400">
            This cohort does not exist or you do not have access.
          </p>
          <AuthErrorNotice
            error={cohortQuery.error ? friendlyCohortError(cohortQuery.error) : null}
            testId="dashboard-error"
          />
          <div className="mt-4 flex flex-wrap gap-2">
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
    );
  }

  if (isStudent) {
    return (
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
          <Badge className="mt-3" data-testid="dashboard-role-badge">
            {cohort.myRole ?? 'MEMBER'}
          </Badge>
        </Card>
      </main>
    );
  }

  const progress = progressQuery.data ?? null;
  const isProgressLoading = progressQuery.isLoading && !progress;
  const isProgressError = progressQuery.isError;

  // Aggregates — client-side from server-authorized member progress
  const totalMembers = progress ? progress.length : null;
  const archivedBadge = isArchived ? (
    <Badge variant="secondary" data-testid="dashboard-archived-badge">
      Archived
    </Badge>
  ) : null;

  let aggregateStudied = 0;
  let aggregateQuizzes = 0;
  let bestOverall = '—';
  let latestOverall = '—';
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
    if (allAttempts.length > 0) latestOverall = `${allAttempts[0].score} / ${allAttempts[0].total}`;
  }

  const showProgress = canManage;
  const progressDenied =
    !canManage &&
    !isProgressLoading &&
    progressQuery.isError &&
    (progressQuery.error as unknown as { status?: number })?.status === 403;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      {/* Top navigation + header hierarchy */}
      <Reveal>
        <div className="flex flex-col gap-4">
          <Link
            to={`/cohorts/${cohort.id}`}
            className="w-fit rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            ← Back to cohort
          </Link>

          <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/20 p-4 shadow-soft sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="ax-kicker">Teacher dashboard</p>
                <h1
                  className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl"
                  data-testid="dashboard-cohort-name"
                >
                  {cohort.name}
                </h1>
                <p className="mt-1 text-sm text-slate-400" data-testid="dashboard-institution">
                  {cohort.institutionLabel ?? 'No institution'}
                  <span className="mx-2 text-slate-600">·</span>
                  <span className="text-slate-500">Created {formatDate(cohort.createdAt)}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge data-testid="dashboard-role-badge" className="capitalize">
                  {cohort.myRole ?? 'MEMBER'}
                </Badge>
                {archivedBadge}
                {!isArchived ? (
                  <Badge variant="outline" className="border-emerald-900/50 text-emerald-300">
                    Active
                  </Badge>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Cohort progress is server-authorized. Only owners and admins can view member details.
              Studied structures link to <span className="font-mono">/human?focus=</span> where
              available.
            </p>
          </div>
        </div>
      </Reveal>

      {isArchived ? (
        <Reveal delay={0.05}>
          <Alert
            variant="default"
            className="border-amber-900/50 bg-amber-950/30 text-amber-200"
            data-testid="dashboard-archived-notice"
          >
            <AlertDescription>
              This cohort is archived and read-only. Progress is frozen from archive time. Members
              cannot be added and settings cannot be changed.
            </AlertDescription>
          </Alert>
        </Reveal>
      ) : null}

      {/* KPI hierarchy — operational cards with subtle glow on primary */}
      <Reveal delay={0.05}>
        <section aria-labelledby="kpi-heading">
          <h2 id="kpi-heading" className="sr-only">
            Cohort overview
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="dashboard-summary">
            <Card className="border-teal-900/30 bg-gradient-to-br from-teal-950/20 via-slate-900/60 to-slate-900/40 shadow-glow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-teal-300/80">
                  Members
                </CardTitle>
                <CardDescription>Total enrolled</CardDescription>
              </CardHeader>
              <CardContent>
                <p
                  className="text-3xl font-bold tracking-tight"
                  data-testid="dashboard-member-count"
                >
                  {totalMembers ?? '—'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {isArchived ? 'Archived · read-only' : 'Active cohort'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Studied
                </CardTitle>
                <CardDescription>Structures explored</CardDescription>
              </CardHeader>
              <CardContent>
                <p
                  className="text-3xl font-bold tracking-tight"
                  data-testid="dashboard-studied-total"
                >
                  {progress ? aggregateStudied : '—'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {progress && totalMembers
                    ? `avg ${(aggregateStudied / Math.max(1, totalMembers)).toFixed(1)} / member`
                    : 'across members'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Quizzes
                </CardTitle>
                <CardDescription>Completed attempts</CardDescription>
              </CardHeader>
              <CardContent>
                <p
                  className="text-3xl font-bold tracking-tight"
                  data-testid="dashboard-quizzes-total"
                >
                  {progress ? aggregateQuizzes : '—'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {progress && totalMembers
                    ? `avg ${(aggregateQuizzes / Math.max(1, totalMembers)).toFixed(1)} / member`
                    : 'total'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-700/50 bg-slate-900/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Performance
                </CardTitle>
                <CardDescription>Best · Latest</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tracking-tight" data-testid="dashboard-best">
                  {progress ? bestOverall : '—'}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span>Latest</span>
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    {progress ? latestOverall : '—'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </Reveal>

      {/* Member progress — searchable, operational density */}
      <Reveal delay={0.08}>
        <section aria-labelledby="members-heading">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="ax-kicker">Roster</p>
                  <CardTitle
                    id="members-heading"
                    className="mt-1 text-sm font-bold tracking-tight text-slate-100"
                  >
                    Member progress
                  </CardTitle>
                  <CardDescription>
                    Searchable, server-authorized. Non-owners see 403. Links open{' '}
                    <span className="font-mono">/human?focus=</span> where structureKey exists.
                  </CardDescription>
                </div>
                {showProgress && progress && progress.length > 0 ? (
                  <Badge variant="outline" className="shrink-0 font-mono text-xs">
                    {filteredProgress?.length ?? 0} / {progress.length}
                  </Badge>
                ) : null}
              </div>

              {showProgress && progress && progress.length > 1 ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="dashboard-member-search" className="text-xs text-slate-400">
                    Filter members
                  </Label>
                  <Input
                    id="dashboard-member-search"
                    data-testid="dashboard-member-search"
                    placeholder="Search by name or role…"
                    value={memberQuery}
                    onChange={e => setMemberQuery(e.target.value)}
                    className="max-w-sm bg-slate-950/40"
                    aria-label="Filter members by name or role"
                  />
                </div>
              ) : null}
            </CardHeader>

            <CardContent>
              {!showProgress ? (
                <Alert variant="destructive" data-testid="dashboard-progress-denied">
                  <AlertDescription>
                    Only the cohort owner (or admin) can view member progress. You have{' '}
                    <span className="font-medium">{cohort.myRole ?? 'no access'}</span> access.
                  </AlertDescription>
                </Alert>
              ) : isProgressLoading ? (
                <div className="flex flex-col gap-3" data-testid="dashboard-progress-loading">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-10 w-32" />
                </div>
              ) : isProgressError ? (
                <div className="flex flex-col gap-3 rounded-xl border border-red-900/50 bg-red-950/20 p-4">
                  <AuthErrorNotice
                    error={friendlyCohortError(progressQuery.error)}
                    testId="dashboard-progress-error"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => progressQuery.refetch()}
                      data-testid="dashboard-progress-retry"
                    >
                      Retry
                    </Button>
                    <Button variant="ghost" asChild>
                      <Link to="/cohorts">Back to cohorts</Link>
                    </Button>
                  </div>
                </div>
              ) : !progress || progress.length === 0 ? (
                <div
                  className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-6 py-10 text-center"
                  data-testid="dashboard-progress-empty"
                >
                  <h3 className="text-sm font-semibold text-slate-200">No members yet</h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
                    Share the invite code from the cohort page. Once members join and explore
                    anatomy or complete quizzes, their progress will appear here.
                  </p>
                  <Button variant="outline" size="sm" asChild className="mt-4">
                    <Link to={`/cohorts/${cohort.id}`}>Go to cohort</Link>
                  </Button>
                </div>
              ) : filteredProgress && filteredProgress.length === 0 ? (
                <div
                  className="rounded-xl border border-slate-800 bg-slate-950/30 px-6 py-8 text-center"
                  data-testid="dashboard-progress-empty"
                >
                  <p className="text-sm text-slate-400">No members match “{memberQuery}”.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMemberQuery('')}
                    className="mt-2"
                    data-testid="dashboard-progress-clear-filter"
                  >
                    Clear filter
                  </Button>
                </div>
              ) : (
                <Stagger>
                  <div className="flex flex-col gap-4" data-testid="dashboard-progress-list">
                    {filteredProgress!.map(member => {
                      const studiedCount = member.studiedKeys.length;
                      const totalQuizzes = member.quizAttempts.length;
                      const sortedAttempts = [...member.quizAttempts].sort(
                        (a, b) =>
                          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
                      );
                      const latest = sortedAttempts[0] ?? null;
                      const best = bestScoreText(member.quizAttempts);
                      const lastActivity = latest ? formatDateTime(latest.completedAt) : '—';
                      const recentKey = member.studiedKeys[0] ?? null;
                      const isTopPerformer =
                        member.quizAttempts.length > 0 &&
                        bestScoreText(member.quizAttempts) === bestOverall &&
                        bestOverall !== '—';
                      return (
                        <StaggerItem key={member.userId} data-testid="dashboard-member-progress">
                          <Card
                            className={`overflow-hidden border-slate-800 bg-slate-950/60 transition-colors hover:border-slate-700 ${isArchived ? 'opacity-90' : ''}`}
                          >
                            <CardContent className="p-0">
                              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3
                                      className="truncate text-sm font-semibold text-slate-100"
                                      data-testid="dashboard-member-name"
                                    >
                                      {member.name ?? 'Unnamed member'}
                                    </h3>
                                    <Badge
                                      variant={member.role === 'TEACHER' ? 'secondary' : 'outline'}
                                      className="capitalize"
                                    >
                                      {member.role.toLowerCase()}
                                    </Badge>
                                    {isTopPerformer ? (
                                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                                        Top
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:flex sm:flex-wrap sm:gap-3">
                                    <div className="flex items-center gap-1">
                                      <dt className="text-slate-500">Studied</dt>
                                      <dd
                                        className="font-medium text-slate-200"
                                        data-testid="dashboard-member-studied"
                                      >
                                        {studiedCount}
                                      </dd>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <dt className="text-slate-500">Quizzes</dt>
                                      <dd
                                        className="font-medium text-slate-200"
                                        data-testid="dashboard-member-quizzes"
                                      >
                                        {totalQuizzes}
                                      </dd>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <dt className="text-slate-500">Best</dt>
                                      <dd
                                        className="font-mono text-slate-300"
                                        data-testid="dashboard-member-best"
                                      >
                                        {best}
                                      </dd>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <dt className="text-slate-500">Latest</dt>
                                      <dd
                                        className="font-mono"
                                        data-testid="dashboard-member-latest"
                                      >
                                        <Badge
                                          variant={
                                            latest && latest.score === latest.total
                                              ? 'teal'
                                              : 'secondary'
                                          }
                                          className="font-mono text-xs"
                                        >
                                          {latest ? `${latest.score}/${latest.total}` : '—'}
                                        </Badge>
                                      </dd>
                                    </div>
                                  </dl>
                                  <p className="mt-2 text-xs text-slate-500">
                                    Joined {formatDate(member.joinedAt)} · Last activity{' '}
                                    <span className="text-slate-400">{lastActivity}</span>
                                  </p>
                                </div>

                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                  {recentKey ? (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      asChild
                                      className="h-8 bg-teal-600 text-white hover:bg-teal-700"
                                    >
                                      <Link
                                        to={buildHumanFocusUrl(recentKey)}
                                        data-testid="dashboard-member-focus"
                                        aria-label={`Open ${member.name ?? 'member'} recent structure in 3D`}
                                      >
                                        Open recent in 3D →
                                      </Link>
                                    </Button>
                                  ) : null}
                                </div>
                              </div>

                              {member.studiedKeys.length > 0 ? (
                                <div className="border-t border-slate-800 bg-slate-900/30 px-4 py-3">
                                  <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                                    Recent structures
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {member.studiedKeys.slice(0, 3).map(k => {
                                      const short = k.split(':').pop() ?? k;
                                      const label =
                                        short.length > 28 ? `${short.slice(0, 28)}…` : short;
                                      return (
                                        <Button
                                          key={k}
                                          variant="outline"
                                          size="sm"
                                          asChild
                                          className="h-7 border-slate-700 bg-slate-800/40 px-2.5 text-xs hover:bg-slate-700"
                                        >
                                          <Link
                                            to={buildHumanFocusUrl(k)}
                                            data-testid="dashboard-member-open"
                                            aria-label={`Open ${short} in 3D viewer`}
                                            title={k}
                                          >
                                            Open {label}
                                          </Link>
                                        </Button>
                                      );
                                    })}
                                    {member.studiedKeys.length > 3 ? (
                                      <span className="inline-flex items-center px-2 py-1 text-xs text-slate-500">
                                        +{member.studiedKeys.length - 3} more
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}

                              {member.quizAttempts.length > 0 ? (
                                <div className="border-t border-slate-800 px-4 py-3">
                                  <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                                    Quiz attempts
                                  </p>
                                  <ul
                                    className="mt-2 flex flex-col gap-1.5"
                                    data-testid="dashboard-member-attempts"
                                  >
                                    {sortedAttempts.slice(0, 3).map(a => (
                                      <li
                                        key={a.id}
                                        data-testid="dashboard-member-attempt"
                                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs"
                                      >
                                        <span className="flex items-center gap-2">
                                          <Badge
                                            variant={a.score === a.total ? 'teal' : 'secondary'}
                                            className="font-mono"
                                          >
                                            {a.score}/{a.total}
                                          </Badge>
                                          <span className="text-slate-400">{a.bodyModel}</span>
                                        </span>
                                        <span className="text-slate-500">
                                          {formatDate(a.completedAt)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : (
                                <div className="border-t border-slate-800 px-4 py-3">
                                  <p className="text-xs italic text-slate-500">No quizzes yet</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </StaggerItem>
                      );
                    })}
                  </div>
                </Stagger>
              )}
              {progressDenied ? (
                <p
                  className="mt-3 rounded-lg border border-amber-900/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/80"
                  data-testid="dashboard-progress-forbidden"
                >
                  View requires owner/admin — your role is{' '}
                  <span className="font-medium">{cohort.myRole}</span>.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </Reveal>

      {/* Recent activity — quiz attempts, deep-link where structureKey exists */}
      <Reveal delay={0.08}>
        <section aria-labelledby="activity-heading">
          <Card>
            <CardHeader>
              <CardTitle
                id="activity-heading"
                className="text-sm font-semibold uppercase tracking-widest text-slate-200"
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
                  className="rounded-xl border border-dashed border-slate-700 bg-slate-950/20 px-6 py-10 text-center"
                  data-testid="dashboard-activity-empty"
                >
                  <h3 className="text-sm font-semibold text-slate-300">No recent quizzes</h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
                    Quiz completions will appear here once members start learning. Studied
                    structures are shown in member cards above.
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

      <p className="text-center text-xs text-slate-600">
        Dashboard data is live from{' '}
        <span className="font-mono">/api/v1/cohorts/{cohort.id}/progress</span> — archived cohorts
        are read-only.
      </p>
    </main>
  );
}
