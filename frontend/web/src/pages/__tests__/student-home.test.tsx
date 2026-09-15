import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { displayNameForStudiedKey } from '@/components/learning/StudiedStructures';
import { documentedCoverage } from '@/components/learning/coverage';
import AppShell from '@/components/layout/AppShell';
import HomePage from '../HomePage';
import LearnPage from '../LearnPage';

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

const USER_A = {
  id: 'u-a',
  email: 'a@x.test',
  name: 'Ada',
  role: 'STUDENT',
  createdAt: '2026-01-01',
};
const USER_B = {
  id: 'u-b',
  email: 'b@x.test',
  name: 'Bo',
  role: 'STUDENT',
  createdAt: '2026-01-02',
};
const KEY_HEART = 'male:cardiovascular:UBERON:0000948';
const KEY_SKIN = 'male:skin:UBERON:0002097';
const KEY_BRAIN = 'male:nervous:UBERON:0000955';

function attempt(id: string, userId: string, score: number, total: number, structureKey?: string) {
  return {
    id,
    userId,
    bodyModel: 'male',
    score,
    total,
    answers: structureKey ? [{ structureKey, selected: 0, correct: 0 }] : [],
    startedAt: null,
    completedAt: '2026-09-01T10:00:00.000Z',
  };
}

interface BackendOpts {
  user?: typeof USER_A | null;
  snapshotKeys?: string[];
  attempts?: ReturnType<typeof attempt>[];
  snapshotStatus?: number;
  attemptsStatus?: number;
}

function mockBackend({
  user,
  snapshotKeys = [],
  attempts = [],
  snapshotStatus = 200,
  attemptsStatus = 200,
}: BackendOpts) {
  const session = user
    ? { user, accessToken: `access-${user.id}`, refreshToken: `refresh-${user.id}` }
    : null;
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    const u = url as string;
    if (u.endsWith('/api/v1/auth/me')) {
      return Promise.resolve(
        user ? jsonResponse(user) : jsonResponse({ message: 'Unauthorized' }, 401)
      );
    }
    if (u.endsWith('/api/v1/auth/refresh')) {
      return Promise.resolve(
        session ? jsonResponse(session) : jsonResponse({ message: 'Unauthorized' }, 401)
      );
    }
    if (u.endsWith('/api/v1/auth/logout')) return Promise.resolve(jsonResponse({ status: 'ok' }));
    if (u.includes('/api/v1/progress/snapshot')) {
      if (snapshotStatus !== 200)
        return Promise.resolve(jsonResponse({ message: 'boom' }, snapshotStatus));
      return Promise.resolve(
        jsonResponse({
          userId: user?.id ?? 'u-a',
          studiedKeys: snapshotKeys,
          bodyModel: 'male',
          updatedAt: null,
        })
      );
    }
    if (u.includes('/api/v1/progress/quiz-attempts')) {
      if (attemptsStatus !== 200)
        return Promise.resolve(jsonResponse({ message: 'boom' }, attemptsStatus));
      return Promise.resolve(jsonResponse(attempts));
    }
    return Promise.resolve(jsonResponse({}, 404));
  });
}

