import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { createHash, randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordResetDelivery } from './password-reset-delivery';

process.env.JWT_SECRET = 'e2e-test-secret-that-is-long-enough-for-hs256';

// In-memory Prisma stand-in: no database, no network.
// Extended for 8.19.23 (password resets, account export/delete).
class FakeDb {
  users = new Map<string, Record<string, any>>();
  oauth = new Map<string, Record<string, any>>();
  tokens = new Map<string, Record<string, any>>();
  resets = new Map<string, Record<string, any>>();
  cohorts = new Map<string, Record<string, any>>();
  members = new Map<string, Record<string, any>>();
  attempts: Record<string, any>[] = [];
  snapshots = new Map<string, Record<string, any>>();

  private match(record: Record<string, any>, where: Record<string, any>): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const nested = value as Record<string, any>;
        if ('equals' in nested) return record[key] === nested.equals;
        return false;
      }
      return record[key] === value;
    });
  }

  user = {
    findFirst: async ({ where }: { where: Record<string, any> }) => {
      for (const u of this.users.values()) if (this.match(u, where)) return { ...u };
      return null;
    },
    create: async ({ data }: { data: Record<string, any> }) => {
      const row = {
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...data,
      };
      this.users.set(row.id as string, row);
      return { ...row };
    },
    update: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
      const row = this.users.get(where.id as string);
      if (!row) throw new Error('Record not found');
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
    delete: async ({ where }: { where: Record<string, any> }) => {
      const row = this.users.get(where.id as string);
      if (!row) throw new Error('Record not found');
      this.users.delete(where.id as string);
      return { ...row };
    },
  };

  oAuthAccount = {
    findUnique: async ({
      where,
    }: {
      where: { provider_providerSub: { provider: string; providerSub: string } };
    }) => {
      const row = this.oauth.get(
        `${where.provider_providerSub.provider}|${where.provider_providerSub.providerSub}`
      );
      if (!row) return null;
      return { ...row, user: { ...this.users.get(row.userId as string) } };
    },
    create: async ({ data }: { data: Record<string, any> }) => {
      const row: Record<string, any> = { id: randomUUID(), createdAt: new Date(), ...data };
      this.oauth.set(`${row.provider}|${row.providerSub}`, row);
      return { ...row };
    },
  };

  refreshToken = {
    findUnique: async ({ where }: { where: { tokenHash: string } }) => {
      for (const t of this.tokens.values()) {
        if (t.tokenHash === where.tokenHash) {
          return { ...t, user: { ...this.users.get(t.userId as string) } };
        }
      }
      return null;
    },
    create: async ({ data }: { data: Record<string, any> }) => {
      const row = { id: randomUUID(), revokedAt: null, createdAt: new Date(), ...data };
      this.tokens.set(row.id as string, row);
      return { ...row };
    },
    update: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
      const row = where.id
        ? this.tokens.get(where.id as string)
        : [...this.tokens.values()].find(t => t.tokenHash === where.tokenHash);
      if (!row) throw new Error('Record not found');
      Object.assign(row, data);
      return { ...row };
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, any>;
      data: Record<string, any>;
    }) => {
      let count = 0;
      for (const row of this.tokens.values()) {
        if (this.match(row, { userId: where.userId, revokedAt: null })) {
          Object.assign(row, data);
          count += 1;
        }
      }
      return { count };
    },
  };

  passwordResetToken = {
    findUnique: async ({ where }: { where: { tokenHash: string } }) => {
      for (const r of this.resets.values()) {
        if (r.tokenHash === where.tokenHash) {
          return { ...r, user: { ...this.users.get(r.userId as string) } };
        }
      }
      return null;
    },
    create: async ({ data }: { data: Record<string, any> }) => {
      const row = {
        id: randomUUID(),
        usedAt: null,
        createdAt: new Date(),
        ...data,
      };
      this.resets.set(row.id as string, row);
      return { ...row };
    },
    update: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
      const row = this.resets.get(where.id as string);
      if (!row) throw new Error('Record not found');
      Object.assign(row, data);
      return { ...row };
    },
    deleteMany: async ({ where }: { where: Record<string, any> }) => {
      let count = 0;
      for (const [id, row] of [...this.resets.entries()]) {
        if (this.match(row, where)) {
          this.resets.delete(id);
          count += 1;
        }
      }
      return { count };
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, any>;
      data: Record<string, any>;
    }) => {
      let count = 0;
      for (const row of this.resets.values()) {
        if (this.match(row, where)) {
          Object.assign(row, data);
          count += 1;
        }
      }
      return { count };
    },
  };

  cohort = {
    findMany: async ({ where }: { where: Record<string, any> }) => {
      return [...this.cohorts.values()].filter(c => this.match(c, where)).map(c => ({ ...c }));
    },
  };

  cohortMember = {
    findMany: async ({
      where,
    }: {
      where: Record<string, any>;
      include?: Record<string, any>;
      orderBy?: Record<string, string>;
    }) => {
      return [...this.members.values()]
        .filter(m => this.match(m, where))
        .map(m => ({ ...m, cohort: m.cohortId ? { ...this.cohorts.get(m.cohortId) } : null }));
    },
  };

  quizAttempt = {
    findMany: async ({ where }: { where: Record<string, any> }) => {
      return this.attempts.filter(a => this.match(a, where)).map(a => ({ ...a }));
    },
  };

  progressSnapshot = {
    findUnique: async ({ where }: { where: Record<string, any> }) => {
      const row = this.snapshots.get(where.userId as string);
      return row ? { ...row } : null;
    },
  };

  $transaction = async (fn: (tx: unknown) => unknown) => fn(this);
}

