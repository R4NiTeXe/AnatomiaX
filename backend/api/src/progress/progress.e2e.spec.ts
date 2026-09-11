import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

process.env.JWT_SECRET = 'e2e-test-secret-that-is-long-enough-for-hs256';

// In-memory Prisma stand-in for identity + progress: no database, no network.
class FakeDb {
  users = new Map<string, Record<string, any>>();
  oauth = new Map<string, Record<string, any>>();
  tokens = new Map<string, Record<string, any>>();
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
      const row: Record<string, any> = {
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...data,
      };
      this.users.set(row.id, row);
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
      return { ...row, user: { ...this.users.get(row.userId) } };
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
        if (t.tokenHash === where.tokenHash) return { ...t, user: { ...this.users.get(t.userId) } };
      }
      return null;
    },
    create: async ({ data }: { data: Record<string, any> }) => {
      const row: Record<string, any> = {
        id: randomUUID(),
        revokedAt: null,
        createdAt: new Date(),
        ...data,
      };
      this.tokens.set(row.id, row);
      return { ...row };
    },
    update: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
      const row = where.id
        ? this.tokens.get(where.id)
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
        if (this.match(row, where)) {
          Object.assign(row, data);
          count += 1;
        }
      }
      return { count };
    },
  };

  quizAttempt = {
    create: async ({ data }: { data: Record<string, any> }) => {
      const row: Record<string, any> = {
        id: randomUUID(),
        completedAt: new Date(),
        ...data,
      };
      this.attempts.push(row);
      return { ...row };
    },
    findMany: async ({
      where,
      orderBy,
      take,
    }: {
      where: Record<string, any>;
      orderBy?: Record<string, string>;
      take?: number;
    }) => {
      let rows = this.attempts.filter(a => this.match(a, where)).map(a => ({ ...a }));
      if (orderBy?.completedAt === 'desc') {
        rows = rows.sort((x, y) => y.completedAt.getTime() - x.completedAt.getTime());
      }
      return take === undefined ? rows : rows.slice(0, take);
    },
  };

  progressSnapshot = {
    findUnique: async ({ where }: { where: Record<string, any> }) => {
      const row = this.snapshots.get(where.userId);
      return row ? { ...row } : null;
    },
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: Record<string, any>;
      create: Record<string, any>;
      update: Record<string, any>;
    }) => {
      let row = this.snapshots.get(where.userId);
      if (!row) {
        row = { updatedAt: new Date(), ...create };
        this.snapshots.set(where.userId, row);
      } else {
        Object.assign(row, update, { updatedAt: new Date() });
      }
      return { ...row };
    },
  };

  $transaction = async (fn: (tx: unknown) => unknown) => fn(this);
}

jest.setTimeout(120000);

