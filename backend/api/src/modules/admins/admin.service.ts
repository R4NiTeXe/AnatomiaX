import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

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
        // Narrowed: passwordHash/updatedAt/deletedAt never leave the driver.
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      }),
      this.prisma.cohort.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        // Narrowed: inviteCode/updatedAt never leave the driver.
        select: {
          id: true,
          name: true,
          archivedAt: true,
          createdAt: true,
          createdById: true,
          _count: { select: { members: true } },
        },
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
        memberCount: c._count.members,
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

    // Typed where-input (no `as never`): the compiler now rejects unknown
    // fields/operators. AdminUsersQueryDto already constrains role at the
    // HTTP boundary; re-check here so direct service callers cannot smuggle
    // an invalid enum value into Prisma (which would surface as a 500).
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (query.role && query.role !== 'ALL') {
      if (query.role === 'STUDENT' || query.role === 'TEACHER' || query.role === 'ADMIN') {
        where.role = query.role;
      }
    }
    if (query.search) {
      const s = query.search.trim();
      if (s) {
        where.OR = [
          { email: { contains: s, mode: 'insensitive' } },
          { name: { contains: s, mode: 'insensitive' } },
        ];
      }
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        // Narrowed: passwordHash/updatedAt/deletedAt never leave the driver.
        select: { id: true, email: true, name: true, role: true, createdAt: true },
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

    // Typed where-input (no `as never`): AdminCohortsQueryDto constrains
    // archived to 'true'|'false'|'all' at the HTTP boundary.
    const where: Prisma.CohortWhereInput = {};
    if (query.search) {
      const s = query.search.trim();
      if (s) {
        where.OR = [
          { name: { contains: s, mode: 'insensitive' } },
          { institutionLabel: { contains: s, mode: 'insensitive' } },
        ];
      }
    }
    if (query.archived === 'true') {
      where.archivedAt = { not: null };
    } else if (query.archived === 'false') {
      where.archivedAt = null;
    }

    const [total, cohorts] = await Promise.all([
      this.prisma.cohort.count({ where }),
      this.prisma.cohort.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        // Narrowed: inviteCode/updatedAt never leave the driver.
        select: {
          id: true,
          name: true,
          institutionLabel: true,
          archivedAt: true,
          createdAt: true,
          _count: { select: { members: true } },
        },
      }),
    ]);

    const items = cohorts.map(c => {
      const count = c._count.members;
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

  /**
   * Account lifecycle state machine (deliberate, documented):
   * active (deletedAt null) ↔ deactivated (deletedAt set) → hard-deleted
   * (row gone, dependents cascade). Deactivation reuses the existing
   * soft-delete column — no new account states were invented. All auth
   * paths already exclude non-null deletedAt, so deactivation takes
   * effect immediately without touching sessions (existing refresh
   * tokens fail closed on next use).
   */
  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const [memberships, quizAttempts, cohortsCreated] = await Promise.all([
      this.prisma.cohortMember.count({ where: { userId: id } }),
      this.prisma.quizAttempt.count({ where: { userId: id } }),
      this.prisma.cohort.count({ where: { createdById: id } }),
    ]);
    return {
      user: toSafeUser(user),
      deactivatedAt: user.deletedAt,
      stats: { memberships, quizAttempts, cohortsCreated },
    };
  }

  /**
   * Guards the final administrator: any demote/deactivate/delete that would
   * leave zero live admins is rejected before any write — including
   * self-inflicted ones (there is deliberately no self-action ban; the
   * last-admin rule is the backstop, so every guard below stays reachable).
   */
  private async requireAnotherAdmin(exceptId: string): Promise<void> {
    const remaining = await this.prisma.user.count({
      where: { role: 'ADMIN', deletedAt: null },
    });
    const target = await this.prisma.user.findUnique({ where: { id: exceptId } });
    const targetIsLiveAdmin = !!target && target.role === 'ADMIN' && target.deletedAt === null;
    if (targetIsLiveAdmin && remaining <= 1) {
      throw new ConflictException('Cannot remove the last administrator');
    }
  }

  async setUserRole(actor: SafeUser, id: string, role: UserRole) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === role) {
      return { user: toSafeUser(target), deactivatedAt: target.deletedAt };
    }
    if (target.role === 'ADMIN' && role !== 'ADMIN') {
      await this.requireAnotherAdmin(id);
    }
    const updated = await this.prisma.user.update({ where: { id }, data: { role } });
    await this.audit.record(actor, 'user.role.changed', 'user', id, {
      from: target.role,
      to: role,
    });
    return { user: toSafeUser(updated), deactivatedAt: updated.deletedAt };
  }

  async deactivateUser(actor: SafeUser, id: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (target.deletedAt !== null) {
      throw new ConflictException('User is already deactivated');
    }
    if (target.role === 'ADMIN') {
      await this.requireAnotherAdmin(id);
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.record(actor, 'user.deactivated', 'user', id);
    return { user: toSafeUser(updated), deactivatedAt: updated.deletedAt };
  }

  async restoreUser(actor: SafeUser, id: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (target.deletedAt === null) {
      throw new ConflictException('User is already active');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: null },
    });
    await this.audit.record(actor, 'user.restored', 'user', id);
    return { user: toSafeUser(updated), deactivatedAt: updated.deletedAt };
  }

  async deleteUser(actor: SafeUser, id: string): Promise<void> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'ADMIN') {
      await this.requireAnotherAdmin(id);
    }
    // Same purge semantics as self-service account deletion: revoke
    // sessions, drop reset tokens, hard-delete the row (dependents cascade
    // per schema), all atomically.
    await this.prisma.$transaction(async tx => {
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.passwordResetToken.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });
    await this.audit.record(actor, 'user.deleted', 'user', id, { email: target.email });
  }

  async listAuditLogs(query: {
    action?: string;
    actorId?: string;
    targetType?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = query.action;
    if (query.actorId) where.actorId = query.actorId;
    if (query.targetType) where.targetType = query.targetType;
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    ]);
    return { items, total, page, limit };
  }

  async getCohort(id: string): Promise<(CohortView & { memberCount: number }) | null> {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id },
      // Narrowed: inviteCode/updatedAt/createdById never leave the driver.
      select: {
        id: true,
        name: true,
        institutionLabel: true,
        archivedAt: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });
    if (!cohort) return null;
    const count = cohort._count.members;
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
