import { screen, fireEvent } from '@testing-library/react';
import { renderWithAppProviders as render } from '@/test-utils';
import '@testing-library/jest-dom';
import { AnatomyStateProvider, useAnatomyState } from '../AnatomyStateContext';
import AnatomySessionPanel from '../AnatomySessionPanel';
import type { AnatomySelection } from '../anatomyTypes';

function Harness() {
  const {
    selectStructure,
    setSelectedBodyModel,
    setCompareStructure,
    startQuiz,
    answerQuiz,
    nextQuizQuestion,
    selectedBodyModel,
    toggleSystem,
  } = useAnatomyState();
  return (
    <div>
      <AnatomySessionPanel />
      <span data-testid="body-model">{selectedBodyModel}</span>
      <button data-testid="toggle-nervous" onClick={() => toggleSystem('nervous')}>
        toggle-nervous
      </button>
      <button data-testid="toggle-cardio" onClick={() => toggleSystem('cardiovascular')}>
        toggle-cardio
      </button>
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
          } as AnatomySelection)
        }
      >
        brain
      </button>
      <button
        data-testid="select-heart"
        onClick={() =>
          selectStructure({
            structureKey: 'male:cardiovascular:UBERON:0000948',
            name: 'VH_M_heart',
            objectName: 'VH_M_heart',
            systemKey: 'cardiovascular',
            bodyModel: 'male',
            ontologyId: 'UBERON:0000948',
          } as AnatomySelection)
        }
      >
        heart
      </button>
      <button
        data-testid="select-spinal"
        onClick={() =>
          selectStructure({
            structureKey: 'male:nervous:UBERON:0002240',
            name: 'VH_M_spinal',
            objectName: 'VH_M_spinal',
            systemKey: 'nervous',
            bodyModel: 'male',
            ontologyId: 'UBERON:0002240',
          } as AnatomySelection)
        }
      >
        spinal
      </button>
      <button
        data-testid="compare-spinal"
        onClick={() =>
          setCompareStructure({
            structureKey: 'male:nervous:UBERON:0002240',
            name: 'VH_M_spinal',
            objectName: 'VH_M_spinal',
            systemKey: 'nervous',
            bodyModel: 'male',
            ontologyId: 'UBERON:0002240',
          } as AnatomySelection)
        }
      >
        compare
      </button>
      <button data-testid="start-quiz" onClick={() => startQuiz()}>
        start
      </button>
      <button data-testid="answer-first" onClick={() => answerQuiz(0)}>
        answer
      </button>
      <button data-testid="next" onClick={() => nextQuizQuestion()}>
        next
      </button>
      <button data-testid="switch-female" onClick={() => setSelectedBodyModel('female')}>
        female
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

describe('AnatomySessionPanel', () => {
  it('empty studied', () => {
    renderWithProvider();
    expect(screen.getByTestId('anatomy-session-panel')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-session-studied-count')).toHaveTextContent('0');
    expect(screen.getByTestId('anatomy-session-studied-empty')).toBeInTheDocument();
  });

  it('studied count and names', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    expect(screen.getByTestId('anatomy-session-studied-count')).toHaveTextContent('1');
    expect(screen.getByTestId('anatomy-session-studied-list')).toHaveTextContent('Brain');
    fireEvent.click(screen.getByTestId('toggle-cardio'));
    fireEvent.click(screen.getByTestId('select-heart'));
    expect(screen.getByTestId('anatomy-session-studied-count')).toHaveTextContent('2');
    const items = screen.getAllByTestId('anatomy-session-studied-item');
    expect(items[0]).toHaveTextContent('Heart'); // newest first
    expect(items[1]).toHaveTextContent('Brain');
  });

  it('quiz empty and progress', () => {
    renderWithProvider();
    expect(screen.getByTestId('anatomy-session-quiz-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('start-quiz'));
    expect(screen.getByTestId('anatomy-session-quiz-progress')).toBeInTheDocument();
  });

  it('quiz completed score', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('start-quiz'));
    // Complete 5 questions: answer + next x4 + answer final
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId('answer-first'));
      if (i < 4) fireEvent.click(screen.getByTestId('next'));
    }
    expect(screen.getByTestId('anatomy-session-quiz-summary')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-session-quiz-score')).toHaveTextContent(/Score/);
    expect(screen.getByTestId('anatomy-session-quiz-detail')).toHaveTextContent(/correct/);
  });

  it('comparison summary', () => {
    renderWithProvider();
    expect(screen.getByTestId('anatomy-session-compare-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('compare-spinal'));
    expect(screen.getByTestId('anatomy-session-compare')).toHaveTextContent(/Brain/);
    expect(screen.getByTestId('anatomy-session-compare')).toHaveTextContent(/Spinal/);
  });

  it('body switch clears session-derived state', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-nervous'));
    fireEvent.click(screen.getByTestId('select-brain'));
    fireEvent.click(screen.getByTestId('toggle-cardio'));
    fireEvent.click(screen.getByTestId('select-heart'));
    fireEvent.click(screen.getByTestId('start-quiz'));
    fireEvent.click(screen.getByTestId('compare-spinal'));
    expect(screen.getByTestId('anatomy-session-studied-count')).toHaveTextContent('2');
    fireEvent.click(screen.getByTestId('switch-female'));
    expect(screen.getByTestId('anatomy-session-studied-count')).toHaveTextContent('0');
    expect(screen.getByTestId('anatomy-session-studied-empty')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-session-quiz-empty')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-session-compare-empty')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-session-body-model')).toHaveTextContent('female');
  });

  it('body model display', () => {
    renderWithProvider();
    expect(screen.getByTestId('anatomy-session-body-model')).toHaveTextContent('male');
    fireEvent.click(screen.getByTestId('switch-female'));
    expect(screen.getByTestId('anatomy-session-body-model')).toHaveTextContent('female');
  });

  it('shows the last saved result with no local quiz running', async () => {
    const { __resetAuthForTests } = await import('@/lib/auth');
    __resetAuthForTests();
    const user = {
      id: 'u-1',
      email: 'a@b.c',
      name: null,
      role: 'STUDENT',
      createdAt: '2026-01-01',
    };
    const json = (data: unknown, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      statusText: 'OK',
      headers: { get: () => 'application/json' },
      json: async () => data,
      text: async () => JSON.stringify(data),
    });
    global.fetch = jest.fn((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(json(user));
      if (u.endsWith('/api/v1/progress/snapshot'))
        return Promise.resolve(
          json({ userId: 'u-1', studiedKeys: [], bodyModel: null, updatedAt: null })
        );
      if (u.includes('/api/v1/progress/quiz-attempts'))
        return Promise.resolve(json([{ id: 'a1', score: 4, total: 5 }]));
      return Promise.resolve(json({}, 404));
    }) as unknown as typeof fetch;
    renderWithProvider();
    await screen.findByTestId('anatomy-session-synced-quiz', {}, { timeout: 4000 });
    expect(screen.getByTestId('anatomy-session-synced-quiz')).toHaveTextContent('4 / 5');
    // Local quiz state is untouched: still shows the empty state alongside.
    expect(screen.getByTestId('anatomy-session-quiz-empty')).toBeInTheDocument();
    (global.fetch as jest.Mock).mockRestore?.();
  });
});
