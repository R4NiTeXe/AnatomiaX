import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Cohort, CohortMember, CohortMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SafeUser } from '../users/users.service';

export interface CohortView {
  id: string;
  name: string;
  institutionLabel: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  myRole: CohortMemberRole | 'OWNER' | null;
}

export interface CohortWithInvite extends CohortView {
  inviteCode: string;
}

export interface CohortMemberView {
  userId: string;
  name: string | null;
  role: CohortMemberRole;
  joinedAt: Date;
}

interface AccessContext {
  cohort: Cohort;
  membership: CohortMember | null;
  isOwner: boolean;
  isAdmin: boolean;
}

function newInviteCode(): string {
  return randomBytes(16).toString('base64url');
}

/** Latest attempts returned per member by getProgress (was per-member `take`). */
const QUIZ_ATTEMPTS_PER_MEMBER = 20;

@Injectable()
export class CohortsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Teacher/Admin entry: creates the cohort and seats the creator as TEACHER. */
  async create(
    creator: SafeUser,
    input: { name: string; institutionLabel?: string }
  ): Promise<CohortWithInvite> {
    const created = await this.prisma.$transaction(async tx => {
      const cohort = await tx.cohort.create({
        data: {
          name: input.name,
          institutionLabel: input.institutionLabel ?? null,
          inviteCode: newInviteCode(),
          createdById: creator.id,
        },
      });
      await tx.cohortMember.create({
        data: { cohortId: cohort.id, userId: creator.id, role: 'TEACHER' },
      });
      return cohort;
    });
    // Invite code is returned only here (and on regeneration): possession of
    // the code is the join credential, so it is never part of general views.
    return { ...this.toView(created, 'TEACHER', true), inviteCode: created.inviteCode };
  }

  async listMine(user: SafeUser): Promise<CohortView[]> {
    const memberships = await this.prisma.cohortMember.findMany({
      where: { userId: user.id },
      include: { cohort: true },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map(m => this.toView(m.cohort, m.role, this.isOwner(m.cohort, user)));
  }

  async get(user: SafeUser, cohortId: string): Promise<CohortView> {
    const ctx = await this.requireViewer(user, cohortId);
    return this.toView(ctx.cohort, ctx.membership?.role ?? null, ctx.isOwner || ctx.isAdmin);
  }

  async update(
    user: SafeUser,
    cohortId: string,
    input: { name?: string; institutionLabel?: string }
  ): Promise<CohortView> {
    const ctx = await this.requireManager(user, cohortId);
    this.requireActive(ctx.cohort);
    const cohort = await this.prisma.cohort.update({
      where: { id: cohortId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.institutionLabel !== undefined
          ? { institutionLabel: input.institutionLabel }
          : {}),
      },
    });
    return this.toView(cohort, ctx.membership?.role ?? null, true);
  }

  async archive(user: SafeUser, cohortId: string): Promise<CohortView> {
    const ctx = await this.requireManager(user, cohortId);
    const cohort = await this.prisma.cohort.update({
      where: { id: cohortId },
      data: { archivedAt: new Date() },
    });
    return this.toView(cohort, ctx.membership?.role ?? null, true);
  }

  async regenerateInvite(user: SafeUser, cohortId: string): Promise<CohortWithInvite> {
    const ctx = await this.requireManager(user, cohortId);
    this.requireActive(ctx.cohort);
    const cohort = await this.prisma.cohort.update({
      where: { id: cohortId },
      data: { inviteCode: newInviteCode() },
    });
    return {
      ...this.toView(cohort, ctx.membership?.role ?? null, true),
      inviteCode: cohort.inviteCode,
    };
  }

  async join(user: SafeUser, inviteCode: string): Promise<CohortView> {
    const cohort = await this.prisma.cohort.findFirst({ where: { inviteCode } });
    if (!cohort) {
      throw new NotFoundException('Invalid invite code');
    }
    if (cohort.archivedAt !== null) {
      throw new ForbiddenException('Cohort is archived');
    }
    const existing = await this.prisma.cohortMember.findFirst({
      where: { cohortId: cohort.id, userId: user.id },
    });
    if (existing) {
      throw new ConflictException('Already a member of this cohort');
    }
    const membership = await this.prisma.cohortMember.create({
      data: { cohortId: cohort.id, userId: user.id, role: 'STUDENT' },
    });
    return this.toView(cohort, membership.role, this.isOwner(cohort, user));
  }

  async leave(user: SafeUser, cohortId: string): Promise<void> {
    // Membership (not ownership) ends here; createdById is untouched on purpose.
    const membership = await this.prisma.cohortMember.findFirst({
      where: { cohortId, userId: user.id },
    });
    if (!membership) {
      throw new NotFoundException('Cohort not found');
    }
    await this.prisma.cohortMember.delete({ where: { id: membership.id } });
  }

  async removeMember(actor: SafeUser, cohortId: string, targetUserId: string): Promise<void> {
    const ctx = await this.requireManager(actor, cohortId);
    this.requireActive(ctx.cohort);
    const membership = await this.prisma.cohortMember.findFirst({
      where: { cohortId, userId: targetUserId },
    });
    if (!membership) {
      throw new NotFoundException('Member not found');
    }
    await this.prisma.cohortMember.delete({ where: { id: membership.id } });
  }

  async listMembers(viewer: SafeUser, cohortId: string): Promise<CohortMemberView[]> {
    await this.requireViewer(viewer, cohortId);
    const members = await this.prisma.cohortMember.findMany({
      where: { cohortId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    // Email intentionally excluded: members see names/roles only.
    return members.map(m => ({
      userId: m.userId,
      name: (m.user as { name: string | null }).name,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async getProgress(
    viewer: SafeUser,
    cohortId: string
  ): Promise<
    Array<{
      userId: string;
      name: string | null;
      role: CohortMemberRole;
      joinedAt: Date;
      studiedKeys: string[];
      quizAttempts: Array<{
        id: string;
        score: number;
        total: number;
        bodyModel: string;
        completedAt: Date;
      }>;
    }>
  > {
    const ctx = await this.requireViewer(viewer, cohortId);
    // Progress is owner/admin only; members without manage rights get 403 (no oracle leak — already viewer-checked).
    if (!ctx.isOwner && !ctx.isAdmin) {
      throw new ForbiddenException('Insufficient permissions');
    }
    // Archived cohorts remain readable but progress is still owner-gated (consistent with invite regeneration).
    const members = await this.prisma.cohortMember.findMany({
      where: { cohortId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    if (members.length === 0) return [];
    // 8.20.22: batched fetch — 2 queries total regardless of member count
    // (was 2 sequential queries per member). Per-member semantics preserved
    // exactly: latest QUIZ_ATTEMPTS_PER_MEMBER attempts desc + snapshot keys,
    // members in joinedAt order. `userId` is selected only for in-memory
    // grouping and never leaves the server beyond the existing DTO.
    const userIds = members.map(m => m.userId);
    const [snapshots, attempts] = await Promise.all([
      this.prisma.progressSnapshot.findMany({ where: { userId: { in: userIds } } }),
      this.prisma.quizAttempt.findMany({
        where: { userId: { in: userIds } },
        orderBy: { completedAt: 'desc' },
        select: {
          id: true,
          userId: true,
          score: true,
          total: true,
          bodyModel: true,
          completedAt: true,
        },
      }),
    ]);
    const keysByUser = new Map<string, string[]>();
    for (const s of snapshots) {
      keysByUser.set(s.userId, s.studiedKeys ?? []);
    }
    const attemptsByUser = new Map<string, typeof attempts>();
    for (const a of attempts) {
      const list = attemptsByUser.get(a.userId) ?? [];
      // Global desc order keeps each member subsequence desc, so the first
      // QUIZ_ATTEMPTS_PER_MEMBER equal per-member `take` results exactly.
      if (list.length < QUIZ_ATTEMPTS_PER_MEMBER) {
        list.push(a);
        attemptsByUser.set(a.userId, list);
      }
    }
    return members.map(m => ({
      userId: m.userId,
      name: (m.user as { name: string | null }).name,
      role: m.role,
      joinedAt: m.joinedAt,
      studiedKeys: keysByUser.get(m.userId) ?? [],
      quizAttempts: (attemptsByUser.get(m.userId) ?? []).map(a => ({
        id: a.id,
        score: a.score,
        total: a.total,
        bodyModel: a.bodyModel,
        completedAt: a.completedAt,
      })),
    }));
  }

  private isOwner(cohort: Cohort, user: SafeUser): boolean {
    return cohort.createdById === user.id;
  }

  private toView(cohort: Cohort, role: CohortMemberRole | null, ownerOrAdmin: boolean): CohortView {
    return {
      id: cohort.id,
      name: cohort.name,
      institutionLabel: cohort.institutionLabel,
      archivedAt: cohort.archivedAt,
      createdAt: cohort.createdAt,
      myRole: ownerOrAdmin ? 'OWNER' : role,
    };
  }

  private async requireViewer(user: SafeUser, cohortId: string): Promise<AccessContext> {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } });
    if (!cohort) {
      throw new NotFoundException('Cohort not found');
    }
    const isAdmin = user.role === 'ADMIN';
    const isOwner = this.isOwner(cohort, user);
    if (isAdmin || isOwner) {
      const membership = await this.prisma.cohortMember.findFirst({
        where: { cohortId, userId: user.id },
      });
      return { cohort, membership, isOwner: isOwner || isAdmin, isAdmin };
    }
    const membership = await this.prisma.cohortMember.findFirst({
      where: { cohortId, userId: user.id },
    });
    if (!membership) {
      // Outsiders get 404 (no existence oracle); members without rights get 403 at manage time.
      throw new NotFoundException('Cohort not found');
    }
    return { cohort, membership, isOwner: false, isAdmin: false };
  }

  private async requireManager(user: SafeUser, cohortId: string): Promise<AccessContext> {
    const ctx = await this.requireViewer(user, cohortId);
    if (!ctx.isOwner && !ctx.isAdmin) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return ctx;
  }

  private requireActive(cohort: Cohort): void {
    if (cohort.archivedAt !== null) {
      throw new ForbiddenException('Cohort is archived');
    }
  }
}
