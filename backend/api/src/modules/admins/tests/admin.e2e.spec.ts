import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../prisma/prisma.service';

process.env.JWT_SECRET = 'e2e-test-secret-that-is-long-enough-for-hs256';

class FakeDb {
  users = new Map<string, Record<string, unknown>>();
  oauth = new Map<string, Record<string, unknown>>();
  tokens = new Map<string, Record<string, unknown>>();
  passwordResetTokens = new Map<string, Record<string, unknown>>();
  cohorts = new Map<string, Record<string, unknown>>();
  members = new Map<string, Record<string, unknown>>();

  private match(record: Record<string, unknown>, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const nested = value as Record<string, unknown>;
        if ('equals' in nested) return record[key] === nested.equals;
        if ('contains' in nested) {
          const c = nested as { contains: string; mode?: string };
          const recVal = String(record[key] ?? '');
          return c.mode === 'insensitive'
            ? recVal.toLowerCase().includes(c.contains.toLowerCase())
            : recVal.includes(c.contains);
        }
        if ('not' in nested) {
          const v = nested.not;
          if (v === null) return record[key] !== null;
          return record[key] !== v;
        }
        return false;
      }
      return record[key] === value;
    });
  }

  private matchUser(record: Record<string, unknown>, where: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(where)) {
      if (key === 'OR' && Array.isArray(value)) {
        if (!(value as Array<Record<string, unknown>>).some(v => this.matchUser(record, v)))
          return false;
        continue;
      }
      if (key === 'deletedAt' && value === null) {
        if (record.deletedAt !== null) return false;
        continue;
      }
      if (
        value !== null &&
        typeof value === 'object' &&
        'contains' in (value as Record<string, unknown>)
      ) {
        const c = value as { contains: string; mode?: string };
        const recVal = String(record[key] ?? '');
        const contains =
          c.mode === 'insensitive'
            ? recVal.toLowerCase().includes(c.contains.toLowerCase())
            : recVal.includes(c.contains);
        if (!contains) return false;
        continue;
      }
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        if (record[key] !== (value as Record<string, unknown>).equals) return false;
        continue;
      }
      if (record[key] !== value) return false;
    }
    return true;
  }

  private matchCohort(record: Record<string, unknown>, where: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(where)) {
      if (key === 'OR' && Array.isArray(value)) {
        if (!(value as Array<Record<string, unknown>>).some(v => this.matchCohort(record, v)))
          return false;
        continue;
      }
      if (key === 'archivedAt' && value !== null && typeof value === 'object') {
        const v = value as Record<string, unknown>;
        if ('not' in v) {
          if (v.not === null && record.archivedAt === null) return false;
          if (v.not !== null && record.archivedAt === v.not) return false;
        }
        continue;
      }
      if (
        value !== null &&
        typeof value === 'object' &&
        'contains' in (value as Record<string, unknown>)
      ) {
        const c = value as { contains: string; mode?: string };
        const recVal = String(record[key] ?? '');
        const contains =
          c.mode === 'insensitive'
            ? recVal.toLowerCase().includes(c.contains.toLowerCase())
            : recVal.includes(c.contains);
        if (!contains) return false;
        continue;
      }
      if (record[key] !== value) return false;
    }
    return true;
  }

  private order(
    rows: Record<string, unknown>[],
    orderBy: Record<string, string>
  ): Record<string, unknown>[] {
    const [[field, dir]] = Object.entries(orderBy);
    return [...rows].sort((a, b) => {
      const avVal = a[field] as unknown;
      const bvVal = b[field] as unknown;
      const av = avVal instanceof Date ? avVal.getTime() : (avVal as number | string);
      const bv = bvVal instanceof Date ? bvVal.getTime() : (bvVal as number | string);
      return dir === 'desc' ? (bv > av ? 1 : bv < av ? -1 : 0) : av > bv ? 1 : av < bv ? -1 : 0;
    });
  }

  user = {
    count: async (args?: { where?: Record<string, unknown> }) => {
      const where = args?.where;
      if (!where) return this.users.size;
      let n = 0;
      for (const u of this.users.values()) if (this.matchUser(u, where)) n++;
      return n;
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      for (const u of this.users.values()) if (this.matchUser(u, where)) return { ...u };
      return null;
    },
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      const row = this.users.get(where.id as string);
      return row ? { ...row } : null;
    },
    findMany: async (args?: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, string>;
      skip?: number;
      take?: number;
    }) => {
      const where = args?.where;
      const orderBy = args?.orderBy;
      const skip = args?.skip;
      const take = args?.take;
      let rows = [...this.users.values()].filter(u => !where || this.matchUser(u, where));
      if (orderBy) rows = this.order(rows, orderBy);
      if (skip !== undefined) rows = rows.slice(skip);
      if (take !== undefined) rows = rows.slice(0, take);
      return rows.map(r => ({ ...r }));
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row: Record<string, unknown> = {
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...data,
      };
      this.users.set(row.id as string, row);
      return { ...row };
    },
    update: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const row = this.users.get(where.id as string);
      if (!row) throw new Error('Record not found');
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
    delete: async ({ where }: { where: Record<string, unknown> }) => {
      const row = this.users.get(where.id as string);
      if (!row) throw new Error('Record not found');
      this.users.delete(where.id as string);
      // Real-DB cascades (memberships, attempts, tokens, subscriptions) are
      // schema-guaranteed; the fake models row removal only.
      return { ...row };
    },
  };

  audits: Record<string, any>[] = [];

  auditLog = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row: Record<string, unknown> = { id: randomUUID(), createdAt: new Date(), ...data };
      this.audits.push(row);
      return { ...row };
    },
    findMany: async (args?: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }) => {
      let rows = this.audits.filter(r => (!args?.where ? true : this.match(r, args.where)));
      if (args?.orderBy) rows = this.order(rows, args.orderBy as Record<string, string>);
      if (args?.skip !== undefined) rows = rows.slice(args.skip);
      if (args?.take !== undefined) rows = rows.slice(0, args.take);
      return rows.map(r => ({ ...r }));
    },
    count: async ({ where }: { where?: Record<string, unknown> } = {}) => {
      if (!where) return this.audits.length;
      return this.audits.filter(r => this.match(r, where)).length;
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
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row: Record<string, unknown> = { id: randomUUID(), createdAt: new Date(), ...data };
      this.oauth.set(`${row.provider as string}|${row.providerSub as string}`, row);
      return { ...row };
    },
  };

  refreshToken = {
    findUnique: async ({ where }: { where: { tokenHash: string } }) => {
      for (const t of this.tokens.values()) {
        if (t.tokenHash === where.tokenHash)
          return { ...t, user: { ...this.users.get(t.userId as string) } };
      }
      return null;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row: Record<string, unknown> = {
        id: randomUUID(),
        revokedAt: null,
        createdAt: new Date(),
        ...data,
      };
      this.tokens.set(row.id as string, row);
      return { ...row };
    },
    update: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
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
      where: Record<string, unknown>;
      data: Record<string, unknown>;
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
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      for (const t of this.tokens.values()) if (this.match(t, where)) return { ...t };
      return null;
    },
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      return [...this.tokens.values()].filter(t => this.match(t, where)).map(t => ({ ...t }));
    },
  };

  passwordResetToken = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      for (const t of this.passwordResetTokens.values()) if (this.match(t, where)) return { ...t };
      return null;
    },
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      for (const t of this.passwordResetTokens.values())
        if (t.tokenHash === where.tokenHash) return { ...t };
      return null;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row: Record<string, unknown> = { id: randomUUID(), createdAt: new Date(), ...data };
      this.passwordResetTokens.set(row.id as string, row);
      return { ...row };
    },
    update: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const row = this.passwordResetTokens.get(where.id as string);
      if (!row) throw new Error('Record not found');
      Object.assign(row, data);
      return { ...row };
    },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      let count = 0;
      for (const [id, row] of [...this.passwordResetTokens.entries()]) {
        if (this.match(row, where)) {
          this.passwordResetTokens.delete(id);
          count += 1;
        }
      }
      return { count };
    },
  };

  cohort = {
    count: async (args?: { where?: Record<string, unknown> }) => {
      const where = args?.where;
      if (!where || Object.keys(where).length === 0) return this.cohorts.size;
      let n = 0;
      for (const c of this.cohorts.values()) if (this.matchCohort(c, where)) n++;
      return n;
    },
    findMany: async (args?: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, string>;
      skip?: number;
      take?: number;
      include?: Record<string, unknown>;
      select?: Record<string, unknown>;
    }) => {
      const where = args?.where;
      const orderBy = args?.orderBy;
      const skip = args?.skip;
      const take = args?.take;
      // The service selects _count inside `select` (not `include`); honor both.
      const withCount = Boolean(args?.include?._count ?? args?.select?._count);
      let rows = [...this.cohorts.values()].filter(c => !where || this.matchCohort(c, where));
      if (orderBy) rows = this.order(rows, orderBy);
      if (skip !== undefined) rows = rows.slice(skip);
      if (take !== undefined) rows = rows.slice(0, take);
      if (withCount) {
        return rows.map(r => ({
          ...r,
          _count: { members: [...this.members.values()].filter(m => m.cohortId === r.id).length },
        }));
      }
      return rows.map(r => ({ ...r }));
    },
    findUnique: async ({
      where,
      include,
      select,
    }: {
      where: Record<string, unknown>;
      include?: Record<string, unknown>;
      select?: Record<string, unknown>;
    }) => {
      const row = this.cohorts.get(where.id as string);
      if (!row) return null;
      if (include?._count ?? select?._count) {
        return {
          ...row,
          _count: { members: [...this.members.values()].filter(m => m.cohortId === row.id).length },
        };
      }
      return { ...row };
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      for (const c of this.cohorts.values()) if (this.matchCohort(c, where)) return { ...c };
      return null;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row: Record<string, unknown> = {
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
        ...data,
      };
      this.cohorts.set(row.id as string, row);
      return { ...row };
    },
    update: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const row = this.cohorts.get(where.id as string);
      if (!row) throw new Error('Record not found');
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
  };

  cohortMember = {
    findMany: async (args?: {
      where?: Record<string, unknown>;
      include?: Record<string, unknown>;
      orderBy?: Record<string, string>;
    }) => {
      const where = args?.where ?? {};
      const include = args?.include;
      const orderBy = args?.orderBy;
      let rows = [...this.members.values()].filter(m => this.match(m, where)).map(m => ({ ...m }));
      if (include?.cohort)
        rows = rows.map(m => ({ ...m, cohort: { ...this.cohorts.get(m.cohortId as string) } }));
      if (include?.user) {
        rows = rows.map(m => {
          const u = this.users.get(m.userId as string) ?? {};
          const selected = (include.user as { select?: Record<string, boolean> }).select
            ? Object.fromEntries(
                Object.entries((include.user as { select: Record<string, boolean> }).select).map(
                  ([k, v]) => [k, v ? u[k] : undefined]
                )
              )
            : { ...u };
          return { ...m, user: selected };
        });
      }
      return orderBy ? this.order(rows, orderBy) : rows;
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      for (const m of this.members.values()) if (this.match(m, where)) return { ...m };
      return null;
    },
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      const row = this.members.get(where.id as string);
      return row ? { ...row } : null;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      for (const m of this.members.values()) {
        if (m.cohortId === data.cohortId && m.userId === data.userId)
          throw new Error('Unique constraint failed');
      }
      const row: Record<string, unknown> = { id: randomUUID(), joinedAt: new Date(), ...data };
      this.members.set(row.id as string, row);
      return { ...row };
    },
    delete: async ({ where }: { where: Record<string, unknown> }) => {
      const row = this.members.get(where.id as string);
      if (!row) throw new Error('Record not found');
      this.members.delete(where.id as string);
      return { ...row };
    },
    count: async (args?: { where?: Record<string, unknown> }) => {
      const where = args?.where;
      if (!where) return this.members.size;
      return [...this.members.values()].filter(m => this.match(m, where)).length;
    },
  };

  quizAttempt = {
    findMany: async () => [],
    count: async () => 0,
  };
  progressSnapshot = {
    findUnique: async () => null,
    findMany: async () => [],
  };
  pushSubscription = {
    findMany: async () => [],
  };
  prisma = {
    $transaction: async (fn: (tx: unknown) => unknown) => fn(this),
  };

  $transaction = async (fn: (tx: unknown) => unknown) => fn(this);
}

