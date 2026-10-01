import { Link } from 'react-router-dom';
import AuthErrorNotice from '@/components/auth/AuthErrorNotice';
import { friendlyCohortError } from '@/components/auth/friendlyAuthError';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { CohortMemberProgress, CohortView } from '@/lib/cohorts';
import { buildHumanFocusUrl } from '@/lib/humanLink';
import { bestScoreText, formatDate, formatDateTime } from './dashboardFormat';

interface MemberRosterProps {
  cohort: CohortView;
  progress: CohortMemberProgress[] | null;
  filteredProgress: CohortMemberProgress[] | null;
  memberQuery: string;
  onMemberQueryChange: (query: string) => void;
  isProgressLoading: boolean;
  isProgressError: boolean;
  progressError: unknown;
  onRetryProgress: () => void;
  showProgress: boolean;
  progressDenied: boolean;
  bestOverall: string;
  isArchived: boolean;
}

export default function MemberRoster({
  cohort,
  progress,
  filteredProgress,
  memberQuery,
  onMemberQueryChange,
  isProgressLoading,
  isProgressError,
  progressError,
  onRetryProgress,
  showProgress,
  progressDenied,
  bestOverall,
  isArchived,
}: MemberRosterProps): JSX.Element {
  return (
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
                  onChange={e => onMemberQueryChange(e.target.value)}
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
                  error={friendlyCohortError(progressError)}
                  testId="dashboard-progress-error"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={onRetryProgress}
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
                  Share the invite code from the cohort page. Once members join and explore anatomy
                  or complete quizzes, their progress will appear here.
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
                  onClick={() => onMemberQueryChange('')}
                  className="mt-2"
                  data-testid="dashboard-progress-clear-filter"
                >
                  Clear filter
                </Button>
              </div>
            ) : (
              <>
                <Stagger>
                  <div className="flex flex-col gap-4" data-testid="dashboard-progress-list">
                    {(filteredProgress ?? []).map(member => {
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
              </>
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
  );
}
