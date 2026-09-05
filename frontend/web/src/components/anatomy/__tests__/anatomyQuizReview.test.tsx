// @ts-nocheck
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnatomyStateProvider, useAnatomyState } from '../AnatomyStateContext';
import AnatomyQuiz from '../AnatomyQuiz';
import AnatomySessionPanel from '../AnatomySessionPanel';
import type { AnatomySystemKey } from '../anatomyTypes';

const ALL_SYSTEMS: AnatomySystemKey[] = [
  'skin',
  'musculoskeletal',
  'nervous',
  'cardiovascular',
  'respiratory',
  'digestive',
  'urinary',
  'reproductive',
  'lymphatic',
];

function Harness() {
  const {
    quizQuestions,
    quizIndex,
    quizAnswers,
    selectedStructure,
    visibleSystems,
    toggleSystem,
    startQuiz,
    answerQuiz,
    nextQuizQuestion,
    retryQuiz,
    resetQuiz,
    setSelectedBodyModel,
  } = useAnatomyState();
  const current = quizQuestions[quizIndex];
  return (
    <div>
      <AnatomyQuiz />
      <AnatomySessionPanel />
      <span data-testid="dbg-answers-count">{quizAnswers.length}</span>
      <span data-testid="dbg-incorrect">
        {quizAnswers.filter(a => a.selectedChoice !== a.correctIndex).length}
      </span>
      <span data-testid="dbg-q0-key">{quizQuestions[0]?.structureKey ?? 'none'}</span>
      <span data-testid="dbg-selected">{selectedStructure?.structureKey ?? 'null'}</span>
      <button data-testid="start" onClick={() => startQuiz()}>
        start
      </button>
      <button
        data-testid="answer-correct"
        onClick={() => {
          if (current) answerQuiz(current.correctIndex);
        }}
      >
        correct
      </button>
      <button
        data-testid="answer-wrong"
        onClick={() => {
          if (current) answerQuiz((current.correctIndex + 1) % current.choices.length);
        }}
      >
        wrong
      </button>
      <button data-testid="next" onClick={() => nextQuizQuestion()}>
        next
      </button>
      <button data-testid="retry" onClick={() => retryQuiz()}>
        retry
      </button>
      <button data-testid="reset" onClick={() => resetQuiz()}>
        reset
      </button>
      <button data-testid="switch-female" onClick={() => setSelectedBodyModel('female')}>
        female
      </button>
      <button
        data-testid="show-all"
        onClick={() => {
          ALL_SYSTEMS.forEach(k => {
            if (!visibleSystems[k]) toggleSystem(k);
          });
        }}
      >
        show-all
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

function completeQuiz(pattern: ('correct' | 'wrong')[]) {
  fireEvent.click(screen.getByTestId('start'));
  pattern.forEach((kind, i) => {
    fireEvent.click(screen.getByTestId(kind === 'correct' ? 'answer-correct' : 'answer-wrong'));
    if (i < pattern.length - 1) fireEvent.click(screen.getByTestId('next'));
  });
}

describe('AnatomyQuizReview', () => {
  it('answer history recording', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('start'));
    fireEvent.click(screen.getByTestId('answer-correct'));
    expect(screen.getByTestId('dbg-answers-count')).toHaveTextContent('1');
  });

  it('one record per question', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('start'));
    fireEvent.click(screen.getByTestId('answer-correct'));
    fireEvent.click(screen.getByTestId('answer-wrong'));
    expect(screen.getByTestId('dbg-answers-count')).toHaveTextContent('1');
  });

  it('answers preserved across Next', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('start'));
    fireEvent.click(screen.getByTestId('answer-correct'));
    fireEvent.click(screen.getByTestId('next'));
    fireEvent.click(screen.getByTestId('answer-wrong'));
    expect(screen.getByTestId('dbg-answers-count')).toHaveTextContent('2');
  });

  it('completed review renders all 5', () => {
    renderWithProvider();
    completeQuiz(['correct', 'wrong', 'correct', 'wrong', 'correct']);
    expect(screen.getByTestId('anatomy-quiz-review')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-quiz-review-list')).toBeInTheDocument();
    expect(screen.getAllByTestId(/anatomy-quiz-review-item-/)).toHaveLength(5);
  });

  it('selected vs correct answer displayed', () => {
    renderWithProvider();
    completeQuiz(['correct', 'wrong', 'correct', 'wrong', 'correct']);
    const selected = screen.getByTestId('anatomy-quiz-review-selected-0').textContent || '';
    const correct = screen.getByTestId('anatomy-quiz-review-correct-0').textContent || '';
    expect(selected).toMatch(/Your answer:/);
    expect(correct).toMatch(/Correct answer:/);
    expect(screen.getByTestId('anatomy-quiz-review-status-0')).toHaveTextContent('Correct');
    expect(screen.getByTestId('anatomy-quiz-review-status-1')).toHaveTextContent('Incorrect');
  });

  it('incorrect count', () => {
    renderWithProvider();
    completeQuiz(['correct', 'wrong', 'correct', 'wrong', 'correct']);
    expect(screen.getByTestId('dbg-incorrect')).toHaveTextContent('2');
    expect(screen.getByTestId('anatomy-quiz-review-summary')).toHaveTextContent(/2 incorrect/);
  });

  it('Review incorrect action filters', () => {
    renderWithProvider();
    completeQuiz(['correct', 'wrong', 'correct', 'wrong', 'correct']);
    fireEvent.click(screen.getByTestId('anatomy-quiz-review-incorrect'));
    expect(screen.getAllByTestId(/anatomy-quiz-review-item-/)).toHaveLength(2);
    expect(screen.getByTestId('anatomy-quiz-review-status-0')).toHaveTextContent('Incorrect');
    expect(screen.getByTestId('anatomy-quiz-review-status-1')).toHaveTextContent('Incorrect');
  });

  it('revisit action calls existing selection path', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('show-all'));
    completeQuiz(['wrong', 'correct', 'correct', 'correct', 'correct']);
    // First item is incorrect (Q1 answered wrong) — revisit it
    fireEvent.click(screen.getByTestId('anatomy-quiz-review-structure-0'));
    const expected = screen.getByTestId('dbg-q0-key').textContent;
    expect(screen.getByTestId('dbg-selected')).toHaveTextContent(expected);
  });

  it('Retry clears review history', () => {
    renderWithProvider();
    completeQuiz(['correct', 'wrong', 'correct', 'wrong', 'correct']);
    expect(screen.getByTestId('dbg-answers-count')).toHaveTextContent('5');
    fireEvent.click(screen.getByTestId('retry'));
    expect(screen.getByTestId('dbg-answers-count')).toHaveTextContent('0');
    expect(screen.queryByTestId('anatomy-quiz-review')).not.toBeInTheDocument();
  });

  it('New Quiz clears review history', () => {
    renderWithProvider();
    completeQuiz(['correct', 'wrong', 'correct', 'wrong', 'correct']);
    expect(screen.getByTestId('dbg-answers-count')).toHaveTextContent('5');
    fireEvent.click(screen.getByTestId('reset'));
    expect(screen.getByTestId('dbg-answers-count')).toHaveTextContent('0');
    expect(screen.queryByTestId('anatomy-quiz-review')).not.toBeInTheDocument();
    expect(screen.getByTestId('anatomy-quiz-start')).toBeInTheDocument();
  });

  it('body switch clears review history', () => {
    renderWithProvider();
    completeQuiz(['correct', 'wrong', 'correct', 'wrong', 'correct']);
    expect(screen.getByTestId('dbg-answers-count')).toHaveTextContent('5');
    fireEvent.click(screen.getByTestId('switch-female'));
    expect(screen.getByTestId('dbg-answers-count')).toHaveTextContent('0');
    expect(screen.queryByTestId('anatomy-quiz-review')).not.toBeInTheDocument();
  });

  it('all-correct completion state', () => {
    renderWithProvider();
    completeQuiz(['correct', 'correct', 'correct', 'correct', 'correct']);
    expect(screen.getByTestId('anatomy-quiz-review-all-correct')).toBeInTheDocument();
    expect(screen.queryByTestId('anatomy-quiz-review-incorrect')).not.toBeInTheDocument();
    expect(screen.getByTestId('anatomy-session-review')).toHaveTextContent(/0 incorrect/);
  });

  it('session shows compact review, not full list', () => {
    renderWithProvider();
    completeQuiz(['correct', 'wrong', 'correct', 'wrong', 'correct']);
    expect(screen.getByTestId('anatomy-session-review')).toHaveTextContent(/2 incorrect/);
    expect(screen.queryByTestId('anatomy-session-quiz-review-list')).not.toBeInTheDocument();
  });
});
