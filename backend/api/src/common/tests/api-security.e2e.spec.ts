import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';

process.env.JWT_SECRET = 'security-suite-secret-that-is-long-enough-for-hs256';

// Focused API security/regression suite (STEP 8.57): unauthenticated access,
// wrong-role access, resource ownership, privileged-field injection, malformed
// IDs, pagination abuse, and token/secret leakage. Deterministic, no database.
// Complements api-contract.e2e (error shapes) and the per-domain suites.
class FakeDb {
  users = new Map<string, Record<string, any>>();
  tokens = new Map<string, Record<string, any>>();
  cohorts = new Map<string, Record<string, any>>();
  members = new Map<string, Record<string, any>>();

  private match(record: Record<string, any>, where: Record<string, any>): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'OR' && Array.isArray(value)) {
        return (value as Record<string, any>[]).some(nested =>
          this.match(record, nested as Record<string, any>)
        );
      }
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const nested = value as Record<string, any>;
        if ('equals' in nested) return record[key] === nested.equals;
        if ('contains' in nested && typeof nested.contains === 'string') {
          const hay = record[key];
          if (typeof hay !== 'string') return false;
          return nested.mode === 'insensitive'
            ? hay.toLowerCase().includes((nested.contains as string).toLowerCase())
            : hay.includes(nested.contains as string);
        }
        if ('not' in nested) return record[key] !== nested.not;
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
    count: async ({ where }: { where?: Record<string, any> } = {}) => {
      return [...this.users.values()].filter(u => this.match(u, where ?? {})).length;
    },
    findMany: async ({
      where,
      orderBy,
      skip,
      take,
    }: {
      where?: Record<string, any>;
      orderBy?: Record<string, string>;
      skip?: number;
      take?: number;
    }) => {
      let rows = [...this.users.values()].filter(u => this.match(u, where ?? {}));
      if (orderBy?.createdAt === 'desc') {
        rows = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      if (typeof skip === 'number') rows = rows.slice(skip);
      if (typeof take === 'number') rows = rows.slice(0, take);
      return rows.map(u => ({ ...u }));
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
        if (this.match(row, where)) {
          Object.assign(row, data);
          count += 1;
        }
      }
      return { count };
    },
  };

  cohort = {
    create: async ({ data }: { data: Record<string, any> }) => {
      const row = {
        id: randomUUID(),
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        inviteCode: randomUUID(),
        ...data,
      };
      this.cohorts.set(row.id as string, row);
      return { ...row };
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = this.cohorts.get(where.id);
      return row ? { ...row } : null;
    },
    findFirst: async ({ where }: { where: Record<string, any> }) => {
      for (const c of this.cohorts.values()) if (this.match(c, where)) return { ...c };
      return null;
    },
    findMany: async ({
      where,
      skip,
      take,
    }: {
      where?: Record<string, any>;
      skip?: number;
      take?: number;
    }) => {
      let rows = [...this.cohorts.values()].filter(c => this.match(c, where ?? {}));
      if (typeof skip === 'number') rows = rows.slice(skip);
      if (typeof take === 'number') rows = rows.slice(0, take);
      return rows.map(c => ({
        ...c,
        _count: { members: [...this.members.values()].filter(m => m.cohortId === c.id).length },
      }));
    },
    count: async ({ where }: { where?: Record<string, any> } = {}) => {
      return [...this.cohorts.values()].filter(c => this.match(c, where ?? {})).length;
    },
  };

  cohortMember = {
    create: async ({ data }: { data: Record<string, any> }) => {
      const row = { id: randomUUID(), joinedAt: new Date(), ...data };
      this.members.set(row.id as string, row);
      return { ...row };
    },
    findFirst: async ({ where }: { where: Record<string, any> }) => {
      for (const m of this.members.values()) if (this.match(m, where)) return { ...m };
      return null;
    },
    findMany: async ({ where }: { where: Record<string, any> }) => {
      return [...this.members.values()]
        .filter(m => this.match(m, where))
        .map(m => ({ ...m, cohort: { ...this.cohorts.get(m.cohortId as string) } }));
    },
  };

  oAuthAccount = {
    findUnique: async () => null,
    create: async ({ data }: { data: Record<string, any> }) => ({ id: randomUUID(), ...data }),
  };
  passwordResetToken = {
    findUnique: async () => null,
    create: async ({ data }: { data: Record<string, any> }) => ({ id: randomUUID(), ...data }),
    update: async () => ({}),
    deleteMany: async () => ({ count: 0 }),
    updateMany: async () => ({ count: 0 }),
  };
  quizAttempt = { findMany: async () => [] };
  progressSnapshot = { findUnique: async () => null };

  $transaction = async (fn: (tx: unknown) => unknown) => fn(this);
}