jest.setTimeout(120000);

describe('Admin (e2e, no database)', () => {
  let app: import('@nestjs/common').INestApplication;
  let db: FakeDb;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  async function registerAs(
    email: string,
    role: 'TEACHER' | 'ADMIN' | 'STUDENT' = 'STUDENT'
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123' });
    expect(res.status).toBe(201);
    const userId = res.body.user.id as string;
    if (role !== 'STUDENT') {
      (db.users.get(userId) as Record<string, unknown>).role = role;
    }
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' });
    expect(login.status).toBe(200);
    tokens[email] = login.body.accessToken as string;
    ids[email] = userId;
    return userId;
  }

  const auth = (email: string) => ({ Authorization: `Bearer ${tokens[email]}` });

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

    await registerAs('admin@example.com', 'ADMIN');
    await registerAs('teacher@example.com', 'TEACHER');
    await registerAs('student@example.com', 'STUDENT');

    const c1 = await db.cohort.create({
      data: { name: 'Alpha', institutionLabel: 'Med', createdById: ids['admin@example.com'] },
    });
    const c2 = await db.cohort.create({
      data: {
        name: 'Beta',
        institutionLabel: null,
        createdById: ids['teacher@example.com'],
        archivedAt: new Date(),
      },
    });
    ids.cohort1 = c1.id as string;
    ids.cohort2 = c2.id as string;
    await db.cohortMember.create({
      data: { cohortId: c1.id, userId: ids['admin@example.com'], role: 'TEACHER' },
    });
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('admin can get overview with counts and no secrets', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/overview')
      .set(auth('admin@example.com'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalUsers: expect.any(Number),
      cohortCount: expect.any(Number),
    });
    expect(res.body.byRole).toHaveProperty('STUDENT');
    expect(res.body.recentUsers[0]).not.toHaveProperty('passwordHash');
    expect(res.body.recentUsers[0]).not.toHaveProperty('refreshTokens');
  });

  it('non-admin cannot access admin overview', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/admin/overview')
          .set(auth('teacher@example.com'))
      ).status
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/admin/overview')
          .set(auth('student@example.com'))
      ).status
    ).toBe(403);
    expect((await request(app.getHttpServer()).get('/api/v1/admin/overview')).status).toBe(401);
  });

  it('admin can list users with search/role/pagination and safe fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?search=admin&role=ADMIN&page=1&limit=10')
      .set(auth('admin@example.com'));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].email).toBe('admin@example.com');
    expect(res.body.items[0]).not.toHaveProperty('passwordHash');
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
  });

  it('admin users pagination caps limit', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?limit=100')
      .set(auth('admin@example.com'));
    expect(res.status).toBe(200);
    expect(res.body.limit).toBeLessThanOrEqual(50);
  });

  it('teacher/student cannot list admin users', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/admin/users')
          .set(auth('teacher@example.com'))
      ).status
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/admin/users')
          .set(auth('student@example.com'))
      ).status
    ).toBe(403);
  });

  it('admin can list cohorts with search/archived/pagination', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/cohorts?search=Alpha')
      .set(auth('admin@example.com'));
    expect(res.status).toBe(200);
    expect(res.body.items.some((c: { name: string }) => c.name === 'Alpha')).toBe(true);
    expect(res.body.items[0]).toHaveProperty('memberCount');
  });

  it('admin cohorts archived filter', async () => {
    const active = await request(app.getHttpServer())
      .get('/api/v1/admin/cohorts?archived=false')
      .set(auth('admin@example.com'));
    expect(active.status).toBe(200);
    expect(
      active.body.items.every((c: { archivedAt: string | null }) => c.archivedAt === null)
    ).toBe(true);
    const archived = await request(app.getHttpServer())
      .get('/api/v1/admin/cohorts?archived=true')
      .set(auth('admin@example.com'));
    expect(archived.status).toBe(200);
    expect(
      archived.body.items.every((c: { archivedAt: string | null }) => c.archivedAt !== null)
    ).toBe(true);
  });

  it('admin can get cohort detail, 404 for missing', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/cohorts/${ids.cohort1}`)
      .set(auth('admin@example.com'));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ids.cohort1);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/admin/cohorts/missing-id')
          .set(auth('admin@example.com'))
      ).status
    ).toBe(404);
  });

  it('teacher/student cannot access admin cohorts', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/admin/cohorts')
          .set(auth('teacher@example.com'))
      ).status
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/admin/cohorts')
          .set(auth('student@example.com'))
      ).status
    ).toBe(403);
  });

  it('validates query DTOs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?limit=9999')
      .set(auth('admin@example.com'));
    expect(res.status).toBe(400);
  });

  it('admin inspects a user with safe fields and stats; unknown → 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${ids['student@example.com']}`)
      .set(auth('admin@example.com'));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'student@example.com', role: 'STUDENT' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body).toHaveProperty('deactivatedAt', null);
    expect(res.body.stats).toMatchObject({ memberships: 0, quizAttempts: 0, cohortsCreated: 0 });

    const ghost = await request(app.getHttpServer())
      .get('/api/v1/admin/users/00000000-0000-0000-0000-000000000000')
      .set(auth('admin@example.com'));
    expect(ghost.status).toBe(404);

    const studentPeek = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${ids['teacher@example.com']}`)
      .set(auth('student@example.com'));
    expect(studentPeek.status).toBe(403);

    const anonPeek = await request(app.getHttpServer()).get(
      `/api/v1/admin/users/${ids['teacher@example.com']}`
    );
    expect(anonPeek.status).toBe(401);
  });

  it('admin provisions a teacher; forged role/self/last-admin guarded; audited', async () => {
    const before = db.audits.length;
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${ids['student@example.com']}/role`)
      .set(auth('admin@example.com'))
      .send({ role: 'TEACHER' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('TEACHER');

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.com', password: 'password123' });
    expect(login.status).toBe(200);

    const forged = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${ids['teacher@example.com']}/role`)
      .set(auth('admin@example.com'))
      .send({ role: 'SUPERADMIN' });
    expect(forged.status).toBe(400);

    const studentTry = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${ids['teacher@example.com']}/role`)
      .set(auth('student@example.com'))
      .send({ role: 'TEACHER' });
    expect(studentTry.status).toBe(403);

    const anonTry = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${ids['teacher@example.com']}/role`)
      .send({ role: 'TEACHER' });
    expect(anonTry.status).toBe(401);

    // Non-admin callers never reach the service (guard first).
    const lastAdmin = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${ids['admin@example.com']}/role`)
      .set(auth('teacher@example.com'));
    expect(lastAdmin.status).toBe(403);

    // The sole admin demoting themselves out of the last-admin seat → 409
    // (the guard counts live admins; self-inflicted removal is covered).
    const soloDemote = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${ids['admin@example.com']}/role`)
      .set(auth('admin@example.com'))
      .send({ role: 'STUDENT' });
    expect(soloDemote.status).toBe(409);

    // Still an admin afterwards — the rejected write changed nothing.
    const stillAdmin = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${ids['admin@example.com']}`)
      .set(auth('admin@example.com'));
    expect(stillAdmin.body.user.role).toBe('ADMIN');

    const audits = db.audits.filter(a => a.action === 'user.role.changed');
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(audits[0]).toMatchObject({
      actorId: ids['admin@example.com'],
      targetType: 'user',
      targetId: ids['student@example.com'],
    });
    expect(JSON.stringify(audits[0])).not.toContain('password');
    expect(db.audits.length).toBeGreaterThan(before);
  });

  it('admin deactivates and restores; deactivated cannot log in', async () => {
    const off = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${ids['teacher@example.com']}/deactivate`)
      .set(auth('admin@example.com'));
    expect(off.status).toBe(200);
    expect(off.body.deactivatedAt).not.toBeNull();

    const blocked = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'teacher@example.com', password: 'password123' });
    expect(blocked.status).toBe(401);

    const again = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${ids['teacher@example.com']}/deactivate`)
      .set(auth('admin@example.com'));
    expect(again.status).toBe(409);

    const back = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${ids['teacher@example.com']}/restore`)
      .set(auth('admin@example.com'));
    expect(back.status).toBe(200);
    expect(back.body.deactivatedAt).toBeNull();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'teacher@example.com', password: 'password123' });
    expect(login.status).toBe(200);

    const active = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${ids['teacher@example.com']}/restore`)
      .set(auth('admin@example.com'));
    expect(active.status).toBe(409);
  });

  it('admin deletes an account; self and last-admin protected; audited', async () => {
    const gone = await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${ids['student@example.com']}`)
      .set(auth('admin@example.com'));
    expect(gone.status).toBe(200);

    const check = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${ids['student@example.com']}`)
      .set(auth('admin@example.com'));
    expect(check.status).toBe(404);

    const relogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@example.com', password: 'password123' });
    expect(relogin.status).toBe(401);

    const lastAdminDelete = await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${ids['admin@example.com']}`)
      .set(auth('teacher@example.com'));
    expect(lastAdminDelete.status).toBe(403);

    // Sole-admin self-delete is refused (would orphan administration).
    const selfDelete = await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${ids['admin@example.com']}`)
      .set(auth('admin@example.com'));
    expect(selfDelete.status).toBe(409);

    const audits = db.audits.filter(a => a.action === 'user.deleted');
    expect(audits.length).toBe(1);
    expect(audits[0].targetId).toBe(ids['student@example.com']);
  });

  it('admin reads audit logs with filters/pagination; never secrets; others denied', async () => {
    const adminAuth = auth('admin@example.com');
    const list = await request(app.getHttpServer()).get('/api/v1/admin/audit-logs').set(adminAuth);
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(list.body.items)).toBe(true);
    const serialized = JSON.stringify(list.body);
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('tokenHash');
    expect(serialized).not.toContain('refreshToken');

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs?action=user.role.changed')
      .set(adminAuth);
    expect(filtered.status).toBe(200);
    expect(filtered.body.total).toBeGreaterThanOrEqual(1);
    for (const row of filtered.body.items) expect(row.action).toBe('user.role.changed');

    const badAction = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs?action=user.hacked')
      .set(adminAuth);
    expect(badAction.status).toBe(400);

    const studentTry = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set(auth('teacher@example.com'));
    expect(studentTry.status).toBe(403);

    const anonTry = await request(app.getHttpServer()).get('/api/v1/admin/audit-logs');
    expect(anonTry.status).toBe(401);
  });
});
