import { ApiError, apiRequest, buildApiUrl, getApiBaseUrl } from '../api';

describe('admin api client', () => {
  const originalNext = process.env.NEXT_PUBLIC_API_BASE_URL;
  const originalVite = process.env.VITE_API_BASE_URL;
  const originalFetch = global.fetch;

  const restoreEnv = () => {
    if (originalNext === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = originalNext;
    if (originalVite === undefined) delete process.env.VITE_API_BASE_URL;
    else process.env.VITE_API_BASE_URL = originalVite;
  };

  beforeEach(() => {
    restoreEnv();
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.VITE_API_BASE_URL;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restoreEnv();
    global.fetch = originalFetch;
  });

  describe('getApiBaseUrl', () => {
    it('prefers NEXT_PUBLIC_API_BASE_URL and normalizes slashes', () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com/';
      expect(getApiBaseUrl()).toBe('https://api.example.com');
    });

    it('falls back to VITE_API_BASE_URL when Next var is missing', () => {
      process.env.VITE_API_BASE_URL = 'http://localhost:3000/';
      expect(getApiBaseUrl()).toBe('http://localhost:3000');
    });

    it('defaults to http://localhost:3000 when env missing', () => {
      expect(getApiBaseUrl()).toBe('http://localhost:3000');
    });

    it('throws a clear error in production builds when env missing', () => {
      // NODE_ENV is a declared read-only prop on this @types/node ProcessEnv
      // (index-signature keys like NEXT_PUBLIC_* are still mutable), so all
      // writes go through a mutable record view.
      const env = process.env as Record<string, string | undefined>;
      const originalNodeEnv = env.NODE_ENV;
      env.NODE_ENV = 'production';
      try {
        expect(() => getApiBaseUrl()).toThrow('NEXT_PUBLIC_API_BASE_URL is not set');
      } finally {
        if (originalNodeEnv === undefined) delete env.NODE_ENV;
        else env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('buildApiUrl', () => {
    it('builds versioned paths on an origin base', () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
      expect(buildApiUrl('/api/v1/admin/overview')).toBe(
        'https://api.example.com/api/v1/admin/overview'
      );
    });

    it('strips a versioned base prefix instead of doubling /api/v1', () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com/api/v1';
      expect(buildApiUrl('/api/v1/auth/login')).toBe('https://api.example.com/api/v1/auth/login');
    });

    it('keeps origin bases untouched', () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
      expect(buildApiUrl('api/health')).toBe('https://api.example.com/api/health');
    });
  });

  describe('apiRequest', () => {
    const jsonResponse = (data: unknown, status = 200) =>
      ({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        headers: { get: () => 'application/json' },
        json: async () => data,
        text: async () => JSON.stringify(data),
      }) as unknown as Response;

    beforeEach(() => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    });

    it('returns parsed JSON on success', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ totalUsers: 1 }));
      await expect(apiRequest('/api/v1/admin/overview')).resolves.toEqual({ totalUsers: 1 });
    });

    it('throws ApiError on network failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
      await expect(apiRequest('/api/v1/admin/overview')).rejects.toBeInstanceOf(ApiError);
    });

    it('surfaces the contract message, code, and request id', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: { get: (name: string) => (name === 'x-request-id' ? 'req-1' : null) },
        text: jest.fn().mockResolvedValue(JSON.stringify({ code: 'FORBIDDEN', message: 'Nope' })),
      } as unknown as Response);
      try {
        await apiRequest('/api/v1/admin/overview');
        throw new Error('should have thrown');
      } catch (e) {
        const err = e as ApiError;
        expect(err.message).toBe('Nope');
        expect(err.code).toBe('FORBIDDEN');
        expect(err.requestId).toBe('req-1');
      }
    });

    it('resolves undefined for 204 No Content', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: { get: () => null },
      } as unknown as Response);
      await expect(apiRequest('/api/v1/admin/overview')).resolves.toBeUndefined();
    });

    it('parses text bodies when content is not JSON', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'text/plain' },
        text: jest.fn().mockResolvedValue('{"totalUsers": 3}'),
      } as unknown as Response);
      await expect(apiRequest('/api/v1/admin/overview')).resolves.toEqual({ totalUsers: 3 });
    });

    it('throws ApiError on invalid JSON payloads', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'application/json' },
        json: jest.fn().mockRejectedValue(new Error('bad json')),
        text: jest.fn().mockResolvedValue('not json{{{'),
      } as unknown as Response);
      await expect(apiRequest('/api/v1/admin/overview')).rejects.toBeInstanceOf(ApiError);
    });

    it('throws ApiError on invalid text payloads', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'text/plain' },
        text: jest.fn().mockResolvedValue('not json{{{'),
      } as unknown as Response);
      await expect(apiRequest('/api/v1/admin/overview')).rejects.toBeInstanceOf(ApiError);
    });

    it('keeps the legacy fallback for non-contract payloads', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Error',
        headers: { get: () => null },
        text: jest.fn().mockResolvedValue('boom'),
      } as unknown as Response);
      await expect(apiRequest('/api/v1/admin/overview')).rejects.toThrow(/Request failed 500/);
    });
  });
});
