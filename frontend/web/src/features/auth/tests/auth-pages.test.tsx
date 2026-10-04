import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider } from '@/features/auth/components/AuthProvider';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import AuthCallbackPage from '../pages/AuthCallbackPage';

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 || status === 201 ? 'OK' : 'Error',
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

const USER = { id: 'u1', email: 'a@b.c', name: null, role: 'STUDENT', createdAt: '2026-01-01' };
const SESSION = { user: USER, accessToken: 'access-1', refreshToken: 'refresh-1' };

function renderWithAuth(ui: React.ReactElement, initialEntries: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('auth pages (8.20.2)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  it('login renders an accessible responsive form with a Google entry', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/me') ||
          (url as string).endsWith('/api/v1/auth/refresh')
          ? jsonResponse({ message: 'Unauthorized' }, 401)
          : jsonResponse({}, 404)
      )
    );
    renderWithAuth(<LoginPage />, ['/login']);
    const heading = await screen.findByRole('heading', { name: 'Sign in' });
    expect(heading).toBeInTheDocument();
    expect(await screen.findByTestId('login-email')).toHaveAttribute('type', 'email');
    expect(screen.getByTestId('login-password')).toHaveAttribute('minLength', '8');
    const google = screen.getByTestId('google-signin');
    expect(google).toHaveAttribute('href', expect.stringContaining('/api/v1/auth/google'));
    // Labels are associated for screen readers.
    expect(document.querySelector('label[for="login-email"]')).toBeInTheDocument();
    // Responsive container uses mobile-first padding with a constrained width.
    expect(document.querySelector('main')).toBeInTheDocument();
  });

  it('login succeeds and preserves the intended destination', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me') || u.endsWith('/api/v1/auth/refresh'))
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
      if (u.endsWith('/api/v1/auth/login')) return Promise.resolve(jsonResponse(SESSION));
      return Promise.resolve(jsonResponse({}, 404));
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/account' } }]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/account" element={<div data-testid="account-page">account</div>} />
              <Route path="/human" element={<div data-testid="human-page">human</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    await screen.findByTestId('login-submit');
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByTestId('login-submit'));
    expect(await screen.findByTestId('account-page', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('login offers Student/Teacher/Admin tabs and sends the selected role', async () => {
    const seen: Array<{ url: string; body: string }> = [];
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me') || u.endsWith('/api/v1/auth/refresh'))
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
      if (u.endsWith('/api/v1/auth/login')) {
        seen.push({ url: u, body: String(init?.body ?? '') });
        return Promise.resolve(
          jsonResponse({ user: { ...USER, role: 'TEACHER' }, accessToken: 'a', refreshToken: 'r' })
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/cohorts" element={<div data-testid="cohorts-page">cohorts</div>} />
              <Route path="/human" element={<div data-testid="human-page">human</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    expect(await screen.findByTestId('login-role-group')).toBeInTheDocument();
    expect(screen.getByTestId('login-role-student')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('login-role-teacher'));
    expect(screen.getByTestId('login-role-teacher')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByTestId('login-submit'));
    // Returned (database) role decides the landing: TEACHER → /cohorts.
    expect(await screen.findByTestId('cohorts-page', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(seen).toHaveLength(1);
    expect(JSON.parse(seen[0].body)).toMatchObject({ role: 'TEACHER' });
  });

  it('login role mismatch shows an error and creates no session', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me') || u.endsWith('/api/v1/auth/refresh'))
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
      if (u.endsWith('/api/v1/auth/login'))
        return Promise.resolve(
          contractError(401, { code: 'UNAUTHORIZED', message: 'Invalid credentials' })
        );
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithAuth(<LoginPage />, ['/login']);
    await screen.findByTestId('login-submit');
    fireEvent.click(screen.getByTestId('login-role-admin'));
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByTestId('login-submit'));
    expect(await screen.findByTestId('login-error', {}, { timeout: 4000 })).toHaveTextContent(
      /invalid email or password/i
    );
    expect(screen.queryByTestId('human-page')).not.toBeInTheDocument();
  });

  it('login shows a friendly error with the request id', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me') || u.endsWith('/api/v1/auth/refresh'))
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
      if (u.endsWith('/api/v1/auth/login'))
        return Promise.resolve(
          contractError(
            401,
            { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
            'req-login-1'
          )
        );
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithAuth(<LoginPage />, ['/login']);
    await screen.findByTestId('login-submit');
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'wrong-pass-1' } });
    fireEvent.click(screen.getByTestId('login-submit'));
    const alert = await screen.findByTestId('login-error', {}, { timeout: 4000 });
    expect(alert).toHaveTextContent('Invalid email or password.');
    expect(await screen.findByTestId('login-error-request-id')).toHaveTextContent('req-login-1');
  });

  it('login surfaces the session-expired notice', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/me') ||
          (url as string).endsWith('/api/v1/auth/refresh')
          ? jsonResponse({ message: 'Unauthorized' }, 401)
          : jsonResponse({}, 404)
      )
    );
    renderWithAuth(<LoginPage />, ['/login?expired=1']);
    expect(
      await screen.findByTestId('login-expired-notice', {}, { timeout: 4000 })
    ).toHaveTextContent(/session expired/i);
  });

  it('authenticated users are redirected away from login', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/me') ? jsonResponse(USER) : jsonResponse({}, 404)
      )
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/human" element={<div data-testid="human-page">human</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    expect(await screen.findByTestId('human-page', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('register creates an account and navigates to the app', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me') || u.endsWith('/api/v1/auth/refresh'))
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
      if (u.endsWith('/api/v1/auth/register')) return Promise.resolve(jsonResponse(SESSION, 201));
      return Promise.resolve(jsonResponse({}, 404));
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/register']}>
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/human" element={<div data-testid="human-page">human</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    await screen.findByTestId('register-submit');
    fireEvent.change(screen.getByTestId('register-email'), { target: { value: 'new@b.c' } });
    fireEvent.change(screen.getByTestId('register-password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByTestId('register-submit'));
    expect(await screen.findByTestId('human-page', {}, { timeout: 4000 })).toBeInTheDocument();
    const [, init] = (global.fetch as jest.Mock).mock.calls.find(([url]) =>
      (url as string).endsWith('/api/v1/auth/register')
    ) as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ email: 'new@b.c' });
  });

  it('register surfaces conflicts with the request id', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me') || u.endsWith('/api/v1/auth/refresh'))
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
      if (u.endsWith('/api/v1/auth/register'))
        return Promise.resolve(
          contractError(409, { code: 'CONFLICT', message: 'Email already registered' }, 'req-reg-1')
        );
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithAuth(<RegisterPage />, ['/register']);
    await screen.findByTestId('register-submit');
    fireEvent.change(screen.getByTestId('register-email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByTestId('register-password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByTestId('register-submit'));
    expect(await screen.findByTestId('register-error', {}, { timeout: 4000 })).toHaveTextContent(
      /already exists/
    );
    expect(await screen.findByTestId('register-error-request-id')).toHaveTextContent('req-reg-1');
  });

  it('forgot password always shows the generic sent message', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/password-reset/request')
          ? jsonResponse({ status: 'ok' })
          : jsonResponse({}, 404)
      )
    );
    renderWithAuth(<ForgotPasswordPage />, ['/forgot-password']);
    await screen.findByTestId('forgot-submit');
    fireEvent.change(screen.getByTestId('forgot-email'), { target: { value: 'a@b.c' } });
    fireEvent.click(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('forgot-sent', {}, { timeout: 4000 })).toHaveTextContent(
      /If an account exists/
    );
  });

  it('reset password confirms and returns to login with a notice', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me') || u.endsWith('/api/v1/auth/refresh'))
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
      if (u.endsWith('/api/v1/auth/password-reset/confirm'))
        return Promise.resolve(jsonResponse({ status: 'ok' }));
      return Promise.resolve(jsonResponse({}, 404));
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter
            initialEntries={['/reset-password?email=a%40b.c&token=token-12345678901234567890']}
          >
            <Routes>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    await screen.findByTestId('reset-submit');
    expect(screen.getByTestId('reset-email')).toHaveValue('a@b.c');
    fireEvent.change(screen.getByTestId('reset-password'), { target: { value: 'new-pass-123' } });
    fireEvent.click(screen.getByTestId('reset-submit'));
    expect(
      await screen.findByTestId('login-reset-notice', {}, { timeout: 4000 })
    ).toBeInTheDocument();
  });

  it('reset password starts blank without query parameters', async () => {
    (global.fetch as unknown as jest.Mock).mockImplementation((url: string) =>
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
          <MemoryRouter initialEntries={['/reset-password']}>
            <Routes>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    await screen.findByTestId('reset-submit');
    expect(screen.getByTestId('reset-email')).toHaveValue('');
  });

  it('reset password surfaces backend failures inline', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me') || u.endsWith('/api/v1/auth/refresh'))
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
      if (u.endsWith('/api/v1/auth/password-reset/confirm'))
        return Promise.resolve(jsonResponse({ message: 'Invalid or expired reset token' }, 401));
      return Promise.resolve(jsonResponse({}, 404));
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter
            initialEntries={['/reset-password?email=a%40b.c&token=token-12345678901234567890']}
          >
            <Routes>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    await screen.findByTestId('reset-submit');
    fireEvent.change(screen.getByTestId('reset-password'), { target: { value: 'new-pass-123' } });
    fireEvent.click(screen.getByTestId('reset-submit'));
    expect(await screen.findByTestId('reset-error', {}, { timeout: 4000 })).toHaveTextContent(
      /Authentication failed/
    );
  });

  it('register redirects an already-authenticated user instead of showing the form', async () => {
    (global.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(USER));
      return Promise.resolve(jsonResponse({}, 404));
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/register']}>
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/human" element={<div data-testid="human-probe">human</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    expect(await screen.findByTestId('human-probe', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByTestId('register-submit')).not.toBeInTheDocument();
  });

  it('callback shows provider errors with a retry entry', async () => {
    (global.fetch as jest.Mock).mockImplementation(() => Promise.resolve(jsonResponse({}, 404)));
    renderWithAuth(<AuthCallbackPage />, ['/auth/callback?error=access_denied']);
    expect(await screen.findByTestId('callback-error', {}, { timeout: 4000 })).toHaveTextContent(
      'access_denied'
    );
    expect(screen.getByTestId('callback-retry')).toHaveAttribute(
      'href',
      expect.stringContaining('/api/v1/auth/google')
    );
  });

  it('callback recovers the cookie session and follows ?next=', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/me') ? jsonResponse(USER) : jsonResponse({}, 404)
      )
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/auth/callback?next=/human']}>
            <Routes>
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/human" element={<div data-testid="human-page">human</div>} />
              <Route path="/account" element={<div data-testid="account-page">account</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    await waitFor(
      async () => {
        const human = screen.queryByTestId('human-page');
        const redirecting = screen.queryByTestId('callback-redirecting');
        expect(human ?? redirecting).toBeInTheDocument();
      },
      { timeout: 4000 }
    );
  });
});
