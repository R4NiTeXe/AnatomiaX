import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ApiErrorBody,
  GENERIC_SERVER_ERROR_MESSAGE,
  GENERIC_VALIDATION_MESSAGE,
  REQUEST_ID_HEADER,
  codeForStatus,
  isHealthPath,
  prismaCodeFrom,
  prismaToHttp,
} from './api-error';

interface HttpResponseLike {
  status(code: number): { json(body: unknown): void };
  setHeader?(name: string, value: string): void;
}

interface HttpRequestLike {
  id?: unknown;
  method?: unknown;
  originalUrl?: unknown;
  url?: unknown;
}

function readRequestId(req: HttpRequestLike | undefined): string {
  return typeof req?.id === 'string' && req.id.length > 0 ? req.id : randomUUID();
}

function firstString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** ThrottlerException embeds its class name; clients only need the reason. */
function cleanThrottlerMessage(message: string): string {
  return message.replace(/^ThrottlerException:\s*/i, '').trim() || 'Too many requests';
}

/**
 * 8.19.25 global API exception layer (non-health routes only).
 *
 * Normalizes every thrown value into the canonical `{ code, message,
 * details?, requestId }` body while preserving HTTP status semantics:
 * 400 validation/authz input, 401 auth, 403 forbidden, 404 hidden-or-missing,
 * 409 conflict, 429 throttled, 500 safe generic. Stack traces, Prisma/SQL
 * internals, tokens, hashes, and secrets never leave the server — 5xx paths
 * always resolve to a generic message (details stay in server logs only).
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Api');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<HttpRequestLike | undefined>();
    const res = ctx.getResponse<HttpResponseLike>();
    const url = firstString(req?.originalUrl) ?? firstString(req?.url) ?? '';

    // Health endpoints keep their legacy behavior exactly.
    if (isHealthPath(url)) {
      throw exception;
    }

    // Prisma/database errors → safe mapped semantics (no internals leaked).
    const prismaCode = prismaCodeFrom(exception);
    if (prismaCode) {
      const mapped = prismaToHttp(prismaCode);
      if (mapped) {
        this.respond(req, res, url, mapped.status, undefined, {
          code: codeForStatus(mapped.status),
          message: mapped.message,
        });
        return;
      }
      this.respond(req, res, url, HttpStatus.INTERNAL_SERVER_ERROR, exception, {
        code: 'INTERNAL_ERROR',
        message: GENERIC_SERVER_ERROR_MESSAGE,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) {
        this.respond(req, res, url, status, exception, {
          code: 'INTERNAL_ERROR',
          message: GENERIC_SERVER_ERROR_MESSAGE,
        });
        return;
      }
      const response = exception.getResponse();
      if (typeof response === 'string') {
        const message =
          status === HttpStatus.TOO_MANY_REQUESTS ? cleanThrottlerMessage(response) : response;
        this.respond(req, res, url, status, undefined, {
          code: codeForStatus(status),
          message,
        });
        return;
      }
      if (typeof response === 'object' && response !== null) {
        const body = response as { message?: unknown; error?: unknown };
        if (Array.isArray(body.message)) {
          // class-validator failure: consistent validation shape.
          const details = body.message.filter((m): m is string => typeof m === 'string');
          this.respond(req, res, url, status, undefined, {
            code: status === 400 ? 'VALIDATION_ERROR' : codeForStatus(status),
            message: status === 400 ? GENERIC_VALIDATION_MESSAGE : 'Bad request',
            details,
          });
          return;
        }
        const message = firstString(body.message) ?? firstString(body.error) ?? 'Bad request';
        this.respond(req, res, url, status, undefined, {
          code: codeForStatus(status),
          message:
            status === HttpStatus.TOO_MANY_REQUESTS ? cleanThrottlerMessage(message) : message,
        });
        return;
      }
      this.respond(req, res, url, status, undefined, {
        code: codeForStatus(status),
        message: 'Bad request',
      });
      return;
    }

    // Anything unexpected → safe 500 (original kept server-side in logs only).
    this.respond(req, res, url, HttpStatus.INTERNAL_SERVER_ERROR, exception, {
      code: 'INTERNAL_ERROR',
      message: GENERIC_SERVER_ERROR_MESSAGE,
    });
  }

  private respond(
    req: HttpRequestLike | undefined,
    res: HttpResponseLike,
    url: string,
    status: number,
    original: unknown,
    partial: { code: ApiErrorBody['code']; message: string; details?: string[] }
  ): void {
    const requestId = readRequestId(req);
    const method = typeof req?.method === 'string' ? req.method : '?';
    const body: ApiErrorBody = { ...partial, requestId };
    try {
      res.setHeader?.(REQUEST_ID_HEADER, requestId);
    } catch {
      // Header failures must never break error handling.
    }
    if (status >= 500) {
      const stack = original instanceof Error ? original.stack : String(original);
      this.logger.error(`[${requestId}] ${method} ${url} -> ${status} ${body.code} ${stack}`);
    } else {
      this.logger.warn(`[${requestId}] ${method} ${url} -> ${status} ${body.code}`);
    }
    res.status(status).json(body);
  }
}
