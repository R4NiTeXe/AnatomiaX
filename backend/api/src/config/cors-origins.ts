import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

export interface OriginReader {
  get(key: string): string | undefined;
}

export function resolveCorsOriginsRaw(config: OriginReader): string | undefined {
  const plural = config.get('CORS_ORIGINS');
  if (plural && plural.trim()) return plural;
  return config.get('CORS_ORIGIN');
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(entry =>
      entry
        .trim()
        .replace(/^['"]+|['"]+$/g, '')
        .trim()
        .toLowerCase()
        .replace(/\/+$/, '')
    )
    .filter(Boolean);
}

export function resolveAllowedOrigins(config: OriginReader): string[] {
  return parseAllowedOrigins(resolveCorsOriginsRaw(config));
}

const DEV_DEFAULT_ORIGIN = 'http://localhost:5173';

export function applyCors(
  app: INestApplication,
  config: ConfigService,
  logger?: { log(message: string): void }
): string[] {
  const parsed = resolveAllowedOrigins(config);
  const effective = parsed.length > 0 ? parsed : [DEV_DEFAULT_ORIGIN];
  app.enableCors({
    origin: effective.length === 1 ? effective[0] : effective,
    credentials: true,
  });
  logger?.log(`CORS allow-list (${effective.length}): ${effective.join(', ')}`);
  return effective;
}
