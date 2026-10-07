import { useMemo } from 'react';
import type { CohortMemberProgress } from '@/features/cohorts/api';
import { bestScoreText, type DashboardRecentAttempt } from './dashboardFormat';

export interface DashboardAggregates {
  totalMembers: number | null;
  aggregateStudied: number;
  aggregateQuizzes: number;
  bestOverall: string;
  latestOverall: string;
  recentAttempts: DashboardRecentAttempt[];
}

export function useDashboardAggregates(
  progress: CohortMemberProgress[] | null
): DashboardAggregates {
  return useMemo<DashboardAggregates>(() => {
    if (!progress) {
      return {
        totalMembers: null,
        aggregateStudied: 0,
        aggregateQuizzes: 0,
        bestOverall: '—',
        latestOverall: '—',
        recentAttempts: [],
      };
    }
    const aggregateStudied = progress.reduce((sum, m) => sum + (m.studiedKeys?.length ?? 0), 0);
    const aggregateQuizzes = progress.reduce((sum, m) => sum + (m.quizAttempts?.length ?? 0), 0);
    const allAttempts = progress.flatMap(m =>
      m.quizAttempts.map(a => ({ ...a, name: m.name, userId: m.userId }))
    );
    allAttempts.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
    const recentAttempts = allAttempts.slice(0, 5);
    const bestOverall = bestScoreText(allAttempts);
    let latestOverall = '—';
    if (allAttempts.length > 0) latestOverall = `${allAttempts[0].score} / ${allAttempts[0].total}`;
    return {
      totalMembers: progress.length,
      aggregateStudied,
      aggregateQuizzes,
      bestOverall,
      latestOverall,
      recentAttempts,
    };
  }, [progress]);
}
