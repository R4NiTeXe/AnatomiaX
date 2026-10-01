import { renderHook } from '@testing-library/react';
import type { CohortMemberProgress } from '@/lib/cohorts';
import { bestScoreText, formatDate, formatDateTime } from '../dashboardFormat';
import { useDashboardAggregates } from '../useDashboardAggregates';

describe('dashboardFormat', () => {
  it('renders em-dashes for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('not-a-date')).toBe('—');
  });

  it('formats valid dates with year precision', () => {
    expect(formatDate('2026-03-04T12:00:00Z')).toContain('2026');
    expect(formatDateTime('2026-03-04T12:00:00Z')).toContain('2026');
  });

  it('picks the best score by percentage with score tie-break', () => {
    expect(bestScoreText([])).toBe('—');
    expect(
      bestScoreText([
        { score: 3, total: 5 },
        { score: 5, total: 5 },
      ])
    ).toBe('5 / 5');
    // Same percentage (50%): higher raw score wins.
    expect(
      bestScoreText([
        { score: 1, total: 2 },
        { score: 5, total: 10 },
      ])
    ).toBe('5 / 10');
    // Zero-total attempts never divide by zero (guarded by Math.max(1, …)).
    expect(bestScoreText([{ score: 0, total: 0 }])).toBe('0 / 0');
  });
});

function member(overrides: Partial<CohortMemberProgress> = {}): CohortMemberProgress {
  return {
    userId: 'u1',
    name: 'Ada',
    role: 'STUDENT',
    joinedAt: '2026-01-01T00:00:00Z',
    studiedKeys: [],
    quizAttempts: [],
    ...overrides,
  };
}

describe('useDashboardAggregates', () => {
  it('returns fallbacks for null progress', () => {
    const { result } = renderHook(() => useDashboardAggregates(null));
    expect(result.current).toEqual({
      totalMembers: null,
      aggregateStudied: 0,
      aggregateQuizzes: 0,
      bestOverall: '—',
      latestOverall: '—',
      recentAttempts: [],
    });
  });

  it('sums studied/quiz counts and derives best/latest/recent', () => {
    const progress = [
      member({
        userId: 'u1',
        studiedKeys: ['a', 'b'],
        quizAttempts: [
          { id: 'q1', score: 3, total: 5, bodyModel: 'male', completedAt: '2026-02-01T00:00:00Z' },
          { id: 'q2', score: 5, total: 5, bodyModel: 'male', completedAt: '2026-03-01T00:00:00Z' },
        ],
      }),
      member({
        userId: 'u2',
        name: 'Bo',
        studiedKeys: ['a'],
        quizAttempts: [
          {
            id: 'q3',
            score: 1,
            total: 5,
            bodyModel: 'female',
            completedAt: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    ];
    const { result } = renderHook(() => useDashboardAggregates(progress));
    const agg = result.current;
    expect(agg.totalMembers).toBe(2);
    expect(agg.aggregateStudied).toBe(3);
    expect(agg.aggregateQuizzes).toBe(3);
    expect(agg.bestOverall).toBe('5 / 5');
    expect(agg.latestOverall).toBe('5 / 5');
    // Newest first, capped at 5, member identity attached.
    expect(agg.recentAttempts.map(a => a.id)).toEqual(['q2', 'q1', 'q3']);
    expect(agg.recentAttempts[0]).toMatchObject({ userId: 'u1', name: 'Ada' });
  });

  it('caps recent attempts at the 5 newest across members', () => {
    const attempts = Array.from({ length: 7 }, (_, i) => ({
      id: `q${i}`,
      score: i,
      total: 10,
      bodyModel: 'male',
      completedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }));
    const { result } = renderHook(() =>
      useDashboardAggregates([member({ quizAttempts: attempts })])
    );
    expect(result.current.recentAttempts).toHaveLength(5);
    expect(result.current.recentAttempts.map(a => a.id)).toEqual(['q6', 'q5', 'q4', 'q3', 'q2']);
    expect(result.current.aggregateQuizzes).toBe(7);
  });
});
