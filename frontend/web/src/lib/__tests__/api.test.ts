import { ApiError, buildApiUrl, getApiBaseUrl, getHealth } from '../api';

describe('api client', () => {
  const originalEnv = process.env.VITE_API_BASE_URL;
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalEnv === undefined)
      delete (process.env as Record<string, string | undefined>).VITE_API_BASE_URL;
    else process.env.VITE_API_BASE_URL = originalEnv;
    global.fetch = originalFetch;
  });

  describe('getApiBaseUrl', () => {
    it('normalizes trailing slash', () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000/';
      expect(getApiBaseUrl()).toBe('http://localhost:3000');
    });

    it('normalizes multiple trailing slashes', () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000///';
      expect(getApiBaseUrl()).toBe('http://localhost:3000');
    });

    it('returns without trailing slash unchanged', () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000';
      expect(getApiBaseUrl()).toBe('http://localhost:3000');
    });

    it('defaults to http://localhost:3000 when env missing', () => {
      delete (process.env as Record<string, string | undefined>).VITE_API_BASE_URL;
      expect(getApiBaseUrl()).toBe('http://localhost:3000');
    });
  });

  describe('buildApiUrl', () => {
    it('builds url with leading slash', () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000';
      expect(buildApiUrl('/api/health')).toBe('http://localhost:3000/api/health');
    });

    it('builds url without leading slash', () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000';
      expect(buildApiUrl('api/health')).toBe('http://localhost:3000/api/health');
    });

    it('handles trailing slash in base', () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000/';
      expect(buildApiUrl('/api/health')).toBe('http://localhost:3000/api/health');
    });
  });

  describe('getHealth', () => {
    it('GET /api/health returns { status: ok }', async () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000';
      const mockJson = jest.fn().mockResolvedValue({ status: 'ok' });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'application/json' },
        json: mockJson,
      } as unknown as Response);

      const res = await getHealth();
      expect(res).toEqual({ status: 'ok' });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/health',
        expect.objectContaining({})
      );
    });

    it('handles JSON response correctly', async () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'application/json' },
        json: jest.fn().mockResolvedValue({ status: 'ok' }),
      } as unknown as Response);

      await expect(getHealth()).resolves.toEqual({ status: 'ok' });
    });

    it('throws ApiError on network failure', async () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000';
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

      await expect(getHealth()).rejects.toBeInstanceOf(ApiError);
      await expect(getHealth()).rejects.toThrow(/Failed to fetch/);
    });

    it('throws ApiError on non-ok status', async () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000';
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: { get: () => 'application/json' },
        text: jest.fn().mockResolvedValue('boom'),
      } as unknown as Response);

      await expect(getHealth()).rejects.toBeInstanceOf(ApiError);
      try {
        await getHealth();
        throw new Error('should have thrown');
      } catch (e) {
        const err = e as ApiError;
        expect(err.status).toBe(500);
        expect(err.url).toBe('http://localhost:3000/api/health');
      }
    });

    it('throws typed error with url', async () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000';
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      try {
        await getHealth();
        throw new Error('should have thrown');
      } catch (e) {
        const err = e as ApiError;
        expect(err).toBeInstanceOf(ApiError);
        expect(err.url).toBe('http://localhost:3000/api/health');
        expect(err.name).toBe('ApiError');
      }
    });

    it('does not throw uncaught — caller can catch', async () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000';
      global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
      // Should not throw unhandled, just reject
      const promise = getHealth();
      await expect(promise).rejects.toBeInstanceOf(Error);
    });
  });

  describe('8.19.25 error contract', () => {
    const contractResponse = (body: Record<string, unknown>, requestId = 'req-123') =>
      ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: (name: string) => (name === 'x-request-id' ? requestId : null) },
        text: jest.fn().mockResolvedValue(JSON.stringify(body)),
      }) as unknown as Response;

    it('surfaces the contract message, code, and request id', async () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000';
      global.fetch = jest.fn().mockResolvedValue(
        contractResponse({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
          requestId: 'req-123',
        })
      );

      try {
        await getHealth();
        throw new Error('should have thrown');
      } catch (e) {
        const err = e as ApiError;
        expect(err).toBeInstanceOf(ApiError);
        expect(err.message).toBe('Invalid credentials');
        expect(err.status).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.requestId).toBe('req-123');
      }
    });

    it('attaches validation details', async () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000';
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: { get: () => 'req-400' },
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: ['email must be an email'],
            requestId: 'req-400',
          })
        ),
      } as unknown as Response);

      try {
        await getHealth();
        throw new Error('should have thrown');
      } catch (e) {
        const err = e as ApiError;
        expect(err.code).toBe('VALIDATION_ERROR');
        expect(err.details).toEqual(['email must be an email']);
        expect(err.requestId).toBe('req-400');
      }
    });

    it('falls back to the header request id when the body lacks one', async () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000';
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          contractResponse({ code: 'NOT_FOUND', message: 'Cohort not found' }, 'req-hdr')
        );

      try {
        await getHealth();
        throw new Error('should have thrown');
      } catch (e) {
        expect((e as ApiError).requestId).toBe('req-hdr');
      }
    });

    it('keeps the legacy fallback for non-contract payloads', async () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000';
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: { get: () => null },
        text: jest.fn().mockResolvedValue('boom'),
      } as unknown as Response);

      try {
        await getHealth();
        throw new Error('should have thrown');
      } catch (e) {
        const err = e as ApiError;
        expect(err.message).toMatch(/Request failed 500/);
        expect(err.code).toBeUndefined();
      }
    });
  });
});
