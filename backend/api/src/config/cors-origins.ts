import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

/** Minimal surface: unit specs stub `{ get }` instead of Nest's ConfigService. */
export interface OriginReader {
  get(key: string): string | undefined;
}

/**
 * Raw allow-list resolution. Accepts the documented CORS_ORIGIN plus the
 * CORS_ORIGINS plural alias (operators naturally reach for the plural; a
 * set-but-ignored variable is a silent CORS outage). Non-empty plural wins;
 * otherwise the singular; otherwise undefined (caller applies the localhost
 * dev default — never production).
 */
export function resolveCorsOriginsRaw(config: OriginReader): string | undefined {
  const plural = config.get('CORS_ORIGINS');
  if (plural && plural.trim()) return plural;
  return config.get('CORS_ORIGIN');
}

/**
 * Normalizes one allow-list value: comma-split, trimmed, surrounding quotes
 * stripped (dashboard pastes like `"https://app"` never match at runtime),
 * lowercased, trailing slashes stripped. Wildcards pass through untouched
 * so validation (not parsing) rejects them loudly.
 */
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

/** Reader + parser combined: the single normalization all consumers share. */
export function resolveAllowedOrigins(config: OriginReader): string[] {
  return parseAllowedOrigins(resolveCorsOriginsRaw(config));
}

const DEV_DEFAULT_ORIGIN = 'http://localhost:5173';

/**
 * Applies the shared CORS contract to a Nest application: exact-origin
 * matching (single origin as string, multiples as array — never '*'),
 * credentials always on. enableCors must run before pipes/middleware/routes
 * so preflight OPTIONS *and* guard/error responses carry CORS headers.
 * Logs the normalized allow-list (origins are public frontend URLs, never
 * secrets) — silent CORS misconfiguration is the incident class this exists
 * to prevent. Returns the effective list for tests.
 */
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
