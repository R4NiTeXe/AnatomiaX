import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import RequireAuth from '@/components/auth/RequireAuth';
import CohortDashboardPage from '../CohortDashboardPage';

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
function contractError(
  status: number,
  body: Record<string, unknown>,
  requestId = 'req-dashboard-1'
) {
  return {
    ok: false,
    status,
    statusText: 'Error',
    headers: { get: (name: string) => (name === 'x-request-id' ? requestId : null) },
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const TEACHER_A = {
  id: 't-a',
  email: 'a@x.test',
  name: 'Ada',
  role: 'TEACHER',
  createdAt: '2026-01-01',
};
const TEACHER_B = {
  id: 't-b',
  email: 'b@x.test',
  name: 'Bo',
  role: 'TEACHER',
  createdAt: '2026-01-01',
};
const STUDENT_S = {
  id: 's-1',
  email: 's@x.test',
  name: 'Sam',
  role: 'STUDENT',
  createdAt: '2026-01-01',
};
const ADMIN_X = {
  id: 'a-1',
  email: 'admin@x.test',
  name: 'Root',
  role: 'ADMIN',
  createdAt: '2026-01-01',
};

interface FakeCohort {
  id: string;
  name: string;
  institutionLabel: string | null;
  archivedAt: string | null;
  createdById: string;
  myRole: string | null;
}

interface FakeProgress {
  userId: string;
  name: string | null;
  role: string;
  joinedAt: string;
  studiedKeys: string[];
  quizAttempts: Array<{
    id: string;
    score: number;
    total: number;
    bodyModel: string;
    completedAt: string;
  }>;
}

let cohortStore: Map<string, FakeCohort>;
let progressStore: Map<string, FakeProgress[]>;

function seed() {
  cohortStore = new Map([
    [
      'c-A',
      {
        id: 'c-A',
        name: 'Bio 101',
        institutionLabel: 'Med School',
        archivedAt: null,
        createdById: 't-a',
        myRole: 'OWNER',
      },
    ],
    [
      'c-B',
      {
        id: 'c-B',
        name: 'Archived Bio',
        institutionLabel: null,
        archivedAt: '2026-09-01T00:00:00.000Z',
        createdById: 't-a',
        myRole: 'OWNER',
      },
    ],
  ]);
  progressStore = new Map([
    [
      'c-A',
      [
        {
          userId: 't-a',
          name: 'Ada',
          role: 'TEACHER',
          joinedAt: '2026-01-01T00:00:00.000Z',
          studiedKeys: ['male:skin:UBERON:0002097', 'male:cardiovascular:UBERON:0000948'],
          quizAttempts: [
            {
              id: 'att-1',
              score: 4,
              total: 5,
              bodyModel: 'male',
              completedAt: '2026-09-02T10:00:00.000Z',
            },
            {
              id: 'att-2',
              score: 5,
              total: 5,
              bodyModel: 'male',
              completedAt: '2026-09-01T10:00:00.000Z',
            },
          ],
        },
        {
          userId: 's-1',
          name: 'Sam',
          role: 'STUDENT',
          joinedAt: '2026-01-02T00:00:00.000Z',
          studiedKeys: ['male:nervous:UBERON:0000955'],
          quizAttempts: [
            {
              id: 'att-3',
              score: 2,
              total: 5,
              bodyModel: 'male',
              completedAt: '2026-09-03T10:00:00.000Z',
            },
          ],
        },
      ],
    ],
    ['c-B', []],
  ]);
}

function mockBackend(me: typeof TEACHER_A) {
  const session = { user: me, accessToken: `access-${me.id}`, refreshToken: `refresh-${me.id}` };
  (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
    const u = url as string;
    if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(me));
    if (u.endsWith('/api/v1/auth/refresh')) return Promise.resolve(jsonResponse(session));
    if (u.endsWith('/api/v1/auth/logout')) return Promise.resolve(jsonResponse({ status: 'ok' }));
    if (u.includes('/api/v1/progress/')) return Promise.resolve(jsonResponse({}, 404));
    if (!u.includes('/api/v1/cohorts')) return Promise.resolve(jsonResponse({}, 404));
    const path = u.slice(u.indexOf('/api/v1/cohorts') + '/api/v1/cohorts'.length);
    const idMatch = path.match(/^\/([^/]+)(\/.*)?$/);
    const id = idMatch ? idMatch[1] : null;
    const rest = idMatch ? (idMatch[2] ?? '') : '';
    if (!id) return Promise.resolve(jsonResponse({}, 404));
    const cohort = cohortStore.get(id);
    if (!cohort)
      return Promise.resolve(
        contractError(404, { code: 'NOT_FOUND', message: 'Cohort not found' })
      );
    // viewer check: mimic 404 for outsiders, but for test we allow TEACHER_A/B if they are owner or member; for simplicity, if me is TEACHER_B and cohort is c-A, treat as member with TEACHER role (non-owner)
    const isOwner = cohort.createdById === me.id;
    const isAdmin = me.role === 'ADMIN';
    const isMember =
      isOwner || isAdmin || (me.id === 't-b' && id === 'c-A') || (me.id === 's-1' && id === 'c-A');
    if (!isMember && !isOwner && !isAdmin)
      return Promise.resolve(
        contractError(404, { code: 'NOT_FOUND', message: 'Cohort not found' })
      );
    if (rest === '' && (init?.method ?? 'GET') === 'GET') {
      // myRole already in store, but adjust for viewer
      const myRole = isOwner || isAdmin ? 'OWNER' : me.role === 'TEACHER' ? 'TEACHER' : 'STUDENT';
      return Promise.resolve(
        jsonResponse({ ...cohort, myRole, createdAt: '2026-01-01T00:00:00.000Z' })
      );
    }
    if (rest === '/progress' && (init?.method ?? 'GET') === 'GET') {
      if (!isOwner && !isAdmin)
        return Promise.resolve(
          contractError(403, { code: 'FORBIDDEN', message: 'Insufficient permissions' })
        );
      const data = progressStore.get(id) ?? [];
      return Promise.resolve(jsonResponse(data));
    }
    return Promise.resolve(jsonResponse({}, 404));
  });
}

