import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/components/auth-provider';
import AdminUserDetailPage from '../users/[id]/page';
import AuditLogsPage from '../audit-logs/page';

jest.mock('next/navigation', () => ({
  usePathname: () => '/users/u-1',
  useParams: () => ({ id: 'u-1' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
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

const DETAIL = {
  user: { id: 'u-1', email: 's@x.test', name: 'Stu', role: 'STUDENT', createdAt: '2026-01-01' },
  deactivatedAt: null,
  stats: { memberships: 1, quizAttempts: 2, cohortsCreated: 0 },
};

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>{ui}</AuthProvider>
    </QueryClientProvider>
  );
}

function authedFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  (global.fetch as unknown as jest.Mock) = jest.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/v1/auth/me')) return Promise.resolve(jsonResponse(ADMIN_USER));
    return handler(u, init);
  });
}

describe('admin user detail', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('renders safe detail without secrets and saves a role change', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    authedFetch((url, init) => {
      calls.push({ url, init });
      if (url.includes('/api/v1/admin/users/u-1') && !url.includes('/role')) {
        return Promise.resolve(jsonResponse(DETAIL));
      }
      if (url.includes('/role')) return Promise.resolve(jsonResponse(DETAIL));
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<AdminUserDetailPage />);
    expect(await screen.findByTestId('admin-user-email', {}, { timeout: 4000 })).toHaveTextContent(
      's@x.test'
    );
    expect(screen.queryByText(/secret|passwordHash/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('admin-user-role-select'), {
      target: { value: 'TEACHER' },
    });
    fireEvent.click(screen.getByTestId('admin-user-role-save'));
    await waitFor(() => expect(screen.getByTestId('admin-user-notice')).toBeInTheDocument());
    const roleCall = calls.find(c => c.url.includes('/role'));
    expect(roleCall?.init?.method).toBe('PATCH');
    expect(roleCall?.init?.body).toContain('TEACHER');
  });

  it('deactivates and surfaces backend refusal without crashing', async () => {
    authedFetch(url => {
      if (url.includes('/api/v1/admin/users/u-1') && !url.includes('/deactivate')) {
        return Promise.resolve(jsonResponse(DETAIL));
      }
      if (url.includes('/deactivate')) {
        return Promise.resolve(
          jsonResponse({ message: 'Cannot remove the last administrator' }, 409)
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<AdminUserDetailPage />);
    expect(
      await screen.findByTestId('admin-user-email', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('admin-user-deactivate'));
    expect(
      await screen.findByTestId('admin-user-action-error', {}, { timeout: 4000 })
    ).toHaveTextContent(/last administrator/i);
  });
});

describe('admin audit logs', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('lists entries without authentication material and paginates', async () => {
    authedFetch(url => {
      if (url.includes('/api/v1/admin/audit-logs')) {
        const u = new URL(url, 'http://localhost');
        const page = Number(u.searchParams.get('page') ?? '1');
        if (u.searchParams.get('action')) {
          return Promise.resolve(jsonResponse({ items: [], total: 0, page, limit: 20 }));
        }
        return Promise.resolve(
          jsonResponse({
            items:
              page === 1
                ? [
                    {
                      id: 'a1',
                      actorId: 'admin-1',
                      actorRole: 'ADMIN',
                      action: 'user.role.changed',
                      targetType: 'user',
                      targetId: 'u-1',
                      metadata: { from: 'STUDENT', to: 'TEACHER' },
                      createdAt: '2026-01-02T00:00:00Z',
                    },
                  ]
                : [],
            total: 1,
            page,
            limit: 20,
          })
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<AuditLogsPage />);
    expect(
      await screen.findByTestId('admin-audit-list', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('admin-audit-row')).toHaveTextContent('user.role.changed');
    expect(screen.queryByText(/password|refreshToken/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('admin-audit-action'), { target: { value: 'quiz.' } });
    await waitFor(() => expect(screen.getByTestId('admin-audit-empty')).toBeInTheDocument());
  });
});
