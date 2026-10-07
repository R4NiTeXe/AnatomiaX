import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import RequireRole from '@/features/auth/components/RequireRole';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useBankQuiz,
  useBankQuizAttempts,
  useBankQuizStats,
} from '@/features/quizzes/hooks/useQuizzes';
import {
  addQuestion,
  archiveQuiz,
  deleteQuestion,
  deleteQuiz,
  publishQuiz,
  updateQuestion,
  updateQuiz,
} from '@/features/quizzes/api';

export default function TeachQuizDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const quizQuery = useBankQuiz(id);
  const attemptsQuery = useBankQuizAttempts(id);
  const statsQuery = useBankQuizStats(id);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [correctIndex, setCorrectIndex] = useState('1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');

  const quiz = quizQuery.data ?? null;
  const archived = quiz?.status === 'ARCHIVED';
  const published = quiz?.status === 'PUBLISHED';

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['quizzes'] });
    await quizQuery.refetch();
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setBusy(null);
    }
  }

  async function onAddQuestion() {
    if (!id) return;
    const options = optionsText
      .split('\n')
      .map(o => o.trim())
      .filter(o => o.length > 0);
    await run('add', () =>
      addQuestion(id, {
        prompt: prompt.trim(),
        options,
        correctIndex: Number(correctIndex) - 1,
      }).then(() => {
        setPrompt('');
        setOptionsText('');
        setCorrectIndex('1');
      })
    );
  }

  return (
    <RequireRole roles={['TEACHER', 'ADMIN']}>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
      >
        <Link
          to="/teach/quizzes"
          className="w-fit rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          ← Back to quiz management
        </Link>

        {quizQuery.isLoading ? (
          <div className="flex flex-col gap-3" data-testid="teach-quiz-loading">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : quizQuery.isError || !quiz ? (
          <Button
            variant="outline"
            onClick={() => quizQuery.refetch()}
            data-testid="teach-quiz-retry"
            className="w-fit"
          >
            Retry
          </Button>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h1
                className="text-2xl font-bold tracking-tight text-slate-100"
                data-testid="teach-quiz-title"
              >
                {quiz.title}
              </h1>
              <Badge variant={published ? 'teal' : 'secondary'} data-testid="teach-quiz-status">
                {quiz.status}
              </Badge>
            </div>

            {error ? (
              <p className="text-sm text-red-300" data-testid="teach-quiz-error" role="alert">
                {error}
              </p>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Details</CardTitle>
                <CardDescription>Title and description (any status).</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="teach-quiz-edit-title" className="text-xs text-slate-400">
                    Title
                  </Label>
                  <Input
                    id="teach-quiz-edit-title"
                    defaultValue={quiz.title}
                    key={quiz.id + quiz.title}
                    data-testid="teach-quiz-edit-title"
                    className="bg-slate-950/40"
                  />
                </div>
                <Button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    const el = document.getElementById(
                      'teach-quiz-edit-title'
                    ) as HTMLInputElement | null;
                    if (el) void run('meta', () => updateQuiz(quiz.id, { title: el.value }));
                  }}
                  data-testid="teach-quiz-edit-save"
                  className="w-fit"
                >
                  {busy === 'meta' ? 'Saving…' : 'Save details'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Lifecycle</CardTitle>
                <CardDescription>
                  Publishing requires at least one question. Published questions are immutable —
                  attempts snapshot them, so history never changes meaning.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {!published && !archived ? (
                  <Button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void run('publish', () => publishQuiz(quiz.id))}
                    data-testid="teach-quiz-publish"
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
                    onClick={() => void run('archive', () => archiveQuiz(quiz.id))}
                    data-testid="teach-quiz-archive"
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
                    void run('delete', () =>
                      deleteQuiz(quiz.id).then(() => navigate('/teach/quizzes', { replace: true }))
                    )
                  }
                  data-testid="teach-quiz-delete"
                  className="w-fit"
                >
                  {busy === 'delete' ? 'Deleting…' : 'Delete quiz'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm" data-testid="teach-questions-heading">
                  Questions ({quiz.questions?.length ?? 0})
                </CardTitle>
                <CardDescription>
                  {published
                    ? 'Published: existing questions are frozen. New questions may still be added.'
                    : 'Draft: add, edit, reorder and delete freely.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ul className="flex flex-col gap-2" data-testid="teach-question-list">
                  {(quiz.questions ?? []).map((q, qi) => (
                    <li
                      key={q.id}
                      data-testid="teach-question-row"
                      className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5"
                    >
                      <p className="text-sm font-medium text-slate-100">
                        {qi + 1}. {q.prompt}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {q.options.length} options · correct #{(q.correctIndex ?? 0) + 1} · position{' '}
                        {q.position}
                      </p>
                      {!published && !archived ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {editingId === q.id ? (
                            <>
                              <Input
                                value={editPrompt}
                                onChange={e => setEditPrompt(e.target.value)}
                                data-testid="teach-question-edit-input"
                                aria-label="Edit prompt"
                                className="max-w-sm bg-slate-900"
                              />
                              <Button
                                size="sm"
                                type="button"
                                disabled={busy !== null}
                                onClick={() =>
                                  void run('edit', () =>
                                    updateQuestion(quiz.id, q.id, { prompt: editPrompt }).then(() =>
                                      setEditingId(null)
                                    )
                                  )
                                }
                                data-testid="teach-question-edit-save"
                                className="w-fit"
                              >
                                Save
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              type="button"
                              onClick={() => {
                                setEditingId(q.id);
                                setEditPrompt(q.prompt);
                              }}
                              data-testid="teach-question-edit"
                              className="w-fit"
                            >
                              Edit
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void run('delq', () => deleteQuestion(quiz.id, q.id))}
                            data-testid="teach-question-delete"
                            className="w-fit text-red-300"
                          >
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {!archived ? (
                  <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-700 p-3">
                    <Label htmlFor="teach-q-prompt" className="text-xs text-slate-400">
                      New question
                    </Label>
                    <Input
                      id="teach-q-prompt"
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      placeholder="Question prompt"
                      data-testid="teach-question-prompt"
                      className="bg-slate-950/40"
                    />
                    <textarea
                      value={optionsText}
                      onChange={e => setOptionsText(e.target.value)}
                      placeholder={'One option per line (2–8)'}
                      data-testid="teach-question-options"
                      aria-label="Answer options, one per line"
                      rows={3}
                      className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <Label htmlFor="teach-q-correct" className="text-xs text-slate-400">
                        Correct option (1-based)
                      </Label>
                      <Input
                        id="teach-q-correct"
                        value={correctIndex}
                        onChange={e => setCorrectIndex(e.target.value)}
                        data-testid="teach-question-correct"
                        className="w-20 bg-slate-950/40"
                      />
                      <Button
                        type="button"
                        disabled={busy !== null || !prompt.trim()}
                        onClick={() => void onAddQuestion()}
                        data-testid="teach-question-add"
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
              <CardHeader>
                <CardTitle className="text-sm">Results</CardTitle>
                <CardDescription>
                  Attempts on this quiz (counts only, key never shown).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {statsQuery.data ? (
                  <p className="text-sm text-slate-300" data-testid="teach-quiz-stats">
                    {statsQuery.data.attempts} attempts · avg {statsQuery.data.avgPercentage}%
                  </p>
                ) : (
                  <p className="text-sm text-slate-500" data-testid="teach-quiz-stats-empty">
                    No statistics yet.
                  </p>
                )}
                {attemptsQuery.data && attemptsQuery.data.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1.5" data-testid="teach-attempt-list">
                    {attemptsQuery.data.slice(0, 10).map(a => (
                      <li
                        key={a.attemptId}
                        data-testid="teach-attempt-row"
                        className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-300"
                      >
                        <span className="font-mono">{a.userId.slice(0, 8)}</span>
                        <span>
                          {a.score}/{a.total} · {a.percentage}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </RequireRole>
  );
}
