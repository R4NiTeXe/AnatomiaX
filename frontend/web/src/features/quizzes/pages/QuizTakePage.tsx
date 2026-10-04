import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AuthErrorNotice from '@/features/auth/components/AuthErrorNotice';
import { friendlyCohortError } from '@/features/auth/components/friendlyAuthError';
import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useBankQuiz, useBankQuizAttempts } from '@/features/quizzes/hooks/useQuizzes';
import { submitBankAttempt, type BankAttemptResult } from '@/features/quizzes/api';

export default function QuizTakePage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const quizQuery = useBankQuiz(id);
  const attemptsQuery = useBankQuizAttempts(id);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BankAttemptResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const quiz = quizQuery.data ?? null;

  async function onSubmit() {
    if (!id || !quiz) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const answers = Object.entries(selected).map(([questionId, selectedIndex]) => ({
        questionId,
        selectedIndex,
      }));
      const outcome = await submitBankAttempt(id, answers);
      setResult(outcome);
      setSelected({});
      await attemptsQuery.refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <Link
        to="/quizzes"
        className="w-fit rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      >
        ← Back to quizzes
      </Link>

      {quizQuery.isLoading ? (
        <div className="flex flex-col gap-3" data-testid="quiz-take-loading">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : quizQuery.isError || !quiz ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <AuthErrorNotice
              error={quizQuery.error ? friendlyCohortError(quizQuery.error) : null}
              testId="quiz-take-error"
            />
            <Button
              variant="outline"
              onClick={() => quizQuery.refetch()}
              data-testid="quiz-take-retry"
              className="w-fit"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Reveal>
          <Card>
            <CardHeader>
              <p className="ax-kicker">Quiz</p>
              <CardTitle className="text-xl" data-testid="quiz-take-title">
                {quiz.title}
              </CardTitle>
              <CardDescription>
                Answer every question you can — unanswered questions count as incorrect. Grading is
                server-side.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {result ? (
                <div
                  className="rounded-xl border border-teal-800/60 bg-teal-950/10 p-4"
                  data-testid="quiz-take-result"
                  role="status"
                >
                  <p className="text-sm font-semibold text-slate-100">
                    Score {result.score} / {result.total} ({result.percentage}%)
                  </p>
                  <ul className="mt-2 flex flex-col gap-1" data-testid="quiz-take-result-rows">
                    {result.results.map(r => (
                      <li key={r.questionId} className="text-xs text-slate-400">
                        {r.correct ? '✓ Correct' : '✗ Incorrect'}
                        {r.selected === null ? ' (unanswered)' : ''}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setResult(null)}
                    data-testid="quiz-take-again"
                    className="mt-3 w-fit"
                  >
                    Try again
                  </Button>
                </div>
              ) : null}
              {(quiz.questions ?? []).map((q, qi) => (
                <fieldset key={q.id} data-testid="quiz-take-question">
                  <legend className="text-sm font-semibold text-slate-100">
                    {qi + 1}. {q.prompt}
                  </legend>
                  <div
                    className="mt-2 flex flex-col gap-1.5"
                    role="radiogroup"
                    aria-label={q.prompt}
                  >
                    {q.options.map((option, oi) => (
                      <Label
                        key={oi}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                          selected[q.id] === oi
                            ? 'border-teal-700 bg-teal-950/20 text-slate-100'
                            : 'border-slate-800 text-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`quiz-${q.id}`}
                          checked={selected[q.id] === oi}
                          onChange={() => setSelected(s => ({ ...s, [q.id]: oi }))}
                          data-testid="quiz-take-option"
                          className="accent-teal-500"
                        />
                        {option}
                      </Label>
                    ))}
                  </div>
                </fieldset>
              ))}
              {submitError ? (
                <p
                  className="text-sm text-red-300"
                  data-testid="quiz-take-submit-error"
                  role="alert"
                >
                  {submitError}
                </p>
              ) : null}
              <Button
                type="button"
                disabled={submitting || Object.keys(selected).length === 0}
                onClick={() => void onSubmit()}
                data-testid="quiz-take-submit"
                className="w-fit"
              >
                {submitting ? 'Submitting…' : 'Submit answers'}
              </Button>
            </CardContent>
          </Card>
        </Reveal>
      )}

      <Reveal delay={0.05}>
        <section aria-labelledby="quiz-history-heading">
          <h2 id="quiz-history-heading" className="text-sm font-bold text-slate-100">
            My attempts
          </h2>
          {attemptsQuery.isLoading ? (
            <div className="mt-2 flex flex-col gap-2" data-testid="quiz-history-loading">
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : attemptsQuery.isError ? (
            <p className="mt-2 text-sm text-slate-500" data-testid="quiz-history-error">
              Could not load attempts.
            </p>
          ) : !attemptsQuery.data || attemptsQuery.data.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500" data-testid="quiz-history-empty">
              No attempts yet — your results will appear here.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2" data-testid="quiz-history-list">
              {attemptsQuery.data.map(a => (
                <li
                  key={a.attemptId}
                  data-testid="quiz-history-row"
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5 text-sm"
                >
                  <span className="text-slate-200">
                    {a.score}/{a.total}
                  </span>
                  <Badge variant={a.percentage === 100 ? 'teal' : 'secondary'}>
                    {a.percentage}%
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>
    </main>
  );
}
