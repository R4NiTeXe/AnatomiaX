import type { ConfigService } from '@nestjs/config';
import { resolveAllowedOrigins } from '../../config/cors-origins';

/**
 * 8.20.20/8.20.22 shared web-app origin.
 * First CORS allow-list entry is the web app by convention (see .env.example
 * and docs/deployment/README.md). Operator-controlled allow-list value only —
 * never derived from request input, so no open-redirect surface. Shares
 * normalization (plural alias, quotes, case, slashes) with CORS setup and
 * OriginCheckGuard so the redirect target and the allowed origin agree.
 */
export function webAppOrigin(config: ConfigService): string {
  return resolveAllowedOrigins(config)[0] ?? 'http://localhost:5173';
}
