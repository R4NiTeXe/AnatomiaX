import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider } from '@/features/auth/components/AuthProvider';
import LearnPage from '../pages/LearnPage';

const USER = { id: 'u1', email: 'a@b.c', name: null, role: 'STUDENT', createdAt: '2026-01-01' };

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: () => 'application/json' },
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

function setup(fetchImpl: (url: string) => Promise<Response>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  (global.fetch as unknown as jest.Mock) = jest.fn((url: string) => fetchImpl(url));
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/learn']}>
          <LearnPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('LearnPage assigned modules', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    process.env.VITE_API_BASE_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete (process.env as Record<string, string | undefined>).VITE_API_BASE_URL;
  });

  it('shows an error with retry when assignments fail to load', async () => {
    let calls = 0;
    setup(url => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(USER));
      if (u.endsWith('/api/v1/cohorts/assignments/mine')) {
        calls += 1;
        return Promise.resolve(jsonResponse({ message: 'boom' }, 500));
      }
      if (u.endsWith('/api/v1/progress/snapshot'))
        return Promise.resolve(
          jsonResponse({ userId: 'u1', studiedKeys: [], bodyModel: null, updatedAt: null })
        );
      return Promise.resolve(jsonResponse({}, 404));
    });
    expect(
      await screen.findByTestId('learn-assigned-error', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('learn-assigned-retry'));
    await screen.findByTestId('learn-assigned-error', {}, { timeout: 4000 });
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});
