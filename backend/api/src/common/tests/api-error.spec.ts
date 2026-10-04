import { codeForStatus, isHealthPath, prismaCodeFrom, prismaToHttp } from '../exceptions/api-error';

describe('api-error helpers', () => {
  it('maps known statuses and falls back to INTERNAL_ERROR', () => {
    expect(codeForStatus(400)).toBe('BAD_REQUEST');
    expect(codeForStatus(401)).toBe('UNAUTHORIZED');
    expect(codeForStatus(429)).toBe('RATE_LIMITED');
    expect(codeForStatus(418)).toBe('INTERNAL_ERROR');
  });

  it('recognizes health paths with and without query strings', () => {
    expect(isHealthPath('/health')).toBe(true);
    expect(isHealthPath('/health/db')).toBe(true);
    expect(isHealthPath('/api/health?x=1')).toBe(true);
    expect(isHealthPath('/api/v1/auth/me')).toBe(false);
  });

  it('extracts Prisma codes only from Prisma-shaped errors', () => {
    expect(prismaCodeFrom({ code: 'P2002' })).toBe('P2002');
    expect(prismaCodeFrom({ name: 'PrismaClientRustPanicError' })).toBe('PRISMA');
    expect(prismaCodeFrom({ code: 2002 })).toBeNull();
    expect(prismaCodeFrom({ code: 'oops' })).toBeNull();
    expect(prismaCodeFrom(null)).toBeNull();
    expect(prismaCodeFrom('P2002')).toBeNull();
  });

  it('maps known Prisma codes to safe HTTP semantics', () => {
    expect(prismaToHttp('P2002')).toEqual({ status: 409, message: 'Resource already exists' });
    expect(prismaToHttp('P2025')).toEqual({ status: 404, message: 'Resource not found' });
    expect(prismaToHttp('P2024')).toBeNull();
  });
});
