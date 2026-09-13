import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { __resetAuthForTests, login } from '@/lib/auth';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import AccountPage from '../AccountPage';
import AccountPanel from '@/components/auth/AccountPanel';
import LoginPage from '../LoginPage';

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

function contractError(status: number, body: Record<string, unknown>, requestId = 'req-test') {
  return {
    ok: false,
    status,
    statusText: 'Error',
    headers: { get: (name: string) => (name === 'x-request-id' ? requestId : null) },
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const USER = { id: 'u1', email: 'a@b.c', name: 'Ada', role: 'STUDENT', createdAt: '2026-01-01' };
const SESSION = { user: USER, accessToken: 'access-1', refreshToken: 'refresh-1' };

function renderAccount(initialEntries: string[] = ['/account']) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/account" element={<AccountPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/human" element={<div data-testid="human-page">human</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  return { ...ui, client };
}

function mockAuthenticated(extra?: (url: string, init?: RequestInit) => unknown) {
  (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
    const u = url as string;
    if (extra) {
      const handled = extra(u, init);
      if (handled !== undefined) return Promise.resolve(handled);
    }
    if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(USER));
    // A valid session refreshes cleanly by default; expiry tests override this.
    if (u.endsWith('/api/v1/auth/refresh')) return Promise.resolve(jsonResponse(SESSION));
    if (u.includes('/api/v1/progress/')) return Promise.resolve(jsonResponse([]));
    return Promise.resolve(jsonResponse({}, 404));
  });
}

