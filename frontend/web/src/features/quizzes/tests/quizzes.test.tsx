import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider } from '@/features/auth/components/AuthProvider';
import QuizzesPage from '../pages/QuizzesPage';
import QuizTakePage from '../pages/QuizTakePage';
import TeachQuizDetailPage from '../pages/TeachQuizDetailPage';
import TeachQuizzesPage from '../pages/TeachQuizzesPage';

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

const STUDENT = {
  id: 's1',
  email: 's@x.test',
  name: null,
  role: 'STUDENT',
  createdAt: '2026-01-01',
};
const TEACHER = {
  id: 't1',
  email: 't@x.test',
  name: null,
  role: 'TEACHER',
  createdAt: '2026-01-01',
};

function renderWithAuth(ui: React.ReactElement, initialEntries: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const QUIZ = {
  id: 'q1',
  title: 'Skin basics',
  description: null,
  bodyModel: 'male',
  status: 'PUBLISHED',
  createdById: 't1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  questionCount: 2,
  questions: [
    { id: 'qq1', prompt: 'Largest bone?', options: ['Femur', 'Tibia'], position: 0 },
    { id: 'qq2', prompt: 'Smallest bone?', options: ['Stapes', 'Femur'], position: 1 },
  ],
};

describe('student quizzes UI', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  function mockStudent() {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse({ ...STUDENT }));
      if (u.endsWith('/api/v1/quizzes')) return Promise.resolve(jsonResponse([QUIZ]));
      if (u.endsWith('/api/v1/quizzes/q1'))
        return Promise.resolve(jsonResponse({ ...QUIZ, questions: QUIZ.questions }));
      if (u.endsWith('/api/v1/quizzes/q1/attempts')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse({}, 404));
    });
  }

  it('lists published quizzes and links into the take flow', async () => {
    mockStudent();
    renderWithAuth(
      <Routes>
        <Route path="/quizzes" element={<QuizzesPage />} />
        <Route path="/quizzes/:id" element={<QuizTakePage />} />
      </Routes>,
      ['/quizzes']
    );
    expect(await screen.findByTestId('quizzes-list', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('quiz-row-title')).toHaveTextContent('Skin basics');
  });

  it('submits answers and shows the server-graded result', async () => {
    const posted: unknown[] = [];
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse({ ...STUDENT }));
      if (u.endsWith('/api/v1/quizzes/q1'))
        return Promise.resolve(jsonResponse({ ...QUIZ, questions: QUIZ.questions }));
      if (u.endsWith('/api/v1/quizzes/q1/attempts')) {
        if ((init?.method ?? 'GET') === 'POST') {
          posted.push(JSON.parse(String(init?.body)));
          return Promise.resolve(
            jsonResponse({
              attemptId: 'a1',
              quizId: 'q1',
              score: 1,
              total: 2,
              correct: 1,
              incorrect: 1,
              percentage: 50,
              completedAt: '2026-01-02',
              results: [
                { questionId: 'qq1', selected: 0, correct: true },
                { questionId: 'qq2', selected: 1, correct: false },
              ],
            })
          );
        }
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithAuth(
      <Routes>
        <Route path="/quizzes/:id" element={<QuizTakePage />} />
      </Routes>,
      ['/quizzes/q1']
    );
    expect(await screen.findByTestId('quiz-take-title', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText(/correct answer/i)).not.toBeInTheDocument();
    const options = screen.getAllByTestId('quiz-take-option');
    fireEvent.click(options[0]);
    fireEvent.click(options[3]);
    expect(screen.getByTestId('quiz-take-submit')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('quiz-take-submit'));
    expect(await screen.findByTestId('quiz-take-result', {}, { timeout: 4000 })).toHaveTextContent(
      '1 / 2'
    );
    expect(posted).toHaveLength(1);
    expect(posted[0]).toEqual({
      answers: [
        { questionId: 'qq1', selectedIndex: 0 },
        { questionId: 'qq2', selectedIndex: 1 },
      ],
    });
  });
});

