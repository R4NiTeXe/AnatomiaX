import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import type { AnatomyBodyModelKey } from '@anatomiax/shared-types';
import {
  getProgressSnapshot,
  listQuizAttempts,
  mergeStudiedKeys,
  submitQuizAttempt,
  type SubmitAttemptInput,
} from '../api/progress';
import { progressSnapshotKey, quizAttemptsKey } from '../query/client';

export function useProgressSnapshot() {
  const { user, status } = useAuth();
  return useQuery({
    queryKey: progressSnapshotKey(user?.id),
    queryFn: getProgressSnapshot,
    enabled: status === 'authenticated',
  });
}

export function useQuizAttempts(limit = 20) {
  const { user, status } = useAuth();
  return useQuery({
    queryKey: quizAttemptsKey(user?.id),
    queryFn: () => listQuizAttempts(limit),
    enabled: status === 'authenticated',
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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ keys, bodyModel }: { keys: string[]; bodyModel?: AnatomyBodyModelKey }) =>
      mergeStudiedKeys(keys, bodyModel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: progressSnapshotKey(user?.id) });
    },
  });
}
