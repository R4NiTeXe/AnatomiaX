import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import RequireRole from '@/features/auth/components/RequireRole';
import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useBankQuizzes } from '@/features/quizzes/hooks/useQuizzes';
import { createQuiz } from '@/features/quizzes/api';

export default function TeachQuizzesPage(): JSX.Element {
  const mine = useBankQuizzes(true);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createQuiz({ title: title.trim() });
      setTitle('');
      await queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      await mine.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create quiz.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <RequireRole roles={['TEACHER', 'ADMIN']}>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
      >
        <Reveal>
          <div>
            <p className="ax-kicker">Teaching</p>
            <h1
              className="mt-1 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl"
              data-testid="teach-quizzes-title"
            >
              Quiz management
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Drafts are private. Publishing makes a quiz visible to students; grading stays
              server-side.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">New quiz</CardTitle>
              <CardDescription>Starts as a draft — students cannot see it.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="teach-quiz-title" className="text-xs text-slate-400">
                  Title
                </Label>
                <Input
                  id="teach-quiz-title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Skin basics"
                  data-testid="teach-quiz-title"
                  className="bg-slate-950/40"
                />
              </div>
              <Button
                type="button"
                disabled={creating || !title.trim()}
                onClick={() => void onCreate()}
                data-testid="teach-quiz-create"
                className="w-fit"
              >
                {creating ? 'Creating…' : 'Create draft'}
              </Button>
            </CardContent>
            {error ? (
              <p
                className="px-4 pb-4 text-sm text-red-300"
                data-testid="teach-quiz-error"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          {mine.isLoading ? (
            <div className="flex flex-col gap-3" data-testid="teach-quizzes-loading">
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : mine.isError ? (
            <Button
              variant="outline"
              onClick={() => mine.refetch()}
              data-testid="teach-quizzes-retry"
              className="w-fit"
            >
              Retry
            </Button>
          ) : !mine.data || mine.data.length === 0 ? (
            <Card>
              <CardContent className="px-6 py-10 text-center" data-testid="teach-quizzes-empty">
                <p className="text-sm font-medium text-slate-200">No quizzes yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                  Create your first draft above, add questions, then publish.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3" data-testid="teach-quizzes-list">
              {mine.data.map(q => (
                <li key={q.id} data-testid="teach-quiz-row">
                  <Card>
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-semibold text-slate-100"
                          data-testid="teach-quiz-name"
                        >
                          {q.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{q.questionCount} questions</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={q.status === 'PUBLISHED' ? 'teal' : 'secondary'}
                          data-testid="teach-quiz-status"
                        >
                          {q.status}
                        </Badge>
                        <Button variant="outline" size="sm" asChild className="w-fit">
                          <Link to={`/teach/quizzes/${q.id}`} data-testid="teach-quiz-open">
                            Manage →
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
    </RequireRole>
  );
}
