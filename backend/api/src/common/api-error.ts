/**
 * 8.19.25 canonical API error contract.
 *
 * Every non-health `/api/v1/*` error responds with this shape:
 *
 *   { code, message, details?, requestId }
 *
 * - `code` is a stable machine-readable string (see ERROR_CODE_BY_STATUS).
 * - `message` is human-readable and safe to display (never a stack trace,
 *   Prisma/SQL internals, token, hash, or secret).
 * - `details` appears only for validation failures (the class-validator
 *   messages array).
 * - `requestId` matches the `x-request-id` response header for log correlation.
 *
 * Success responses are unchanged by this contract.
 */

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: string[];
  requestId: string;
}

export const REQUEST_ID_HEADER = 'x-request-id';

export const GENERIC_SERVER_ERROR_MESSAGE = 'Internal server error';
export const GENERIC_VALIDATION_MESSAGE = 'Validation failed';

const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

export function codeForStatus(status: number): ApiErrorCode {
  if (status === 400) return 'BAD_REQUEST';
  return CODE_BY_STATUS[status] ?? 'INTERNAL_ERROR';
}

/** Health routes keep their legacy payloads and bypass normalization. */
export function isHealthPath(url: string): boolean {
  const path = url.split('?')[0];
  if (path === '/health' || path.startsWith('/health/')) return true;
  return path === '/api/health' || path.startsWith('/api/health/');
}

export interface PrismaLikeError {
  code?: unknown;
  name?: unknown;
}

function prismaCodeOf(exception: unknown): string | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const { code, name } = exception as PrismaLikeError;
  if (typeof code === 'string' && /^P\d{4}$/.test(code)) return code;
  if (typeof name === 'string' && name.startsWith('Prisma')) return 'PRISMA';
  return null;
}

/**
 * Maps Prisma/database errors to safe HTTP semantics without leaking
 * internals. Returns null when the exception is not Prisma-shaped.
 */
export function prismaToHttp(prismaCode: string): { status: number; message: string } | null {
  switch (prismaCode) {
    case 'P2002':
      return { status: 409, message: 'Resource already exists' };
    case 'P2025':
      return { status: 404, message: 'Resource not found' };
    default:
      return null;
  }
}

export function prismaCodeFrom(exception: unknown): string | null {
  return prismaCodeOf(exception);
}
