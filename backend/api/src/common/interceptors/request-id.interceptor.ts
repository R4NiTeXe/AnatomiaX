import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Observable } from 'rxjs';
import { REQUEST_ID_HEADER } from '../exceptions/api-error';

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
    const id = /^[A-Za-z0-9\-_:.~]{1,128}$/.test(candidate) ? candidate : randomUUID();
    req.id = id;
    try {
      res.setHeader?.(REQUEST_ID_HEADER, id);
    } catch {
    }
    return next.handle();
  }
}
