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
});
