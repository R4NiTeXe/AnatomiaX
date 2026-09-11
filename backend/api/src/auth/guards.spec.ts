import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

function contextWith(request: unknown, handlerRoles?: string[]): ExecutionContext {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(handlerRoles),
  } as unknown as Reflector;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
    reflector,
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const STUDENT = { id: 'u1', email: 's@example.com', name: null, role: 'STUDENT' };

  const guardWith = (verify: jest.Mock, safeById: jest.Mock) =>
    new JwtAuthGuard({ verifyAsync: verify } as unknown as JwtService, { safeById } as never);

  it('attaches the live user for a valid Bearer token', async () => {
    const guard = guardWith(
      jest.fn().mockResolvedValue({ sub: 'u1' }),
      jest.fn().mockResolvedValue(STUDENT)
    );
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer good.token.here' } };
    await expect(guard.canActivate(contextWith(req) as never)).resolves.toBe(true);
    expect(req.user).toEqual(STUDENT);
  });

  it('rejects missing Authorization header', async () => {
    const guard = guardWith(jest.fn(), jest.fn());
    await expect(guard.canActivate(contextWith({ headers: {} }) as never)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('rejects malformed and invalid tokens', async () => {
    const guard = guardWith(jest.fn().mockRejectedValue(new Error('bad')), jest.fn());
    await expect(
      guard.canActivate(contextWith({ headers: { authorization: 'Bearer nope' } }) as never)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(contextWith({ headers: { authorization: 'Token abc' } }) as never)
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tokens whose user was deleted', async () => {
    const guard = guardWith(
      jest.fn().mockResolvedValue({ sub: 'u9' }),
      jest.fn().mockResolvedValue(null)
    );
    await expect(
      guard.canActivate(contextWith({ headers: { authorization: 'Bearer stale' } }) as never)
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('RolesGuard (RBAC foundation)', () => {
  const guardFor = (roles: string[] | undefined) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(roles),
    } as unknown as Reflector;
    return { guard: new RolesGuard(reflector), reflector };
  };

  it('allows when no roles are required', () => {
    const { guard } = guardFor(undefined);
    expect(guard.canActivate(contextWith({ user: { role: 'STUDENT' } }))).toBe(true);
  });

  it('allows matching roles', () => {
    const { guard, reflector } = guardFor(['TEACHER', 'ADMIN']);
    expect(guard.canActivate(contextWith({ user: { id: 't1', role: 'TEACHER' } }))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.anything());
  });

  it('forbids non-matching roles', () => {
    const { guard } = guardFor(['ADMIN']);
    expect(() => guard.canActivate(contextWith({ user: { id: 's1', role: 'STUDENT' } }))).toThrow(
      ForbiddenException
    );
  });

  it('forbids unauthenticated requests on role-protected routes', () => {
    const { guard } = guardFor(['STUDENT']);
    expect(() => guard.canActivate(contextWith({}))).toThrow(ForbiddenException);
  });
});

describe('CurrentUser', () => {
  it('is a param decorator factory', () => {
    expect(typeof CurrentUser).toBe('function');
  });
});
