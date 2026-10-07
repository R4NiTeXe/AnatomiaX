import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveAllowedOrigins } from '../../config/cors-origins';

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
