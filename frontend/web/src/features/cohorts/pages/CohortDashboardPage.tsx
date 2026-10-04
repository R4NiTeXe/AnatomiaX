import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AuthErrorNotice from '@/features/auth/components/AuthErrorNotice';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { friendlyCohortError } from '@/features/auth/components/friendlyAuthError';
import AssignmentAnalytics from '@/features/cohorts/components/dashboard/AssignmentAnalytics';
import DashboardHeader from '@/features/cohorts/components/dashboard/DashboardHeader';
import DashboardKpis from '@/features/cohorts/components/dashboard/DashboardKpis';
import MemberRoster from '@/features/cohorts/components/dashboard/MemberRoster';
import RecentActivity from '@/features/cohorts/components/dashboard/RecentActivity';
import { useDashboardAggregates } from '@/features/cohorts/components/dashboard/useDashboardAggregates';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  canManageCohort,
  useCohort,
  useCohortAssignments,
  useCohortProgress,
} from '@/features/cohorts/hooks/useCohorts';
import {
  assignmentStudentRows,
  summarizeAssignment,
  type AssignmentSort,
  type AssignmentSummary,
} from '@/features/cohorts/analytics';

export default function CohortDashboardPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const cohortQuery = useCohort(id);
  const progressQuery = useCohortProgress(id);
  const assignmentsQuery = useCohortAssignments(id);
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

  // Assignment analytics (STEP 8.53) — summaries + per-student rows derived
  // from the same two authorized queries via the centralized
  // `lib/cohortAnalytics` model (canonical moduleProgress rule).
  // NOTE: must stay above the early returns (hooks order).
  const [selectedModuleKey, setSelectedModuleKey] = useState<string | null>(null);
  const [assignmentSort, setAssignmentSort] = useState<AssignmentSort>('completion');
  const assignmentSummaries = useMemo(() => {
    const raw = assignmentsQuery.data;
    const list = Array.isArray(raw) ? raw : [];
    const members = progressQuery.data ?? null;
    if (!canManage || !members || list.length === 0) return [];
    return list.map(a => ({
      moduleKey: a.moduleKey,
      summary: summarizeAssignment(a.moduleKey, members),
    }));
  }, [assignmentsQuery.data, progressQuery.data, canManage]);
  const effectiveSelectedKey = assignmentSummaries.some(s => s.moduleKey === selectedModuleKey)
    ? selectedModuleKey
    : (assignmentSummaries[0]?.moduleKey ?? null);
  const selectedSummary: AssignmentSummary | null =
    assignmentSummaries.find(s => s.moduleKey === effectiveSelectedKey)?.summary ?? null;
  const selectedRows = useMemo(() => {
    if (!effectiveSelectedKey || !progressQuery.data) return [];
    return assignmentStudentRows(effectiveSelectedKey, progressQuery.data, assignmentSort);
  }, [effectiveSelectedKey, progressQuery.data, assignmentSort]);
  const isAssignmentsLoading = assignmentsQuery.isLoading && !assignmentsQuery.data;

  // Client-side aggregates from server-authorized member progress.
  const progress = progressQuery.data ?? null;
  const {
    totalMembers,
    aggregateStudied,
    aggregateQuizzes,
    bestOverall,
    latestOverall,
    recentAttempts,
  } = useDashboardAggregates(progress);
  const isProgressLoading = progressQuery.isLoading && !progress;
  const isProgressError = progressQuery.isError;

  const showProgress = canManage;
  const progressDenied =
    !canManage &&
    !isProgressLoading &&
    progressQuery.isError &&
    (progressQuery.error as unknown as { status?: number })?.status === 403;

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

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <DashboardHeader cohort={cohort} isArchived={isArchived} />

      <DashboardKpis
        totalMembers={totalMembers}
        aggregateStudied={aggregateStudied}
        aggregateQuizzes={aggregateQuizzes}
        bestOverall={bestOverall}
        latestOverall={latestOverall}
        progressLoaded={!!progress}
        isArchived={isArchived}
      />

      {showProgress ? (
        <AssignmentAnalytics
          cohortId={cohort.id}
          summaries={assignmentSummaries}
          effectiveSelectedKey={effectiveSelectedKey}
          selectedSummary={selectedSummary}
          selectedRows={selectedRows}
          assignmentSort={assignmentSort}
          onSelectModuleKey={setSelectedModuleKey}
          onSortChange={setAssignmentSort}
          isAssignmentsLoading={isAssignmentsLoading}
          isProgressLoading={isProgressLoading}
          assignmentsFailed={assignmentsQuery.isError}
          progressFailed={progressQuery.isError}
          assignmentsError={assignmentsQuery.isError ? assignmentsQuery.error : null}
          progressError={progressQuery.isError ? progressQuery.error : null}
          onRetryAssignments={() => assignmentsQuery.refetch()}
          onRetryProgress={() => progressQuery.refetch()}
        />
      ) : null}

      <MemberRoster
        cohort={cohort}
        progress={progress}
        filteredProgress={filteredProgress}
        memberQuery={memberQuery}
        onMemberQueryChange={setMemberQuery}
        isProgressLoading={isProgressLoading}
        isProgressError={isProgressError}
        progressError={progressQuery.isError ? progressQuery.error : null}
        onRetryProgress={() => progressQuery.refetch()}
        showProgress={showProgress}
        progressDenied={progressDenied}
        bestOverall={bestOverall}
        isArchived={isArchived}
      />

      <RecentActivity recentAttempts={recentAttempts} isProgressLoading={isProgressLoading} />

      <p className="text-center text-xs text-slate-600">
        Dashboard data is live from{' '}
        <span className="font-mono">/api/v1/cohorts/{cohort.id}/progress</span> — archived cohorts
        are read-only.
      </p>
    </main>
  );
}
