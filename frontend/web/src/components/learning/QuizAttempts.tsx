import { Link } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { useQuizAttempts, useQuizHistory } from '@/hooks/useProgress';
import type { QuizAttemptRecord } from '@/lib/progress';
import { buildHumanFocusUrl } from '@/lib/humanLink';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** First answer structureKey that can deep-link into the viewer, if any. */
function focusKeyFor(attempt: QuizAttemptRecord): string | null {
  const found = (attempt.answers ?? []).find(
    a => typeof a.structureKey === 'string' && a.structureKey.length > 0
  );
  return found?.structureKey ?? null;
}

function AttemptItem({ attempt }: { attempt: QuizAttemptRecord }): JSX.Element {
  const focusKey = focusKeyFor(attempt);
  return (
    <li
      data-testid="quiz-item"
      className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
    >
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
        <Link
          to={buildHumanFocusUrl(focusKey)}
          data-testid="quiz-review"
          className="shrink-0 rounded px-2 py-1 text-xs text-teal-300 hover:bg-teal-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          Review in 3D
        </Link>
      ) : null}
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
    return (
      <p className="text-sm text-slate-500" data-testid="quiz-loading">
        Loading quiz attempts…
      </p>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-red-300" role="alert" data-testid={errorTestId}>
          Couldn&apos;t load quiz attempts.
        </p>
        <button
          type="button"
          onClick={onRetry}
          data-testid={retryTestId}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          Retry
        </button>
      </div>
    );
  }
  return null;
}

/** Latest-score + recent attempts preview for the home dashboard. */
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
        <Link
          to="/learn"
          data-testid="quiz-view-all"
          className="text-sm text-teal-300 hover:text-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          View full history →
        </Link>
      ) : null}
    </div>
  );
}

/** Full pageless history for /learn (limit 100, newest first). */
export function QuizHistoryList(): JSX.Element | null {
  const { status } = useAuth();
  const historyQuery = useQuizHistory(100);
  if (status !== 'authenticated') return null;

  if (historyQuery.isLoading && !historyQuery.data) {
    return (
      <p className="text-sm text-slate-500" data-testid="history-loading">
        Loading quiz history…
      </p>
    );
  }
  if (historyQuery.isError) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-red-300" role="alert" data-testid="history-error">
          Couldn&apos;t load quiz history.
        </p>
        <button
          type="button"
          onClick={() => historyQuery.refetch()}
          data-testid="history-retry"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          Retry
        </button>
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
