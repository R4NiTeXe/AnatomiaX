import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider } from '../AuthProvider';
import RequireAuth from '../RequireAuth';

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

function renderAt(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <div data-testid="secret">secret</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<div data-testid="login-page">login</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
  });

  it('shows a loading state while the session resolves', async () => {
    (global.fetch as unknown as jest.Mock) = jest.fn(
      () => new Promise(() => {}) as unknown as Promise<Response>
    );
    renderAt('/account');
    expect(await screen.findByTestId('require-auth-loading')).toBeInTheDocument();
  });

  it('redirects anonymous users to /login and preserves the destination', async () => {
    (global.fetch as unknown as jest.Mock) = jest.fn((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/me')
          ? jsonResponse({ message: 'Unauthorized' }, 401)
          : (url as string).endsWith('/api/v1/auth/refresh')
            ? Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401))
            : Promise.resolve(jsonResponse({}, 404))
      )
    );
    renderAt('/account?tab=progress');
    expect(await screen.findByTestId('login-page', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('renders children for authenticated users', async () => {
    (global.fetch as unknown as jest.Mock) = jest.fn((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/me')
          ? jsonResponse(USER)
          : Promise.resolve(jsonResponse({}, 404))
      )
    );
    renderAt('/account');
    expect(await screen.findByTestId('secret', {}, { timeout: 4000 })).toBeInTheDocument();
  });
});
