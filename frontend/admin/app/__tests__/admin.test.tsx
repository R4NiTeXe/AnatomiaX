import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/components/auth-provider';
import OverviewPage from '../page';
import UsersPage from '../users/page';
import CohortsPage from '../cohorts/page';
import CohortDetailPage from '../cohorts/[id]/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useParams: () => ({ id: 'c1' }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode; href: string }) => {
    const React = require('react');
    // eslint-disable-next-line @next/next/no-html-link-for-pages
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

describe('admin overview', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/v1/auth/me')) return Promise.resolve(jsonResponse(ADMIN_USER));
      if (u.includes('/api/v1/admin/overview'))
        return Promise.resolve(
          jsonResponse({
            totalUsers: 10,
            byRole: { STUDENT: 6, TEACHER: 3, ADMIN: 1 },
            cohortCount: 4,
            archivedCohortCount: 1,
            recentUsers: [ADMIN_USER],
            recentCohorts: [
              {
                id: 'c1',
                name: 'Bio 101',
                archivedAt: null,
                createdAt: new Date().toISOString(),
                memberCount: 2,
                createdById: 'admin-1',
              },
            ],
          })
        );
      return Promise.resolve(jsonResponse({}, 404));
    }) as unknown as typeof fetch;
  });

  it('renders overview KPIs and recent lists', async () => {
    renderWithProviders(<OverviewPage />);
    expect(
      await screen.findByTestId('admin-overview-title', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(await screen.findByTestId('admin-kpi-users', {}, { timeout: 4000 })).toHaveTextContent(
      '10'
    );
    expect(screen.getByTestId('admin-kpi-roles')).toHaveTextContent('6 students');
    expect(screen.getByTestId('admin-kpi-cohorts')).toHaveTextContent('4');
    expect(
      await screen.findByTestId('admin-recent-users', {}, { timeout: 4000 })
    ).toBeInTheDocument();
  });

  it('shows loading then error with requestId', async () => {
    (global.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/v1/auth/me')) return Promise.resolve(jsonResponse(ADMIN_USER));
      if (u.includes('/api/v1/admin/overview'))
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Error',
          headers: { get: (n: string) => (n === 'x-request-id' ? 'req-overview-1' : null) },
          text: async () => JSON.stringify({ message: 'boom', requestId: 'req-overview-1' }),
        } as unknown as Response);
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<OverviewPage />);
    expect(
      await screen.findByTestId('admin-overview-error', {}, { timeout: 4000 })
    ).toBeInTheDocument();
  });

  it('8.20.18 error state offers retry that refetches overview', async () => {
    let overviewCalls = 0;
    (global.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/v1/auth/me')) return Promise.resolve(jsonResponse(ADMIN_USER));
      if (u.includes('/api/v1/admin/overview')) {
        overviewCalls += 1;
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Error',
          headers: { get: () => null },
          text: async () => JSON.stringify({ message: 'boom' }),
        } as unknown as Response);
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<OverviewPage />);
    const retry = await screen.findByTestId('admin-overview-retry', {}, { timeout: 4000 });
    expect(retry).toBeInTheDocument();
    const before = overviewCalls;
    fireEvent.click(retry);
    await waitFor(() => expect(overviewCalls).toBeGreaterThan(before));
  });
});

describe('admin users', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/v1/auth/me')) return Promise.resolve(jsonResponse(ADMIN_USER));
      if (u.includes('/api/v1/admin/users'))
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: 'u1',
                email: 'a@b.c',
                name: 'Ada',
                role: 'STUDENT',
                createdAt: new Date().toISOString(),
              },
            ],
            total: 1,
            page: 1,
            limit: 20,
          })
        );
      return Promise.resolve(jsonResponse({}, 404));
    }) as unknown as typeof fetch;
  });

  it('renders searchable user table with safe fields', async () => {
    renderWithProviders(<UsersPage />);
    expect(
      await screen.findByTestId('admin-users-title', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('admin-users-table', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('admin-user-email')).toHaveTextContent('a@b.c');
    expect(screen.queryByText('passwordHash')).not.toBeInTheDocument();
    // search
    const input = screen.getByTestId('admin-users-search');
    expect(input).toHaveAttribute('aria-label', 'Search users');
    fireEvent.change(input, { target: { value: 'Ada' } });
    expect(input).toHaveValue('Ada');
  });

  it('filters by role', async () => {
    renderWithProviders(<UsersPage />);
    await screen.findByTestId('admin-users-table', {}, { timeout: 4000 });
    const select = screen.getByTestId('admin-users-role-filter') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'TEACHER' } });
    expect(select.value).toBe('TEACHER');
  });

  it('8.20.18 error state offers retry that refetches users', async () => {
    let usersCalls = 0;
    (global.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/v1/auth/me')) return Promise.resolve(jsonResponse(ADMIN_USER));
      if (u.includes('/api/v1/admin/users')) {
        usersCalls += 1;
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Error',
          headers: { get: () => null },
          text: async () => JSON.stringify({ message: 'boom' }),
        } as unknown as Response);
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<UsersPage />);
    const retry = await screen.findByTestId('admin-users-retry', {}, { timeout: 4000 });
    expect(retry).toBeInTheDocument();
    const before = usersCalls;
    fireEvent.click(retry);
    await waitFor(() => expect(usersCalls).toBeGreaterThan(before));
  });
});