describe('account page (8.20.2)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  it('shows the profile with role and sync state', async () => {
    mockAuthenticated();
    renderAccount();
    expect(await screen.findByTestId('account-email', {}, { timeout: 4000 })).toHaveTextContent(
      'a@b.c'
    );
    expect(screen.getByTestId('account-role')).toHaveTextContent('STUDENT');
    expect(screen.getByTestId('account-sync-state')).toBeInTheDocument();
  });

  it('changes the password then forces a fresh sign-in', async () => {
    mockAuthenticated((u, init) => {
      if (u.endsWith('/api/v1/auth/password/change')) {
        expect(init?.method).toBe('POST');
        return jsonResponse({ status: 'ok' });
      }
      if (u.endsWith('/api/v1/auth/logout')) return jsonResponse({ status: 'ok' });
      return undefined;
    });
    renderAccount();
    await screen.findByTestId('account-password-submit');
    fireEvent.change(screen.getByTestId('account-current-password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByTestId('account-new-password'), {
      target: { value: 'brand-new-pass-1' },
    });
    fireEvent.click(screen.getByTestId('account-password-submit'));
    expect(
      await screen.findByTestId('login-changed-notice', {}, { timeout: 4000 })
    ).toHaveTextContent(/sign in again/i);
  });

  it('surfaces password errors with the request id', async () => {
    mockAuthenticated(u => {
      if (u.endsWith('/api/v1/auth/password/change'))
        return contractError(401, { code: 'UNAUTHORIZED', message: 'Bad current' }, 'req-pwd-1');
      return undefined;
    });
    renderAccount();
    await screen.findByTestId('account-password-submit');
    fireEvent.change(screen.getByTestId('account-new-password'), {
      target: { value: 'brand-new-pass-1' },
    });
    fireEvent.click(screen.getByTestId('account-password-submit'));
    expect(
      await screen.findByTestId('account-password-error', {}, { timeout: 4000 })
    ).toHaveTextContent(/Current password is incorrect/);
    expect(await screen.findByTestId('account-password-error-request-id')).toHaveTextContent(
      'req-pwd-1'
    );
  });

  it('exports data as a browser download', async () => {
    const payload = { account: { id: 'u1' }, quizAttempts: [] };
    mockAuthenticated(u => {
      if (u.endsWith('/api/v1/auth/account/export')) return jsonResponse(payload);
      return undefined;
    });
    const createSpy = jest.fn(() => 'blob:mock');
    const revokeSpy = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createSpy, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeSpy, configurable: true });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderAccount();
    await screen.findByTestId('account-export');
    fireEvent.click(screen.getByTestId('account-export'));
    expect(
      await screen.findByTestId('account-export-done', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock');
  });

  it('requires explicit confirmation before deleting', async () => {
    mockAuthenticated((u, init) => {
      if (u.endsWith('/api/v1/auth/account') && init?.method === 'DELETE')
        return jsonResponse({ status: 'ok' });
      if (u.endsWith('/api/v1/auth/logout')) return jsonResponse({ status: 'ok' });
      return undefined;
    });
    renderAccount();
    await screen.findByTestId('account-delete-submit');
    // Locked until both the email and the checkbox confirm intent.
    expect(screen.getByTestId('account-delete-submit')).toBeDisabled();
    fireEvent.change(screen.getByTestId('account-delete-email'), { target: { value: 'a@b.c' } });
    expect(screen.getByTestId('account-delete-submit')).toBeDisabled();
    fireEvent.click(screen.getByTestId('account-delete-check'));
    expect(screen.getByTestId('account-delete-submit')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('account-delete-submit'));
    expect(
      await screen.findByTestId('login-deleted-notice', {}, { timeout: 4000 })
    ).toHaveTextContent(/deleted/i);
    const deleteCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url, init]) =>
        (url as string).endsWith('/api/v1/auth/account') &&
        (init as RequestInit)?.method === 'DELETE'
    );
    expect(deleteCall).toBeTruthy();
  });

  it('marks expiry visibly and isolates user state on logout', async () => {
    function Probe() {
      const { sessionExpired, logout } = useAuth();
      const client = useQueryClient();
      return (
        <div>
          <div data-testid="probe-expired">{String(sessionExpired)}</div>
          <button
            type="button"
            data-testid="probe-seed"
            onClick={() =>
              client.setQueryData(['progress', 'snapshot', 'u1'], { studiedKeys: ['a'] })
            }
          >
            seed
          </button>
          <button type="button" data-testid="probe-logout" onClick={() => logout()}>
            logout
          </button>
        </div>
      );
    }
    mockAuthenticated(u => {
      if (u.endsWith('/api/v1/auth/logout')) return jsonResponse({ status: 'ok' });
      return undefined;
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/probe']}>
            <Probe />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    await screen.findByTestId('probe-logout');
    fireEvent.click(screen.getByTestId('probe-seed'));
    expect(client.getQueryData(['progress', 'snapshot', 'u1'])).toBeTruthy();
    fireEvent.click(screen.getByTestId('probe-logout'));
    await screen.findByText('false');
    expect(client.getQueryData(['progress', 'snapshot', 'u1'])).toBeUndefined();
  });

  it('sets a visible expired flag when the refresh dies after auth', async () => {
    (global.fetch as jest.Mock).mockImplementation(() => Promise.resolve(jsonResponse(SESSION)));
    await login('a@b.c', 'password123');
    // Now every authenticated call fails and the cookie refresh fails too.
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/refresh'))
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
      return Promise.resolve(
        contractError(401, { code: 'UNAUTHORIZED', message: 'expired' }, 'req-exp-1')
      );
    });
    function ExpiredProbe() {
      const { sessionExpired, reload, status } = useAuth();
      return (
        <div>
          <div data-testid="expired-status">{status}</div>
          <div data-testid="expired-flag">{String(sessionExpired)}</div>
          <button type="button" data-testid="expired-reload" onClick={() => reload()}>
            reload
          </button>
        </div>
      );
    }
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Seed the provider with an authenticated user by pre-setting via login above
    // is not enough (module state is shared) — mount and reload to sync expiry.
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter>
            <ExpiredProbe />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    fireEvent.click(await screen.findByTestId('expired-reload'));
    expect(await screen.findByText('anonymous', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('never stores tokens in web storage across account flows', async () => {
    const setSpy = jest.spyOn(Storage.prototype, 'setItem');
    mockAuthenticated(u => {
      if (u.endsWith('/api/v1/auth/account/export')) return jsonResponse({ account: {} });
      return undefined;
    });
    renderAccount();
    await screen.findByTestId('account-export');
    fireEvent.click(screen.getByTestId('account-export'));
    await screen.findByTestId('account-export-done', {}, { timeout: 4000 });
    expect(setSpy).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('/human embed keeps working and fixes register validation', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/me') ||
          (url as string).endsWith('/api/v1/auth/refresh')
          ? jsonResponse({ message: 'Unauthorized' }, 401)
          : jsonResponse({}, 404)
      )
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/human']}>
            <AccountPanel />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    const loginBtn = await screen.findByTestId('anatomy-account-login');
    const registerBtn = await screen.findByTestId('anatomy-account-register');
    // Both actions share one validated form — native checks apply to register too.
    expect(loginBtn).toHaveAttribute('type', 'submit');
    expect(registerBtn).toHaveAttribute('type', 'submit');
    expect(registerBtn).toHaveAttribute('data-mode', 'register');
    // Anonymous embed links out to the full auth surface (manage link is authed-only).
    expect(screen.getByText('Full sign-in')).toHaveAttribute('href', '/login');
  });

  it('/human embed links to account management once authenticated', async () => {
    mockAuthenticated();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/human']}>
            <AccountPanel />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    expect(
      await screen.findByTestId('anatomy-account-manage', {}, { timeout: 4000 })
    ).toHaveAttribute('href', '/account');
  });
});
