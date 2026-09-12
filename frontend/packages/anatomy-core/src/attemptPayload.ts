import type { AnatomyBodyModelKey } from '@anatomiax/shared-types';

export interface AttemptQuestionLike {
  id: string;
  structureKey: string;
  canonicalName: string;
}

export interface AttemptAnswerLike {
  questionId: string;
  selectedChoice: number;
  correctIndex: number;
}

export interface AttemptAnswerPayload {
  structureKey: string;
  canonicalName: string;
  selected: number;
  correct: number;
}

export interface AttemptPayloadInput {
  bodyModel: AnatomyBodyModelKey;
  score: number;
  total: number;
  answers: AttemptAnswerPayload[];
  startedAt: string;
}

/**
 * Builds a completed quiz-attempt payload for the progress API.
 * Returns null when questions/answers are inconsistent; never throws.
 * Structurally matches the backend submit contract (score/total/answers).
 */
export function buildAttemptInput(
  questions: AttemptQuestionLike[],
  answers: AttemptAnswerLike[],
  score: number,
  bodyModel: 'male' | 'female'
): AttemptPayloadInput | null {
  if (questions.length === 0 || answers.length !== questions.length) return null;
  const byId = new Map(questions.map(q => [q.id, q]));
  const payloadAnswers = [];
  for (const answer of answers) {
    const question = byId.get(answer.questionId);
    if (!question) return null;
    payloadAnswers.push({
      structureKey: question.structureKey,
      canonicalName: question.canonicalName,
      selected: answer.selectedChoice,
      correct: answer.correctIndex,
    });
  }
  return {
    bodyModel,
    score,
    total: questions.length,
    answers: payloadAnswers,
    startedAt: new Date().toISOString(),
  };
}
