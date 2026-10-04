'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminShell } from '@/components/admin-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminQuiz, useAdminQuizStats } from '@/hooks/useAdmin';
import { addQuestion, archiveQuiz, deleteQuestion, deleteQuiz, publishQuiz } from '@/lib/quizzes';

export default function AdminQuizDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const quizQuery = useAdminQuiz(id);
  const statsQuery = useAdminQuizStats(id);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [correctIndex, setCorrectIndex] = useState('1');

  const quiz = quizQuery.data ?? null;
  const archived = quiz?.status === 'ARCHIVED';

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'quiz'] });
    await queryClient.invalidateQueries({ queryKey: ['admin', 'quizzes'] });
    await quizQuery.refetch();
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/quizzes"
            className="w-fit rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            ← Back to quizzes
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight" data-testid="admin-quiz-title">
            {quiz?.title ?? 'Quiz'}
          </h1>
          {quiz ? (
            <Badge
              variant={quiz.status === 'PUBLISHED' ? 'teal' : 'secondary'}
              data-testid="admin-quiz-status"
            >
              {quiz.status}
            </Badge>
          ) : null}
        </div>

        {quizQuery.isLoading ? (
          <div className="flex flex-col gap-2" data-testid="admin-quiz-loading">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : quizQuery.isError || !quiz ? (
          <div className="flex flex-col gap-2">
            <Alert variant="destructive" data-testid="admin-quiz-error">
              <AlertDescription>Failed to load quiz.</AlertDescription>
            </Alert>
            <Button
              variant="outline"
              type="button"
              onClick={() => quizQuery.refetch()}
              data-testid="admin-quiz-retry"
              className="w-fit"
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            {error ? (
              <Alert variant="destructive" data-testid="admin-quiz-action-error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Card>
              <CardHeader className="border-b border-slate-800 bg-slate-900/40">
                <p className="text-sm font-bold text-slate-100">Lifecycle (audited)</p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 p-4">
                {quiz.status === 'DRAFT' ? (
                  <Button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => run('publish', () => publishQuiz(quiz.id))}
                    data-testid="admin-quiz-publish"
                    className="w-fit"
                  >
                    {busy === 'publish' ? 'Publishing…' : 'Publish'}
                  </Button>
                ) : null}
                {!archived ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => run('archive', () => archiveQuiz(quiz.id))}
                    data-testid="admin-quiz-archive"
                    className="w-fit"
                  >
                    {busy === 'archive' ? 'Archiving…' : 'Archive'}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy !== null}
                  onClick={() =>
                    run('delete', () => deleteQuiz(quiz.id).then(() => router.push('/quizzes')))
                  }
                  data-testid="admin-quiz-delete"
                  className="w-fit"
                >
                  {busy === 'delete' ? 'Deleting…' : 'Delete quiz'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-slate-800 bg-slate-900/40">
                <p className="text-sm font-bold text-slate-100">
                  Question bank ({quiz.questions?.length ?? 0})
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 p-4">
                <ul className="flex flex-col gap-2" data-testid="admin-question-list">
                  {(quiz.questions ?? []).map((q, qi) => (
                    <li
                      key={q.id}
                      data-testid="admin-question-row"
                      className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5"
                    >
                      <p className="text-sm font-medium text-slate-100">
                        {qi + 1}. {q.prompt}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        {q.options.length} options · key #{(q.correctIndex ?? 0) + 1}
                      </p>
                      {!archived ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          disabled={busy !== null}
                          onClick={() => run('delq', () => deleteQuestion(quiz.id, q.id))}
                          data-testid="admin-question-delete"
                          className="mt-1 w-fit text-red-300"
                        >
                          Delete
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {!archived ? (
                  <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-700 p-3">
                    <Label htmlFor="admin-q-prompt" className="text-xs text-slate-400">
                      New question (key visible — admin authorized)
                    </Label>
                    <Input
                      id="admin-q-prompt"
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      placeholder="Question prompt"
                      data-testid="admin-question-prompt"
                      className="bg-slate-950/40"
                    />
                    <textarea
                      value={optionsText}
                      onChange={e => setOptionsText(e.target.value)}
                      placeholder="One option per line (2–8)"
                      data-testid="admin-question-options"
                      aria-label="Answer options, one per line"
                      rows={3}
                      className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <Label htmlFor="admin-q-correct" className="text-xs text-slate-400">
                        Correct option (1-based)
                      </Label>
                      <Input
                        id="admin-q-correct"
                        value={correctIndex}
                        onChange={e => setCorrectIndex(e.target.value)}
                        data-testid="admin-question-correct"
                        className="w-20 bg-slate-950/40"
                      />
                      <Button
                        type="button"
                        disabled={busy !== null || !prompt.trim()}
                        onClick={() => {
                          const options = optionsText
                            .split('\n')
                            .map(o => o.trim())
                            .filter(o => o.length > 0);
                          void run('add', () =>
                            addQuestion(quiz.id, {
                              prompt: prompt.trim(),
                              options,
                              correctIndex: Number(correctIndex) - 1,
                            }).then(() => {
                              setPrompt('');
                              setOptionsText('');
                              setCorrectIndex('1');
                            })
                          );
                        }}
                        data-testid="admin-question-add"
                        className="w-fit"
                      >
                        {busy === 'add' ? 'Adding…' : 'Add question'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-slate-800 bg-slate-900/40">
                <p className="text-sm font-bold text-slate-100">Statistics</p>
              </CardHeader>
              <CardContent className="p-4">
                {statsQuery.data ? (
                  <p className="text-sm text-slate-300" data-testid="admin-quiz-stats">
                    {statsQuery.data.attempts} attempts · avg {statsQuery.data.avgPercentage}% ·{' '}
                    {statsQuery.data.totalQuestions} questions
                  </p>
                ) : (
                  <p className="text-sm text-slate-500" data-testid="admin-quiz-stats-empty">
                    No statistics yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminShell>
  );
}
