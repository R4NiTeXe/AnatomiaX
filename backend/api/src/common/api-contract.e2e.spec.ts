import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

process.env.JWT_SECRET = 'e2e-test-secret-that-is-long-enough-for-hs256';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
    findMany: async ({ where }: { where: Record<string, any> }) => {
      return [...this.subs.values()].filter(s => this.match(s, where)).map(s => ({ ...s }));
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

describe('API contract (e2e, 8.19.25)', () => {
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

    await loginAs('contract-a@example.com');
    await loginAs('contract-b@example.com');
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('shapes validation failures with code, details, and request id', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
    expect(res.body.requestId).toMatch(UUID_RE);
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
    expect(res.body).not.toHaveProperty('statusCode');
    expect(res.body).not.toHaveProperty('stack');
  });

  it('standardizes 401s without distinguishing credential cases', async () => {
    const wrong = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'contract-a@example.com', password: 'wrong-password-1' });
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody-here@example.com', password: 'wrong-password-1' });
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
      expect(res.body.requestId).toMatch(UUID_RE);
    }
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('standardizes guard rejections with a generated request id', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(typeof res.body.message).toBe('string');
    expect(res.body.requestId).toMatch(UUID_RE);
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('returns NOT_FOUND for unknown versioned routes', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(typeof res.body.message).toBe('string');
    expect(res.body.requestId).toMatch(UUID_RE);
  });

  it('standardizes 409 conflicts', async () => {
    const endpoint = 'https://push.example.com/sub/contract-409';
    const first = await request(app.getHttpServer())
      .post('/api/v1/notifications/subscriptions')
      .set(auth('contract-a@example.com'))
      .send({ endpoint, keys: { p256dh: 'p', auth: 'a' } });
    expect(first.status).toBe(200);
    const clash = await request(app.getHttpServer())
      .post('/api/v1/notifications/subscriptions')
      .set(auth('contract-b@example.com'))
      .send({ endpoint, keys: { p256dh: 'p', auth: 'a' } });
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe('CONFLICT');
    expect(typeof clash.body.message).toBe('string');
    expect(clash.body.requestId).toMatch(UUID_RE);
  });

  it('keeps health payloads byte-compatible while adding the header', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['x-request-id']).toMatch(UUID_RE);
  });

  it('never leaks internals across error bodies', async () => {
    const bodies: unknown[] = [];
    bodies.push(
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({ email: 'x', password: 'y' })
      ).body
    );
    bodies.push((await request(app.getHttpServer()).get('/api/v1/does-not-exist')).body);
    bodies.push((await request(app.getHttpServer()).get('/api/v1/auth/me')).body);
    for (const body of bodies) {
      const serialized = JSON.stringify(body);
      expect(serialized).not.toMatch(/stack|prisma|SELECT|passwordHash|tokenHash|secret/i);
    }
  });

  // Runs last: exhausts the login-route throttle budget for this file on purpose.
  it('standardizes throttled responses with RATE_LIMITED', async () => {
    const statuses: number[] = [];
    let last: request.Response | undefined;
    for (let i = 0; i < 40; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `throttle-probe-${i}@example.com`, password: 'wrong-password-1' });
      statuses.push(res.status);
      last = res;
    }
    expect(statuses).toContain(429);
    expect(last?.status).toBe(429);
    expect(last?.body.code).toBe('RATE_LIMITED');
    expect(typeof last?.body.message).toBe('string');
    expect(last?.body.message).not.toMatch(/ThrottlerException/);
    expect(last?.body.requestId).toMatch(UUID_RE);
  });
});
