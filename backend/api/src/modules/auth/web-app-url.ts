import type { ConfigService } from '@nestjs/config';
import { resolveAllowedOrigins } from '../../config/cors-origins';

export function webAppOrigin(config: ConfigService): string {
  return resolveAllowedOrigins(config)[0] ?? 'http://localhost:5173';
}
