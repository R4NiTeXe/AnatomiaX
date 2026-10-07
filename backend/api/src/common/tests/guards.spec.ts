import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { CurrentUser } from '../decorators/current-user.decorator';
import { GoogleAuthGuard } from '../../modules/auth/google-auth.guard';
import { JwtAuthGuard } from '../../modules/auth/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

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

  it('applies the Bearer split to array Authorization headers', async () => {
    const guard = guardWith(
      jest.fn().mockResolvedValue({ sub: 'u1' }),
      jest.fn().mockResolvedValue(STUDENT)
    );
    const req: Record<string, unknown> = { headers: { authorization: ['Bearer good.token.here'] } };
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

  it('resolves the user, a key subset, or undefined via route-args metadata', () => {
    const user = { id: 'u1', email: 's@example.com', role: 'STUDENT' };
    class Target {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- decorator params are metadata carriers; names are required for route-arg indices
      handler(@CurrentUser() _u: unknown, @CurrentUser('id') _id: unknown): void {
      }
    }
    const meta = Reflect.getMetadata(ROUTE_ARGS_METADATA, Target, 'handler') as Record<
      string,
      { index: number; factory: (data: unknown, ctx: ExecutionContext) => unknown; data: unknown }
    >;
    const factories = Object.values(meta);
    const noKey = factories.find(f => f.data === undefined);
    const withKey = factories.find(f => f.data === 'id');
    expect(noKey).toBeDefined();
    expect(withKey).toBeDefined();
    const ctxFor = (u: unknown) =>
      ({
        switchToHttp: () => ({ getRequest: () => ({ user: u }) }),
      }) as never;
    expect(noKey?.factory(undefined, ctxFor(null))).toBeUndefined();
    expect(noKey?.factory(undefined, ctxFor(user))).toEqual(user);
    expect(withKey?.factory('id', ctxFor(user))).toBe('u1');
  });
});

describe('GoogleAuthGuard (optional Google login)', () => {
  const configWith = (values: Record<string, string | undefined>) =>
    ({ get: jest.fn((key: string) => values[key]) }) as never;
  const contextWith = (query: Record<string, unknown>, cookies?: Record<string, string>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ query, cookies: cookies ?? {} }),
        getResponse: () => ({ cookie: jest.fn(), clearCookie: jest.fn() }),
      }),
    }) as unknown as ExecutionContext;

  it('rejects with 401 when the state cookie cannot be written', async () => {
    const guard = new GoogleAuthGuard(
      configWith({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })
    );
    const throwing = () => {
      throw new Error('headers sent');
    };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ query: {}, cookies: {} }),
        getResponse: () => ({ cookie: throwing, clearCookie: jest.fn() }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 404 without touching passport when credentials are missing', async () => {
    const guard = new GoogleAuthGuard(configWith({}));
    await expect(guard.canActivate(contextWith({}))).rejects.toBeInstanceOf(NotFoundException);
    const partial = new GoogleAuthGuard(configWith({ GOOGLE_CLIENT_ID: 'id-only' }));
    await expect(
      partial.canActivate(contextWith({ code: 'x', state: 'y' }))
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
