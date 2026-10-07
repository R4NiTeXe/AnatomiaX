import type { AnatomySystemKey } from '@anatomiax/shared-types';
import {
  buildLearningModules,
  moduleProgress,
  type LearningModule,
} from '@/features/progress/components/modules';
import type { CohortMemberProgress } from './api';

export type AssignmentMemberStatus = 'complete' | 'in-progress' | 'not-started';

export type AssignmentSort = 'completion' | 'name';

export interface AssignmentSummary {
  moduleKey: string;
  title: string;
  totalStructures: number;
  totalMembers: number;
  completed: number;
  inProgress: number;
  notStarted: number;
}

export interface AssignmentStudentRow {
  userId: string;
  name: string | null;
  role: 'TEACHER' | 'STUDENT';
  studied: number;
  total: number;
  percent: number;
  status: AssignmentMemberStatus;
}

export function moduleForAssignment(moduleKey: string): LearningModule | undefined {
  return buildLearningModules().find(m => m.key === (moduleKey as AnatomySystemKey));
}

function statusOf(
  module: LearningModule,
  studiedKeys: readonly string[]
): {
  status: AssignmentMemberStatus;
  studied: number;
  percent: number;
} {
  const progress = moduleProgress(module, studiedKeys);
  return { status: progress.status, studied: progress.studied, percent: progress.percent };
}

export function summarizeAssignment(
  moduleKey: string,
  members: readonly CohortMemberProgress[]
): AssignmentSummary | null {
  const module = moduleForAssignment(moduleKey);
  if (!module) return null;
  let completed = 0;
  let inProgress = 0;
  for (const member of members) {
    const { status } = statusOf(module, member.studiedKeys);
    if (status === 'complete') completed += 1;
    else if (status === 'in-progress') inProgress += 1;
  }
  return {
    moduleKey,
    title: module.title,
    totalStructures: module.totalStructures,
    totalMembers: members.length,
    completed,
    inProgress,
    notStarted: members.length - completed - inProgress,
  };
}

export function assignmentStudentRows(
  moduleKey: string,
  members: readonly CohortMemberProgress[],
  sort: AssignmentSort = 'completion'
): AssignmentStudentRow[] {
  const module = moduleForAssignment(moduleKey);
  if (!module) return [];
  const rows: AssignmentStudentRow[] = members.map(member => {
    const { status, studied, percent } = statusOf(module, member.studiedKeys);
    return {
      userId: member.userId,
      name: member.name,
      role: member.role,
      studied,
      total: module.totalStructures,
      percent,
      status,
    };
  });
  const byName = (a: AssignmentStudentRow, b: AssignmentStudentRow): number => {
    if (a.name === null && b.name === null) return a.userId.localeCompare(b.userId);
    if (a.name === null) return 1;
    if (b.name === null) return -1;
    const cmp = a.name.localeCompare(b.name);
    return cmp !== 0 ? cmp : a.userId.localeCompare(b.userId);
  };
  if (sort === 'name') {
    rows.sort(byName);
    return rows;
  }
  const rank: Record<AssignmentMemberStatus, number> = {
    complete: 0,
    'in-progress': 1,
    'not-started': 2,
  };
  rows.sort((a, b) => rank[a.status] - rank[b.status] || b.percent - a.percent || byName(a, b));
  return rows;
}

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentMemberStatus, string> = {
  complete: 'Completed',
  'in-progress': 'In progress',
  'not-started': 'Not started',
};
