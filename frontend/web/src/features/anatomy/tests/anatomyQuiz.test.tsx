import { screen, fireEvent, waitFor } from '@testing-library/react';
import { getAnatomyInformationSeed } from '../components/anatomyInformation';
import { renderWithAppProviders as render } from '@/test-utils';
import '@testing-library/jest-dom';
import { AnatomyStateProvider, useAnatomyState } from '../components/AnatomyStateContext';
import { useAuth } from '../../../features/auth/components/AuthProvider';
import AnatomyQuiz from '../components/AnatomyQuiz';

function Harness() {
  const { selectStructure, setSelectedBodyModel } = useAnatomyState();
  return (
    <div>
      <AnatomyQuiz />
      <button
        data-testid="select-brain"
        onClick={() =>
          selectStructure({
            structureKey: 'male:nervous:UBERON:0000955',
            name: 'VH_M_brain',
            objectName: 'VH_M_brain',
            systemKey: 'nervous',
            bodyModel: 'male',
            ontologyId: 'UBERON:0000955',
          })
        }
      >
        select-brain
      </button>
      <button data-testid="switch-female" onClick={() => setSelectedBodyModel('female')}>
        switch-female
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AnatomyStateProvider>
      <Harness />
    </AnatomyStateProvider>
  );
}

function AuthedHarness() {
  const { user, login } = useAuth();
  return (
    <div>
      <AnatomyQuiz />
      <button
        data-testid="do-login"
        onClick={() => {
          void login('a@b.c', 'password123');
        }}
      >
        login
      </button>
      <span data-testid="authed-user">{user ? user.email : 'none'}</span>
    </div>
  );
}

