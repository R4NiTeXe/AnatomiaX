/**
 * Cohort API — thin typed wrappers over the authed mobile request helper.
 * Mirrors the backend CohortView / CohortWithInvite / CohortMemberView shapes;
 * the server remains authoritative (role checks here are UX-only).
 */
import { authedRequest } from './auth';

export type CohortRole = 'STUDENT' | 'TEACHER';
export type CohortMyRole = CohortRole | 'OWNER' | null;

export interface CohortView {
  id: string;
  name: string;
  institutionLabel: string | null;
  archivedAt: string | null;
  createdAt: string;
  myRole: CohortMyRole;
}

export interface CohortWithInvite extends CohortView {
  inviteCode: string;
}

export interface CohortMemberView {
  userId: string;
  name: string | null;
  role: CohortRole;
  joinedAt: string;
}

/** UX-only gate: the backend (RolesGuard) is the real enforcement. */
export function canCreateCohort(role: string | null | undefined): boolean {
  return role === 'TEACHER' || role === 'ADMIN';
}

/** UX-only gate: owners manage their cohorts; admins manage any cohort. */
export function canManageCohort(
  view: CohortView | null | undefined,
  role: string | null | undefined
): boolean {
  if (!view) return false;
  return view.myRole === 'OWNER' || role === 'ADMIN';
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
  return authedRequest<CohortView>(`/api/v1/cohorts/${id}/archive`, { method: 'POST' });
}

export function regenerateInvite(id: string): Promise<CohortWithInvite> {
  return authedRequest<CohortWithInvite>(`/api/v1/cohorts/${id}/invite/regenerate`, {
    method: 'POST',
  });
}

export function leaveCohort(id: string): Promise<void> {
  return authedRequest<void>(`/api/v1/cohorts/${id}/leave`, { method: 'POST' });
}

export function listCohortMembers(id: string): Promise<CohortMemberView[]> {
  return authedRequest<CohortMemberView[]>(`/api/v1/cohorts/${id}/members`);
}

export function removeCohortMember(cohortId: string, userId: string): Promise<void> {
  return authedRequest<void>(`/api/v1/cohorts/${cohortId}/members/${userId}`, {
    method: 'DELETE',
  });
}