describe('Progress (e2e, no database)', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};

  async function loginAs(email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123' });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' });
    expect(login.status).toBe(200);
    tokens[email] = login.body.accessToken as string;
    return tokens[email];
  }

  const attemptBody = (overrides: Record<string, unknown> = {}) => ({
    bodyModel: 'male',
    score: 4,
    total: 5,
    answers: Array.from({ length: 5 }, (_, i) => ({
      structureKey: `male:nervous:UBERON:000${i}`,
      canonicalName: `Structure ${i}`,
      selected: i % 4,
      correct: 0,
    })),
    startedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(new FakeDb())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    app.use(cookieParser());
    await app.init();

    await loginAs('learner-a@example.com');
    await loginAs('learner-b@example.com');
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('submits a completed attempt scoped to the caller', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/progress/quiz-attempts')
      .set('Authorization', `Bearer ${tokens['learner-a@example.com']}`)
      .send(attemptBody());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ bodyModel: 'male', score: 4, total: 5 });
    expect(res.body.answers).toHaveLength(5);
    expect(typeof res.body.id).toBe('string');
    expect(res.body.userId).toBeDefined();
  });

  it('isolates attempts per user (no cross-user access)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/progress/quiz-attempts')
      .set('Authorization', `Bearer ${tokens['learner-b@example.com']}`)
      .send(attemptBody({ score: 1 }));
    const a = await request(app.getHttpServer())
      .get('/api/v1/progress/quiz-attempts')
      .set('Authorization', `Bearer ${tokens['learner-a@example.com']}`);
    const b = await request(app.getHttpServer())
      .get('/api/v1/progress/quiz-attempts')
      .set('Authorization', `Bearer ${tokens['learner-b@example.com']}`);
    // A submitted exactly 1 attempt (previous test); B submitted exactly 1 here.
    expect(a.body).toHaveLength(1);
    expect(a.body[0]).toMatchObject({ score: 4, total: 5 });
    expect(b.body).toHaveLength(1);
    expect(b.body[0]).toMatchObject({ score: 1, total: 5 });
    // No userId substitution vector: response carries only the caller's records.
    for (const row of [...a.body, ...b.body]) {
      expect(row).not.toHaveProperty('passwordHash');
    }
  });

  it('has no mutation surface: attempts are immutable', async () => {
    const patch = await request(app.getHttpServer())
      .patch('/api/v1/progress/quiz-attempts/some-id')
      .set('Authorization', `Bearer ${tokens['learner-a@example.com']}`)
      .send({ score: 5 });
    expect(patch.status).toBe(404);
    const del = await request(app.getHttpServer())
      .delete('/api/v1/progress/quiz-attempts/some-id')
      .set('Authorization', `Bearer ${tokens['learner-a@example.com']}`);
    expect(del.status).toBe(404);
  });

  it('rejects malformed attempts', async () => {
    const auth = { Authorization: `Bearer ${tokens['learner-a@example.com']}` };
    const over = await request(app.getHttpServer())
      .post('/api/v1/progress/quiz-attempts')
      .set(auth)
      .send(attemptBody({ score: 6 }));
    expect(over.status).toBe(400);
    const mismatch = await request(app.getHttpServer())
      .post('/api/v1/progress/quiz-attempts')
      .set(auth)
      .send(attemptBody({ answers: [{ selected: 0, correct: 0 }] }));
    expect(mismatch.status).toBe(400);
    const badBody = await request(app.getHttpServer())
      .post('/api/v1/progress/quiz-attempts')
      .set(auth)
      .send(attemptBody({ bodyModel: 'alien' }));
    expect(badBody.status).toBe(400);
    const missing = await request(app.getHttpServer())
      .post('/api/v1/progress/quiz-attempts')
      .set(auth)
      .send({ bodyModel: 'male', score: 1, total: 5 });
    expect(missing.status).toBe(400);
  });

  it('returns an empty snapshot by default, then merges additively', async () => {
    const auth = { Authorization: `Bearer ${tokens['learner-a@example.com']}` };
    const empty = await request(app.getHttpServer()).get('/api/v1/progress/snapshot').set(auth);
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ studiedKeys: [], bodyModel: null });
    const first = await request(app.getHttpServer())
      .patch('/api/v1/progress/snapshot/studied')
      .set(auth)
      .send({ keys: ['a', 'b', 'a', '  '], bodyModel: 'male' });
    expect(first.status).toBe(200);
    expect(first.body.studiedKeys).toEqual(['a', 'b']);
    const second = await request(app.getHttpServer())
      .patch('/api/v1/progress/snapshot/studied')
      .set(auth)
      .send({ keys: ['c', 'a'] });
    expect(second.body.studiedKeys).toEqual(['c', 'a', 'b']);
    expect(second.body.bodyModel).toBe('male');
    const read = await request(app.getHttpServer()).get('/api/v1/progress/snapshot').set(auth);
    expect(read.body.studiedKeys).toEqual(['c', 'a', 'b']);
    // Learner B's snapshot is untouched.
    const other = await request(app.getHttpServer())
      .get('/api/v1/progress/snapshot')
      .set('Authorization', `Bearer ${tokens['learner-b@example.com']}`);
    expect(other.body.studiedKeys).toEqual([]);
  });

  it('enforces the stored-size ceiling', async () => {
    const auth = { Authorization: `Bearer ${tokens['learner-b@example.com']}` };
    const keys = Array.from({ length: 560 }, (_, i) => `k-${i}`);
    const res = await request(app.getHttpServer())
      .patch('/api/v1/progress/snapshot/studied')
      .set(auth)
      .send({ keys });
    expect(res.status).toBe(200);
    expect(res.body.studiedKeys).toHaveLength(500);
  });

  it('rejects unauthenticated access on all progress routes', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/progress/quiz-attempts')
          .send(attemptBody())
      ).status
    ).toBe(401);
    expect((await request(app.getHttpServer()).get('/api/v1/progress/quiz-attempts')).status).toBe(
      401
    );
    expect((await request(app.getHttpServer()).get('/api/v1/progress/snapshot')).status).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .patch('/api/v1/progress/snapshot/studied')
          .send({ keys: [] })
      ).status
    ).toBe(401);
  });
});
