import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

process.env.JWT_SECRET = 'e2e-test-secret-that-is-long-enough-for-hs256';
// Sentinel proving server secrets never leak into subscription responses.
process.env.FCM_SERVER_KEY = 'e2e-sentinel-fcm-key-xyz';

// In-memory Prisma stand-in for identity + push subscriptions: no database, no network.
class FakeDb {
  users = new Map<string, Record<string, any>>();
  oauth = new Map<string, Record<string, any>>();
  tokens = new Map<string, Record<string, any>>();
  subs = new Map<string, Record<string, any>>();

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

  pushSubscription = {
    findUnique: async ({ where }: { where: Record<string, any> }) => {
      if (where.id) {
        const row = this.subs.get(where.id as string);
        return row ? { ...row } : null;
      }
      if (where.endpoint) {
        for (const s of this.subs.values()) {
          if (s.endpoint === where.endpoint) return { ...s };
        }
      }
      return null;
    },
    findMany: async ({
      where,
      orderBy,
    }: {
      where: Record<string, any>;
      orderBy?: Record<string, string>;
    }) => {
      let rows = [...this.subs.values()].filter(s => this.match(s, where)).map(s => ({ ...s }));
      if (orderBy?.createdAt === 'asc') {
        rows = rows.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
      }
      return rows;
    },
    create: async ({ data }: { data: Record<string, any> }) => {
      const row: Record<string, any> = { id: randomUUID(), createdAt: new Date(), ...data };
      this.subs.set(row.id, row);
      return { ...row };
    },
    update: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
      const row = this.subs.get(where.id as string);
      if (!row) throw new Error('Record not found');
      Object.assign(row, data);
      return { ...row };
    },
    delete: async ({ where }: { where: Record<string, any> }) => {
      const row = this.subs.get(where.id as string);
      if (!row) throw new Error('Record not found');
      this.subs.delete(where.id as string);
      return { ...row };
    },
  };

  $transaction = async (fn: (tx: unknown) => unknown) => fn(this);
}

jest.setTimeout(120000);

