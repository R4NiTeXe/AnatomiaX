import {
  clearCachedUserState,
  cohortDetailKey,
  cohortListKey,
  cohortMembersKey,
  progressSnapshotKey,
  queryClient,
  quizAttemptsKey,
} from '../client';

describe('mobile query client (8.19.27)', () => {
  it('scopes every key to the user id', () => {
    expect(JSON.stringify(cohortListKey('user-a'))).toContain('user-a');
    expect(JSON.stringify(cohortDetailKey('user-a', 'c1'))).toContain('user-a');
    expect(JSON.stringify(cohortMembersKey('user-a', 'c1'))).toContain('user-a');
    expect(JSON.stringify(progressSnapshotKey('user-a'))).toContain('user-a');
    expect(JSON.stringify(quizAttemptsKey('user-a'))).toContain('user-a');
  });

  it('isolates cached rows per user', () => {
    expect(cohortListKey('user-a')).not.toEqual(cohortListKey('user-b'));
    expect(quizAttemptsKey('user-a')).not.toEqual(quizAttemptsKey('user-b'));
  });

  it('clears all user state on logout/switch', () => {
    queryClient.setQueryData(cohortListKey('user-a'), [{ id: 'c1' }]);
    queryClient.setQueryData(quizAttemptsKey('user-a'), [{ id: 'att-1' }]);
    queryClient.setQueryData(progressSnapshotKey('user-b'), { studiedKeys: [] });
    clearCachedUserState();
    expect(queryClient.getQueryData(cohortListKey('user-a'))).toBeUndefined();
    expect(queryClient.getQueryData(quizAttemptsKey('user-a'))).toBeUndefined();
    expect(queryClient.getQueryData(progressSnapshotKey('user-b'))).toBeUndefined();
  });
});
