import { AuthController } from '../auth.controller';

const configFor = (values: Record<string, string | undefined>) => ({
  get: (key: string) => values[key],
});

function mockRes() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  };
}

describe('AuthController.googleCallback (8.20.20 OAuth redirect)', () => {
  const user = { id: 'u1', email: 's@example.com', role: 'STUDENT' };

  const authFor = (session?: { refreshToken: string }) => ({
    issueSessionForUser: jest.fn().mockResolvedValue({
      user,
      accessToken: 'access-1',
      refreshToken: session?.refreshToken ?? 'rt-1',
    }),
  });

  const reqFor = () => ({ user, headers: {}, cookies: {} });

  it('sets the refresh cookie then 302-redirects to the web app instead of JSON', async () => {
    const auth = authFor();
    const config = configFor({ CORS_ORIGIN: 'http://localhost:5173' });
    const controller = new AuthController(auth as never, config as never);
    const res = mockRes();

    await expect(
      controller.googleCallback(reqFor() as never, res as never)
    ).resolves.toBeUndefined();

    // Cookie carries the rotated refresh token (httpOnly, session-scoped path).
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'rt-1',
      expect.objectContaining({ httpOnly: true })
    );
    // No session JSON leaks into a rendered page — browser returns to the SPA,
    // which picks the session up from the httpOnly cookie via /auth/callback.
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173/auth/callback');
    expect(auth.issueSessionForUser).toHaveBeenCalledWith('u1');
  });

  it('uses the first CORS origin (web app) and trims trailing slashes', async () => {
    const auth = authFor();
    const config = configFor({
      CORS_ORIGIN: 'https://app.example.com/, https://admin.example.com',
    });
    const controller = new AuthController(auth as never, config as never);
    const res = mockRes();

    await controller.googleCallback(reqFor() as never, res as never);

    expect(res.redirect).toHaveBeenCalledWith('https://app.example.com/auth/callback');
  });
});

describe('AuthController session cookie flags', () => {
  const session = { user: { id: 'u1' }, accessToken: 'a', refreshToken: 'rt-1' };
  const authFor = () => ({
    register: jest.fn().mockResolvedValue(session),
    login: jest.fn().mockResolvedValue(session),
  });
  const loginDto = { email: 'a@b.c', password: 'password123' };

  it('sets HttpOnly SameSite=Lax non-secure cookie by default outside production', async () => {
    const controller = new AuthController(authFor() as never, configFor({}) as never);
    const res = mockRes();
    await controller.login(loginDto as never, res as never);
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'rt-1', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 86400000,
    });
  });

  it('honors explicit COOKIE_SAMESITE and COOKIE_SECURE flags', async () => {
    const controller = new AuthController(
      authFor() as never,
      configFor({ COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'true' }) as never
    );
    const res = mockRes();
    await controller.login(loginDto as never, res as never);
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'rt-1',
      expect.objectContaining({ sameSite: 'none', secure: true })
    );
  });

  it('defaults to SameSite=None in production so cross-site refresh works', async () => {
    // RED: production Google-callback 302 stores the cookie, but a Lax
    // default is never sent on cross-site fetch — /refresh 401s forever.
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const controller = new AuthController(authFor() as never, configFor({}) as never);
      const res = mockRes();
      await controller.login(loginDto as never, res as never);
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'rt-1',
        expect.objectContaining({ sameSite: 'none', secure: true })
      );
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('forces Secure in production regardless of config', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const controller = new AuthController(
        authFor() as never,
        configFor({ COOKIE_SECURE: 'false' }) as never
      );
      const res = mockRes();
      await controller.login(loginDto as never, res as never);
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'rt-1',
        expect.objectContaining({ secure: true })
      );
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('logout clears the cookie with matching path/sameSite/secure attributes', async () => {
    // RED: clearCookie sent path-only. A clearing response that does not
    // mirror the cookie's attributes risks leaving a live session cookie
    // behind in edge browsers — logout must look exactly like logout.
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const auth = { logout: jest.fn().mockResolvedValue(undefined) };
      const controller = new AuthController(auth as never, configFor({}) as never);
      const res = mockRes();
      await controller.logout({} as never, { cookies: {} } as never, res as never);
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/api/v1/auth',
        sameSite: 'none',
        secure: true,
      });
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('reset-confirm clears the cookie with matching attributes (sessions revoked)', async () => {
    // RED: confirm used path-only clearCookie while logout/change mirror
    // the full flags — a stale cookie could survive reset on edge browsers.
    const auth = { confirmPasswordReset: jest.fn().mockResolvedValue(undefined) };
    const controller = new AuthController(auth as never, configFor({}) as never);
    const res = mockRes();
    await controller.confirmPasswordReset({} as never, res as never);
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
      path: '/api/v1/auth',
      sameSite: 'lax',
      secure: false,
    });
  });

  it('account-delete clears the cookie with matching attributes', async () => {
    const auth = { deleteAccount: jest.fn().mockResolvedValue(undefined) };
    const controller = new AuthController(auth as never, configFor({}) as never);
    const res = mockRes();
    await controller.deleteAccount({ id: 'u1' } as never, res as never);
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
      path: '/api/v1/auth',
      sameSite: 'lax',
      secure: false,
    });
  });

  it('scales cookie maxAge with REFRESH_TTL_DAYS', async () => {
    const controller = new AuthController(
      authFor() as never,
      configFor({ REFRESH_TTL_DAYS: '7' }) as never
    );
    const res = mockRes();
    await controller.login(loginDto as never, res as never);
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'rt-1',
      expect.objectContaining({ maxAge: 7 * 86400000 })
    );
  });
});
