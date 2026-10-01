import {
  applyCors,
  parseAllowedOrigins,
  resolveAllowedOrigins,
  resolveCorsOriginsRaw,
} from './cors-origins';

function readerFor(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] };
}

describe('parseAllowedOrigins', () => {
  it('returns empty for missing or blank values', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins('')).toEqual([]);
    expect(parseAllowedOrigins('  , ,')).toEqual([]);
  });

  it('splits, trims, lowercases, and strips trailing slashes', () => {
    expect(parseAllowedOrigins('https://App.Example.com/, https://admin.example.COM')).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
  });

  it('strips surrounding quotes from dashboard pastes', () => {
    expect(parseAllowedOrigins('"https://anatomiax.vercel.app"')).toEqual([
      'https://anatomiax.vercel.app',
    ]);
    expect(parseAllowedOrigins('\'https://a.example\', "https://b.example/"')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('passes wildcards through for validation to reject', () => {
    expect(parseAllowedOrigins('*')).toEqual(['*']);
    expect(parseAllowedOrigins('https://a.example, *')).toEqual(['https://a.example', '*']);
  });
});

describe('resolveCorsOriginsRaw (singular/plural alias)', () => {
  it('prefers non-empty CORS_ORIGINS over CORS_ORIGIN', () => {
    expect(
      resolveCorsOriginsRaw(
        readerFor({ CORS_ORIGIN: 'https://old.example', CORS_ORIGINS: 'https://new.example' })
      )
    ).toBe('https://new.example');
  });

  it('falls back to CORS_ORIGIN when plural is blank or absent', () => {
    expect(resolveCorsOriginsRaw(readerFor({ CORS_ORIGIN: 'https://a.example' }))).toBe(
      'https://a.example'
    );
    expect(
      resolveCorsOriginsRaw(readerFor({ CORS_ORIGIN: 'https://a.example', CORS_ORIGINS: '   ' }))
    ).toBe('https://a.example');
  });

  it('returns undefined when neither is set', () => {
    expect(resolveCorsOriginsRaw(readerFor({}))).toBeUndefined();
  });
});

describe('resolveAllowedOrigins (production case)', () => {
  it('resolves the reported production variable to the exact Vercel origin', () => {
    expect(
      resolveAllowedOrigins(readerFor({ CORS_ORIGINS: 'https://anatomiax.vercel.app' }))
    ).toEqual(['https://anatomiax.vercel.app']);
  });
});

describe('applyCors (exact origin + credentials contract)', () => {
  const appFor = () => ({ enableCors: jest.fn() });
  const loggerFor = () => ({ log: jest.fn() });

  it('passes a single origin as an exact string with credentials', () => {
    const app = appFor();
    const logger = loggerFor();
    const effective = applyCors(
      app as never,
      readerFor({ CORS_ORIGIN: 'https://anatomiax.vercel.app' }) as never,
      logger
    );
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: 'https://anatomiax.vercel.app',
      credentials: true,
    });
    expect(effective).toEqual(['https://anatomiax.vercel.app']);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('https://anatomiax.vercel.app')
    );
  });

  it('passes multiple origins as an array, never a wildcard', () => {
    const app = appFor();
    applyCors(
      app as never,
      readerFor({ CORS_ORIGINS: 'https://a.example, https://b.example' }) as never
    );
    const origin = (app.enableCors.mock.calls[0][0] as { origin: unknown }).origin;
    expect(origin).toEqual(['https://a.example', 'https://b.example']);
    expect(origin).not.toBe('*');
    expect(origin).not.toContain('*');
  });

  it('falls back to the localhost dev default when unconfigured', () => {
    const app = appFor();
    const effective = applyCors(app as never, readerFor({}) as never);
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: 'http://localhost:5173',
      credentials: true,
    });
    expect(effective).toEqual(['http://localhost:5173']);
  });
});
