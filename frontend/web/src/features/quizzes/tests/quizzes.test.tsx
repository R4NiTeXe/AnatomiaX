import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider } from '@/features/auth/components/AuthProvider';
import QuizzesPage from '../pages/QuizzesPage';
import QuizTakePage from '../pages/QuizTakePage';
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
    // Answer key is never rendered (no correctIndex in the payload).
    expect(screen.queryByText(/correct answer/i)).not.toBeInTheDocument();
    const options = screen.getAllByTestId('quiz-take-option');
    fireEvent.click(options[0]);
    fireEvent.click(options[3]);
    expect(screen.getByTestId('quiz-take-submit')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('quiz-take-submit'));
    expect(await screen.findByTestId('quiz-take-result', {}, { timeout: 4000 })).toHaveTextContent(
      '1 / 2'
    );
    // Only selected indexes travel — never scores.
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
