import { ForbiddenException } from '@nestjs/common';
import { OriginCheckGuard } from '../origin-check.guard';

function contextWith(method: string, headers: Record<string, string | string[] | undefined>) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  } as never;
}

describe('OriginCheckGuard (cookie-CSRF)', () => {
  const configWith = (corsOrigin: string | undefined) =>
    ({ get: jest.fn(() => corsOrigin) }) as never;
  const guardFor = (corsOrigin: string | undefined) => new OriginCheckGuard(configWith(corsOrigin));

  it('lets safe methods through without checks', () => {
    const guard = guardFor('https://app.example.com');
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(guard.canActivate(contextWith(method, {}))).toBe(true);
    }
  });

  it('lets non-browser clients without Origin/Referer through', () => {
    const guard = guardFor('https://app.example.com');
    expect(guard.canActivate(contextWith('POST', {}))).toBe(true);
  });

  it('allows listed origins on state-changing requests', () => {
    const guard = guardFor('https://app.example.com, https://admin.example.com/');
    expect(guard.canActivate(contextWith('POST', { origin: 'https://app.example.com' }))).toBe(
      true
    );
    expect(guard.canActivate(contextWith('DELETE', { origin: 'https://admin.example.com/' }))).toBe(
      true
    );
  });

  it('falls back to Referer when Origin is absent', () => {
    const guard = guardFor('https://app.example.com');
    expect(
      guard.canActivate(contextWith('POST', { referer: 'https://app.example.com/login' }))
    ).toBe(true);
    expect(() =>
      guard.canActivate(contextWith('POST', { referer: 'https://evil.example/x' }))
    ).toThrow(ForbiddenException);
  });

  it('rejects forged origins with 403 and no oracle detail', () => {
    const guard = guardFor('https://app.example.com');
    try {
      guard.canActivate(contextWith('POST', { origin: 'https://evil.example' }));
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as Error).message).toBe('Forbidden');
    }
  });

  it('rejects origin-like prefixes that are not exact matches', () => {
    const guard = guardFor('https://app.example.com');
    expect(() =>
      guard.canActivate(contextWith('POST', { origin: 'https://app.example.com.evil.com' }))
    ).toThrow(ForbiddenException);
  });

  it('fails closed when no allow-list is configured', () => {
    const guard = guardFor(undefined);
    expect(() =>
      guard.canActivate(contextWith('POST', { origin: 'https://app.example.com' }))
    ).toThrow(ForbiddenException);
  });

  it('ignores malformed Origin values without headers to verify', () => {
    const guard = guardFor('https://app.example.com');
    expect(guard.canActivate(contextWith('POST', { origin: 'not-a-url' }))).toBe(true);
  });

  it('fails closed on opaque-origin (null) requests, even with SameSite=None', () => {
    const guard = guardFor('https://app.example.com');
    expect(() => guard.canActivate(contextWith('POST', { origin: 'null' }))).toThrow(
      ForbiddenException
    );
    expect(() =>
      guard.canActivate(
        contextWith('POST', { origin: 'null', referer: 'https://app.example.com/' })
      )
    ).toThrow(ForbiddenException);
  });
});
