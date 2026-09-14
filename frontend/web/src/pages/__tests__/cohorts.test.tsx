import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import RequireAuth from '@/components/auth/RequireAuth';
import AppShell from '@/components/layout/AppShell';
import { friendlyCohortError } from '@/components/auth/friendlyAuthError';
import CohortDetailPage from '../CohortDetailPage';
import CohortsPage from '../CohortsPage';

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

function contractError(status: number, body: Record<string, unknown>, requestId = 'req-cohort-1') {
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

interface FakeMember {
  userId: string;
  name: string | null;
  role: 'TEACHER' | 'STUDENT';
  joinedAt: string;
}

interface FakeCohort {
  id: string;
  name: string;
  institutionLabel: string | null;
  inviteCode: string;
  archivedAt: string | null;
  createdById: string;
  members: FakeMember[];
}

let db: Map<string, FakeCohort>;
let codeSeq = 0;

function seedDb() {
  codeSeq = 0;
  db = new Map([
    [
      'c-A',
      {
        id: 'c-A',
        name: 'Bio 101',
        institutionLabel: 'Med School',
        inviteCode: 'invite-A',
        archivedAt: null,
        createdById: 't-a',
        members: [
          { userId: 't-a', name: 'Ada', role: 'TEACHER', joinedAt: '2026-01-01T00:00:00.000Z' },
          { userId: 's-1', name: 'Sam', role: 'STUDENT', joinedAt: '2026-01-02T00:00:00.000Z' },
        ],
      },
    ],
  ]);
}

function viewOf(c: FakeCohort, userId: string, globalRole: string) {
  const membership = c.members.find(m => m.userId === userId) ?? null;
  const ownerOrAdmin = c.createdById === userId || globalRole === 'ADMIN';
  return {
    id: c.id,
    name: c.name,
    institutionLabel: c.institutionLabel,
    archivedAt: c.archivedAt,
    createdAt: '2026-01-01T00:00:00.000Z',
    myRole: ownerOrAdmin ? 'OWNER' : (membership?.role ?? null),
  };
}

/** Backend-faithful fake: roles, 404-no-oracle, archived guards, invite secrecy. */
function mockBackend(me: typeof TEACHER_A) {
  const session = { user: me, accessToken: `access-${me.id}`, refreshToken: `refresh-${me.id}` };
  (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
    const u = url as string;
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(me));
    if (u.endsWith('/api/v1/auth/refresh')) return Promise.resolve(jsonResponse(session));
    if (u.endsWith('/api/v1/auth/logout')) return Promise.resolve(jsonResponse({ status: 'ok' }));
    if (!u.includes('/api/v1/cohorts')) return Promise.resolve(jsonResponse({}, 404));

    const path = u.slice(u.indexOf('/api/v1/cohorts') + '/api/v1/cohorts'.length);
    const isManager = (c: FakeCohort) => c.createdById === me.id || me.role === 'ADMIN';
    const isViewer = (c: FakeCohort) => isManager(c) || c.members.some(m => m.userId === me.id);

    if ((path === '' || path === '/') && method === 'GET') {
      const mine = [...db.values()].filter(c => c.members.some(m => m.userId === me.id));
      return Promise.resolve(jsonResponse(mine.map(c => viewOf(c, me.id, me.role))));
    }
    if ((path === '' || path === '/') && method === 'POST') {
      if (me.role !== 'TEACHER' && me.role !== 'ADMIN')
        return Promise.resolve(contractError(403, { code: 'FORBIDDEN', message: 'Forbidden' }));
      const id = `c-new-${db.size + 1}`;
      const created: FakeCohort = {
        id,
        name: body.name as string,
        institutionLabel: (body.institutionLabel as string) ?? null,
        inviteCode: `invite-new-${db.size + 1}`,
        archivedAt: null,
        createdById: me.id,
        members: [
          { userId: me.id, name: me.name, role: 'TEACHER', joinedAt: new Date().toISOString() },
        ],
      };
      db.set(id, created);
      return Promise.resolve(
        jsonResponse({ ...viewOf(created, me.id, me.role), inviteCode: created.inviteCode }, 201)
      );
    }
    if (path === '/join' && method === 'POST') {
      const found = [...db.values()].find(c => c.inviteCode === body.inviteCode);
      if (!found)
        return Promise.resolve(
          contractError(404, { code: 'NOT_FOUND', message: 'Invalid invite code' })
        );
      if (found.archivedAt)
        return Promise.resolve(
          contractError(403, { code: 'FORBIDDEN', message: 'Cohort is archived' })
        );
      if (found.members.some(m => m.userId === me.id))
        return Promise.resolve(
          contractError(409, { code: 'CONFLICT', message: 'Already a member' })
        );
      found.members.push({
        userId: me.id,
        name: me.name,
        role: 'STUDENT',
        joinedAt: new Date().toISOString(),
      });
      return Promise.resolve(jsonResponse(viewOf(found, me.id, me.role), 201));
    }
    const idMatch = path.match(/^\/([^/]+)(\/.*)?$/);
    const cohort = idMatch ? db.get(idMatch[1]) : undefined;
    const rest = idMatch?.[2] ?? '';
    if (!cohort)
      return Promise.resolve(
        contractError(404, { code: 'NOT_FOUND', message: 'Cohort not found' })
      );
    if (rest === '' && method === 'GET') {
      if (!isViewer(cohort))
        return Promise.resolve(
          contractError(404, { code: 'NOT_FOUND', message: 'Cohort not found' })
        );
      return Promise.resolve(jsonResponse(viewOf(cohort, me.id, me.role)));
    }
    if (rest === '' && method === 'PATCH') {
      if (!isViewer(cohort))
        return Promise.resolve(
          contractError(404, { code: 'NOT_FOUND', message: 'Cohort not found' })
        );
      if (!isManager(cohort))
        return Promise.resolve(
          contractError(403, { code: 'FORBIDDEN', message: 'Insufficient permissions' })
        );
      if (cohort.archivedAt)
        return Promise.resolve(
          contractError(403, { code: 'FORBIDDEN', message: 'Cohort is archived' })
        );
      if (typeof body.name === 'string') cohort.name = body.name;
      if (typeof body.institutionLabel === 'string')
        cohort.institutionLabel = body.institutionLabel;
      return Promise.resolve(jsonResponse(viewOf(cohort, me.id, me.role)));
    }
    if (rest === '/archive' && method === 'POST') {
      if (!isViewer(cohort))
        return Promise.resolve(
          contractError(404, { code: 'NOT_FOUND', message: 'Cohort not found' })
        );
      if (!isManager(cohort))
        return Promise.resolve(
          contractError(403, { code: 'FORBIDDEN', message: 'Insufficient permissions' })
        );
      cohort.archivedAt = new Date().toISOString();
      return Promise.resolve(jsonResponse(viewOf(cohort, me.id, me.role)));
    }
    if (rest === '/invite/regenerate' && method === 'POST') {
      if (!isViewer(cohort))
        return Promise.resolve(
          contractError(404, { code: 'NOT_FOUND', message: 'Cohort not found' })
        );
      if (!isManager(cohort))
        return Promise.resolve(
          contractError(403, { code: 'FORBIDDEN', message: 'Insufficient permissions' })
        );
      if (cohort.archivedAt)
        return Promise.resolve(
          contractError(403, { code: 'FORBIDDEN', message: 'Cohort is archived' })
        );
      codeSeq += 1;
      cohort.inviteCode = `invite-regen-${codeSeq}`;
      return Promise.resolve(
        jsonResponse({ ...viewOf(cohort, me.id, me.role), inviteCode: cohort.inviteCode })
      );
    }
    if (rest === '/leave' && method === 'POST') {
      const idx = cohort.members.findIndex(m => m.userId === me.id);
      if (idx === -1)
        return Promise.resolve(
          contractError(404, { code: 'NOT_FOUND', message: 'Cohort not found' })
        );
      cohort.members.splice(idx, 1);
      return Promise.resolve(jsonResponse({}, 201));
    }
    if (rest === '/members' && method === 'GET') {
      if (!isViewer(cohort))
        return Promise.resolve(
          contractError(404, { code: 'NOT_FOUND', message: 'Cohort not found' })
        );
      return Promise.resolve(
        jsonResponse(
          cohort.members.map(m => ({
            userId: m.userId,
            name: m.name,
            role: m.role,
            joinedAt: m.joinedAt,
          }))
        )
      );
    }
    const rmMatch = rest.match(/^\/members\/(.+)$/);
    if (rmMatch && method === 'DELETE') {
      if (!isViewer(cohort))
        return Promise.resolve(
          contractError(404, { code: 'NOT_FOUND', message: 'Cohort not found' })
        );
      if (!isManager(cohort))
        return Promise.resolve(
          contractError(403, { code: 'FORBIDDEN', message: 'Insufficient permissions' })
        );
      if (cohort.archivedAt)
        return Promise.resolve(
          contractError(403, { code: 'FORBIDDEN', message: 'Cohort is archived' })
        );
      const idx = cohort.members.findIndex(m => m.userId === rmMatch[1]);
      if (idx === -1)
        return Promise.resolve(
          contractError(404, { code: 'NOT_FOUND', message: 'Member not found' })
        );
      cohort.members.splice(idx, 1);
      return Promise.resolve(jsonResponse({}));
    }
    return Promise.resolve(jsonResponse({}, 404));
  });
}

