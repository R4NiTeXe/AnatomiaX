import '@testing-library/jest-dom';
import { __resetAuthForTests, login } from '../auth';
import {
  getProgressSnapshot,
  listQuizAttempts,
  mergeStudiedKeys,
  submitQuizAttempt,
} from '../progress';

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

const SESSION = {
  user: { id: 'u1', email: 'a@b.c', name: null, role: 'STUDENT', createdAt: '2026-01-01' },
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
};

describe('progress client', () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  beforeEach(() => {
    __resetAuthForTests();
    calls.length = 0;
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      calls.push({ url: url as string, init });
      if ((url as string).endsWith('/api/v1/auth/login'))
        return Promise.resolve(jsonResponse(SESSION));
      return Promise.resolve(jsonResponse({ ok: true }));
    }) as unknown as typeof fetch;
  });

  it('submits completed attempts with the full payload', async () => {
    await login('a@b.c', 'password123');
    calls.length = 0;
    await submitQuizAttempt({
      bodyModel: 'male',
      score: 4,
      total: 5,
      answers: [{ structureKey: 'k', selected: 1, correct: 0 }],
      startedAt: '2026-09-01T10:00:00.000Z',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://localhost:3000/api/v1/progress/quiz-attempts');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(calls[0].init?.body as string)).toMatchObject({
      bodyModel: 'male',
      score: 4,
      total: 5,
    });
  });

  it('lists attempts with a limit query', async () => {
    await login('a@b.c', 'password123');
    calls.length = 0;
    await listQuizAttempts(7);
    expect(calls[0].url).toBe('http://localhost:3000/api/v1/progress/quiz-attempts?limit=7');
  });

  it('fetches the snapshot and merges studied keys additively', async () => {
    await login('a@b.c', 'password123');
    calls.length = 0;
    await getProgressSnapshot();
    expect(calls[0].url).toBe('http://localhost:3000/api/v1/progress/snapshot');
    await mergeStudiedKeys(['a', 'b'], 'female');
    const merge = calls[1];
    expect(merge.url).toBe('http://localhost:3000/api/v1/progress/snapshot/studied');
    expect(merge.init?.method).toBe('PATCH');
    expect(JSON.parse(merge.init?.body as string)).toEqual({
      keys: ['a', 'b'],
      bodyModel: 'female',
    });
  });
});
