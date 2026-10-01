import { HttpException } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

function hostFor(url: string) {
  const json = jest.fn();
  const res = {
    status: jest.fn(() => ({ json })),
    setHeader: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url }),
      getResponse: () => res,
    }),
  };
  return { host, res, json };
}

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  it('maps HttpException 500 to the generic body without internals', () => {
    const { host, res, json } = hostFor('/api/v1/cohorts');
    filter.catch(new HttpException('db connection string leaked?', 500), host as never);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR', message: 'Internal server error' })
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('leaked');
  });

  it('passes object error messages through with BAD_REQUEST for 400', () => {
    const { host, res, json } = hostFor('/api/v1/auth/login');
    filter.catch(new HttpException({ message: 'Name required' }, 400), host as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'BAD_REQUEST', message: 'Name required' })
    );
  });

  it('cleans throttler messages on 429', () => {
    const { host, res, json } = hostFor('/api/v1/auth/login');
    filter.catch(new HttpException('ThrottlerException: Too many requests', 429), host as never);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'RATE_LIMITED', message: 'Too many requests' })
    );
  });

  it('echoes the request id on the response header and body', () => {
    const { host, res, json } = hostFor('/api/v1/auth/me');
    filter.catch(new HttpException('nope', 401), host as never);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED', requestId: expect.any(String) })
    );
  });
});
