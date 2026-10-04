import { Link } from 'react-router-dom';
import AuthErrorNotice from '@/features/auth/components/AuthErrorNotice';
import { friendlyCohortError } from '@/features/auth/components/friendlyAuthError';
import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBankQuizzes } from '@/features/quizzes/hooks/useQuizzes';

export default function QuizzesPage(): JSX.Element {
  const published = useBankQuizzes(false);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <Reveal>
        <div>
          <p className="ax-kicker">Assessments</p>
          <h1
            className="mt-1 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl"
            data-testid="quizzes-title"
          >
            Quizzes
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Published quizzes only. Grading happens on the server — your answers decide the score.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        {published.isLoading ? (
          <div className="flex flex-col gap-3" data-testid="quizzes-loading">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : published.isError ? (
          <div className="flex flex-col gap-3">
            <AuthErrorNotice error={friendlyCohortError(published.error)} testId="quizzes-error" />
            <Button
              variant="outline"
              onClick={() => published.refetch()}
              data-testid="quizzes-retry"
              className="w-fit"
            >
              Retry
            </Button>
          </div>
        ) : !published.data || published.data.length === 0 ? (
          <Card>
            <CardContent className="px-6 py-10 text-center" data-testid="quizzes-empty">
              <p className="text-sm font-semibold text-slate-200">No published quizzes yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                Your teachers have not published any quizzes. Check back later.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="quizzes-list">
            {published.data.map(q => (
              <li key={q.id} data-testid="quiz-row">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base" data-testid="quiz-row-title">
                      {q.title}
                    </CardTitle>
                    <CardDescription>
                      {q.questionCount} question{q.questionCount === 1 ? '' : 's'}
                      {q.bodyModel ? ` · ${q.bodyModel}` : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline" data-testid="quiz-row-count">
                        {q.questionCount} questions
                      </Badge>
                      <Button variant="default" size="sm" asChild className="w-fit">
                        <Link to={`/quizzes/${q.id}`} data-testid="quiz-row-open">
                          Take quiz →
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </main>
  );
}