describe('Auth (e2e, no database)', () => {
  let app: INestApplication;
  let db: FakeDb;
  const delivered: Array<{ email: string; token: string }> = [];

  const cookiesOf = (res: request.Response): string[] => {
    const header = (res.headers as Record<string, any>)['set-cookie'];
    return Array.isArray(header) ? (header as string[]) : [];
  };
  const refreshCookie = (res: request.Response): string =>
    cookiesOf(res)
      .map(c => c.split(';')[0])
      .join('; ');

  beforeAll(async () => {
    db = new FakeDb();
    delivered.length = 0;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(PasswordResetDelivery)
      .useValue({
        dispatch: async (email: string, token: string) => {
          delivered.push({ email, token });
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user, sets a secure cookie, and never leaks the password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'student@example.com', password: 'password123', name: 'Stu' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'student@example.com', role: 'STUDENT' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
    const setCookie = cookiesOf(res).join(';');
    expect(setCookie).toContain('refresh_token=');
    expect(setCookie).toContain('HttpOnly');
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'student@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('validates registration input', async () => {
    const badEmail = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });
    expect(badEmail.status).toBe(400);
    const shortPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'other@example.com', password: 'short' });
    expect(shortPassword.status).toBe(400);
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('student@example.com');
    expect(cookiesOf(res).join(';')).toContain('refresh_token=');
  });

  it('rejects bad credentials without distinguishing cases', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.com', password: 'wrong-password-1' });
    const unknownEmail = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password-1' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('protects /me and returns the safe user with a Bearer token', async () => {
    const denied = await request(app.getHttpServer()).get('/api/v1/auth/me');
    expect(denied.status).toBe(401);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.com', password: 'password123' });
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: 'student@example.com', role: 'STUDENT' });
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.com', password: 'password123' });
    const cookie = refreshCookie(login);
    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie);
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).toBeDefined();
    expect(rotated.body.refreshToken).not.toBe(login.body.refreshToken);
    // Reusing the old (now revoked) token fails and burns the family.
    const reuse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie);
    expect(reuse.status).toBe(401);
  });

  it('supports non-cookie (mobile) refresh via JSON body', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.com', password: 'password123' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('logs out, clears the cookie, and kills the token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.com', password: 'password123' });
    const cookie = refreshCookie(login);
    const out = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie);
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ status: 'ok' });
    const after = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie);
    expect(after.status).toBe(401);
  });

  it('rejects deleted users everywhere with generic errors', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'gone@example.com', password: 'password123' });
    const userId = reg.body.user.id as string;
    const accessToken = reg.body.accessToken as string;
    db.users.get(userId)!.deletedAt = new Date();
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'gone@example.com', password: 'password123' });
    expect(login.status).toBe(401);
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
  });

  it('Google entrypoint exists without crashing the app sans credentials', async () => {
    // No network: without configured credentials Google redirects fail at the
    // provider step, but route registration itself must not break boot.
    const res = await request(app.getHttpServer()).get('/api/v1/auth/google').redirects(0);
    expect([302, 500]).toContain(res.status);
  });

  it('stores refresh tokens hashed at rest (sha256, never plaintext)', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.com', password: 'password123' });
    const raw = login.body.refreshToken as string;
    expect(raw).toBeTruthy();
    const expectedHash = createHash('sha256').update(raw).digest('hex');
    const stored = [...db.tokens.values()].map(t => t.tokenHash);
    expect(stored).toContain(expectedHash);
    expect(stored).not.toContain(raw);
    expect(expectedHash).toMatch(/^[0-9a-f]{64}$/);
  });

  describe('8.19.23 account management', () => {
    it('changes password, rejects old password, and revokes sessions', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'pwduser@example.com', password: 'password123' });
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'pwduser@example.com', password: 'password123' });
      const access = login.body.accessToken as string;
      const cookie = refreshCookie(login);

      const wrong = await request(app.getHttpServer())
        .post('/api/v1/auth/password/change')
        .set('Authorization', `Bearer ${access}`)
        .send({ currentPassword: 'not-the-password', newPassword: 'brand-new-pass-1' });
      expect(wrong.status).toBe(401);

      const short = await request(app.getHttpServer())
        .post('/api/v1/auth/password/change')
        .set('Authorization', `Bearer ${access}`)
        .send({ currentPassword: 'password123', newPassword: 'short' });
      expect(short.status).toBe(400);

      const changed = await request(app.getHttpServer())
        .post('/api/v1/auth/password/change')
        .set('Authorization', `Bearer ${access}`)
        .send({ currentPassword: 'password123', newPassword: 'brand-new-pass-1' });
      expect(changed.status).toBe(200);
      expect(changed.body).toEqual({ status: 'ok' });

      const oldLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'pwduser@example.com', password: 'password123' });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'pwduser@example.com', password: 'brand-new-pass-1' });
      expect(newLogin.status).toBe(200);

      const staleRefresh = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie);
      expect(staleRefresh.status).toBe(401);
    });

    it('resets via single-use expiring token without exposing it', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'resetuser@example.com', password: 'password123' });
      const before = delivered.length;
      const req = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'resetuser@example.com' });
      expect(req.status).toBe(200);
      expect(req.body).toEqual({ status: 'ok' });
      expect(req.body).not.toHaveProperty('token');
      expect(JSON.stringify(req.body)).not.toContain('token');
      expect(delivered.length).toBe(before + 1);
      const raw = delivered[delivered.length - 1].token;
      expect(raw.length).toBeGreaterThanOrEqual(20);

      // Hashed at rest, never plaintext.
      const expectedHash = createHash('sha256').update(raw).digest('hex');
      const storedHashes = [...db.resets.values()].map(r => r.tokenHash);
      expect(storedHashes).toContain(expectedHash);
      expect(storedHashes).not.toContain(raw);

      // Cannot target another account.
      const cross = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ email: 'other@example.com', token: raw, newPassword: 'reset-new-pass-1' });
      expect(cross.status).toBe(401);

      const confirm = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ email: 'resetuser@example.com', token: raw, newPassword: 'reset-new-pass-1' });
      expect(confirm.status).toBe(200);
      expect(confirm.body).toEqual({ status: 'ok' });
      expect(confirm.body).not.toHaveProperty('token');

      const oldLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'resetuser@example.com', password: 'password123' });
      expect(oldLogin.status).toBe(401);
      const newLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'resetuser@example.com', password: 'reset-new-pass-1' });
      expect(newLogin.status).toBe(200);

      // Single-use: replay fails.
      const replay = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ email: 'resetuser@example.com', token: raw, newPassword: 'another-pass-12' });
      expect(replay.status).toBe(401);
    });

    it('rejects expired reset tokens and hides account existence', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'expiryuser@example.com', password: 'password123' });
      await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'expiryuser@example.com' });
      const raw = delivered[delivered.length - 1].token;
      for (const row of db.resets.values()) {
        if (createHash('sha256').update(raw).digest('hex') === row.tokenHash) {
          row.expiresAt = new Date(Date.now() - 1000);
        }
      }
      const expired = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ email: 'expiryuser@example.com', token: raw, newPassword: 'new-pass-1234' });
      expect(expired.status).toBe(401);

      const before = delivered.length;
      const ghost = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'nobody-here-123@example.com' });
      expect(ghost.status).toBe(200);
      expect(ghost.body).toEqual({ status: 'ok' });
      expect(delivered.length).toBe(before);
    });

    it('exports only the caller’s own safe data (A/B isolation)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'export-a@example.com', password: 'password123' });
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'export-b@example.com', password: 'password123' });
      const loginA = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'export-a@example.com', password: 'password123' });
      const loginB = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'export-b@example.com', password: 'password123' });

      const denied = await request(app.getHttpServer()).get('/api/v1/auth/account/export');
      expect(denied.status).toBe(401);

      const resA = await request(app.getHttpServer())
        .get('/api/v1/auth/account/export')
        .set('Authorization', `Bearer ${loginA.body.accessToken}`);
      expect(resA.status).toBe(200);
      expect(resA.body.account).toMatchObject({ email: 'export-a@example.com' });
      expect(resA.body).toHaveProperty('cohortsCreated');
      expect(resA.body).toHaveProperty('memberships');
      expect(resA.body).toHaveProperty('quizAttempts');
      expect(resA.body).toHaveProperty('progressSnapshot');
      const serialized = JSON.stringify(resA.body);
      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('tokenHash');
      expect(serialized).not.toContain('export-b@example.com');

      const resB = await request(app.getHttpServer())
        .get('/api/v1/auth/account/export')
        .set('Authorization', `Bearer ${loginB.body.accessToken}`);
      expect(resB.body.account).toMatchObject({ email: 'export-b@example.com' });
      expect(JSON.stringify(resB.body)).not.toContain('export-a@example.com');
    });

    it('deletes the account and blocks all future auth', async () => {
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'deleteme@example.com', password: 'password123' });
      expect(reg.status).toBe(201);
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'deleteme@example.com', password: 'password123' });
      const access = login.body.accessToken as string;
      const cookie = refreshCookie(login);

      const denied = await request(app.getHttpServer()).delete('/api/v1/auth/account');
      expect(denied.status).toBe(401);

      const del = await request(app.getHttpServer())
        .delete('/api/v1/auth/account')
        .set('Authorization', `Bearer ${access}`);
      expect(del.status).toBe(200);
      expect(del.body).toEqual({ status: 'ok' });

      const relogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'deleteme@example.com', password: 'password123' });
      expect(relogin.status).toBe(401);
      expect(relogin.body.message).toBe('Invalid credentials');

      const reRefresh = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie);
      expect(reRefresh.status).toBe(401);

      const me = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${access}`);
      expect(me.status).toBe(401);

      const exp = await request(app.getHttpServer())
        .get('/api/v1/auth/account/export')
        .set('Authorization', `Bearer ${access}`);
      expect(exp.status).toBe(401);
    });
  });
});
