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
});
