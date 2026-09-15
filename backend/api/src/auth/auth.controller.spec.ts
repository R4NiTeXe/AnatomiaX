import { AuthController } from './auth.controller';

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
