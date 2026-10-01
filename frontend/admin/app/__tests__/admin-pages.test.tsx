import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/components/auth-provider';
import OverviewPage from '../page';
import UsersPage from '../users/page';
import CohortsPage from '../cohorts/page';
import CohortDetailPage from '../cohorts/[id]/page';
import RootLayout, { metadata } from '../layout';
import { AdminShell } from '@/components/admin-shell';
import { CardDescription, CardFooter } from '@/components/ui/card';
import { AlertTitle } from '@/components/ui/alert';

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useParams: () => ({ id: 'c1' }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode; href: string }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    return React.createElement('a', props, props.children);
  },
}));

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

const ADMIN_USER = {
  id: 'admin-1',
  email: 'admin@x.test',
  name: 'Admin',
  role: 'ADMIN',
  createdAt: '2026-01-01',
};

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>{ui}</AuthProvider>
    </QueryClientProvider>
  );
}

function authedFetch(handler: (url: string) => Promise<Response>) {
  (global.fetch as unknown as jest.Mock) = jest.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/v1/auth/me')) return Promise.resolve(jsonResponse(ADMIN_USER));
    return handler(u);
  }) as unknown as typeof fetch;
}

describe('admin overview edge states', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders empty states when there is no recent activity', async () => {
    authedFetch(url =>
      Promise.resolve(
        (url as string).includes('/api/v1/admin/overview')
          ? jsonResponse({
              totalUsers: 0,
              byRole: { STUDENT: 0, TEACHER: 0, ADMIN: 1 },
              cohortCount: 0,
              archivedCohortCount: 1,
              recentUsers: [],
              recentCohorts: [],
            })
          : jsonResponse({}, 404)
      )
    );
    renderWithProviders(<OverviewPage />);
    expect(
      await screen.findByTestId('admin-recent-users-empty', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('admin-recent-cohorts-empty')).toBeInTheDocument();
  });

  it('renders em-dashes for invalid dates', async () => {
    authedFetch(url =>
      Promise.resolve(
        (url as string).includes('/api/v1/admin/overview')
          ? jsonResponse({
              totalUsers: 1,
              byRole: { STUDENT: 1, TEACHER: 0, ADMIN: 0 },
              cohortCount: 0,
              archivedCohortCount: 0,
              recentUsers: [
                {
                  id: 'u9',
                  email: null,
                  name: null,
                  role: 'STUDENT',
                  createdAt: 'not-a-date',
                },
              ],
              recentCohorts: [],
            })
          : jsonResponse({}, 404)
      )
    );
    renderWithProviders(<OverviewPage />);
    const list = await screen.findByTestId('admin-recent-users', {}, { timeout: 4000 });
    expect(list.textContent ?? '').toContain('—');
  });
});

describe('admin users pagination', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  const pageOf = (page: number, total: number) =>
    jsonResponse({
      items: Array.from({ length: 20 }, (_, i) => ({
        id: `u-${page}-${i}`,
        email: `u-${page}-${i}@x.test`,
        name: `User ${i}`,
        role: 'STUDENT',
        createdAt: new Date().toISOString(),
      })),
      total,
      page,
      limit: 20,
    });

  it('pages forward and back, disabling prev on page one', async () => {
    authedFetch(url =>
      Promise.resolve(
        url.includes('/api/v1/admin/users')
          ? pageOf(url.includes('page=2') ? 2 : 1, 45)
          : jsonResponse({}, 404)
      )
    );
    renderWithProviders(<UsersPage />);
    await screen.findByTestId('admin-users-table', {}, { timeout: 4000 });
    expect(screen.getByTestId('admin-users-prev')).toBeDisabled();
    expect(screen.getByTestId('admin-users-next')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('admin-users-next'));
    await waitFor(() => expect(screen.getByTestId('admin-users-prev')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('admin-users-prev'));
    await waitFor(() => expect(screen.getByTestId('admin-users-prev')).toBeDisabled());
  });

  it('shows the empty state when no users match', async () => {
    authedFetch(url =>
      Promise.resolve(
        url.includes('/api/v1/admin/users')
          ? jsonResponse({ items: [], total: 0, page: 1, limit: 20 })
          : jsonResponse({}, 404)
      )
    );
    renderWithProviders(<UsersPage />);
    expect(
      await screen.findByTestId('admin-users-empty', {}, { timeout: 4000 })
    ).toBeInTheDocument();
  });
});

