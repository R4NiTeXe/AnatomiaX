import { AdminService } from '../admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    prisma = {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      cohort: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    } as unknown as Record<string, Record<string, jest.Mock>>;
    const prismaMock = {
      user: prisma.user,
      cohort: prisma.cohort,
    } as never;
    const audit = { record: jest.fn(async () => undefined) };
    service = new AdminService(prismaMock as never, audit as never);
  });

  describe('getOverview', () => {
    it('returns counts and recent items without sensitive fields', async () => {
      prisma.user.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1);
      prisma.cohort.count
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(1);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          email: 'a@b.c',
          name: 'Ada',
          role: 'STUDENT',
          createdAt: new Date(),
          deletedAt: null,
        },
      ]);
      prisma.cohort.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Bio 101',
          archivedAt: null,
          createdAt: new Date(),
          createdById: 'u1',
          _count: { members: 2 },
        },
      ]);

      const overview = await service.getOverview();
      expect(overview.totalUsers).toBe(10);
      expect(overview.byRole.STUDENT).toBe(6);
      expect(overview.cohortCount).toBe(4);
      expect(overview.recentUsers[0]).not.toHaveProperty('passwordHash');
      expect(overview.recentUsers[0]).toHaveProperty('email');
      expect(overview.recentCohorts[0].memberCount).toBe(2);
      const overviewUserArgs = prisma.user.findMany.mock.calls[0][0] as {
        select?: Record<string, boolean>;
      };
      expect(overviewUserArgs.select).toBeDefined();
      expect(overviewUserArgs.select).not.toHaveProperty('passwordHash');
      expect(overviewUserArgs.select).not.toHaveProperty('deletedAt');
      const overviewCohortArgs = prisma.cohort.findMany.mock.calls[0][0] as {
        select?: Record<string, unknown>;
      };
      expect(overviewCohortArgs.select).toBeDefined();
      expect(overviewCohortArgs.select).not.toHaveProperty('inviteCode');
    });
  });

  describe('listUsers', () => {
    it('paginates and filters by role/search with safe DTO', async () => {
      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          email: 'a@b.c',
          name: 'Ada',
          role: 'STUDENT',
          createdAt: new Date(),
          deletedAt: null,
        },
      ]);
      const res = await service.listUsers({ search: 'Ada', role: 'STUDENT', page: 1, limit: 20 });
      expect(res.total).toBe(1);
      expect(res.items[0].email).toBe('a@b.c');
      expect(res.items[0]).not.toHaveProperty('passwordHash');
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 })
      );
      const listUserArgs = prisma.user.findMany.mock.calls[0][0] as {
        select?: Record<string, boolean>;
      };
      expect(listUserArgs.select).toEqual({
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      });
    });

    it('ignores roles outside the allowlist instead of reaching Prisma untyped', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);
      await service.listUsers({ role: 'SUPERADMIN' });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } })
      );
    });

    it('caps limit to 50', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);
      await service.listUsers({ page: 1, limit: 100 });
      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    });
  });

  describe('listCohorts', () => {
    it('returns paginated cohorts with member counts', async () => {
      prisma.cohort.count.mockResolvedValue(1);
      prisma.cohort.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Bio',
          institutionLabel: null,
          archivedAt: null,
          createdAt: new Date(),
          _count: { members: 3 },
        },
      ]);
      const res = await service.listCohorts({ page: 1, limit: 10 });
      expect(res.total).toBe(1);
      expect(res.items[0].memberCount).toBe(3);
      expect(res.items[0].name).toBe('Bio');
      const listCohortArgs = prisma.cohort.findMany.mock.calls[0][0] as {
        select?: Record<string, unknown>;
      };
      expect(listCohortArgs.select).toBeDefined();
      expect(listCohortArgs.select).not.toHaveProperty('inviteCode');
      expect(listCohortArgs.select).toHaveProperty('_count');
    });
  });

  describe('getCohort', () => {
    it('returns null for missing cohort', async () => {
      prisma.cohort.findUnique.mockResolvedValue(null);
      expect(await service.getCohort('nope')).toBeNull();
    });
    it('returns cohort with memberCount', async () => {
      prisma.cohort.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Bio',
        institutionLabel: null,
        archivedAt: null,
        createdAt: new Date(),
        _count: { members: 1 },
      });
      const c = await service.getCohort('c1');
      expect(c?.memberCount).toBe(1);
    });
  });

  describe('user lifecycle guards', () => {
    const admin = { id: 'admin-1', role: 'ADMIN' } as never;
    const liveAdmin = (overrides: Record<string, unknown> = {}) => ({
      id: 'admin-1',
      email: 'a@b.c',
      name: 'Ada',
      role: 'ADMIN',
      createdAt: new Date(),
      deletedAt: null,
      ...overrides,
    });

    it('refuses to demote the sole administrator', async () => {
      prisma.user.findUnique.mockResolvedValue(liveAdmin());
      prisma.user.count.mockResolvedValue(1);
      await expect(service.setUserRole(admin, 'admin-1', 'STUDENT' as never)).rejects.toThrow(
        'Cannot remove the last administrator'
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('allows demotion when another administrator remains', async () => {
      prisma.user.findUnique.mockResolvedValue(liveAdmin());
      prisma.user.count.mockResolvedValue(2);
      prisma.user.update.mockImplementation(async ({ data }: never) => ({
        ...liveAdmin(),
        ...(data as object),
      }));
      const out = await service.setUserRole(admin, 'admin-1', 'STUDENT' as never);
      expect(out.user.role).toBe('STUDENT');
    });

    it('rejects double-deactivate and restore-when-active without writes', async () => {
      prisma.user.findUnique.mockResolvedValue(liveAdmin({ deletedAt: new Date() }));
      await expect(service.deactivateUser(admin, 'admin-1')).rejects.toThrow('already deactivated');
      prisma.user.findUnique.mockResolvedValue(liveAdmin());
      await expect(service.restoreUser(admin, 'admin-1')).rejects.toThrow('already active');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
