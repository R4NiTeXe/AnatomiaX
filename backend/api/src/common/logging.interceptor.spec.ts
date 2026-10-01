import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

function contextWith(request: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('LoggingInterceptor', () => {
  const interceptor = new LoggingInterceptor();

  it('passes values through without touching secrets', done => {
    const req = {
      id: 'req-1',
      method: 'GET',
      originalUrl: '/api/v1/auth/me',
      headers: { authorization: 'Bearer secret', cookie: 'refresh_token=secret' },
    };
    interceptor.intercept(contextWith(req), { handle: () => of('ok') }).subscribe(value => {
      expect(value).toBe('ok');
      // Request object must be unmodified (headers never stripped/logged).
      expect(req.headers).toEqual({
        authorization: 'Bearer secret',
        cookie: 'refresh_token=secret',
      });
      done();
    });
  });

  it('tolerates requests without id/method/url fields', done => {
    interceptor.intercept(contextWith({}), { handle: () => of('ok') }).subscribe(value => {
      expect(value).toBe('ok');
      done();
    });
  });

  it('does not convert handler errors into values', done => {
    interceptor
      .intercept(contextWith({ id: 'req-err', method: 'POST', url: '/api/x' }), {
        handle: () => throwError(() => new Error('boom')),
      })
      .subscribe({
        next: () => done(new Error('should not emit values')),
        error: (error: Error) => {
          expect(error.message).toBe('boom');
          done();
        },
      });
  });

  it('skips logging work for health paths', done => {
    interceptor
      .intercept(contextWith({ id: 'req-h', method: 'GET', url: '/api/health' }), {
        handle: () => of({ status: 'ok' }),
      })
      .subscribe(value => {
        expect(value).toEqual({ status: 'ok' });
        done();
      });
  });
});