describe('Notifications (e2e, no database)', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};
  const subIds: Record<string, string> = {};

  const subBody = (endpoint: string, keys: Record<string, unknown> = {}) => ({
    endpoint,
    keys: { p256dh: 'p256dh-key', auth: 'auth-key', ...keys },
  });

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

  const auth = (email: string) => ({ Authorization: `Bearer ${tokens[email]}` });

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

    await loginAs('notify-a@example.com');
    await loginAs('notify-b@example.com');
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access on all subscription routes', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/notifications/subscriptions')
          .send(subBody('https://push.example.com/sub/anon'))
      ).status
    ).toBe(401);
    expect(
      (await request(app.getHttpServer()).get('/api/v1/notifications/subscriptions')).status
    ).toBe(401);
    expect(
      (await request(app.getHttpServer()).delete('/api/v1/notifications/subscriptions/some-id'))
        .status
    ).toBe(401);
  });

  it('registers a subscription with only safe fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/notifications/subscriptions')
      .set(auth('notify-a@example.com'))
      .send(subBody('https://push.example.com/sub/a1'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      endpoint: 'https://push.example.com/sub/a1',
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    });
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.createdAt).toBe('string');
    expect(res.body).not.toHaveProperty('userId');
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('tokenHash');
    expect(serialized).not.toContain('e2e-sentinel-fcm-key-xyz');
    subIds.a1 = res.body.id as string;
  });

  it('handles duplicate registration by the same user idempotently', async () => {
    const again = await request(app.getHttpServer())
      .post('/api/v1/notifications/subscriptions')
      .set(auth('notify-a@example.com'))
      .send(subBody('https://push.example.com/sub/a1', { auth: 'auth-rotated' }));
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(subIds.a1);
    expect(again.body.keys).toMatchObject({ auth: 'auth-rotated' });
    const list = await request(app.getHttpServer())
      .get('/api/v1/notifications/subscriptions')
      .set(auth('notify-a@example.com'));
    expect(list.body.filter((s: { id: string }) => s.id === subIds.a1)).toHaveLength(1);
  });

  it('rejects duplicate endpoints owned by another user (409)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/notifications/subscriptions')
      .set(auth('notify-b@example.com'))
      .send(subBody('https://push.example.com/sub/a1'));
    expect(res.status).toBe(409);
  });

  it('lists only the caller’s subscriptions (A/B isolation)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/notifications/subscriptions')
      .set(auth('notify-a@example.com'))
      .send(subBody('https://push.example.com/sub/a2'));
    await request(app.getHttpServer())
      .post('/api/v1/notifications/subscriptions')
      .set(auth('notify-b@example.com'))
      .send(subBody('https://push.example.com/sub/b1'));
    const a = await request(app.getHttpServer())
      .get('/api/v1/notifications/subscriptions')
      .set(auth('notify-a@example.com'));
    const b = await request(app.getHttpServer())
      .get('/api/v1/notifications/subscriptions')
      .set(auth('notify-b@example.com'));
    expect(a.status).toBe(200);
    expect(a.body.map((s: { endpoint: string }) => s.endpoint).sort()).toEqual(
      ['https://push.example.com/sub/a1', 'https://push.example.com/sub/a2'].sort()
    );
    expect(b.body.map((s: { endpoint: string }) => s.endpoint)).toEqual([
      'https://push.example.com/sub/b1',
    ]);
    for (const row of [...a.body, ...b.body]) {
      expect(row).not.toHaveProperty('userId');
      expect(JSON.stringify(row)).not.toContain('e2e-sentinel-fcm-key-xyz');
    }
    subIds.b1 = (b.body[0] as { id: string }).id;
  });

  it('denies cross-user delete with 404 and keeps the owner’s row', async () => {
    const cross = await request(app.getHttpServer())
      .delete(`/api/v1/notifications/subscriptions/${subIds.b1}`)
      .set(auth('notify-a@example.com'));
    expect(cross.status).toBe(404);
    const owner = await request(app.getHttpServer())
      .get('/api/v1/notifications/subscriptions')
      .set(auth('notify-b@example.com'));
    expect(owner.body.map((s: { id: string }) => s.id)).toContain(subIds.b1);
  });

  it('deletes only the caller’s subscription; repeats are 404', async () => {
    const del = await request(app.getHttpServer())
      .delete(`/api/v1/notifications/subscriptions/${subIds.a1}`)
      .set(auth('notify-a@example.com'));
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ status: 'ok' });
    const again = await request(app.getHttpServer())
      .delete(`/api/v1/notifications/subscriptions/${subIds.a1}`)
      .set(auth('notify-a@example.com'));
    expect(again.status).toBe(404);
    const list = await request(app.getHttpServer())
      .get('/api/v1/notifications/subscriptions')
      .set(auth('notify-a@example.com'));
    expect(list.body.map((s: { id: string }) => s.id)).not.toContain(subIds.a1);
  });

  it('validates subscription DTOs', async () => {
    const headers = auth('notify-a@example.com');
    const missing = await request(app.getHttpServer())
      .post('/api/v1/notifications/subscriptions')
      .set(headers)
      .send({ keys: { p256dh: 'p', auth: 'a' } });
    expect(missing.status).toBe(400);
    const short = await request(app.getHttpServer())
      .post('/api/v1/notifications/subscriptions')
      .set(headers)
      .send(subBody('short'));
    expect(short.status).toBe(400);
    const noKeys = await request(app.getHttpServer())
      .post('/api/v1/notifications/subscriptions')
      .set(headers)
      .send({ endpoint: 'https://push.example.com/sub/nokeys' });
    expect(noKeys.status).toBe(400);
    const badKeys = await request(app.getHttpServer())
      .post('/api/v1/notifications/subscriptions')
      .set(headers)
      .send({ endpoint: 'https://push.example.com/sub/badkeys', keys: 'not-an-object' });
    expect(badKeys.status).toBe(400);
    const extra = await request(app.getHttpServer())
      .post('/api/v1/notifications/subscriptions')
      .set(headers)
      .send({ ...subBody('https://push.example.com/sub/extra'), userId: 'someone-else' });
    expect(extra.status).toBe(400);
  });
});
