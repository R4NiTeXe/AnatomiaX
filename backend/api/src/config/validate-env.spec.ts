import { ConfigService } from '@nestjs/config';
import { validateProductionEnv } from './validate-env';

const configFor = (values: Record<string, string | undefined>) =>
  ({
    get: (key: string) => values[key],
  }) as unknown as ConfigService;

describe('validateProductionEnv (8.19.23)', () => {
  const OLD_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV;
  });

  it('does nothing outside production', () => {
    process.env.NODE_ENV = 'test';
    expect(() => validateProductionEnv(configFor({}))).not.toThrow();
  });

  it('requires a long JWT_SECRET, DATABASE_URL, and CORS_ORIGIN in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => validateProductionEnv(configFor({}))).toThrow('JWT_SECRET');
    expect(() =>
      validateProductionEnv(
        configFor({
          JWT_SECRET: 'short',
          DATABASE_URL: 'postgresql://x',
          CORS_ORIGIN: 'https://x.example',
        })
      )
    ).toThrow('JWT_SECRET');
  });

  it('accepts a complete production config', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      validateProductionEnv(
        configFor({
          JWT_SECRET: 'a-very-long-random-secret-value-0123456789',
          DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/anatomiax',
          CORS_ORIGIN: 'https://app.example.com',
          REFRESH_TTL_DAYS: '30',
          PASSWORD_RESET_TTL_MINUTES: '60',
          COOKIE_SAMESITE: 'lax',
        })
      )
    ).not.toThrow();
  });

  it('rejects partial Google config and bad TTLs', () => {
    process.env.NODE_ENV = 'production';
    const base = {
      JWT_SECRET: 'a-very-long-random-secret-value-0123456789',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/anatomiax',
      CORS_ORIGIN: 'https://app.example.com',
    };
    expect(() =>
      validateProductionEnv(configFor({ ...base, GOOGLE_CLIENT_ID: 'id-only' }))
    ).toThrow('GOOGLE_CLIENT_ID');
    expect(() => validateProductionEnv(configFor({ ...base, REFRESH_TTL_DAYS: '9999' }))).toThrow(
      'REFRESH_TTL_DAYS'
    );
  });

  it('keeps FCM optional but rejects project id without server key (8.19.24)', () => {
    process.env.NODE_ENV = 'production';
    const base = {
      JWT_SECRET: 'a-very-long-random-secret-value-0123456789',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/anatomiax',
      CORS_ORIGIN: 'https://app.example.com',
    };
    expect(() => validateProductionEnv(configFor(base))).not.toThrow();
    expect(() =>
      validateProductionEnv(configFor({ ...base, FIREBASE_PROJECT_ID: 'my-project' }))
    ).toThrow('FCM_SERVER_KEY');
    expect(() =>
      validateProductionEnv(
        configFor({ ...base, FCM_SERVER_KEY: 'key', FIREBASE_PROJECT_ID: 'my-project' })
      )
    ).not.toThrow();
  });
});

describe('validateProductionEnv (8.20.16 deployment readiness)', () => {
  const OLD_ENV = process.env.NODE_ENV;
  const OLD_PORT = process.env.PORT;
  const OLD_HOST = process.env.HOST;

  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV;
    if (OLD_PORT === undefined) delete process.env.PORT;
    else process.env.PORT = OLD_PORT;
    if (OLD_HOST === undefined) delete process.env.HOST;
    else process.env.HOST = OLD_HOST;
  });

  const base = {
    JWT_SECRET: 'a-very-long-random-secret-value-0123456789',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/anatomiax',
    CORS_ORIGIN: 'https://app.example.com',
  };

  it('rejects wildcard and localhost CORS origins in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => validateProductionEnv(configFor({ ...base, CORS_ORIGIN: '*' }))).toThrow(
      'CORS_ORIGIN'
    );
    expect(() =>
      validateProductionEnv(configFor({ ...base, CORS_ORIGIN: 'https://a.example, *' }))
    ).toThrow('CORS_ORIGIN');
    expect(() =>
      validateProductionEnv(configFor({ ...base, CORS_ORIGIN: 'http://localhost:5173' }))
    ).toThrow('CORS_ORIGIN');
    expect(() =>
      validateProductionEnv(configFor({ ...base, CORS_ORIGIN: 'http://127.0.0.1:3000' }))
    ).toThrow('CORS_ORIGIN');
  });

  it('accepts a comma-separated non-localhost allow-list', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      validateProductionEnv(
        configFor({ ...base, CORS_ORIGIN: 'https://app.example.com, https://admin.example.com' })
      )
    ).not.toThrow();
  });

  it('rejects non-postgresql DATABASE_URL in production without leaking the value', () => {
    process.env.NODE_ENV = 'production';
    let message = '';
    try {
      validateProductionEnv(configFor({ ...base, DATABASE_URL: 'mysql://secret-value' }));
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch('DATABASE_URL');
    expect(message).not.toContain('mysql://secret-value');
  });

  it('rejects SameSite=None with COOKIE_SECURE=false and bad COOKIE_SECURE values', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      validateProductionEnv(configFor({ ...base, COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'false' }))
    ).toThrow('COOKIE_SECURE');
    expect(() => validateProductionEnv(configFor({ ...base, COOKIE_SECURE: 'maybe' }))).toThrow(
      'COOKIE_SECURE'
    );
    expect(() =>
      validateProductionEnv(configFor({ ...base, COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'true' }))
    ).not.toThrow();
  });

  it('rejects localhost Google callback when OAuth is enabled', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      validateProductionEnv(
        configFor({
          ...base,
          GOOGLE_CLIENT_ID: 'id',
          GOOGLE_CLIENT_SECRET: 'secret',
          GOOGLE_CALLBACK_URL: 'http://localhost:3000/api/v1/auth/google/callback',
        })
      )
    ).toThrow('GOOGLE_CALLBACK_URL');
    expect(() =>
      validateProductionEnv(
        configFor({
          ...base,
          GOOGLE_CLIENT_ID: 'id',
          GOOGLE_CLIENT_SECRET: 'secret',
          GOOGLE_CALLBACK_URL: 'https://api.example.com/api/v1/auth/google/callback',
        })
      )
    ).not.toThrow();
  });

  it('validates PORT bounds and never includes secrets in messages', () => {
    process.env.NODE_ENV = 'production';
    expect(() => validateProductionEnv(configFor({ ...base, PORT: 'not-a-port' }))).toThrow('PORT');
    expect(() => validateProductionEnv(configFor({ ...base, PORT: '99999' }))).toThrow('PORT');
    let message = '';
    try {
      validateProductionEnv(configFor({}));
    } catch (e) {
      message = (e as Error).message;
    }
    // Only variable names and rules — no credential material.
    expect(message).not.toMatch(/postgres:.+@/);
  });
});
