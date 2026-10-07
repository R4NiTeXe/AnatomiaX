import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/components/AuthProvider';
import {
  getProgressSnapshot,
  listQuizAttempts,
  mergeStudiedKeys,
  submitQuizAttempt,
  type ProgressSnapshotRecord,
  type SubmitAttemptInput,
} from '@/features/progress/api';

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
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useQuizHistory(limit = 100) {
  const { user, status } = useAuth();
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 100;
  return useQuery({
    queryKey: [...quizAttemptsKey(user?.id), 'history', safeLimit],
    queryFn: () => listQuizAttempts(safeLimit),
    enabled: status === 'authenticated',
    retry: false,
    staleTime: 60_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
    mutationFn: ({ keys, bodyModel }: { keys: string[]; bodyModel?: 'male' | 'female' }) =>
      mergeStudiedKeys(keys, bodyModel),
    onSuccess: data => {
      const key = progressSnapshotKey(user?.id);
      const serverKeys = Array.isArray(data?.studiedKeys) ? data.studiedKeys : [];
      const cached = queryClient.getQueryData<ProgressSnapshotRecord>(key);
      if (!cached) {
        queryClient.invalidateQueries({ queryKey: key });
        return;
      }
      queryClient.setQueryData<ProgressSnapshotRecord>(key, {
        ...cached,
        studiedKeys: [...new Set([...serverKeys, ...cached.studiedKeys])],
      });
    },
  });
}
