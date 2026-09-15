import type { ConfigService } from '@nestjs/config';

/**
 * 8.20.20/8.20.22 shared web-app origin.
 * First CORS_ORIGIN entry is the web app by convention (see .env.example and
 * docs/deployment/README.md). Operator-controlled allow-list value only —
 * never derived from request input, so no open-redirect surface.
 */
export function webAppOrigin(config: ConfigService): string {
  const raw = config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173';
  const first =
    raw
      .split(',')
      .map(o => o.trim())
      .filter(Boolean)[0] ?? 'http://localhost:5173';
  return first.replace(/\/+$/, '');
}
