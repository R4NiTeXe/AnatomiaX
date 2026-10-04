import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/components/auth-provider';
import AdminQuizzesPage from '../quizzes/page';
import AdminQuizDetailPage from '../quizzes/[id]/page';
import UsersPage from '../users/page';

jest.mock('next/navigation', () => ({
  usePathname: () => '/quizzes',
  useParams: () => ({ id: 'q1' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({ get: (key: string) => (key === 'role' ? 'TEACHER' : null) }),
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

const QUIZ = {
  id: 'q1',
  title: 'Skin basics',
  description: null,
  bodyModel: 'male',
  status: 'DRAFT',
  createdById: 't1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  questionCount: 1,
  questions: [
    {
      id: 'qq1',
      prompt: 'Largest bone?',
      options: ['Femur', 'Tibia'],
      position: 0,
      correctIndex: 0,
    },
  ],
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

describe('admin quizzes', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  it('lists system quizzes with statuses', async () => {
    authedFetch(url =>
      Promise.resolve(
        String(url).endsWith('/api/v1/quizzes') ? jsonResponse([QUIZ]) : jsonResponse({}, 404)
      )
    );
    renderWithProviders(<AdminQuizzesPage />);
    expect(
      await screen.findByTestId('admin-quizzes-list', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('admin-quiz-title')).toHaveTextContent('Skin basics');
    expect(screen.getByTestId('admin-quiz-status')).toHaveTextContent('DRAFT');
  });

  it('publishes from detail and shows the key (admin authorized)', async () => {
    let status = 'DRAFT';
    authedFetch((url, init) => {
      const u = String(url);
      if (u.endsWith('/api/v1/quizzes/q1'))
        return Promise.resolve(jsonResponse({ ...QUIZ, status }));
      if (u.endsWith('/api/v1/quizzes/q1/stats'))
        return Promise.resolve(
          jsonResponse({
            quizId: 'q1',
            attempts: 3,
            avgScore: 1.5,
            avgPercentage: 75,
            totalQuestions: 1,
            perQuestion: [],
          })
        );
      if (u.endsWith('/api/v1/quizzes/q1/publish') && (init?.method ?? 'GET') === 'POST') {
        status = 'PUBLISHED';
        return Promise.resolve(jsonResponse({ ...QUIZ, status }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<AdminQuizDetailPage />);
    expect(
      await screen.findByTestId('admin-quiz-title', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    // Admin sees the answer key (correctIndex) — never shown to students.
    expect(screen.getByText(/key #1/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('admin-quiz-publish'));
    await waitFor(() =>
      expect(screen.getByTestId('admin-quiz-status')).toHaveTextContent('PUBLISHED')
    );
  });

  it('presets the role filter from ?role= for Teachers/Students views', async () => {
    const seen: string[] = [];
    authedFetch(url => {
      seen.push(String(url));
      if (String(url).includes('/api/v1/admin/users')) {
        return Promise.resolve(jsonResponse({ items: [], total: 0, page: 1, limit: 20 }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<UsersPage />);
    expect(
      await screen.findByTestId('admin-users-empty', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect((screen.getByTestId('admin-users-role-filter') as HTMLSelectElement).value).toBe(
      'TEACHER'
    );
    expect(seen.some(u => u.includes('role=TEACHER'))).toBe(true);
  });

  it('archives then deletes from detail with navigation', async () => {
    let status = 'PUBLISHED';
    let deleted = false;
    authedFetch((url, init) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      if (u.endsWith('/api/v1/quizzes/q1') && method === 'GET')
        return Promise.resolve(
          jsonResponse({
            id: 'q1',
            title: 'Q',
            description: null,
            bodyModel: null,
            status,
            createdById: 't1',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            questionCount: 0,
            questions: [],
          })
        );
      if (u.endsWith('/api/v1/quizzes/q1/stats'))
        return Promise.resolve(
          jsonResponse({
            quizId: 'q1',
            attempts: 0,
            avgScore: 0,
            avgPercentage: 0,
            totalQuestions: 0,
            perQuestion: [],
          })
        );
      if (u.endsWith('/api/v1/quizzes/q1/archive') && method === 'POST') {
        status = 'ARCHIVED';
        return Promise.resolve(jsonResponse({ status }));
      }
      if (u.endsWith('/api/v1/quizzes/q1') && method === 'DELETE') {
        deleted = true;
        return Promise.resolve(jsonResponse({ status: 'ok' }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<AdminQuizDetailPage />);
    expect(
      await screen.findByTestId('admin-quiz-title', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('admin-quiz-archive'));
    await waitFor(() =>
      expect(screen.getByTestId('admin-quiz-status')).toHaveTextContent('ARCHIVED')
    );
    fireEvent.click(screen.getByTestId('admin-quiz-delete'));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it('adds a question with 1-based to 0-based key conversion', async () => {
    const posted: unknown[] = [];
    authedFetch((url, init) => {
      const u = String(url);
      if (u.endsWith('/api/v1/quizzes/q1'))
        return Promise.resolve(jsonResponse({ ...QUIZ, questions: [] }));
      if (u.endsWith('/api/v1/quizzes/q1/stats'))
        return Promise.resolve(
          jsonResponse({
            quizId: 'q1',
            attempts: 0,
            avgScore: 0,
            avgPercentage: 0,
            totalQuestions: 0,
            perQuestion: [],
          })
        );
      if (u.endsWith('/api/v1/quizzes/q1/questions')) {
        posted.push(JSON.parse(String(init?.body)));
        return Promise.resolve(
          jsonResponse(
            { id: 'qq9', prompt: 'P?', options: ['a', 'b'], position: 0, correctIndex: 1 },
            201
          )
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithProviders(<AdminQuizDetailPage />);
    expect(
      await screen.findByTestId('admin-quiz-title', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('admin-question-prompt'), { target: { value: 'P?' } });
    fireEvent.change(screen.getByTestId('admin-question-options'), { target: { value: 'a\nb' } });
    fireEvent.change(screen.getByTestId('admin-question-correct'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('admin-question-add'));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ correctIndex: 1 });
  });
});
