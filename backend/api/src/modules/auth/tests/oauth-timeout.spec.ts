import { RequestTimeoutException } from '@nestjs/common';
import { oauthTimeoutMs, withOAuthTimeout } from '../google-auth.guard';

function configWith(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as never;
}

describe('withOAuthTimeout (bounded OAuth round-trip)', () => {
  it('resolves fast work within the timeout', async () => {
    await expect(withOAuthTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects hanging work with 408 and no oracle detail', async () => {
    const hanging = new Promise<never>(() => undefined);
    const failure = await withOAuthTimeout(hanging, 20).catch(error => error);
    expect(failure).toBeInstanceOf(RequestTimeoutException);
    expect((failure as Error).message).toBe('OAuth provider timed out');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('propagates the work error instead of masking it with a timeout', async () => {
    const failing = Promise.reject(new Error('provider said no'));
    await expect(withOAuthTimeout(failing, 1000)).rejects.toThrow('provider said no');
  });
});

describe('oauthTimeoutMs (OAUTH_TIMEOUT_MS tuning)', () => {
  it('defaults to 15s when unset or blank', () => {
    expect(oauthTimeoutMs(configWith({}))).toBe(15_000);
    expect(oauthTimeoutMs(configWith({ OAUTH_TIMEOUT_MS: '   ' }))).toBe(15_000);
  });

  it('accepts positive integers', () => {
    expect(oauthTimeoutMs(configWith({ OAUTH_TIMEOUT_MS: '5000' }))).toBe(5000);
  });

  it('falls back to the default on garbage values', () => {
    for (const raw of ['soon', '-5', '0', '1.5']) {
      expect(oauthTimeoutMs(configWith({ OAUTH_TIMEOUT_MS: raw }))).toBe(15_000);
    }
  });

  it('clamps values above the max so the bound cannot be neutered', () => {
    expect(oauthTimeoutMs(configWith({ OAUTH_TIMEOUT_MS: '999999999' }))).toBe(120_000);
    expect(oauthTimeoutMs(configWith({ OAUTH_TIMEOUT_MS: '120000' }))).toBe(120_000);
  });
});
