import { Link } from 'react-router-dom';
import AuthErrorNotice from '@/features/auth/components/AuthErrorNotice';
import { friendlyCohortError } from '@/features/auth/components/friendlyAuthError';
import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ASSIGNMENT_STATUS_LABEL,
  type AssignmentSort,
  type AssignmentStudentRow,
  type AssignmentSummary,
} from '@/features/cohorts/analytics';

export interface AssignmentSummaryEntry {
  moduleKey: string;
  summary: AssignmentSummary | null;
}

interface AssignmentAnalyticsProps {
  cohortId: string;
  summaries: AssignmentSummaryEntry[];
  effectiveSelectedKey: string | null;
  selectedSummary: AssignmentSummary | null;
  selectedRows: AssignmentStudentRow[];
  assignmentSort: AssignmentSort;
  onSelectModuleKey: (moduleKey: string) => void;
  onSortChange: (sort: AssignmentSort) => void;
  isAssignmentsLoading: boolean;
  isProgressLoading: boolean;
  assignmentsFailed: boolean;
  progressFailed: boolean;
  assignmentsError: unknown;
  progressError: unknown;
  onRetryAssignments: () => void;
  onRetryProgress: () => void;
}

export default function AssignmentAnalytics({
  cohortId,
  summaries,
  effectiveSelectedKey,
  selectedSummary,
  selectedRows,
  assignmentSort,
  onSelectModuleKey,
  onSortChange,
  isAssignmentsLoading,
  isProgressLoading,
  assignmentsFailed,
  progressFailed,
  assignmentsError,
  progressError,
  onRetryAssignments,
  onRetryProgress,
}: AssignmentAnalyticsProps): JSX.Element {
  return (
    <Reveal delay={0.06}>
      <section aria-labelledby="assignment-analytics-heading">
        <Card>
          <CardHeader>
            <p className="ax-kicker">Assignments</p>
            <CardTitle
              id="assignment-analytics-heading"
              className="mt-1 text-sm font-bold tracking-tight text-slate-100"
            >
              Assignment progress
            </CardTitle>
            <CardDescription>
              Completion counts derive from member studied structures (complete means every module
              structure studied). Select an assignment to see per-student progress.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isAssignmentsLoading || isProgressLoading ? (
              <div className="flex flex-col gap-3" data-testid="dashboard-assignments-loading">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : assignmentsFailed ? (
              <div className="flex flex-col gap-3">
                <AuthErrorNotice
                  error={friendlyCohortError(assignmentsError)}
                  testId="dashboard-assignments-error"
                />
                <Button
                  variant="outline"
                  onClick={onRetryAssignments}
                  data-testid="dashboard-assignments-retry"
                  className="w-fit"
                >
                  Retry
                </Button>
              </div>
            ) : progressFailed ? (
              <div className="flex flex-col gap-3">
                <AuthErrorNotice
                  error={friendlyCohortError(progressError)}
                  testId="dashboard-assignments-progress-error"
                />
                <Button
                  variant="outline"
                  onClick={onRetryProgress}
                  data-testid="dashboard-assignments-progress-retry"
                  className="w-fit"
                >
                  Retry
                </Button>
              </div>
            ) : summaries.length === 0 ? (
              <div
                className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-6 py-8 text-center"
                data-testid="dashboard-assignments-empty"
              >
                <p className="text-sm font-medium text-slate-200">No modules assigned yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
                  Assign a study module from the cohort page. Progress per assignment will appear
                  here.
                </p>
                <Button variant="outline" size="sm" asChild className="mt-4">
                  <Link to={`/cohorts/${cohortId}`}>Go to cohort</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <ul className="flex flex-col gap-2" data-testid="dashboard-assignments">
                  {summaries.map(({ moduleKey, summary }) => {
                    const isSelected = moduleKey === effectiveSelectedKey;
                    return (
                      <li key={moduleKey} data-testid="dashboard-assignment-row">
                        <div
                          className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
                            isSelected
                              ? 'border-teal-800/60 bg-teal-950/10'
                              : 'border-slate-800 bg-slate-950/60'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/learn/${moduleKey}`}
                              className="rounded font-medium text-teal-300 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                            >
                              {summary?.title ?? moduleKey}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {summary ? (
                                <>
                                  {summary.totalStructures} structures · {summary.totalMembers}{' '}
                                  member{summary.totalMembers === 1 ? '' : 's'}
                                </>
                              ) : (
                                'Module data unavailable'
                              )}
                            </p>
                            {summary ? (
                              <p
                                className="mt-0.5 text-xs text-slate-400"
                                data-testid="dashboard-assignment-progress"
                              >
                                {summary.completed} complete · {summary.inProgress} in progress ·{' '}
                                {summary.notStarted} not started
                              </p>
                            ) : null}
                          </div>
                          <Button
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            type="button"
                            onClick={() => onSelectModuleKey(moduleKey)}
                            aria-pressed={isSelected}
                            data-testid="dashboard-assignment-select"
                            className="w-fit shrink-0"
                          >
                            {isSelected ? 'Selected' : 'View students'}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {effectiveSelectedKey ? (
                  <div
                    className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                    data-testid="dashboard-assignment-detail"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-sm font-semibold text-slate-100">
                        Student progress — {selectedSummary?.title ?? effectiveSelectedKey}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor="dashboard-assignment-sort"
                          className="text-xs text-slate-400"
                        >
                          Sort
                        </Label>
                        <select
                          id="dashboard-assignment-sort"
                          value={assignmentSort}
                          onChange={e => onSortChange(e.target.value as AssignmentSort)}
                          data-testid="dashboard-assignment-sort"
                          aria-label="Sort students by completion or name"
                          className="h-9 rounded-lg border border-slate-700 bg-slate-800/50 px-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        >
                          <option value="completion">Completion</option>
                          <option value="name">Name</option>
                        </select>
                      </div>
                    </div>
                    {selectedSummary === null ? (
                      <p
                        className="mt-3 text-sm text-slate-500"
                        data-testid="dashboard-student-empty"
                      >
                        Module data unavailable for this assignment.
                      </p>
                    ) : selectedRows.length === 0 ? (
                      <p
                        className="mt-3 text-sm text-slate-500"
                        data-testid="dashboard-student-empty"
                      >
                        No members in this cohort yet.
                      </p>
                    ) : (
                      <>
                        <p className="mt-2 text-xs text-slate-500" role="status">
                          {selectedSummary.completed} of {selectedSummary.totalMembers} members
                          completed {selectedSummary.title}.
                        </p>
                        <ul
                          className="mt-2 flex flex-col gap-2"
                          data-testid="dashboard-student-list"
                        >
                          {selectedRows.map(row => (
                            <li
                              key={row.userId}
                              data-testid="dashboard-student-row"
                              className="flex flex-col gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-medium text-slate-100">
                                    {row.name ?? 'Unnamed member'}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 text-[11px] capitalize"
                                  >
                                    {row.role.toLowerCase()}
                                  </Badge>
                                  <Badge
                                    variant={
                                      row.status === 'complete'
                                        ? 'teal'
                                        : row.status === 'in-progress'
                                          ? 'secondary'
                                          : 'outline'
                                    }
                                    className="shrink-0 text-[11px]"
                                    data-testid="dashboard-student-status"
                                  >
                                    {ASSIGNMENT_STATUS_LABEL[row.status]}
                                  </Badge>
                                </div>
                                <p className="mt-1 font-mono text-xs text-slate-400">
                                  studied {row.studied} of {row.total} ({row.percent}%)
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="w-fit shrink-0 text-teal-300 hover:text-teal-200"
                              >
                                <Link
                                  to={`/learn/${effectiveSelectedKey}`}
                                  aria-label={`Open ${selectedSummary.title} module for ${row.name ?? 'member'}`}
                                >
                                  Open module →
                                </Link>
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </Reveal>
  );
}
