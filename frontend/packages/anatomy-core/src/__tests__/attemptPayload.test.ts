import { buildAttemptInput } from '../attemptPayload';

const questions = [
  { id: 'q1', structureKey: 'male:skin:UBERON:0002097', canonicalName: 'Skin' },
  { id: 'q2', structureKey: 'male:nervous:UBERON:0000955', canonicalName: 'Brain' },
];
const answers = [
  { questionId: 'q1', selectedChoice: 0, correctIndex: 0 },
  { questionId: 'q2', selectedChoice: 1, correctIndex: 2 },
];

describe('buildAttemptInput', () => {
  it('builds a structurally complete payload', () => {
    const input = buildAttemptInput(questions, answers, 1, 'male');
    expect(input).toMatchObject({
      bodyModel: 'male',
      score: 1,
      total: 2,
      answers: [
        {
          structureKey: 'male:skin:UBERON:0002097',
          canonicalName: 'Skin',
          selected: 0,
          correct: 0,
        },
        {
          structureKey: 'male:nervous:UBERON:0000955',
          canonicalName: 'Brain',
          selected: 1,
          correct: 2,
        },
      ],
    });
    expect(typeof input?.startedAt).toBe('string');
  });

  it('rejects inconsistent question sets', () => {
    expect(buildAttemptInput([], [], 0, 'male')).toBeNull();
    expect(buildAttemptInput(questions, answers.slice(0, 1), 1, 'male')).toBeNull();
    expect(
      buildAttemptInput(
        questions,
        [{ questionId: 'ghost', selectedChoice: 0, correctIndex: 0 }],
        0,
        'male'
      )
    ).toBeNull();
  });
});
