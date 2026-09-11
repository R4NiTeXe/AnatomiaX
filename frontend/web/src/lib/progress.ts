/**
 * Progress API — thin typed wrappers over the authed request helper.
 * Server is authoritative; the client only sends completed attempts and
 * additive studied-key updates.
 */
import type { AnatomyBodyModelKey } from '@/components/anatomy/anatomyTypes';
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
