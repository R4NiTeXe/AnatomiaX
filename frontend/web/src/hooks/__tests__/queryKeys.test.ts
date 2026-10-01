import { progressSnapshotKey, quizAttemptsKey } from '../useProgress';
import {
  assignmentsKey,
  cohortKey,
  cohortMembersKey,
  cohortProgressKey,
  cohortsKey,
  myAssignmentsKey,
} from '../useCohorts';

describe('query key builders (per-user isolation)', () => {
  it('keys progress queries by user, falling back to anonymous', () => {
    expect(progressSnapshotKey('u1')).toEqual(['progress', 'snapshot', 'u1']);
    expect(progressSnapshotKey(undefined)).toEqual(['progress', 'snapshot', 'anonymous']);
    expect(quizAttemptsKey('u1')).toEqual(['progress', 'attempts', 'u1']);
    expect(quizAttemptsKey(undefined)).toEqual(['progress', 'attempts', 'anonymous']);
  });

  it('keys cohort queries by user and scope, falling back to anonymous', () => {
    expect(cohortsKey('u1')).toEqual(['cohorts', 'mine', 'u1']);
    expect(cohortsKey(undefined)).toEqual(['cohorts', 'mine', 'anonymous']);
    expect(cohortKey('u1', 'c1')).toEqual(['cohorts', 'detail', 'u1', 'c1']);
    expect(cohortKey(undefined, 'c1')).toEqual(['cohorts', 'detail', 'anonymous', 'c1']);
    expect(cohortMembersKey('u1', 'c1')).toEqual(['cohorts', 'members', 'u1', 'c1']);
    expect(cohortMembersKey(undefined, 'c1')).toEqual(['cohorts', 'members', 'anonymous', 'c1']);
    expect(cohortProgressKey('u1', 'c1')).toEqual(['cohorts', 'progress', 'u1', 'c1']);
    expect(cohortProgressKey(undefined, 'c1')).toEqual(['cohorts', 'progress', 'anonymous', 'c1']);
    expect(assignmentsKey('u1', 'c1')).toEqual(['cohorts', 'assignments', 'u1', 'c1']);
    expect(assignmentsKey(undefined, 'c1')).toEqual(['cohorts', 'assignments', 'anonymous', 'c1']);
    expect(myAssignmentsKey('u1')).toEqual(['cohorts', 'assignments-mine', 'u1']);
    expect(myAssignmentsKey(undefined)).toEqual(['cohorts', 'assignments-mine', 'anonymous']);
  });
});
