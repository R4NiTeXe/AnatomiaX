import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider } from '@/features/auth/components/AuthProvider';
import CohortDetailPage from '../pages/CohortDetailPage';
import LearnPage from '../../progress/pages/LearnPage';

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

function contractError(status: number, body: Record<string, unknown>) {
  return {
    ok: false,
    status,
    statusText: 'Error',
    headers: { get: () => 'application/json' },
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

const STUDENT_S = {
  id: 's-1',
  email: 's@x.test',
  name: 'Sam',
  role: 'STUDENT',
  createdAt: '2026-01-01',
};

interface FakeCohort {
  id: string;
  name: string;
  institutionLabel: string | null;
  archivedAt: string | null;
  createdById: string;
  members: Array<{ userId: string; name: string | null; role: 'TEACHER' | 'STUDENT' }>;
}

let db: Map<string, FakeCohort>;
let assigned: Map<string, Array<{ id: string; moduleKey: string }>>;
let failAssign = false;

function seedDb() {
  failAssign = false;
  db = new Map([
    [
      'c-A',
      {
        id: 'c-A',
        name: 'Bio 101',
        institutionLabel: null,
        archivedAt: null,
        createdById: 't-a',
        members: [
          { userId: 't-a', name: 'Ada', role: 'TEACHER' },
          { userId: 's-1', name: 'Sam', role: 'STUDENT' },
        ],
      },
    ],
  ]);
  assigned = new Map([['c-A', []]]);
}

function mockBackend(me: typeof TEACHER_A) {
  const session = { user: me, accessToken: `a-${me.id}`, refreshToken: `r-${me.id}` };
  (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
    const u = url as string;
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(me));
    if (u.endsWith('/api/v1/auth/refresh')) return Promise.resolve(jsonResponse(session));
    if (u.includes('/api/v1/progress/snapshot'))
      return Promise.resolve(
        jsonResponse({ userId: me.id, studiedKeys: [], bodyModel: null, updatedAt: null })
      );
    if (u.includes('/api/v1/progress/quiz-attempts')) return Promise.resolve(jsonResponse([]));
    if (!u.includes('/api/v1/cohorts')) return Promise.resolve(jsonResponse({}, 404));

    const path = u.slice(u.indexOf('/api/v1/cohorts') + '/api/v1/cohorts'.length);
    if (path === '/assignments/mine' && method === 'GET') {
      const mine: Array<Record<string, unknown>> = [];
      for (const [cohortId, list] of assigned.entries()) {
        const cohort = db.get(cohortId);
        if (!cohort || !cohort.members.some(m => m.userId === me.id)) continue;
        for (const a of list) mine.push({ ...a, cohortId, cohortName: cohort.name });
      }
      return Promise.resolve(jsonResponse(mine));
    }
    const idMatch = path.match(/^\/([^/]+)(\/.*)?$/);
    const cohort = idMatch ? db.get(idMatch[1]) : undefined;
    const rest = idMatch?.[2] ?? '';
    if (!cohort) return Promise.resolve(contractError(404, { message: 'Cohort not found' }));
    const isManager = cohort.createdById === me.id || me.role === 'ADMIN';
    const isViewer = isManager || cohort.members.some(m => m.userId === me.id);
    if (rest === '/assignments' && method === 'GET') {
      if (!isViewer) return Promise.resolve(contractError(404, { message: 'Cohort not found' }));
      return Promise.resolve(jsonResponse(assigned.get(cohort.id) ?? []));
    }
    if (rest === '/assignments' && method === 'POST') {
      if (!isViewer) return Promise.resolve(contractError(404, { message: 'Cohort not found' }));
      if (!isManager)
        return Promise.resolve(contractError(403, { message: 'Insufficient permissions' }));
      if (cohort.archivedAt)
        return Promise.resolve(contractError(403, { message: 'Cohort is archived' }));
      if (failAssign)
        return Promise.resolve(contractError(500, { message: 'Database unavailable' }));
      const list = assigned.get(cohort.id) ?? [];
      const moduleKey = body.moduleKey as string;
      const existing = list.find(a => a.moduleKey === moduleKey);
      if (existing) return Promise.resolve(jsonResponse(existing));
      const row = { id: `a-${list.length + 1}`, moduleKey, assignedById: me.id };
      list.push(row);
      assigned.set(cohort.id, list);
      return Promise.resolve(jsonResponse(row, 201));
    }
    const unMatch = rest.match(/^\/assignments\/(.+)$/);
    if (unMatch && method === 'DELETE') {
      if (!isViewer) return Promise.resolve(contractError(404, { message: 'Cohort not found' }));
      if (!isManager)
        return Promise.resolve(contractError(403, { message: 'Insufficient permissions' }));
      const list = assigned.get(cohort.id) ?? [];
      const idx = list.findIndex(a => a.moduleKey === unMatch[1]);
      if (idx < 0) return Promise.resolve(contractError(404, { message: 'Assignment not found' }));
      list.splice(idx, 1);
      return Promise.resolve(jsonResponse({ status: 'ok' }));
    }
    if (rest === '' && method === 'GET') {
      if (!isViewer) return Promise.resolve(contractError(404, { message: 'Cohort not found' }));
      return Promise.resolve(
        jsonResponse({ ...cohort, myRole: isManager ? 'OWNER' : 'STUDENT', members: undefined })
      );
    }
    if (rest === '/members' && method === 'GET') {
      if (!isViewer) return Promise.resolve(contractError(404, { message: 'Cohort not found' }));
      return Promise.resolve(
        jsonResponse(cohort.members.map(m => ({ ...m, joinedAt: '2026-01-02T00:00:00.000Z' })))
      );
    }
    return Promise.resolve(jsonResponse({}, 404));
  });
}

