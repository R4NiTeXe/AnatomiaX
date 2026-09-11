import { ApiError } from '../client';
import { __resetAuthForTests, authedRequest, fetchMe, login, logout, register } from '../auth';

jest.mock('../../lib/secureStore', () => {
  let store: Record<string, string> = {};
  return {
    saveSession: jest.fn(async (accessToken: string, refreshToken: string) => {
      store.accessToken = accessToken;
      store.refreshToken = refreshToken;
    }),
    loadAccessToken: jest.fn(async () => store.accessToken ?? null),
    loadSession: jest.fn(async () =>
      store.accessToken && store.refreshToken
        ? { accessToken: store.accessToken, refreshToken: store.refreshToken }
        : null
    ),
    clearSession: jest.fn(async () => {
      store = {};
    }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const secureStore = require('../../lib/secureStore') as {
  saveSession: jest.Mock;
  loadSession: jest.Mock;
  loadAccessToken: jest.Mock;
  clearSession: jest.Mock;
};

const userA = { id: 'user-a', email: 'a@example.com', name: 'A', role: 'STUDENT', createdAt: 'x' };
const userB = { id: 'user-b', email: 'b@example.com', name: 'B', role: 'STUDENT', createdAt: 'x' };

const sessionBody = (user: typeof userA, accessToken: string, refreshToken: string) => ({
  user,
  accessToken,
  refreshToken,
});

function okJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function contractError(status: number, code: string, message: string) {
  return {
    ok: false,
    status,
    statusText: message,
    headers: { get: () => 'req-test' },
    text: jest.fn().mockResolvedValue(JSON.stringify({ code, message, requestId: 'req-test' })),
  } as unknown as Response;
}

describe('mobile auth client (8.19.26)', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    __resetAuthForTests();
    await secureStore.clearSession();
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('logs in and persists credentials to secure storage', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJson(sessionBody(userA, 'access-A', 'refresh-A')));
    const user = await login('a@example.com', 'password123');
    expect(user).toMatchObject({ id: 'user-a', email: 'a@example.com' });
    expect(secureStore.saveSession).toHaveBeenCalledWith('access-A', 'refresh-A');
    expect(secureStore.loadSession).toBeDefined();
    const stored = await secureStore.loadSession();
    expect(stored).toEqual({ accessToken: 'access-A', refreshToken: 'refresh-A' });
  });

  it('registers with an optional name', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJson(sessionBody(userA, 'access-A', 'refresh-A')));
    await register('a@example.com', 'password123', 'Ada');
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ email: 'a@example.com', name: 'Ada' });
  });

  it('sends Authorization: Bearer on authenticated calls', async () => {
    await secureStore.saveSession('access-A', 'refresh-A');
    global.fetch = jest.fn().mockResolvedValue(okJson(userA));
    await fetchMe();
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-A');
  });

  it('401 → refresh (JSON body) → retry succeeds exactly once', async () => {
    await secureStore.saveSession('expired', 'refresh-A');
    const calls: Array<[string, RequestInit | undefined]> = [];
    global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      calls.push([url, init]);
      if (url.endsWith('/api/v1/auth/refresh')) {
        return Promise.resolve(okJson(sessionBody(userA, 'access-A2', 'refresh-A2')));
      }
      if (url.endsWith('/api/v1/auth/me')) {
        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
        if (auth === 'Bearer access-A2') return Promise.resolve(okJson(userA));
        return Promise.resolve(contractError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
      }
      throw new Error(`unexpected ${url}`);
    });

    const me = await fetchMe();
    expect(me).toMatchObject({ id: 'user-a' });
    const refreshCalls = calls.filter(([url]) => url.endsWith('/api/v1/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
    // Mobile path: refresh token travels in the JSON body, never a cookie.
    expect(JSON.parse(refreshCalls[0][1]?.body as string)).toEqual({ refreshToken: 'refresh-A' });
    expect(await secureStore.loadSession()).toEqual({
      accessToken: 'access-A2',
      refreshToken: 'refresh-A2',
    });
  });

  it('concurrent 401s share a single refresh (single-flight)', async () => {
    await secureStore.saveSession('expired', 'refresh-A');
    let refreshCount = 0;
    global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCount += 1;
        return Promise.resolve(okJson(sessionBody(userA, 'access-new', 'refresh-new')));
      }
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (auth === 'Bearer access-new') return Promise.resolve(okJson(userA));
      return Promise.resolve(contractError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
    });

    const results = await Promise.all([fetchMe(), fetchMe(), fetchMe()]);
    expect(refreshCount).toBe(1);
    for (const result of results) expect(result).toMatchObject({ id: 'user-a' });
  });

  it('clears credentials when refresh fails', async () => {
    await secureStore.saveSession('expired', 'dead-refresh');
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.endsWith('/api/v1/auth/refresh')) {
        return Promise.resolve(contractError(401, 'UNAUTHORIZED', 'Invalid credentials'));
      }
      return Promise.resolve(contractError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
    });

    await expect(
      authedRequest('/api/v1/auth/me').catch(err => {
        expect(err).toBeInstanceOf(ApiError);
        throw err;
      })
    ).rejects.toBeInstanceOf(ApiError);
    expect(await secureStore.loadSession()).toBeNull();
  });

  it('logout clears secure storage even when the server call fails', async () => {
    await secureStore.saveSession('access-A', 'refresh-A');
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await logout();
    expect(await secureStore.loadSession()).toBeNull();
  });

  it('user switching cannot leak the previous session', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(okJson(sessionBody(userA, 'access-A', 'refresh-A')))
      .mockResolvedValueOnce(okJson(sessionBody(userB, 'access-B', 'refresh-B')));
    await login('a@example.com', 'password123');
    await login('b@example.com', 'password123');
    const stored = await secureStore.loadSession();
    expect(stored).toEqual({ accessToken: 'access-B', refreshToken: 'refresh-B' });
    expect(JSON.stringify(stored)).not.toContain('access-A');
  });

  it('fetchMe returns null (never throws) when anonymous', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(contractError(401, 'UNAUTHORIZED', 'Authentication required'));
    await expect(fetchMe()).resolves.toBeNull();
  });
});
