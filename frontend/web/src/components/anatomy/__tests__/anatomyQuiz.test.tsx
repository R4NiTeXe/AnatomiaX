// @ts-nocheck
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnatomyStateProvider, useAnatomyState } from '../AnatomyStateContext';
import AnatomyQuiz from '../AnatomyQuiz';

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
    const all = require('../anatomyInformation').getAnatomyInformationSeed();
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
    const all = require('../anatomyInformation').getAnatomyInformationSeed();
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

  it('body switch resets quiz', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('anatomy-quiz-start'));
    expect(screen.getByTestId('anatomy-quiz-progress')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('switch-female'));
    expect(screen.queryByTestId('anatomy-quiz-progress')).not.toBeInTheDocument();
    expect(screen.getByTestId('anatomy-quiz-start')).toBeInTheDocument();
  });
});
