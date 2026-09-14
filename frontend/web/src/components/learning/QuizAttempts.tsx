import { Link } from 'react-router-dom';
import { parseStudiedKey, getAnatomyInformationByStructureKey } from '@anatomiax/anatomy-core';
import { useAuth } from '@/components/auth/AuthProvider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

function displayNameForAnswer(a: QuizAttemptRecord['answers'][number]): string {
  if (a.canonicalName) return a.canonicalName;
  if (a.structureKey) {
    const info = getAnatomyInformationByStructureKey(a.structureKey);
    if (info?.canonicalName) return info.canonicalName;
    const parsed = parseStudiedKey(a.structureKey);
    return parsed?.name ?? a.structureKey;
  }
  return 'Question';
}

function AttemptDetail({ attempt }: { attempt: QuizAttemptRecord }): JSX.Element {
  const answers = attempt.answers ?? [];
  return (
    <div className="flex flex-col gap-3" data-testid="quiz-detail">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-slate-100" data-testid="quiz-detail-score">
          Score {attempt.score} / {attempt.total}
        </p>
        <Badge
          variant={attempt.score === attempt.total ? 'teal' : 'secondary'}
          className="capitalize"
        >
          {attempt.bodyModel}
        </Badge>
        <span className="text-xs text-slate-500" data-testid="quiz-detail-date">
          {formatDate(attempt.completedAt)}
        </span>
      </div>
      {answers.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="quiz-detail-empty">
          No answer details stored for this attempt.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="quiz-detail-list">
          {answers.map((a, idx) => {
            const isCorrect = a.selected === a.correct;
            const name = displayNameForAnswer(a);
            return (
              <li
                key={`${attempt.id}-${idx}`}
                data-testid="quiz-detail-answer"
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-100">{name}</p>
                  <p className="text-xs text-slate-500">
                    Q{idx + 1} · {isCorrect ? 'Correct' : 'Incorrect'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={isCorrect ? 'teal' : 'destructive'}
                    data-testid="quiz-detail-answer-status"
                  >
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </Badge>
                  {a.structureKey ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={buildHumanFocusUrl(a.structureKey)} data-testid="quiz-detail-open">
                        Open in 3D
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" asChild>
          <Link to="/human" data-testid="quiz-detail-practice">
            Practice again
          </Link>
        </Button>
        {focusKeyFor(attempt) ? (
          <Button variant="ghost" asChild>
            <Link
              to={buildHumanFocusUrl(focusKeyFor(attempt) as string)}
              data-testid="quiz-detail-focus"
            >
              Open first structure in 3D
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
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
        <div className="flex items-center gap-1">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="quiz-details-trigger">
                Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Quiz attempt</DialogTitle>
                <DialogDescription>
                  Review your answers and open structures in the 3D viewer.
                </DialogDescription>
              </DialogHeader>
              <AttemptDetail attempt={attempt} />
            </DialogContent>
          </Dialog>
          {focusKey ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to={buildHumanFocusUrl(focusKey)} data-testid="quiz-review">
                Review in 3D
              </Link>
            </Button>
          ) : null}
        </div>
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
