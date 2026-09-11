import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

process.env.JWT_SECRET = 'e2e-test-secret-that-is-long-enough-for-hs256';

// In-memory Prisma stand-in extended for cohorts: no database, no network.
class FakeDb {
  users = new Map<string, Record<string, any>>();
  oauth = new Map<string, Record<string, any>>();
  tokens = new Map<string, Record<string, any>>();
  cohorts = new Map<string, Record<string, any>>();
  members = new Map<string, Record<string, any>>();

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

  private order(
    rows: Record<string, any>[],
    orderBy: Record<string, string>
  ): Record<string, any>[] {
    const [[field, dir]] = Object.entries(orderBy);
    return [...rows].sort((a, b) => {
      const av = a[field] instanceof Date ? a[field].getTime() : a[field];
      const bv = b[field] instanceof Date ? b[field].getTime() : b[field];
      return dir === 'desc' ? (bv > av ? 1 : bv < av ? -1 : 0) : av > bv ? 1 : av < bv ? -1 : 0;
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
        ? (this.members.get(where.id) ?? this.tokens.get(where.id))
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
    findUnique: async ({ where }: { where: Record<string, any> }) => {
      const row = this.cohorts.get(where.id);
      return row ? { ...row } : null;
    },
    findFirst: async ({ where }: { where: Record<string, any> }) => {
      for (const c of this.cohorts.values()) if (this.match(c, where)) return { ...c };
      return null;
    },
    create: async ({ data }: { data: Record<string, any> }) => {
      const row: Record<string, any> = {
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
        ...data,
      };
      this.cohorts.set(row.id, row);
      return { ...row };
    },
    update: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
      const row = this.cohorts.get(where.id);
      if (!row) throw new Error('Record not found');
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
  };

  cohortMember = {
    findFirst: async ({ where }: { where: Record<string, any> }) => {
      for (const m of this.members.values()) if (this.match(m, where)) return { ...m };
      return null;
    },
    findMany: async ({
      where,
      include,
      orderBy,
    }: {
      where: Record<string, any>;
      include?: Record<string, any>;
      orderBy?: Record<string, string>;
    }) => {
      let rows = [...this.members.values()].filter(m => this.match(m, where)).map(m => ({ ...m }));
      if (include?.cohort)
        rows = rows.map(m => ({ ...m, cohort: { ...this.cohorts.get(m.cohortId) } }));
      if (include?.user) {
        rows = rows.map(m => {
          const u = this.users.get(m.userId) ?? {};
          const selected = include.user.select
            ? Object.fromEntries(
                Object.entries(include.user.select).map(([k, v]) => [k, v ? u[k] : undefined])
              )
            : { ...u };
          return { ...m, user: selected };
        });
      }
      return orderBy ? this.order(rows, orderBy) : rows;
    },
    create: async ({ data }: { data: Record<string, any> }) => {
      for (const m of this.members.values()) {
        if (m.cohortId === data.cohortId && m.userId === data.userId) {
          throw new Error('Unique constraint failed');
        }
      }
      const row: Record<string, any> = { id: randomUUID(), joinedAt: new Date(), ...data };
      this.members.set(row.id, row);
      return { ...row };
    },
    delete: async ({ where }: { where: Record<string, any> }) => {
      const row = this.members.get(where.id);
      if (!row) throw new Error('Record not found');
      this.members.delete(where.id);
      return { ...row };
    },
  };

  $transaction = async (fn: (tx: unknown) => unknown) => fn(this);
}

jest.setTimeout(120000);

describe('Cohorts (e2e, no database)', () => {
  let app: INestApplication;
  let db: FakeDb;

  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let inviteCode = '';

  async function registerAs(
    email: string,
    role?: 'TEACHER' | 'ADMIN' | 'STUDENT'
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123' });
    expect(res.status).toBe(201);
    const userId = res.body.user.id as string;
    if (role && role !== 'STUDENT') {
      db.users.get(userId)!.role = role;
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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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

    await registerAs('teacher-a@example.com', 'TEACHER');
    await registerAs('teacher-b@example.com', 'TEACHER');
    await registerAs('student-a@example.com');
    await registerAs('student-b@example.com');
    await registerAs('admin@example.com', 'ADMIN');
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('teacher creates a cohort and becomes its teacher member', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/cohorts')
      .set(auth('teacher-a@example.com'))
      .send({ name: 'Biology 101', institutionLabel: 'Riverside College' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Biology 101', myRole: 'OWNER' });
    expect(typeof res.body.inviteCode).toBe('string');
    expect(res.body.inviteCode).not.toBe(res.body.id);
    ids.cohort = res.body.id as string;
    inviteCode = res.body.inviteCode as string;
  });

  it('student cannot create cohorts (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/cohorts')
      .set(auth('student-a@example.com'))
      .send({ name: 'Sneaky 101' });
    expect(res.status).toBe(403);
  });

  it('unauthenticated access is 401', async () => {
    expect((await request(app.getHttpServer()).get('/api/v1/cohorts')).status).toBe(401);
    expect(
      (await request(app.getHttpServer()).post('/api/v1/cohorts').send({ name: 'X' })).status
    ).toBe(401);
  });

  it('outsider teacher gets 404 on another teacher cohort (IDOR)', async () => {
    const get = await request(app.getHttpServer())
      .get(`/api/v1/cohorts/${ids.cohort}`)
      .set(auth('teacher-b@example.com'));
    expect(get.status).toBe(404);
    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/cohorts/${ids.cohort}`)
      .set(auth('teacher-b@example.com'))
      .send({ name: 'Hijacked' });
    expect(patch.status).toBe(404);
    const remove = await request(app.getHttpServer())
      .delete(`/api/v1/cohorts/${ids.cohort}/members/${ids['student-a@example.com']}`)
      .set(auth('teacher-b@example.com'));
    expect(remove.status).toBe(404);
  });

  it('student joins by invite code; duplicates and bad codes handled', async () => {
    const join = await request(app.getHttpServer())
      .post('/api/v1/cohorts/join')
      .set(auth('student-a@example.com'))
      .send({ inviteCode });
    expect(join.status).toBe(201);
    expect(join.body).toMatchObject({ id: ids.cohort, myRole: 'STUDENT' });
    const dup = await request(app.getHttpServer())
      .post('/api/v1/cohorts/join')
      .set(auth('student-a@example.com'))
      .send({ inviteCode });
    expect(dup.status).toBe(409);
    const bad = await request(app.getHttpServer())
      .post('/api/v1/cohorts/join')
      .set(auth('student-b@example.com'))
      .send({ inviteCode: 'nope-not-real' });
    expect(bad.status).toBe(404);
  });

  it('member reads but cannot manage (403); outsiders stay 404', async () => {
    const get = await request(app.getHttpServer())
      .get(`/api/v1/cohorts/${ids.cohort}`)
      .set(auth('student-a@example.com'));
    expect(get.status).toBe(200);
    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/cohorts/${ids.cohort}`)
      .set(auth('student-a@example.com'))
      .send({ name: 'Hijacked' });
    expect(patch.status).toBe(403);
    const stranger = await request(app.getHttpServer())
      .get(`/api/v1/cohorts/${ids.cohort}`)
      .set(auth('student-b@example.com'));
    expect(stranger.status).toBe(404);
  });

  it('teacher manages own cohort: update, members list hides emails', async () => {
    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/cohorts/${ids.cohort}`)
      .set(auth('teacher-a@example.com'))
      .send({ name: 'Biology 102' });
    expect(patch.status).toBe(200);
    expect(patch.body.name).toBe('Biology 102');
    const members = await request(app.getHttpServer())
      .get(`/api/v1/cohorts/${ids.cohort}/members`)
      .set(auth('teacher-a@example.com'));
    expect(members.status).toBe(200);
    expect(members.body).toHaveLength(2);
    for (const m of members.body as Array<Record<string, unknown>>) {
      expect(m).not.toHaveProperty('email');
    }
    expect(members.body.map((m: { userId: string }) => m.userId).sort()).toEqual(
      [ids['teacher-a@example.com'], ids['student-a@example.com']].sort()
    );
  });

  it('teacher removes a member; removed member loses access', async () => {
    const del = await request(app.getHttpServer())
      .delete(`/api/v1/cohorts/${ids.cohort}/members/${ids['student-a@example.com']}`)
      .set(auth('teacher-a@example.com'));
    expect(del.status).toBe(200);
    const get = await request(app.getHttpServer())
      .get(`/api/v1/cohorts/${ids.cohort}`)
      .set(auth('student-a@example.com'));
    expect(get.status).toBe(404);
  });

  it('student member cannot remove others (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/cohorts/join')
      .set(auth('student-a@example.com'))
      .send({ inviteCode });
    await request(app.getHttpServer())
      .post('/api/v1/cohorts/join')
      .set(auth('student-b@example.com'))
      .send({ inviteCode });
    const del = await request(app.getHttpServer())
      .delete(`/api/v1/cohorts/${ids.cohort}/members/${ids['student-b@example.com']}`)
      .set(auth('student-a@example.com'));
    expect(del.status).toBe(403);
  });

  it('student leaves; leaving twice is 404', async () => {
    const leave = await request(app.getHttpServer())
      .post(`/api/v1/cohorts/${ids.cohort}/leave`)
      .set(auth('student-a@example.com'));
    expect(leave.status).toBe(201);
    const again = await request(app.getHttpServer())
      .post(`/api/v1/cohorts/${ids.cohort}/leave`)
      .set(auth('student-a@example.com'));
    expect(again.status).toBe(404);
  });

  it('invite regeneration rotates the code', async () => {
    const regen = await request(app.getHttpServer())
      .post(`/api/v1/cohorts/${ids.cohort}/invite/regenerate`)
      .set(auth('teacher-a@example.com'));
    expect(regen.status).toBe(201);
    expect(regen.body.inviteCode).toBeDefined();
    expect(regen.body.inviteCode).not.toBe(inviteCode);
    const stale = await request(app.getHttpServer())
      .post('/api/v1/cohorts/join')
      .set(auth('student-a@example.com'))
      .send({ inviteCode });
    expect(stale.status).toBe(404);
    inviteCode = regen.body.inviteCode as string;
  });

  it('admin has operational access to any cohort', async () => {
    const get = await request(app.getHttpServer())
      .get(`/api/v1/cohorts/${ids.cohort}`)
      .set(auth('admin@example.com'));
    expect(get.status).toBe(200);
    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/cohorts/${ids.cohort}`)
      .set(auth('admin@example.com'))
      .send({ institutionLabel: 'Riverside (verified)' });
    expect(patch.status).toBe(200);
    const members = await request(app.getHttpServer())
      .get(`/api/v1/cohorts/${ids.cohort}/members`)
      .set(auth('admin@example.com'));
    expect(members.status).toBe(200);
  });

  it('archived cohorts reject joins and mutations', async () => {
    const archived = await request(app.getHttpServer())
      .post(`/api/v1/cohorts/${ids.cohort}/archive`)
      .set(auth('teacher-a@example.com'));
    expect(archived.status).toBe(201);
    expect(archived.body.archivedAt).toBeTruthy();
    const join = await request(app.getHttpServer())
      .post('/api/v1/cohorts/join')
      .set(auth('student-a@example.com'))
      .send({ inviteCode });
    expect(join.status).toBe(403);
    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/cohorts/${ids.cohort}`)
      .set(auth('teacher-a@example.com'))
      .send({ name: 'Late edit' });
    expect(patch.status).toBe(403);
  });

  it('teacher lists own cohorts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/cohorts')
      .set(auth('teacher-a@example.com'));
    expect(res.status).toBe(200);
    expect(res.body.map((c: { id: string }) => c.id)).toContain(ids.cohort);
  });

  it('validates DTOs', async () => {
    const empty = await request(app.getHttpServer())
      .post('/api/v1/cohorts')
      .set(auth('teacher-a@example.com'))
      .send({});
    expect(empty.status).toBe(400);
    const join = await request(app.getHttpServer())
      .post('/api/v1/cohorts/join')
      .set(auth('student-a@example.com'))
      .send({});
    expect(join.status).toBe(400);
  });
});
