import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  archiveCohort,
  createCohort,
  getCohort,
  joinCohort,
  leaveCohort,
  listCohortMembers,
  listMyCohorts,
  regenerateInvite,
  removeCohortMember,
  updateCohort,
} from '@/lib/cohorts';

export function cohortsKey(userId: string | undefined): readonly unknown[] {
  return ['cohorts', 'mine', userId ?? 'anonymous'] as const;
}

export function cohortKey(userId: string | undefined, id: string): readonly unknown[] {
  return ['cohorts', 'detail', userId ?? 'anonymous', id] as const;
}

export function cohortMembersKey(userId: string | undefined, id: string): readonly unknown[] {
  return ['cohorts', 'members', userId ?? 'anonymous', id] as const;
}

/**
 * Managers are cohort owners plus global admins (the backend reports
 * myRole OWNER for both). Everyone else — including TEACHER members of
 * someone else's cohort — is read-only here; the backend enforces 403.
 */
export function canManageCohort(myRole: string | null, globalRole: string | undefined): boolean {
  return myRole === 'OWNER' || globalRole === 'ADMIN';
}

export function useMyCohorts() {
  const { user, status } = useAuth();
  return useQuery({
    queryKey: cohortsKey(user?.id),
    queryFn: listMyCohorts,
    enabled: status === 'authenticated',
    retry: false,
    staleTime: 30_000,
  });
}

export function useCohort(id: string | undefined) {
  const { user, status } = useAuth();
  return useQuery({
    queryKey: cohortKey(user?.id, id ?? ''),
    queryFn: () => getCohort(id as string),
    enabled: status === 'authenticated' && !!id,
    retry: false,
    staleTime: 30_000,
  });
}

export function useCohortMembers(id: string | undefined) {
  const { user, status } = useAuth();
  return useQuery({
    queryKey: cohortMembersKey(user?.id, id ?? ''),
    queryFn: () => listCohortMembers(id as string),
    enabled: status === 'authenticated' && !!id,
    retry: false,
    staleTime: 30_000,
  });
}

function invalidateCohortLists(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined
) {
  queryClient.invalidateQueries({ queryKey: cohortsKey(userId) });
}

export function useCreateCohort() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: { name: string; institutionLabel?: string }) => createCohort(input),
    onSuccess: () => {
      invalidateCohortLists(queryClient, user?.id);
    },
  });
}

export function useJoinCohort() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (inviteCode: string) => joinCohort(inviteCode),
    onSuccess: () => {
      invalidateCohortLists(queryClient, user?.id);
    },
  });
}

export function useUpdateCohort(id: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: { name?: string; institutionLabel?: string }) => updateCohort(id, input),
    onSuccess: data => {
      queryClient.setQueryData(cohortKey(user?.id, id), data);
      invalidateCohortLists(queryClient, user?.id);
    },
  });
}

export function useArchiveCohort(id: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: () => archiveCohort(id),
    onSuccess: data => {
      queryClient.setQueryData(cohortKey(user?.id, id), data);
      invalidateCohortLists(queryClient, user?.id);
    },
  });
}

export function useRegenerateInvite(id: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: () => regenerateInvite(id),
    onSuccess: () => {
      invalidateCohortLists(queryClient, user?.id);
    },
  });
}

export function useLeaveCohort(id: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: () => leaveCohort(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: cohortKey(user?.id, id) });
      queryClient.removeQueries({ queryKey: cohortMembersKey(user?.id, id) });
      invalidateCohortLists(queryClient, user?.id);
    },
  });
}

export function useRemoveMember(id: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (targetUserId: string) => removeCohortMember(id, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cohortMembersKey(user?.id, id) });
      queryClient.invalidateQueries({ queryKey: cohortKey(user?.id, id) });
    },
  });
}
