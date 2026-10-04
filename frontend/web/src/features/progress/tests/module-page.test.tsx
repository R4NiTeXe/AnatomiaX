import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Route, Routes } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { renderWithAppProviders as render } from '@/test-utils';
import ModulePage from '../pages/ModulePage';

const USER_A = {
  id: 'u-a',
  email: 'a@x.test',
  name: 'Ada',
  role: 'STUDENT',
  createdAt: '2026-01-01',
};

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

function mockBackend({ user, snapshotKeys = [] }: { user: unknown; snapshotKeys?: string[] }) {
  const session = user ? { user, accessToken: 'access', refreshToken: 'refresh' } : null;
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
    if (u.includes('/api/v1/progress/snapshot')) {
      return Promise.resolve(
        jsonResponse({
          userId: 'u-a',
          studiedKeys: snapshotKeys,
          bodyModel: 'male',
          updatedAt: null,
        })
      );
    }
    if (u.includes('/api/v1/progress/quiz-attempts')) return Promise.resolve(jsonResponse([]));
    return Promise.resolve(jsonResponse({}, 404));
  });
}

function renderModule(path: string) {
  return render(
    <Routes>
      <Route path="/learn/:systemKey" element={<ModulePage />} />
    </Routes>,
    [path]
  );
}

describe('module page (8.49)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  it('renders module identity, progress, and structure deep-links', async () => {
    mockBackend({ user: USER_A, snapshotKeys: [] });
    renderModule('/learn/nervous');
    expect(await screen.findByTestId('module-title', {}, { timeout: 4000 })).toHaveTextContent(
      'Nervous'
    );
    expect(
      await screen.findByTestId('module-progress-text', {}, { timeout: 4000 })
    ).toHaveTextContent('0 of 12 structures studied');
    const links = await screen.findAllByTestId('module-structure-open', {}, { timeout: 4000 });
    expect(links.length).toBe(12);
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('/human?focus='));
    expect(screen.queryByTestId('module-structure-studied')).not.toBeInTheDocument();
    expect(screen.getByTestId('module-continue-link')).toHaveTextContent(/Start study/);
  });

  it('marks studied structures and offers module continue', async () => {
    mockBackend({ user: USER_A, snapshotKeys: ['male:nervous:UBERON:0000955'] });
    renderModule('/learn/nervous');
    expect(
      await screen.findByTestId('module-progress-text', {}, { timeout: 4000 })
    ).toHaveTextContent('1 of 12 structures studied');
    expect(
      await screen.findByTestId('module-structure-studied', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('module-continue-link')).toHaveAttribute(
      'href',
      expect.stringContaining('/human?focus=')
    );
    expect(screen.getByTestId('module-continue-link')).toHaveTextContent(/Continue with/);
  });

  it('rejects invalid modules honestly', async () => {
    mockBackend({ user: USER_A, snapshotKeys: [] });
    renderModule('/learn/bogus');
    expect(
      await screen.findByTestId('module-not-found', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('module-not-found-learn')).toHaveAttribute('href', '/learn');
  });

  it('invites anonymous visitors to sign in', async () => {
    mockBackend({ user: null });
    renderModule('/learn/nervous');
    expect(
      await screen.findByTestId('module-anonymous-note', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    // Public catalog still browsable without an account.
    expect(
      (await screen.findAllByTestId('module-structure-open', {}, { timeout: 4000 })).length
    ).toBe(12);
  });
});
