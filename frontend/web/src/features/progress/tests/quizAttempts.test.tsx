import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider } from '@/features/auth/components/AuthProvider';
import { QuizHistoryList, QuizRecent } from '../components/QuizAttempts';

const USER = { id: 'u1', email: 'a@b.c', name: null, role: 'STUDENT', createdAt: '2026-01-01' };

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

function attempt(
  id: string,
  answers: Array<{
    canonicalName?: string;
    structureKey?: string;
    selected: number;
    correct: number;
  }>
) {
  return {
    id,
    userId: 'u1',
    bodyModel: 'male',
    score: 1,
    total: 2,
    answers,
    startedAt: null,
    completedAt: '2026-01-02T00:00:00.000Z',
  };
}

const ATTEMPTS = [
  attempt('a1', [{ canonicalName: 'Custom Q', selected: 1, correct: 1 }]),
  attempt('a2', [{ structureKey: 'male:nervous:UBERON:0000955', selected: 0, correct: 1 }]),
  attempt('a3', [{ selected: 0, correct: 1 }]),
  attempt('a4', []),
];

function setup(fetchImpl: (url: string) => Promise<Response>, ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  (global.fetch as unknown as jest.Mock) = jest.fn((url: string) => fetchImpl(url));
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/learn']}>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('QuizAttempts lists', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    process.env.VITE_API_BASE_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete (process.env as Record<string, string | undefined>).VITE_API_BASE_URL;
  });

  const authed = (attempts: unknown) => (url: string) => {
    const u = url as string;
    if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(USER));
    if (u.includes('/api/v1/progress/quiz-attempts'))
      return Promise.resolve(jsonResponse(attempts));
    return Promise.resolve(jsonResponse({}, 404));
  };

  it('labels answers from canonical names, manifest info, and fallbacks', async () => {
    setup(authed(ATTEMPTS), <QuizRecent />);
    await screen.findByTestId('quiz-list', {}, { timeout: 4000 });
    const details = await screen.findAllByText('Details', {}, { timeout: 4000 });
    for (const toggle of details.slice(0, 3)) fireEvent.click(toggle);
    expect(screen.getByText('Custom Q')).toBeInTheDocument();
    expect(screen.getByText('Brain')).toBeInTheDocument();
    expect(screen.getByText('Question')).toBeInTheDocument();
  });

  it('shows the empty state without attempts', async () => {
    setup(authed([]), <QuizRecent />);
    expect(await screen.findByTestId('quiz-empty', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('shows an error with retry when history fails', async () => {
    setup(
      url => {
        const u = url as string;
        if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(USER));
        if (u.includes('/api/v1/progress/quiz-attempts'))
          return Promise.resolve(jsonResponse({ message: 'boom' }, 500));
        return Promise.resolve(jsonResponse({}, 404));
      },
      <QuizHistoryList />
    );
    expect(await screen.findByTestId('history-error', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('renders nothing while anonymous', async () => {
    setup(() => Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401)), <QuizRecent />);
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(screen.queryByTestId('quiz-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quiz-empty')).not.toBeInTheDocument();
  });
});
