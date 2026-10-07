import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../prisma/prisma.service';

process.env.JWT_SECRET = 'e2e-test-secret-that-is-long-enough-for-hs256';

class FakeDb {
  users = new Map<string, Record<string, any>>();
  oauth = new Map<string, Record<string, any>>();
  tokens = new Map<string, Record<string, any>>();
  cohorts = new Map<string, Record<string, any>>();
  members = new Map<string, Record<string, any>>();
  assignments = new Map<string, Record<string, any>>();

  private match(record: Record<string, any>, where: Record<string, any>): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const nested = value as Record<string, any>;
        if ('equals' in nested) return record[key] === nested.equals;
        if ('in' in nested && Array.isArray(nested.in)) return nested.in.includes(record[key]);
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

  snapshots = new Map<string, Record<string, any>>();
  attempts: Record<string, any>[] = [];

  cohortAssignment = {
    findFirst: async ({ where }: { where: Record<string, any> }) => {
      for (const a of this.assignments.values()) if (this.match(a, where)) return { ...a };
      return null;
    },
    findMany: async ({
      where,
      orderBy,
    }: {
      where?: Record<string, any>;
      orderBy?: Record<string, string>;
    }) => {
      let rows = [...this.assignments.values()];
      if (where) {
        rows = rows.filter(a => {
          const entries = Object.entries(where) as Array<[string, unknown]>;
          return entries.every(([key, value]) => {
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
              const nested = value as Record<string, any>;
              if ('in' in nested && Array.isArray(nested.in))
                return (nested.in as unknown[]).includes(a[key]);
              return false;
            }
            return a[key] === value;
          });
        });
      }
      if (orderBy) rows = this.order(rows, orderBy);
      return rows.map(a => ({ ...a }));
    },
    create: async ({ data }: { data: Record<string, any> }) => {
      for (const a of this.assignments.values()) {
        if (a.cohortId === data.cohortId && a.moduleKey === data.moduleKey) {
          throw new Error('Unique constraint failed');
        }
      }
      const row: Record<string, any> = { id: randomUUID(), createdAt: new Date(), ...data };
      this.assignments.set(row.id, row);
      return { ...row };
    },
    delete: async ({ where }: { where: Record<string, any> }) => {
      const row = this.assignments.get(where.id);
      if (!row) throw new Error('Record not found');
      this.assignments.delete(where.id);
      return { ...row };
    },
  };

  progressSnapshot = {
    findMany: async ({ where }: { where?: Record<string, any> }) => {
      return [...this.snapshots.values()]
        .filter(s => this.match(s, where ?? {}))
        .map(s => ({ ...s }));
    },
  };

  quizAttempt = {
    findMany: async ({
      where,
      orderBy,
      select,
    }: {
      where?: Record<string, any>;
      orderBy?: Record<string, string>;
      select?: Record<string, boolean>;
    }) => {
      let rows = this.attempts.filter(a => this.match(a, where ?? {}));
      if (orderBy) rows = this.order(rows, orderBy);
      if (select) {
        const keys = Object.entries(select)
          .filter(([, v]) => v)
          .map(([k]) => k);
        rows = rows.map(a => Object.fromEntries(keys.map(k => [k, a[k]])));
      }
      return rows.map(a => ({ ...a }));
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

  describe('8.20.22 batched getProgress (no N+1)', () => {
    const studentB = () => ids['student-b@example.com'] as string;
    const teacherA = () => ids['teacher-a@example.com'] as string;

    beforeAll(() => {
      db.users.get(teacherA())!.name = 'Tess Teacher';
      db.users.get(studentB())!.name = 'Sam Student';
      db.snapshots.set(studentB(), {
        userId: studentB(),
        studiedKeys: ['male:skin:UBERON:0002097', 'male:nervous:UBERON:0001016'],
        bodyModel: 'male',
        updatedAt: new Date(),
      });
      for (let i = 0; i < 25; i++) {
        db.attempts.push({
          id: `attempt-b-${i}`,
          userId: studentB(),
          score: i,
          total: 10,
          bodyModel: i % 2 === 0 ? 'male' : 'female',
          completedAt: new Date(Date.now() + i * 3600000),
        });
      }
      for (const [i, at] of [10, 30].entries()) {
        db.attempts.push({
          id: `attempt-a-${i}`,
          userId: teacherA(),
          score: 100 + i,
          total: 100,
          bodyModel: 'male',
          completedAt: new Date(Date.now() + at * 3600000),
        });
      }
    });

    it('owner sees every member with correct shape, order, caps, and defaults', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cohorts/${ids.cohort}/progress`)
        .set(auth('teacher-a@example.com'));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.map((m: { userId: string }) => m.userId)).toEqual([teacherA(), studentB()]);
      for (const m of res.body as Array<Record<string, unknown>>) {
        expect(Object.keys(m).sort()).toEqual(
          ['joinedAt', 'name', 'quizAttempts', 'role', 'studiedKeys', 'userId'].sort()
        );
        expect(m).not.toHaveProperty('email');
      }
      const [owner, student] = res.body as Array<{
        userId: string;
        name: string;
        studiedKeys: string[];
        quizAttempts: Array<{ id: string; score: number; completedAt: string }>;
      }>;
      expect(owner.name).toBe('Tess Teacher');
      expect(owner.studiedKeys).toEqual([]);
      expect(owner.quizAttempts.map(a => a.id)).toEqual(['attempt-a-1', 'attempt-a-0']);
      expect(student.name).toBe('Sam Student');
      expect(student.studiedKeys).toEqual([
        'male:skin:UBERON:0002097',
        'male:nervous:UBERON:0001016',
      ]);
      expect(student.quizAttempts).toHaveLength(20);
      expect(student.quizAttempts[0].id).toBe('attempt-b-24');
      expect(student.quizAttempts[19].id).toBe('attempt-b-5');
      const times = student.quizAttempts.map(a => new Date(a.completedAt).getTime());
      expect([...times].sort((a, b) => b - a)).toEqual(times);
    });

    it('issues a bounded number of queries regardless of member count', async () => {
      const snapshotSpy = jest.spyOn(db.progressSnapshot, 'findMany');
      const attemptsSpy = jest.spyOn(db.quizAttempt, 'findMany');
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cohorts/${ids.cohort}/progress`)
        .set(auth('teacher-a@example.com'));
      expect(res.status).toBe(200);
      expect(snapshotSpy).toHaveBeenCalledTimes(1);
      expect(attemptsSpy).toHaveBeenCalledTimes(1);
      expect(attemptsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: { in: expect.any(Array) } } })
      );
      snapshotSpy.mockRestore();
      attemptsSpy.mockRestore();
    });

    it('member without manage rights gets 403; outsider gets 404', async () => {
      const member = await request(app.getHttpServer())
        .get(`/api/v1/cohorts/${ids.cohort}/progress`)
        .set(auth('student-b@example.com'));
      expect(member.status).toBe(403);
      const outsider = await request(app.getHttpServer())
        .get(`/api/v1/cohorts/${ids.cohort}/progress`)
        .set(auth('teacher-b@example.com'));
      expect(outsider.status).toBe(404);
    });
  });

  describe('curriculum assignments (8.52, no database)', () => {
    let cohortId = '';
    let cohortInvite = '';

    it('sets up an isolated cohort with a student member', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/cohorts')
        .set(auth('teacher-a@example.com'))
        .send({ name: 'Assignment Lab' });
      expect(created.status).toBe(201);
      cohortId = created.body.id as string;
      cohortInvite = created.body.inviteCode as string;
      const join = await request(app.getHttpServer())
        .post('/api/v1/cohorts/join')
        .set(auth('student-a@example.com'))
        .send({ inviteCode: cohortInvite });
      expect(join.status).toBe(201);
    });

    it('manager assigns; duplicate returns the same row; invalid module rejected', async () => {
      const first = await request(app.getHttpServer())
        .post(`/api/v1/cohorts/${cohortId}/assignments`)
        .set(auth('teacher-a@example.com'))
        .send({ moduleKey: 'nervous' });
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({ cohortId, moduleKey: 'nervous' });

      const again = await request(app.getHttpServer())
        .post(`/api/v1/cohorts/${cohortId}/assignments`)
        .set(auth('teacher-a@example.com'))
        .send({ moduleKey: 'nervous' });
      expect(again.status).toBe(201);
      expect(again.body.id).toBe(first.body.id);

      const bogus = await request(app.getHttpServer())
        .post(`/api/v1/cohorts/${cohortId}/assignments`)
        .set(auth('teacher-a@example.com'))
        .send({ moduleKey: 'not-a-system' });
      expect(bogus.status).toBe(400);
    });

    it('student member cannot assign; outsider cannot list', async () => {
      const denied = await request(app.getHttpServer())
        .post(`/api/v1/cohorts/${cohortId}/assignments`)
        .set(auth('student-a@example.com'))
        .send({ moduleKey: 'skin' });
      expect(denied.status).toBe(403);
      const listed = await request(app.getHttpServer())
        .get(`/api/v1/cohorts/${cohortId}/assignments`)
        .set(auth('student-a@example.com'));
      expect(listed.status).toBe(200);
      expect(listed.body.map((a: { moduleKey: string }) => a.moduleKey)).toContain('nervous');
      const outsider = await request(app.getHttpServer())
        .get(`/api/v1/cohorts/${cohortId}/assignments`)
        .set(auth('teacher-b@example.com'));
      expect(outsider.status).toBe(404);
    });

    it('manager unassigns; missing assignment 404s', async () => {
      const removed = await request(app.getHttpServer())
        .delete(`/api/v1/cohorts/${cohortId}/assignments/nervous`)
        .set(auth('teacher-a@example.com'));
      expect(removed.status).toBe(200);
      const again = await request(app.getHttpServer())
        .delete(`/api/v1/cohorts/${cohortId}/assignments/nervous`)
        .set(auth('teacher-a@example.com'));
      expect(again.status).toBe(404);
      const listed = await request(app.getHttpServer())
        .get(`/api/v1/cohorts/${cohortId}/assignments`)
        .set(auth('teacher-a@example.com'));
      expect(listed.body).toEqual([]);
    });

    it('mine aggregates only the caller cohorts', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/cohorts/${cohortId}/assignments`)
        .set(auth('teacher-a@example.com'))
        .send({ moduleKey: 'skin' });
      const mine = await request(app.getHttpServer())
        .get('/api/v1/cohorts/assignments/mine')
        .set(auth('student-a@example.com'));
      expect(mine.status).toBe(200);
      const mineForCohort = (
        mine.body as Array<{ cohortId: string; moduleKey: string; cohortName: string }>
      ).filter(a => a.cohortId === cohortId);
      expect(mineForCohort.map(a => a.moduleKey)).toEqual(['skin']);
      expect(mineForCohort[0]).toMatchObject({ cohortId });
      expect(typeof mineForCohort[0].cohortName).toBe('string');
    });

    it('archived cohort keeps assignment/progress reads but rejects writes (8.53)', async () => {
      const archived = await request(app.getHttpServer())
        .post(`/api/v1/cohorts/${cohortId}/archive`)
        .set(auth('teacher-a@example.com'));
      expect(archived.status).toBe(201);
      const managerList = await request(app.getHttpServer())
        .get(`/api/v1/cohorts/${cohortId}/assignments`)
        .set(auth('teacher-a@example.com'));
      expect(managerList.status).toBe(200);
      expect(managerList.body.map((a: { moduleKey: string }) => a.moduleKey)).toContain('skin');
      const memberList = await request(app.getHttpServer())
        .get(`/api/v1/cohorts/${cohortId}/assignments`)
        .set(auth('student-a@example.com'));
      expect(memberList.status).toBe(200);
      const ownerProgress = await request(app.getHttpServer())
        .get(`/api/v1/cohorts/${cohortId}/progress`)
        .set(auth('teacher-a@example.com'));
      expect(ownerProgress.status).toBe(200);
      const assign = await request(app.getHttpServer())
        .post(`/api/v1/cohorts/${cohortId}/assignments`)
        .set(auth('teacher-a@example.com'))
        .send({ moduleKey: 'nervous' });
      expect(assign.status).toBe(403);
      const unassign = await request(app.getHttpServer())
        .delete(`/api/v1/cohorts/${cohortId}/assignments/skin`)
        .set(auth('teacher-a@example.com'));
      expect(unassign.status).toBe(403);
      const memberProgress = await request(app.getHttpServer())
        .get(`/api/v1/cohorts/${cohortId}/progress`)
        .set(auth('student-a@example.com'));
      expect(memberProgress.status).toBe(403);
    });
  });
});
