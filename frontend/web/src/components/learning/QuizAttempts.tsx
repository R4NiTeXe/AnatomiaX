import { Link } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuizAttempts, useQuizHistory } from '@/hooks/useProgress';
import type { QuizAttemptRecord } from '@/lib/progress';
import { buildHumanFocusUrl } from '@/lib/humanLink';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function focusKeyFor(attempt: QuizAttemptRecord): string | null {
  const found = (attempt.answers ?? []).find(
    a => typeof a.structureKey === 'string' && a.structureKey.length > 0
  );
  return found?.structureKey ?? null;
}

function AttemptItem({ attempt }: { attempt: QuizAttemptRecord }): JSX.Element {
  const focusKey = focusKeyFor(attempt);
  return (
    <li data-testid="quiz-item">
      <Card className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm text-slate-100" data-testid="quiz-score">
            {attempt.score} / {attempt.total}
          </p>
          <p className="truncate text-xs text-slate-500">
            <span className="capitalize">{attempt.bodyModel}</span> ·{' '}
            {formatDate(attempt.completedAt)}
          </p>
        </div>
        {focusKey ? (
          <Button variant="ghost" size="sm" asChild>
            <Link to={buildHumanFocusUrl(focusKey)} data-testid="quiz-review">
              Review in 3D
            </Link>
          </Button>
        ) : null}
      </Card>
    </li>
  );
}

function States({
  isLoading,
  isError,
  onRetry,
  errorTestId,
  retryTestId,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  errorTestId: string;
  retryTestId: string;
}): JSX.Element | null {
  if (isLoading) {
    return <Skeleton className="h-10 w-full" data-testid="quiz-loading" />;
  }
  if (isError) {
    return (
      <div className="flex flex-col gap-2">
        <Alert variant="destructive" data-testid={errorTestId}>
          <AlertDescription>Couldn&apos;t load quiz attempts.</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={onRetry} data-testid={retryTestId}>
          Retry
        </Button>
      </div>
    );
  }
  return null;
}

export function QuizRecent(): JSX.Element | null {
  const { status } = useAuth();
  const attemptsQuery = useQuizAttempts();
  if (status !== 'authenticated') return null;

  const state = States({
    isLoading: attemptsQuery.isLoading && !attemptsQuery.data,
    isError: attemptsQuery.isError,
    onRetry: () => attemptsQuery.refetch(),
    errorTestId: 'quiz-error',
    retryTestId: 'quiz-retry',
  });
  if (state) return state;

  const attempts = attemptsQuery.data ?? [];
  if (attempts.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-testid="quiz-empty">
        No quiz attempts yet. Take a quiz in the 3D viewer to see results here.
      </p>
    );
  }
  const latest = attempts[0];
  const recent = attempts.slice(0, 3);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-300" data-testid="quiz-latest">
        Latest score: {latest.score} / {latest.total}
      </p>
      <ul className="flex flex-col gap-1" data-testid="quiz-list">
        {recent.map(attempt => (
          <AttemptItem key={attempt.id} attempt={attempt} />
        ))}
      </ul>
      {attempts.length > recent.length ? (
        <Button variant="link" asChild className="w-fit p-0">
          <Link to="/learn" data-testid="quiz-view-all">
            View full history →
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

export function QuizHistoryList(): JSX.Element | null {
  const { status } = useAuth();
  const historyQuery = useQuizHistory(100);
  if (status !== 'authenticated') return null;

  if (historyQuery.isLoading && !historyQuery.data) {
    return <Skeleton className="h-10 w-full" data-testid="history-loading" />;
  }
  if (historyQuery.isError) {
    return (
      <div className="flex flex-col gap-2">
        <Alert variant="destructive" data-testid="history-error">
          <AlertDescription>Couldn&apos;t load quiz history.</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => historyQuery.refetch()}
          data-testid="history-retry"
        >
          Retry
        </Button>
      </div>
    );
  }

  const attempts = historyQuery.data ?? [];
  if (attempts.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-testid="history-empty">
        No quiz attempts yet. Take a quiz in the 3D viewer to build history.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-300" data-testid="history-count">
        {attempts.length} {attempts.length === 1 ? 'attempt' : 'attempts'}
      </p>
      <ul className="flex flex-col gap-1" data-testid="history-list">
        {attempts.map(attempt => (
          <AttemptItem key={attempt.id} attempt={attempt} />
        ))}
      </ul>
    </div>
  );
}
