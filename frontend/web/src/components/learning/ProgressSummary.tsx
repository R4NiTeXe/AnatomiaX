import { useProgressSnapshot, useQuizHistory } from '@/hooks/useProgress';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
    const error = (snapshotQuery.error as Error) || (historyQuery.error as Error);
    return (
      <Alert variant="destructive" data-testid="progress-summary-error">
        <AlertDescription>
          Couldn&apos;t load progress summary.{error?.message ? ` ${error.message}` : ''}
        </AlertDescription>
        <div className="mt-2 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => snapshotQuery.refetch()}
            data-testid="progress-summary-retry-snapshot"
          >
            Retry studied
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => historyQuery.refetch()}
            data-testid="progress-summary-retry-history"
          >
            Retry quizzes
          </Button>
        </div>
      </Alert>
    );
  }

  const studiedKeys = snapshotQuery.data?.studiedKeys ?? [];
  const attempts = historyQuery.data ?? [];
  const latest = attempts[0] ?? null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="progress-summary">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
            Studied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-slate-100" data-testid="progress-summary-studied">
            {studiedKeys.length}
          </p>
          <p className="text-xs text-slate-500">
            {studiedKeys.length === 1 ? 'structure' : 'structures'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
            Quizzes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-slate-100" data-testid="progress-summary-quizzes">
            {attempts.length}
          </p>
          <p className="text-xs text-slate-500">
            {attempts.length === 1 ? 'completed' : 'completed'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
            Latest score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-slate-100" data-testid="progress-summary-latest">
            {latest ? `${latest.score} / ${latest.total}` : '—'}
          </p>
          {latest ? (
            <Badge
              variant={latest.score === latest.total ? 'teal' : 'secondary'}
              className="mt-1 capitalize"
            >
              {latest.bodyModel}
            </Badge>
          ) : (
            <p className="text-xs text-slate-500">No attempts yet</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest text-slate-400">
            Best score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-slate-100" data-testid="progress-summary-best">
            {bestScoreText(attempts)}
          </p>
          <p className="text-xs text-slate-500">{attempts.length > 0 ? 'personal best' : '—'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
