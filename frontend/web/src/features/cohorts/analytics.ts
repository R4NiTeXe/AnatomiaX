import type { AnatomySystemKey } from '@anatomiax/shared-types';
import {
  buildLearningModules,
  moduleProgress,
  type LearningModule,
} from '@/features/progress/components/modules';
import type { CohortMemberProgress } from './api';

/**
 * Cohort assignment analytics (STEP 8.53).
 *
 * Minimal derived model — every value is mathematically derivable from the two
 * teacher-authorized queries (`GET :id/assignments` + `GET :id/progress`) and
 * the static module registry. No new endpoint, no new table, no invented
 * metrics. Completion follows the single canonical rule in
 * `moduleProgress`: a member is complete when EVERY structure of the module
 * is in their studiedKeys.
 */

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

/**
 * Summary counts for one assignment. Returns null when the moduleKey is not
 * in the static registry (honest unknown — callers render "unavailable").
 */
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

/**
 * Per-student rows for one assignment. Unknown modules yield [] (nothing to
 * derive). Sorting is total and deterministic: completion ranks
 * complete → in-progress → not-started, ties broken by percent desc, name,
 * userId; name sort is alphabetical with nulls last, ties by userId.
 */
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