function renderCohorts(initialEntries: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route element={<AppShell />}>
              <Route
                path="/cohorts"
                element={
                  <RequireAuth>
                    <CohortsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/cohorts/:id"
                element={
                  <RequireAuth>
                    <CohortDetailPage />
                  </RequireAuth>
                }
              />
            </Route>
            <Route path="/login" element={<div data-testid="login-page">login</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  return { ...ui, client };
}

describe('cohort error mapping', () => {
  it('maps 403/404/409 to cohort nouns with status + request id', () => {
    const forbidden = friendlyCohortError(
      new ApiError('Forbidden', { url: 'x', status: 403, requestId: 'r1' })
    );
    expect(forbidden.message).toMatch(/owner.*admin/i);
    expect(forbidden.requestId).toBe('r1');
    expect(friendlyCohortError(new ApiError('nf', { url: 'x', status: 404 })).message).toMatch(
      /Cohort not found/
    );
    expect(friendlyCohortError(new ApiError('cf', { url: 'x', status: 409 })).message).toMatch(
      /already a member/
    );
  });
});

describe('teacher cohorts (8.20.4)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    seedDb();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  it('lists my cohorts with role badges', async () => {
    mockBackend(TEACHER_A);
    renderCohorts(['/cohorts']);
    expect(await screen.findByTestId('cohorts-list', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('cohort-item')).toHaveTextContent('Bio 101');
    expect(screen.getByTestId('cohort-item')).toHaveTextContent('OWNER');
    expect(screen.getByTestId('cohort-open')).toHaveAttribute('href', '/cohorts/c-A');
  });

  it('shows an empty state for teachers without cohorts', async () => {
    mockBackend(TEACHER_B);
    renderCohorts(['/cohorts']);
    expect(await screen.findByTestId('cohorts-empty', {}, { timeout: 4000 })).toHaveTextContent(
      /No cohorts yet/
    );
  });

  it('shows loading then error with retry', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/me')
          ? jsonResponse(TEACHER_A)
          : (url as string).includes('/api/v1/cohorts')
            ? contractError(500, { code: 'SERVER_ERROR', message: 'boom' }, 'req-500')
            : jsonResponse({}, 404)
      )
    );
    renderCohorts(['/cohorts']);
    expect(await screen.findByTestId('cohorts-error', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByTestId('cohorts-error-request-id')).toHaveTextContent('req-500');
    mockBackend(TEACHER_A);
    fireEvent.click(screen.getByTestId('cohorts-retry'));
    expect(await screen.findByTestId('cohorts-list', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('creates a cohort and reveals the invite code once', async () => {
    mockBackend(TEACHER_A);
    renderCohorts(['/cohorts']);
    await screen.findByTestId('cohorts-list', {}, { timeout: 4000 });
    fireEvent.change(screen.getByTestId('cohort-create-name'), {
      target: { value: 'Anatomy Lab' },
    });
    fireEvent.change(screen.getByTestId('cohort-create-institution'), {
      target: { value: 'Med School' },
    });
    fireEvent.click(screen.getByTestId('cohort-create-submit'));
    const panel = await screen.findByTestId('cohort-created-invite', {}, { timeout: 4000 });
    expect(panel).toBeInTheDocument();
    expect(screen.getByTestId('cohort-created-code')).toHaveValue('invite-new-2');
    expect(screen.getByTestId('cohort-created-open')).toHaveAttribute('href', '/cohorts/c-new-2');
    expect(await screen.findByText('Anatomy Lab', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('manages an owned cohort: edit, regenerate, remove member', async () => {
    mockBackend(TEACHER_A);
    renderCohorts(['/cohorts/c-A']);
    expect(await screen.findByTestId('cohort-name', {}, { timeout: 4000 })).toHaveTextContent(
      'Bio 101'
    );
    expect(screen.getByTestId('cohort-role-badge')).toHaveTextContent('OWNER');
    expect(await screen.findAllByTestId('member-item', {}, { timeout: 4000 })).toHaveLength(2);

    fireEvent.change(screen.getByTestId('cohort-edit-name'), { target: { value: 'Bio 102' } });
    fireEvent.click(screen.getByTestId('cohort-edit-submit'));
    expect(
      await screen.findByTestId('cohort-edit-saved', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('cohort-name')).toHaveTextContent('Bio 102');

    fireEvent.click(screen.getByTestId('cohort-regenerate'));
    const firstCode = await screen.findByTestId('cohort-invite-code', {}, { timeout: 4000 });
    expect((firstCode as HTMLInputElement).value).toBe('invite-regen-1');
    fireEvent.click(screen.getByTestId('cohort-regenerate'));
    await screen.findByDisplayValue('invite-regen-2', {}, { timeout: 4000 });

    const removeButtons = screen.getAllByTestId('member-remove');
    expect(removeButtons).toHaveLength(1);
    fireEvent.click(removeButtons[0]);
    fireEvent.click(screen.getByTestId('member-remove'));
    await screen.findByText('Ada (you)', {}, { timeout: 4000 });
    expect(screen.queryByText('Sam')).not.toBeInTheDocument();
  });

  it('archives read-only: hides management, keeps leave', async () => {
    mockBackend(TEACHER_A);
    renderCohorts(['/cohorts/c-A']);
    await screen.findByTestId('cohort-name', {}, { timeout: 4000 });
    fireEvent.click(screen.getByTestId('cohort-archive'));
    fireEvent.click(screen.getByTestId('cohort-archive'));
    expect(
      await screen.findByTestId('cohort-archived-notice', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('cohort-edit-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cohort-regenerate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('member-remove')).not.toBeInTheDocument();
    expect(screen.getByTestId('cohort-leave')).toBeInTheDocument();
    expect(screen.getAllByTestId('member-item')).toHaveLength(2);
  });

  it('teacher B (non-owner member) sees no management controls', async () => {
    db.get('c-A')?.members.push({
      userId: 't-b',
      name: 'Bo',
      role: 'TEACHER',
      joinedAt: '2026-01-03T00:00:00.000Z',
    });
    mockBackend(TEACHER_B);
    renderCohorts(['/cohorts/c-A']);
    expect(await screen.findByTestId('cohort-name', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('cohort-role-badge')).toHaveTextContent('TEACHER');
    expect(screen.queryByTestId('cohort-edit-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cohort-regenerate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('member-remove')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cohort-archive')).not.toBeInTheDocument();
    expect(screen.getByTestId('cohort-leave')).toBeInTheDocument();
  });

  it('outsiders get the same not-found page (no oracle)', async () => {
    mockBackend(TEACHER_B);
    renderCohorts(['/cohorts/c-A']);
    expect(
      await screen.findByTestId('cohort-not-found', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('cohort-detail-error')).toHaveTextContent(/Cohort not found/);
  });
});

describe('student cohorts (8.20.4)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    seedDb();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  it('hides creation, joins by code, views without management', async () => {
    db.get('c-A')?.members.splice(1, 1);
    mockBackend(STUDENT_S);
    renderCohorts(['/cohorts']);
    await screen.findByTestId('cohorts-empty', {}, { timeout: 4000 });
    expect(screen.queryByTestId('cohort-create-name')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('cohort-join-code'), { target: { value: 'invite-A' } });
    fireEvent.click(screen.getByTestId('cohort-join-submit'));
    expect(await screen.findByTestId('cohort-name', {}, { timeout: 4000 })).toHaveTextContent(
      'Bio 101'
    );
    expect(screen.getByTestId('cohort-role-badge')).toHaveTextContent('STUDENT');
    expect(screen.queryByTestId('cohort-edit-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cohort-regenerate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('member-remove')).not.toBeInTheDocument();
  });

  it('rejects invalid codes and duplicate joins', async () => {
    mockBackend(STUDENT_S);
    renderCohorts(['/cohorts']);
    await screen.findByTestId('cohorts-list', {}, { timeout: 4000 });
    fireEvent.change(screen.getByTestId('cohort-join-code'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByTestId('cohort-join-submit'));
    expect(await screen.findByTestId('cohort-join-error', {}, { timeout: 4000 })).toHaveTextContent(
      /Cohort not found/
    );
    fireEvent.change(screen.getByTestId('cohort-join-code'), { target: { value: 'invite-A' } });
    fireEvent.click(screen.getByTestId('cohort-join-submit'));
    expect(await screen.findByTestId('cohort-join-error', {}, { timeout: 4000 })).toHaveTextContent(
      /already a member/
    );
  });

  it('leaves and loses access afterwards', async () => {
    mockBackend(STUDENT_S);
    const { client } = renderCohorts(['/cohorts/c-A']);
    await screen.findByTestId('cohort-name', {}, { timeout: 4000 });
    fireEvent.click(screen.getByTestId('cohort-leave'));
    fireEvent.click(screen.getByTestId('cohort-leave'));
    expect(await screen.findByTestId('cohorts-empty', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(client.getQueryData(['cohorts', 'detail', 's-1', 'c-A'])).toBeUndefined();
  });
});

describe('admin + isolation + shell (8.20.4)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    seedDb();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  it('grants admins operational management without membership', async () => {
    mockBackend(ADMIN_X);
    renderCohorts(['/cohorts/c-A']);
    expect(await screen.findByTestId('cohort-name', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('cohort-role-badge')).toHaveTextContent('OWNER');
    expect(screen.getByTestId('cohort-edit-name')).toBeInTheDocument();
    expect(screen.getByTestId('cohort-regenerate')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('cohort-edit-name'), {
      target: { value: 'Admin Renamed' },
    });
    fireEvent.click(screen.getByTestId('cohort-edit-submit'));
    expect(
      await screen.findByTestId('cohort-edit-saved', {}, { timeout: 4000 })
    ).toBeInTheDocument();
  });

  it('isolates users A and B', async () => {
    mockBackend(TEACHER_A);
    const first = renderCohorts(['/cohorts']);
    await screen.findByTestId('cohorts-list', {}, { timeout: 4000 });
    expect(screen.getByTestId('cohort-item')).toHaveTextContent('Bio 101');
    first.unmount();
    __resetAuthForTests();
    mockBackend(TEACHER_B);
    renderCohorts(['/cohorts']);
    expect(await screen.findByTestId('cohorts-empty', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText('Bio 101')).not.toBeInTheDocument();
  });

  it('clears cohort state on logout and guards routes', async () => {
    mockBackend(TEACHER_A);
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
          <MemoryRouter initialEntries={['/cohorts']}>
            <LogoutProbe />
            <Routes>
              <Route
                path="/cohorts"
                element={
                  <RequireAuth>
                    <CohortsPage />
                  </RequireAuth>
                }
              />
              <Route path="/login" element={<div data-testid="login-page">login</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    await screen.findByTestId('cohorts-list', {}, { timeout: 4000 });
    fireEvent.click(screen.getByTestId('probe-logout'));
    expect(await screen.findByTestId('login-page', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(client.getQueryData(['cohorts', 'mine', 't-a'])).toBeUndefined();
  });

  it('exposes semantic navigation with keyboard-focusable controls', async () => {
    mockBackend(TEACHER_A);
    renderCohorts(['/cohorts']);
    await screen.findByTestId('cohorts-title', {}, { timeout: 4000 });
    const nav = screen.getByTestId('site-nav');
    expect(nav.tagName).toBe('NAV');
    expect(screen.getByTestId('nav-cohorts')).toBeInTheDocument();
    expect(document.querySelector('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My Cohorts' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cohort name')).toBeInTheDocument();
  });
});
