import '@testing-library/jest-dom';
import { ApiError } from '@/lib/api';
import { friendlyAuthError } from '../friendlyAuthError';

function apiError(
  message: string,
  opts: { status?: number; code?: string; requestId?: string; details?: string[] }
) {
  return new ApiError(message, { url: 'http://localhost:3000/api/v1/auth/login', ...opts });
}

describe('friendlyAuthError', () => {
  it('maps invalid credentials with an override', () => {
    const out = friendlyAuthError(apiError('Unauthorized', { status: 401 }), {
      override401: 'Invalid email or password.',
    });
    expect(out.message).toBe('Invalid email or password.');
    expect(out.status).toBe(401);
  });

  it('maps conflicts and rate limits', () => {
    expect(friendlyAuthError(apiError('Conflict', { status: 409 })).message).toBe(
      'An account with this email already exists.'
    );
    expect(friendlyAuthError(apiError('Slow down', { status: 429 })).message).toMatch(
      /Too many attempts/
    );
  });

  it('surfaces validation details and request id', () => {
    const out = friendlyAuthError(
      apiError('Validation failed', {
        status: 400,
        code: 'VALIDATION_ERROR',
        requestId: 'req-1',
        details: ['email must be an email'],
      })
    );
    expect(out.message).toMatch(/email must be an email/);
    expect(out.requestId).toBe('req-1');
    expect(out.details).toEqual(['email must be an email']);
  });

  it('preserves request id on generic failures', () => {
    const out = friendlyAuthError(apiError('boom', { status: 500, requestId: 'req-500' }));
    expect(out.requestId).toBe('req-500');
    expect(out.message).toBe('Something went wrong. Please try again.');
  });

  it('maps network failures without leaking internals', () => {
    expect(friendlyAuthError(new Error('Failed to fetch')).message).toMatch(/Network error/);
    expect(friendlyAuthError(new Error('kaboom')).message).toBe(
      'Something went wrong. Please try again.'
    );
  });
});
