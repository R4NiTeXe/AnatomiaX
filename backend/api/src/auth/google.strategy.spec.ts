import { UnauthorizedException } from '@nestjs/common';
import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy', () => {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        GOOGLE_CALLBACK_URL: 'http://localhost:3000/api/v1/auth/google/callback',
      };
      return values[key];
    }),
  };

  const authService = {
    validateGoogleUser: jest.fn(),
  };

  it('constructs without real Google credentials when env is empty', () => {
    const emptyConfig = { get: jest.fn().mockReturnValue(undefined) };
    expect(() => new GoogleStrategy(emptyConfig as never, authService as never)).not.toThrow();
  });

  it('passes the verified user through and never touches Google tokens', async () => {
    const strategy = new GoogleStrategy(config as never, authService as never);
    const user = { id: 'u1', role: 'STUDENT' };
    authService.validateGoogleUser.mockResolvedValue(user);
    const done = jest.fn();
    await strategy.validate(
      'google-access-token',
      'google-refresh-token',
      { id: 'google-1', emails: [{ value: 's@example.com', verified: true }] },
      done
    );
    expect(authService.validateGoogleUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'google-1' })
    );
    expect(done).toHaveBeenCalledWith(null, user);
  });

  it('fails closed when the identity cannot be verified', async () => {
    const strategy = new GoogleStrategy(config as never, authService as never);
    authService.validateGoogleUser.mockRejectedValue(new UnauthorizedException('nope'));
    const done = jest.fn();
    await strategy.validate(
      'google-access-token',
      'google-refresh-token',
      { id: 'google-1', emails: [] },
      done
    );
    expect(done).toHaveBeenCalledWith(expect.any(UnauthorizedException), false);
  });
});
