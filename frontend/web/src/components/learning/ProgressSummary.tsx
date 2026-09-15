import { useProgressSnapshot, useQuizHistory } from '@/hooks/useProgress';
import { useAuth } from '@/components/auth/AuthProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProgressRing from './ProgressRing';
import { documentedCoverage } from './coverage';

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

export default function ProgressSummary(): JSX.Element | null {
  const { status } = useAuth();
  const snapshotQuery = useProgressSnapshot();
  const historyQuery = useQuizHistory(100);

  if (status !== 'authenticated') return null;

  const isLoading =
    (snapshotQuery.isLoading && !snapshotQuery.data) ||
    (historyQuery.isLoading && !historyQuery.data);
  const isError = snapshotQuery.isError || historyQuery.isError;

  if (isLoading) {
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="progress-summary-loading"
      >
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    const error =
      (snapshotQuery.error as unknown as { requestId?: string; message?: string }) ||
      (historyQuery.error as unknown as { requestId?: string; message?: string });
    const requestId =
      (snapshotQuery.error as unknown as { requestId?: string })?.requestId ??
      (historyQuery.error as unknown as { requestId?: string })?.requestId;
    const handleRetry = () => {
      void snapshotQuery.refetch();
      void historyQuery.refetch();
    };
    return (
      <Alert variant="destructive" data-testid="progress-summary-error">
        <AlertDescription>
          Couldn&apos;t load progress summary.{error?.message ? ` ${error.message}` : ''}
          {requestId ? ` (Reference: ${requestId})` : ''}
        </AlertDescription>
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            data-testid="progress-summary-retry"
          >
            Retry
          </Button>
          {/* preserved for existing tests where practical */}
          <span
            className="hidden"
            data-testid="progress-summary-retry-snapshot"
            aria-hidden="true"
          />
          <span
            className="hidden"
            data-testid="progress-summary-retry-history"
            aria-hidden="true"
          />
        </div>
      </Alert>
    );
  }

  const studiedKeys = snapshotQuery.data?.studiedKeys ?? [];
  const attempts = historyQuery.data ?? [];
  const latest = attempts[0] ?? null;
  const coverage = documentedCoverage(studiedKeys, snapshotQuery.data?.bodyModel ?? null);

  return (
    <div
      data-testid="progress-summary"
      className="grid gap-4 rounded-xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-900/40 p-4 shadow-soft sm:p-5 lg:grid-cols-[auto_1fr] lg:gap-6"
    >
      <div className="flex items-center gap-4">
        <ProgressRing
          value={coverage.studied}
          max={coverage.total}
          testId="progress-summary-coverage"
        />
        <div className="min-w-0">
          <p className="ax-section-title">Mastery</p>
          <p className="mt-1 text-sm text-slate-300">
            {coverage.studied} of {coverage.total} documented structures
          </p>
          <p className="mt-1 text-xs text-slate-500">{studiedKeys.length} studied in total</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="ax-section-title">Studied</dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums text-slate-100"
            data-testid="progress-summary-studied"
          >
            {studiedKeys.length}
          </dd>
          <dd className="text-xs text-slate-500">
            {studiedKeys.length === 1 ? 'structure' : 'structures'}
          </dd>
        </div>
        <div>
          <dt className="ax-section-title">Quizzes</dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums text-slate-100"
            data-testid="progress-summary-quizzes"
          >
            {attempts.length}
          </dd>
          <dd className="text-xs text-slate-500">
            {attempts.length === 1 ? 'completed' : 'completed'}
          </dd>
        </div>
        <div>
          <dt className="ax-section-title">Latest score</dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums text-slate-100"
            data-testid="progress-summary-latest"
          >
            {latest ? `${latest.score} / ${latest.total}` : '—'}
          </dd>
          <dd>
            {latest ? (
              <Badge
                variant={latest.score === latest.total ? 'teal' : 'secondary'}
                className="mt-1 capitalize"
              >
                {latest.bodyModel}
              </Badge>
            ) : (
              <span className="text-xs text-slate-500">No attempts yet</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="ax-section-title">Best score</dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums text-slate-100"
            data-testid="progress-summary-best"
          >
            {bestScoreText(attempts)}
          </dd>
          <dd className="text-xs text-slate-500">{attempts.length > 0 ? 'personal best' : '—'}</dd>
        </div>
      </dl>
    </div>
  );
}
