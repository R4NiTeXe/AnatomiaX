import '@testing-library/jest-dom';
import {
  __resetAuthForTests,
  acceptCallbackSession,
  changePassword,
  confirmPasswordReset,
  deleteAccount,
  exportAccountData,
  fetchMe,
  googleLoginUrl,
  login,
  requestPasswordReset,
} from '../auth';

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

describe('account client (8.20.2)', () => {
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

  it('builds the Google entrypoint from the API base URL', () => {
    process.env.VITE_API_BASE_URL = 'http://localhost:3000';
    expect(googleLoginUrl()).toBe('http://localhost:3000/api/v1/auth/google');
  });

  it('changes password with the current password', async () => {
    mockFetch(url => {
      if (url.endsWith('/api/v1/auth/login')) return jsonResponse(SESSION);
      if (url.endsWith('/api/v1/auth/password/change')) return jsonResponse({ status: 'ok' });
      return jsonResponse(USER);
    });
    await login('a@b.c', 'password123');
    (global.fetch as jest.Mock).mockClear();
    mockFetch((url, init) => {
      expect(url).toBe('http://localhost:3000/api/v1/auth/password/change');
      expect(init?.method).toBe('POST');
      return jsonResponse({ status: 'ok' });
    });
    await changePassword('password123', 'brand-new-pass-1');
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      currentPassword: 'password123',
      newPassword: 'brand-new-pass-1',
    });
  });

  it('changes password without a current password when omitted', async () => {
    mockFetch(() => jsonResponse(SESSION));
    await login('a@b.c', 'password123');
    (global.fetch as jest.Mock).mockClear();
    mockFetch(() => jsonResponse({ status: 'ok' }));
    await changePassword(undefined, 'brand-new-pass-1');
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ newPassword: 'brand-new-pass-1' });
  });

  it('requests a password reset', async () => {
    mockFetch((url, init) => {
      expect(url).toBe('http://localhost:3000/api/v1/auth/password-reset/request');
      expect(init?.method).toBe('POST');
      return jsonResponse({ status: 'ok' });
    });
    await requestPasswordReset('a@b.c');
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.c' });
  });

  it('confirms a password reset', async () => {
    mockFetch((url, init) => {
      expect(url).toBe('http://localhost:3000/api/v1/auth/password-reset/confirm');
      expect(init?.method).toBe('POST');
      return jsonResponse({ status: 'ok' });
    });
    await confirmPasswordReset('a@b.c', 'token-12345678901234567890', 'new-pass-123');
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'a@b.c',
      token: 'token-12345678901234567890',
      newPassword: 'new-pass-123',
    });
  });

  it('exports account data via an authenticated GET', async () => {
    mockFetch(() => jsonResponse(SESSION));
    await login('a@b.c', 'password123');
    const payload = { account: { id: 'u1' }, exportedAt: '2026-01-01' };
    mockFetch((url, init) => {
      expect(url).toBe('http://localhost:3000/api/v1/auth/account/export');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
      return jsonResponse(payload);
    });
    await expect(exportAccountData()).resolves.toEqual(payload);
  });

  it('deletes the account via an authenticated DELETE', async () => {
    mockFetch(() => jsonResponse(SESSION));
    await login('a@b.c', 'password123');
    (global.fetch as jest.Mock).mockClear();
    mockFetch((url, init) => {
      expect(url).toBe('http://localhost:3000/api/v1/auth/account');
      expect(init?.method).toBe('DELETE');
      return jsonResponse({ status: 'ok' });
    });
    await deleteAccount();
    expect((global.fetch as jest.Mock).mock.calls[0][0] as string).toBe(
      'http://localhost:3000/api/v1/auth/account'
    );
  });

  it('accepts a callback session in memory (no storage)', async () => {
    const setSpy = jest.spyOn(Storage.prototype, 'setItem');
    const user = acceptCallbackSession(SESSION);
    expect(user).toEqual(USER);
    mockFetch((url, init) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
      expect(url).toBe('http://localhost:3000/api/v1/auth/me');
      return jsonResponse(USER);
    });
    await expect(fetchMe()).resolves.toEqual(USER);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('never touches web storage for password/export/delete flows', async () => {
    const setSpy = jest.spyOn(Storage.prototype, 'setItem');
    const sessionSpy = jest.spyOn(Storage.prototype, 'setItem');
    mockFetch(url => {
      if (url.endsWith('/api/v1/auth/login')) return jsonResponse(SESSION);
      return jsonResponse({ status: 'ok' });
    });
    await login('a@b.c', 'password123');
    await requestPasswordReset('a@b.c');
    await confirmPasswordReset('a@b.c', 'token-12345678901234567890', 'new-pass-123');
    mockFetch(() => jsonResponse({ exported: true }));
    await exportAccountData();
    mockFetch(() => jsonResponse({ status: 'ok' }));
    await deleteAccount();
    expect(setSpy).not.toHaveBeenCalled();
    expect(sessionSpy).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('x')).toBeNull();
  });
});