function renderHome(path = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/learn" element={<LearnPage />} />
            </Route>
            <Route path="/human" element={<div data-testid="human-page">human</div>} />
            <Route path="/login" element={<div data-testid="login-page">login</div>} />
            <Route path="/register" element={<div data-testid="register-page">register</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  return { ...ui, client };
}

function renderLearn(path = '/learn') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/learn" element={<LearnPage />} />
            </Route>
            <Route path="/human" element={<div data-testid="human-page">human</div>} />
            <Route path="/login" element={<div data-testid="login-page">login</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  return { ...ui, client };
}

describe('student home/dashboard (8.20.3)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  it('shows a useful public home when unauthenticated (no private fetches)', async () => {
    mockBackend({ user: null });
    renderHome();
    expect(await screen.findByTestId('home-title', {}, { timeout: 4000 })).toHaveTextContent(
      /interactive 3D/i
    );
    expect(screen.getByTestId('home-cta-register')).toHaveAttribute('href', '/register');
    expect(screen.getByTestId('home-cta-login')).toHaveAttribute('href', '/login');
    expect(screen.getByTestId('home-cta-explore')).toHaveAttribute('href', '/human');
    expect(screen.queryByTestId('home-dashboard')).not.toBeInTheDocument();
    const urls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url as string);
    expect(urls.some(u => u.includes('/api/v1/progress/'))).toBe(false);
  });

  it('shows an authenticated dashboard with summary, latest score, and continue entry', async () => {
    mockBackend({
      user: USER_A,
      snapshotKeys: [KEY_HEART, KEY_SKIN],
      attempts: [attempt('att-1', 'u-a', 4, 5, KEY_HEART), attempt('att-2', 'u-a', 2, 5)],
    });
    renderHome();
    expect(await screen.findByTestId('home-dashboard', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByTestId('studied-count', {}, { timeout: 4000 })).toHaveTextContent(
      '2 structures studied'
    );
    expect(screen.getAllByTestId('studied-item')).toHaveLength(2);
    expect(await screen.findByTestId('quiz-latest', {}, { timeout: 4000 })).toHaveTextContent(
      'Latest score: 4 / 5'
    );
    const continueLink = await screen.findByTestId('continue-link', {}, { timeout: 4000 });
    expect(continueLink).toHaveAttribute('href', `/human?focus=${encodeURIComponent(KEY_HEART)}`);
  });

  it('routes studied + quiz links into /human focus navigation', async () => {
    mockBackend({
      user: USER_A,
      snapshotKeys: [KEY_SKIN],
      attempts: [attempt('att-1', 'u-a', 5, 5, KEY_BRAIN)],
    });
    renderHome();
    await screen.findByTestId('home-dashboard', {}, { timeout: 4000 });
    const studiedLinks = await screen.findAllByTestId('studied-open', {}, { timeout: 4000 });
    expect(studiedLinks[0]).toHaveAttribute('href', `/human?focus=${encodeURIComponent(KEY_SKIN)}`);
    expect(await screen.findByTestId('quiz-review', {}, { timeout: 4000 })).toHaveAttribute(
      'href',
      `/human?focus=${encodeURIComponent(KEY_BRAIN)}`
    );
  });

  it('shows empty states and a plain viewer entry when nothing is studied', async () => {
    mockBackend({ user: USER_A, snapshotKeys: [], attempts: [] });
    renderHome();
    await screen.findByTestId('home-dashboard', {}, { timeout: 4000 });
    expect(await screen.findByTestId('studied-empty', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByTestId('quiz-empty', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByTestId('continue-link', {}, { timeout: 4000 })).toHaveAttribute(
      'href',
      '/human'
    );
    expect(screen.getByTestId('home-next-action')).toHaveTextContent(/select any structure/i);
    expect(screen.getByTestId('home-review-link')).toHaveAttribute('href', '/learn');
  });

  it('shows a mastery strip and names the next structure to continue with', async () => {
    const keys = [KEY_HEART, KEY_SKIN];
    mockBackend({
      user: USER_A,
      snapshotKeys: keys,
      attempts: [attempt('att-1', 'u-a', 4, 5, KEY_HEART)],
    });
    renderHome();
    await screen.findByTestId('home-dashboard', {}, { timeout: 4000 });
    const expected = documentedCoverage(keys, 'male');
    expect(await screen.findByTestId('home-mastery', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('home-mastery-coverage-value')).toHaveTextContent(
      `${expected.percent}%`
    );
    expect(screen.getByTestId('home-mastery-studied')).toHaveTextContent('2');
    expect(screen.getByTestId('home-continue-title')).toHaveTextContent(
      displayNameForStudiedKey(KEY_HEART)
    );
    expect(screen.getByTestId('home-next-action')).toHaveTextContent(/jump back into the viewer/i);
  });

  it('shows loading then error with retry for dashboard data', async () => {
    mockBackend({ user: USER_A, snapshotStatus: 500, attemptsStatus: 500 });
    renderHome();
    expect(await screen.findByTestId('studied-error', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('quiz-error')).toBeInTheDocument();
    // Retry recovers once the backend heals.
    mockBackend({ user: USER_A, snapshotKeys: [KEY_SKIN], attempts: [] });
    fireEvent.click(screen.getByTestId('studied-retry'));
    expect(await screen.findByTestId('studied-count', {}, { timeout: 4000 })).toHaveTextContent(
      '1 structure studied'
    );
  });

  it('keeps user A and B data isolated', async () => {
    const attemptsA = [attempt('att-a', 'u-a', 5, 5, KEY_HEART)];
    mockBackend({ user: USER_A, snapshotKeys: [KEY_HEART], attempts: attemptsA });
    const first = renderHome();
    await screen.findByTestId('home-dashboard', {}, { timeout: 4000 });
    expect(await screen.findByTestId('quiz-latest', {}, { timeout: 4000 })).toHaveTextContent(
      '5 / 5'
    );
    first.unmount();
    __resetAuthForTests();
    mockBackend({
      user: USER_B,
      snapshotKeys: [KEY_BRAIN],
      attempts: [attempt('att-b', 'u-b', 1, 5)],
    });
    renderHome();
    await screen.findByTestId('home-dashboard', {}, { timeout: 4000 });
    expect(await screen.findByTestId('quiz-latest', {}, { timeout: 4000 })).toHaveTextContent(
      '1 / 5'
    );
    expect(await screen.findByTestId('studied-count', {}, { timeout: 4000 })).toHaveTextContent(
      '1 structure studied'
    );
    const studiedHref = screen.getAllByTestId('studied-open')[0].getAttribute('href');
    expect(studiedHref).toContain(encodeURIComponent(KEY_BRAIN));
    expect(studiedHref).not.toContain(encodeURIComponent(KEY_HEART));
  });

  it('logout clears the private dashboard back to the public home', async () => {
    mockBackend({ user: USER_A, snapshotKeys: [KEY_SKIN], attempts: [] });
    function LogoutProbe() {
      const { logout } = useAuth();
      return (
        <button type="button" data-testid="probe-logout" onClick={() => logout()}>
          logout
        </button>
      );
    }
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <LogoutProbe />
            <HomePage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    await screen.findByTestId('home-dashboard', {}, { timeout: 4000 });
    // Settle in-flight progress fetches first so logout removal cannot be
    // repopulated by a late resolution.
    await screen.findByTestId('studied-count', {}, { timeout: 4000 });
    fireEvent.click(screen.getByTestId('probe-logout'));
    expect(await screen.findByTestId('home-cta-login', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByTestId('home-dashboard')).not.toBeInTheDocument();
    expect(client.getQueryData(['progress', 'snapshot', 'u-a'])).toBeUndefined();
    expect(client.getQueryData(['progress', 'attempts', 'u-a'])).toBeUndefined();
  });

  it('exposes semantic navigation with keyboard-focusable links', async () => {
    mockBackend({ user: null });
    renderHome();
    await screen.findByTestId('home-title', {}, { timeout: 4000 });
    const nav = screen.getByTestId('site-nav');
    expect(nav.tagName).toBe('NAV');
    expect(nav).toHaveAttribute('aria-label', 'Primary');
    for (const id of ['nav-home', 'nav-anatomy', 'nav-learn', 'nav-login']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(document.querySelector('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /interactive 3D/i })).toBeInTheDocument();
  });
});

describe('learn/progress surface (8.20.3)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  it('invites anonymous visitors to sign in without fetching private data', async () => {
    mockBackend({ user: null });
    renderLearn();
    expect(await screen.findByTestId('learn-anonymous', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('learn-cta-login')).toHaveAttribute('href', '/login');
    const urls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url as string);
    expect(urls.some(u => u.includes('/api/v1/progress/'))).toBe(false);
  });

  it('shows full studied list plus complete quiz history with review links', async () => {
    const attempts = [
      attempt('att-1', 'u-a', 4, 5, KEY_HEART),
      attempt('att-2', 'u-a', 3, 5),
      attempt('att-3', 'u-a', 5, 5, KEY_SKIN),
    ];
    mockBackend({ user: USER_A, snapshotKeys: [KEY_HEART, KEY_SKIN, KEY_BRAIN], attempts });
    renderLearn();
    expect(await screen.findByTestId('history-count', {}, { timeout: 4000 })).toHaveTextContent(
      '3 attempts'
    );
    expect(screen.getAllByTestId('studied-item')).toHaveLength(3);
    expect(screen.getAllByTestId('quiz-item')).toHaveLength(3);
    expect(screen.getAllByTestId('quiz-review')).toHaveLength(2);
    expect(screen.getByTestId('learn-continue-link')).toHaveAttribute(
      'href',
      `/human?focus=${encodeURIComponent(KEY_HEART)}`
    );
  });

  it('shows history errors with retry', async () => {
    mockBackend({ user: USER_A, snapshotKeys: [KEY_SKIN], attemptsStatus: 500 });
    renderLearn();
    expect(await screen.findByTestId('history-error', {}, { timeout: 4000 })).toBeInTheDocument();
    mockBackend({
      user: USER_A,
      snapshotKeys: [KEY_SKIN],
      attempts: [attempt('att-1', 'u-a', 2, 5)],
    });
    fireEvent.click(screen.getByTestId('history-retry'));
    expect(await screen.findByTestId('history-count', {}, { timeout: 4000 })).toHaveTextContent(
      '1 attempt'
    );
  });
});
