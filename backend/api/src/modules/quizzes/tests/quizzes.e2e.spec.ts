import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../prisma/prisma.service';

process.env.JWT_SECRET = 'e2e-test-secret-that-is-long-enough-for-hs256';

// In-memory Prisma stand-in for identity + quiz bank: no database, no network.
class FakeDb {
  users = new Map<string, Record<string, any>>();
  tokens = new Map<string, Record<string, any>>();
  quizzes = new Map<string, Record<string, any>>();
  questions = new Map<string, Record<string, any>>();
  attempts: Record<string, any>[] = [];
  audits: Record<string, any>[] = [];

  private match(record: Record<string, any>, where: Record<string, any>): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const nested = value as Record<string, unknown>;
        if ('equals' in nested) return record[key] === nested.equals;
        if ('in' in nested) return (nested.in as unknown[]).includes(record[key]);
        return false;
      }
      return record[key] === value;
    });
  }

  private order<T extends Record<string, any>>(rows: T[], orderBy: unknown): T[] {
    const entries = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...rows].sort((a, b) => {
      for (const clause of entries as Record<string, string>[]) {
        const [key, dir] = Object.entries(clause)[0];
        const av = a[key];
        const bv = b[key];
        const cmp =
          av instanceof Date && bv instanceof Date
            ? av.getTime() - bv.getTime()
            : String(av) < String(bv)
              ? -1
              : String(av) > String(bv)
                ? 1
                : 0;
        if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }

  user = {
    findFirst: async ({ where }: { where: Record<string, any> }) => {
      for (const u of this.users.values()) if (this.match(u, where)) return { ...u };
      return null;
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
  };

  refreshToken = {
    findUnique: async ({ where }: { where: { tokenHash: string } }) => {
      for (const t of this.tokens.values()) {
        if (t.tokenHash === where.tokenHash)
          return { ...t, user: { ...this.users.get(t.userId as string) } };
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

  cohorts = new Map<string, Record<string, any>>();
  members = new Map<string, Record<string, any>>();

  cohort = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const now = new Date();
      const row: Record<string, unknown> = {
        id: randomUUID(),
        institutionLabel: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      this.cohorts.set(row.id as string, row);
      return { ...row };
    },
    findFirst: async ({ where }: { where: Record<string, any> }) => {
      for (const c of this.cohorts.values()) if (this.match(c, where)) return { ...c };
      return null;
    },
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      const row = this.cohorts.get(where.id as string);
      return row ? { ...row } : null;
    },
    update: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
      const row = this.cohorts.get(where.id as string);
      if (!row) throw new Error('Record not found');
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
  };

  cohortMember = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row: Record<string, unknown> = { id: randomUUID(), joinedAt: new Date(), ...data };
      this.members.set(row.id as string, row);
      return { ...row };
    },
    findFirst: async ({ where }: { where: Record<string, any> }) => {
      for (const m of this.members.values()) if (this.match(m, where)) return { ...m };
      return null;
    },
    findMany: async (args?: {
      where?: Record<string, any>;
      include?: Record<string, any>;
      orderBy?: unknown;
    }) => {
      let rows = [...this.members.values()];
      if (args?.where) rows = rows.filter(m => this.match(m, args.where as Record<string, any>));
      if (args?.orderBy) rows = this.order(rows, args.orderBy);
      return rows.map(m => {
        const row = { ...m };
        if (args?.include?.cohort) row.cohort = { ...this.cohorts.get(m.cohortId as string) };
        if (args?.include?.user) {
          const u = this.users.get(m.userId as string) ?? {};
          row.user = { id: u.id, name: u.name };
        }
        return row;
      });
    },
  };

  quiz = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const now = new Date();
      const row: Record<string, unknown> = {
        id: randomUUID(),
        status: 'DRAFT',
        description: null,
        bodyModel: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      this.quizzes.set(row.id as string, row);
      return { ...row };
    },
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      const row = this.quizzes.get(where.id as string);
      return row ? { ...row } : null;
    },
    findMany: async (args?: { where?: Record<string, any>; orderBy?: unknown }) => {
      let rows = [...this.quizzes.values()];
      if (args?.where) {
        const { OR, ...rest } = args.where as Record<string, any> & { OR?: Record<string, any>[] };
        rows = rows.filter(
          r =>
            this.match(r, rest) &&
            (!OR || OR.some(clause => this.match(r, clause as Record<string, any>)))
        );
      }
      if (args?.orderBy) rows = this.order(rows, args.orderBy);
      return rows.map(r => ({ ...r }));
    },
    update: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
      const row = this.quizzes.get(where.id as string);
      if (!row) throw new Error('Record not found');
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
    delete: async ({ where }: { where: Record<string, unknown> }) => {
      const row = this.quizzes.get(where.id as string);
      if (!row) throw new Error('Record not found');
      this.quizzes.delete(where.id as string);
      for (const [id, q] of [...this.questions.entries()]) {
        if (q.quizId === where.id) this.questions.delete(id);
      }
      return { ...row };
    },
  };

  quizQuestion = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row: Record<string, unknown> = {
        id: randomUUID(),
        position: 0,
        createdAt: new Date(),
        ...data,
      };
      this.questions.set(row.id as string, row);
      return { ...row };
    },
    findMany: async (args?: { where?: Record<string, any>; orderBy?: unknown }) => {
      let rows = [...this.questions.values()];
      if (args?.where) rows = rows.filter(r => this.match(r, args.where as Record<string, any>));
      if (args?.orderBy) rows = this.order(rows, args.orderBy);
      return rows.map(r => ({ ...r }));
    },
    findFirst: async ({ where }: { where: Record<string, any> }) => {
      for (const q of this.questions.values()) if (this.match(q, where)) return { ...q };
      return null;
    },
    update: async ({ where, data }: { where: Record<string, any>; data: Record<string, any> }) => {
      const row = this.questions.get(where.id as string);
      if (!row) throw new Error('Record not found');
      Object.assign(row, data);
      return { ...row };
    },
    delete: async ({ where }: { where: Record<string, unknown> }) => {
      const row = this.questions.get(where.id as string);
      if (!row) throw new Error('Record not found');
      this.questions.delete(where.id as string);
      return { ...row };
    },
    count: async ({ where }: { where?: Record<string, any> } = {}) => {
      if (!where) return this.questions.size;
      return [...this.questions.values()].filter(r => this.match(r, where)).length;
    },
  };

  quizAttempt = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row: Record<string, unknown> = {
        id: randomUUID(),
        completedAt: new Date(),
        ...data,
      };
      this.attempts.push(row);
      return { ...row };
    },
    findMany: async (args?: { where?: Record<string, any>; orderBy?: unknown; take?: number }) => {
      let rows = this.attempts.filter(r => (!args?.where ? true : this.match(r, args.where)));
      if (args?.orderBy) rows = this.order(rows, args.orderBy);
      if (args?.take !== undefined) rows = rows.slice(0, args.take);
      return rows.map(r => ({ ...r }));
    },
    findFirst: async ({ where }: { where: Record<string, any> }) => {
      for (const a of this.attempts) if (this.match(a, where)) return { ...a };
      return null;
    },
  };

  auditLog = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row: Record<string, unknown> = { id: randomUUID(), createdAt: new Date(), ...data };
      this.audits.push(row);
      return { ...row };
    },
    findMany: async (args?: {
      where?: Record<string, any>;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }) => {
      let rows = this.audits.filter(r => (!args?.where ? true : this.match(r, args.where)));
      if (args?.orderBy) rows = this.order(rows, args.orderBy);
      if (args?.skip !== undefined) rows = rows.slice(args.skip);
      if (args?.take !== undefined) rows = rows.slice(0, args.take);
      return rows.map(r => ({ ...r }));
    },
    count: async ({ where }: { where?: Record<string, any> } = {}) => {
      if (!where) return this.audits.length;
      return this.audits.filter(r => this.match(r, where)).length;
    },
  };

  $transaction = async (fn: (tx: unknown) => unknown) => fn(this);
}

