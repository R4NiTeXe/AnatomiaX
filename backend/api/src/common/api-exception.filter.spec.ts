import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

function mockHost(url: string, reqId?: string) {
  const json = jest.fn();
  const res = {
    status: jest.fn(() => ({ json })),
    setHeader: jest.fn(),
    _json: json,
  };
  const req: Record<string, unknown> = { method: 'GET', originalUrl: url, url };
  if (reqId !== undefined) req.id = reqId;
  const host = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  };
  return { host: host as never, res, req };
}

describe('ApiExceptionFilter (8.19.25)', () => {
  let filter: ApiExceptionFilter;

  beforeEach(() => {
    filter = new ApiExceptionFilter();
    jest.spyOn(filter['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes 401/403/404/409 with stable codes and request ids', async () => {
    const cases = [
      { err: new UnauthorizedException('Invalid credentials'), status: 401, code: 'UNAUTHORIZED' },
      { err: new ForbiddenException('Insufficient permissions'), status: 403, code: 'FORBIDDEN' },
      { err: new NotFoundException('Cohort not found'), status: 404, code: 'NOT_FOUND' },
      {
        err: new ConflictException('Already a member of this cohort'),
        status: 409,
        code: 'CONFLICT',
      },
    ] as const;
    for (const { err, status, code } of cases) {
      const { host, res } = mockHost('/api/v1/cohorts/x', 'req-1');
      filter.catch(err, host);
      expect(res.status).toHaveBeenCalledWith(status);
      expect(res._json).toHaveBeenCalledWith({
        code,
        message: err.message,
        requestId: 'req-1',
      });
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req-1');
    }
  });

  it('shapes validation failures with details and no statusCode leakage', async () => {
    const { host, res } = mockHost('/api/v1/auth/register', 'req-v');
    filter.catch(
      new BadRequestException(['email must be an email', 'password is too short']),
      host
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json).toHaveBeenCalledWith({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: ['email must be an email', 'password is too short'],
      requestId: 'req-v',
    });
  });

  it('keeps plain 400 domain errors as BAD_REQUEST', async () => {
    const { host, res } = mockHost('/api/v1/progress/quiz-attempts');
    filter.catch(new BadRequestException('Score cannot exceed total'), host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'BAD_REQUEST', message: 'Score cannot exceed total' })
    );
  });

  it('cleans throttler noise into RATE_LIMITED', async () => {
    const { host, res } = mockHost('/api/v1/auth/login');
    filter.catch(new HttpException('ThrottlerException: Too Many Requests', 429), host);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res._json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'RATE_LIMITED', message: 'Too Many Requests' })
    );
  });

  it('maps unexpected exceptions to a safe generic 500', async () => {
    const { host, res } = mockHost('/api/v1/auth/me');
    filter.catch(new Error('boom: password=hunter2 SELECT * FROM users'), host);
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res._json.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(JSON.stringify(body)).not.toContain('SELECT');
    expect(body).not.toHaveProperty('stack');
    expect(body).not.toHaveProperty('details');
  });

  it('maps Prisma errors without leaking internals', async () => {
    const dup = {
      host: mockHost('/api/v1/x'),
      prisma: { code: 'P2002', meta: { target: ['email'] } },
    };
    filter.catch(dup.prisma, dup.host.host);
    expect(dup.host.res.status).toHaveBeenCalledWith(409);
    expect(dup.host.res._json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CONFLICT', message: 'Resource already exists' })
    );

    const missing = { host: mockHost('/api/v1/x'), prisma: { code: 'P2025' } };
    filter.catch(missing.prisma, missing.host.host);
    expect(missing.host.res.status).toHaveBeenCalledWith(404);

    const conn = { host: mockHost('/api/v1/x'), prisma: { code: 'P1001', message: 'db down' } };
    filter.catch(conn.prisma, conn.host.host);
    expect(conn.host.res.status).toHaveBeenCalledWith(500);
    expect(conn.host.res._json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR', message: 'Internal server error' })
    );
  });

  it('generates a request id when guards reject before the interceptor', async () => {
    const { host, res } = mockHost('/api/v1/auth/me');
    filter.catch(new UnauthorizedException('Authentication required'), host);
    const body = res._json.mock.calls[0][0] as { requestId: string };
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', body.requestId);
  });

  it('passes health routes through untouched', async () => {
    for (const url of [
      '/api/health',
      '/api/health/db',
      '/api/health?x=1',
      '/health',
      '/health?x=1',
    ]) {
      const { host, res } = mockHost(url);
      expect(() => filter.catch(new Error('health boom'), host)).toThrow('health boom');
      expect(res.status).not.toHaveBeenCalled();
    }
  });
});