describe('admin cohorts filtering', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('passes search and archived filters to the query', async () => {
    const seen: string[] = [];
    const cohort = {
      id: 'c1',
      name: 'Bio 101',
      institutionLabel: null,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      memberCount: 2,
    };
    authedFetch(url => {
      if (url.includes('/api/v1/admin/cohorts')) {
        seen.push(url);
        return Promise.resolve(jsonResponse({ items: [cohort], total: 1, page: 1, limit: 20 }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<CohortsPage />);
    await screen.findByTestId('admin-cohorts-table', {}, { timeout: 4000 });
    fireEvent.change(screen.getByTestId('admin-cohorts-search'), { target: { value: 'Bio' } });
    await waitFor(() => expect(seen.some(u => u.includes('search=Bio'))).toBe(true));
    fireEvent.change(screen.getByTestId('admin-cohorts-archived-filter'), {
      target: { value: 'true' },
    });
    await waitFor(() => expect(seen.some(u => u.includes('archived=true'))).toBe(true));
  });
});

describe('admin cohort detail errors', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the request id and retries on failure', async () => {
    let calls = 0;
    authedFetch(url => {
      if (url.includes('/api/v1/admin/cohorts/c1')) {
        calls += 1;
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Error',
          headers: { get: (n: string) => (n === 'x-request-id' ? 'req-c1' : null) },
          text: async () => JSON.stringify({ message: 'boom', requestId: 'req-c1' }),
        } as unknown as Response);
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<CohortDetailPage />);
    expect(
      await screen.findByTestId('admin-cohort-not-found', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('admin-cohort-error')).toHaveTextContent('req-c1');
    fireEvent.click(screen.getByTestId('admin-cohort-detail-retry'));
    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(2));
  });
});

describe('admin detail loading and plain errors', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a loading skeleton while the cohort loads', async () => {
    authedFetch(() => new Promise(() => {}) as unknown as Promise<Response>);
    renderWithProviders(<CohortDetailPage />);
    expect(await screen.findByTestId('admin-cohort-detail-loading')).toBeInTheDocument();
  });

  it('shows the error without a reference when none is provided', async () => {
    authedFetch(url =>
      Promise.resolve(
        (url as string).includes('/api/v1/admin/cohorts/c1')
          ? ({
              ok: false,
              status: 500,
              statusText: 'Error',
              headers: { get: () => null },
              text: async () => JSON.stringify({ message: 'boom' }),
            } as unknown as Response)
          : jsonResponse({}, 404)
      )
    );
    renderWithProviders(<CohortDetailPage />);
    const error = await screen.findByTestId('admin-cohort-error', {}, { timeout: 4000 });
    expect(error).toBeInTheDocument();
    expect(error.textContent ?? '').not.toContain('Ref:');
  });
});

describe('admin users avatar fallbacks', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back to name initial then question mark', async () => {
    authedFetch(url =>
      Promise.resolve(
        url.includes('/api/v1/admin/users')
          ? jsonResponse({
              items: [
                {
                  id: 'u1',
                  email: null,
                  name: 'Zed',
                  role: 'STUDENT',
                  createdAt: new Date().toISOString(),
                },
                {
                  id: 'u2',
                  email: null,
                  name: null,
                  role: 'STUDENT',
                  createdAt: new Date().toISOString(),
                },
              ],
              total: 2,
              page: 1,
              limit: 20,
            })
          : jsonResponse({}, 404)
      )
    );
    renderWithProviders(<UsersPage />);
    await screen.findByTestId('admin-users-table', {}, { timeout: 4000 });
    const emails = screen.getAllByTestId('admin-user-email');
    expect(emails).toHaveLength(2);
    for (const el of emails) expect(el).toHaveTextContent('—');
    expect(screen.getByTestId('admin-users-table').textContent).toContain('?');
  });

  it('shows the users error without a reference when none is provided', async () => {
    authedFetch(url =>
      Promise.resolve(
        url.includes('/api/v1/admin/users')
          ? ({
              ok: false,
              status: 500,
              statusText: 'Error',
              headers: { get: () => null },
              text: async () => JSON.stringify({ message: 'boom' }),
            } as unknown as Response)
          : jsonResponse({}, 404)
      )
    );
    renderWithProviders(<UsersPage />);
    const error = await screen.findByTestId('admin-users-error', {}, { timeout: 4000 });
    expect(error.textContent ?? '').not.toContain('Ref:');
  });
});

