import {
  addQuestion,
  archiveQuiz,
  deleteQuestion,
  deleteQuiz,
  getQuiz,
  getQuizStats,
  listQuizzes,
  publishQuiz,
} from '../quizzes';

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

describe('admin quiz client', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
    (global.fetch as unknown as jest.Mock) = jest.fn(() =>
      Promise.resolve(jsonResponse({ status: 'ok' }))
    );
  });

  afterEach(() => {
    delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_API_BASE_URL;
  });

  it('lists quizzes without filters', async () => {
    await listQuizzes();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/quizzes',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('gets one quiz by id', async () => {
    await getQuiz('q1');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/quizzes/q1',
      expect.anything()
    );
  });

  it('publishes and archives with POST', async () => {
    await publishQuiz('q1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/publish'),
      expect.objectContaining({ method: 'POST' })
    );
    await archiveQuiz('q1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/archive'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('deletes a quiz with DELETE', async () => {
    await deleteQuiz('q1');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/quizzes/q1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('posts new questions with the payload intact', async () => {
    await addQuestion('q1', { prompt: 'P?', options: ['a', 'b'], correctIndex: 1 });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/quizzes/q1/questions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ prompt: 'P?', options: ['a', 'b'], correctIndex: 1 }),
      })
    );
  });

  it('deletes questions with DELETE', async () => {
    await deleteQuestion('q1', 'qq1');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/quizzes/q1/questions/qq1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('fetches stats', async () => {
    await getQuizStats('q1');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/quizzes/q1/stats',
      expect.anything()
    );
  });
});
