import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { isHealthPath } from './api-error';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Http');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{
      id?: string;
      method?: string;
      originalUrl?: string;
      url?: string;
      headers?: Record<string, unknown>;
    }>();
    const requestId = typeof req?.id === 'string' ? req.id : '-';
    const method = typeof req?.method === 'string' ? req.method : '?';
    const url =
      (typeof req?.originalUrl === 'string' ? req.originalUrl : undefined) ??
      (typeof req?.url === 'string' ? req.url : '?');
    if (isHealthPath(url)) {
      return next.handle();
    }
    // Never log authorization, cookie, or other secrets
    const start = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          // Only log at debug level for success to avoid noise; errors are logged by ApiExceptionFilter
          if (duration > 1000) {
            this.logger.warn(`[${requestId}] ${method} ${url} -> 2xx ${duration}ms`);
          }
        },
        error: () => {
          const duration = Date.now() - start;
          this.logger.warn(`[${requestId}] ${method} ${url} -> error ${duration}ms`);
        },
      })
    );
  }
}
