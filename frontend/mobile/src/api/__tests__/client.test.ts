import { ApiError, buildApiUrl, getApiBaseUrl } from '../client';

describe('mobile api client', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalEnv === undefined)
      delete (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalEnv;
    global.fetch = originalFetch;
  });

  it('defaults to http://localhost:3000 and normalizes slashes', () => {
    delete (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_BASE_URL;
    expect(getApiBaseUrl()).toBe('http://localhost:3000');
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://192.168.1.10:3000///';
    expect(getApiBaseUrl()).toBe('http://192.168.1.10:3000');
    expect(buildApiUrl('api/health')).toBe('http://192.168.1.10:3000/api/health');
  });

  it('parses the standardized error contract', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: { get: (name: string) => (name === 'x-request-id' ? 'req-1' : null) },
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
          requestId: 'req-1',
        })
      ),
    } as unknown as Response);

    try {
      const { apiRequest } = await import('../client');
      await apiRequest('/api/v1/auth/me');
      throw new Error('should have thrown');
    } catch (e) {
      const err = e as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toBe('Invalid credentials');
      expect(err.status).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.requestId).toBe('req-1');
    }
  });

  it('attaches validation details and header request id fallback', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: { get: () => 'req-hdr' },
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: ['email must be an email'],
        })
      ),
    } as unknown as Response);

    const { apiRequest } = await import('../client');
    await expect(apiRequest('/api/v1/auth/register', { method: 'POST' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: ['email must be an email'],
      requestId: 'req-hdr',
    });
  });

  it('throws ApiError on network failure', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    const { apiRequest } = await import('../client');
    await expect(apiRequest('/api/health')).rejects.toThrow(/Failed to fetch/);
  });
});