describe('admin cohorts pagination', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  const pageOf = (page: number, total: number) =>
    jsonResponse({
      items: Array.from({ length: 20 }, (_, i) => ({
        id: `c-${page}-${i}`,
        name: `Cohort ${i}`,
        institutionLabel: null,
        archivedAt: null,
        createdAt: new Date().toISOString(),
        memberCount: 1,
      })),
      total,
      page,
      limit: 20,
    });

  it('pages forward and back, disabling prev on page one', async () => {
    authedFetch(url =>
      Promise.resolve(
        url.includes('/api/v1/admin/cohorts')
          ? pageOf(url.includes('page=2') ? 2 : 1, 45)
          : jsonResponse({}, 404)
      )
    );
    renderWithProviders(<CohortsPage />);
    await screen.findByTestId('admin-cohorts-table', {}, { timeout: 4000 });
    expect(screen.getByTestId('admin-cohorts-prev')).toBeDisabled();
    fireEvent.click(screen.getByTestId('admin-cohorts-next'));
    await waitFor(() => expect(screen.getByTestId('admin-cohorts-prev')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('admin-cohorts-prev'));
    await waitFor(() => expect(screen.getByTestId('admin-cohorts-prev')).toBeDisabled());
  });
});

describe('admin shell chrome', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes app metadata and renders the root layout around children', () => {
    expect(metadata.title).toBe('AnatomiaX Admin');
    render(
      <RootLayout>
        <span data-testid="layout-child">child</span>
      </RootLayout>
    );
    expect(screen.getByTestId('layout-child')).toBeInTheDocument();
  });

  it('sign out revokes the session and returns to anonymous', async () => {
    const student = { ...ADMIN_USER, id: 's1', role: 'STUDENT' };
    let logoutCalls = 0;
    authedFetch(() => Promise.resolve(jsonResponse({}, 404)));
    (global.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/v1/auth/me')) return Promise.resolve(jsonResponse(student));
      if (u.includes('/api/v1/auth/logout')) {
        logoutCalls += 1;
        return Promise.resolve(jsonResponse({ status: 'ok' }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<AdminShell>inner</AdminShell>);
    const signOut = await screen.findByTestId('admin-logout', {}, { timeout: 4000 });
    fireEvent.click(signOut);
    await waitFor(() => expect(logoutCalls).toBe(1));
    await waitFor(() => expect(screen.queryByTestId('admin-logout')).not.toBeInTheDocument());
  });

  it('shows sign out on the unauthorized page for non-admin users', async () => {
    const student = { ...ADMIN_USER, id: 's1', role: 'STUDENT' };
    authedFetch(() => Promise.resolve(jsonResponse({}, 404)));
    (global.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/v1/auth/me')) return Promise.resolve(jsonResponse(student));
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<AdminShell>inner</AdminShell>);
    expect(
      await screen.findByTestId('admin-unauthorized', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('admin-logout')).toBeInTheDocument();
  });

  it('renders card and alert subcomponents', () => {
    render(
      <div>
        <CardDescription>desc</CardDescription>
        <CardFooter>foot</CardFooter>
        <AlertTitle>title</AlertTitle>
      </div>
    );
    expect(screen.getByText('desc')).toBeInTheDocument();
    expect(screen.getByText('foot')).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
  });
});
