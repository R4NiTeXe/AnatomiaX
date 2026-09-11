import '@testing-library/jest-dom';
import { __resetAuthForTests, fetchMe, login, logout, onUnauthenticated, register } from '../auth';

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

const USER = { id: 'u1', email: 'a@b.c', name: null, role: 'STUDENT', createdAt: '2026-01-01' };
const SESSION = { user: USER, accessToken: 'access-1', refreshToken: 'refresh-1' };

describe('auth client', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) =>
      Promise.resolve(handler(url as string, init))
    );
  }

  it('login posts credentials and stores the session in memory', async () => {
    mockFetch(url => {
      expect(url).toBe('http://localhost:3000/api/v1/auth/login');
      return jsonResponse(SESSION);
    });
    const user = await login('a@b.c', 'password123');
    expect(user).toEqual(USER);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ email: 'a@b.c', password: 'password123' }));
  });

  it('register includes the name only when provided', async () => {
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
    mockFetch((url, init) => {
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCalls += 1;
        expect(init?.method).toBe('POST');
        expect(init?.body).toBe(JSON.stringify({ refreshToken: 'refresh-1' }));
        return jsonResponse({ ...SESSION, accessToken: 'access-2', refreshToken: 'refresh-2' });
      }
      meCalls += 1;
      if (meCalls <= 2) return jsonResponse({ message: 'Unauthorized' }, 401);
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-2');
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
    mockFetch(url => {
      if (url.endsWith('/api/v1/auth/refresh'))
        return jsonResponse({ message: 'Unauthorized' }, 401);
      return jsonResponse({ message: 'Unauthorized' }, 401);
    });
    await expect(fetchMe()).resolves.toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    // Tokens cleared: next call goes straight to refresh again, not with old Bearer.
    mockFetch((_url, init) => {
      expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
      return jsonResponse({ message: 'Unauthorized' }, 401);
    });
    await expect(fetchMe()).resolves.toBeNull();
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
    // Even a network failure still clears the local session.
    mockFetch(() => Promise.reject(new Error('offline')));
    await logout();
    mockFetch((_url, init) => {
      expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
      return jsonResponse({ message: 'Unauthorized' }, 401);
    });
    await expect(fetchMe()).resolves.toBeNull();
  });

  it('never touches localStorage for server progress or tokens', async () => {
    const setSpy = jest.spyOn(Storage.prototype, 'setItem');
    const getSpy = jest.spyOn(Storage.prototype, 'getItem');
    mockFetch(() => jsonResponse(SESSION));
    await login('a@b.c', 'password123');
    await fetchMe();
    await logout();
    expect(setSpy).not.toHaveBeenCalled();
    expect(getSpy).not.toHaveBeenCalled();
  });
});
