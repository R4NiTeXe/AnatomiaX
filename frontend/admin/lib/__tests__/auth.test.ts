import {
  __resetAuthForTests,
  acceptCallbackSession,
  changePassword,
  confirmPasswordReset,
  deleteAccount,
  exportAccountData,
  fetchMe,
  googleLoginUrl,
  hasSession,
  login,
  logout,
  onUnauthenticated,
  register,
  requestPasswordReset,
} from '../auth';

const USER = { id: 'u1', email: 'a@b.c', name: null, role: 'ADMIN', createdAt: '2026-01-01' };
const SESSION = { user: USER, accessToken: 'access-1', refreshToken: 'refresh-1' };

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: () => 'application/json' },
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) =>
    Promise.resolve(handler(url as string, init))
  );
}

describe('admin auth client', () => {
  const originalNext = process.env.NEXT_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    if (originalNext === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = originalNext;
  });

  it('login posts credentials and stores the session in memory', async () => {
    mockFetch(() => jsonResponse(SESSION));
    const user = await login('a@b.c', 'password123');
    expect(user).toEqual(USER);
  });

  it('sends the Bearer token on authed requests', async () => {
    mockFetch(() => jsonResponse(SESSION));
    await login('a@b.c', 'password123');
    mockFetch((url, init) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
      expect(url).toBe('http://localhost:3000/api/v1/auth/me');
      return jsonResponse(USER);
    });
    await expect(fetchMe()).resolves.toEqual(USER);
  });

  it('refreshes once on 401 and retries (single-flight)', async () => {
    mockFetch(() => jsonResponse(SESSION));
    await login('a@b.c', 'password123');
    let refreshCalls = 0;
    let meCalls = 0;
    mockFetch(url => {
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCalls += 1;
        return jsonResponse({ ...SESSION, accessToken: 'access-2', refreshToken: 'refresh-2' });
      }
      meCalls += 1;
      if (meCalls <= 2) return jsonResponse({ message: 'Unauthorized' }, 401);
      return jsonResponse(USER);
    });
    const [first, second] = await Promise.all([fetchMe(), fetchMe()]);
    expect(first).toEqual(USER);
    expect(second).toEqual(USER);
    expect(refreshCalls).toBe(1);
  });

  it('notifies unauthenticated listeners when refresh fails', async () => {
    mockFetch(() => jsonResponse(SESSION));
    await login('a@b.c', 'password123');
    const listener = jest.fn();
    const unsubscribe = onUnauthenticated(listener);
    mockFetch(() => jsonResponse({ message: 'Unauthorized' }, 401));
    await expect(fetchMe()).resolves.toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('retains the session on transient refresh failures (network/5xx)', async () => {
    mockFetch(() => jsonResponse(SESSION));
    await login('a@b.c', 'password123');
    const listener = jest.fn();
    const unsubscribe = onUnauthenticated(listener);
    mockFetch(url => {
      if (url.endsWith('/api/v1/auth/refresh')) return Promise.reject(new Error('offline'));
      return jsonResponse({ message: 'Unauthorized' }, 401);
    });
    await expect(fetchMe()).resolves.toBeNull();
    expect(listener).not.toHaveBeenCalled();
    mockFetch((_url, init) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
      return jsonResponse(USER);
    });
    await expect(fetchMe()).resolves.toEqual(USER);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('register posts the name only when provided', async () => {
    const bodies: string[] = [];
    mockFetch((url, init) => {
      bodies.push(init?.body as string);
      return jsonResponse(SESSION, url.endsWith('/register') ? 201 : 200);
    });
    await register('a@b.c', 'password123', 'Ada');
    await register('b@c.d', 'password123');
    expect(JSON.parse(bodies[0])).toEqual({ email: 'a@b.c', password: 'password123', name: 'Ada' });
    expect(JSON.parse(bodies[1])).toEqual({ email: 'b@c.d', password: 'password123' });
  });

  it('builds the Google entrypoint URL and stores callback sessions', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
    expect(googleLoginUrl()).toBe('https://api.example.com/api/v1/auth/google');
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    const stored = acceptCallbackSession(SESSION);
    expect(stored).toEqual(USER);
    expect(hasSession()).toBe(true);
  });

  it('changes passwords, resets, exports, and deletes through authed routes', async () => {
    const seen: string[] = [];
    mockFetch((url, init) => {
      seen.push(`${init?.method ?? 'GET'} ${url}`);
      return jsonResponse({ status: 'ok' });
    });
    mockFetch(() => jsonResponse(SESSION));
    await login('a@b.c', 'password123');
    mockFetch((url, init) => {
      seen.push(`${init?.method ?? 'GET'} ${url}`);
      return jsonResponse({ status: 'ok' });
    });
    await changePassword('old-1', 'new-2');
    await requestPasswordReset('a@b.c');
    await confirmPasswordReset('a@b.c', 'tok', 'new-2');
    await exportAccountData();
    await deleteAccount();
    expect(seen).toContainEqual(
      expect.stringContaining('POST http://localhost:3000/api/v1/auth/password/change')
    );
    expect(seen).toContainEqual(
      expect.stringContaining('POST http://localhost:3000/api/v1/auth/password-reset/request')
    );
    expect(seen).toContainEqual(
      expect.stringContaining('POST http://localhost:3000/api/v1/auth/password-reset/confirm')
    );
    expect(seen).toContainEqual(
      expect.stringContaining('GET http://localhost:3000/api/v1/auth/account/export')
    );
    expect(seen).toContainEqual(
      expect.stringContaining('DELETE http://localhost:3000/api/v1/auth/account')
    );
  });

  it('logout revokes server-side and always clears local tokens', async () => {
    mockFetch(() => jsonResponse(SESSION));
    await login('a@b.c', 'password123');
    let logoutBody: string | undefined;
    mockFetch((_url, init) => {
      logoutBody = init?.body as string;
      return jsonResponse({ status: 'ok' });
    });
    await logout();
    expect(JSON.parse(logoutBody as string)).toEqual({ refreshToken: 'refresh-1' });
    mockFetch((_url, init) => {
      expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
      return jsonResponse({ message: 'Unauthorized' }, 401);
    });
    await expect(fetchMe()).resolves.toBeNull();
  });
});