describe('teacher quiz management UI', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  function mockTeacher() {
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse({ ...TEACHER }));
      if (u.endsWith('/api/v1/quizzes?mine=true') || u.endsWith('/api/v1/quizzes'))
        return Promise.resolve(jsonResponse([{ ...QUIZ, status: 'DRAFT', questions: undefined }]));
      if ((init?.method ?? 'GET') === 'POST' && u.endsWith('/api/v1/quizzes'))
        return Promise.resolve(jsonResponse({ ...QUIZ, status: 'DRAFT' }, 201));
      return Promise.resolve(jsonResponse({}, 404));
    });
  }

  it('creates a draft and lists owned quizzes with statuses', async () => {
    mockTeacher();
    renderWithAuth(
      <Routes>
        <Route path="/teach/quizzes" element={<TeachQuizzesPage />} />
      </Routes>,
      ['/teach/quizzes']
    );
    expect(
      await screen.findByTestId('teach-quizzes-list', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('teach-quiz-name')).toHaveTextContent('Skin basics');
    expect(screen.getByTestId('teach-quiz-status')).toHaveTextContent('DRAFT');
    fireEvent.change(screen.getByTestId('teach-quiz-title'), { target: { value: 'New quiz' } });
    fireEvent.click(screen.getByTestId('teach-quiz-create'));
    await waitFor(() => expect(screen.queryByTestId('teach-quiz-error')).not.toBeInTheDocument());
  });

  it('manages the full draft lifecycle: edit, publish, archive, delete', async () => {
    let status = 'DRAFT';
    let title = 'Lifecycle quiz';
    const deleted: string[] = [];
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse({ ...TEACHER }));
      if (u.endsWith('/api/v1/quizzes/q9') && method === 'GET')
        return Promise.resolve(
          jsonResponse({
            id: 'q9',
            title,
            description: null,
            bodyModel: 'male',
            status,
            createdById: 't1',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            questionCount: 1,
            questions: [
              { id: 'qq1', prompt: 'P?', options: ['a', 'b'], position: 0, correctIndex: 0 },
            ],
          })
        );
      if (u.endsWith('/api/v1/quizzes/q9/stats'))
        return Promise.resolve(
          jsonResponse({
            quizId: 'q9',
            attempts: 2,
            avgScore: 1.5,
            avgPercentage: 75,
            totalQuestions: 1,
            perQuestion: [],
          })
        );
      if (u.endsWith('/api/v1/quizzes/q9/attempts'))
        return Promise.resolve(
          jsonResponse([
            {
              attemptId: 'a1',
              userId: 's1',
              score: 2,
              total: 2,
              percentage: 100,
              completedAt: '2026-01-02',
            },
          ])
        );
      if (u.endsWith('/api/v1/quizzes/q9/publish') && method === 'POST') {
        status = 'PUBLISHED';
        return Promise.resolve(jsonResponse({ status }));
      }
      if (u.endsWith('/api/v1/quizzes/q9/archive') && method === 'POST') {
        status = 'ARCHIVED';
        return Promise.resolve(jsonResponse({ status }));
      }
      if (u.endsWith('/api/v1/quizzes/q9') && method === 'DELETE') {
        deleted.push(u);
        return Promise.resolve(jsonResponse({ status: 'ok' }));
      }
      if (u.endsWith('/api/v1/quizzes/q9') && method === 'PATCH') {
        title = (JSON.parse(String(init?.body)) as { title: string }).title;
        return Promise.resolve(jsonResponse({ status }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithAuth(
      <Routes>
        <Route path="/teach/quizzes/:id" element={<TeachQuizDetailPage />} />
        <Route path="/teach/quizzes" element={<div data-testid="teach-quizzes-home">home</div>} />
      </Routes>,
      ['/teach/quizzes/q9']
    );
    expect(await screen.findByTestId('teach-quiz-title', {}, { timeout: 4000 })).toHaveTextContent(
      'Lifecycle quiz'
    );
    expect(screen.getByTestId('teach-quiz-stats')).toHaveTextContent('2 attempts');
    expect(screen.getByTestId('teach-attempt-list')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('teach-quiz-edit-title'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByTestId('teach-quiz-edit-save'));
    await waitFor(() =>
      expect(screen.getByTestId('teach-quiz-title')).toHaveTextContent('Renamed')
    );

    fireEvent.click(screen.getByTestId('teach-quiz-publish'));
    await waitFor(() =>
      expect(screen.getByTestId('teach-quiz-status')).toHaveTextContent('PUBLISHED')
    );

    fireEvent.click(screen.getByTestId('teach-quiz-archive'));
    await waitFor(() =>
      expect(screen.getByTestId('teach-quiz-status')).toHaveTextContent('ARCHIVED')
    );

    fireEvent.click(screen.getByTestId('teach-quiz-delete'));
    await waitFor(() => expect(screen.getByTestId('teach-quizzes-home')).toBeInTheDocument());
    expect(deleted).toHaveLength(1);
  });

  it('adds a question with 1-based to 0-based key conversion', async () => {
    const posted: unknown[] = [];
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse({ ...TEACHER }));
      if (u.endsWith('/api/v1/quizzes/q9') && method === 'GET')
        return Promise.resolve(
          jsonResponse({
            id: 'q9',
            title: 'Q',
            description: null,
            bodyModel: null,
            status: 'DRAFT',
            createdById: 't1',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            questionCount: 0,
            questions: [],
          })
        );
      if (u.endsWith('/api/v1/quizzes/q9/stats'))
        return Promise.resolve(
          jsonResponse({
            quizId: 'q9',
            attempts: 0,
            avgScore: 0,
            avgPercentage: 0,
            totalQuestions: 0,
            perQuestion: [],
          })
        );
      if (u.endsWith('/api/v1/quizzes/q9/attempts')) return Promise.resolve(jsonResponse([]));
      if (u.endsWith('/api/v1/quizzes/q9/questions') && method === 'POST') {
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
    renderWithAuth(
      <Routes>
        <Route path="/teach/quizzes/:id" element={<TeachQuizDetailPage />} />
      </Routes>,
      ['/teach/quizzes/q9']
    );
    expect(
      await screen.findByTestId('teach-quiz-title', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('teach-question-prompt'), { target: { value: 'P?' } });
    fireEvent.change(screen.getByTestId('teach-question-options'), { target: { value: 'a\nb' } });
    fireEvent.change(screen.getByTestId('teach-question-correct'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('teach-question-add'));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ correctIndex: 1 });
  });

  it('shows backend errors inline without crashing', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const u = String(url);
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse({ ...TEACHER }));
      if (u.endsWith('/api/v1/quizzes/q9'))
        return Promise.resolve(jsonResponse({ message: 'Forbidden' }, 403));
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderWithAuth(
      <Routes>
        <Route path="/teach/quizzes/:id" element={<TeachQuizDetailPage />} />
      </Routes>,
      ['/teach/quizzes/q9']
    );
    expect(
      await screen.findByTestId('teach-quiz-retry', {}, { timeout: 4000 })
    ).toBeInTheDocument();
  });

  it('denies students the teaching area (UX gate; API stays authoritative)', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      Promise.resolve(
        String(url).endsWith('/api/v1/auth/me')
          ? jsonResponse({ ...STUDENT })
          : jsonResponse({}, 404)
      )
    );
    renderWithAuth(
      <Routes>
        <Route path="/teach/quizzes" element={<TeachQuizzesPage />} />
      </Routes>,
      ['/teach/quizzes']
    );
    expect(await screen.findByTestId('role-denied', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByTestId('teach-quizzes-list')).not.toBeInTheDocument();
  });
});
