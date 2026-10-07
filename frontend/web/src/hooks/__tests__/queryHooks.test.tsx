import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/features/auth/components/AuthProvider';
import { __resetAuthForTests } from '@/lib/auth';
import type { ProgressSnapshotRecord } from '@/features/progress/api';
import {
  progressSnapshotKey,
  useMergeStudied,
  useQuizHistory,
} from '@/features/progress/hooks/useProgress';
import {
  useCohort,
  useCohortAssignments,
  useCohortMembers,
  useCohortProgress,
  useMyAssignments,
} from '@/features/cohorts/hooks/useCohorts';

const USER = { id: 'u1', email: 'a@b.c', name: null, role: 'STUDENT', createdAt: '2026-01-01' };
const SESSION = { user: USER, accessToken: 'access-1', refreshToken: 'refresh-1' };

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe('query hooks (enabled gates and fallbacks)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    process.env.VITE_API_BASE_URL = 'http://localhost:3000';
    (global.fetch as unknown as jest.Mock) = jest.fn((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/login')) return Promise.resolve(jsonResponse(SESSION));
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(USER));
      return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
    });
  });

  afterEach(() => {
    delete (process.env as Record<string, string | undefined>).VITE_API_BASE_URL;
  });

  it('does not fetch cohort detail without an id', async () => {
    const client = newClient();
    const { result } = renderHook(() => useCohort(undefined), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.isPending).toBe(true));
    const calls = ((global.fetch as unknown as jest.Mock).mock.calls as Array<[string]>).map(
      ([url]) => url
    );
    expect(calls.some(url => url.includes('/api/v1/cohorts/') && !url.endsWith('/me'))).toBe(false);
  });

  it('builds anonymous detail keys when ids are missing', async () => {
    const client = newClient();
    renderHook(() => useCohort(undefined), { wrapper: wrapper(client) });
    renderHook(() => useCohortMembers(undefined), { wrapper: wrapper(client) });
    renderHook(() => useCohortProgress(undefined), { wrapper: wrapper(client) });
    renderHook(() => useCohortAssignments(undefined), { wrapper: wrapper(client) });
    await new Promise(resolve => setTimeout(resolve, 50));
    const calls = ((global.fetch as unknown as jest.Mock).mock.calls as Array<[string]>).map(
      ([url]) => url
    );
    expect(calls.some(url => url.includes('/api/v1/cohorts/') && !url.endsWith('/me'))).toBe(false);
  });

  it('keeps member/progress/assignment queries disabled when anonymous', async () => {
    (global.fetch as unknown as jest.Mock) = jest.fn(() =>
      Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401))
    );
    const client = newClient();
    renderHook(() => useCohortMembers('c1'), { wrapper: wrapper(client) });
    renderHook(() => useCohortProgress('c1'), { wrapper: wrapper(client) });
    renderHook(() => useMyAssignments(), { wrapper: wrapper(client) });
    renderHook(() => useCohortAssignments('c1'), { wrapper: wrapper(client) });
    await new Promise(resolve => setTimeout(resolve, 50));
    const calls = ((global.fetch as unknown as jest.Mock).mock.calls as Array<[string]>).map(
      ([url]) => url
    );
    expect(calls.some(url => url.includes('/api/v1/cohorts'))).toBe(false);
  });

  it.each([
    [Number.NaN, 100],
    [0, 1],
    [500, 100],
    [7.9, 7],
  ])('clamps history limit %p to %p', async (limit, expected) => {
    __resetAuthForTests();
    const client = newClient();
    const { result } = renderHook(() => ({ auth: useAuth(), query: useQuizHistory(limit) }), {
      wrapper: wrapper(client),
    });
    await act(async () => {
      await result.current.auth.login('a@b.c', 'password123');
    });
    await waitFor(() => {
      const calls = ((global.fetch as unknown as jest.Mock).mock.calls as Array<[string]>).map(
        ([url]) => url
      );
      expect(
        calls.some(url => url.endsWith(`/api/v1/progress/quiz-attempts?limit=${expected}`))
      ).toBe(true);
    });
  });

  it('merge invalidates when the snapshot cache is missing', async () => {
    const client = newClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => ({ auth: useAuth(), mutation: useMergeStudied() }), {
      wrapper: wrapper(client),
    });
    (global.fetch as unknown as jest.Mock) = jest.fn((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/login')) return Promise.resolve(jsonResponse(SESSION));
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(USER));
      if (u.endsWith('/api/v1/progress/snapshot/studied'))
        return Promise.resolve(
          jsonResponse({ userId: 'u1', studiedKeys: ['b'], bodyModel: 'male', updatedAt: null })
        );
      return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
    });
    await act(async () => {
      await result.current.auth.login('a@b.c', 'password123');
    });
    await act(async () => {
      result.current.mutation.mutate({ keys: ['b'] });
    });
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: progressSnapshotKey('u1'),
      })
    );
  });

  it('merge falls back to an empty list for non-array server keys', async () => {
    const client = newClient();
    const key = progressSnapshotKey('u1');
    const { result } = renderHook(() => ({ auth: useAuth(), mutation: useMergeStudied() }), {
      wrapper: wrapper(client),
    });
    (global.fetch as unknown as jest.Mock) = jest.fn((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/login')) return Promise.resolve(jsonResponse(SESSION));
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(USER));
      if (u.endsWith('/api/v1/progress/snapshot/studied'))
        return Promise.resolve(
          jsonResponse({ userId: 'u1', studiedKeys: 'nope', bodyModel: null, updatedAt: null })
        );
      return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
    });
    await act(async () => {
      await result.current.auth.login('a@b.c', 'password123');
    });
    client.setQueryData<ProgressSnapshotRecord>(key, {
      userId: 'u1',
      studiedKeys: ['a'],
      bodyModel: null,
      updatedAt: null,
    });
    await act(async () => {
      result.current.mutation.mutate({ keys: ['b'] });
    });
    await waitFor(() => {
      const cached = client.getQueryData<ProgressSnapshotRecord>(key);
      expect(cached?.studiedKeys).toEqual(['a']);
    });
  });
});
