import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithAppProviders as render } from '@/test-utils';
import { __resetAuthForTests } from '@/lib/auth';
import { AnatomyStateProvider } from '../AnatomyStateContext';
import AnatomyQuiz, { buildAttemptInput } from '../AnatomyQuiz';

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

const USER = { id: 'u-1', email: 'a@b.c', name: null, role: 'STUDENT', createdAt: '2026-01-01' };
const SESSION = { user: USER, accessToken: 'access-1', refreshToken: 'refresh-1' };

describe('buildAttemptInput', () => {
  const questions = [
    { id: 'q1', structureKey: 'male:skin:UBERON:0002097', canonicalName: 'Skin' },
    { id: 'q2', structureKey: 'male:nervous:UBERON:0000955', canonicalName: 'Brain' },
  ];
  const answers = [
    { questionId: 'q1', selectedChoice: 1, correctIndex: 1 },
    { questionId: 'q2', selectedChoice: 0, correctIndex: 2 },
  ];

  it('builds a complete payload from questions and answers', () => {
    const input = buildAttemptInput(questions, answers, 1, 'male');
    expect(input).toMatchObject({ bodyModel: 'male', score: 1, total: 2 });
    expect(input?.answers).toEqual([
      { structureKey: 'male:skin:UBERON:0002097', canonicalName: 'Skin', selected: 1, correct: 1 },
      {
        structureKey: 'male:nervous:UBERON:0000955',
        canonicalName: 'Brain',
        selected: 0,
        correct: 2,
      },
    ]);
    expect(typeof input?.startedAt).toBe('string');
  });

  it('returns null for incomplete or mismatched data', () => {
    expect(buildAttemptInput([], [], 0, 'male')).toBeNull();
    expect(buildAttemptInput(questions, answers.slice(0, 1), 1, 'male')).toBeNull();
    expect(
      buildAttemptInput(
        questions,
        [{ questionId: 'missing', selectedChoice: 0, correctIndex: 0 }],
        0,
        'male'
      )
    ).toBeNull();
  });
});

describe('AnatomyQuiz persistence', () => {
  const submitted: Array<{ url: string; body: string }> = [];

  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    submitted.length = 0;
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(USER));
      if (u.endsWith('/api/v1/progress/snapshot'))
        return Promise.resolve(
          jsonResponse({ userId: 'u-1', studiedKeys: [], bodyModel: null, updatedAt: null })
        );
      if (u.endsWith('/api/v1/progress/quiz-attempts') && (init?.method ?? 'GET') === 'GET')
        return Promise.resolve(jsonResponse([]));
      if (u.endsWith('/api/v1/progress/quiz-attempts')) {
        submitted.push({ url: u, body: init?.body as string });
        return Promise.resolve(jsonResponse({ id: 'attempt-1' }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    }) as unknown as typeof fetch;
  });

  function renderQuiz() {
    return render(
      <AnatomyStateProvider>
        <AnatomyQuiz />
      </AnatomyStateProvider>
    );
  }

  async function answerAll() {
    for (let i = 0; i < 5; i++) {
      const choices = screen.getAllByTestId(/anatomy-quiz-choice-/);
      fireEvent.click(choices[0]);
      if (i < 4) fireEvent.click(screen.getByTestId('anatomy-quiz-next'));
    }
    await screen.findByTestId('anatomy-quiz-final', {}, { timeout: 4000 });
  }

  async function completeQuiz() {
    fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
    await answerAll();
  }

  it('submits a completed attempt exactly once despite rerenders', async () => {
    renderQuiz();
    await completeQuiz();
    // Allow the persistence effect to flush.
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(submitted).toHaveLength(1);
    const payload = JSON.parse(submitted[0].body);
    expect(payload).toMatchObject({ bodyModel: 'male', total: 5 });
    expect(payload.answers).toHaveLength(5);
    expect(typeof payload.score).toBe('number');
  });

  it('submits a fresh attempt for a new quiz without duplicating the old one', async () => {
    renderQuiz();
    await completeQuiz();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(submitted).toHaveLength(1);
    fireEvent.click(screen.getByTestId('anatomy-quiz-retry'));
    await answerAll();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(submitted).toHaveLength(2);
  });

  it('shows a non-blocking note when saving fails, quiz stays usable', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(USER));
      if (u.endsWith('/api/v1/progress/snapshot'))
        return Promise.resolve(
          jsonResponse({ userId: 'u-1', studiedKeys: [], bodyModel: null, updatedAt: null })
        );
      if (u.endsWith('/api/v1/progress/quiz-attempts') && (init?.method ?? 'GET') === 'GET')
        return Promise.resolve(jsonResponse([]));
      if (u.endsWith('/api/v1/progress/quiz-attempts'))
        return Promise.resolve(jsonResponse({ message: 'boom' }, 500));
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderQuiz();
    await completeQuiz();
    await screen.findByTestId('anatomy-quiz-sync-note', {}, { timeout: 4000 });
    // Quiz review still works despite the failure.
    expect(screen.getByTestId('anatomy-quiz-review')).toBeInTheDocument();
  });

  it('does not submit while anonymous', async () => {
    (global.fetch as jest.Mock).mockImplementation(() => Promise.resolve(jsonResponse({}, 404)));
    renderQuiz();
    await completeQuiz();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(submitted).toHaveLength(0);
    expect(screen.queryByTestId('anatomy-quiz-sync-note')).not.toBeInTheDocument();
  });

  it('never attributes an anonymously started quiz to a later account', async () => {
    const AccountPanel = (await import('@/components/auth/AccountPanel')).default;
    let allowSession = false;
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me'))
        return Promise.resolve(
          allowSession ? jsonResponse(USER) : jsonResponse({ message: 'Unauthorized' }, 401)
        );
      if (u.endsWith('/api/v1/auth/refresh'))
        return Promise.resolve(jsonResponse({ message: 'Unauthorized' }, 401));
      if (u.endsWith('/api/v1/progress/snapshot'))
        return Promise.resolve(
          jsonResponse({ userId: 'u-1', studiedKeys: [], bodyModel: null, updatedAt: null })
        );
      if (u.endsWith('/api/v1/progress/quiz-attempts') && (init?.method ?? 'GET') === 'GET')
        return Promise.resolve(jsonResponse([]));
      if (u.endsWith('/api/v1/auth/register')) {
        allowSession = true;
        return Promise.resolve(jsonResponse(SESSION, 201));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    render(
      <AnatomyStateProvider>
        <AnatomyQuiz />
        <AccountPanel />
      </AnatomyStateProvider>
    );
    // Complete the quiz while anonymous: nothing may be submitted.
    await completeQuiz();
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(submitted).toHaveLength(0);
    // Register afterwards: the anonymous quiz must stay local-only.
    fireEvent.change(screen.getByTestId('anatomy-account-email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByTestId('anatomy-account-password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('anatomy-account-register'));
    await screen.findByTestId('anatomy-account-user', {}, { timeout: 4000 });
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(submitted).toHaveLength(0);
    expect(screen.queryByTestId('anatomy-quiz-sync-note')).not.toBeInTheDocument();
  });
});
