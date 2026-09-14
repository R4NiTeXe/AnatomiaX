/**
 * Cohorts API — thin typed wrappers over the authed request helper.
 * Mirrors GET/POST/PATCH/DELETE /api/v1/cohorts* exactly; the backend
 * stays authoritative on roles, invite codes, and archived-state rules.
 */
import { authedRequest } from './auth';

export type CohortRole = 'OWNER' | 'TEACHER' | 'STUDENT';

export interface CohortView {
  id: string;
  name: string;
  institutionLabel: string | null;
  archivedAt: string | null;
  createdAt: string;
  myRole: CohortRole | null;
}

export interface CohortWithInvite extends CohortView {
  inviteCode: string;
}

export interface CohortMemberView {
  userId: string;
  name: string | null;
  role: 'TEACHER' | 'STUDENT';
  joinedAt: string;
}

export function listMyCohorts(): Promise<CohortView[]> {
  return authedRequest<CohortView[]>('/api/v1/cohorts');
}

export function createCohort(input: {
  name: string;
  institutionLabel?: string;
}): Promise<CohortWithInvite> {
  return authedRequest<CohortWithInvite>('/api/v1/cohorts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function joinCohort(inviteCode: string): Promise<CohortView> {
  return authedRequest<CohortView>('/api/v1/cohorts/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  });
}

export function getCohort(id: string): Promise<CohortView> {
  return authedRequest<CohortView>(`/api/v1/cohorts/${id}`);
}

export function updateCohort(
  id: string,
  input: { name?: string; institutionLabel?: string }
): Promise<CohortView> {
  return authedRequest<CohortView>(`/api/v1/cohorts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function archiveCohort(id: string): Promise<CohortView> {
  return authedRequest<CohortView>(`/api/v1/cohorts/${id}/archive`, {
    method: 'POST',
  });
}

export function regenerateInvite(id: string): Promise<CohortWithInvite> {
  return authedRequest<CohortWithInvite>(`/api/v1/cohorts/${id}/invite/regenerate`, {
    method: 'POST',
  });
}

export function leaveCohort(id: string): Promise<void> {
  return authedRequest<void>(`/api/v1/cohorts/${id}/leave`, {
    method: 'POST',
  });
}

export function listCohortMembers(id: string): Promise<CohortMemberView[]> {
  return authedRequest<CohortMemberView[]>(`/api/v1/cohorts/${id}/members`);
}

export function removeCohortMember(id: string, userId: string): Promise<void> {
  return authedRequest<void>(`/api/v1/cohorts/${id}/members/${userId}`, {
    method: 'DELETE',
  });
}

export interface CohortMemberProgress {
  userId: string;
  name: string | null;
  role: 'TEACHER' | 'STUDENT';
  joinedAt: string;
  studiedKeys: string[];
  quizAttempts: Array<{
    id: string;
    score: number;
    total: number;
    bodyModel: string;
    completedAt: string;
  }>;
}

export function getCohortProgress(id: string): Promise<CohortMemberProgress[]> {
  return authedRequest<CohortMemberProgress[]>(`/api/v1/cohorts/${id}/progress`);
}
