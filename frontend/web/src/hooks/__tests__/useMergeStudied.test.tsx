import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { progressSnapshotKey, useMergeStudied } from '../useProgress';
import type { ProgressSnapshotRecord } from '@/lib/progress';

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

describe('useMergeStudied snapshot sync (8.43)', () => {
  beforeEach(() => {
    global.fetch = jest.fn((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse({}, 404));
      if (u.endsWith('/api/v1/progress/snapshot/studied'))
        return Promise.resolve(
          jsonResponse({
            userId: 'u-1',
            studiedKeys: ['b', 'a'],
            bodyModel: 'male',
            updatedAt: null,
          })
        );
      return Promise.resolve(jsonResponse({}, 404));
    }) as unknown as typeof fetch;
  });

  it('folds server keys into the snapshot cache without refetching it', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const key = progressSnapshotKey(undefined);
    client.setQueryData<ProgressSnapshotRecord>(key, {
      userId: 'u-1',
      studiedKeys: ['a'],
      bodyModel: null,
      updatedAt: null,
    });
    const { result } = renderHook(() => useMergeStudied(), { wrapper: wrapper(client) });
    result.current.mutate({ keys: ['b'], bodyModel: 'male' });
    await waitFor(() => {
      expect(client.getQueryData<ProgressSnapshotRecord>(key)?.studiedKeys).toEqual(['b', 'a']);
    });
    // No snapshot GET issued — sync came from the merge response alone.
    const gets = (global.fetch as jest.Mock).mock.calls.filter(([url]: [string]) =>
      (url as string).endsWith('/api/v1/progress/snapshot')
    );
    expect(gets).toHaveLength(0);
  });

  it('invalidates a missing cache instead of fabricating a record', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useMergeStudied(), { wrapper: wrapper(client) });
    result.current.mutate({ keys: ['b'], bodyModel: 'male' });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: progressSnapshotKey(undefined),
      });
    });
  });
});
