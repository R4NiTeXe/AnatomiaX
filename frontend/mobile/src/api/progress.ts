/**
 * Progress API — thin typed wrappers over the authed mobile request helper.
 * Server is authoritative; the client only sends completed attempts and
 * additive studied-key updates. Anatomy domain types come from shared-types.
 */
import type { AnatomyBodyModelKey } from '@anatomiax/shared-types';
import { authedRequest } from './auth';

export interface QuizAnswerPayload {
  structureKey?: string;
  canonicalName?: string;
  selected: number;
  correct: number;
}

export interface SubmitAttemptInput {
  bodyModel: AnatomyBodyModelKey;
  score: number;
  total: number;
  answers: QuizAnswerPayload[];
  startedAt?: string;
}

export interface QuizAttemptRecord {
  id: string;
  userId: string;
  bodyModel: string;
  score: number;
  total: number;
  answers: QuizAnswerPayload[];
  startedAt: string | null;
  completedAt: string;
}

export interface ProgressSnapshotRecord {
  userId: string;
  studiedKeys: string[];
  bodyModel: string | null;
  updatedAt: string | null;
}

/**
 * Builds a self-scored practice record without inventing anatomy claims:
 * no structure keys or names are fabricated — correctness counts only.
 */
export function buildPracticeAnswers(score: number, total: number): QuizAnswerPayload[] {
  return Array.from({ length: total }, (_, i) => ({
    selected: i < score ? 1 : 0,
    correct: i < score ? 1 : 0,
  }));
}

export function submitQuizAttempt(input: SubmitAttemptInput): Promise<QuizAttemptRecord> {
  return authedRequest<QuizAttemptRecord>('/api/v1/progress/quiz-attempts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listQuizAttempts(limit = 20): Promise<QuizAttemptRecord[]> {
  return authedRequest<QuizAttemptRecord[]>(`/api/v1/progress/quiz-attempts?limit=${limit}`);
}

export function getProgressSnapshot(): Promise<ProgressSnapshotRecord> {
  return authedRequest<ProgressSnapshotRecord>('/api/v1/progress/snapshot');
}

export function mergeStudiedKeys(
  keys: string[],
  bodyModel?: AnatomyBodyModelKey
): Promise<ProgressSnapshotRecord> {
  return authedRequest<ProgressSnapshotRecord>('/api/v1/progress/snapshot/studied', {
    method: 'PATCH',
    body: JSON.stringify(bodyModel ? { keys, bodyModel } : { keys }),
  });
}
