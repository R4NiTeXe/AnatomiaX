import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser, toSafeUser } from '../users/safe-user';
import type { CohortView } from '../cohorts/cohorts.service';

export interface AdminOverview {
  totalUsers: number;
  byRole: { STUDENT: number; TEACHER: number; ADMIN: number };
  cohortCount: number;
  archivedCohortCount: number;
  recentUsers: SafeUser[];
  recentCohorts: Array<{
    id: string;
    name: string;
    archivedAt: Date | null;
    createdAt: Date;
    memberCount: number;
    createdById: string | null;
  }>;
}

export interface PaginatedUsers {
  items: SafeUser[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedCohorts {
  items: Array<CohortView & { memberCount: number }>;
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<AdminOverview> {
    const [totalUsers, students, teachers, admins, cohortCount, archivedCohortCount] =
      await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.user.count({ where: { deletedAt: null, role: 'STUDENT' } }),
        this.prisma.user.count({ where: { deletedAt: null, role: 'TEACHER' } }),
        this.prisma.user.count({ where: { deletedAt: null, role: 'ADMIN' } }),
        this.prisma.cohort.count(),
        this.prisma.cohort.count({ where: { archivedAt: { not: null } } }),
      ]);

    const [recentUsersRaw, recentCohortsRaw] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.cohort.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { _count: { select: { members: true } } },
      }),
    ]);

    return {
      totalUsers,
      byRole: { STUDENT: students, TEACHER: teachers, ADMIN: admins },
      cohortCount,
      archivedCohortCount,
      recentUsers: recentUsersRaw.map(toSafeUser),
      recentCohorts: recentCohortsRaw.map(c => ({
        id: c.id,
        name: c.name,
        archivedAt: c.archivedAt,
        createdAt: c.createdAt,
        memberCount: (c as unknown as { _count: { members: number } })._count.members,
        createdById: c.createdById,
      })),
    };
  }

  async listUsers(query: {
    search?: string;
    role?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedUsers> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { deletedAt: null };
    if (query.role && query.role !== 'ALL') {
      (where as Record<string, unknown>).role = query.role;
    }
    if (query.search) {
      const s = query.search.trim();
      if (s) {
        (where as Record<string, unknown>).OR = [
          { email: { contains: s, mode: 'insensitive' } },
          { name: { contains: s, mode: 'insensitive' } },
        ];
      }
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where: where as never }),
      this.prisma.user.findMany({
        where: where as never,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: users.map(toSafeUser),
      total,
      page,
      limit,
    };
  }

  async listCohorts(query: {
    search?: string;
    archived?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedCohorts> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.search) {
      const s = query.search.trim();
      if (s) {
        (where as Record<string, unknown>).OR = [
          { name: { contains: s, mode: 'insensitive' } },
          { institutionLabel: { contains: s, mode: 'insensitive' } },
        ];
      }
    }
    if (query.archived === 'true') {
      (where as Record<string, unknown>).archivedAt = { not: null };
    } else if (query.archived === 'false') {
      (where as Record<string, unknown>).archivedAt = null;
    }

    const [total, cohorts] = await Promise.all([
      this.prisma.cohort.count({ where: where as never }),
      this.prisma.cohort.findMany({
        where: where as never,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { members: true } } },
      }),
    ]);

    const items = cohorts.map(c => {
      const count = (c as unknown as { _count: { members: number } })._count.members;
      const isOwner = false;
      return {
        id: c.id,
        name: c.name,
        institutionLabel: c.institutionLabel,
        archivedAt: c.archivedAt,
        createdAt: c.createdAt,
        myRole: null,
        memberCount: count,
      } as CohortView & { memberCount: number };
    });

    return { items, total, page, limit };
  }

  async getCohort(id: string): Promise<(CohortView & { memberCount: number }) | null> {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!cohort) return null;
    const count = (cohort as unknown as { _count: { members: number } })._count.members;
    return {
      id: cohort.id,
      name: cohort.name,
      institutionLabel: cohort.institutionLabel,
      archivedAt: cohort.archivedAt,
      createdAt: cohort.createdAt,
      myRole: null,
      memberCount: count,
    };
  }
}