describe('API security (e2e, no database)', () => {
  let app: INestApplication;
  let db: FakeDb;
  let teacherAuth: Record<string, string>;
  let studentAAuth: Record<string, string>;
  let studentBAuth: Record<string, string>;
  let adminAuth: Record<string, string>;
  let cohortId: string;
  let inviteCode: string;

  const cookiesOf = (res: request.Response): string => {
    const header = (res.headers as Record<string, any>)['set-cookie'];
    const list: string[] = Array.isArray(header) ? header : [];
    return list.map(c => c.split(';')[0]).join('; ');
  };

  async function register(email: string, role: 'TEACHER' | 'ADMIN' | 'STUDENT' = 'STUDENT') {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', name: email.split('@')[0] });
    expect(res.status).toBe(201);
    const user = [...db.users.values()].find(u => u.email === email) as Record<string, any>;
    if (role !== 'STUDENT') user.role = role;
    // Access tokens embed the role at sign time — re-login after promotion.
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' });
    expect(login.status).toBe(200);
    return {
      userId: user.id as string,
      auth: { Authorization: `Bearer ${login.body.accessToken as string}` },
      cookie: cookiesOf(login),
    };
  }

  beforeAll(async () => {
    db = new FakeDb();
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    app.use(cookieParser());
    await app.init();

    const teacher = await register('teacher@example.com', 'TEACHER');
    const studentA = await register('studenta@example.com');
    const studentB = await register('studentb@example.com');
    const admin = await register('admin@example.com', 'ADMIN');
    teacherAuth = teacher.auth;
    studentAAuth = studentA.auth;
    studentBAuth = studentB.auth;
    adminAuth = admin.auth;

    const created = await request(app.getHttpServer())
      .post('/api/v1/cohorts')
      .set(teacherAuth)
      .send({ name: 'Security Lab' });
    expect(created.status).toBe(201);
    cohortId = created.body.id as string;
    inviteCode = created.body.inviteCode as string;
    const joined = await request(app.getHttpServer())
      .post('/api/v1/cohorts/join')
      .set(studentAAuth)
      .send({ inviteCode });
    expect(joined.status).toBe(201);
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access with 401 and no leakage', async () => {
    const paths = [
      '/api/v1/cohorts',
      `/api/v1/cohorts/${cohortId}`,
      '/api/v1/cohorts/assignments/mine',
      '/api/v1/progress/snapshot',
      '/api/v1/notifications/subscriptions',
      '/api/v1/admin/overview',
    ];
    for (const path of paths) {
      const res = await request(app.getHttpServer()).get(path);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenHash|secret/i);
    }
  });

  it('rejects wrong roles without revealing more than forbidden', async () => {
    const studentCreates = await request(app.getHttpServer())
      .post('/api/v1/cohorts')
      .set(studentAAuth)
      .send({ name: 'Nope' });
    expect(studentCreates.status).toBe(403);
    expect(studentCreates.body.code).toBe('FORBIDDEN');
    for (const [auth, path] of [
      [studentAAuth, '/api/v1/admin/overview'],
      [studentAAuth, '/api/v1/admin/users'],
      [teacherAuth, '/api/v1/admin/overview'],
    ] as Array<[Record<string, string>, string]>) {
      const res = await request(app.getHttpServer()).get(path).set(auth);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    }
  });

  it('hides cohort existence from outsiders but serves members', async () => {
    const outsider = await request(app.getHttpServer())
      .get(`/api/v1/cohorts/${cohortId}`)
      .set(studentBAuth);
    expect(outsider.status).toBe(404);
    expect(outsider.body.code).toBe('NOT_FOUND');
    const member = await request(app.getHttpServer())
      .get(`/api/v1/cohorts/${cohortId}`)
      .set(studentAAuth);
    expect(member.status).toBe(200);
    expect(member.body).toMatchObject({ id: cohortId });
    expect(member.body).not.toHaveProperty('inviteCode');
  });

  it('rejects privileged-field injection with 400 and keeps roles intact', async () => {
    const injected = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'sneaky@example.com', password: 'password123', role: 'ADMIN' });
    expect(injected.status).toBe(400);
    expect(injected.body.code).toBe('VALIDATION_ERROR');
    const escalate = await request(app.getHttpServer())
      .patch(`/api/v1/cohorts/${cohortId}`)
      .set(teacherAuth)
      .send({ name: 'Renamed', createdById: 'someone-else' });
    expect(escalate.status).toBe(400);
  });

  it('returns safe 404 for malformed IDs without internals', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/cohorts/!!!not-an-id!!!')
      .set(teacherAuth);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(JSON.stringify(res.body)).not.toMatch(/Prisma|P\d{4}|stack|at\s+\S+\.js/i);
  });

  it('rejects pagination abuse on admin lists', async () => {
    for (const query of ['limit=1000', 'page=0', 'limit=abc', 'page=-2&limit=5']) {
      const users = await request(app.getHttpServer())
        .get(`/api/v1/admin/users?${query}`)
        .set(adminAuth);
      expect(users.status).toBe(400);
      const cohorts = await request(app.getHttpServer())
        .get(`/api/v1/admin/cohorts?${query}`)
        .set(adminAuth);
      expect(cohorts.status).toBe(400);
    }
  });

  it('never leaks credential or token material in auth flows', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'studenta@example.com', password: 'password123' });
    expect(login.status).toBe(200);
    for (const body of [login.body]) {
      expect(body.user).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(body)).not.toMatch(/tokenHash|passwordHash|JWT_SECRET|DATABASE_URL/i);
    }
    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookiesOf(login));
    expect(rotated.status).toBe(200);
    expect(JSON.stringify(rotated.body)).not.toMatch(/tokenHash|passwordHash/i);
    const reset = await request(app.getHttpServer())
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'studenta@example.com' });
    expect(reset.status).toBe(200);
    expect(reset.body).toEqual({ status: 'ok' });
    const garbage = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' });
    expect(garbage.status).toBe(401);
    expect(garbage.body.message).toBe('Invalid credentials');
  });

  it('lets admins operate while students stay out of admin reads', async () => {
    const overview = await request(app.getHttpServer())
      .get('/api/v1/admin/overview')
      .set(adminAuth);
    expect(overview.status).toBe(200);
    expect(overview.body).toMatchObject({ totalUsers: 4 });
    expect(JSON.stringify(overview.body)).not.toMatch(/passwordHash|tokenHash/i);
    const users = await request(app.getHttpServer())
      .get('/api/v1/admin/users?limit=2&page=1')
      .set(adminAuth);
    expect(users.status).toBe(200);
    expect(users.body.page).toBe(1);
    expect(users.body.items.length).toBeLessThanOrEqual(2);
  });
});
