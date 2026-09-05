import { useEffect, useState } from 'react';
import { useAnatomyState } from './AnatomyStateContext';

export default function AnatomyQuiz(): JSX.Element {
  const {
    quizQuestions,
    quizIndex,
    quizScore,
    quizSelectedChoice,
    quizAnswered,
    quizAnswers,
    startQuiz,
    answerQuiz,
    nextQuizQuestion,
    retryQuiz,
    resetQuiz,
    selectedStructure,
    selectStructure,
  } = useAnatomyState();

  const hasQuiz = quizQuestions.length > 0;
  const current = hasQuiz ? quizQuestions[quizIndex] : null;
  const isLast = hasQuiz && quizIndex === quizQuestions.length - 1 && quizAnswered;

  const [showIncorrectOnly, setShowIncorrectOnly] = useState(false);
  useEffect(() => {
    setShowIncorrectOnly(false);
  }, [quizQuestions]);

  const incorrectCount = quizAnswers.filter(a => a.selectedChoice !== a.correctIndex).length;
  const correctCount = quizAnswers.filter(a => a.selectedChoice === a.correctIndex).length;
  const visibleAnswers = showIncorrectOnly
    ? quizAnswers.filter(a => a.selectedChoice !== a.correctIndex)
    : quizAnswers;

  return (
    <section
      className="rounded-xl border border-slate-800 bg-slate-900/40"
      data-testid="anatomy-quiz"
      aria-label="Anatomy quiz"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Anatomy Quiz
        </h2>
        {hasQuiz && (
          <span
            className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400"
            data-testid="anatomy-quiz-progress"
          >
            {quizIndex + 1} / {quizQuestions.length}
          </span>
        )}
      </div>

      <div className="px-4 py-3">
        {!hasQuiz ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-400">
              Test your knowledge with 5 questions on verified anatomy functions.
              {selectedStructure ? ` Starting with ${selectedStructure.name}.` : ''}
            </p>
            <button
              type="button"
              onClick={startQuiz}
              data-testid="anatomy-quiz-start"
              className="rounded-lg bg-teal-500/20 px-3 py-1.5 text-sm font-medium text-teal-300 hover:bg-teal-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              Start Quiz
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-slate-100" data-testid="anatomy-quiz-question">
              {current?.question}
            </p>
            {current && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>System: {current.systemKey}</span>
                <span>·</span>
                <span className="capitalize">{current.bodyModel}</span>
              </div>
            )}

            <div role="radiogroup" aria-label="Quiz choices" className="flex flex-col gap-2">
              {current?.choices.map((choice, idx) => {
                const isSelected = quizSelectedChoice === idx;
                const isCorrect = idx === current.correctIndex;
                const showCorrect = quizAnswered && isCorrect;
                const showIncorrect = quizAnswered && isSelected && !isCorrect;
                return (
                  <label
                    key={idx}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                      showCorrect
                        ? 'border-teal-500 bg-teal-500/20 text-teal-200'
                        : showIncorrect
                          ? 'border-red-500 bg-red-500/20 text-red-200'
                          : isSelected
                            ? 'border-teal-500 bg-slate-800 text-slate-100'
                            : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700'
                    }`}
                    data-testid={`anatomy-quiz-choice-${idx}`}
                  >
                    <input
                      type="radio"
                      name="quiz-choice"
                      value={idx}
                      checked={isSelected}
                      onChange={() => !quizAnswered && answerQuiz(idx)}
                      disabled={quizAnswered}
                      className="mt-1"
                      aria-label={`Choice ${idx + 1}`}
                    />
                    <span className="flex-1">{choice}</span>
                    {showCorrect && <span className="text-teal-300">✓</span>}
                    {showIncorrect && <span className="text-red-300">✗</span>}
                  </label>
                );
              })}
            </div>

            {quizAnswered && current && (
              <p
                className={`text-sm ${quizSelectedChoice === current.correctIndex ? 'text-teal-300' : 'text-red-300'}`}
                data-testid="anatomy-quiz-feedback"
              >
                {quizSelectedChoice === current.correctIndex ? 'Correct!' : 'Incorrect'}
                {quizSelectedChoice !== current.correctIndex && (
                  <span className="ml-2 text-slate-400">
                    Correct: {current.choices[current.correctIndex].substring(0, 80)}
                  </span>
                )}
              </p>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500" data-testid="anatomy-quiz-score">
                Score: {quizScore} / {quizQuestions.length}
              </span>
              {!isLast ? (
                <button
                  type="button"
                  onClick={nextQuizQuestion}
                  disabled={!quizAnswered}
                  data-testid="anatomy-quiz-next"
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <span
                  className="text-sm font-medium text-slate-200"
                  data-testid="anatomy-quiz-final"
                >
                  {quizScore} / {quizQuestions.length}
                </span>
              )}
            </div>

            {isLast && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={retryQuiz}
                  data-testid="anatomy-quiz-retry"
                  className="flex-1 rounded-lg bg-teal-500/20 px-3 py-1.5 text-sm font-medium text-teal-300 hover:bg-teal-500/30"
                >
                  Retry Quiz
                </button>
                <button
                  type="button"
                  onClick={resetQuiz}
                  data-testid="anatomy-quiz-reset"
                  className="flex-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800"
                >
                  New Quiz
                </button>
              </div>
            )}

            {isLast && (
              <div
                className="flex flex-col gap-2 border-t border-slate-800 pt-3"
                data-testid="anatomy-quiz-review"
              >
                <p
                  className="text-sm font-medium text-slate-200"
                  data-testid="anatomy-quiz-review-summary"
                >
                  Score {quizScore} / {quizQuestions.length} • {correctCount} correct •{' '}
                  {incorrectCount} incorrect
                </p>
                {incorrectCount === 0 ? (
                  <p
                    className="text-sm text-teal-300"
                    data-testid="anatomy-quiz-review-all-correct"
                  >
                    All correct — nice work!
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowIncorrectOnly(v => !v)}
                    aria-pressed={showIncorrectOnly}
                    data-testid="anatomy-quiz-review-incorrect"
                    className="self-start rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                  >
                    {showIncorrectOnly
                      ? `Show all (${quizAnswers.length})`
                      : `Review incorrect (${incorrectCount})`}
                  </button>
                )}
                <ul className="flex flex-col gap-2" data-testid="anatomy-quiz-review-list">
                  {visibleAnswers.map((answer, visibleIndex) => {
                    const questionIndex = quizQuestions.findIndex(q => q.id === answer.questionId);
                    const q = quizQuestions[questionIndex];
                    if (!q) return null;
                    const isCorrect = answer.selectedChoice === answer.correctIndex;
                    const handleRevisit = () => {
                      selectStructure({
                        structureKey: q.structureKey,
                        name: q.canonicalName,
                        objectName: q.canonicalName,
                        systemKey: q.systemKey,
                        bodyModel: q.bodyModel,
                        ontologyId: q.ontologyId,
                      });
                    };
                    return (
                      <li
                        key={answer.questionId}
                        className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
                        data-testid={`anatomy-quiz-review-item-${visibleIndex}`}
                      >
                        <p
                          className="text-xs font-medium text-slate-200"
                          data-testid={`anatomy-quiz-review-question-${visibleIndex}`}
                        >
                          {q.question}
                        </p>
                        <p
                          className="text-xs text-slate-500"
                          data-testid={`anatomy-quiz-review-canonical-${visibleIndex}`}
                        >
                          {q.canonicalName} • {q.systemKey}
                        </p>
                        <p
                          className="text-xs text-slate-300"
                          data-testid={`anatomy-quiz-review-selected-${visibleIndex}`}
                        >
                          Your answer: {q.choices[answer.selectedChoice] ?? '—'}
                        </p>
                        <p
                          className="text-xs text-slate-400"
                          data-testid={`anatomy-quiz-review-correct-${visibleIndex}`}
                        >
                          Correct answer: {q.choices[answer.correctIndex] ?? '—'}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-medium ${isCorrect ? 'text-teal-300' : 'text-red-300'}`}
                            data-testid={`anatomy-quiz-review-status-${visibleIndex}`}
                          >
                            {isCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                          {!isCorrect && (
                            <button
                              type="button"
                              onClick={handleRevisit}
                              data-testid={`anatomy-quiz-review-structure-${visibleIndex}`}
                              className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-teal-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                            >
                              Review structure
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