function renderDashboard(_me: typeof TEACHER_A, path = '/cohorts/c-A/dashboard') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/cohorts/:id/dashboard"
              element={
                <RequireAuth>
                  <CohortDashboardPage />
                </RequireAuth>
              }
            />
            <Route path="/cohorts" element={<div data-testid="cohorts-page">list</div>} />
            <Route path="/login" element={<div data-testid="login-page">login</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  return { ...ui, client };
}

describe('cohort dashboard (8.20.7)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    seed();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  it('teacher owner sees summary, member count, archived state, aggregate progress and member-progress', async () => {
    mockBackend(TEACHER_A);
    renderDashboard(TEACHER_A);
    expect(
      await screen.findByTestId('dashboard-cohort-name', {}, { timeout: 4000 })
    ).toHaveTextContent('Bio 101');
    expect(screen.getByTestId('dashboard-role-badge')).toHaveTextContent('OWNER');
    expect(screen.getByTestId('dashboard-member-count')).toHaveTextContent('2');
    expect(screen.getByTestId('dashboard-studied-total')).toHaveTextContent('3');
    expect(screen.getByTestId('dashboard-quizzes-total')).toHaveTextContent('3');
    expect(screen.getByTestId('dashboard-best')).toHaveTextContent('5 / 5');
    expect(
      await screen.findByTestId('dashboard-progress-list', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('dashboard-member-progress')).toHaveLength(2);
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(screen.getAllByTestId('dashboard-member-open')).toHaveLength(3);
    expect(screen.getByTestId('dashboard-activity-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('dashboard-activity-item')).toHaveLength(3);
  });

  it('non-owner teacher sees cohort data but progress 403 and no management', async () => {
    mockBackend(TEACHER_B);
    renderDashboard(TEACHER_B);
    expect(
      await screen.findByTestId('dashboard-cohort-name', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('dashboard-progress-denied', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-progress-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-member-progress')).not.toBeInTheDocument();
  });

  it('student is denied dashboard (UX 403)', async () => {
    mockBackend(STUDENT_S);
    renderDashboard(STUDENT_S);
    expect(
      await screen.findByTestId('dashboard-denied', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-progress-list')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-cohort-name')).toBeInTheDocument();
  });

  it('admin has operational access to any cohort dashboard', async () => {
    mockBackend(ADMIN_X);
    renderDashboard(ADMIN_X, '/cohorts/c-A/dashboard');
    expect(
      await screen.findByTestId('dashboard-cohort-name', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('dashboard-progress-list', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('dashboard-member-progress')).toHaveLength(2);
  });

  it('shows loading, error with retry, and empty states', async () => {
    // loading
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if ((url as string).endsWith('/api/v1/auth/me'))
        return Promise.resolve(jsonResponse(TEACHER_A));
      if ((url as string).includes('/api/v1/cohorts/c-A') && (url as string).endsWith('/progress'))
        return new Promise(() => {}) as unknown as Promise<Response>;
      if ((url as string).includes('/api/v1/cohorts/c-A'))
        return Promise.resolve(
          jsonResponse({
            id: 'c-A',
            name: 'Bio 101',
            institutionLabel: 'Med',
            archivedAt: null,
            createdAt: '2026-01-01',
            myRole: 'OWNER',
          })
        );
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderDashboard(TEACHER_A);
    expect(
      await screen.findByTestId('dashboard-progress-loading', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    // error
    mockBackend(TEACHER_A);
    // force progress error
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(TEACHER_A));
      if (u.includes('/api/v1/cohorts/c-A/progress'))
        return Promise.resolve(contractError(500, { message: 'boom' }, 'req-500'));
      if (u.includes('/api/v1/cohorts/c-A'))
        return Promise.resolve(
          jsonResponse({
            id: 'c-A',
            name: 'Bio 101',
            institutionLabel: 'Med',
            archivedAt: null,
            createdAt: '2026-01-01',
            myRole: 'OWNER',
          })
        );
      return Promise.resolve(jsonResponse({}, 404));
    });
    const { unmount } = renderDashboard(TEACHER_A);
    expect(
      await screen.findByTestId('dashboard-progress-error', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(await screen.findByTestId('dashboard-progress-error-request-id')).toHaveTextContent(
      'req-500'
    );
    mockBackend(TEACHER_A);
    fireEvent.click(screen.getByTestId('dashboard-progress-retry'));
    expect(
      await screen.findByTestId('dashboard-progress-list', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    unmount();
    // empty archived cohort
    mockBackend(TEACHER_A);
    renderDashboard(TEACHER_A, '/cohorts/c-B/dashboard');
    expect(
      await screen.findByTestId('dashboard-archived-notice', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('dashboard-activity-empty', {}, { timeout: 4000 })
    ).toBeInTheDocument();
  });

  it('archived shows read-only and still shows progress for owner', async () => {
    mockBackend(TEACHER_A);
    // make c-A archived
    cohortStore.set('c-A', {
      id: 'c-A',
      name: 'Bio 101',
      institutionLabel: 'Med School',
      archivedAt: '2026-09-10T00:00:00.000Z',
      createdById: 't-a',
      myRole: 'OWNER',
    });
    renderDashboard(TEACHER_A);
    expect(
      await screen.findByTestId('dashboard-archived-badge', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('dashboard-archived-notice', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('dashboard-progress-list', {}, { timeout: 4000 })
    ).toBeInTheDocument();
  });

  it('isolates cohort progress between cohorts and clears on logout', async () => {
    mockBackend(TEACHER_A);
    const first = renderDashboard(TEACHER_A, '/cohorts/c-A/dashboard');
    expect(
      await screen.findByTestId('dashboard-member-count', {}, { timeout: 4000 })
    ).toHaveTextContent('2');
    first.unmount();
    __resetAuthForTests();
    // switch to c-B which has 0 members progress
    mockBackend(TEACHER_A);
    renderDashboard(TEACHER_A, '/cohorts/c-B/dashboard');
    expect(
      await screen.findByTestId('dashboard-member-count', {}, { timeout: 4000 })
    ).toHaveTextContent('0');
    expect(
      await screen.findByTestId('dashboard-activity-empty', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    cleanup();
    seed();

    // logout clears cohort/progress cache (mirrors cohorts.test logout)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['cohorts', 'progress', 't-a', 'c-A'], [{ userId: 'x' }]);
    expect(client.getQueryData(['cohorts', 'progress', 't-a', 'c-A'])).toBeDefined();
    function LogoutProbe2() {
      const { logout } = useAuth();
      return (
        <button type="button" data-testid="probe-logout2" onClick={() => logout()}>
          logout
        </button>
      );
    }
    mockBackend(TEACHER_A);
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/cohorts']}>
            <LogoutProbe2 />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    await screen.findByTestId('probe-logout2', {}, { timeout: 4000 });
    fireEvent.click(screen.getByTestId('probe-logout2'));
    await new Promise(r => setTimeout(r, 150));
    expect(client.getQueryData(['cohorts', 'progress', 't-a', 'c-A'])).toBeUndefined();
    expect(client.getQueryData(['cohorts', 'mine', 't-a'])).toBeUndefined();
  });

  it('exposes semantic nav, headings, and keyboard focusable controls', async () => {
    mockBackend(TEACHER_A);
    renderDashboard(TEACHER_A);
    await screen.findByTestId('dashboard-cohort-name', {}, { timeout: 4000 });
    expect(screen.getByRole('heading', { name: 'Bio 101' })).toBeInTheDocument();
    expect(screen.getByTestId('site-nav')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0].focus();
    expect(document.activeElement).toBe(buttons[0]);
    expect(document.querySelector('main#main-content')).toBeInTheDocument();
  });
});
