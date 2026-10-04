import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/components/AuthProvider';
import {
  getQuiz,
  getQuizStats,
  listQuizAttempts,
  listQuizzes,
  type BankAttemptRow,
  type BankQuizStats,
  type BankQuizView,
} from '@/features/quizzes/api';

function authedOptions() {
  return { retry: false, staleTime: 30_000 } as const;
}

export function useBankQuizzes(mine?: boolean) {
  const { status } = useAuth();
  return useQuery<BankQuizView[]>({
    queryKey: ['quizzes', mine ? 'mine' : 'all'],
    queryFn: () => listQuizzes(mine),
    enabled: status === 'authenticated',
    ...authedOptions(),
  });
}

export function useBankQuiz(id: string | undefined) {
  const { status } = useAuth();
  return useQuery<BankQuizView>({
    queryKey: ['quizzes', id ?? ''],
    queryFn: () => getQuiz(id as string),
    enabled: status === 'authenticated' && !!id,
    ...authedOptions(),
  });
}

export function useBankQuizAttempts(quizId: string | undefined, cohortId?: string) {
  const { status } = useAuth();
  return useQuery<BankAttemptRow[]>({
    queryKey: ['quizzes', quizId ?? '', 'attempts', cohortId ?? ''],
    queryFn: () => listQuizAttempts(quizId as string, cohortId),
    enabled: status === 'authenticated' && !!quizId,
    ...authedOptions(),
  });
}

export function useBankQuizStats(quizId: string | undefined, cohortId?: string) {
  const { status } = useAuth();
  return useQuery<BankQuizStats>({
    queryKey: ['quizzes', quizId ?? '', 'stats', cohortId ?? ''],
    queryFn: () => getQuizStats(quizId as string, cohortId),
    enabled: status === 'authenticated' && !!quizId,
    ...authedOptions(),
  });
}
