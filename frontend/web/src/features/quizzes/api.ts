/**
 * Bank quizzes API — thin typed wrappers over the authed request helper.
 * Mirrors GET/POST/PATCH/DELETE /api/v1/quizzes* exactly. The backend grades
 * authoritatively: submissions carry selected indexes only, and question
 * payloads omit correctIndex unless the caller manages the quiz.
 */
import { authedRequest } from '@/lib/auth';
import type {
  BankAttemptResultContract,
  BankAttemptRowContract,
  BankQuestionContract,
  BankQuizContract,
  BankQuizStatsContract,
  QuizStatus,
} from '@anatomiax/shared-types';

// Consumer-facing aliases — canonical shapes live in shared-types so both
// apps converge on one contract (never Prisma entities).
export type { QuizStatus };
export type BankQuestionView = BankQuestionContract;
export type BankQuizView = BankQuizContract;
export type BankAttemptResult = BankAttemptResultContract;
export type BankAttemptRow = BankAttemptRowContract;
export type BankQuizStats = BankQuizStatsContract;

export function listQuizzes(mine?: boolean): Promise<BankQuizView[]> {
  return authedRequest<BankQuizView[]>(`/api/v1/quizzes${mine ? '?mine=true' : ''}`);
}

export function getQuiz(id: string): Promise<BankQuizView> {
  return authedRequest<BankQuizView>(`/api/v1/quizzes/${id}`);
}

export function createQuiz(input: {
  title: string;
  description?: string;
  bodyModel?: string;
}): Promise<BankQuizView> {
  return authedRequest<BankQuizView>('/api/v1/quizzes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateQuiz(
  id: string,
  input: { title?: string; description?: string; bodyModel?: string }
): Promise<BankQuizView> {
  return authedRequest<BankQuizView>(`/api/v1/quizzes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function addQuestion(
  id: string,
  input: { prompt: string; options: string[]; correctIndex: number; position?: number }
): Promise<BankQuestionView> {
  return authedRequest<BankQuestionView>(`/api/v1/quizzes/${id}/questions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateQuestion(
  id: string,
  questionId: string,
  input: { prompt?: string; options?: string[]; correctIndex?: number; position?: number }
): Promise<BankQuestionView> {
  return authedRequest<BankQuestionView>(`/api/v1/quizzes/${id}/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteQuestion(id: string, questionId: string): Promise<{ status: string }> {
  return authedRequest<{ status: string }>(`/api/v1/quizzes/${id}/questions/${questionId}`, {
    method: 'DELETE',
  });
}

export function publishQuiz(id: string): Promise<BankQuizView> {
  return authedRequest<BankQuizView>(`/api/v1/quizzes/${id}/publish`, { method: 'POST' });
}

export function archiveQuiz(id: string): Promise<BankQuizView> {
  return authedRequest<BankQuizView>(`/api/v1/quizzes/${id}/archive`, { method: 'POST' });
}

export function deleteQuiz(id: string): Promise<{ status: string }> {
  return authedRequest<{ status: string }>(`/api/v1/quizzes/${id}`, { method: 'DELETE' });
}

export function submitBankAttempt(
  id: string,
  answers: Array<{ questionId: string; selectedIndex: number }>
): Promise<BankAttemptResult> {
  return authedRequest<BankAttemptResult>(`/api/v1/quizzes/${id}/attempts`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

export function listQuizAttempts(id: string, cohortId?: string): Promise<BankAttemptRow[]> {
  const qs = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : '';
  return authedRequest<BankAttemptRow[]>(`/api/v1/quizzes/${id}/attempts${qs}`);
}

export function getQuizStats(id: string, cohortId?: string): Promise<BankQuizStats> {
  const qs = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : '';
  return authedRequest<BankQuizStats>(`/api/v1/quizzes/${id}/stats${qs}`);
}
