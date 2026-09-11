import { QueryClient } from '@tanstack/react-query';

/**
 * Shared query client. Server state only — no Redux, no second store.
 * All user-scoped keys embed the user id (see key factories below) so two
 * accounts can never read each other's cached rows.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 60_000,
    },
  },
});

/** Clears every cached row — called on logout and on account switch. */
export function clearCachedUserState(): void {
  queryClient.clear();
}

export function cohortListKey(userId: string | undefined): readonly unknown[] {
  return ['cohorts', 'list', userId ?? 'anonymous'] as const;
}

export function cohortDetailKey(userId: string | undefined, cohortId: string): readonly unknown[] {
  return ['cohorts', 'detail', userId ?? 'anonymous', cohortId] as const;
}

export function cohortMembersKey(userId: string | undefined, cohortId: string): readonly unknown[] {
  return ['cohorts', 'members', userId ?? 'anonymous', cohortId] as const;
}

export function progressSnapshotKey(userId: string | undefined): readonly unknown[] {
  return ['progress', 'snapshot', userId ?? 'anonymous'] as const;
}

export function quizAttemptsKey(userId: string | undefined): readonly unknown[] {
  return ['progress', 'attempts', userId ?? 'anonymous'] as const;
}
