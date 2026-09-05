import { useAnatomyState } from './AnatomyStateContext';
import { getAnatomyInformation } from './anatomyInformation';
import { getAnatomySystem } from './anatomyAssetConfig';

export default function AnatomySessionPanel(): JSX.Element {
  const {
    recentHistory,
    quizQuestions,
    quizScore,
    quizCompleted,
    quizAnswers,
    compareStructure,
    selectedStructure,
    selectedBodyModel,
  } = useAnatomyState();

  const studiedCount = recentHistory.length;
  const hasQuiz = quizQuestions.length > 0;
  const hasCompare = !!(selectedStructure && compareStructure);
  const totalQuestions = quizQuestions.length;
  const correct = quizScore;
  const incorrect = hasQuiz ? totalQuestions - quizScore : 0;
  const reviewIncorrect =
    quizAnswers.length > 0
      ? quizAnswers.filter(a => a.selectedChoice !== a.correctIndex).length
      : incorrect;

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4"
      data-testid="anatomy-session-panel"
      aria-label="Learning session"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Session</h2>
        <span
          className="rounded bg-slate-800 px-2 py-0.5 text-xs capitalize text-slate-400"
          data-testid="anatomy-session-body-model"
        >
          {selectedBodyModel}
        </span>
      </div>

      {/* Studied */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Studied{' '}
          <span className="normal-case text-slate-400" data-testid="anatomy-session-studied-count">
            {studiedCount}
          </span>
        </p>
        {studiedCount === 0 ? (
          <p className="mt-1 text-xs text-slate-500" data-testid="anatomy-session-studied-empty">
            No structures studied yet
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1" data-testid="anatomy-session-studied-list">
            {recentHistory.map(item => {
              const display = getAnatomyInformation(item)?.canonicalName || item.name;
              const systemLabel = getAnatomySystem(item.systemKey as never).label;
              return (
                <li
                  key={item.structureKey}
                  className="flex items-center justify-between gap-2 text-xs"
                  data-testid="anatomy-session-studied-item"
                >
                  <span className="truncate text-slate-200">{display}</span>
                  <span className="shrink-0 text-slate-500">{systemLabel}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Quiz */}
      <div className="border-t border-slate-800 pt-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Quiz</p>
        {!hasQuiz ? (
          <p className="mt-1 text-xs text-slate-500" data-testid="anatomy-session-quiz-empty">
            No quiz yet
          </p>
        ) : quizCompleted ? (
          <div className="mt-1 flex flex-col gap-1" data-testid="anatomy-session-quiz-summary">
            <p className="text-sm text-slate-200" data-testid="anatomy-session-quiz-score">
              Score {correct} / {totalQuestions}
            </p>
            <p className="text-xs text-slate-400" data-testid="anatomy-session-quiz-detail">
              {correct} correct • {incorrect} incorrect
            </p>
            <p className="text-xs text-slate-500" data-testid="anatomy-session-review">
              Review: {reviewIncorrect} incorrect
            </p>
          </div>
        ) : (
          <p className="mt-1 text-xs text-slate-400" data-testid="anatomy-session-quiz-progress">
            In progress • {totalQuestions} questions
          </p>
        )}
      </div>

      {/* Comparison */}
      <div className="border-t border-slate-800 pt-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Comparison</p>
        {!hasCompare || !selectedStructure || !compareStructure ? (
          <p className="mt-1 text-xs text-slate-500" data-testid="anatomy-session-compare-empty">
            No comparison
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-300" data-testid="anatomy-session-compare">
            <span className="text-slate-200">
              {getAnatomyInformation(selectedStructure)?.canonicalName || selectedStructure.name}
            </span>{' '}
            vs{' '}
            <span className="text-slate-200">
              {getAnatomyInformation(compareStructure)?.canonicalName || compareStructure.name}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
