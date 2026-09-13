import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  getProgressSnapshot,
  listQuizAttempts,
  mergeStudiedKeys,
  submitQuizAttempt,
  type SubmitAttemptInput,
} from '@/lib/progress';

export function progressSnapshotKey(userId: string | undefined): readonly unknown[] {
  return ['progress', 'snapshot', userId ?? 'anonymous'] as const;
}

export function quizAttemptsKey(userId: string | undefined): readonly unknown[] {
  return ['progress', 'attempts', userId ?? 'anonymous'] as const;
}

export function useProgressSnapshot() {
  const { user, status } = useAuth();
  return useQuery({
    queryKey: progressSnapshotKey(user?.id),
    queryFn: getProgressSnapshot,
    enabled: status === 'authenticated',
    retry: false,
    staleTime: 60_000,
  });
}

export function useQuizAttempts() {
  const { user, status } = useAuth();
  return useQuery({
    queryKey: quizAttemptsKey(user?.id),
    queryFn: () => listQuizAttempts(20),
    enabled: status === 'authenticated',
    retry: false,
    staleTime: 60_000,
  });
}

/**
 * Full quiz-attempt history for the /learn surface.
 * Reuses listQuizAttempts with a larger limit; keyed per user so
 * accounts can never leak into each other.
 */
export function useQuizHistory(limit = 100) {
  const { user, status } = useAuth();
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 100;
  return useQuery({
    queryKey: [...quizAttemptsKey(user?.id), 'history', safeLimit],
    queryFn: () => listQuizAttempts(safeLimit),
    enabled: status === 'authenticated',
    retry: false,
    staleTime: 60_000,
  });
}

export function useSubmitQuizAttempt() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: SubmitAttemptInput) => submitQuizAttempt(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizAttemptsKey(user?.id) });
    },
  });
}

export function useMergeStudied() {
  return useMutation({
    mutationFn: ({ keys, bodyModel }: { keys: string[]; bodyModel?: 'male' | 'female' }) =>
      mergeStudiedKeys(keys, bodyModel),
  });
}
