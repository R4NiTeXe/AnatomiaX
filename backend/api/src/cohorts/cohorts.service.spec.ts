import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CohortsService } from './cohorts.service';

const TEACHER = { id: 'teacher-1', role: 'TEACHER' };
const TEACHER_B = { id: 'teacher-2', role: 'TEACHER' };
const STUDENT = { id: 'student-1', role: 'STUDENT' };
const ADMIN = { id: 'admin-1', role: 'ADMIN' };

const cohortRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'cohort-1',
  name: 'Biology 101',
  institutionLabel: null,
  inviteCode: 'invite-abc',
  archivedAt: null,
  createdAt: new Date(),
  createdById: 'teacher-1',
  ...overrides,
});

describe('CohortsService', () => {
  let service: CohortsService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let tx: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    tx = {
      cohort: { create: jest.fn() },
      cohortMember: { create: jest.fn() },
    };
    prisma = {
      cohort: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cohortMember: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };
    (prisma as Record<string, unknown>).$transaction = jest.fn(
      async (fn: (t: unknown) => unknown) => fn(tx)
    );
    service = new CohortsService(prisma as never);
  });

  const ownerCtx = () => {
    prisma.cohort.findUnique.mockResolvedValue(cohortRow());
    prisma.cohortMember.findFirst.mockResolvedValue(null);
  };

  describe('create', () => {
    it('creates the cohort and seats the creator as TEACHER in one transaction', async () => {
      tx.cohort.create.mockResolvedValue(cohortRow());
      const view = await service.create(TEACHER as never, { name: 'Biology 101' });
      expect(tx.cohort.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Biology 101', createdById: 'teacher-1' }),
        })
      );
      const code = tx.cohort.create.mock.calls[0][0].data.inviteCode as string;
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThanOrEqual(16);
      expect(tx.cohortMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'teacher-1', role: 'TEACHER' }),
        })
      );
      expect(view.myRole).toBe('OWNER');
    });
  });

  describe('access control', () => {
    it('outsiders get 404 (no existence oracle)', async () => {
      ownerCtx();
      await expect(service.get(STUDENT as never, 'cohort-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
      await expect(
        service.update(STUDENT as never, 'cohort-1', { name: 'X' })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('members can read but not manage (403)', async () => {
      prisma.cohort.findUnique.mockResolvedValue(cohortRow());
      prisma.cohortMember.findFirst.mockResolvedValue({ role: 'STUDENT' });
      await expect(service.get(STUDENT as never, 'cohort-1')).resolves.toMatchObject({
        id: 'cohort-1',
      });
      await expect(
        service.update(STUDENT as never, 'cohort-1', { name: 'X' })
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.archive(STUDENT as never, 'cohort-1')).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });

    it('owners manage even without membership; admins manage everything', async () => {
      ownerCtx();
      prisma.cohort.update.mockImplementation(async ({ data }: never) => ({
        ...cohortRow(),
        ...(data as object),
      }));
      await expect(
        service.update(TEACHER as never, 'cohort-1', { name: 'New' })
      ).resolves.toMatchObject({ name: 'New' });
      await expect(service.archive(ADMIN as never, 'cohort-1')).resolves.toMatchObject({
        id: 'cohort-1',
      });
      await expect(service.get(ADMIN as never, 'cohort-1')).resolves.toMatchObject({
        id: 'cohort-1',
      });
    });

    it('missing cohorts are 404', async () => {
      prisma.cohort.findUnique.mockResolvedValue(null);
      await expect(service.get(ADMIN as never, 'nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('a teacher outside the cohort cannot see or manage it', async () => {
      ownerCtx();
      await expect(service.get(TEACHER_B as never, 'cohort-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
      await expect(
        service.update(TEACHER_B as never, 'cohort-1', { name: 'X' })
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.removeMember(TEACHER_B as never, 'cohort-1', 's')
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('archived cohorts are read-only', () => {
    beforeEach(() => {
      ownerCtx();
      prisma.cohort.findUnique.mockResolvedValue(cohortRow({ archivedAt: new Date() }));
    });

    it('blocks update, invite regeneration, member removal, and joins', async () => {
      await expect(service.update(TEACHER as never, 'cohort-1', { name: 'X' })).rejects.toThrow(
        'Cohort is archived'
      );
      await expect(service.regenerateInvite(TEACHER as never, 'cohort-1')).rejects.toThrow(
        'Cohort is archived'
      );
      await expect(service.removeMember(TEACHER as never, 'cohort-1', 'student-1')).rejects.toThrow(
        'Cohort is archived'
      );
      prisma.cohort.findFirst.mockResolvedValue(cohortRow({ archivedAt: new Date() }));
      await expect(service.join(STUDENT as never, 'invite-abc')).rejects.toThrow(
        'Cohort is archived'
      );
    });
  });

  describe('join / leave', () => {
    it('joins by code as STUDENT and rejects duplicates and bad codes', async () => {
      prisma.cohort.findFirst.mockResolvedValue(null);
      await expect(service.join(STUDENT as never, 'bad-code')).rejects.toBeInstanceOf(
        NotFoundException
      );
      prisma.cohort.findFirst.mockResolvedValue(cohortRow());
      prisma.cohortMember.findFirst.mockResolvedValue({ role: 'STUDENT' });
      await expect(service.join(STUDENT as never, 'invite-abc')).rejects.toBeInstanceOf(
        ConflictException
      );
      prisma.cohortMember.findFirst.mockResolvedValue(null);
      prisma.cohortMember.create.mockResolvedValue({ role: 'STUDENT' });
      await expect(service.join(STUDENT as never, 'invite-abc')).resolves.toMatchObject({
        id: 'cohort-1',
        myRole: 'STUDENT',
      });
    });

    it('leave removes membership only, never ownership', async () => {
      prisma.cohortMember.findFirst.mockResolvedValue({ id: 'm-1' });
      await service.leave(TEACHER as never, 'cohort-1');
      expect(prisma.cohortMember.delete).toHaveBeenCalledWith({ where: { id: 'm-1' } });
      expect(prisma.cohort.update).not.toHaveBeenCalled();
    });

    it('leave without membership is 404', async () => {
      prisma.cohortMember.findFirst.mockResolvedValue(null);
      await expect(service.leave(STUDENT as never, 'cohort-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  describe('members', () => {
    it('removeMember requires a manager and an existing membership', async () => {
      ownerCtx();
      prisma.cohortMember.findFirst.mockResolvedValue(null);
      await expect(
        service.removeMember(TEACHER as never, 'cohort-1', 'ghost')
      ).rejects.toBeInstanceOf(NotFoundException);
      prisma.cohortMember.findFirst.mockResolvedValue({ id: 'm-2' });
      await service.removeMember(TEACHER as never, 'cohort-1', 'student-1');
      expect(prisma.cohortMember.delete).toHaveBeenCalledWith({ where: { id: 'm-2' } });
    });

    it('lists members without emails', async () => {
      prisma.cohort.findUnique.mockResolvedValue(cohortRow());
      prisma.cohortMember.findFirst.mockResolvedValue({ role: 'TEACHER' });
      prisma.cohortMember.findMany.mockResolvedValue([
        {
          userId: 'teacher-1',
          role: 'TEACHER',
          joinedAt: new Date(),
          user: { id: 'teacher-1', name: 'T', email: 't@example.com' },
        },
      ]);
      const list = await service.listMembers(TEACHER as never, 'cohort-1');
      expect(list).toHaveLength(1);
      expect(list[0]).not.toHaveProperty('email');
      expect(list[0]).toMatchObject({ userId: 'teacher-1', role: 'TEACHER' });
    });

    it('listMine returns viewer cohorts newest-first', async () => {
      prisma.cohortMember.findMany.mockResolvedValue([
        { role: 'STUDENT', cohort: cohortRow({ id: 'c-old' }) },
        { role: 'STUDENT', cohort: cohortRow({ id: 'c-new' }) },
      ]);
      const list = await service.listMine(STUDENT as never);
      expect(list).toHaveLength(2);
      expect(prisma.cohortMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'student-1' } })
      );
    });
  });
});
