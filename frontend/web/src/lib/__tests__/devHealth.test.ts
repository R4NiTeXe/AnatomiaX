import { logHealthInDev } from '../devHealth';

describe('logHealthInDev', () => {
  const originalFetch = global.fetch;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.VITE_API_BASE_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    delete (process.env as Record<string, string | undefined>).VITE_API_BASE_URL;
  });

  it('logs the health payload on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'application/json' },
      json: jest.fn().mockResolvedValue({ status: 'ok' }),
    } as unknown as Response);
    await logHealthInDev();
    expect(logSpy).toHaveBeenCalledWith('[AnatomiaX] health:', { status: 'ok' });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns (never throws) when the backend is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(logHealthInDev()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      '[AnatomiaX] health check failed:',
      expect.stringContaining('Failed to fetch')
    );
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('warns on non-JSON error payloads', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Error',
      headers: { get: () => null },
      text: jest.fn().mockResolvedValue('boom'),
    } as unknown as Response);
    await expect(logHealthInDev()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });
});
