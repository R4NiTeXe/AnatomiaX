import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider } from '@/features/auth/components/AuthProvider';
import AuthCallbackPage from '../pages/AuthCallbackPage';

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

const USER = { id: 'u1', email: 'a@b.c', name: null, role: 'STUDENT', createdAt: '2026-01-01' };

function renderCallback(entry: string, fetchImpl: (url: string) => Promise<Response>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  (global.fetch as unknown as jest.Mock) = jest.fn((url: string) => fetchImpl(url));
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/account" element={<div data-testid="account-page">account</div>} />
            <Route path="/cohorts" element={<div data-testid="cohorts-page">cohorts</div>} />
            <Route path="/human" element={<div data-testid="human-page">human</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const unauthorized = () => Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    process.env.VITE_API_BASE_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete (process.env as Record<string, string | undefined>).VITE_API_BASE_URL;
  });

  it('shows the provider error and a retry path', async () => {
    renderCallback('/auth/callback?error=access_denied&error_description=Denied+by+user', () =>
      unauthorized()
    );
    expect(await screen.findByTestId('callback-error')).toHaveTextContent('access_denied');
    expect(await screen.findByTestId('callback-status')).toHaveTextContent('Denied by user');
    expect(screen.getByTestId('callback-retry')).toBeInTheDocument();
  });

  it('routes a recovered session by database role (STUDENT → /human)', async () => {
    const userParam = encodeURIComponent(JSON.stringify(USER));
    renderCallback(
      `/auth/callback?accessToken=access-9&refreshToken=refresh-9&user=${userParam}`,
      url =>
        Promise.resolve(
          url.endsWith('/api/v1/auth/me') ? jsonResponse(USER) : jsonResponse({}, 404)
        )
    );
    expect(await screen.findByTestId('human-page')).toBeInTheDocument();
  });

  it('routes a teacher session to the teacher landing (/cohorts)', async () => {
    const teacher = { ...USER, role: 'TEACHER' };
    renderCallback('/auth/callback', url =>
      Promise.resolve(url.endsWith('/api/v1/auth/me') ? jsonResponse(teacher) : unauthorized())
    );
    expect(await screen.findByTestId('cohorts-page')).toBeInTheDocument();
  });

  it('navigates a recovered session to the requested next destination', async () => {
    renderCallback('/auth/callback?next=%2Fcohorts', url =>
      Promise.resolve(url.endsWith('/api/v1/auth/me') ? jsonResponse(USER) : unauthorized())
    );
    expect(await screen.findByTestId('cohorts-page')).toBeInTheDocument();
  });

  it('shows a notice when no session can be recovered', async () => {
    renderCallback('/auth/callback', () => unauthorized());
    await waitFor(() =>
      expect(screen.getByTestId('callback-status')).toHaveTextContent(
        'No Google session found. Please try again.'
      )
    );
    expect(screen.getByTestId('callback-retry')).toBeInTheDocument();
  });

  it('shows the redirecting state when already authenticated', async () => {
    // Child effects run before parent effects: the page's reload (/me #1)
    // hangs so navigation never fires, while the provider boot (/me #2)
    // flips status to authenticated and the redirecting state stays put.
    let meCalls = 0;
    renderCallback('/auth/callback', url => {
      if (!url.endsWith('/api/v1/auth/me')) return unauthorized();
      meCalls += 1;
      if (meCalls === 1) return new Promise(() => {}) as unknown as Promise<Response>;
      return Promise.resolve(jsonResponse(USER));
    });
    expect(await screen.findByTestId('callback-redirecting')).toBeInTheDocument();
  });
});
