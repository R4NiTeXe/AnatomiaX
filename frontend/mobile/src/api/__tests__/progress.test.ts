import {
  buildPracticeAnswers,
  getProgressSnapshot,
  listQuizAttempts,
  mergeStudiedKeys,
  submitQuizAttempt,
} from '../progress';

jest.mock('../../lib/secureStore', () => ({
  saveSession: jest.fn(async () => undefined),
  loadAccessToken: jest.fn(async () => 'access-T'),
  loadSession: jest.fn(async () => ({ accessToken: 'access-T', refreshToken: 'refresh-T' })),
  clearSession: jest.fn(async () => undefined),
}));

function okJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('mobile progress api (8.19.27)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads the snapshot', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJson({ studiedKeys: ['a'], bodyModel: 'male' }));
    await expect(getProgressSnapshot()).resolves.toMatchObject({ studiedKeys: ['a'] });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/api/v1/progress/snapshot');
  });

  it('merges studied keys with and without a body model', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJson({ studiedKeys: ['a', 'b'] }));
    await mergeStudiedKeys(['b']);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ keys: ['b'] });

    (global.fetch as jest.Mock).mockResolvedValue(okJson({ studiedKeys: ['a', 'b'] }));
    await mergeStudiedKeys(['b'], 'female');
    const [, init2] = (global.fetch as jest.Mock).mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(init2.body as string)).toEqual({ keys: ['b'], bodyModel: 'female' });
  });

  it('submits a completed attempt and lists history with a limit', async () => {
    const attempt = { id: 'att-1', score: 4, total: 5 };
    global.fetch = jest.fn().mockResolvedValue(okJson(attempt));
    await submitQuizAttempt({
      bodyModel: 'male',
      score: 4,
      total: 5,
      answers: buildPracticeAnswers(4, 5),
      startedAt: '2026-09-01T10:00:00.000Z',
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/api/v1/progress/quiz-attempts')).toBe(true);
    expect(init.method).toBe('POST');
    const sent = JSON.parse(init.body as string) as {
      answers: unknown[];
      score: number;
      total: number;
    };
    expect(sent.answers).toHaveLength(5);
    expect(sent.score).toBe(4);

    (global.fetch as jest.Mock).mockResolvedValue(okJson([attempt]));
    await listQuizAttempts();
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain(
      '/api/v1/progress/quiz-attempts?limit=20'
    );
    (global.fetch as jest.Mock).mockResolvedValue(okJson([attempt]));
    await listQuizAttempts(5);
    expect((global.fetch as jest.Mock).mock.calls[2][0]).toContain(
      '/api/v1/progress/quiz-attempts?limit=5'
    );
  });

  it('builds practice answers without fabricated anatomy claims', async () => {
    const answers = buildPracticeAnswers(2, 3);
    expect(answers).toHaveLength(3);
    expect(answers[0]).toEqual({ selected: 1, correct: 1 });
    expect(answers[2]).toEqual({ selected: 0, correct: 0 });
    for (const answer of answers) {
      expect(answer).not.toHaveProperty('structureKey');
      expect(answer).not.toHaveProperty('canonicalName');
    }
  });
});
