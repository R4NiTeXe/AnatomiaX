import { apiRequest } from './api';

export type QuizStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface BankQuestionView {
  id: string;
  prompt: string;
  options: string[];
  position: number;
  correctIndex?: number;
}

export interface BankQuizView {
  id: string;
  title: string;
  description: string | null;
  bodyModel: string | null;
  status: QuizStatus;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  questionCount: number;
  questions?: BankQuestionView[];
}

export interface BankQuizStats {
  quizId: string;
  attempts: number;
  avgScore: number;
  avgPercentage: number;
  totalQuestions: number;
  perQuestion: Array<{
    questionId: string;
    position: number;
    attempts: number;
    correct: number;
    rate: number;
  }>;
}

export function listQuizzes(mine?: boolean): Promise<BankQuizView[]> {
  return apiRequest<BankQuizView[]>(`/api/v1/quizzes${mine ? '?mine=true' : ''}`);
}

export function getQuiz(id: string): Promise<BankQuizView> {
  return apiRequest<BankQuizView>(`/api/v1/quizzes/${id}`);
}

export function publishQuiz(id: string): Promise<BankQuizView> {
  return apiRequest<BankQuizView>(`/api/v1/quizzes/${id}/publish`, { method: 'POST' });
}

export function archiveQuiz(id: string): Promise<BankQuizView> {
  return apiRequest<BankQuizView>(`/api/v1/quizzes/${id}/archive`, { method: 'POST' });
}

export function deleteQuiz(id: string): Promise<{ status: string }> {
  return apiRequest<{ status: string }>(`/api/v1/quizzes/${id}`, { method: 'DELETE' });
}

export function addQuestion(
  id: string,
  input: { prompt: string; options: string[]; correctIndex: number; position?: number }
): Promise<BankQuestionView> {
  return apiRequest<BankQuestionView>(`/api/v1/quizzes/${id}/questions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteQuestion(id: string, questionId: string): Promise<{ status: string }> {
  return apiRequest<{ status: string }>(`/api/v1/quizzes/${id}/questions/${questionId}`, {
    method: 'DELETE',
  });
}

export function getQuizStats(id: string): Promise<BankQuizStats> {
  return apiRequest<BankQuizStats>(`/api/v1/quizzes/${id}/stats`);
}