describe('admin cohorts', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/v1/auth/me')) return Promise.resolve(jsonResponse(ADMIN_USER));
      if (u.includes('/api/v1/admin/cohorts'))
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: 'c1',
                name: 'Bio 101',
                institutionLabel: 'Med',
                archivedAt: null,
                createdAt: new Date().toISOString(),
                memberCount: 2,
              },
            ],
            total: 1,
            page: 1,
            limit: 20,
          })
        );
      return Promise.resolve(jsonResponse({}, 404));
    }) as unknown as typeof fetch;
  });

  it('renders cohort table with archived filter and pagination', async () => {
    renderWithProviders(<CohortsPage />);
    expect(
      await screen.findByTestId('admin-cohorts-title', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('admin-cohorts-table', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('admin-cohort-name')).toHaveTextContent('Bio 101');
    const search = screen.getByTestId('admin-cohorts-search');
    expect(search).toHaveAttribute('aria-label', 'Search cohorts');
    fireEvent.change(search, { target: { value: 'Bio' } });
    expect(search).toHaveValue('Bio');
    const archived = screen.getByTestId('admin-cohorts-archived-filter');
    fireEvent.change(archived, { target: { value: 'true' } });
    expect((archived as HTMLSelectElement).value).toBe('true');
  });

  it('8.20.18 error state offers retry that refetches cohorts', async () => {
    let cohortsCalls = 0;
    (global.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/v1/auth/me')) return Promise.resolve(jsonResponse(ADMIN_USER));
      if (u.includes('/api/v1/admin/cohorts')) {
        cohortsCalls += 1;
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Error',
          headers: { get: () => null },
          text: async () => JSON.stringify({ message: 'boom' }),
        } as unknown as Response);
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<CohortsPage />);
    const retry = await screen.findByTestId('admin-cohorts-retry', {}, { timeout: 4000 });
    expect(retry).toBeInTheDocument();
    const before = cohortsCalls;
    fireEvent.click(retry);
    await waitFor(() => expect(cohortsCalls).toBeGreaterThan(before));
  });

  it('8.20.18 cohort detail error offers retry alongside back navigation', async () => {
    let detailCalls = 0;
    (global.fetch as unknown as jest.Mock).mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/v1/auth/me')) return Promise.resolve(jsonResponse(ADMIN_USER));
      if (u.includes('/api/v1/admin/cohorts/c1')) {
        detailCalls += 1;
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Error',
          headers: { get: () => null },
          text: async () => JSON.stringify({ message: 'boom' }),
        } as unknown as Response);
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<CohortDetailPage />);
    expect(
      await screen.findByTestId('admin-cohort-not-found', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    const retry = screen.getByTestId('admin-cohort-detail-retry');
    expect(retry).toBeInTheDocument();
    expect(screen.getByTestId('admin-cohort-back')).toBeInTheDocument();
    const before = detailCalls;
    fireEvent.click(retry);
    await waitFor(() => expect(detailCalls).toBeGreaterThan(before));
  });
});

describe('admin auth', () => {
  it('shows unauthorized for non-admin', async () => {
    const STUDENT = {
      id: 's1',
      email: 's@x.test',
      name: 'Sam',
      role: 'STUDENT',
      createdAt: '2026-01-01',
    };
    global.fetch = jest.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/v1/auth/me')) return Promise.resolve(jsonResponse(STUDENT));
      return Promise.resolve(jsonResponse({}, 404));
    }) as unknown as typeof fetch;
    renderWithProviders(<OverviewPage />);
    expect(
      await screen.findByTestId('admin-unauthorized', {}, { timeout: 4000 })
    ).toBeInTheDocument();
  });
});
