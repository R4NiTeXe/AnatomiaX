import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
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

function attempt(
  id: string,
  userId: string,
  score: number,
  total: number,
  answers: {
    structureKey?: string;
    canonicalName?: string;
    selected: number;
    correct: number;
  }[] = []
) {
  return {
    id,
    userId,
    bodyModel: 'male',
    score,
    total,
    answers,
    startedAt: null,
    completedAt: '2026-09-01T10:00:00.000Z',
  };
}

function mockBackend(opts: {
  user?: typeof USER_A | null;
  snapshotKeys?: string[];
  attempts?: ReturnType<typeof attempt>[];
  snapshotStatus?: number;
  attemptsStatus?: number;
}) {
  const {
    user = USER_A,
    snapshotKeys = [],
    attempts = [],
    snapshotStatus = 200,
    attemptsStatus = 200,
  } = opts;
  const session = user
    ? { user, accessToken: `access-${user.id}`, refreshToken: `refresh-${user.id}` }
    : null;
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    const u = url as string;
    if (u.endsWith('/api/v1/auth/me'))
      return Promise.resolve(
        user ? jsonResponse(user) : jsonResponse({ message: 'Unauthorized' }, 401)
      );
    if (u.endsWith('/api/v1/auth/refresh'))
      return Promise.resolve(
        session ? jsonResponse(session) : jsonResponse({ message: 'Unauthorized' }, 401)
      );
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

function renderLearn(path = '/learn') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/human" element={<div data-testid="human-page">human</div>} />
            <Route path="/login" element={<div data-testid="login-page">login</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  return { ...ui, client };
}

describe('progress hub (8.20.6)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  it('shows polished summary with total studied, quizzes, latest and best', async () => {
    const attempts = [
      attempt('a1', 'u-a', 4, 5, [{ structureKey: KEY_HEART, selected: 0, correct: 0 }]),
      attempt('a2', 'u-a', 2, 5, [{ structureKey: KEY_SKIN, selected: 1, correct: 0 }]),
      attempt('a3', 'u-a', 5, 5, [{ structureKey: KEY_BRAIN, selected: 0, correct: 0 }]),
    ];
    mockBackend({ user: USER_A, snapshotKeys: [KEY_HEART, KEY_SKIN, KEY_BRAIN], attempts });
    renderLearn();
    expect(
      await screen.findByTestId('progress-summary', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('progress-summary-studied')).toHaveTextContent('3');
    expect(screen.getByTestId('progress-summary-quizzes')).toHaveTextContent('3');
    expect(screen.getByTestId('progress-summary-latest')).toHaveTextContent('4 / 5');
    expect(screen.getByTestId('progress-summary-best')).toHaveTextContent('5 / 5');
  });

  it('shows studied list with recent and full counts and 3D links', async () => {
    mockBackend({ user: USER_A, snapshotKeys: [KEY_HEART, KEY_SKIN], attempts: [] });
    renderLearn();
    await screen.findByTestId('progress-summary', {}, { timeout: 4000 });
    expect(await screen.findByTestId('studied-count', {}, { timeout: 4000 })).toHaveTextContent(
      '2 structures studied'
    );
    const items = await screen.findAllByTestId('studied-item', {}, { timeout: 4000 });
    expect(items).toHaveLength(2);
    const links = await screen.findAllByTestId('studied-open', {}, { timeout: 4000 });
    expect(links[0]).toHaveAttribute('href', `/human?focus=${encodeURIComponent(KEY_HEART)}`);
    expect(links[1]).toHaveAttribute('href', `/human?focus=${encodeURIComponent(KEY_SKIN)}`);
  });

  it('shows quiz history with latest and allows detail review with structure links', async () => {
    const attempts = [
      attempt('a1', 'u-a', 2, 2, [
        { structureKey: KEY_HEART, canonicalName: 'Heart', selected: 0, correct: 0 },
        { structureKey: KEY_BRAIN, canonicalName: 'Brain', selected: 1, correct: 0 },
      ]),
    ];
    mockBackend({ user: USER_A, snapshotKeys: [KEY_HEART], attempts });
    renderLearn();
    await screen.findByTestId('history-list', {}, { timeout: 4000 });
    expect(screen.getByTestId('history-count')).toHaveTextContent('1 attempt');
    const trigger = await screen.findByTestId('quiz-details-trigger', {}, { timeout: 4000 });
    fireEvent.click(trigger);
    const dialog = await screen.findByTestId('quiz-detail', {}, { timeout: 4000 });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId('quiz-detail-score')).toHaveTextContent('2 / 2');
    const answers = screen.getAllByTestId('quiz-detail-answer');
    expect(answers).toHaveLength(2);
    const statuses = screen.getAllByTestId('quiz-detail-answer-status');
    expect(statuses[0]).toHaveTextContent('Correct');
    expect(statuses[1]).toHaveTextContent('Incorrect');
    const openLinks = screen.getAllByTestId('quiz-detail-open');
    expect(openLinks[0]).toHaveAttribute('href', `/human?focus=${encodeURIComponent(KEY_HEART)}`);
    expect(openLinks[1]).toHaveAttribute('href', `/human?focus=${encodeURIComponent(KEY_BRAIN)}`);
    expect(screen.getByTestId('quiz-detail-practice')).toHaveAttribute('href', '/human');
    expect(screen.getByTestId('quiz-detail-focus')).toHaveAttribute(
      'href',
      `/human?focus=${encodeURIComponent(KEY_HEART)}`
    );
  });

  it('shows answer without structureKey without 3D link', async () => {
    const attempts = [
      attempt('a1', 'u-a', 0, 1, [{ canonicalName: 'Mystery', selected: 1, correct: 0 }]),
    ];
    mockBackend({ user: USER_A, snapshotKeys: [], attempts });
    renderLearn();
    await screen.findByTestId('history-list', {}, { timeout: 4000 });
    fireEvent.click(await screen.findByTestId('quiz-details-trigger', {}, { timeout: 4000 }));
    await screen.findByTestId('quiz-detail', {}, { timeout: 4000 });
    expect(screen.getByText('Mystery')).toBeInTheDocument();
    expect(screen.queryByTestId('quiz-detail-open')).not.toBeInTheDocument();
  });

  it('handles empty, loading and error states with retry', async () => {
    mockBackend({ user: USER_A, snapshotKeys: [], attempts: [] });
    renderLearn();
    expect(await screen.findByTestId('studied-empty', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByTestId('history-empty', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('progress-summary-studied')).toHaveTextContent('0');
    expect(screen.getByTestId('progress-summary-quizzes')).toHaveTextContent('0');
    expect(screen.getByTestId('progress-summary-latest')).toHaveTextContent('—');
    expect(screen.getByTestId('progress-summary-best')).toHaveTextContent('—');
  });

  it('shows loading then error with retry for summary and history', async () => {
    mockBackend({ user: USER_A, snapshotStatus: 500, attemptsStatus: 500 });
    renderLearn();
    expect(
      await screen.findByTestId('progress-summary-error', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    mockBackend({ user: USER_A, snapshotKeys: [KEY_SKIN], attempts: [attempt('a1', 'u-a', 1, 2)] });
    fireEvent.click(screen.getByTestId('progress-summary-retry-snapshot'));
    fireEvent.click(screen.getByTestId('progress-summary-retry-history'));
    expect(
      await screen.findByTestId('progress-summary-studied', {}, { timeout: 4000 })
    ).toHaveTextContent('1');
    expect(
      await screen.findByTestId('progress-summary-quizzes', {}, { timeout: 4000 })
    ).toHaveTextContent('1');
  });

  it('keeps user isolation for progress data', async () => {
    const attemptsA = [attempt('a1', 'u-a', 5, 5)];
    mockBackend({ user: USER_A, snapshotKeys: [KEY_HEART], attempts: attemptsA });
    const first = renderLearn();
    expect(
      await screen.findByTestId('progress-summary-studied', {}, { timeout: 4000 })
    ).toHaveTextContent('1');
    expect(await screen.findByTestId('history-count', {}, { timeout: 4000 })).toHaveTextContent(
      '1 attempt'
    );
    first.unmount();
    __resetAuthForTests();
    mockBackend({
      user: USER_B,
      snapshotKeys: [KEY_BRAIN, KEY_SKIN],
      attempts: [attempt('b1', 'u-b', 1, 5), attempt('b2', 'u-b', 2, 5)],
    });
    renderLearn();
    expect(
      await screen.findByTestId('progress-summary-studied', {}, { timeout: 4000 })
    ).toHaveTextContent('2');
    expect(
      await screen.findByTestId('progress-summary-quizzes', {}, { timeout: 4000 })
    ).toHaveTextContent('2');
    const studied = await screen.findAllByTestId('studied-item', {}, { timeout: 4000 });
    expect(studied).toHaveLength(2);
    expect(screen.queryByText(/Heart/)).not.toBeInTheDocument();
  });

  it('clears progress cache on logout', async () => {
    mockBackend({ user: USER_A, snapshotKeys: [KEY_SKIN], attempts: [attempt('a1', 'u-a', 3, 5)] });
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
          <MemoryRouter initialEntries={['/learn']}>
            <LogoutProbe />
            <LearnPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    expect(
      await screen.findByTestId('progress-summary', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('probe-logout'));
    expect(await screen.findByTestId('learn-anonymous', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(client.getQueryData(['progress', 'snapshot', 'u-a'])).toBeUndefined();
    expect(client.getQueryData(['progress', 'attempts', 'u-a'])).toBeUndefined();
  });

  it('exposes accessible semantics and keyboard focusable controls', async () => {
    mockBackend({
      user: USER_A,
      snapshotKeys: [KEY_HEART],
      attempts: [attempt('a1', 'u-a', 1, 2)],
    });
    renderLearn();
    await screen.findByTestId('progress-summary', {}, { timeout: 4000 });
    expect(screen.getByRole('heading', { name: /Learning progress/i })).toBeInTheDocument();
    expect(screen.getByTestId('site-nav')).toBeInTheDocument();
    const triggers = await screen.findAllByTestId('quiz-details-trigger', {}, { timeout: 4000 });
    expect(triggers[0].tagName).toBe('BUTTON');
    triggers[0].focus();
    expect(document.activeElement).toBe(triggers[0]);
    const links = screen.getAllByTestId('studied-open');
    expect(links[0].tagName).toBe('A');
  });

  it('provides retry/practice and deep-link navigation', async () => {
    mockBackend({
      user: USER_A,
      snapshotKeys: [KEY_HEART],
      attempts: [
        attempt('a1', 'u-a', 2, 2, [{ structureKey: KEY_HEART, selected: 0, correct: 0 }]),
      ],
    });
    renderLearn();
    await screen.findByTestId('learn-continue-link', {}, { timeout: 4000 });
    expect(screen.getByTestId('learn-continue-link')).toHaveAttribute(
      'href',
      `/human?focus=${encodeURIComponent(KEY_HEART)}`
    );
    fireEvent.click(await screen.findByTestId('quiz-details-trigger', {}, { timeout: 4000 }));
    await screen.findByTestId('quiz-detail', {}, { timeout: 4000 });
    expect(screen.getByTestId('quiz-detail-practice')).toHaveAttribute('href', '/human');
  });
});
