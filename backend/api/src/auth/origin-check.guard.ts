import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveAllowedOrigins } from '../config/cors-origins';

/**
 * Normalizes an Origin/Referer header value to `scheme://host[:port]`.
 * The literal `null` (sandboxed / opaque-origin frames) is a browser-sent
 * value, not an absent header: it is returned as a non-empty sentinel that
 * can never equal an allow-list entry, so opaque origins fail closed.
 * Malformed values are treated as absent (non-browser tolerance).
 */
function originOf(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) return null;
  if (first === 'null') return 'null';
  try {
    const url = new URL(first);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Cookie-CSRF guard for cookie-credentialed mutations (`refresh`, `logout`).
 *
 * Browsers always send `Origin` on fetch POSTs; when it is absent (older
 * clients, same-document navigations) `Referer` is checked instead. Native
 * and server-side clients send neither header and pass through — CSRF is a
 * browser-only threat. Exact-match only (no prefix/suffix matching), generic
 * 403 with no oracle detail, fail-closed when no allow-list is configured.
 */
@Injectable()
export class OriginCheckGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const method = (request.method ?? 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
    const headers = request.headers ?? {};
    const origin = originOf(headers.origin);
    const referer = originOf(headers.referer);
    if (!origin && !referer) return true;
    const allowed = resolveAllowedOrigins(this.config);
    if (allowed.length === 0) {
      throw new ForbiddenException('Forbidden');
    }
    const presented = origin ?? referer;
    if (presented && allowed.includes(presented)) return true;
    throw new ForbiddenException('Forbidden');
  }
}