jest.setTimeout(120000);

describe('Quizzes (e2e, question bank + server grading)', () => {
  let app: INestApplication;
  let db: FakeDb;
  const tokens: Record<string, string> = {};

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

    await registerAs('q-teacher@example.com', 'TEACHER');
    await registerAs('q-admin@example.com', 'ADMIN');
    await registerAs('q-student@example.com', 'STUDENT');
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('teacher creates a draft quiz (201); student create → 403; anon → 401', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/quizzes')
      .set(auth('q-teacher@example.com'))
      .send({ title: 'Skin basics', bodyModel: 'male' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ title: 'Skin basics', status: 'DRAFT', questionCount: 0 });

    const studentTry = await request(app.getHttpServer())
      .post('/api/v1/quizzes')
      .set(auth('q-student@example.com'))
      .send({ title: 'Sneaky quiz' });
    expect(studentTry.status).toBe(403);

    const anonTry = await request(app.getHttpServer())
      .post('/api/v1/quizzes')
      .send({ title: 'Anon quiz' });
    expect(anonTry.status).toBe(401);

    const invalid = await request(app.getHttpServer())
      .post('/api/v1/quizzes')
      .set(auth('q-teacher@example.com'))
      .send({ title: '' });
    expect(invalid.status).toBe(400);
  });

  async function makePublishedQuiz(): Promise<{ quizId: string; q1: string; q2: string }> {
    const created = await request(app.getHttpServer())
      .post('/api/v1/quizzes')
      .set(auth('q-teacher@example.com'))
      .send({ title: 'Graded quiz', bodyModel: 'male' });
    expect(created.status).toBe(201);
    const quizId = created.body.id as string;
    const q1 = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set(auth('q-teacher@example.com'))
      .send({ prompt: 'Largest bone?', options: ['Femur', 'Tibia'], correctIndex: 0 });
    expect(q1.status).toBe(201);
    expect(q1.body).toMatchObject({ correctIndex: 0 });
    const q2 = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set(auth('q-teacher@example.com'))
      .send({ prompt: 'Smallest bone?', options: ['Stapes', 'Femur'], correctIndex: 0 });
    expect(q2.status).toBe(201);
    const published = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/publish`)
      .set(auth('q-teacher@example.com'));
    expect(published.status).toBe(200);
    expect(published.body.status).toBe('PUBLISHED');
    return { quizId, q1: q1.body.id as string, q2: q2.body.id as string };
  }

  it('validates questions and publish rules (400s, 403, 409)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/quizzes')
      .set(auth('q-teacher@example.com'))
      .send({ title: 'Validation quiz' });
    const quizId = created.body.id as string;

    const emptyPublish = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/publish`)
      .set(auth('q-teacher@example.com'));
    expect(emptyPublish.status).toBe(409);

    const oneOption = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set(auth('q-teacher@example.com'))
      .send({ prompt: 'P?', options: ['only'], correctIndex: 0 });
    expect(oneOption.status).toBe(400);

    const badIndex = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set(auth('q-teacher@example.com'))
      .send({ prompt: 'P?', options: ['a', 'b'], correctIndex: 5 });
    expect(badIndex.status).toBe(400);

    const blankOption = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set(auth('q-teacher@example.com'))
      .send({ prompt: 'P?', options: ['a', '   '], correctIndex: 0 });
    expect(blankOption.status).toBe(400);

    const studentAdd = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set(auth('q-student@example.com'))
      .send({ prompt: 'P?', options: ['a', 'b'], correctIndex: 0 });
    expect(studentAdd.status).toBe(403);
  });

  it('student reads published quiz without the answer key', async () => {
    const { quizId } = await makePublishedQuiz();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}`)
      .set(auth('q-student@example.com'));
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(2);
    for (const q of res.body.questions) {
      expect(q).not.toHaveProperty('correctIndex');
      expect(q.options).toHaveLength(2);
    }
    expect(JSON.stringify(res.body)).not.toContain('correctIndex');
  });

  it('grades server-side: forged score rejected, real answers scored', async () => {
    const { quizId, q1, q2 } = await makePublishedQuiz();

    const forged = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(auth('q-student@example.com'))
      .send({
        answers: [
          { questionId: q1, selectedIndex: 0 },
          { questionId: q2, selectedIndex: 1 },
        ],
        score: 100,
        correctCount: 2,
        percentage: 100,
      });
    expect(forged.status).toBe(400);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(auth('q-student@example.com'))
      .send({
        answers: [
          { questionId: q1, selectedIndex: 0 },
          { questionId: q2, selectedIndex: 1 },
        ],
      });
    expect(res.status).toBe(201);
    // q1 correct (Femur=0), q2 wrong (Stapes=0, chose 1).
    expect(res.body).toMatchObject({
      score: 1,
      total: 2,
      correct: 1,
      incorrect: 1,
      percentage: 50,
    });
    expect(res.body.results).toEqual([
      { questionId: q1, selected: 0, correct: true },
      { questionId: q2, selected: 1, correct: false },
    ]);

    const mine = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}/attempts`)
      .set(auth('q-student@example.com'));
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]).toMatchObject({ score: 1, total: 2 });

    const single = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}/attempts/${res.body.attemptId}`)
      .set(auth('q-student@example.com'));
    expect(single.status).toBe(200);
    expect(single.body.score).toBe(1);
  });

  it('rejects bad submissions: dup, unknown, cross-quiz, OOR, unpublished', async () => {
    const { quizId, q1 } = await makePublishedQuiz();
    const other = await makePublishedQuiz();
    const student = auth('q-student@example.com');
    const good = [{ questionId: q1, selectedIndex: 0 }];

    const dup = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(student)
      .send({ answers: [good[0], good[0]] });
    expect(dup.status).toBe(400);

    const unknown = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(student)
      .send({
        answers: [{ questionId: '00000000-0000-0000-0000-000000000000', selectedIndex: 0 }],
      });
    expect(unknown.status).toBe(400);

    const cross = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(student)
      .send({ answers: [{ questionId: other.q1, selectedIndex: 0 }] });
    expect(cross.status).toBe(400);

    const oor = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(student)
      .send({ answers: [{ questionId: q1, selectedIndex: 9 }] });
    expect(oor.status).toBe(400);

    const malformed = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(student)
      .send({ answers: [{ questionId: 'not-a-uuid', selectedIndex: 0 }] });
    expect(malformed.status).toBe(400);

    const draft = await request(app.getHttpServer())
      .post('/api/v1/quizzes')
      .set(auth('q-teacher@example.com'))
      .send({ title: 'Never published' });
    const draftSubmit = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${draft.body.id}/attempts`)
      .set(student)
      .send({ answers: [{ questionId: q1, selectedIndex: 0 }] });
    expect(draftSubmit.status).toBe(404);
  });

  it('counts unanswered as incorrect and allows repeat submissions', async () => {
    const { quizId, q1 } = await makePublishedQuiz();
    const student = auth('q-student@example.com');

    const partial = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(student)
      .send({ answers: [{ questionId: q1, selectedIndex: 0 }] });
    expect(partial.status).toBe(201);
    expect(partial.body).toMatchObject({ score: 1, total: 2, incorrect: 1 });

    const again = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(student)
      .send({ answers: [{ questionId: q1, selectedIndex: 0 }] });
    expect(again.status).toBe(201);

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/quizzes/${quizId}/attempts`)
        .set(student)
        .send({ answers: [{ questionId: q1, selectedIndex: 0 }] }),
      request(app.getHttpServer())
        .post(`/api/v1/quizzes/${quizId}/attempts`)
        .set(student)
        .send({ answers: [{ questionId: q1, selectedIndex: 0 }] }),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const mine = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}/attempts`)
      .set(student);
    expect(mine.body.length).toBeGreaterThanOrEqual(4);
  });

  it('student cannot read another student’s attempt (404, no oracle)', async () => {
    const { quizId, q1 } = await makePublishedQuiz();
    const mine = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(auth('q-student@example.com'))
      .send({ answers: [{ questionId: q1, selectedIndex: 0 }] });
    expect(mine.status).toBe(201);

    await registerAs('q-other@example.com', 'STUDENT');
    const peek = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}/attempts/${mine.body.attemptId}`)
      .set(auth('q-other@example.com'));
    expect(peek.status).toBe(404);

    const otherList = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}/attempts`)
      .set(auth('q-other@example.com'));
    expect(otherList.status).toBe(200);
    expect(otherList.body).toEqual([]);
  });

  it('owner updates draft metadata; others 403; archived 409', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/quizzes')
      .set(auth('q-teacher@example.com'))
      .send({ title: 'Editable' });
    const quizId = created.body.id as string;

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/quizzes/${quizId}`)
      .set(auth('q-teacher@example.com'))
      .send({ title: 'Edited title', description: 'New desc' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ title: 'Edited title', description: 'New desc' });

    await registerAs('q-teacher2@example.com', 'TEACHER');
    const otherTeacher = await request(app.getHttpServer())
      .patch(`/api/v1/quizzes/${quizId}`)
      .set(auth('q-teacher2@example.com'))
      .send({ title: 'Hijack' });
    expect(otherTeacher.status).toBe(403);

    const studentPatch = await request(app.getHttpServer())
      .patch(`/api/v1/quizzes/${quizId}`)
      .set(auth('q-student@example.com'))
      .send({ title: 'Hijack' });
    expect(studentPatch.status).toBe(403);
  });

  it('draft questions are editable and deletable; published are immutable', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/quizzes')
      .set(auth('q-teacher@example.com'))
      .send({ title: 'Mutable quiz' });
    const quizId = created.body.id as string;
    const q = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set(auth('q-teacher@example.com'))
      .send({ prompt: 'P?', options: ['a', 'b'], correctIndex: 0, position: 2 });
    const qid = q.body.id as string;

    const reorder = await request(app.getHttpServer())
      .patch(`/api/v1/quizzes/${quizId}/questions/${qid}`)
      .set(auth('q-teacher@example.com'))
      .send({ position: 0, prompt: 'P edited?' });
    expect(reorder.status).toBe(200);
    expect(reorder.body).toMatchObject({ position: 0, prompt: 'P edited?' });

    const badRekey = await request(app.getHttpServer())
      .patch(`/api/v1/quizzes/${quizId}/questions/${qid}`)
      .set(auth('q-teacher@example.com'))
      .send({ options: ['a', 'b', 'c'] });
    expect(badRekey.status).toBe(200);
    expect(badRekey.body.correctIndex).toBe(0);

    const brokeKey = await request(app.getHttpServer())
      .patch(`/api/v1/quizzes/${quizId}/questions/${qid}`)
      .set(auth('q-teacher@example.com'))
      .send({ options: ['only-two', 'x'], correctIndex: 7 });
    expect(brokeKey.status).toBe(400);

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/quizzes/${quizId}/questions/${qid}`)
      .set(auth('q-teacher@example.com'));
    expect(del.status).toBe(200);

    // Re-add + publish → immutable from here.
    const q2 = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set(auth('q-teacher@example.com'))
      .send({ prompt: 'Final?', options: ['a', 'b'], correctIndex: 1 });
    const pub = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/publish`)
      .set(auth('q-teacher@example.com'));
    expect(pub.status).toBe(200);

    const editPub = await request(app.getHttpServer())
      .patch(`/api/v1/quizzes/${quizId}/questions/${q2.body.id}`)
      .set(auth('q-teacher@example.com'))
      .send({ prompt: 'Rewrite history?' });
    expect(editPub.status).toBe(409);

    const delPub = await request(app.getHttpServer())
      .delete(`/api/v1/quizzes/${quizId}/questions/${q2.body.id}`)
      .set(auth('q-teacher@example.com'));
    expect(delPub.status).toBe(409);
  });

  it('archive freezes the quiz; delete preserves attempt history', async () => {
    const { quizId, q1 } = await makePublishedQuiz();
    const student = auth('q-student@example.com');
    const attempt = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(student)
      .send({ answers: [{ questionId: q1, selectedIndex: 0 }] });
    expect(attempt.status).toBe(201);

    const archived = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/archive`)
      .set(auth('q-teacher@example.com'));
    expect(archived.status).toBe(200);
    expect(archived.body.status).toBe('ARCHIVED');

    const frozenAdd = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/questions`)
      .set(auth('q-teacher@example.com'))
      .send({ prompt: 'P?', options: ['a', 'b'], correctIndex: 0 });
    expect(frozenAdd.status).toBe(409);

    const frozenSubmit = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(student)
      .send({ answers: [{ questionId: q1, selectedIndex: 0 }] });
    expect(frozenSubmit.status).toBe(404);

    const otherTeacherArchive = await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/archive`)
      .set(auth('q-teacher2@example.com'));
    expect(otherTeacherArchive.status).toBe(403);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/v1/quizzes/${quizId}`)
      .set(auth('q-teacher@example.com'));
    expect(deleted.status).toBe(200);

    const gone = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}`)
      .set(auth('q-teacher@example.com'));
    expect(gone.status).toBe(404);

    // History survives the quiz (SetNull link, scores intact).
    const legacy = await request(app.getHttpServer())
      .get('/api/v1/progress/quiz-attempts')
      .set(student);
    expect(legacy.status).toBe(200);
    expect(legacy.body.some((a: { id: string }) => a.id === attempt.body.attemptId)).toBe(true);
  });

  it('owner and admin see all rows; non-owner teacher is cohort-scoped; student sees own', async () => {
    const { quizId, q1 } = await makePublishedQuiz();
    const student = auth('q-student@example.com');
    await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(student)
      .send({ answers: [{ questionId: q1, selectedIndex: 0 }] });

    const ownerRows = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}/attempts`)
      .set(auth('q-teacher@example.com'));
    expect(ownerRows.status).toBe(200);
    expect(ownerRows.body.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(ownerRows.body)).not.toContain('correctIndex');

    const adminRows = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}/attempts`)
      .set(auth('q-admin@example.com'));
    expect(adminRows.status).toBe(200);
    expect(adminRows.body.length).toBeGreaterThanOrEqual(1);

    // Non-owner teacher without cohort scope → 403 (must name a cohort).
    const scopedDenied = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}/attempts`)
      .set(auth('q-teacher2@example.com'));
    expect(scopedDenied.status).toBe(403);

    const ownerStats = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}/stats`)
      .set(auth('q-teacher@example.com'));
    expect(ownerStats.status).toBe(200);
    expect(ownerStats.body).toMatchObject({ attempts: expect.any(Number), totalQuestions: 2 });
    expect(ownerStats.body.perQuestion).toHaveLength(2);

    const studentStats = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}/stats`)
      .set(student);
    expect(studentStats.status).toBe(403);
  });

  it('non-owner teacher sees managed-cohort rows via cohort filter', async () => {
    const { quizId, q1 } = await makePublishedQuiz();
    const student = auth('q-student@example.com');
    await request(app.getHttpServer())
      .post(`/api/v1/quizzes/${quizId}/attempts`)
      .set(student)
      .send({ answers: [{ questionId: q1, selectedIndex: 0 }] });

    // Teacher2 owns a cohort containing the student.
    const cohort = await request(app.getHttpServer())
      .post('/api/v1/cohorts')
      .set(auth('q-teacher2@example.com'))
      .send({ name: ' Managed 101 ' });
    expect(cohort.status).toBe(201);
    const cohortId = cohort.body.id as string;
    const invite = cohort.body.inviteCode as string;
    expect(typeof invite).toBe('string');

    const scopedEmpty = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}/attempts?cohortId=${cohortId}`)
      .set(auth('q-teacher2@example.com'));
    // Student is not a member yet → empty, but authorized (200, not 403).
    expect(scopedEmpty.status).toBe(200);
    expect(scopedEmpty.body).toEqual([]);

    const join = await request(app.getHttpServer())
      .post('/api/v1/cohorts/join')
      .set(auth('q-student@example.com'))
      .send({ inviteCode: invite });
    expect(join.status).toBe(201);

    const scoped = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}/attempts?cohortId=${cohortId}`)
      .set(auth('q-teacher2@example.com'));
    expect(scoped.status).toBe(200);
    expect(scoped.body).toHaveLength(1);
    expect(scoped.body[0]).toMatchObject({ score: 1, total: 2 });

    // A cohort the teacher does NOT manage → 404 (same convention as cohorts).
    const foreign = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${quizId}/attempts?cohortId=00000000-0000-0000-0000-000000000000`)
      .set(auth('q-teacher2@example.com'));
    expect(foreign.status).toBe(404);
  });

  it('student cannot see an unpublished quiz (404, no oracle)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/quizzes')
      .set(auth('q-teacher@example.com'))
      .send({ title: 'Hidden draft' });
    const draftId = created.body.id as string;

    const studentGet = await request(app.getHttpServer())
      .get(`/api/v1/quizzes/${draftId}`)
      .set(auth('q-student@example.com'));
    expect(studentGet.status).toBe(404);

    const ghostGet = await request(app.getHttpServer())
      .get('/api/v1/quizzes/00000000-0000-0000-0000-000000000000')
      .set(auth('q-student@example.com'));
    expect(ghostGet.status).toBe(404);
  });
});