function renderDetail(path = '/cohorts/c-A') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/cohorts/:id" element={<CohortDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function renderLearn() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/learn']}>
          <Routes>
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/human" element={<div data-testid="human-page">human</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('cohort assignments (8.52)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
    seedDb();
  });

  it('teacher assigns a module; duplicate stays idempotent', async () => {
    mockBackend(TEACHER_A);
    renderDetail();
    await screen.findByTestId('cohort-name', {}, { timeout: 4000 });
    expect(
      await screen.findByTestId('assignments-empty', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('assign-module-select'), {
      target: { value: 'nervous' },
    });
    fireEvent.click(screen.getByTestId('assign-module-submit'));
    expect(
      await screen.findByTestId('assignments-list', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('assignment-item')).toHaveLength(1);
    fireEvent.change(screen.getByTestId('assign-module-select'), {
      target: { value: 'nervous' },
    });
    fireEvent.click(screen.getByTestId('assign-module-submit'));
    await screen.findByTestId('assignments-list', {}, { timeout: 4000 });
    expect(screen.getAllByTestId('assignment-item')).toHaveLength(1);
  });

  it('failed assignment shows an honest error without fake state', async () => {
    mockBackend(TEACHER_A);
    failAssign = true;
    renderDetail();
    await screen.findByTestId('cohort-name', {}, { timeout: 4000 });
    await screen.findByTestId('assign-module-select', {}, { timeout: 4000 });
    fireEvent.change(screen.getByTestId('assign-module-select'), {
      target: { value: 'skin' },
    });
    fireEvent.click(screen.getByTestId('assign-module-submit'));
    expect(
      await screen.findByTestId('assignment-error', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('assignments-list')).not.toBeInTheDocument();
  });

  it('unassign requires confirm and removes the row', async () => {
    mockBackend(TEACHER_A);
    assigned.get('c-A')!.push({ id: 'a-1', moduleKey: 'skin' });
    renderDetail();
    await screen.findByTestId('assignments-list', {}, { timeout: 4000 });
    fireEvent.click(screen.getByTestId('assignment-unassign'));
    expect(screen.getByTestId('assignment-unassign')).toHaveTextContent('Confirm?');
    expect(screen.getByTestId('assignments-list')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('assignment-unassign'));
    await screen.findByTestId('assignments-empty', {}, { timeout: 4000 });
  });

  it('teacher assignment rows link to module study and dashboard progress (8.53)', async () => {
    mockBackend(TEACHER_A);
    assigned.get('c-A')!.push({ id: 'a-1', moduleKey: 'nervous' });
    renderDetail();
    await screen.findByTestId('assignments-list', {}, { timeout: 4000 });
    expect(screen.getByTestId('assignment-open')).toHaveAttribute('href', '/learn/nervous');
    expect(screen.getByTestId('assignment-progress')).toHaveAttribute(
      'href',
      '/cohorts/c-A/dashboard'
    );
  });

  it('student member sees a read-only assignment list', async () => {
    mockBackend(STUDENT_S);
    assigned.get('c-A')!.push({ id: 'a-1', moduleKey: 'nervous' });
    renderDetail();
    await screen.findByTestId('assignments-list', {}, { timeout: 4000 });
    expect(screen.queryByTestId('assign-module-select')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assignment-unassign')).not.toBeInTheDocument();
    expect(screen.getByTestId('assignment-open')).toHaveAttribute('href', '/learn/nervous');
    expect(screen.queryByTestId('assignment-progress')).not.toBeInTheDocument();
  });

  it('student Learn shows assigned modules with progress', async () => {
    mockBackend(STUDENT_S);
    assigned.get('c-A')!.push({ id: 'a-1', moduleKey: 'nervous' });
    renderLearn();
    expect(await screen.findByTestId('learn-assigned', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('learn-assigned-item')).toBeInTheDocument();
    expect(screen.getByTestId('learn-assigned-open')).toHaveAttribute('href', '/learn/nervous');
    expect(screen.getByTestId('learn-modules')).toBeInTheDocument();
  });

  it('student Learn hides the assigned section with no assignments', async () => {
    mockBackend(STUDENT_S);
    renderLearn();
    await screen.findByTestId('learn-modules', {}, { timeout: 4000 });
    expect(screen.queryByTestId('learn-assigned')).not.toBeInTheDocument();
  });
});
