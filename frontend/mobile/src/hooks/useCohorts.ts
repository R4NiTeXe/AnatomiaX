import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
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
} from '../api/cohorts';
import { cohortDetailKey, cohortListKey, cohortMembersKey } from '../query/client';

export function useMyCohorts() {
  const { user, status } = useAuth();
  return useQuery({
    queryKey: cohortListKey(user?.id),
    queryFn: listMyCohorts,
    enabled: status === 'authenticated',
  });
}

export function useCohort(cohortId: string) {
  const { user, status } = useAuth();
  return useQuery({
    queryKey: cohortDetailKey(user?.id, cohortId),
    queryFn: () => getCohort(cohortId),
    enabled: status === 'authenticated',
  });
}

export function useCohortMembers(cohortId: string) {
  const { user, status } = useAuth();
  return useQuery({
    queryKey: cohortMembersKey(user?.id, cohortId),
    queryFn: () => listCohortMembers(cohortId),
    enabled: status === 'authenticated',
  });
}

function useInvalidateCohorts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return (cohortId?: string) => {
    queryClient.invalidateQueries({ queryKey: cohortListKey(user?.id) });
    if (cohortId) {
      queryClient.invalidateQueries({ queryKey: cohortDetailKey(user?.id, cohortId) });
      queryClient.invalidateQueries({ queryKey: cohortMembersKey(user?.id, cohortId) });
    }
  };
}

export function useCreateCohort() {
  const invalidate = useInvalidateCohorts();
  return useMutation({
    mutationFn: (input: { name: string; institutionLabel?: string }) => createCohort(input),
    onSuccess: () => invalidate(),
  });
}

export function useJoinCohort() {
  const invalidate = useInvalidateCohorts();
  return useMutation({
    mutationFn: (inviteCode: string) => joinCohort(inviteCode),
    onSuccess: () => invalidate(),
  });
}

export function useLeaveCohort() {
  const invalidate = useInvalidateCohorts();
  return useMutation({
    mutationFn: (cohortId: string) => leaveCohort(cohortId),
    onSuccess: (_data, cohortId) => invalidate(cohortId),
  });
}

export function useUpdateCohort() {
  const invalidate = useInvalidateCohorts();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { name?: string; institutionLabel?: string };
    }) => updateCohort(id, input),
    onSuccess: (_data, variables) => invalidate(variables.id),
  });
}

export function useArchiveCohort() {
  const invalidate = useInvalidateCohorts();
  return useMutation({
    mutationFn: (cohortId: string) => archiveCohort(cohortId),
    onSuccess: (_data, cohortId) => invalidate(cohortId),
  });
}

export function useRegenerateInvite() {
  const invalidate = useInvalidateCohorts();
  return useMutation({
    mutationFn: (cohortId: string) => regenerateInvite(cohortId),
    onSuccess: (_data, cohortId) => invalidate(cohortId),
  });
}

export function useRemoveCohortMember() {
  const invalidate = useInvalidateCohorts();
  return useMutation({
    mutationFn: ({ cohortId, userId }: { cohortId: string; userId: string }) =>
      removeCohortMember(cohortId, userId),
    onSuccess: (_data, variables) => invalidate(variables.cohortId),
  });
}
