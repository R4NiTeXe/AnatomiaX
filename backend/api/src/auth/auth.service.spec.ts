import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'student@example.com',
    passwordHash: null as string | null,
    name: 'Student',
    role: 'STUDENT',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as never;
}

describe('AuthService', () => {
  const OLD_ENV = process.env.NODE_ENV;
  let service: AuthService;
  let prisma: Record<string, jest.Mock | Record<string, jest.Mock>>;
  let users: Record<string, jest.Mock>;
  let jwt: JwtService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tx: any;

  const configFor = (values: Record<string, string | undefined>) => ({
    get: jest.fn((key: string) => values[key]),
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    tx = {
      user: {
        update: jest.fn(async ({ data }: never) => ({ ...(data as object) })),
        delete: jest.fn(async () => ({})),
      },
      refreshToken: {
        update: jest.fn(async ({ data }: never) => ({ ...(data as object) })),
        create: jest.fn(async ({ data }: never) => ({ id: 'rt-new', ...(data as object) })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      passwordResetToken: {
        update: jest.fn(async ({ data }: never) => ({ ...(data as object) })),
        create: jest.fn(async ({ data }: never) => ({ id: 'prt-new', ...(data as object) })),
        deleteMany: jest.fn(async () => ({ count: 0 })),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
    };
    prisma = {
      refreshToken: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn(async ({ data }: never) => ({ id: 'prt-1', ...(data as object) })),
        update: jest.fn(),
        deleteMany: jest.fn(async () => ({ count: 0 })),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      user: {
        update: jest.fn(),
        delete: jest.fn(),
      },
      cohort: {
        findMany: jest.fn(async () => []),
      },
      cohortMember: {
        findMany: jest.fn(async () => []),
      },
      quizAttempt: {
        findMany: jest.fn(async () => []),
      },
      progressSnapshot: {
        findUnique: jest.fn(async () => null),
      },
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    users = {
      findLiveById: jest.fn(),
      findLiveByEmail: jest.fn(),
      findLiveByOAuth: jest.fn(),
      create: jest.fn(),
      linkOAuthAccount: jest.fn(),
      safeById: jest.fn(),
    };
    jwt = new JwtService({ secret: 'test-secret' });
    const delivery = { dispatch: jest.fn(async () => undefined) };
    (prisma as Record<string, unknown>)._delivery = delivery;
    service = new AuthService(
      prisma as never,
      users as never,
      jwt,
      configFor({ JWT_ACCESS_TTL: '15m', REFRESH_TTL_DAYS: '30' }) as never,
      delivery as never
    );
  });

  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV;
  });

  describe('registration', () => {
    it('creates a STUDENT user with hashed password and returns a session', async () => {
      users.findLiveByEmail.mockResolvedValue(null);
      users.create.mockImplementation(async (input: { email: string }) =>
        makeUser({ email: input.email })
      );
      const session = await service.register('Student@Example.com', 'password123', 'Stu');
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'Student@Example.com', role: 'STUDENT' })
      );
      const storedHash = users.create.mock.calls[0][0].passwordHash as string;
      expect(storedHash).not.toContain('password123');
      expect(await argon2.verify(storedHash, 'password123')).toBe(true);
      expect(session.user).toEqual(expect.objectContaining({ id: 'user-1', role: 'STUDENT' }));
      expect(session.user).not.toHaveProperty('passwordHash');
      expect(typeof session.accessToken).toBe('string');
      expect(typeof session.refreshToken).toBe('string');
    });

    it('rejects duplicate email with 409', async () => {
      users.findLiveByEmail.mockResolvedValue(makeUser());
      await expect(service.register('student@example.com', 'password123')).rejects.toBeInstanceOf(
        ConflictException
      );
    });
  });

  describe('login', () => {
    it('returns a session for valid credentials', async () => {
      const hash = await argon2.hash('correct-horse');
      users.findLiveByEmail.mockResolvedValue(makeUser({ passwordHash: hash }));
      const session = await service.login('student@example.com', 'correct-horse');
      expect(session.user.id).toBe('user-1');
      expect(session.accessToken).toBeTruthy();
    });

    it('rejects unknown email with generic 401', async () => {
      users.findLiveByEmail.mockResolvedValue(null);
      await expect(service.login('nobody@example.com', 'whatever12')).rejects.toThrow(
        'Invalid credentials'
      );
      await expect(service.login('nobody@example.com', 'whatever12')).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });

    it('rejects wrong password with the same generic 401 (no enumeration)', async () => {
      const hash = await argon2.hash('right-password');
      users.findLiveByEmail.mockResolvedValue(makeUser({ passwordHash: hash }));
      await expect(service.login('student@example.com', 'wrong-password')).rejects.toThrow(
        'Invalid credentials'
      );
    });

    it('rejects OAuth-only accounts (no password) with generic 401', async () => {
      users.findLiveByEmail.mockResolvedValue(makeUser({ passwordHash: null }));
      await expect(service.login('student@example.com', 'anything12')).rejects.toThrow(
        'Invalid credentials'
      );
    });
  });

  describe('refresh rotation', () => {
    const liveRecord = (overrides: Record<string, unknown> = {}) => ({
      id: 'rt-1',
      tokenHash: hashOf('presented'),
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      user: makeUser(),
      ...overrides,
    });

    it('rotates: revokes old token and issues a new one', async () => {
      (prisma.refreshToken as unknown as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
        liveRecord()
      );
      const session = await service.refresh('presented');
      expect(tx.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt-1' } })
      );
      expect(tx.refreshToken.create).toHaveBeenCalled();
      expect(session.accessToken).toBeTruthy();
      expect(session.refreshToken).not.toBe('presented');
    });

    it('rejects missing token', async () => {
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects unknown token and does not revoke anything', async () => {
      (prisma.refreshToken as unknown as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
        null
      );
      await expect(service.refresh('ghost')).rejects.toThrow('Invalid credentials');
      expect(
        (prisma.refreshToken as unknown as { updateMany: jest.Mock }).updateMany
      ).not.toHaveBeenCalled();
    });

    it('detects reuse: revoked token invalidates the whole family', async () => {
      (prisma.refreshToken as unknown as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
        liveRecord({ revokedAt: new Date() })
      );
      await expect(service.refresh('presented')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(
        (prisma.refreshToken as unknown as { updateMany: jest.Mock }).updateMany
      ).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects expired tokens', async () => {
      (prisma.refreshToken as unknown as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
        liveRecord({ expiresAt: new Date(Date.now() - 1000) })
      );
      await expect(service.refresh('presented')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects refresh for deleted users', async () => {
      (prisma.refreshToken as unknown as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
        liveRecord({ user: makeUser({ deletedAt: new Date() }) })
      );
      await expect(service.refresh('presented')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the presented token', async () => {
      await service.logout('some-token');
      expect((prisma.refreshToken as unknown as { update: jest.Mock }).update).toHaveBeenCalledWith(
        {
          where: { tokenHash: hashOf('some-token') },
          data: { revokedAt: expect.any(Date) },
        }
      );
    });

    it('is idempotent without a token or on missing record', async () => {
      await expect(service.logout(undefined)).resolves.toBeUndefined();
      (prisma.refreshToken as unknown as { update: jest.Mock }).update.mockRejectedValueOnce(
        new Error('not found')
      );
      await expect(service.logout('ghost')).resolves.toBeUndefined();
    });
  });

  describe('me', () => {
    it('returns the safe user', async () => {
      users.safeById.mockResolvedValue({ id: 'user-1', role: 'STUDENT' });
      await expect(service.me('user-1')).resolves.toEqual({ id: 'user-1', role: 'STUDENT' });
    });

    it('rejects unknown/deleted users', async () => {
      users.safeById.mockResolvedValue(null);
      await expect(service.me('ghost')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('Google validation', () => {
    it('returns the already-linked user', async () => {
      users.findLiveByOAuth.mockResolvedValue(makeUser());
      const out = await service.validateGoogleUser({
        id: 'google-1',
        emails: [{ value: 'Student@Example.com', verified: true }],
      });
      expect(out.id).toBe('user-1');
      expect(users.create).not.toHaveBeenCalled();
    });

    it('links Google to an existing email account', async () => {
      users.findLiveByOAuth.mockResolvedValue(null);
      users.findLiveByEmail.mockResolvedValue(makeUser());
      const out = await service.validateGoogleUser({
        id: 'google-1',
        displayName: 'Stu',
        emails: [{ value: 'student@example.com', verified: true }],
      });
      expect(users.linkOAuthAccount).toHaveBeenCalledWith('user-1', 'google', 'google-1');
      expect(out.id).toBe('user-1');
    });

    it('creates a STUDENT user for new Google identities', async () => {
      users.findLiveByOAuth.mockResolvedValue(null);
      users.findLiveByEmail.mockResolvedValue(null);
      users.create.mockImplementation(async () => makeUser({ passwordHash: null }));
      const out = await service.validateGoogleUser({
        id: 'google-9',
        displayName: 'New',
        emails: [{ value: 'new@example.com', verified: true }],
      });
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com', role: 'STUDENT' })
      );
      expect(users.linkOAuthAccount).toHaveBeenCalledWith('user-1', 'google', 'google-9');
      expect(out.id).toBe('user-1');
    });

    it('rejects unverified Google emails', async () => {
      await expect(
        service.validateGoogleUser({ id: 'google-1', emails: [{ value: 'x@example.com' }] })
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        service.validateGoogleUser({
          id: 'google-1',
          emails: [{ value: 'x@example.com', verified: false }],
        })
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects profiles without an id or email', async () => {
      await expect(
        service.validateGoogleUser({ id: '', emails: [{ value: 'x@example.com', verified: true }] })
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        service.validateGoogleUser({ id: 'google-1', emails: [] })
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('configuration', () => {
    it('refuses to boot in production without JWT_SECRET', () => {
      process.env.NODE_ENV = 'production';
      expect(
        () =>
          new AuthService(
            prisma as never,
            users as never,
            jwt,
            configFor({}) as never,
            {
              dispatch: async () => undefined,
            } as never
          )
      ).toThrow('JWT_SECRET is required in production');
    });
  });

  describe('change password (8.19.23)', () => {
    it('changes password with correct current password and revokes sessions', async () => {
      const hash = await argon2.hash('old-password-1');
      users.findLiveById.mockResolvedValue(makeUser({ passwordHash: hash }));
      await service.changePassword('user-1', 'old-password-1', 'new-password-1');
      const stored = tx.user.update.mock.calls[0][0].data.passwordHash as string;
      expect(stored).not.toContain('new-password-1');
      expect(await argon2.verify(stored, 'new-password-1')).toBe(true);
      expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(tx.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('rejects wrong current password with generic 401', async () => {
      const hash = await argon2.hash('old-password-1');
      users.findLiveById.mockResolvedValue(makeUser({ passwordHash: hash }));
      await expect(
        service.changePassword('user-1', 'wrong-password', 'new-password-1')
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('rejects missing current password when one is set', async () => {
      const hash = await argon2.hash('old-password-1');
      users.findLiveById.mockResolvedValue(makeUser({ passwordHash: hash }));
      await expect(
        service.changePassword('user-1', undefined, 'new-password-1')
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('allows OAuth-only accounts to set an initial password', async () => {
      users.findLiveById.mockResolvedValue(makeUser({ passwordHash: null }));
      await service.changePassword('user-1', undefined, 'brand-new-pass');
      expect(tx.user.update).toHaveBeenCalled();
    });
  });

  describe('password reset (8.19.23)', () => {
    it('request is silent for unknown emails (no enumeration)', async () => {
      users.findLiveByEmail.mockResolvedValue(null);
      await expect(service.requestPasswordReset('ghost@example.com')).resolves.toBeUndefined();
      expect(
        (prisma.passwordResetToken as unknown as { create: jest.Mock }).create
      ).not.toHaveBeenCalled();
    });

    it('confirm rejects unknown token consistently', async () => {
      (
        prisma.passwordResetToken as unknown as { findUnique: jest.Mock }
      ).findUnique.mockResolvedValue(null);
      await expect(
        service.confirmPasswordReset(
          'a@example.com',
          'bogus-token-value-1234567890',
          'new-password-1'
        )
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('confirm rejects email mismatch (cannot target another account)', async () => {
      const record = {
        id: 'prt-1',
        tokenHash: 'h',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000),
        user: makeUser({ email: 'owner@example.com' }),
      };
      (
        prisma.passwordResetToken as unknown as { findUnique: jest.Mock }
      ).findUnique.mockResolvedValue(record);
      await expect(
        service.confirmPasswordReset(
          'attacker@example.com',
          'valid-token-value-1234567890',
          'new-password-1'
        )
      ).rejects.toThrow('Invalid or expired reset token');
      expect(tx.user.update).not.toHaveBeenCalled();
    });
  });

  describe('export and deletion (8.19.23)', () => {
    it('export contains only allowed user-owned data', async () => {
      users.findLiveById.mockResolvedValue(
        makeUser({ email: 'me@example.com', passwordHash: 'secret-hash' })
      );
      const out = await service.exportUserData('user-1');
      expect(out.account).toMatchObject({ id: 'user-1', email: 'me@example.com' });
      expect(out.account).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(out)).not.toContain('secret-hash');
      expect(JSON.stringify(out)).not.toContain('tokenHash');
      expect(out).toHaveProperty('memberships');
      expect(out).toHaveProperty('quizAttempts');
      expect(out).toHaveProperty('exportedAt');
    });

    it('delete removes the account in a transaction', async () => {
      users.findLiveById.mockResolvedValue(makeUser());
      await service.deleteAccount('user-1');
      expect(tx.refreshToken.updateMany).toHaveBeenCalled();
      expect(tx.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });
  });
});
