import {
  ASSIGNMENT_STATUS_LABEL,
  assignmentStudentRows,
  summarizeAssignment,
} from '@/lib/cohortAnalytics';
import type { CohortMemberProgress } from '@/lib/cohorts';
import { buildLearningModules } from '@/components/learning/modules';

function member(userId: string, name: string | null, studiedKeys: string[]): CohortMemberProgress {
  return {
    userId,
    name,
    role: 'STUDENT',
    joinedAt: '2026-01-02T00:00:00.000Z',
    studiedKeys,
    quizAttempts: [],
  };
}

describe('cohortAnalytics (8.53)', () => {
  it('summarizes an assignment from studied keys (skin has 2 structures)', () => {
    const skin = buildLearningModules().find(m => m.key === 'skin');
    expect(skin).toBeDefined();
    expect(skin!.totalStructures).toBe(2);
    const [first, second] = skin!.structureKeys;
    const members = [
      member('u-complete', 'Ann', [...skin!.structureKeys]),
      member('u-progress', 'Bo', [first]),
      member('u-idle', 'Cy', []),
      member('u-other', 'De', ['male:nervous:UBERON:0000955', second]),
    ];
    const summary = summarizeAssignment('skin', members);
    expect(summary).toMatchObject({
      moduleKey: 'skin',
      title: 'Skin',
      totalStructures: 2,
      totalMembers: 4,
      completed: 1,
      inProgress: 2,
      notStarted: 1,
    });
  });

  it('returns null summary and empty rows for unknown modules', () => {
    const members = [member('u-1', 'Ann', [])];
    expect(summarizeAssignment('nope', members)).toBeNull();
    expect(assignmentStudentRows('nope', members)).toEqual([]);
  });

  it('handles empty membership honestly', () => {
    const summary = summarizeAssignment('skin', []);
    expect(summary).toMatchObject({
      totalMembers: 0,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
    });
    expect(assignmentStudentRows('skin', [])).toEqual([]);
  });

  it('sorts by completion deterministically (status, percent, name, userId)', () => {
    const skin = buildLearningModules().find(m => m.key === 'skin')!;
    const [first] = skin.structureKeys;
    const members = [
      member('u-c', null, [...skin.structureKeys]),
      member('u-b', 'Bo', [first]),
      member('u-a', 'Bo', [first]),
      member('u-n', 'Zed', []),
    ];
    const rows = assignmentStudentRows('skin', members, 'completion');
    expect(rows.map(r => r.userId)).toEqual(['u-c', 'u-a', 'u-b', 'u-n']);
    expect(rows.map(r => r.status)).toEqual([
      'complete',
      'in-progress',
      'in-progress',
      'not-started',
    ]);
    expect(rows[1]).toMatchObject({ studied: 1, total: 2, percent: 50 });
  });

  it('sorts by name with nulls last and userId tiebreak', () => {
    const members = [
      member('u-2', 'Bo', []),
      member('u-1', 'Bo', []),
      member('u-3', null, []),
      member('u-0', 'Ann', []),
    ];
    const rows = assignmentStudentRows('skin', members, 'name');
    expect(rows.map(r => r.userId)).toEqual(['u-0', 'u-1', 'u-2', 'u-3']);
  });

  it('exposes text status labels (never color-only)', () => {
    expect(ASSIGNMENT_STATUS_LABEL).toEqual({
      complete: 'Completed',
      'in-progress': 'In progress',
      'not-started': 'Not started',
    });
  });
});
