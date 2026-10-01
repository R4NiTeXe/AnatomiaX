import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider, useAuth } from '../auth-provider';

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

const USER = { id: 'u1', email: 'a@b.c', name: null, role: 'ADMIN', createdAt: '2026-01-01' };
const SESSION = { user: USER, accessToken: 'access-1', refreshToken: 'refresh-1' };

function Probe() {
  const { user, status, sessionExpired, login, logout, reload, dismissSessionNotice, register } =
    useAuth();
  return (
    <div>
      <span data-testid="probe-status">{status}</span>
      <span data-testid="probe-user">{user ? user.email : 'none'}</span>
      <span data-testid="probe-expired">{sessionExpired ? 'yes' : 'no'}</span>
      <button
        data-testid="probe-login"
        onClick={() => {
          void login('a@b.c', 'password123');
        }}
      >
        login
      </button>
      <button
        data-testid="probe-logout"
        onClick={() => {
          void logout();
        }}
      >
        logout
      </button>
      <button
        data-testid="probe-register"
        onClick={() => {
          void register('n@b.c', 'password123', 'Ned');
        }}
      >
        register
      </button>
      <button
        data-testid="probe-reload"
        onClick={() => {
          void reload();
        }}
      >
        reload
      </button>
      <button data-testid="probe-dismiss" onClick={dismissSessionNotice}>
        dismiss
      </button>
    </div>
  );
}

function renderProbe() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('admin AuthProvider', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    (global.fetch as unknown as jest.Mock) = jest.fn((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/me')
          ? jsonResponse({ message: 'Unauthorized' }, 401)
          : (url as string).endsWith('/api/v1/auth/refresh')
            ? Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401))
            : Promise.resolve(jsonResponse({}, 404))
      )
    );
  });

  afterEach(() => {
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_API_BASE_URL;
  });

  it('boots anonymous when no session exists', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('probe-status')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('probe-user')).toHaveTextContent('none');
  });

  it('login stores the session and logout clears it', async () => {
    (global.fetch as unknown as jest.Mock) = jest.fn((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/login')
          ? jsonResponse(SESSION)
          : (url as string).endsWith('/api/v1/auth/logout')
            ? jsonResponse({ status: 'ok' })
            : jsonResponse({ message: 'Unauthorized' }, 401)
      )
    );
    renderProbe();
    fireEvent.click(await screen.findByTestId('probe-login'));
    expect(await screen.findByText('a@b.c')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('probe-logout'));
    expect(await screen.findByText('none')).toBeInTheDocument();
  });

  it('marks the session expired on refresh failure, then dismiss clears it', async () => {
    (global.fetch as unknown as jest.Mock) = jest.fn((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/login')
          ? jsonResponse(SESSION)
          : jsonResponse({ message: 'Unauthorized' }, 401)
      )
    );
    renderProbe();
    fireEvent.click(await screen.findByTestId('probe-login'));
    expect(await screen.findByText('a@b.c')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('probe-reload'));
    await waitFor(() => expect(screen.getByTestId('probe-expired')).toHaveTextContent('yes'));
    fireEvent.click(screen.getByTestId('probe-dismiss'));
    await waitFor(() => expect(screen.getByTestId('probe-expired')).toHaveTextContent('no'));
  });

  it('register stores the session like login', async () => {
    (global.fetch as unknown as jest.Mock) = jest.fn((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/register')
          ? jsonResponse(SESSION, 201)
          : jsonResponse({ message: 'Unauthorized' }, 401)
      )
    );
    renderProbe();
    fireEvent.click(await screen.findByTestId('probe-register'));
    expect(await screen.findByText('a@b.c')).toBeInTheDocument();
  });

  it('useAuth throws outside the provider', () => {
    const Bad = () => {
      useAuth();
      return null;
    };
    expect(() => render(<Bad />)).toThrow('useAuth must be used within AuthProvider');
  });
});