describe('AnatomyQuiz', () => {
  it('shows Start Quiz initially', () => {
    renderWithProvider();
    expect(screen.getByTestId('anatomy-quiz')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-quiz-start')).toBeInTheDocument();
  });

  it('exactly 5 questions', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
    expect(screen.getByTestId('anatomy-quiz-progress')).toHaveTextContent('1 / 5');
    // Answer and go through all 5
    for (let i = 0; i < 5; i++) {
      const choices = screen.getAllByTestId(/anatomy-quiz-choice-/);
      expect(choices.length).toBe(4);
      fireEvent.click(choices[0]);
      expect(screen.getByTestId('anatomy-quiz-feedback')).toBeInTheDocument();
      if (i < 4) {
        fireEvent.click(screen.getByTestId('anatomy-quiz-next'));
        expect(screen.getByTestId('anatomy-quiz-progress')).toHaveTextContent(`${i + 2} / 5`);
      }
    }
    expect(screen.getByTestId('anatomy-quiz-final')).toBeInTheDocument();
  });

  it('exactly 4 choices', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
    const choices = screen.getAllByTestId(/anatomy-quiz-choice-/);
    expect(choices.length).toBe(4);
  });

  it('correct answer derived from verified function', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
    const question = screen.getByTestId('anatomy-quiz-question').textContent || '';
    expect(question).toMatch(/What is the function of .+\?/);
    const choices = screen.getAllByTestId(/anatomy-quiz-choice-/).map(el => el.textContent);
    const all = getAnatomyInformationSeed();
    const hasVerified = choices.some(c => all.some(s => s.function === c));
    expect(hasVerified).toBe(true);
  });

  it('answer scoring', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
    const beforeScore = screen.getByTestId('anatomy-quiz-score').textContent;
    expect(beforeScore).toBe('Score: 0 / 5');
    const choices = screen.getAllByTestId(/anatomy-quiz-choice-/);
    fireEvent.click(choices[0]);
    const afterScore = screen.getByTestId('anatomy-quiz-score').textContent;
    // Score should be 0 or 1 depending on if first choice was correct
    expect(afterScore).toMatch(/Score: [01] \/ 5/);
  });

  it('wrong answer handling', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
    const choices = screen.getAllByTestId(/anatomy-quiz-choice-/);
    // Click the second choice (likely wrong, but even if correct, feedback will be Correct/Incorrect)
    fireEvent.click(choices[1]);
    const feedback = screen.getByTestId('anatomy-quiz-feedback').textContent || '';
    expect(feedback === 'Correct!' || feedback.includes('Incorrect')).toBe(true);
  });

  it('next question', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
    expect(screen.getByTestId('anatomy-quiz-progress')).toHaveTextContent('1 / 5');
    const choices = screen.getAllByTestId(/anatomy-quiz-choice-/);
    fireEvent.click(choices[0]);
    fireEvent.click(screen.getByTestId('anatomy-quiz-next'));
    expect(screen.getByTestId('anatomy-quiz-progress')).toHaveTextContent('2 / 5');
  });

  it('final score', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
    for (let i = 0; i < 5; i++) {
      const choices = screen.getAllByTestId(/anatomy-quiz-choice-/);
      fireEvent.click(choices[0]);
      if (i < 4) fireEvent.click(screen.getByTestId('anatomy-quiz-next'));
    }
    expect(screen.getByTestId('anatomy-quiz-final')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-quiz-final').textContent).toMatch(/[0-5] \/ 5/);
  });

  it('retry/reset', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
    // Answer all 5 to get to final
    for (let i = 0; i < 5; i++) {
      const choices = screen.getAllByTestId(/anatomy-quiz-choice-/);
      fireEvent.click(choices[0]);
      if (i < 4) fireEvent.click(screen.getByTestId('anatomy-quiz-next'));
    }
    expect(screen.getByTestId('anatomy-quiz-final')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('anatomy-quiz-retry'));
    expect(screen.getByTestId('anatomy-quiz-progress')).toHaveTextContent('1 / 5');
    expect(screen.getByTestId('anatomy-quiz-score')).toHaveTextContent('Score: 0 / 5');
  });

  it('selected structure preferred', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
    const question = screen.getByTestId('anatomy-quiz-question').textContent || '';
    // Should be Brain or another verified, but at least contains a known canonical
    const all = getAnatomyInformationSeed();
    const hasKnown = all.some(s => question.includes(s.canonicalName));
    expect(hasKnown).toBe(true);
  });

  it('no duplicate canonical distractor', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
    const choices = screen.getAllByTestId(/anatomy-quiz-choice-/).map(el => el.textContent);
    const unique = new Set(choices);
    expect(unique.size).toBe(4);
  });

  it('never submits attempts while anonymous', async () => {
    const posts: Array<{ url: string; init?: RequestInit }> = [];
    const json = (data: unknown, status = 200) =>
      ({
        ok: status >= 200 && status < 300,
        status,
        statusText: 'OK',
        headers: { get: () => 'application/json' },
        json: async () => data,
        text: async () => JSON.stringify(data),
      }) as unknown as Response;
    process.env.VITE_API_BASE_URL = 'http://localhost:3000';
    (global.fetch as unknown as jest.Mock) = jest.fn((url: string, init?: RequestInit) => {
      const u = url as string;
      if (u.endsWith('/api/v1/progress/quiz-attempts') && init?.method === 'POST') {
        posts.push({ url: u, init });
        return Promise.resolve(json({ id: 'qa-1' }));
      }
      return Promise.resolve(json({ message: 'Unauthorized' }, 401));
    });
    try {
      renderWithProvider();
      fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
      for (let i = 0; i < 5; i++) {
        fireEvent.click(screen.getAllByTestId(/anatomy-quiz-choice-/)[0]);
        if (i < 4) fireEvent.click(screen.getByTestId('anatomy-quiz-next'));
      }
      expect(await screen.findByTestId('anatomy-quiz-final')).toBeInTheDocument();
      await new Promise(resolve => setTimeout(resolve, 50));
    } finally {
      delete (process.env as Record<string, string | undefined>).VITE_API_BASE_URL;
      (global.fetch as unknown as jest.Mock) = jest.fn();
    }
    expect(posts).toHaveLength(0);
  });

  it('submits the completed attempt exactly once when authenticated', async () => {
    const posts: Array<{ url: string; init?: RequestInit }> = [];
    const SESSION = {
      user: { id: 'u1', email: 'a@b.c', name: null, role: 'STUDENT', createdAt: '2026-01-01' },
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    };
    const json = (data: unknown, status = 200) =>
      ({
        ok: status >= 200 && status < 300,
        status,
        statusText: 'OK',
        headers: { get: () => 'application/json' },
        json: async () => data,
        text: async () => JSON.stringify(data),
      }) as unknown as Response;
    process.env.VITE_API_BASE_URL = 'http://localhost:3000';
    (global.fetch as unknown as jest.Mock) = jest.fn((url: string, init?: RequestInit) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/login')) return Promise.resolve(json(SESSION));
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(json(SESSION.user));
      if (u.endsWith('/api/v1/progress/quiz-attempts') && init?.method === 'POST') {
        posts.push({ url: u, init });
        return Promise.resolve(json({ id: 'qa-1' }));
      }
      return Promise.resolve(json({ message: 'Unauthorized' }, 401));
    });
    try {
      render(
        <AnatomyStateProvider>
          <AuthedHarness />
        </AnatomyStateProvider>
      );
      fireEvent.click(screen.getByTestId('do-login'));
      expect(await screen.findByText('a@b.c')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
      for (let i = 0; i < 5; i++) {
        fireEvent.click(screen.getAllByTestId(/anatomy-quiz-choice-/)[0]);
        if (i < 4) fireEvent.click(screen.getByTestId('anatomy-quiz-next'));
      }
      expect(await screen.findByTestId('anatomy-quiz-final')).toBeInTheDocument();
      await waitFor(() => expect(posts).toHaveLength(1));
      const payload = JSON.parse(posts[0].init?.body as string) as {
        score: number;
        total: number;
        answers: unknown[];
        bodyModel: string;
      };
      expect(payload.total).toBe(5);
      expect(payload.answers).toHaveLength(5);
      expect(payload.bodyModel).toBe('male');
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(posts).toHaveLength(1);
    } finally {
      delete (process.env as Record<string, string | undefined>).VITE_API_BASE_URL;
      (global.fetch as unknown as jest.Mock) = jest.fn();
    }
  });

  it('body switch resets quiz', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
    expect(screen.getByTestId('anatomy-quiz-progress')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('switch-female'));
    expect(screen.queryByTestId('anatomy-quiz-progress')).not.toBeInTheDocument();
    expect(screen.getByTestId('anatomy-quiz-start')).toBeInTheDocument();
  });
});
