import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Observable } from 'rxjs';
import { REQUEST_ID_HEADER } from '../exceptions/api-error';

/** Minimal structural request/response view — no Express type dependency. */

/**
 * 8.19.25 assigns every API request a correlation id and echoes it as the
 * `x-request-id` response header (success and error responses alike).
 * A client-supplied id is preserved (validated) so distributed traces
 * correlate; otherwise a new UUID is generated. Error bodies carry the same
 * id via ApiExceptionFilter. Guard rejections run before interceptors, so
 * the filter falls back to generating one.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{
      id?: string;
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const res = http.getResponse<{ setHeader?: (name: string, value: string) => void }>();
    const incoming = req.headers?.[REQUEST_ID_HEADER];
    const candidate = (Array.isArray(incoming) ? incoming[0] : incoming)?.trim() ?? '';
    // Strict charset + length cap: ids go into logs/headers, so reject
    // anything that could smuggle control characters or bloat storage.
    const id = /^[A-Za-z0-9\-_:.~]{1,128}$/.test(candidate) ? candidate : randomUUID();
    req.id = id;
    try {
      res.setHeader?.(REQUEST_ID_HEADER, id);
    } catch {
      // Header failures must never break request handling.
    }
    return next.handle();
  }
}
