import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    prisma = {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      cohort: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    } as unknown as Record<string, Record<string, jest.Mock>>;
    // nest as prisma.user etc.
    const prismaMock = {
      user: prisma.user,
      cohort: prisma.cohort,
    } as never;
    service = new AdminService(prismaMock as never);
  });

  describe('getOverview', () => {
    it('returns counts and recent items without sensitive fields', async () => {
      prisma.user.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(6) // student
        .mockResolvedValueOnce(3) // teacher
        .mockResolvedValueOnce(1); // admin
      prisma.cohort.count
        .mockResolvedValueOnce(4) // cohortCount
        .mockResolvedValueOnce(1); // archived
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
});
